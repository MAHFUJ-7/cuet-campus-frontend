// Reset Password — target of the link the backend issues from /auth/forgot-password
// (`/reset-password?token=...`). Without this screen the emailed link dead-ends on 404.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CuetBackground, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { validateConfirmPassword, validatePassword } from '../../lib/validators.js';
import { resetPassword as apiResetPassword } from '../../api/endpoints.js';
import { describeApiError } from '../../api/errors.js';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const token = (params.get('token') ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    const next = {
      password: validatePassword(password),
      confirm: validateConfirmPassword(confirm, password),
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setLoading(true);
    try {
      await apiResetPassword({ token, password });
      toast.success('Password updated — sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CuetBackground asset="/images/cuet_lake.jpg" overlayOpacity={0.93}>
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-[20px] bg-surface p-7 shadow-2xl">
          <div className="flex justify-center text-primary">
            <Icon name="lock_reset" size={56} />
          </div>
          <h1 className="mt-4 text-center text-headline-sm font-semibold text-ink">
            Choose a New Password
          </h1>

          {token ? (
            <>
              <p className="mt-2 text-center text-body-md text-ink-muted">
                Enter a new password for your account.
              </p>
              <form onSubmit={handleReset} className="mt-6">
                <TextField
                  label="New Password"
                  icon="lock"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                />
                <div className="mt-4">
                  <TextField
                    label="Confirm New Password"
                    icon="lock"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    error={errors.confirm}
                  />
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-primary dark:bg-primary-light/15 dark:text-primary-light">
                  <Icon name="info" size={16} className="mt-0.5" />
                  <span className="text-label-sm">
                    At least 8 characters with uppercase, lowercase, and a number.
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white hover:bg-primary-light disabled:opacity-60"
                >
                  {loading ? <Spinner size={20} /> : 'Update Password'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-center text-body-md text-ink-muted">
                This reset link is missing its token. Request a new one and open the link again.
              </p>
              <Link
                to="/forgot-password"
                className="mt-6 block w-full rounded-xl bg-primary py-3.5 text-center text-title-md font-semibold text-white hover:bg-primary-light"
              >
                Request a New Link
              </Link>
            </>
          )}

          <Link
            to="/login"
            className="mt-3 block w-full rounded-xl py-2.5 text-center text-label-lg font-medium text-primary hover:bg-primary/5"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </CuetBackground>
  );
}
