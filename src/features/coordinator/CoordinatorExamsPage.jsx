// Exam Routine — port of coordinator_exams_screen.dart.
// Official exam management within scope: list, create, edit, remove.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  createExam,
  deleteExam,
  getCoordinatorSections,
  getCourses,
  getExams,
  updateExam,
} from '../../api/endpoints.js';
import {
  coordinatorCourses,
  coordinatorExams,
  coordinatorSections,
} from '../../data/seedData.js';
import { isoDate } from '../../lib/datetime.js';
import { isOfflineSession } from '../../lib/session.js';
import { sectionIdOf } from './CoordinatorAcademicsPage.jsx';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const INPUT_CLASS =
  'w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-body-md text-ink focus:border-primary focus:outline-none';

const examIdOf = (exam) => String(exam?._id ?? exam?.id ?? '');

const EXAM_TYPES = [
  { value: 'midterm', label: 'Mid-term' },
  { value: 'final', label: 'Final' },
];

/** "HH:MM" → minutes since midnight, or null when out of range. */
function parseMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export default function CoordinatorExamsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [exams, setExams] = useState([]);
  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dialog, setDialog] = useState(null); // { existing }
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isOfflineSession()) {
      setExams(coordinatorExams());
      setSections(coordinatorSections());
      setCourses(coordinatorCourses());
      setLoading(false);
      return;
    }
    try {
      const departmentId = auth.profile?.department?.id;
      const [examsRes, sectionsRes, coursesRes] = await Promise.all([
        getExams(),
        getCoordinatorSections(),
        getCourses({ departmentId }),
      ]);
      setExams(toArray(extractPayload(examsRes)));
      setSections(toArray(extractPayload(sectionsRes)));
      setCourses(toArray(extractPayload(coursesRes)));
      setLoading(false);
    } catch (loadError) {
      setError(describeApiError(loadError));
      setLoading(false);
    }
  }, [auth.profile?.department?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes the add/edit dialog.
  useEffect(() => {
    if (!dialog) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDialog(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialog]);

  const openDialog = (existing = null) => {
    const currentCourse =
      existing?.courseId && typeof existing.courseId === 'object'
        ? existing.courseId._id ?? existing.courseId.id
        : existing?.courseId;
    const currentSection =
      existing?.sectionId && typeof existing.sectionId === 'object'
        ? existing.sectionId._id ?? existing.sectionId.id
        : existing?.sectionId;
    setForm({
      courseId: currentCourse ? String(currentCourse) : String(courses[0]?._id ?? courses[0]?.id ?? ''),
      sectionId: currentSection
        ? String(currentSection)
        : String(sections[0]?._id ?? sections[0]?.id ?? ''),
      examType: EXAM_TYPES.some((type) => type.value === existing?.examType)
        ? existing.examType
        : 'final',
      examDate: existing?.examDate ? String(existing.examDate).slice(0, 10) : '',
      startTime: String(existing?.startTime ?? '').slice(0, 5),
      endTime: String(existing?.endTime ?? '').slice(0, 5),
      room: existing?.room ?? '',
    });
    setFormErrors({});
    setDialog({ existing });
  };

  const save = async () => {
    if (!form) return;
    const errors = {};
    if (!form.courseId) errors.courseId = 'Required';
    if (!form.sectionId) errors.sectionId = 'Required';
    if (!form.examDate) {
      errors.examDate = 'Required';
    } else if (form.examDate < isoDate(new Date())) {
      errors.examDate = 'Pick today or a later date';
    }
    const startMinutes = parseMinutes(form.startTime);
    const endMinutes = parseMinutes(form.endTime);
    if (startMinutes == null) errors.startTime = 'Use HH:MM (00:00–23:59)';
    if (endMinutes == null) {
      errors.endTime = 'Use HH:MM (00:00–23:59)';
    } else if (startMinutes != null && endMinutes <= startMinutes) {
      errors.endTime = 'End must be after start';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (isOfflineSession()) {
      toast.info('Publishing exams requires a connection.');
      return;
    }

    setSaving(true);
    const payload = {
      courseId: form.courseId,
      sectionId: form.sectionId,
      examType: form.examType || 'final',
      examDate: form.examDate,
      startTime: form.startTime.trim(),
      endTime: form.endTime.trim(),
      ...(form.room.trim() ? { room: form.room.trim() } : {}),
    };

    try {
      if (dialog?.existing) {
        await updateExam(examIdOf(dialog.existing), payload);
        toast.success('Exam updated');
      } else {
        await createExam(payload);
        toast.success('Exam published');
      }
      setDialog(null);
      load();
    } catch (saveError) {
      toast.error(describeApiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    if (isOfflineSession()) {
      toast.info('Removing exams requires a connection.');
      return;
    }
    try {
      await deleteExam(examIdOf(target));
      toast.success('Exam removed');
      load();
    } catch (removeError) {
      toast.error(describeApiError(removeError));
    }
  };

  const sectionLabel = (exam) => {
    const raw = exam?.sectionId;
    const id = raw && typeof raw === 'object' ? String(raw._id ?? raw.id ?? '') : String(raw ?? '');
    const match = sections.find((section) => sectionIdOf(section) === id);
    if (match) return match.label ?? match.name ?? '-';
    return raw && typeof raw === 'object' ? raw.label ?? raw.name ?? '-' : '-';
  };

  const sortedExams = [...exams].sort((a, b) =>
    String(a.examDate ?? '').localeCompare(String(b.examDate ?? ''))
  );

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Exam Routine"
        onBack={() => navigate(-1)}
        actions={
          <Button variant="filled" icon="post_add" onClick={() => openDialog(null)}>
            Add exam
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : sortedExams.length === 0 ? (
        <EmptyState
          icon="event_busy"
          title="No exams published in scope yet."
          message="Add the first exam to publish it to students."
        />
      ) : (
        <div className="space-y-2">
          {sortedExams.map((exam) => {
            const course =
              exam.courseId && typeof exam.courseId === 'object' ? exam.courseId : null;
            return (
              <div
                key={examIdOf(exam)}
                className="flex items-center gap-3 rounded-2xl border border-outline/60 bg-surface px-3.5 py-2.5"
              >
                <Icon name="event_available" size={20} className="shrink-0 text-critical" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-title-sm font-bold text-ink">
                    {course?.code ?? '?'} · {sectionLabel(exam)}
                  </p>
                  <p className="truncate text-label-md text-ink-muted">
                    {String(exam.examType ?? 'final').toUpperCase()} •{' '}
                    {String(exam.examDate ?? '').slice(0, 10)} • {exam.startTime}-{exam.endTime}
                    {exam.room ? ` • ${exam.room}` : ''}
                  </p>
                </div>
                <IconButton
                  icon="edit"
                  label="Edit exam"
                  onClick={() => openDialog(exam)}
                />
                <IconButton
                  icon="delete"
                  label="Remove exam"
                  onClick={() => setDeleteTarget(exam)}
                  className="hover:text-critical"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add / edit dialog */}
      {dialog && form && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
          onClick={() => setDialog(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-dialog-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="exam-dialog-title" className="text-title-lg font-bold text-ink">
              {dialog.existing ? 'Edit exam' : 'Add exam'}
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-label-md font-medium text-ink-muted">Course</span>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {courses.map((course) => (
                    <option key={course._id ?? course.id} value={course._id ?? course.id}>
                      {course.code ?? course._id ?? course.id}
                    </option>
                  ))}
                </select>
                {formErrors.courseId && (
                  <span className="mt-1 block text-label-sm text-critical">{formErrors.courseId}</span>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-label-md font-medium text-ink-muted">Section</span>
                <select
                  value={form.sectionId}
                  onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {sections.map((section) => (
                    <option key={sectionIdOf(section)} value={sectionIdOf(section)}>
                      {section.label ?? section.name}
                    </option>
                  ))}
                </select>
                {formErrors.sectionId && (
                  <span className="mt-1 block text-label-sm text-critical">{formErrors.sectionId}</span>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-label-md font-medium text-ink-muted">Exam type</span>
                <select
                  value={form.examType}
                  onChange={(e) => setForm({ ...form, examType: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {EXAM_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-label-md font-medium text-ink-muted">Exam date</span>
                <input
                  type="date"
                  value={form.examDate}
                  min={isoDate(new Date())}
                  onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                  className={INPUT_CLASS}
                />
                {formErrors.examDate && (
                  <span className="mt-1 block text-label-sm text-critical">{formErrors.examDate}</span>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-label-md font-medium text-ink-muted">
                    Start (09:00)
                  </span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className={INPUT_CLASS}
                  />
                  {formErrors.startTime && (
                    <span className="mt-1 block text-label-sm text-critical">
                      {formErrors.startTime}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1 block text-label-md font-medium text-ink-muted">
                    End (12:00)
                  </span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className={INPUT_CLASS}
                  />
                  {formErrors.endTime && (
                    <span className="mt-1 block text-label-sm text-critical">
                      {formErrors.endTime}
                    </span>
                  )}
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-label-md font-medium text-ink-muted">
                  Room (optional)
                </span>
                <input
                  type="text"
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  placeholder="e.g. 3403"
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outlined"
                className="flex-1"
                onClick={() => setDialog(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="filled"
                className="flex-1"
                onClick={save}
                disabled={saving}
              >
                {saving ? <Spinner size={16} /> : <Icon name="check" size={18} />}
                <span>{dialog.existing ? 'Save' : 'Publish'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Remove exam?"
        message="Students will no longer see this exam."
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}
