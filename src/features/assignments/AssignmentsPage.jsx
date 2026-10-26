// Assignments — port of assignments_screen.dart.
import { useNavigate } from 'react-router-dom';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  SkeletonBlock,
} from '../../components/ui/index.jsx';
import { extractPayload } from '../../api/client.js';
import { getAssignments } from '../../api/endpoints.js';
import { offlineCache } from '../../lib/offlineCache.js';
import { isAssignmentOverdue, parseAssignment } from '../../lib/models.js';
import { priorityTone } from '../../lib/display.js';
import { useApi } from '../../hooks/useApi.js';

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

function formatDmy(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function statusTone(assignment) {
  if (isAssignmentOverdue(assignment)) return 'bg-critical/15 text-critical';
  switch (assignment.status) {
    case 'completed':
      return 'bg-success/15 text-success';
    case 'in_progress':
      return 'bg-warning/15 text-warning';
    default:
      return 'bg-info/15 text-info';
  }
}

function CourseBadge({ code }) {
  return (
    <span className="rounded-md bg-primary/10 px-2 py-1 text-label-md font-bold text-primary dark:bg-primary-light/20 dark:text-primary-light">
      {code || 'N/A'}
    </span>
  );
}

function AssignmentCard({ assignment }) {
  const overdue = isAssignmentOverdue(assignment);
  return (
    <Card className="mb-2.5">
      <div className="flex items-center gap-2">
        <CourseBadge code={assignment.course?.code} />
        <span
          className={`ml-auto rounded-md px-2 py-1 text-label-sm font-semibold tracking-wide ${statusTone(
            assignment
          )}`}
        >
          {assignment.status.replaceAll('_', ' ').toUpperCase()}
        </span>
      </div>

      <p className="mt-2.5 text-title-md font-semibold text-ink">{assignment.title}</p>
      {assignment.description && (
        <p className="mt-1 line-clamp-2 text-body-sm text-ink-muted">{assignment.description}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 text-body-sm text-ink-muted">
          <Icon name="calendar_today" size={14} />
          <span className={overdue ? 'text-critical' : undefined}>
            Due: {formatDmy(assignment.deadline)}
          </span>
        </span>
        {overdue && <span className="text-body-sm text-critical">(Overdue)</span>}
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-label-sm font-semibold tracking-wide ${priorityTone(
            assignment.priority
          )}`}
        >
          {assignment.priority.toUpperCase()}
        </span>
      </div>
    </Card>
  );
}

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const { data, loading, error, fromCache, refresh } = useApi(getAssignments, {
    cache: {
      read: () => (offlineCache.getCachedAssignments() ?? []).map(parseAssignment),
      write: (items) => offlineCache.cacheAssignments(items),
    },
    parse: (response) => toList(extractPayload(response)).map(parseAssignment),
    initial: [],
  });

  const assignments = data ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Assignments"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={refresh} />}
      />

      {fromCache && (
        <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-1.5 text-label-sm text-warning">
          <Icon name="offline_bolt" size={14} />
          Offline — showing saved assignments
        </div>
      )}

      {loading && assignments.length === 0 ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-[120px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon="assignment"
          title="No assignments yet"
          message="Assignments will appear here when your teachers assign them."
        />
      ) : (
        <div>
          {assignments.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
