// Student Home — port of home_screen.dart.
// Sections: header → sync strip → Next Class → Today's Schedule → Upcoming →
// Attendance → Assignments → Important Updates → AI tip → Quick Access.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, FadeIn, Icon, PageShell, SkeletonBlock } from '../../components/ui/index.jsx';
import { classTypeTone, roomDisplayLabel, updateTypeTone } from '../../lib/display.js';
import { CLASS_TYPE_LABELS } from '../../lib/constants.js';
import { dayMatches, endToday, greetingFor, isoDate, startToday, timeAgoLower, todayLabel, todayName } from '../../lib/datetime.js';
import { formatSyncAge, offlineCache } from '../../lib/offlineCache.js';
import { batchNumberLabel, updateScopeLabel } from '../../lib/models.js';
import { groupRoutineEntries, periodRangeLabel } from '../../lib/routine.js';
import { applyDayDeclarations } from '../../lib/crSchedule.js';
import {
  useAttendanceSummary,
  useHomeAssignmentsDue,
  useHomeData,
  useHomeExams,
} from './useHomeData.js';

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function SectionHeader({ title, trailing = null }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <h2 className="text-label-lg font-extrabold tracking-[0.08em] text-primary">{title}</h2>
      {trailing && <span className="text-label-sm text-ink-muted">{trailing}</span>}
    </div>
  );
}

function TypeChip({ type }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${classTypeTone(type)}`}>
      {CLASS_TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function HomeHeader({ fromCache, onRefresh }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth.profile;

  const name = (profile?.name ?? '').trim();
  const firstName = name ? name.split(' ')[0] : 'there';
  const greeting = greetingFor();

  const dept = profile?.department?.code ?? 'CUET';
  const batch = batchNumberLabel(profile?.batch);
  const section = profile?.section?.name;
  const identity = [dept, batch ? `Batch ${batch}` : null, section ? `Section ${section}` : null]
    .filter(Boolean)
    .join(' • ');

  return (
    <FadeIn className="rounded-2xl bg-primary p-4 text-white shadow-md">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-label-sm font-bold tracking-[0.14em] text-white/60">CUET AI CAMPUS</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-headline-sm font-semibold">
              {greeting}, {firstName}
            </h1>
            {auth.isCR && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-[3px] text-label-sm font-extrabold tracking-wide text-white">
                <Icon name="campaign" size={11} /> CR
              </span>
            )}
          </div>
          <p className="mt-0.5 text-label-sm text-white/70">{identity}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh"
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="refresh" size={20} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/updates')}
            aria-label="Updates"
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="notifications" size={20} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-label-md font-bold text-white transition-colors hover:bg-white/30"
          >
            {firstName[0]?.toUpperCase() ?? 'U'}
          </button>
        </div>
      </div>
    </FadeIn>
  );
}

function SyncStrip({ fromCache }) {
  let icon = 'check_circle';
  let text = 'Online • synced just now';
  let tone = 'text-success bg-success/10';

  if (fromCache) {
    const age = formatSyncAge(offlineCache.lastSync);
    icon = 'cloud_off';
    text = age === 'cached data' ? 'Offline • cached data' : `Offline • synced ${age}`;
    tone = 'text-warning bg-warning/10';
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-sm ${tone}`}>
      <Icon name={icon} size={13} />
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next class hero
// ---------------------------------------------------------------------------

