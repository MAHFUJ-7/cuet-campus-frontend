// Schedule Suggestions — port of schedule_suggestion_screen.dart.
// Local conflict detection, workload distribution and free-slot analysis over
// the demo routine. Entirely offline; nothing leaves the device.
import { useCallback, useEffect, useState } from 'react';
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
import { useToast } from '../../context/ToastContext.jsx';
import { studentRoutine } from '../../data/seedData.js';
import { conflictDetector } from '../../lib/conflictDetector.js';

const SEVERITY_TONE = {
  high: { border: 'border-l-critical', text: 'text-critical', bg: 'bg-critical/15' },
  medium: { border: 'border-l-warning', text: 'text-warning', bg: 'bg-warning/15' },
  low: { border: 'border-l-info', text: 'text-info', bg: 'bg-info/15' },
};

const TYPE_ICON = {
  time_overlap: 'schedule',
  room_clash: 'meeting_room',
  teacher_conflict: 'person',
};

function SectionHeader({ title, subtitle, icon, tone }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.bg}`}>
        <Icon name={icon} size={20} className={tone.text} />
      </span>
      <div className="min-w-0">
        <p className="text-title-md font-bold text-ink">{title}</p>
        <p className="truncate text-body-sm text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

export default function ScheduleSuggestionsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [conflicts, setConflicts] = useState([]);
  const [workload, setWorkload] = useState({});
  const [freeSlots, setFreeSlots] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suggestedKey, setSuggestedKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const section = auth.profile?.section?.name ?? 'A';
      const routine = studentRoutine({ section });
      setConflicts(
        conflictDetector
          .detectConflicts(routine)
          .map((conflict, index) => ({ ...conflict, __key: `${conflict.type}-${index}` }))
      );
      setWorkload(conflictDetector.analyzeWorkload(routine));
      setFreeSlots(conflictDetector.findFreeSlots(routine));
      setSuggestedKey(null);
      setLoading(false);
    } catch (loadError) {
      setError(String(loadError?.message ?? loadError));
      setLoading(false);
    }
  }, [auth.profile?.section?.name]);

  useEffect(() => {
    load();
  }, [load]);

  const workloadEntries = Object.entries(workload);
  const average =
    workloadEntries.length > 0
      ? (
          workloadEntries.reduce((sum, [, value]) => sum + value, 0) /
          workloadEntries.length
        ).toFixed(1)
      : '0';
  const maxLoad = workloadEntries.reduce(
    (max, [, value]) => (value > max ? value : max),
    0
  );

  const conflictTone = (count) =>
    count === 0
      ? 'bg-success'
      : count < 3
        ? 'bg-warning'
        : 'bg-critical';

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Schedule Suggestions"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={load} />}
      />

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Icon name="error" size={56} className="text-critical" />
          <p className="text-title-md font-semibold text-ink">Failed to load data</p>
          <p className="max-w-md text-body-md text-ink-muted">{error}</p>
          <Button variant="filled" icon="refresh" onClick={load}>
            Retry
          </Button>
        </div>
      ) : (
        <div>
          {/* Summary */}
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#1565C0] to-[#0D47A1] p-5 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-title-lg font-bold">Schedule Health</p>
              <p className="mt-0.5 text-body-md text-white/80">
                Average {average} classes/day
              </p>
            </div>
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-headline-sm font-extrabold text-white ${conflictTone(
                conflicts.length
              )}`}
            >
              {conflicts.length}
            </span>
          </div>

          {/* Conflicts */}
          <div className="mt-5">
            {conflicts.length > 0 ? (
              <SectionHeader
                title="Detected Conflicts"
                subtitle={`${conflicts.length} issue(s) found`}
                icon="warning"
                tone={{ bg: 'bg-warning/15', text: 'text-warning' }}
              />
            ) : (
              <SectionHeader
                title="Detected Conflicts"
                subtitle="No conflicts found"
                icon="check_circle"
                tone={{ bg: 'bg-success/15', text: 'text-success' }}
              />
            )}

            <div className="mt-2 space-y-2">
              {conflicts.map((conflict) => {
                const tone = SEVERITY_TONE[conflict.severity] ?? SEVERITY_TONE.low;
                const open = suggestedKey === conflict.__key;
                const suggestion = `Reschedule ${
                  conflict.involvedCourses?.at(-1) ?? 'the class'
                } to a free slot`;
                return (
                  <div
                    key={conflict.__key}
                    className={`rounded-2xl border border-l-4 border-outline/60 bg-surface p-3.5 ${tone.border}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon
                        name={TYPE_ICON[conflict.type] ?? 'person'}
                        size={20}
                        className={`mt-0.5 shrink-0 ${tone.text}`}
                      />
                      <p className="min-w-0 flex-1 text-body-md font-semibold text-ink">
                        {conflict.description}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 pl-[30px]">
                      <p className="truncate text-body-sm text-ink-muted">
                        {conflict.day} • {conflict.timeSlot}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSuggestedKey(open ? null : conflict.__key)}
                        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-label-lg font-semibold text-primary hover:bg-primary/5 dark:text-primary-light"
                      >
                        <Icon name="auto_fix" size={16} />
                        AI Suggest
                      </button>
                    </div>

                    {open && (
                      <div className="mt-2.5 rounded-xl bg-primary/8 p-3">
                        <p className="text-body-sm text-ink">
                          AI suggestion: {suggestion}
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => setSuggestedKey(null)}
                          >
                            Dismiss
                          </Button>
                          <Button
                            variant="filled"
                            size="sm"
                            icon="check"
                            onClick={() => {
                              setConflicts((current) =>
                                current.filter((item) => item.__key !== conflict.__key)
                              );
                              setSuggestedKey(null);
                              toast.success('Conflict resolved');
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workload */}
          <div className="mt-5">
            <SectionHeader
              title="Weekly Workload"
              subtitle="Class distribution across the week"
              icon="bar_chart"
              tone={{ bg: 'bg-primary/15', text: 'text-primary dark:text-primary-light' }}
            />
            <Card className="mt-2">
              {workloadEntries.map(([day, count]) => {
                const ratio = maxLoad > 0 ? count / maxLoad : 0;
                const barTone =
                  ratio > 0.8 ? 'bg-critical' : ratio > 0.5 ? 'bg-warning' : 'bg-success';
                return (
                  <div key={day} className="flex items-center gap-2 py-1">
                    <span className="w-20 shrink-0 text-body-sm text-ink">{day}</span>
                    <div className="h-3 min-w-0 flex-1 overflow-hidden rounded bg-surface-variant">
                      <div
                        className={`h-full rounded ${barTone}`}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                    <span className="w-7 shrink-0 text-right text-body-sm font-semibold text-ink">
                      {count}
                    </span>
                  </div>
                );
              })}
            </Card>
          </div>

          {/* Free slots */}
          <div className="mt-5">
            <SectionHeader
              title="Available Slots"
              subtitle="Optimal periods for new classes"
              icon="event_available"
              tone={{ bg: 'bg-success/15', text: 'text-success' }}
            />
            <Card className="mt-2 space-y-3">
              {Object.entries(freeSlots).map(([day, slots]) => {
                const abundant = slots.length > 3;
                return (
                  <div key={day}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-title-sm text-ink">{day}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-label-sm font-semibold ${
                          abundant
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning'
                        }`}
                      >
                        {slots.length} free
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {slots.map((period) => (
                        <span
                          key={period}
                          className="rounded-full bg-primary/10 px-2.5 py-1 text-label-sm font-medium text-primary dark:text-primary-light"
                        >
                          P{period}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
