// Route guards — port of the GoRouter redirect logic.
import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { CuetBackground, Spinner } from '../components/ui/index.jsx';
import PageFallback from '../components/PageFallback.jsx';

export function FullScreenLoader() {
  return (
    <CuetBackground asset="/images/cuet_campus.jpg" overlayOpacity={0.82}>
      <div className="flex min-h-full flex-col items-center justify-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white">
          <Spinner size={28} />
        </span>
      </div>
    </CuetBackground>
  );
}

/** Requirement: a logged-in session. Others are sent to /login. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.initialized) return <FullScreenLoader />;
  if (!auth.isLoggedIn) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: location.pathname, search: location.search } }}
      />
    );
  }
  const needsAcademicSetup =
    auth.profile?.roles?.includes('student') &&
    !auth.profile?.section &&
    location.pathname !== '/setup';
  if (needsAcademicSetup) return <Navigate to="/setup" replace />;
  return (
    <Suspense fallback={<PageFallback />}>
      <Outlet />
    </Suspense>
  );
}

/**
 * Defense-in-depth role guard (server authorization is authoritative).
 * Waits for the profile instead of redirecting while it is still loading.
 */
export function RequireRole({ roles, children }) {
  const auth = useAuth();
  if (!auth.initialized) return <FullScreenLoader />;
  if (auth.isLoggedIn && !auth.profile) return <FullScreenLoader />;
  const allowed = auth.roles.some((r) => roles.includes(r));
  if (!allowed) return <Navigate to={auth.dashboardRoute()} replace />;
  return children ?? <Outlet />;
}

/** Auth-only pages: a logged-in visitor is redirected to their dashboard. */
export function PublicOnly({ children }) {
  const auth = useAuth();
  if (!auth.initialized) return <FullScreenLoader />;
  if (auth.isLoggedIn) return <Navigate to={auth.dashboardRoute()} replace />;
  return children;
}