function NextClassHero({ nextClass, now }) {
  const navigate = useNavigate();

  if (!nextClass) {
    return (
      <Card padded={false} className="border-success/25 bg-success/5">
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
            <Icon name="celebration" size={22} />
          </span>
          <div>
            <p className="text-label-lg font-extrabold tracking-wide text-success">TODAY COMPLETE</p>
            <p className="text-body-sm text-ink-muted">No more classes today.</p>
          </div>
        </div>
      </Card>
    );
  }

  const start = startToday(nextClass.startTime, now);
  const end = endToday(nextClass.endTime, now);
  const ongoing = start && now > start && (!end || now < end);

  let stateText = 'UP NEXT';
  if (ongoing) {
    stateText = end
      ? `HAPPENING NOW • ends in ${Math.max(0, Math.round((end - now) / 60000))} min`
      : 'HAPPENING NOW';
  } else if (start) {
    stateText = `UP NEXT • starts in ${Math.max(0, Math.round((start - now) / 60000))} min`;
  }

  const code = nextClass.course?.code ?? nextClass.courseId;
  const title = nextClass.course?.title ?? '';

  return (
    <Card padded={false} onClick={() => navigate('/routine')} className="border-primary/15">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-label-sm font-bold ${
              ongoing ? 'bg-success/15 text-success' : 'bg-accent/15 text-accent'
            }`}
          >
            {stateText}
          </span>
          <Icon name="chevron_right" size={18} className="text-ink-muted" />
        </div>
        <p className="mt-2 text-headline-sm font-extrabold text-ink">{code}</p>
        {title && <p className="truncate text-body-sm text-ink-muted">{title}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Icon name="schedule" size={14} /> {nextClass.startTime}–{nextClass.endTime}
          </span>
          {nextClass.periodCount > 1 && (
            <span className="rounded-full bg-ink-muted/10 px-2 py-0.5 text-[9px] font-bold text-ink-muted">
              {periodRangeLabel(nextClass)}
            </span>
          )}
          {nextClass.room && (
            <span className="inline-flex items-center gap-1">
              <Icon name="place" size={14} /> Room {nextClass.room}
            </span>
          )}
          <TypeChip type={nextClass.classType} />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Today's schedule timeline
// ---------------------------------------------------------------------------

function ScheduleTimeline({ entries, now }) {
  if (!entries.length) {
    return (
      <Card>
        <p className="py-2 text-center text-body-sm text-ink-muted">No classes scheduled today.</p>
      </Card>
    );
  }

  const states = entries.map(() => 'past');
  let nextAssigned = false;
  entries.forEach((entry, i) => {
    if (entry.status === 'cancelled') {
      states[i] = 'cancelled';
      return;
    }
    const s = startToday(entry.startTime, now);
    const e = endToday(entry.endTime, now);
    if (s && e && now > s && now < e) {
      states[i] = 'current';
    } else if ((e && now > e) || (s && now > s)) {
      states[i] = 'past';
    } else if (!nextAssigned) {
      states[i] = 'next';
      nextAssigned = true;
    }
  });

  const railColor = (state) =>
    state === 'current'
      ? 'bg-success'
      : state === 'next'
        ? 'bg-accent'
        : state === 'cancelled'
          ? 'bg-cancellation'
          : 'bg-primary-dark/20';

  return (
    <div>
      {entries.map((entry, i) => {
        const state = states[i];
        const cancelled = entry.status === 'cancelled';
        const updated = entry.status === 'updated';
        const extra = entry.status === 'extra';
        const subdued = state === 'past' || cancelled;
        const code = entry.course?.code ?? entry.courseId;
        return (
          <div key={entry.id ?? `${code}-${i}`} className="flex gap-3">
            {/* rail */}
            <div className="flex w-4 flex-col items-center">
              <span className={`mt-3.5 h-2.5 w-2.5 rounded-full ${subdued ? 'bg-surface-variant' : railColor(state)}`} />
              {i !== entries.length - 1 && <span className="w-0.5 flex-1 bg-surface-variant" />}
            </div>
            {/* row */}
            <div className={`min-w-0 flex-1 pb-3 ${subdued ? 'opacity-55' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-title-sm font-bold text-ink ${cancelled ? 'line-through' : ''}`}>
                      {code}
                    </span>
                    <TypeChip type={entry.classType} />
                    {entry.periodCount > 1 && (
                      <span className="rounded-full bg-ink-muted/10 px-1.5 py-0.5 text-[8px] font-bold text-ink-muted">
                        {periodRangeLabel(entry)}
                      </span>
                    )}
                    {cancelled && (
                      <span className="rounded-full bg-cancellation/20 px-1.5 py-0.5 text-[8px] font-bold text-cancellation">
                        CANCELLED
                      </span>
                    )}
                    {updated && (
                      <span className="rounded-full bg-room-change/20 px-1.5 py-0.5 text-[8px] font-bold text-room-change">
                        UPDATED
                      </span>
                    )}
                    {extra && (
                      <span className="rounded-full bg-extra-class/20 px-1.5 py-0.5 text-[8px] font-bold text-extra-class">
                        EXTRA
                      </span>
                    )}
                    {state === 'current' && (
                      <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[8px] font-bold text-success">
                        CURRENT
                      </span>
                    )}
                    {state === 'next' && (
                      <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[8px] font-bold text-accent">
                        UP NEXT
                      </span>
                    )}
                  </div>
                  {entry.room && (
                    <p className="text-label-sm text-ink-muted">{roomDisplayLabel(entry.room)}</p>
                  )}
                  {updated && entry.original?.startTime && (
                    <p className="text-[10px] text-ink-muted">
                      Was {entry.original.startTime}–{entry.original.endTime}
                      {entry.original.room ? ` · ${roomDisplayLabel(entry.original.room)}` : ''}
                    </p>
                  )}
                  {entry.overrideReason && !extra && (
                    <p className="mt-0.5 text-[10px] text-ink-muted">{entry.overrideReason}</p>
                  )}
                </div>
                <p className="shrink-0 text-right text-label-sm leading-tight text-ink-muted">
                  {entry.startTime}
                  <br />
                  {entry.endTime}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayStatusBanner({ state }) {
  if (!state || state.dayStatus === 'regular') return null;
  const midBreak = state.dayStatus === 'mid_break';
  return (
    <Card className={midBreak ? 'border-violet/20 bg-violet/5' : 'border-warning/20 bg-warning/5'}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            midBreak ? 'bg-violet/15 text-violet' : 'bg-warning/15 text-warning'
          }`}
        >
          <Icon name={midBreak ? 'beach_access' : 'event_busy'} size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-title-sm font-bold text-ink">
            {midBreak ? 'Mid-break in effect' : 'Day off declared'}
          </p>
          <p className="text-label-sm text-ink-muted">
            No regular classes today.
            {state.declaration?.reason ? ` ${state.declaration.reason}` : ''}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Upcoming exam
// ---------------------------------------------------------------------------

function UpcomingExam({ exam }) {
  const navigate = useNavigate();
  const course = exam.course?.code ?? exam.courseId;
  const examDate =
    exam.examDate instanceof Date && !Number.isNaN(exam.examDate.getTime())
      ? exam.examDate
      : null;
  const dateLabel = examDate ? `${examDate.getDate()}/${examDate.getMonth() + 1}` : 'Date TBA';
  return (
    <>
      <SectionHeader title="UPCOMING" />
      <Card onClick={() => navigate('/exams')} className="border-danger/15">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <Icon name="event_available" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-title-sm font-bold text-ink">
              {course} · {exam.examType}
            </p>
            <p className="text-label-sm text-ink-muted">
              {dateLabel} • {exam.startTime}
              {exam.room ? ` • Room ${exam.room}` : ''}
            </p>
          </div>
          <Icon name="chevron_right" size={18} className="text-ink-muted" />
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Attendance summary
// ---------------------------------------------------------------------------

function AttendanceSummary() {
  const navigate = useNavigate();
  const data = useAttendanceSummary();
  if (!data || data.needsProfile || data.eligible === 0) return null;

  const pct = data.percent ?? 0;
  const tone = pct >= 85 ? 'success' : pct >= 75 ? 'warning' : 'danger';

  return (
    <>
      <SectionHeader title="ATTENDANCE" />
      <Card onClick={() => navigate('/attendance')}>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-title-sm font-extrabold ${
              tone === 'success'
                ? 'bg-success/15 text-success'
                : tone === 'warning'
                  ? 'bg-warning/15 text-warning'
                  : 'bg-danger/15 text-danger'
            }`}
          >
            {pct.toFixed(0)}%
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-semibold text-ink">My Attendance • {data.level}</p>
            <p className="text-label-sm text-ink-muted">
              {data.present} present • {data.absent} absent
            </p>
          </div>
          <Icon name="chevron_right" size={18} className="text-ink-muted" />
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Assignments summary
// ---------------------------------------------------------------------------

function AssignmentsSummary() {
  const navigate = useNavigate();
  const count = useHomeAssignmentsDue();
  if (count <= 0) return null;
  return (
    <>
      <SectionHeader title="ASSIGNMENTS" />
      <Card onClick={() => navigate('/assignments')}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <Icon name="assignment" size={18} />
          </span>
          <p className="flex-1 text-title-sm font-bold text-ink">{count} due this week</p>
          <Icon name="chevron_right" size={18} className="text-ink-muted" />
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Important updates
// ---------------------------------------------------------------------------

function ImportantUpdates({ updates }) {
  const navigate = useNavigate();
  const auth = useAuth();

  const sorted = [...updates].sort((a, b) => {
    const ap = a.priority === 'urgent' ? 0 : 1;
    const bp = b.priority === 'urgent' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return b.createdAt - a.createdAt;
  });
  const shown = sorted.slice(0, 3);

  const section = auth.profile?.section?.name ?? '';
  const sourceLabel = (update) =>
    update.scope === 'section'
      ? section
        ? `CR • Section ${section}`
        : 'SECTION UPDATE'
      : updateScopeLabel(update);

  return (
    <>
      <SectionHeader title="IMPORTANT UPDATES" trailing="Updated feed in Updates tab" />
      {shown.length === 0 ? (
        <Card>
          <p className="text-center text-body-sm text-ink-muted">You're all caught up.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {shown.map((update) => (
            <Card key={update.id} onClick={() => navigate('/updates')} className="p-3.5">
              <div className="flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${updateTypeTone(update.type)}`}>
                  {sourceLabel(update)}
                </span>
                {update.priority === 'urgent' && (
                  <span className="rounded-full bg-critical/15 px-1.5 py-0.5 text-[8px] font-extrabold text-critical">
                    IMPORTANT
                  </span>
                )}
                <span className="ml-auto text-[9px] text-ink-muted">{timeAgoLower(update.createdAt)}</span>
              </div>
              <p className="mt-1.5 truncate text-title-sm font-semibold text-ink">{update.title}</p>
              <p className="line-clamp-2 text-label-sm text-ink-muted">{update.description}</p>
            </Card>
          ))}
          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate('/updates')}
              className="rounded-lg px-3 py-1.5 text-label-lg font-medium text-primary hover:bg-primary/5"
            >
              View all updates
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// AI tip card
// ---------------------------------------------------------------------------

function AiInsightCard() {
  const navigate = useNavigate();
  return (
    <FadeIn>
      <div className="rounded-[20px] bg-gradient-to-br from-indigo-900 to-indigo-950 p-4 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-indigo-200">
            <Icon name="auto_awesome" size={16} />
          </span>
          <p className="text-title-sm font-semibold">AI Study Tip</p>
        </div>
        <p className="mt-2 text-body-md text-white/85">
          Review your notes right after class – spaced repetition in short gaps beats one long
          session before exams.
        </p>
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={() => navigate('/ai-chat')}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-lg font-medium text-white hover:bg-white/10"
          >
            Ask AI <Icon name="arrow_forward" size={16} />
          </button>
        </div>
      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Quick access
// ---------------------------------------------------------------------------

const QUICK_TILES = [
  { icon: 'calendar_month', label: 'Routine', route: '/routine', tone: 'text-accent bg-accent/10' },
  { icon: 'assignment', label: 'Assignments', route: '/assignments', tone: 'text-warning bg-warning/10' },
  { icon: 'quiz', label: 'Exams', route: '/exams', tone: 'text-danger bg-danger/10' },
  { icon: 'event_note', label: 'Calendar', route: '/calendar', tone: 'text-violet bg-violet/10' },
  { icon: 'celebration', label: 'Events', route: '/events', tone: 'text-accent bg-accent/10' },
  { icon: 'auto_awesome', label: 'AI Insights', route: '/ai-recommendations', tone: 'text-violet bg-violet/10' },
];

function QuickAccessGrid() {
  const navigate = useNavigate();
  return (
    <>
      <SectionHeader title="QUICK ACCESS" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_TILES.map((tile) => (
          <button
            key={tile.route}
            type="button"
            onClick={() => navigate(tile.route)}
            className="flex items-center gap-2 rounded-2xl border border-outline/70 bg-surface px-3 py-3.5 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tile.tone}`}>
              <Icon name={tile.icon} size={18} />
            </span>
            <span className="truncate text-body-sm font-semibold text-ink">{tile.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / error
// ---------------------------------------------------------------------------

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-28" />
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-14" />
      <SkeletonBlock className="h-14" />
      <SkeletonBlock className="h-14" />
      <SkeletonBlock className="h-16" />
    </div>
  );
}

function HomeError({ onRetry }) {
  return (
    <Card className="py-8 text-center">
      <Icon name="cloud_off" size={40} className="text-warning" />
      <p className="mt-2 text-title-sm font-bold text-ink">Unable to load your dashboard</p>
      <p className="mt-1 text-body-sm text-ink-muted">
        Check your connection to the CUET server and retry.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-label-lg font-medium text-white hover:bg-primary-light"
      >
        <Icon name="refresh" size={18} /> Retry
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const auth = useAuth();
  const { loading, error, data, refresh } = useHomeData();
  const exams = useHomeExams();
  const [now, setNow] = useState(() => new Date());

  // Re-render once a minute so "starts in N min" stays truthful.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const todayState = useMemo(() => {
    if (!data) {
      return { entries: [], dayStatus: 'regular', declaration: null };
    }
    const today = todayName(now);
    const entries = data.routine
      .filter((entry) => dayMatches(entry.day, today) && !entry.isBreak)
      .sort((a, b) => {
        const sa = startToday(a.startTime, now);
        const sb = startToday(b.startTime, now);
        if (!sa && !sb) return 0;
        if (!sa) return 1;
        if (!sb) return -1;
        return sa - sb;
      });
    return applyDayDeclarations(entries, {
      section: auth.profile?.section,
      date: isoDate(now),
    });
  }, [data, now, auth.profile?.section]);

  const todaySchedule = useMemo(
    () => groupRoutineEntries(todayState.entries),
    [todayState]
  );

  const nextClass = useMemo(() => {
    return (
      todaySchedule.find((entry) => {
        if (entry.status === 'cancelled') return false;
        const s = startToday(entry.startTime, now);
        const e = endToday(entry.endTime, now);
        if (!s) return false;
        if (e && now > s && now < e) return true;
        return s > now;
      }) ?? null
    );
  }, [todaySchedule, now]);

  const showContent = !error || data;

  return (
    <PageShell>
      <div className="mb-3">
        <HomeHeader fromCache={data?.fromCache} onRefresh={refresh} />
      </div>
      {data && (
        <div className="mb-4">
          <SyncStrip fromCache={data.fromCache} />
        </div>
      )}

      {loading && !data ? (
        <HomeSkeleton />
      ) : !showContent ? (
        <HomeError onRetry={refresh} />
      ) : (
        <div className="space-y-6">
          <NextClassHero nextClass={nextClass} now={now} />
          <DayStatusBanner state={todayState} />

          <div>
            <SectionHeader title="TODAY'S SCHEDULE" trailing={todayLabel()} />
            <ScheduleTimeline entries={todaySchedule} now={now} />
          </div>

          {exams.length > 0 && <UpcomingExam exam={exams[0]} />}
          <AttendanceSummary />
          <AssignmentsSummary />
          <ImportantUpdates updates={data?.updates ?? []} />
          <AiInsightCard />
          <QuickAccessGrid />
        </div>
      )}
    </PageShell>
  );
}
