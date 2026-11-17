// Authoritative backend session/profile state — port of BackendAuth.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getProfile as apiGetProfile,
  login as apiLogin,
  register as apiRegister,
  updateMyProfile as apiUpdateMyProfile,
} from '../api/endpoints.js';
import {
  ApiError,
  clearAuthToken,
  extractPayload,
  getAuthToken,
  onUnauthorized,
  setAuthToken,
} from '../api/client.js';
import { describeApiError } from '../api/errors.js';
import { OFFLINE_SESSION_TOKEN } from '../lib/constants.js';
import { parseUserProfile, profileHasPermission, profileHasRole, roleLabel } from '../lib/models.js';
import { offlineCache } from '../lib/offlineCache.js';
import { localFeed } from '../lib/localFeed.js';
import { setSelectedTermId } from '../features/coordinator/coordinatorState.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

const EMPTY = { initialized: false, loggedIn: false, offline: false, profile: null };

function isUnauthorized(error) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/** Post-login destination for any profile (safe to call before context updates). */
export function dashboardRouteForProfile(profile) {
  if (profileHasRole(profile, 'coordinator')) return '/coordinator';
  return '/home';
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const booted = useRef(false);
  const profileRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    profileRef.current = state.profile;
  }, [state.profile]);

  const clearLocalSession = useCallback(async () => {
    clearAuthToken();
    offlineCache.clearCache();
    localFeed.clearAll();
    setSelectedTermId(null);
    profileRef.current = null;
    setState({ initialized: true, loggedIn: false, offline: false, profile: null });
  }, []);

  // A 401 from any request ends the session everywhere (and clears per-user data).
  useEffect(
    () =>
      onUnauthorized(() => {
        offlineCache.clearCache();
        localFeed.clearAll();
        setSelectedTermId(null);
        profileRef.current = null;
        setState({ initialized: true, loggedIn: false, offline: false, profile: null });
        toast.warning('Your session expired. Please sign in again.');
      }),
    [toast]
  );

  const loadProfile = useCallback(async () => {
    const response = await apiGetProfile();
    const payload = extractPayload(response);
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid profile response');
    }
    return parseUserProfile(payload);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await loadProfile();
      offlineCache.cacheUser(profile);
      profileRef.current = profile;
      setState((s) => ({ ...s, loggedIn: true, initialized: true, profile }));
      return profile;
    } catch (error) {
      if (isUnauthorized(error)) {
        await clearLocalSession();
      }
      throw error;
    }
  }, [loadProfile, clearLocalSession]);

  /** Marks a token session as logged in and loads the profile. */
  const adoptSession = useCallback(async () => {
    try {
      return await refreshProfile();
    } catch (error) {
      if (isUnauthorized(error)) throw error;

      // Transient failure: fall back to the cached profile for this session.
      const cached = offlineCache.getCachedUser();
      if (cached) {
        profileRef.current = cached;
        setState({ initialized: true, loggedIn: true, offline: false, profile: cached });
        return cached;
      }

      // Without a profile we cannot route safely — fail the sign-in outright.
      clearAuthToken();
      setState({ initialized: true, loggedIn: false, offline: false, profile: null });
      throw error;
    }
  }, [refreshProfile]);

  /** Email/password login (backend issues a token directly). */
  const signInWithEmail = useCallback(
    async (email, password) => {
      const response = await apiLogin({ email, password });
      const payload = extractPayload(response);
      const token = payload?.customToken ?? payload?.token;
      if (!token) {
        throw new Error(
          'The server did not return a session token. Ensure the backend runs with NODE_ENV=development or Firebase configured.'
        );
      }
      setAuthToken(token);
      const profile = await adoptSession();
      if (!profile) {
        throw new Error('Signed in, but your profile could not be loaded. Please try again.');
      }
      return profile;
    },
    [adoptSession]
  );

  /** Dev-mode registration then automatic login. */
  const signUpWithEmail = useCallback(
    async (email, password, { name } = {}) => {
      await apiRegister({
        email,
        name: name?.trim() || email.split('@')[0],
        password,
      });
      return signInWithEmail(email, password);
    },
    [signInWithEmail]
  );

  /** Applies a local-only profile edit (offline sessions). */
  const updateProfileLocal = useCallback(async ({ name, phone } = {}) => {
    const current = profileRef.current ?? offlineCache.getCachedUser();
    if (!current) return null;

    const updated = {
      ...current,
      ...(name != null && name.trim() ? { name: name.trim() } : {}),
      ...(phone != null ? { phone } : {}),
    };
    profileRef.current = updated;
    offlineCache.cacheUser(updated);
    setState((s) => (s.profile ? { ...s, profile: updated } : s));
    return updated;
  }, []);

  /** Server-side profile update (online sessions). */
  const updateProfileServer = useCallback(
    async (updates) => {
      await apiUpdateMyProfile(updates);
      return refreshProfile();
    },
    [refreshProfile]
  );

  const signOut = useCallback(async () => {
    await clearLocalSession();
  }, [clearLocalSession]);

  // Boot: restore session from storage.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    (async () => {
      const token = getAuthToken();
      if (!token) {
        setState({ ...EMPTY, initialized: true });
        return;
      }

      // Offline test sessions never touch the network; restore from cache.
      if (token === OFFLINE_SESSION_TOKEN) {
        const profile = offlineCache.getCachedUser();
        if (profile) {
          profileRef.current = profile;
          setState({ initialized: true, loggedIn: true, offline: true, profile });
        } else {
          clearAuthToken(); // no profile → cannot restore; allow a fresh sign-in
          setState({ ...EMPTY, initialized: true });
        }
        return;
      }

      try {
        const profile = await loadProfile();
        offlineCache.cacheUser(profile);
        profileRef.current = profile;
        setState({ initialized: true, loggedIn: true, offline: false, profile });
      } catch (error) {
        if (isUnauthorized(error)) {
          await clearLocalSession();
        } else {
          // Offline startup may use only the profile associated with this session.
          const profile = offlineCache.getCachedUser();
          profileRef.current = profile;
          setState({ initialized: true, loggedIn: Boolean(profile), offline: false, profile });
        }
      }
    })();
  }, [loadProfile, clearLocalSession]);

  const value = useMemo(() => {
    const { initialized, loggedIn, offline, profile } = state;
    return {
      initialized,
      isLoggedIn: loggedIn,
      isOfflineSession: offline,
      profile,
      role: profile?.role ?? null,
      roles: profile?.roles ?? [],
      permissions: profile?.permissions ?? [],
      hasRole: (r) => profileHasRole(profile, r),
      hasPermission: (p) => profileHasPermission(profile, p),
      isStudent: profileHasRole(profile, 'student'),
      isCR: profileHasRole(profile, 'cr'),
      isCoordinator: profileHasRole(profile, 'coordinator'),
      isStudentAndCR: profileHasRole(profile, 'student') && profileHasRole(profile, 'cr'),
      roleLabel: roleLabel(profile),
      /** Student and Student+CR both go to /home (CR tools layered on top). */
      dashboardRoute: () => dashboardRouteForProfile(profile),
      signInWithEmail,
      signUpWithEmail,
      adoptSession,
      refreshProfile,
      updateProfileLocal,
      updateProfileServer,
      signOut,
      describeApiError,
    };
  }, [
    state,
    signInWithEmail,
    signUpWithEmail,
    adoptSession,
    refreshProfile,
    updateProfileLocal,
    updateProfileServer,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
