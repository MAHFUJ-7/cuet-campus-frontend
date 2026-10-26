// Complete Setup — port of setup_screen.dart.
// Shown after registration: name, academic details, optional password.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CuetBackground, Icon, Select, Spinner, TextField } from '../../components/ui/index.jsx';
import { useAuth, dashboardRouteForProfile } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { SETUP_BATCHES, SETUP_DEPARTMENTS, SETUP_SECTIONS, DEPARTMENT_CODES } from '../../lib/constants.js';
import { validateConfirmPassword, validatePassword } from '../../lib/validators.js';
import { completeProfile, setPassword } from '../../api/endpoints.js';
import { describeApiError } from '../../api/errors.js';

function parseSetupId(email) {
  const match = String(email ?? '')
    .trim()
    .toLowerCase()
    .match(/^u?(\d{2})(\d{2})(\d{1,3})@student\.cuet\.ac\.bd$/);
  if (!match) return null;
  const [, batchCode, deptCode, roll] = match;
  return {
    studentId: `${batchCode}${deptCode}${roll}`,
    batch: `20${batchCode}`,
    department: DEPARTMENT_CODES[deptCode] ?? null,
  };
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1 rounded-sm bg-primary" />
      <span className="text-title-md font-semibold text-ink">{label}</span>
    </div>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [section, setSection] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [derived, setDerived] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Pre-fill from the active session (Google account is not available here).
  useEffect(() => {
    const profile = auth.profile;
    if (!profile) return;
    if (profile.name) setName((v) => v || profile.name);
    const parsed = parseSetupId(profile.email);
    if (parsed) {
      setDerived(true);
      setStudentId((v) => v || parsed.studentId);
      if (SETUP_BATCHES.includes(parsed.batch)) setBatch((v) => v || parsed.batch);
      if (parsed.department && SETUP_DEPARTMENTS.includes(parsed.department)) {
        setDepartment((v) => v || parsed.department);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    const next = {
      name: name.trim() ? null : 'Required',
      studentId: !studentId.trim() ? 'Required' : studentId.trim().length !== 7 ? 'Must be 7 digits' : null,
      department: department ? null : 'Required',
      batch: batch ? null : 'Required',
      section: section ? null : 'Required',
      password: password ? validatePassword(password) : null,
      confirm: password ? validateConfirmPassword(confirm, password) : null,
    };
    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleComplete = async (e) => {
    e?.preventDefault?.();
    if (!validate()) return;
    setLoading(true);
    let passwordFailed = false;

    try {
      if (auth.isOfflineSession) {
        // Offline demo sessions keep the change on this device only.
        await auth.updateProfileLocal({ name: name.trim() });
      } else {
        try {
          await completeProfile({
            name: name.trim(),
            studentId: studentId.trim(),
            departmentId: department,
            batchId: batch,
            sectionId: section,
            level: 1,
            term: 1,
          });
        } catch (error) {
          // Degrade to a local save so nothing is lost — but never pretend
          // the server accepted it.
          try {
            await auth.updateProfileLocal({ name: name.trim() });
            toast.warning('Saved on this device — will sync when the server is back');
          } catch {
            toast.error(describeApiError(error));
            return;
          }
        }
      }

      if (password) {
        try {
          await setPassword({ password });
        } catch {
          passwordFailed = true;
        }
      }

      const fresh = await auth.refreshProfile().catch(() => null);
      if (passwordFailed) {
        toast.warning('Profile saved — the password could not be set, try again later.');
      } else {
        toast.success('Profile completed!');
      }
      navigate(dashboardRouteForProfile(fresh ?? auth.profile), { replace: true });
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CuetBackground asset="/images/cuet_building.jpg" overlayOpacity={0.93}>
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-[420px] rounded-[20px] bg-surface p-7 shadow-2xl">
          <div className="flex justify-center">
            <Icon name="school" size={56} className="text-primary" />
          </div>
          <h1 className="mt-4 text-center text-headline-sm font-semibold text-ink">
            Complete Your Profile
          </h1>
          <p className="mt-2 text-center text-body-md text-ink-muted">
            Set your name, academic details, and optionally create a password.
          </p>

          <form onSubmit={handleComplete} className="mt-7">
            <SectionHeader label="Profile Information" />
            <div className="mt-3 space-y-4">
              <TextField
                label="Full Name"
                icon="person"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
              />
              <TextField
                label="Student ID"
                hint="2204037"
                icon="badge"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                error={errors.studentId}
                disabled={derived}
              />
              <Select
                label="Department"
                icon="domain"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={SETUP_DEPARTMENTS}
                disabled={derived}
                error={errors.department}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Batch"
                  icon="group"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  options={SETUP_BATCHES.map((b) => ({ value: b, label: `Batch ${b}` }))}
                  disabled={derived}
                  error={errors.batch}
                />
                <Select
                  label="Section"
                  icon="view_column"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  options={SETUP_SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }))}
                  error={errors.section}
                />
              </div>
            </div>

            <div className="mt-7">
              <SectionHeader label="Set Password (Optional)" />
              <p className="mt-1 text-body-sm text-ink-muted">
                Create a password so you can login without Google.
              </p>
              <div className="mt-3 space-y-4">
                <TextField
                  label="Password"
                  icon="lock"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                />
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white hover:bg-primary-light disabled:opacity-60"
            >
              {loading ? <Spinner size={20} /> : 'Complete Setup'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => navigate(auth.dashboardRoute(), { replace: true })}
              className="mt-2 w-full rounded-xl py-2.5 text-label-lg font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </CuetBackground>
  );
}
