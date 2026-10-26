// Time-conflict finder — available to every student and to CRs.
// Scans the effective weekly routine (including permanent CR changes) plus
// exams, and reports overlaps without modifying the schedule.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractPayload } from '../../api/client.js';
import { getExams } from '../../api/endpoints.js';
import { coordinatorExams } from '../../data/seedData.js';
import { conflictDetector } from '../../lib/conflictDetector.js';
import { parseExamEntry } from '../../lib/models.js';
import { useWeeklyRoutine } from './useRoutineData.js';

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

const TYPE_META = {
  time_overlap: {
    label: 'Time overlap',
    icon: 'schedule',
    tone: 'border-l-critical',
    text: 'text-critical',
    bg: 'bg-critical/15',
  },
  room_clash: {
    label: 'Room clash',
    icon: 'meeting_room',
    tone: 'border-l-warning',
    text: 'text-warning',
    bg: 'bg-warning/15',
  },
  teacher_conflict: {
    label: 'Teacher clash',
    icon: 'person',
    tone: 'border-l-warning',
    text: 'text-warning',
    bg: 'bg-warning/15',
  },
  exam_conflict: {
    label: 'Exam clash',
    icon: 'quiz',
    tone: 'border-l-critical',
    text: 'text-critical',
    bg: 'bg-critical/15',
  },
};

function demoExamsFor(sectionName) {
  const wanted = String(sectionName ?? '').trim().toUpperCase();
  return coordinatorExams()
    .filter((exam) => {
      if (!wanted) return true;
      const raw = exam?.sectionId?.name ?? exam?.sectionId?.label ?? '';
      return String(raw).replace(/^section\s*/i, '').trim().toUpperCase() === wanted;
    })
    .map(parseExamEntry);
}

