// Responsive app shell.
//
// Mobile (the Flutter layout): fixed bottom navigation bar.
// Desktop (web adaptation): left sidebar; the same destinations.
import { Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Icon, IconButton } from '../ui/index.jsx';
import PageFallback from '../PageFallback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

function NavItem({ item, active }) {
  const activeClasses = 'bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light';
  const idleClasses = 'text-ink-muted hover:bg-surface-variant hover:text-ink';

  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-label-lg font-medium transition-colors ${
        active ? activeClasses : idleClasses
      }`}
    >
      <Icon name={item.icon} size={22} filled={active} />
      <span className="truncate">{item.label}</span>
      {item.badge > 0 && (
        <span
          className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-label-sm font-bold text-white"
          aria-label={`${item.badge} unread`}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

export default function ShellLayout({ items, variant = 'student', brandTo = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const isActive = (item) => {
    if (location.pathname === item.to) return true;
    // CR Center owns both the dashboard and the announcement composer.
    if (item.to === '/cr-dashboard' && location.pathname.startsWith('/cr/')) return true;
    return (
      item.to !== '/home' &&
      item.to !== '/coordinator' &&
      location.pathname.startsWith(`${item.to}/`)
    );
  };

  const bottomBg =
    variant === 'primary'
      ? isDark
        ? 'bg-primary-dark'
        : 'bg-primary'
      : isDark
        ? 'bg-primary-dark'
        : 'bg-surface border-t border-outline';

  const lightText = variant === 'primary' && !isDark;
  const handleSignOut = async () => {
    await auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-full min-h-screen bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-label-lg focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-outline/70 bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <Icon name="school" size={22} filled />
          </span>
          <div className="leading-tight">
            <p className="text-title-md font-bold text-ink">CUET AI Campus</p>
            <p className="text-label-sm text-ink-muted">Academic OS</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
          {items.map((item) => (
            <NavItem key={item.to} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="border-t border-outline/70 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={auth.profile?.name ?? 'U'} size={38} src={auth.profile?.photoUrl} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-label-lg font-semibold text-ink">
                {auth.profile?.name ?? 'User'}
              </p>
              <p className="truncate text-label-sm text-ink-muted">{auth.roleLabel}</p>
            </div>
            <IconButton
              icon={isDark ? 'light_mode' : 'dark_mode'}
              label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            />
            <IconButton icon="logout" label="Sign out" onClick={handleSignOut} />
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-outline/70 bg-surface/95 px-4 backdrop-blur lg:hidden">
          <Link
            to={brandTo ?? items[0]?.to ?? '/home'}
            className="flex items-center gap-2"
            aria-label="CUET AI Campus home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Icon name="school" size={18} filled />
            </span>
            <span className="text-title-md font-bold text-ink">CUET AI Campus</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <IconButton
              icon={isDark ? 'light_mode' : 'dark_mode'}
              label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
            />
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 pb-24 lg:pb-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch justify-around pb-safe lg:hidden ${bottomBg}`}
        aria-label="Mobile navigation"
      >
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  active
                    ? variant === 'primary' && !isDark
                      ? 'bg-white/20'
                      : 'bg-primary/15 dark:bg-primary-light/25'
                    : ''
                }`}
              >
                <Icon
                  name={item.icon}
                  size={23}
                  filled={active}
                  className={
                    lightText
                      ? active
                        ? 'text-white'
                        : 'text-white/70'
                      : active
                        ? 'text-primary dark:text-primary-light'
                        : 'text-ink-muted'
                  }
                />
              </span>
              <span
                className={`text-label-sm font-medium ${
                  lightText
                    ? active
                      ? 'text-white'
                      : 'text-white/70'
                    : active
                      ? 'text-primary dark:text-primary-light'
                      : 'text-ink-muted'
                }`}
              >
                {item.shortLabel ?? item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Main authenticated shell — Home · Routine · AI · Updates · (CR Center) · Profile. */
export function AppLayout() {
  const auth = useAuth();
  const items = [
    { to: '/home', icon: 'home', label: 'Home' },
    { to: '/routine', icon: 'schedule', label: 'Routine' },
    { to: '/ai-chat', icon: 'auto_awesome', label: 'AI' },
    { to: '/updates', icon: 'notifications', label: 'Updates' },
    ...(auth.isCR
      ? [{ to: '/cr-dashboard', icon: 'campaign', label: 'CR Center', shortLabel: 'CR' }]
      : []),
    { to: '/profile', icon: 'person', label: 'Profile' },
  ];
  return <ShellLayout items={items} variant="primary" brandTo="/home" />;
}

/** Coordinator shell — Home · Academics · Notices · Profile. */
export function CoordinatorLayout() {
  const items = [
    { to: '/coordinator', icon: 'space_dashboard', label: 'Home' },
    { to: '/coordinator/academics', icon: 'school', label: 'Academics' },
    { to: '/coordinator/notices', icon: 'campaign', label: 'Notices' },
    { to: '/coordinator/profile', icon: 'person', label: 'Profile' },
  ];
  return <ShellLayout items={items} variant="surface" brandTo="/coordinator" />;
}
