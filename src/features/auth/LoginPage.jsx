// Login screen — email/password sign-in only.
// (The old dev quick-test login and preset role cards were removed.)
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CuetBackground, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { dashboardRouteForProfile, useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { validateLoginEmail, validateLoginPassword } from '../../lib/validators.js';
import { describeApiError } from '../../api/errors.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-60"
            >
              {loading ? <Spinner size={20} /> : 'Sign In'}
            </button>
          </form>

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
