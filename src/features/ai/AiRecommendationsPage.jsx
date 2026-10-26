// AI Recommendations — port of ai_recommendations_screen.dart.
// Local schedule analysis (conflicts, free slots, workload) + suggestions.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bars,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  PageShell,
  SegmentedTabs,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { studentRoutine } from '../../data/seedData.js';
import { conflictDetector } from '../../lib/conflictDetector.js';
import { applyRoutineOverrides } from '../../lib/routineOverrides.js';
import { useWeeklyRoutine } from '../routine/useRoutineData.js';

function ConflictsTab({ conflicts }) {
  const toast = useToast();

  if (conflicts.length === 0) {
    return (
      <EmptyState
        icon="check_circle"
        title="No conflicts found"
        message="Your schedule is clean!"
      />
    );
  }

  return (
    <div className="space-y-3">
      {conflicts.map((conflict, index) => {
        const tone =
          conflict.severity === 'high'
            ? { text: 'text-critical', bar: 'bg-critical', chip: 'bg-critical/15 text-critical' }
            : conflict.severity === 'medium'
              ? { text: 'text-warning', bar: 'bg-warning', chip: 'bg-warning/15 text-warning' }
              : { text: 'text-info', bar: 'bg-info', chip: 'bg-info/15 text-info' };
        const icon =
          conflict.type === 'time_overlap'
            ? 'schedule'
            : conflict.type === 'room_clash'
              ? 'meeting_room'
              : 'person';

        return (
          <Card key={`${conflict.type}-${index}`} padded={false} className="overflow-hidden">
            <div className={`border-l-4 ${tone.bar} p-4`}>
              <div className="flex items-start gap-2.5">
                <Icon name={icon} size={20} className={`mt-0.5 shrink-0 ${tone.text}`} />
                <p className="min-w-0 flex-1 text-body-md font-semibold text-ink">
                  {conflict.description}
                </p>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {conflict.involvedCourses.map((course) => (
                  <span
                    key={course}
                    className={`rounded-full px-2.5 py-1 text-label-sm font-semibold ${tone.chip}`}
                  >
                    {course}
                  </span>
                ))}
              </div>

              <p className="mt-2.5 text-body-sm text-ink-muted">
                {conflict.day} • {conflict.timeSlot}
              </p>

              <button
                type="button"
                onClick={() =>
                  toast.info(`Suggested: Reschedule ${conflict.involvedCourses.at(-1)}`)
                }
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-label-lg font-semibold text-primary hover:bg-primary/10 dark:text-primary-light"
              >
                <Icon name="auto_fix" size={16} /> AI Suggest Fix
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function FreeSlotsTab({ freeSlots }) {
  const entries = Object.entries(freeSlots);
  return (
    <div className="space-y-3">
      {entries.map(([day, slots]) => (
        <Card key={day}>
          <div className="flex items-center gap-2.5">
            <Icon name="event_available" size={20} className="text-primary dark:text-primary-light" />
            <p className="flex-1 text-title-md font-semibold text-ink">{day}</p>
            <span
              className={`rounded-full px-2.5 py-1 text-label-sm font-semibold ${
                slots.length > 3 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
              }`}
            >
              {slots.length} free
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {slots.map((period) => (
              <span
                key={period}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-label-sm font-semibold text-primary dark:bg-primary-light/20 dark:text-primary-light"
              >
                Period {period}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function WorkloadTab({ workload }) {
  const entries = Object.entries(workload);
  const maxLoad = entries.reduce((max, [, load]) => Math.max(max, load), 0);

  return (
    <div className="space-y-3">
      {entries.map(([day, load]) => {
        const ratio = maxLoad > 0 ? load / maxLoad : 0;
        const tone = ratio > 0.8 ? 'bg-critical' : ratio > 0.5 ? 'bg-warning' : 'bg-success';

        return (
          <Card key={day}>
            <div className="flex items-center justify-between">
              <p className="text-title-md font-semibold text-ink">{day}</p>
              <p className="text-body-md text-ink-muted">{load} classes</p>
            </div>
            <Bars value={ratio} max={1} tone={tone} className="mt-2.5 h-2" />
            {ratio > 0.8 && (
              <p className="mt-2.5 text-body-sm italic text-critical">
                Heavy load — consider redistribution
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function AiRecommendationsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState(0);
  const { entries, loading: routineLoading, fromCache } = useWeeklyRoutine(
    auth.profile?.section
  );

  const section = auth.profile?.section?.name ?? 'A';
  // Analyse the real routine; seeded demo data only when the server/cache is empty.
  const routine = useMemo(
    () =>
      entries.length > 0
        ? entries
        : applyRoutineOverrides(studentRoutine({ section }), auth.profile?.section),
    [entries, section, auth.profile?.section]
  );

  const analysis = useMemo(
    () => ({
      conflicts: conflictDetector.detectConflicts(routine),
      workload: conflictDetector.analyzeWorkload(routine),
      freeSlots: conflictDetector.findFreeSlots(routine),
    }),
    [routine]
  );

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title="AI Recommendations" onBack={() => navigate(-1)} />

      {(fromCache || (entries.length === 0 && !routineLoading)) && (
        <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-1.5 text-label-sm text-warning">
          <Icon name="offline_bolt" size={14} />
          {fromCache
            ? 'Offline — analysing your saved routine'
            : 'Showing the demo routine until your section routine is available'}
        </div>
      )}

      <div className="mb-4">
        <SegmentedTabs
          tabs={[
            { value: 0, label: 'Conflicts' },
            { value: 1, label: 'Free Slots' },
            { value: 2, label: 'Workload' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 0 && <ConflictsTab conflicts={analysis.conflicts} />}
      {tab === 1 && <FreeSlotsTab freeSlots={analysis.freeSlots} />}
      {tab === 2 && <WorkloadTab workload={analysis.workload} />}
    </PageShell>
  );
}
