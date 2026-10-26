// Splash screen — port of splash_screen.dart.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CuetBackground, Icon, Spinner } from '../../components/ui/index.jsx';
import { dashboardRouteForProfile, useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { KEYS, readBool } from '../../lib/storage.js';

export default function SplashPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { isDark } = useTheme();
  const navigated = useRef(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Branding beat (Flutter waits 1800ms); never block forever on the profile.
  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinElapsed(true), 1800);
    const maxTimer = window.setTimeout(() => setTimedOut(true), 5200);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  // Navigate from the latest auth state (not a stale first-render closure).
  useEffect(() => {
    if (!minElapsed || navigated.current) return;
    if (!auth.initialized && !timedOut) return;

    navigated.current = true;
    if (auth.isLoggedIn && auth.profile) {
      navigate(dashboardRouteForProfile(auth.profile), { replace: true });
      return;
    }

    let seen = false;
    try {
      seen = readBool(KEYS.hasSeenOnboarding, false);
    } catch {
      seen = false;
    }
    navigate(seen ? '/login' : '/onboarding', { replace: true });
  }, [minElapsed, timedOut, auth.initialized, auth.isLoggedIn, auth.profile, navigate]);

  return (
    <CuetBackground asset="/images/cuet_campus.jpg" overlayOpacity={isDark ? 0.88 : 0.78}>
      <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="animate-pulse-soft flex h-28 w-28 items-center justify-center rounded-full bg-white/15 text-white">
          <Icon name="school" size={56} />
        </div>
        <h1 className="mt-4 text-display-md font-extrabold tracking-wide text-white">
          CUET AI Campus
        </h1>
        <p className="text-body-md text-white/85">Your Intelligent Academic Companion</p>
        <div className="mt-10 text-white/85">
          <Spinner size={28} />
        </div>
      </div>
    </CuetBackground>
  );
}
