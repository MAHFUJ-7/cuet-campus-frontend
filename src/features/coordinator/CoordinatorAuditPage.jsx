// Audit History — port of coordinator_audit_screen.dart.
// Scoped audit trail with action-prefix and section filters, infinite scroll.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  getCoordinatorAuditLogs,
  getCoordinatorSections,
} from '../../api/endpoints.js';
import {
  coordinatorAuditLogs,
  coordinatorSections,
} from '../../data/seedData.js';
import { isOfflineSession } from '../../lib/session.js';

const PAGE_SIZE = 50;

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'cr_', label: 'CR changes' },
  { value: 'update_', label: 'Updates' },
  { value: 'override_', label: 'Declarations' },
  { value: 'routine_', label: 'Routine' },
  { value: 'exam_', label: 'Exams' },
  { value: 'student', label: 'Students' },
  { value: 'notice', label: 'Notices' },
];

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const timeAgo = (iso) => {
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function CoordinatorAuditPage() {
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [sectionFilter, setSectionFilter] = useState(null);
  const [sectionNames, setSectionNames] = useState({});
  const [actionFilter, setActionFilter] = useState('');
  const [pageError, setPageError] = useState(null);

  const loadingMoreRef = useRef(false);
  const logsRef = useRef([]);
  logsRef.current = logs;
  // Invalidates an in-flight page when the filters change.
  const runRef = useRef(0);

  const loadSections = useCallback(async () => {
    try {
      const response = await getCoordinatorSections();
      const list = toArray(extractPayload(response));
      const map = {};
      for (const section of list) {
        map[String(section._id ?? section.id)] = String(section.label ?? section.name ?? '');
      }
      setSectionNames(map);
    } catch {
      if (isOfflineSession()) {
        const map = {};
        for (const section of coordinatorSections()) {
          map[String(section.id)] = String(section.label ?? section.name ?? '');
        }
        setSectionNames(map);
      }
      /* names are optional */
    }
  }, []);

  const fetchLogs = useCallback(
    async (reset) => {
      if (!reset && loadingMoreRef.current) return;
      const runId = reset ? runRef.current + 1 : runRef.current;
      if (reset) runRef.current = runId;
      const skip = reset ? 0 : logsRef.current.length;

      if (reset) {
        setLoading(true);
        setError(null);
        // A reset supersedes any page still loading; release its guard.
        loadingMoreRef.current = false;
        setLoadingMore(false);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      setPageError(null);

      try {
        if (isOfflineSession()) {
          let seeded = coordinatorAuditLogs();
          if (actionFilter) {
            seeded = seeded.filter((log) => String(log.action ?? '').startsWith(actionFilter));
          }
          if (sectionFilter) seeded = [];
          if (runRef.current !== runId) return;
          setLogs(reset ? seeded : [...logsRef.current, ...seeded]);
          setTotal(seeded.length);
          return;
        }

        const response = await getCoordinatorAuditLogs({
          action: actionFilter || undefined,
          sectionId: sectionFilter ?? undefined,
          limit: PAGE_SIZE,
          skip,
        });
        if (runRef.current !== runId) return; // a newer filter/page won the race
        const payload = extractPayload(response);
        const page = toArray(payload?.logs);
        setTotal(Number(payload?.total) || 0);
        setLogs(reset ? page : [...logsRef.current, ...page]);
      } catch (loadError) {
        if (runRef.current !== runId) return;
        // A failed "load more" must never wipe the events already on screen.
        if (reset) setError(describeApiError(loadError));
        else setPageError(describeApiError(loadError));
      } finally {
        if (runRef.current === runId) {
          setLoading(false);
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [actionFilter, sectionFilter]
  );

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Reload whenever a filter changes.
  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, sectionFilter]);

  const onScroll = (event) => {
    if (loading || loadingMoreRef.current || logs.length >= total) return;
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
      fetchLogs(false);
    }
  };

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title="Audit History" onBack={() => navigate(-1)} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {ACTION_FILTERS.map((filter) => (
          <button
            key={filter.value || 'all'}
            type="button"
            onClick={() => setActionFilter(filter.value)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-lg font-medium transition-colors ${
              actionFilter === filter.value
                ? 'border-primary bg-primary/10 text-primary dark:text-primary-light'
                : 'border-outline text-ink-muted hover:text-ink'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {Object.entries(sectionNames).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSectionFilter((current) => (current === id ? null : id))}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-lg font-medium transition-colors ${
              sectionFilter === id
                ? 'border-primary bg-primary/10 text-primary dark:text-primary-light'
                : 'border-outline text-ink-muted hover:text-ink'
            }`}
          >
            Sec {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <div className="mt-3">
          <ErrorState message={error} onRetry={() => fetchLogs(true)} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon="history_edu"
          title="No audit events"
          message="No audit events match these filters."
        />
      ) : (
        <div
          className="mt-3 max-h-[calc(100dvh-14rem)] space-y-1.5 overflow-y-auto pr-1"
          onScroll={onScroll}
        >
          {logs.map((log, index) => {
            const actor =
              log.userId && typeof log.userId === 'object'
                ? log.userId.name
                : log.userName ?? 'System';
            const role =
              log.userId && typeof log.userId === 'object' ? log.userId.role : null;
            const sectionId = log.sectionId != null ? String(log.sectionId) : null;
            const details = log.details;
            const detailText =
              details && typeof details === 'object'
                ? Object.entries(details)
                    .slice(0, 3)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n')
                : typeof details === 'string' && details.trim()
                  ? details
                  : null;

            return (
              <div
                key={log._id ?? log.id ?? index}
                className="rounded-xl border border-outline/60 bg-surface p-3.5"
              >
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-title-sm font-bold text-ink">
                    {String(log.action ?? '').replaceAll('_', ' ')}
                  </p>
                  <span className="shrink-0 text-label-sm text-ink-muted">
                    {timeAgo(log.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-label-sm text-ink-muted">
                  {actor}
                  {role ? ` · ${role}` : ''}
                  {sectionId && sectionNames[sectionId] ? ` · Sec ${sectionNames[sectionId]}` : ''}
                </p>
                {detailText && (
                  <pre className="mt-1.5 w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-variant/70 p-2 font-mono text-label-sm text-ink-muted">
                    {detailText}
                  </pre>
                )}
              </div>
            );
          })}

          {loadingMore && (
            <div className="flex justify-center py-3">
              <Spinner size={22} />
            </div>
          )}

          {pageError && !loadingMore && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-outline/60 bg-surface px-3.5 py-2.5">
              <p className="min-w-0 flex-1 text-label-md text-ink-muted">{pageError}</p>
              <button
                type="button"
                onClick={() => fetchLogs(false)}
                className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-label-lg font-semibold text-primary hover:bg-primary/5 dark:text-primary-light"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