export default function RoutineConflictsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const section = auth.profile?.section ?? null;
  const sectionName = section?.name ?? 'A';
  const { loading: routineLoading, entries, fromCache, refresh: refreshRoutine } =
    useWeeklyRoutine(section);

  const [exams, setExams] = useState([]);
  const [examLoading, setExamLoading] = useState(true);
  const [examDemo, setExamDemo] = useState(false);

  const loadExams = useCallback(async () => {
    setExamLoading(true);
    if (auth.isOfflineSession) {
      setExams(demoExamsFor(sectionName));
      setExamDemo(true);
      setExamLoading(false);
      return;
    }
    try {
      const response = await getExams({ page: 1, limit: 100 });
      const list = toList(extractPayload(response)).map(parseExamEntry);
      setExams(list);
      setExamDemo(false);
    } catch {
      // Exam feed unreachable — still offer a useful offline check.
      setExams(demoExamsFor(sectionName));
      setExamDemo(true);
    } finally {
      setExamLoading(false);
    }
  }, [auth.isOfflineSession, sectionName]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const conflicts = useMemo(
    () =>
      conflictDetector
        .detectConflicts(entries, exams)
        .map((conflict, index) => ({ ...conflict, __key: `${conflict.type}-${index}` })),
    [entries, exams]
  );

  const freeSlots = useMemo(
    () => conflictDetector.findFreeSlots(entries),
    [entries]
  );

  const refresh = () => {
    refreshRoutine();
    loadExams();
  };

  const loading = (routineLoading && entries.length === 0) || examLoading;

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Time Conflicts"
        subtitle={`${auth.isCR ? 'CR view' : 'Student view'} • Section ${sectionName}`}
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Scan again" onClick={refresh} />}
      />

      {fromCache && entries.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-2 text-label-sm text-warning">
          <Icon name="offline_bolt" size={15} />
          Offline — checking your saved routine
        </div>
      )}

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner size={30} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-primary to-primary-light p-5 text-white shadow-lg">
            <span
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-headline-sm font-extrabold ${
                conflicts.length === 0 ? 'bg-success' : 'bg-critical'
              }`}
            >
              {conflicts.length}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-title-lg font-extrabold">
                {conflicts.length === 0 ? 'No time conflicts found' : 'Conflicts detected'}
              </p>
              <p className="mt-0.5 text-body-sm text-white/80">
                {entries.length} weekly classes and {exams.length} exam
                {exams.length === 1 ? '' : 's'} checked across the teaching week.
              </p>
              <p className="mt-1 text-label-sm text-white/65">
                Time, room, teacher and exam overlaps are included.
              </p>
            </div>
          </div>

          {examDemo && !auth.isOfflineSession && (
            <p className="mt-2 text-label-sm text-ink-muted">
              Exam feed unavailable — exam conflicts use the bundled demo dates.
            </p>
          )}

          <div className="mt-4">
            {conflicts.length === 0 ? (
              <Card className="py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
                  <Icon name="check_circle" size={30} filled />
                </span>
                <p className="mt-3 text-title-md font-bold text-ink">Your schedule is clear</p>
                <p className="mt-1 text-body-md text-ink-muted">
                  No overlapping classes, room clashes, teacher clashes or exam conflicts were found.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button variant="tonal" size="sm" icon="schedule" onClick={() => navigate('/routine')}>
                    View routine
                  </Button>
                  <Button
                    variant="text"
                    size="sm"
                    icon="calendar_month"
                    onClick={() => navigate('/calendar')}
                  >
                    Open calendar
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {conflicts.map((conflict) => {
                  const meta = TYPE_META[conflict.type] ?? TYPE_META.time_overlap;
                  const suggestions =
                    conflict.day && entries.length > 0
                      ? conflictDetector
                          .suggestSlots(entries, conflict.day, conflict.courseId)
                          .slice(0, 3)
                      : [];
                  return (
                    <div
                      key={conflict.__key}
                      className={`rounded-2xl border border-l-4 border-outline/60 bg-surface p-4 shadow-sm ${meta.tone}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.text}`}
                        >
                          <Icon name={meta.icon} size={21} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[9px] font-extrabold uppercase tracking-wider ${meta.text}`}>
                              {meta.label}
                            </span>
                            {conflict.date && (
                              <span className="rounded-full bg-ink-muted/10 px-2 py-0.5 text-[9px] font-bold text-ink-muted">
                                {conflict.date}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-body-md font-semibold text-ink">
                            {conflict.description}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-md text-ink-muted">
                            <span className="inline-flex items-center gap-1">
                              <Icon name="calendar_today" size={14} /> {conflict.day}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Icon name="schedule" size={14} /> {conflict.timeSlot}
                            </span>
                          </p>

                          {suggestions.length > 0 && (
                            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-label-sm text-ink-muted">
                              <Icon name="auto_fix" size={14} className="text-primary dark:text-primary-light" />
                              Free on {conflict.day}:
                              {suggestions.map((slot) => (
                                <span
                                  key={slot}
                                  className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary dark:bg-primary-light/20 dark:text-primary-light"
                                >
                                  {slot}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button variant="outlined" size="sm" icon="schedule" onClick={() => navigate('/routine')}>
                    View routine
                  </Button>
                  {auth.isCR && (
                    <Button
                      variant="filled"
                      size="sm"
                      icon="edit"
                      onClick={() => navigate('/cr-dashboard')}
                    >
                      Fix in CR Center
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-outline/60 bg-surface-variant/50 p-4">
            <p className="flex items-center gap-1.5 text-label-lg font-bold text-ink">
              <Icon name="info" size={16} className="text-primary dark:text-primary-light" />
              What was checked
            </p>
            <p className="mt-1 text-body-sm text-ink-muted">
              Overlapping class times, two classes in the same room, one teacher in two places,
              and exams that clash with a class or another exam. The result is advisory — this
              scan never changes your routine.
            </p>
          </div>

          {Object.keys(freeSlots).length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-label-lg font-bold text-ink">Free periods this week</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(freeSlots)
                  .filter(([, periods]) => periods.length > 0)
                  .map(([day, periods]) => (
                    <div
                      key={day}
                      className="flex items-center gap-3 rounded-xl border border-outline/60 bg-surface px-3 py-2.5"
                    >
                      <span className="w-20 shrink-0 text-label-md font-bold text-ink">{day}</span>
                      <div className="flex flex-wrap gap-1">
                        {periods.map((period) => (
                          <span
                            key={period}
                            className="rounded-md bg-success/15 px-1.5 py-0.5 text-label-sm font-semibold text-success"
                          >
                            P{period}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
