// Conflict & Data-Quality Center — port of coordinator_quality_screen.dart.
// One authoritative scan of the coordinator's scope: room/instructor clashes,
// exam overlaps, missing CRs, unassigned students and ID-range conflicts.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  ErrorState,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { getCoordinatorQuality } from '../../api/endpoints.js';
import { coordinatorQuality } from '../../data/seedData.js';
import { isOfflineSession } from '../../lib/session.js';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const SEVERITY = {
  high: { text: 'text-critical', bg: 'bg-critical/15' },
  medium: { text: 'text-warning', bg: 'bg-warning/15' },
  low: { text: 'text-primary dark:text-primary-light', bg: 'bg-primary/15' },
};

function detailText(detail) {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (typeof detail !== 'object') return String(detail);
  const parts = [];
  for (const [key, value] of Object.entries(detail)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === 'object') {
          parts.push(
            Object.entries(entry)
              .map(([entryKey, entryValue]) => `${entryKey}: ${entryValue}`)
              .join(' · ')
          );
        } else {
          parts.push(String(entry));
        }
      }
    } else {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join('\n');
}

export default function CoordinatorQualityPage() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isOfflineSession()) {
      const seed = coordinatorQuality();
      setIssues(toArray(seed.issues));
      setSummary(seed.summary);
      setLoading(false);
      return;
    }
    try {
      const response = await getCoordinatorQuality();
      const payload = extractPayload(response);
      setIssues(toArray(payload?.issues));
      setSummary(
        payload?.summary && typeof payload.summary === 'object' ? payload.summary : null
      );
      setLoading(false);
    } catch (loadError) {
      if (isOfflineSession()) {
        const seed = coordinatorQuality();
        setIssues(toArray(seed.issues));
        setSummary(seed.summary);
        setLoading(false);
        return;
      }
      setError(describeApiError(loadError));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = summary?.total ?? issues.length;
  const high = Number(summary?.high) || 0;

  const stats = [
    { label: 'Issues', value: total, tone: high > 0 ? 'text-critical' : 'text-success' },
    { label: 'High', value: summary?.high ?? 0, tone: 'text-critical' },
    { label: 'Medium', value: summary?.medium ?? 0, tone: 'text-warning' },
    { label: 'Low', value: summary?.low ?? 0, tone: 'text-primary dark:text-primary-light' },
  ];

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title="Conflicts & Data Quality" onBack={() => navigate(-1)} />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : (
        <div>
          <Card>
            <div className="flex justify-around">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className={`text-headline-sm font-extrabold ${stat.tone}`}>{stat.value}</p>
                  <p className="text-label-sm text-ink-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-5">
            {issues.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center py-4 text-center">
                  <Icon name="verified" size={48} className="text-success" />
                  <p className="mt-2 text-title-md font-bold text-ink">All clear</p>
                  <p className="mt-1 text-body-sm text-ink-muted">
                    No conflicts or data-quality issues detected.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {issues.map((issue, index) => {
                  const severity = String(issue.severity ?? 'low');
                  const tone = SEVERITY[severity] ?? SEVERITY.low;
                  return (
                    <div
                      key={issue._id ?? issue.id ?? index}
                      className="flex items-start gap-3 rounded-2xl border border-outline/60 bg-surface p-3.5"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.bg}`}
                      >
                        <Icon name="priority_high" size={18} className={tone.text} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-title-sm font-bold text-ink">{issue.title}</p>
                        <p className="mt-1 whitespace-pre-line text-body-sm text-ink-muted">
                          {detailText(issue.detail)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-label-sm font-semibold ${tone.bg} ${tone.text}`}
                      >
                        {severity.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
