// Exam Routine pane — the term's final exam schedule and wrap-up state.
// Purely presentational: CRs declare exams and wrap-ups from the CR Center,
// coordinators approve them, and this pane shows the approved result.
import { useEffect, useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { getExams, getOverrides } from '../../api/endpoints.js';
import { parseScheduleOverride } from '../../lib/models.js';

const dmyFromIso = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const weekdayFromIso = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { weekday: 'long' });
};

const daysFromToday = (iso) => {
  if (!iso) return null;
  const target = new Date(`${iso}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

const dateOfOverride = (item) => item?.specificDate || item?.startDate || item?.date || null;

function StatCard({ icon, tone, label, value, sub, delay = 0 }) {
  return (
    <Card
      className="glass animate-fade-up flex items-center gap-3 p-4 transition-transform duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-label-sm font-bold tracking-wider text-ink-muted">{label}</p>
        <p className="truncate text-title-sm font-extrabold text-ink">{value}</p>
        {sub && <p className="truncate text-label-sm text-ink-muted">{sub}</p>}
      </div>
    </Card>
  );
}

// Palette-coded badges: type (blue/orange family) + approval state
// (amber pending, green approved, red rejected).
const EXAM_TYPE_BADGES = {
  final: { label: 'FINAL', className: 'bg-gradient-to-r from-dark-orange to-carrot text-white shadow-sm' },
  ct: { label: 'CT', className: 'bg-info/15 text-info' },
  quiz: { label: 'QUIZ', className: 'bg-info/15 text-info' },
  makeup: { label: 'MAKEUP', className: 'bg-violet/15 text-violet' },
  other: { label: 'EXAM', className: 'bg-surface-variant text-ink-muted' },
};

const STATUS_BADGES = {
  pending: { label: 'PENDING APPROVAL', className: 'bg-warning/15 text-warning' },
  approved: { label: 'APPROVED', className: 'bg-success/15 text-success' },
  rejected: { label: 'REJECTED', className: 'bg-critical/15 text-critical' },
};

function ExamRow({ exam, showStatus }) {
  const course = exam.courseId && typeof exam.courseId === 'object' ? exam.courseId : null;
  const code = course?.code ?? 'Course';
  const title = course?.title ?? '';
  const typeBadge = EXAM_TYPE_BADGES[exam.examType] ?? EXAM_TYPE_BADGES.other;
  const statusBadge = showStatus ? STATUS_BADGES[exam.status] ?? null : null;
  const pending = exam.status === 'pending';
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border bg-surface p-3.5 ${
        pending ? 'border-warning/40' : 'border-outline/60'
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${
          pending ? 'bg-warning/10' : 'bg-gradient-to-br from-dark-orange/20 to-flame/15'
        }`}
      >
        <span
          className={`text-label-md font-extrabold leading-none ${
            pending ? 'text-warning' : 'text-ginger dark:text-dark-orange'
          }`}
        >
          {dmyFromIso(exam.examDate).split(' ')[0]}
        </span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
          {dmyFromIso(exam.examDate).split(' ')[1] ?? ''}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-label-lg font-bold text-ink">{code}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${typeBadge.className}`}>
            {typeBadge.label}
          </span>
          {statusBadge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
        {title && <p className="truncate text-label-sm text-ink-muted">{title}</p>}
        <p className="text-label-sm text-ink-muted">
          {weekdayFromIso(exam.examDate)} · {exam.startTime}–{exam.endTime}
          {exam.room ? ` · Room ${exam.room}` : ''}
        </p>
        {pending && (
          <p className="mt-0.5 animate-pulse-soft text-label-sm text-warning">
            Waiting for coordinator approval — not visible to students yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ExamRoutinePane({ section }) {
  const auth = useAuth();
  const seesStatus = ['cr', 'coordinator'].some((r) => auth.roles?.includes(r));

  const [exams, setExams] = useState(null);
  const [examsError, setExamsError] = useState(null);
  const [wrapUps, setWrapUps] = useState({ classes_end: null });

  const loadExams = async () => {
    try {
      const response = await getExams({ limit: 100 });
      const payload = extractPayload(response);
      const items = Array.isArray(payload) ? payload : payload?.items ?? [];
      const sorted = [...items].sort((a, b) =>
        String(a.examDate).localeCompare(String(b.examDate))
      );
      setExams(sorted);
      setExamsError(null);
    } catch (error) {
      setExamsError(describeApiError(error));
    }
  };

  const loadWrapUps = async () => {
    try {
      const response = await getOverrides({ sectionId: section?.id, status: 'approved' });
      const payload = extractPayload(response);
      const list = (Array.isArray(payload) ? payload : payload?.items ?? []).map(
        parseScheduleOverride
      );
      const pick = (type) =>
        list
          .filter((item) => item.type === type)
          .sort(
            (a, b) =>
              new Date(a.startDate ?? a.specificDate ?? 0) -
              new Date(b.startDate ?? b.specificDate ?? 0)
          )
          .pop() ?? null;
      setWrapUps({ classes_end: pick('classes_end') });
    } catch {
      // Status cards simply show "Not set" when the list can't be loaded.
      setWrapUps({ classes_end: null });
    }
  };

  useEffect(() => {
    loadExams();
    loadWrapUps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.id]);

  const firstExam = exams?.find((e) => e.status !== 'rejected') ?? null;
  const firstExamCountdown = firstExam ? daysFromToday(firstExam.examDate) : null;

  return (
    <div className="space-y-4">
      {/* Term wrap-up status */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatCard
          icon="event_busy"
          tone="bg-gradient-to-br from-safety/20 to-flame/15 text-safety"
          label="DL STARTS (CLASSES END)"
          value={wrapUps.classes_end ? dmyFromIso(dateOfOverride(wrapUps.classes_end)) : 'Not declared'}
          sub={
            wrapUps.classes_end
              ? 'Exam-prep leave begins'
              : 'Regular classes continue'
          }
          delay={0}
        />
        <StatCard
          icon="event"
          tone="bg-gradient-to-br from-cantaloupe/30 to-marigold/20 text-ginger dark:text-cantaloupe"
          label="FIRST EXAM"
          value={firstExam ? dmyFromIso(firstExam.examDate) : 'None published'}
          sub={
            firstExam && firstExamCountdown != null
              ? firstExamCountdown > 0
                ? `In ${firstExamCountdown} day${firstExamCountdown === 1 ? '' : 's'}`
                : 'Happening / done'
              : 'Awaiting the exam routine'
          }
          delay={60}
        />
        <StatCard
          icon="fact_check"
          tone="bg-gradient-to-br from-burnt-sienna/20 to-sienna/20 text-sienna dark:text-burnt-sienna"
          label="EXAMS PUBLISHED"
          value={exams == null ? '—' : String(exams.length)}
          sub={
            exams && exams.some((e) => e.status === 'pending')
              ? `${exams.filter((e) => e.status === 'pending').length} awaiting approval`
              : 'All approved'
          }
          delay={120}
        />
      </div>

      {/* Exam timeline */}
      <Card className="glass-ember animate-fade-up delay-3 p-4">
        <div className="flex items-center gap-2">
          <Icon name="event" size={18} className="text-safety" />
          <p className="text-ember-gradient text-label-lg font-extrabold">Exam schedule</p>
          {exams && (
            <span className="rounded-full bg-surface-variant px-2 py-0.5 text-label-sm font-bold text-ink-muted">
              {exams.length}
            </span>
          )}
        </div>

        {exams == null && !examsError ? (
          <div className="flex justify-center py-6">
            <Spinner size={26} />
          </div>
        ) : examsError ? (
          <ErrorState message={examsError} onRetry={loadExams} />
        ) : exams.length === 0 ? (
          <EmptyState
            icon="school"
            title="No exams published yet"
            message="Once the coordinator approves the final exam routine, every exam appears here."
          />
        ) : (
          <div className="mt-3 space-y-2">
            {exams.map((exam) => (
              <ExamRow
                key={exam._id ?? exam.id}
                exam={exam}
                showStatus={seesStatus && exam.status !== 'approved'}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
