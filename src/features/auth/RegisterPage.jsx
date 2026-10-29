// Register screen — port of register_screen.dart.
// Batch/department/roll are auto-extracted from the CUET email.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CuetBackground, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { parseCuetEmail } from '../../lib/constants.js';
import {
  validateConfirmPassword,
  validateCuetEmail,
  validateName,
  validatePassword,
  validateRequired,
} from '../../lib/validators.js';
import { describeApiError } from '../../api/errors.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [detected, setDetected] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'email') {
      const parsed = parseCuetEmail(value);
      setDetected(parsed);
    }
  };

  const validate = () => {
    const next = {
      email: validateCuetEmail(form.email.trim()),
      name: validateName(form.name.trim()),
      phone: validateRequired(form.phone.trim(), 'Phone number'),
      password: validatePassword(form.password),
      confirm: validateConfirmPassword(form.confirm, form.password),
    };
    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const email = form.email.trim().toLowerCase();

    setLoading(true);
    try {
      await auth.signUpWithEmail(email, form.password, { name: form.name.trim() });
      // Best-effort profile completion (phone + display name).
      try {
        await auth.updateProfileServer({ phone: form.phone.trim(), name: form.name.trim() });
      } catch {
        /* profile sync is best-effort */
      }
      navigate('/setup');
    } catch (err) {
      toast.error(`Registration failed: ${describeApiError(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CuetBackground asset="/images/cuet_building.jpg" overlayOpacity={0.92}>
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <div className="text-center">
            <Icon name="school" size={64} className="text-white" />
            <h1 className="mt-4 text-headline-sm font-semibold text-white">Join CUET AI Campus</h1>
            <p className="mt-2 text-body-md text-white/85">
              Use your official CUET email. Batch, department and roll are auto-extracted —
              for example <span className="font-semibold">u2204037@student.cuet.ac.bd</span> is
              Batch 22, CSE, roll 037 (ID 2204037).
            </p>
          </div>

          <form onSubmit={handleRegister} className="mt-7 rounded-[20px] bg-surface p-6 shadow-2xl">
            <TextField
              label="CUET Student Email"
              hint="u2204037@student.cuet.ac.bd"
              icon="mail"
              type="email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />

            {detected && (
              <div className="mt-4 rounded-xl bg-primary/10 p-3 dark:bg-primary-light/15">
                <div className="flex items-center gap-2 text-primary dark:text-primary-light">
                  <Icon name="check_circle" size={18} filled />
                  <span className="text-label-md font-semibold">Auto-detected from email</span>
                </div>
                <dl className="mt-2 space-y-1 text-body-sm">
                  <div className="flex gap-1">
                    <dt className="text-ink-muted">Student ID:</dt>
                    <dd className="font-semibold text-ink">{detected.studentId}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-ink-muted">Batch:</dt>
                    <dd className="font-semibold text-ink">{detected.batch}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-ink-muted">Department:</dt>
                    <dd className="font-semibold text-ink">{detected.department}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-ink-muted">Roll:</dt>
                    <dd className="font-semibold text-ink">{String(detected.roll).padStart(3, '0')}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="mt-4">
              <TextField
                label="Full Name"
                hint="Md. Rashadur Rahman"
                icon="person"
                value={form.name}
                onChange={set('name')}
                error={errors.name}
              />
            </div>
            <div className="mt-4">
              <TextField
                label="Phone Number"
                hint="01XXXXXXXXX"
                icon="call"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                error={errors.phone}
              />
            </div>
            <div className="mt-4">
              <TextField
                label="Password"
                icon="lock"
                type="password"
                value={form.password}
                onChange={set('password')}
                error={errors.password}
              />
            </div>
            <div className="mt-4">
              <TextField
                label="Confirm Password"
                icon="lock"
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                error={errors.confirm}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-60"
            >
              {loading ? <Spinner size={20} /> : 'Create Account'}
            </button>

            <p className="mt-5 text-center text-body-md text-ink-muted">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-primary hover:underline">
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </CuetBackground>
  );
}
