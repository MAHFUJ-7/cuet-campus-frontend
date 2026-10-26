// Exam schedule — port of exam_schedule_screen.dart.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  SegmentedTabs,
  SkeletonBlock,
} from '../../components/ui/index.jsx';
import { extractPayload } from '../../api/client.js';
import { getExams } from '../../api/endpoints.js';
import { examDaysUntil, parseExamEntry } from '../../lib/models.js';
import { useApi } from '../../hooks/useApi.js';

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'midterm', label: 'MIDTERM' },
  { value: 'final', label: 'FINAL' },
  { value: 'quiz', label: 'QUIZ' },
  { value: 'makeup', label: 'MAKEUP' },
];

const TYPE_TONES = {
  midterm: 'bg-warning/15 text-warning',
  final: 'bg-critical/15 text-critical',
  quiz: 'bg-info/15 text-info',
  lab: 'bg-lab/15 text-lab',
};

const typeTone = (type) => TYPE_TONES[String(type).toLowerCase()] ?? 'bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light';

function formatDmy(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function Meta({ icon, text }) {
  return (
    <span className="inline-flex items-center gap-1 text-body-sm text-ink-muted">
      <Icon name={icon} size={14} /> {text}
    </span>
  );
}

function ExamCard({ exam }) {
  const daysLeft = examDaysUntil(exam);
  const upcoming = daysLeft >= 0;

  return (
    <Card className="mb-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary/10 px-2 py-1 text-label-md font-bold text-primary dark:bg-primary-light/20 dark:text-primary-light">
          {exam.course?.code || 'N/A'}
        </span>
        <span className={`rounded-md px-2 py-1 text-label-sm font-semibold tracking-wide ${typeTone(exam.examType)}`}>
          {String(exam.examType).toUpperCase()}
        </span>
        {upcoming && (
          <span
            className={`ml-auto rounded-md px-2 py-1 text-label-sm font-semibold ${
              daysLeft <= 3 ? 'bg-critical/15 text-critical' : 'bg-success/15 text-success'
            }`}
          >
            {daysLeft <= 0 ? 'Today!' : `${daysLeft}d left`}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-title-md font-semibold text-ink">
        {exam.course?.title && exam.course.title !== 'Unknown' ? exam.course.title : 'Unknown Course'}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Meta icon="calendar_today" text={formatDmy(exam.examDate)} />
        <Meta icon="schedule" text={`${exam.startTime} - ${exam.endTime}`} />
        {exam.room && <Meta icon="meeting_room" text={`Room ${exam.room}`} />}
        {exam.venue && <Meta icon="place" text={exam.venue} />}
      </div>
    </Card>
  );
}

export default function ExamsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState('all');

  const { data, loading, error, refresh } = useApi(getExams, {
    parse: (response) => toList(extractPayload(response)).map(parseExamEntry),
    initial: [],
  });

  const exams = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOf = (exam) =>
      new Date(exam.examDate.getFullYear(), exam.examDate.getMonth(), exam.examDate.getDate());

    let list;
    if (tab === 0) {
      list = exams
        .filter((e) => dayOf(e) >= todayStart)
        .sort((a, b) => a.examDate - b.examDate);
    } else if (tab === 1) {
      list = exams.filter((e) => dayOf(e) < todayStart).sort((a, b) => b.examDate - a.examDate);
    } else {
      list = [...exams].sort((a, b) => a.examDate - b.examDate);
    }

    if (filter !== 'all') {
      list = list.filter((e) => String(e.examType).toLowerCase() === filter);
    }
    return list;
  }, [exams, tab, filter]);

  return (
    <PageShell>
      <PageHeader
        title="Exam Schedule"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={refresh} />}
      />

      <div className="mb-3">
        <SegmentedTabs
          tabs={[
            { value: 0, label: 'Upcoming' },
            { value: 1, label: 'Past' },
            { value: 2, label: 'All' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Type filters */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((option) => {
          const selected = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-md font-semibold transition-colors ${
                selected
                  ? 'border-primary bg-primary text-white'
                  : 'border-outline bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {loading && exams.length === 0 ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-[110px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="quiz"
          title="No exams found"
          message={
            filter === 'all'
              ? 'Your exam schedule will appear here once published.'
              : `No ${filter.toUpperCase()} exams scheduled.`
          }
        />
      ) : (
        <div>
          {filtered.map((exam) => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
