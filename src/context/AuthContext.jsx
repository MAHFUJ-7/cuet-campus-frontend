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
  devLogin as apiDevLogin,
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
import { OFFLINE_SESSION_TOKEN, parseCuetEmail } from '../lib/constants.js';
import { parseUserProfile, profileHasPermission, profileHasRole, roleLabel } from '../lib/models.js';
import { offlineCache } from '../lib/offlineCache.js';
import { localFeed } from '../lib/localFeed.js';
import { chatHistory } from '../lib/ai/chatHistory.js';
import { setSelectedTermId } from '../features/coordinator/coordinatorState.js';
import { useToast } from './ToastContext.jsx';
import {
  enrichProfile,
  studentAssignments,
  studentRoutine,
  studentUpdates,
} from '../data/seedData.js';

const AuthContext = createContext(null);

const EMPTY = { initialized: false, loggedIn: false, offline: false, profile: null };

function isUnauthorized(error) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/** Post-login destination for any profile (safe to call before context updates). */
export function dashboardRouteForProfile(profile) {
  if (profileHasRole(profile, 'coordinator')) return '/coordinator';
  if (profileHasRole(profile, 'admin')) return '/admin';
  return '/home';
}

/** Default offline permissions for a set of roles (BackendAuth._defaultPermissions). */
function defaultPermissions(roles) {
  const perms = [
    'student.read.schedule',
    'student.read.exam',
    'student.read.notice',
    'student.use.ai',
  ];
  if (roles.includes('cr')) {
    perms.push(
      'cr.create.notice',
      'cr.declare.auto',
      'cr.declare.mid_break',
      'cr.update.class',
      'cr.update.room',
      'cr.update.time',
      'cr.schedule.extra_class'
    );
  }
  if (roles.includes('coordinator')) {
    perms.push(
      'coordinator.manage.students',
      'coordinator.manage.sections',
      'coordinator.manage.crs',
      'coordinator.review.updates',
      'coordinator.review.overrides'
    );
  }
  if (roles.includes('admin')) perms.push('admin.manage.all');
  return perms;
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

  /**
   * Fully offline test sign-in: builds the session locally from the email —
   * no server contact. Student and CR accounts share the same official email
   * format (u2204037@student.cuet.ac.bd); the preset card passes the role
   * explicitly because the address no longer encodes it.
   *
   * Legacy dev addresses still work for backwards compatibility:
   *   cr*        -> student + cr
   *   *coord*    -> coordinator
   *   dev@/admin -> admin
   */
  const signInOffline = useCallback(
    async (rawEmail, { displayName = null, section = 'A', role = null } = {}) => {
      const email = String(rawEmail ?? '').trim().toLowerCase();
      const localPart = email.split('@')[0] || email;
      const requestedRole = String(role ?? '').trim().toLowerCase();

      let primaryRole = 'student';
      const roles = ['student'];

      if (requestedRole === 'cr') {
        if (!roles.includes('cr')) roles.push('cr');
      } else if (requestedRole === 'coordinator') {
        primaryRole = 'coordinator';
        roles.splice(0, roles.length, 'student', 'coordinator');
      } else if (requestedRole === 'admin') {
        primaryRole = 'admin';
        roles.splice(0, roles.length, 'student', 'admin');
      } else if (localPart.startsWith('cr')) {
        if (!roles.includes('cr')) roles.push('cr');
      } else if (localPart.includes('coord') || localPart.includes('coordinator')) {
        primaryRole = 'coordinator';
        roles.splice(0, roles.length, 'student', 'coordinator');
      } else if (localPart === 'dev' || localPart.startsWith('admin')) {
        primaryRole = 'admin';
        roles.splice(0, roles.length, 'student', 'admin');
      }

      const derivedName = localPart
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');

      const parsedEmail = parseCuetEmail(email);
      const studentIdMatch = localPart.match(/\d{4,}/);

      let profile = {
        id: `offline-${localPart}`,
        email,
        name: displayName?.trim()
          ? displayName.trim()
          : parsedEmail
            ? `Student ${parsedEmail.studentId}`
            : derivedName || localPart,
        photoUrl: null,
        phone: '',
        studentId: parsedEmail?.studentId ?? (studentIdMatch ? studentIdMatch[0] : ''),
        role: primaryRole,
        roles,
        permissions: defaultPermissions(roles),
        department: null,
        batch: null,
        section: null,
        academicSession: null,
        hasPassword: false,
      };

      // Enrich with academic context and seed demo data for offline use.
      profile = enrichProfile(profile, { section });
      offlineCache.cacheRoutine(studentRoutine({ section }));
      offlineCache.cacheWeeklyRoutine(studentRoutine({ section }));
      offlineCache.cacheUpdates(studentUpdates({ section }));
      offlineCache.cacheAssignments(studentAssignments({ section }));

      setAuthToken(OFFLINE_SESSION_TOKEN);
      offlineCache.cacheUser(profile);
      setState({ initialized: true, loggedIn: true, offline: true, profile });
      return profile;
    },
    []
  );

  /** Dev-mode email/password login (backend issues a token directly). */
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

  /**
   * Quick test login: tries the dev server first (4s budget); when it cannot
   * be reached, falls back to a fully offline session.
   */
  const quickTestLogin = useCallback(
    async (rawEmail) => {
      const email = String(rawEmail ?? '').trim();
      try {
        const response = await apiDevLogin(email, { timeoutMs: 4000 });
        const payload = extractPayload(response);
        const token = payload?.customToken ?? payload?.token;
        if (token) {
          setAuthToken(token);
          const profile = await adoptSession();
          return { reachedServer: true, profile };
        }
        throw new Error('no token');
      } catch {
        const profile = await signInOffline(email);
        return { reachedServer: false, profile };
      }
    },
    [adoptSession, signInOffline]
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
      isAdmin: profileHasRole(profile, 'admin'),
      isStudentAndCR: profileHasRole(profile, 'student') && profileHasRole(profile, 'cr'),
      roleLabel: roleLabel(profile),
      /** Student and Student+CR both go to /home (CR tools layered on top). */
      dashboardRoute: () => dashboardRouteForProfile(profile),
      signInWithEmail,
      signUpWithEmail,
      quickTestLogin,
      signInOffline,
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
    quickTestLogin,
    signInOffline,
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
