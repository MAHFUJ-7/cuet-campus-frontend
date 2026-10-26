// Forgot password — port of forgot_password_screen.dart.
// Web adaptation: uses the backend reset endpoint (no Firebase in this build).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CuetBackground, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { forgotPassword } from '../../api/endpoints.js';
import { describeApiError } from '../../api/errors.js';
import { validateCuetEmail } from '../../lib/validators.js';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    const emailError = validateCuetEmail(email.trim());
    setError(emailError);
    if (emailError) return;

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
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
          {sent ? (
            <>
              <div className="flex justify-center text-primary">
                <Icon name="mark_email_read" size={64} />
              </div>
              <h1 className="mt-4 text-center text-headline-sm font-semibold text-ink">
                Check Your Email
              </h1>
              <p className="mt-2 text-center text-body-md text-ink-muted">
                We've sent a password reset link to {email.trim()}
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-7 w-full rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white hover:bg-primary-light"
              >
                Back to Login
              </button>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-3 w-full rounded-xl py-2.5 text-label-lg font-medium text-primary hover:bg-primary/5"
              >
                Try a different email
              </button>
            </>
          ) : (
            <>
              <div className="flex justify-center text-primary">
                <Icon name="lock_reset" size={64} />
              </div>
              <h1 className="mt-4 text-center text-headline-sm font-semibold text-ink">
                Forgot Password?
              </h1>
              <p className="mt-2 text-center text-body-md text-ink-muted">
                Enter your CUET email address and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleReset} className="mt-7">
                <TextField
                  label="CUET Email"
                  hint="u2204037@student.cuet.ac.bd"
                  icon="mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-60"
                >
                  {loading ? <Spinner size={20} /> : 'Send Reset Link'}
                </button>
                <Link
                  to="/login"
                  className="mt-3 block w-full rounded-xl py-2.5 text-center text-label-lg font-medium text-primary hover:bg-primary/5"
                >
                  Back to Login
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </CuetBackground>
  );
}
