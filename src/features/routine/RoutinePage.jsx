// Routine screen — port of routine_screen.dart.
// Two panes: WEEKLY GRID (SUN–THU, works fully offline) and ROUTINE PDF.
// Multi-period labs are collapsed into one card (e.g. P4–P6) to mirror the
// official PDF, and the official PDF is bundled so the PDF pane works offline.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  LoadingScreen,
  PageHeader,
  PageShell,
  SegmentedTabs,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { batchNumberLabel } from '../../lib/models.js';
import { roomDisplayLabel } from '../../lib/display.js';
import {
  dayMatches,
  formatBytes,
  formatDayMonth,
  isoDate,
  startToday,
  endToday,
  timeAgo,
} from '../../lib/datetime.js';
import { groupRoutineEntries, periodRangeLabel } from '../../lib/routine.js';
import { applyDayDeclarations, nextDateForWeekdayIndex } from '../../lib/crSchedule.js';
import { downloadRoutinePdf } from '../../api/endpoints.js';
import { useRoutinePdfInfo, useWeeklyRoutine } from './useRoutineData.js';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const OFFICIAL_PDF_URL = '/docs/cuet-cse-l3t2-routine-2022.pdf';

/** Dart weekday (Sun=7…Thu=4) → our 0..4 index; weekends have no classes. */
function todayIndex() {
  const map = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
  return map[new Date().getDay()] ?? -1;
}

/** Accent color per entry: CT → red, lab/sessional → blue accent, else primary. */
function typeAccent(type, code) {
  if (code === 'CT') return 'text-cancellation bg-cancellation/10';
  if (type === 'lab' || type === 'sessional') return 'text-accent bg-accent/10';
  return 'text-primary bg-primary/10';
}

function typeLabel(type, code) {
  if (code === 'CT') return 'CLASS TEST';
  if (type === 'lab') return 'SESSIONAL / LAB';
  if (type === 'sessional') return 'SESSIONAL';
  return 'LECTURE';
}

