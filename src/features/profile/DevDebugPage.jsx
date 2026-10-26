// Dev Debug — port of dev_debug_screen.dart (development diagnostics).
// Backend health check, auth state dump and the effective-schedule debugger.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Icon,
  PageHeader,
  PageShell,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { API_BASE_URL, apiOrigin } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { getCalendarDay } from '../../api/endpoints.js';
import { extractPayload } from '../../api/client.js';
import { isoDate } from '../../lib/datetime.js';

const HEALTH_URL = `${apiOrigin()}/health`;

function Section({ title, children }) {
  return (
    <Card padded={false} className="mb-4 overflow-hidden">
      <p className="border-b border-outline/60 px-4 py-3 text-title-sm font-semibold text-primary dark:text-primary-light">
        {title}
      </p>
      {children}
    </Card>
  );
}

function Row({ label, value, valueClass = 'text-ink' }) {
  return (
    <div className="flex items-start gap-2 px-4 py-1.5">
      <span className="w-[120px] shrink-0 text-body-sm text-ink-muted">{label}</span>
      <span className={`min-w-0 flex-1 break-words text-body-sm font-medium ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function statusColor(status) {
  if (status === 'CONNECTED') return 'text-success';
  if (status === 'UNREACHABLE' || status === 'TIMEOUT' || status === 'ERROR') return 'text-critical';
  return 'text-warning';
}

function ScheduleDebugger() {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [classes, setClasses] = useState([]);
  const [dayStatus, setDayStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCalendarDay(date);
      const payload = extractPayload(response);
      setDayStatus(payload?.dayStatus?.toString() ?? 'unknown');
      setClasses(Array.isArray(payload?.classes) ? payload.classes : []);
    } catch (err) {
      setError(describeApiError(err));
      setClasses([]);
      setDayStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2.5">
        <Icon name="bug_report" size={20} className="text-warning" />
        <p className="flex-1 text-title-sm font-bold text-ink">Effective Schedule Debugger</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-outline bg-surface px-3 py-2 text-body-sm text-ink focus:border-primary focus:outline-none"
        />
        <Button variant="tonal" onClick={run} disabled={loading}>
          Resolve day
        </Button>
      </div>

      {loading && (
        <p className="mt-3 text-body-sm text-ink-muted">Resolving…</p>
      )}
      {error && <p className="mt-3 text-body-sm text-critical">{error}</p>}

      {dayStatus != null && (
        <div className="mt-3">
          <p className="text-label-sm text-ink-muted">
            dayStatus: {dayStatus} · {classes.length} class(es)
          </p>
          <div className="my-2 border-t border-outline/60" />
          {classes.map((entry, index) => {
            const code =
              entry?.courseId && typeof entry.courseId === 'object'
                ? entry.courseId.code
                : '?';
            const status = entry?.status ?? 'scheduled';
            const original = entry?.original;
            return (
              <p key={index} className="py-0.5 font-mono text-label-sm text-ink">
                {code} {entry?.startTime}-{entry?.endTime} room={entry?.room}{' '}
                <span
                  className={status === 'scheduled' ? 'font-bold text-success' : 'font-bold text-critical'}
                >
                  [{status}]
                </span>
                {original && (
                  <span className="italic text-ink-muted">
                    {' '}
                    orig room={original.room} time={original.startTime}-{original.endTime}
                  </span>
                )}
              </p>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function DevDebugPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth.profile;

  const [status, setStatus] = useState('Checking...');
  const [latency, setLatency] = useState('-');
  const [httpStatus, setHttpStatus] = useState('-');
  const [healthResponse, setHealthResponse] = useState('-');
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    setStatus('Checking...');
    setLatency('-');
    setHttpStatus('-');
    setHealthResponse('-');

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const started = performance.now();

    try {
      const response = await fetch(HEALTH_URL, { signal: controller.signal });
      const body = await response.text();
      const elapsed = Math.round(performance.now() - started);
      setStatus(response.status === 200 ? 'CONNECTED' : 'ERROR');
      setHttpStatus(String(response.status));
      setLatency(`${elapsed} ms`);
      setHealthResponse(body.length > 800 ? `${body.slice(0, 800)}\u2026` : body);
    } catch (error) {
      const elapsed = Math.round(performance.now() - started);
      if (error?.name === 'AbortError') {
        setStatus('TIMEOUT');
        setHealthResponse('Connection timed out.');
      } else {
        setStatus('UNREACHABLE');
        setHealthResponse('Cannot connect to server.');
      }
      setLatency(`${elapsed} ms`);
    } finally {
      window.clearTimeout(timer);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const batchLabel = profile?.batch?.label ?? profile?.batch?.name ?? '-';
  const sectionLabel = profile?.section?.label ?? profile?.section?.name ?? '-';

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Dev Debug"
        subtitle="Development-only diagnostics"
        onBack={() => navigate(-1)}
      />

      <Section title="Backend Connection">
        <Row label="Backend URL" value={API_BASE_URL} />
        <Row label="Health URL" value={HEALTH_URL} />
        <Row label="Status" value={status} valueClass={statusColor(status)} />
        <Row label="HTTP Status" value={httpStatus} />
        <Row label="Latency" value={latency} />
      </Section>

      <Section title="Health Response">
        <p className="whitespace-pre-wrap break-words px-4 py-3 font-mono text-label-md text-ink-muted">
          {healthResponse}
        </p>
      </Section>

      <Section title="Auth State">
        <Row label="Logged In" value={auth.isLoggedIn ? 'Yes' : 'No'} />
        <Row label="Initialized" value={auth.initialized ? 'Yes' : 'No'} />
        <Row label="Session" value={auth.isOfflineSession ? 'OFFLINE (local)' : 'SERVER'} />
        <Row label="User ID" value={profile?.id || '-'} />
        <Row label="Email" value={profile?.email || '-'} />
        <Row label="Name" value={profile?.name || '-'} />
        <Row label="Phone" value={profile?.phone || '-'} />
        <Row label="Role" value={profile?.role || '-'} />
        <Row label="Roles" value={auth.roles.length ? auth.roles.join(', ') : '-'} />
        <Row label="Student ID" value={profile?.studentId || '-'} />
        <Row label="Department" value={profile?.department?.name || '-'} />
        <Row label="Batch" value={batchLabel} />
        <Row label="Section" value={sectionLabel} />
        <Row label="Permissions" value={`${auth.permissions.length} granted`} />
      </Section>

      <Section title="Environment">
        <Row label="Mode" value={import.meta.env.DEV ? 'DEBUG' : 'RELEASE'} />
        <Row label="Platform" value="web" />
        <Row label="Firebase" value="Not Available" />
      </Section>

      <ScheduleDebugger />

      <Button variant="filled" className="w-full" onClick={checkHealth} disabled={checking}>
        <Icon name="wifi_find" size={18} className="mr-1.5" />
        Re-check Connection
      </Button>
    </PageShell>
  );
}
