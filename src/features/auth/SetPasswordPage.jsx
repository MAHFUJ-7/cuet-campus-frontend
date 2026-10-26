// Set Password — port of set_password_screen.dart (Google accounts).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CuetBackground, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { validateConfirmPassword, validatePassword } from '../../lib/validators.js';
import { setPassword as apiSetPassword } from '../../api/endpoints.js';
import { describeApiError } from '../../api/errors.js';

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    const next = {
      password: validatePassword(password),
      confirm: validateConfirmPassword(confirm, password),
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setLoading(true);
    try {
      await apiSetPassword({ password });
      toast.success('Password set successfully!');
      navigate(auth.dashboardRoute(), { replace: true });
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CuetBackground asset="/images/cuet_campus.jpg" overlayOpacity={0.93}>
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-[20px] bg-surface p-7 shadow-2xl">
          <div className="flex justify-center">
            <Icon name="password" size={56} className="text-primary" />
          </div>
          <h1 className="mt-4 text-center text-headline-sm font-semibold text-ink">
            Set Your Password
          </h1>
          <p className="mt-2 text-center text-body-md text-ink-muted">
            Create a password so you can also login with your email.
          </p>

          <form onSubmit={handleSetPassword} className="mt-7">
            <TextField
              label="Password"
              icon="lock"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <div className="mt-4">
              <TextField
                label="Confirm Password"
                icon="lock"
                type="password"
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
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white hover:bg-primary-light disabled:opacity-60"
            >
              {loading ? <Spinner size={20} /> : 'Set Password & Continue'}
            </button>
            <button
              type="button"
              onClick={() => navigate(auth.dashboardRoute(), { replace: true })}
              className="mt-2 w-full rounded-xl py-2.5 text-label-lg font-medium text-primary hover:bg-primary/5"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </CuetBackground>
  );
}