/** Thin divider shown between morning classes and break/lunch. */
function ScheduleBreak({ label }) {
  return (
    <div className="my-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted/70">
      <span className="h-px flex-1 bg-outline/50" />
      {label}
      <span className="h-px flex-1 bg-outline/50" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly grid pane
// ---------------------------------------------------------------------------

function WeeklyGridPane({ section }) {
  const { loading, error, entries, fromCache, refresh } = useWeeklyRoutine(section);
  const [dayIndex, setDayIndex] = useState(() => Math.max(todayIndex(), 0));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading && entries.length === 0) return <LoadingScreen label="Loading routine…" />;
  if (error && entries.length === 0) return <ErrorState message={error} onRetry={refresh} />;
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="calendar_month"
        title="No routine available"
        message="The weekly routine for your section has not been published yet."
        action={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-label-lg font-medium text-white hover:bg-primary-light"
          >
            <Icon name="refresh" size={18} /> Retry
          </button>
        }
      />
    );
  }

  const day = WEEK_DAYS[Math.min(Math.max(dayIndex, 0), WEEK_DAYS.length - 1)];
  const selectedDate = nextDateForWeekdayIndex(dayIndex, now);
  const dayEntries = entries
    .filter((entry) => dayMatches(entry.day, day))
    .sort((a, b) => (a.period ?? 0) - (b.period ?? 0));
  const effectiveDay = applyDayDeclarations(dayEntries, {
    section,
    date: isoDate(selectedDate),
  });
  const dayGroups = groupRoutineEntries(effectiveDay.entries);
  const isToday = isoDate(selectedDate) === isoDate(now);
  const cancelledCount = dayGroups.filter((group) => group.status === 'cancelled').length;
  const classCount = dayGroups.filter(
    (group) => group.course?.code !== 'CT' && group.status !== 'cancelled'
  ).length;

  return (
    <div>
      {fromCache && (
        <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-1.5 text-label-sm text-warning">
          <Icon name="offline_bolt" size={14} />
          Offline — showing your saved routine
        </div>
      )}

      {/* Day selector */}
      <div className="grid grid-cols-5 gap-1.5">
        {WEEK_DAYS.map((name, i) => {
          const selected = dayIndex === i;
          const isTodayChip = i === todayIndex();
          return (
            <button
              key={name}
              type="button"
              onClick={() => setDayIndex(i)}
              className={`flex h-11 flex-col items-center justify-center rounded-2xl text-label-md font-extrabold transition-colors ${
                selected
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary-light/20 dark:text-primary-light'
              }`}
            >
              {name.slice(0, 3).toUpperCase()}
              {isTodayChip && (
                <span className={`mt-1 h-1 w-1 rounded-full ${selected ? 'bg-white' : 'bg-primary dark:bg-primary-light'}`} />
              )}
            </button>
          );
        })}
      </div>

      {todayIndex() === -1 && (
        <p className="mt-2 text-label-sm text-ink-muted">
          It’s the weekend — no classes today. Showing Sunday.
        </p>
      )}

      {/* Day header */}
      <div className="mt-4 mb-2 flex items-center gap-2">
        <h2 className="text-title-lg font-extrabold text-ink">{day}</h2>
        <span className="text-label-md font-semibold text-ink-muted">
          {formatDayMonth(selectedDate)}
        </span>
        {isToday && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-primary dark:bg-primary-light/20 dark:text-primary-light">
            TODAY
          </span>
        )}
        <span className="ml-auto text-right text-label-sm text-ink-muted">
          {classCount} {classCount === 1 ? 'class' : 'classes'}
          {cancelledCount > 0 && ` · ${cancelledCount} cancelled`}
        </span>
      </div>

      {effectiveDay.dayStatus !== 'regular' && (
        <Card className="mb-3 border-warning/25 bg-warning/5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Icon
                name={effectiveDay.dayStatus === 'mid_break' ? 'beach_access' : 'event_busy'}
                size={19}
              />
            </span>
            <div className="min-w-0">
              <p className="text-title-sm font-bold text-ink">
                {effectiveDay.dayStatus === 'mid_break' ? 'Mid-break' : 'Day off'} ·{' '}
                {formatDayMonth(selectedDate)}
              </p>
              <p className="text-label-sm text-ink-muted">
                {effectiveDay.declaration?.reason || 'No regular classes on this date.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Period cards */}
      {dayGroups.length === 0 ? (
        <Card className="py-8 text-center">
          <Icon
            name={effectiveDay.dayStatus === 'regular' ? 'weekend' : 'event_busy'}
            size={44}
            className="mx-auto text-ink-muted"
          />
          <p className="mt-2 text-body-lg text-ink">
            {effectiveDay.dayStatus === 'regular'
              ? `${day} is free — no classes`
              : `No regular classes on ${formatDayMonth(selectedDate)}`}
          </p>
        </Card>
      ) : (
        <div>
          {dayGroups.map((entry, index) => {
            const next = dayGroups[index + 1];
            const code = entry.course?.code ?? entry.courseId;
            const cancelled = entry.status === 'cancelled';
            const updated = entry.status === 'updated';
            const extra = entry.status === 'extra';
            const start = startToday(entry.startTime, now);
            const end = endToday(entry.endTime, now);
            const isNow = Boolean(
              isToday && !cancelled && start && end && now > start && now < end
            );
            const isPast = Boolean(isToday && end && now > end);
            const accent = cancelled
              ? 'text-cancellation bg-cancellation/10'
              : typeAccent(entry.classType, code);
            const endsMorning = entry.periodEnd <= 3 && (!next || next.periodStart >= 4);
            const endsBeforeLunch = entry.periodEnd <= 6 && (!next || next.periodStart >= 7);

            return (
              <div key={entry.id ?? `${code}-${entry.periodStart}`}>
                <Card
                  padded={false}
                  className={`mb-2 overflow-hidden ${
                    isPast || cancelled ? 'opacity-60' : ''
                  } ${isNow ? 'border-primary ring-1 ring-primary/40' : ''}`}
                >
                  <div className="flex items-stretch gap-0 p-3.5">
                    {/* Time column */}
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center border-r border-outline/70 pr-2.5 text-center">
                      <span className="text-title-sm font-extrabold text-ink">{entry.startTime}</span>
                      <span className="text-label-sm text-ink-muted">↓</span>
                      <span className="text-label-sm text-ink-muted">{entry.endTime}</span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1 pl-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-title-sm font-extrabold text-ink ${cancelled ? 'line-through' : ''}`}>
                          {code}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-extrabold tracking-wider ${accent}`}>
                          {typeLabel(entry.classType, code)}
                        </span>
                        {entry.periodCount > 1 && (
                          <span className="rounded-full bg-ink-muted/10 px-2 py-0.5 text-[8px] font-bold text-ink-muted">
                            {periodRangeLabel(entry)} · {entry.periodCount} periods
                          </span>
                        )}
                        {cancelled && (
                          <span className="rounded-full bg-cancellation/15 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-cancellation">
                            CANCELLED
                          </span>
                        )}
                        {updated && (
                          <span className="rounded-full bg-room-change/15 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-room-change">
                            UPDATED
                          </span>
                        )}
                        {extra && (
                          <span className="rounded-full bg-extra-class/15 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-extra-class">
                            EXTRA
                          </span>
                        )}
                        {entry.routineOverride && (
                          <span className="rounded-full bg-info/15 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-info">
                            PERMANENT CHANGE
                          </span>
                        )}
                        {isNow && (
                          <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[8px] font-extrabold text-success">
                            NOW
                          </span>
                        )}
                      </div>
                      {entry.course && entry.course.code !== 'CT' && (
                        <p className="mt-0.5 truncate text-body-sm text-ink-muted">{entry.course.title}</p>
                      )}
                      {entry.routineOverride && entry.routineOverrideReason && (
                        <p className="mt-1 flex items-center gap-1 text-label-sm text-info">
                          <Icon name="notes" size={13} />
                          <span className="truncate">{entry.routineOverrideReason}</span>
                        </p>
                      )}
                      {entry.overrideReason && !extra && (
                        <p className="mt-1 flex items-center gap-1 text-label-sm text-ink-muted">
                          <Icon name="notes" size={13} />
                          <span className="truncate">{entry.overrideReason}</span>
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label-sm text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <Icon name="place" size={13} /> {roomDisplayLabel(entry.room) || '—'}
                        </span>
                        {entry.teacher && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Icon name="person" size={13} />
                            <span className="truncate">{entry.teacher.name}</span>
                          </span>
                        )}
                        {updated && entry.original?.startTime && (
                          <span className="text-[10px] line-through">
                            Was {entry.original.startTime}–{entry.original.endTime}
                            {entry.original.room ? ` · ${roomDisplayLabel(entry.original.room)}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                {endsMorning && <ScheduleBreak label="Break · 10:30–10:45" />}
                {endsBeforeLunch && <ScheduleBreak label="Lunch · 13:00–13:45" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Routine PDF pane
// ---------------------------------------------------------------------------

function RoutinePdfPane() {
  const { loading, error, info, refresh } = useRoutinePdfInfo();
  const toast = useToast();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  // Revoke the object URL when the component unmounts or the URL changes.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // A refresh that finds a different PDF must not keep showing the old one.
  const infoId = info?.id ?? '';
  useEffect(() => {
    setPdfUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }, [infoId]);

  const openPdf = async (target) => {
    setBusy(true);
    try {
      const blob = await downloadRoutinePdf(target.id);
      const url = URL.createObjectURL(blob);
      setPdfUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch (err) {
      toast.error(`Failed to load routine PDF: ${err?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Uploaded copy (live backend) */}
      {info && (
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-outline/70 bg-surface p-3.5 shadow-sm">
            <Icon name="picture_as_pdf" size={22} className="text-cancellation" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-title-sm font-bold text-ink">{info.title}</p>
              <p className="text-label-sm text-ink-muted">
                {formatBytes(info.size)} · Updated {timeAgo(info.createdAt)}
              </p>
            </div>
            {!pdfUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={() => openPdf(info)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 py-2 text-label-lg font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60 dark:bg-primary-light/20 dark:text-primary-light"
              >
                {busy ? <Spinner size={16} /> : <Icon name="visibility" size={17} />}
                View PDF
              </button>
            )}
          </div>
          {pdfUrl && (
            <iframe
              title="Uploaded class routine PDF"
              src={pdfUrl}
              className="mt-2 h-[60vh] w-full rounded-2xl border border-outline bg-surface"
            />
          )}
        </div>
      )}

      {error && !loading && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-label-sm text-warning">
          <Icon name="cloud_off" size={15} />
          <span className="min-w-0 flex-1">Couldn’t check for a newer upload — showing the official routine.</span>
          <button type="button" onClick={refresh} className="shrink-0 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Official PDF — always available, even offline */}
      <div className="overflow-hidden rounded-2xl border border-outline/70 bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-primary to-primary-light p-4 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Icon name="picture_as_pdf" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-title-sm font-bold">Official Class Routine</p>
            <p className="text-label-sm text-white/75">
              Level-3, Term-II · Batch 22 · Effective 06/07/2026
            </p>
          </div>
          <a
            href={OFFICIAL_PDF_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-label-lg font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
          >
            Open
            <Icon name="chevron_right" size={17} />
          </a>
        </div>
        <iframe
          title="Official class routine PDF"
          src={OFFICIAL_PDF_URL}
          className="h-[68vh] w-full bg-white"
        />
        <p className="border-t border-outline/60 px-4 py-2.5 text-label-sm text-ink-muted">
          Section A — Room 3403 · Section B — Room 3305 · Academic Building-3 (2nd Floor)
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RoutinePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [view, setView] = useState(0);
  const profile = auth.profile;
  const section = profile?.section;
  const sectionName = section?.name;
  const batchLabel = batchNumberLabel(profile?.batch);
  const subtitle = [
    profile?.department?.code,
    batchLabel ? `Batch ${batchLabel}` : null,
    sectionName ? `Section ${sectionName}` : null,
    profile?.academicSession?.name,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <PageShell>
      <PageHeader
        title="Class Routine"
        subtitle={subtitle || 'Your weekly class schedule'}
        actions={
          <Button
            variant="tonal"
            size="sm"
            icon="fact_check"
            onClick={() => navigate('/routine/conflicts')}
          >
            Conflicts
          </Button>
        }
      />

      <div className="mb-4">
        <SegmentedTabs
          tabs={[
            { value: 0, label: 'WEEKLY GRID' },
            { value: 1, label: 'ROUTINE PDF' },
          ]}
          value={view}
          onChange={setView}
          className="w-full sm:w-auto"
        />
      </div>

      {view === 0 ? <WeeklyGridPane section={section} /> : <RoutinePdfPane />}
    </PageShell>
  );
}
