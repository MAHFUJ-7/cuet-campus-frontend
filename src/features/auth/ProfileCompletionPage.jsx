// Complete Profile — port of profile_completion_screen.dart.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select, Spinner, TextField } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { KEYS, writeBool } from '../../lib/storage.js';
import { completeProfile } from '../../api/endpoints.js';
import { describeApiError } from '../../api/errors.js';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electrical & Electronic Engineering',
  'Civil Engineering',
  'Mechanical Engineering',
  'Chemical Engineering',
  'Architecture',
  'Physics',
  'Mathematics',
];
const BATCHES = ['2020', '2021', '2022', '2023', '2024', '2025'];
const SECTIONS = ['A', 'B', 'C', 'D'];
const SESSIONS = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25'];

export default function ProfileCompletionPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('');
  const [batch, setBatch] = useState('');
  const [section, setSection] = useState('');
  const [session, setSession] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {
      studentId: !studentId ? 'Please enter your student ID' : studentId.length !== 7 ? 'Student ID must be 7 digits' : null,
      department: department ? null : 'Please select your department',
      batch: batch ? null : 'Please select your batch',
      section: section ? null : 'Required',
      session: session ? null : 'Required',
    };
    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      try {
        await completeProfile({
          studentId: studentId.trim(),
          departmentId: department,
          batchId: batch,
          sectionId: section,
          session,
          level: 1,
          term: 1,
        });
      } catch {
        /* best-effort */
      }
      writeBool(KEYS.profileCompleted, true);
      navigate(auth.dashboardRoute(), { replace: true });
    } catch (err) {
      toast.error(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-lg px-6 py-8">
        <div className="flex justify-center">
          <img src="/images/cuet_logo.png" alt="CUET" className="h-16 w-16 object-contain" />
        </div>
        <h1 className="mt-6 text-center text-headline-sm font-semibold text-ink">
          Complete Your Profile
        </h1>
        <p className="mt-2 text-center text-body-md text-ink-muted">
          Please provide your academic details to get started.
        </p>

        <form onSubmit={handleComplete} className="mt-8">
          <TextField
            label="Student ID"
            hint="2204037"
            icon="badge"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            error={errors.studentId}
          />
          <div className="mt-4">
            <Select
              label="Department"
              icon="domain"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              options={DEPARTMENTS}
              error={errors.department}
            />
          </div>
          <div className="mt-4">
            <Select
              label="Batch"
              icon="group"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              options={BATCHES.map((b) => ({ value: b, label: `Batch ${b}` }))}
              error={errors.batch}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Select
              label="Section"
              icon="view_column"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              options={SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }))}
              error={errors.section}
            />
            <Select
              label="Session"
              icon="calendar_today"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              options={SESSIONS}
              error={errors.session}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white hover:bg-primary-light disabled:opacity-60"
          >
            {loading ? <Spinner size={20} /> : 'Complete Profile'}
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
  );
}
