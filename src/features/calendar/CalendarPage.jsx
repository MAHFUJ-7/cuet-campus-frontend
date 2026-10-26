// Academic Calendar — port of academic_calendar_screen.dart.
// Effective schedule: official routine resolved through approved overrides
// (Auto / Mid-break / cancellations / changes) plus exams.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { roomDisplayLabel } from '../../lib/display.js';
import { extractPayload } from '../../api/client.js';
import { getCalendarDay, getCalendarRange, getExams } from '../../api/endpoints.js';
import { studentRoutine } from '../../data/seedData.js';
import { dayMatches, isoDate } from '../../lib/datetime.js';
import { applyRoutineOverrides } from '../../lib/routineOverrides.js';
import { offlineCache } from '../../lib/offlineCache.js';
import {
  applyDayDeclarations,
  getDeclarationMarksForMonth,
  weekdayName,
} from '../../lib/crSchedule.js';
import { eventDateKeys, eventOccursOn } from '../../lib/eventStore.js';
import {
  declarationLabel,
  parseDaySchedule,
  parseExamEntry,
  parseRangeDay,
  parseRoutineEntry,
  scheduleDisplayTime,
  scheduleEntryInstructor,
} from '../../lib/models.js';
import { useVisibleEvents } from '../../hooks/useEvents.js';
import EventCard from '../events/EventCard.jsx';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

function monthGrid(focused) {
  const year = focused.getFullYear();
  const month = focused.getMonth();
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay()); // Sunday-first
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

