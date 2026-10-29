// Login screen — port of login_screen.dart.
// Email/password login, quick test login and preset role cards.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CuetBackground, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { dashboardRouteForProfile, useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { validateLoginEmail, validateLoginPassword } from '../../lib/validators.js';
import { describeApiError } from '../../api/errors.js';

const QUICK_PRESETS = [
  {
    id: 'student',
    label: 'Student',
    sublabel: 'Sec A • L3 T-II',
    icon: 'school',
    gradient: ['#3B82F6', '#1D4ED8'],
    email: 'u2204001@student.cuet.ac.bd',
    name: 'Demo Student',
    section: 'A',
    route: '/home',
  },
  {
    id: 'cr',
    label: 'CR',
    sublabel: 'Sec B • L3 T-II',
    icon: 'campaign',
    gradient: ['#F59E0B', '#D97706'],
    email: 'u2204002@student.cuet.ac.bd',
    name: 'Demo CR',
    section: 'B',
    role: 'cr',
    route: '/home',
  },
  {
    id: 'coordinator',
    label: 'Coordinator',
    sublabel: 'CSE Dept',
    icon: 'verified_user',
    gradient: ['#8B5CF6', '#5B21B6'],
    email: 'coordinator@cuet.ac.bd',
    name: 'Demo Coordinator',
    section: 'A',
    route: '/coordinator',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [presetBusy, setPresetBusy] = useState(null);

  const showSnack = (message, isError = true) =>
    isError ? toast.error(message) : toast.success(message);

  /** Honours ?from=... when the visitor was bounced here by a guard. */
  const finishLogin = (profile) => {
    const from = location.state?.from;
    const fromPath =
      typeof from === 'string'
        ? from
        : from && typeof from.pathname === 'string'
          ? `${from.pathname}${from.search ?? ''}`
          : null;
    const safeFrom = fromPath?.startsWith('/') && !fromPath.startsWith('/login') ? fromPath : null;
    navigate(safeFrom ?? dashboardRouteForProfile(profile), { replace: true });
  };

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    const emailError = validateLoginEmail(email.trim());
    const passwordError = validateLoginPassword(password);
    setErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoading(true);
    try {
      const profile = await auth.signInWithEmail(email.trim(), password);
      finishLogin(profile);
    } catch (err) {
      showSnack(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  /** Frictionless test login: tries the dev server, falls back to offline. */
  const handleQuickLogin = async () => {
    const value = email.trim();
    if (!value || !value.includes('@')) {
      showSnack('Enter your email above, then tap Quick Test Login');
      return;
    }
    setLoading(true);
    try {
      const { reachedServer, profile } = await auth.quickTestLogin(value);
      const label = profile?.roles?.length
        ? profile.roles
            .map((r) => ({ student: 'Student', cr: 'CR', coordinator: 'Coordinator', admin: 'Admin' })[r] ?? r)
            .join(' + ')
        : profile?.role ?? '';
      showSnack(
        reachedServer
          ? `Signed in as ${label} (server)`
          : `Offline test session as ${label} — server unreachable`,
        false
      );
      finishLogin(profile);
    } catch (err) {
      showSnack(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  /** One-tap demo login for a preset test account (fully offline). */
  const handlePresetLogin = async (preset) => {
    setPresetBusy(preset.id);
    try {
      await auth.signInOffline(preset.email, {
        displayName: preset.name,
        section: preset.section,
        role: preset.role ?? null,
      });
      showSnack(`Signed in as ${preset.label} — Section ${preset.section}`, false);
      navigate(preset.route, { replace: true });
    } catch (err) {
      showSnack(describeApiError(err));
    } finally {
      setPresetBusy(null);
    }
  };

  const busy = loading || presetBusy != null;

  return (
    <CuetBackground asset="/images/cuet_admin.jpg" overlayOpacity={0.9}>
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-3xl bg-surface p-7 shadow-2xl">
          {/* Brand row */}
          <div className="flex items-center justify-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon name="school" size={28} />
            </span>
            <span className="text-headline-sm font-bold text-primary">CUET AI Campus</span>
          </div>

          <h1 className="mt-7 text-center text-headline-md font-semibold text-ink">Welcome Back</h1>
          <p className="mt-1.5 text-center text-body-md text-ink-muted">
            Sign in to continue to your campus
          </p>

          <form className="mt-7" onSubmit={handleLogin}>
            <TextField
              label="CUET Student Email"
              hint="u2204037@student.cuet.ac.bd"
              icon="mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <div className="mt-4">
              <TextField
                label="Password"
                icon="lock"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
            </div>

            <div className="mt-1 text-right">
              <Link to="/forgot-password" className="text-label-lg font-medium text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-60"
            >
              {loading && presetBusy == null ? <Spinner size={20} /> : 'Sign In'}
            </button>
          </form>

          {/* Dev quick login */}
          <div className="mt-4">
            <div className="flex items-center gap-3 text-primary">
              <Icon name="bolt" size={14} />
              <span className="whitespace-nowrap text-label-sm font-extrabold tracking-[0.12em]">
                QUICK TEST LOGIN
              </span>
              <span className="h-px flex-1 bg-outline" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePresetLogin(preset)}
                  className="group rounded-[18px] p-3 text-left text-white shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${preset.gradient[0]}, ${preset.gradient[1]})`,
                    boxShadow: `0 4px 12px ${preset.gradient[1]}46`,
                  }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    {presetBusy === preset.id ? <Spinner size={16} /> : <Icon name={preset.icon} size={20} filled />}
                  </span>
                  <span className="mt-2 block truncate text-label-lg font-extrabold">{preset.label}</span>
                  <span className="block truncate text-[9px] font-medium text-white/90">
                    {preset.sublabel}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-1 text-center">
              <button
                type="button"
                onClick={handleQuickLogin}
                disabled={busy}
                className="text-label-md font-medium text-ink-muted hover:text-ink disabled:opacity-50"
              >
                Use typed email instead
              </button>
            </div>
          </div>

          <p className="mt-5 text-center text-body-md text-ink-muted">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-primary hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </CuetBackground>
  );
}