function formatDmy(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * Offline day schedule built from the saved/official weekly routine. This is
 * why a CR declaration made without a backend still appears on the calendar.
 */
function localDaySchedule(profile, date) {
  const section = profile?.section ?? null;
  let weekly = offlineCache.getCachedWeeklyRoutine();
  if (!Array.isArray(weekly) || weekly.length === 0) {
    weekly = studentRoutine({ section: section?.name ?? 'A' });
  }
  const dayName = weekdayName(date);
  const classes = applyRoutineOverrides(weekly.map(parseRoutineEntry), section).filter(
    (entry) => dayMatches(entry.day, dayName) && !entry.isBreak
  );
  return {
    id: `local-${isoDate(date)}`,
    date: isoDate(date),
    day: dayName,
    sectionId: section?.id ?? '',
    dayStatus: 'regular',
    declaration: null,
    classes,
    exams: [],
  };
}

function LegendItem({ tone, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-label-sm text-ink-muted">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} /> {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Day panel pieces
// ---------------------------------------------------------------------------

function DeclarationBanner({ schedule }) {
  const isBreak = schedule.dayStatus === 'mid_break';
  const colorClasses = isBreak
    ? { text: 'text-warning', border: 'border-warning/40', gradient: 'from-warning/15 to-warning/5' }
    : { text: 'text-critical', border: 'border-critical/40', gradient: 'from-critical/15 to-critical/5' };
  const declaration = schedule.declaration;

  const rangeText = isBreak
    ? `${formatDmy(declaration?.startDate)} → ${formatDmy(declaration?.endDate)}`
    : 'Declared by your section CR';

  return (
    <div className={`mb-4 flex items-center gap-3 rounded-2xl border bg-gradient-to-br p-4 ${colorClasses.border} ${colorClasses.gradient}`}>
      <Icon
        name={isBreak ? 'beach_access' : 'event_busy'}
        size={32}
        className={colorClasses.text}
      />
      <div className="min-w-0">
        <p className={`text-title-md font-extrabold ${colorClasses.text}`}>
          {declaration ? declarationLabel(declaration) : schedule.dayStatus === 'mid_break' ? 'MID-BREAK' : 'AUTO / DAY OFF'}
        </p>
        <p className="text-body-sm text-ink">{rangeText}</p>
        {declaration?.reason && (
          <p className="text-body-sm italic text-ink-muted">{declaration.reason}</p>
        )}
      </div>
    </div>
  );
}

function ExamCard({ exam }) {
  return (
    <Card className="mb-2.5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light/15 text-primary-light">
          <Icon name="quiz" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-title-md font-bold text-ink">
            {exam.course?.code ?? 'Exam'}
          </p>
          <p className="truncate text-body-sm text-ink-muted">{exam.course?.title ?? ''}</p>
          <p className="text-body-sm text-ink-muted">
            {exam.startTime} – {exam.endTime}
            {exam.room ? ` · ${exam.room}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-light/15 px-2.5 py-1 text-label-sm font-bold text-primary-light">
          {String(exam.examType).toUpperCase()}
        </span>
      </div>
    </Card>
  );
}

function ClassCard({ entry }) {
  const cancelled = entry.status === 'cancelled';
  const accent = cancelled
    ? { text: 'text-critical', bg: 'bg-critical', chip: 'bg-critical/15 text-critical' }
    : entry.classType === 'lab'
      ? { text: 'text-lab', bg: 'bg-lab', chip: 'bg-lab/15 text-lab' }
      : { text: 'text-lecture', bg: 'bg-lecture', chip: 'bg-lecture/15 text-lecture' };

  const chipLabel = cancelled
    ? 'CANCELLED'
    : entry.status === 'extra'
      ? 'EXTRA'
      : entry.status === 'updated'
        ? 'UPDATED'
        : entry.classType === 'lab'
          ? 'LAB'
          : 'CLASS';

  const original = entry.original;

  return (
    <Card className={`mb-2.5 ${cancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 h-11 w-1 shrink-0 rounded-full ${accent.bg}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-title-md font-extrabold text-ink">
              {entry.course?.code ?? 'Break'}
            </p>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-extrabold tracking-wider ${accent.chip}`}>
              {chipLabel}
            </span>
          </div>
          {entry.course?.title && (
            <p className="truncate text-body-sm text-ink-muted">{entry.course.title}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-md text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Icon name="schedule" size={14} /> {scheduleDisplayTime(entry)}
            </span>
            {entry.room && (
              <span className="inline-flex items-center gap-1">
                <Icon name="meeting_room" size={14} /> {roomDisplayLabel(entry.room)}
              </span>
            )}
            {entry.overrideReason && (
              <span className="inline-flex items-center gap-1">
                <Icon name="notes" size={14} /> {entry.overrideReason}
              </span>
            )}
          </div>

          {entry.status === 'updated' && original && (
            <p className="mt-1 text-label-md text-ink-muted line-through">
              Original:{' '}
              {original.startTime || original.endTime
                ? `${original.startTime ?? entry.startTime}–${original.endTime ?? entry.endTime}`
                : ''}
              {original.room ? ` · ${roomDisplayLabel(original.room)}` : ''}
            </p>
          )}

          <p className="mt-1.5 flex items-center gap-1 text-label-md text-ink-muted">
            <Icon name="person" size={15} /> {scheduleEntryInstructor(entry)}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const section = auth.profile?.section ?? null;
  const events = useVisibleEvents();

  const [focused, setFocused] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [marks, setMarks] = useState({});
  const [daySchedule, setDaySchedule] = useState(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [dayFromCache, setDayFromCache] = useState(false);
  const [error, setError] = useState(null);
  const monthRun = useRef(0);
  const dayRun = useRef(0);

  const applyMark = (dateKey, mark) => {
    if (!mark) return;
    setMarks((current) => {
      const existing = new Set(current[dateKey] ?? []);
      existing.add(mark);
      return { ...current, [dateKey]: existing };
    });
  };

  const loadMonth = useCallback(async (month) => {
    const id = monthRun.current + 1;
    monthRun.current = id;
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    try {
      const response = await getCalendarRange(isoDate(from), isoDate(to));
      if (id !== monthRun.current) return; // a newer month was requested
      const payload = extractPayload(response);
      const days = toList(payload?.days).map(parseRangeDay);
      const next = {};
      for (const day of days) {
        if (day.status !== 'mid_break' && day.status !== 'auto_day_off') continue;
        const key = day.date;
        next[key] = next[key] ?? new Set();
        next[key].add(day.status === 'mid_break' ? 'midBreak' : 'autoDayOff');
      }
      setMarks(next);
    } catch {
      // Markers are decorative; the day view surfaces errors explicitly.
    }

    try {
      const examResponse = await getExams({ limit: 100 });
      if (id !== monthRun.current) return;
      const exams = toList(extractPayload(examResponse)).map(parseExamEntry);
      setMarks((current) => {
        const next = { ...current };
        for (const exam of exams) {
          const key = isoDate(exam.examDate);
          next[key] = next[key] ?? new Set();
          next[key] = new Set(next[key]).add('exam');
        }
        return next;
      });
    } catch {
      // Same decorative policy.
    }
  }, []);

  const loadDay = useCallback(async (date) => {
    const id = dayRun.current + 1;
    dayRun.current = id;
    setLoadingDay(true);
    setError(null);
    setDayFromCache(false);

    let schedule = null;
    let fromFallback = false;
    try {
      const response = await getCalendarDay(isoDate(date));
      const payload = extractPayload(response);
      schedule = payload && typeof payload === 'object' ? parseDaySchedule(payload) : null;
      if (!schedule) throw new Error('Empty calendar response');
    } catch {
      // Local-first: the saved/official routine plus CR declarations still
      // produce a complete day when the backend is unavailable.
      schedule = localDaySchedule(auth.profile, date);
      fromFallback = true;
    }

    if (id !== dayRun.current) return;
    const effective = applyDayDeclarations(
      applyRoutineOverrides(schedule.classes, section),
      {
        section,
        date: isoDate(date),
        baseDayStatus: schedule.dayStatus,
        baseDeclaration: schedule.declaration,
      }
    );
    setDaySchedule({
      ...schedule,
      dayStatus: effective.dayStatus,
      declaration: effective.declaration ?? schedule.declaration,
      classes: effective.entries,
    });
    setDayFromCache(fromFallback);
    if (effective.dayStatus !== 'regular') {
      applyMark(isoDate(date), effective.dayStatus === 'mid_break' ? 'midBreak' : 'autoDayOff');
    }
    if (id === dayRun.current) setLoadingDay(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, auth.profile]);

  useEffect(() => {
    loadMonth(focused);
    loadDay(selected);
    // Only run on mount (initial month + today).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grid = useMemo(() => monthGrid(focused), [focused]);
  const todayKey = isoDate(new Date());
  const selectedKey = isoDate(selected);

  // Local events are merged into the month markers and the day panel. They do
  // not depend on the calendar API, so they remain visible offline.
  const eventMarks = useMemo(() => {
    const next = {};
    for (const event of events) {
      for (const key of eventDateKeys(event)) {
        next[key] = next[key] ?? new Set();
        next[key].add('event');
      }
    }
    return next;
  }, [events]);

  const localMarks = useMemo(
    () => getDeclarationMarksForMonth(section, focused),
    [section, focused]
  );

  const selectedEvents = useMemo(
    () => events.filter((event) => eventOccursOn(event, selectedKey)),
    [events, selectedKey]
  );

  const marksFor = (key) => {
    const combined = new Set(marks[key] ?? []);
    for (const mark of eventMarks[key] ?? []) combined.add(mark);
    for (const mark of localMarks[key] ?? []) combined.add(mark);
    return combined;
  };

  const goToday = () => {
    const now = new Date();
    setFocused(now);
    setSelected(now);
    loadMonth(now);
    loadDay(now);
  };

  const changeMonth = (delta) => {
    const next = new Date(focused.getFullYear(), focused.getMonth() + delta, 1);
    setFocused(next);
    loadMonth(next);
  };

  const pickDay = (date) => {
    setSelected(date);
    setFocused(date);
    loadDay(date);
  };

  const monthTitle = focused.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title={
          <>
            <span className="sm:hidden">Calendar</span>
            <span className="hidden sm:inline">Academic Calendar</span>
          </>
        }
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="tonal"
              size="sm"
              icon="event_note"
              aria-label="Events"
              title="Events"
              onClick={() => navigate('/events')}
            >
              <span className="hidden sm:inline">Events</span>
            </Button>
            <IconButton icon="today" label="Today" onClick={goToday} />
          </div>
        }
      />

      {/* Month card */}
      <Card>
        <div className="mb-2 flex items-center gap-1">
          <IconButton
            icon="chevron_left"
            label="Previous month"
            onClick={() => changeMonth(-1)}
          />
          <p className="flex-1 text-center text-title-md font-bold text-ink">{monthTitle}</p>
          <IconButton
            icon="chevron_right"
            label="Next month"
            onClick={() => changeMonth(1)}
          />
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label, i) => (
            <span key={`${label}-${i}`} className="py-1 text-center text-label-sm font-bold text-ink-muted">
              {label}
            </span>
          ))}
          {grid.map(({ date, inMonth }) => {
            if (!inMonth) return <span key={date.toISOString()} />;
            const key = isoDate(date);
            const dayMarks = marksFor(key);
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickDay(date)}
                className={`relative flex h-10 flex-col items-center justify-center rounded-full text-label-lg transition-colors ${
                  isSelected
                    ? 'bg-primary font-bold text-white'
                    : isToday
                      ? 'bg-primary/15 font-bold text-primary dark:text-primary-light'
                      : 'text-ink hover:bg-surface-variant'
                }`}
              >
                {date.getDate()}
                {dayMarks && dayMarks.size > 0 && (
                  <span className="absolute bottom-0.5 flex items-center gap-0.5">
                    {dayMarks.has('midBreak') ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    ) : dayMarks.has('autoDayOff') ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-critical" />
                    ) : null}
                    {dayMarks.has('classChange') && (
                      <span className="h-1.5 w-1.5 rounded-full bg-room-change" />
                    )}
                    {dayMarks.has('exam') && <span className="h-1.5 w-1.5 rounded-full bg-primary-light" />}
                    {dayMarks.has('event') && <span className="h-1.5 w-1.5 rounded-full bg-violet" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-outline/60 pt-3">
          <LegendItem tone="bg-warning" label="Mid-break" />
          <LegendItem tone="bg-critical" label="Auto / Off" />
          <LegendItem tone="bg-room-change" label="Class change" />
          <LegendItem tone="bg-primary-light" label="Exam" />
          <LegendItem tone="bg-violet" label="Event" />
        </div>
      </Card>

      {/* Day panel */}
      <div className="mt-4">
        {selectedEvents.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-label-md font-bold tracking-wider text-violet">EVENTS</p>
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="text-label-sm font-semibold text-primary hover:underline dark:text-primary-light"
              >
                Manage events
              </button>
            </div>
            {selectedEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        )}

        {loadingDay ? (
          <div className="flex justify-center py-10">
            <Spinner size={26} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Icon name="cloud_off" size={44} className="text-ink-muted/60" />
            <p className="text-body-md text-ink-muted">{error}</p>
            <button
              type="button"
              onClick={() => loadDay(selected)}
              className="rounded-xl border border-primary px-4 py-2 text-label-lg font-semibold text-primary hover:bg-primary/5 dark:text-primary-light"
            >
              Retry
            </button>
          </div>
        ) : !daySchedule ? (
          <p className="py-8 text-center text-body-md text-ink-muted">Select a day</p>
        ) : (
          <div>
            {dayFromCache && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-label-sm text-warning">
                <Icon name="cloud_off" size={15} />
                Offline — using the saved routine. CR changes are still applied.
              </div>
            )}
            {daySchedule.dayStatus !== 'regular' && <DeclarationBanner schedule={daySchedule} />}

            {daySchedule.classes.length === 0 &&
              daySchedule.exams.length === 0 &&
              daySchedule.dayStatus !== 'regular' && (
                <p className="py-4 text-center text-body-md text-ink-muted">
                  {daySchedule.dayStatus === 'mid_break'
                    ? 'No classes during the break.'
                    : 'No regular classes today.'}
                </p>
              )}

            {daySchedule.classes.length === 0 &&
              daySchedule.exams.length === 0 &&
              daySchedule.dayStatus === 'regular' && (
                <p className="py-8 text-center text-body-md text-ink-muted">
                  No classes or exams on this day.
                </p>
              )}

            {daySchedule.exams.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-label-md font-bold tracking-wider text-primary-light">
                  EXAMS
                </p>
                {daySchedule.exams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            )}

            {daySchedule.classes.length > 0 && (
              <div>
                <p className="mb-1.5 text-label-md font-bold tracking-wider text-primary dark:text-primary-light">
                  {String(daySchedule.day).toUpperCase()} CLASSES
                  <span className="ml-1.5 font-semibold text-ink-muted">
                    · {formatDmy(daySchedule.date || selectedKey)}
                  </span>
                </p>
                {daySchedule.classes.map((entry) => (
                  <ClassCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
