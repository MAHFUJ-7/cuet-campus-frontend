// Coordinator Home — port of coordinator_home_screen.dart.
// Information-dense command center: greeting header, term scope chips, stat
// grid, academic health, quick actions, upcoming exams and recent activity.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  ErrorState,
  Icon,
  IconButton,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  getCoordinatorAuditLogs,
  getCoordinatorQuality,
  getCoordinatorSections,
  getCoordinatorStats,
  getExams,
} from '../../api/endpoints.js';
import {
  coordinatorAuditLogs,
  coordinatorExams,
  coordinatorQuality,
  coordinatorSections,
  coordinatorStats,
} from '../../data/seedData.js';
import { isOfflineSession } from '../../lib/session.js';
import { batchNumberLabel } from '../../lib/models.js';
import { useSelectedTerm } from './coordinatorState.js';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const compactAgo = (iso) => {
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const STAT_TONES = {
  primary: { bg: 'bg-primary/15', text: 'text-primary dark:text-primary-light' },
  'primary-light': { bg: 'bg-primary-light/15', text: 'text-primary-light' },
  success: { bg: 'bg-success/15', text: 'text-success' },
  warning: { bg: 'bg-warning/15', text: 'text-warning' },
};

export default function CoordinatorHomePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth.profile;
  const [termId, setTermId] = useSelectedTerm();

  const [sections, setSections] = useState([]);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [quality, setQuality] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sectionsRes, statsRes, logsRes, qualityRes, examsRes] = await Promise.all([
        getCoordinatorSections(),
        getCoordinatorStats(),
        getCoordinatorAuditLogs({ limit: 5 }),
        getCoordinatorQuality(),
        getExams(),
      ]);
      const sectionsPayload = toArray(extractPayload(sectionsRes));
      const statsPayload = extractPayload(statsRes);
      const logsPayload = extractPayload(logsRes);
      const qualityPayload = extractPayload(qualityRes);
      const examsPayload = toArray(extractPayload(examsRes));

      setSections(sectionsPayload);
      setStats(statsPayload && typeof statsPayload === 'object' ? statsPayload : null);
      setLogs(toArray(logsPayload?.logs));
      setQuality(
        qualityPayload?.summary && typeof qualityPayload.summary === 'object'
          ? qualityPayload.summary
          : null
      );
      setExams(examsPayload);
      setLoading(false);
    } catch (loadError) {
      if (isOfflineSession()) {
        // Offline fallback: seed data when the server is unreachable.
        setSections(coordinatorSections());
        setStats(coordinatorStats());
        setLogs(coordinatorAuditLogs());
        setQuality(coordinatorQuality().summary);
        setExams(coordinatorExams());
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

  const terms = useMemo(() => {
    const map = new Map();
    for (const section of sections) {
      const term = section?.termId;
      const id = typeof term === 'object' ? term?._id ?? term?.id : term;
      if (!id) continue;
      map.set(String(id), typeof term === 'object' ? term?.label ?? 'Term' : 'Term');
    }
    return [...map.entries()];
  }, [sections]);

  const visibleSections = useMemo(
    () =>
      termId == null
        ? sections
        : sections.filter((section) => {
            const term = section?.termId;
            const id = typeof term === 'object' ? term?._id ?? term?.id : term;
            return String(id) === String(termId);
          }),
    [sections, termId]
  );

  // A selected term can go stale (sign-out of another coordinator, scope
  // change). Reset to "All scope" instead of silently filtering everything out.
  useEffect(() => {
    if (loading || sections.length === 0 || termId == null) return;
    if (!terms.some(([id]) => id === String(termId))) {
      setTermId(null);
    }
  }, [terms, termId, loading, sections.length, setTermId]);

  const upcomingExams = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sectionIds = new Set(
      visibleSections.map((section) => String(section._id ?? section.id))
    );
    return exams
      .filter((exam) => {
        const date = new Date(exam?.examDate ?? '');
        if (Number.isNaN(date.getTime()) || date < startOfToday) return false;
        if (sectionIds.size === 0) return true;
        const sid =
          exam?.sectionId && typeof exam.sectionId === 'object'
            ? exam.sectionId._id ?? exam.sectionId.id
            : exam?.sectionId;
        return sid != null && sectionIds.has(String(sid));
      })
      .sort((a, b) => String(a.examDate ?? '').localeCompare(String(b.examDate ?? '')))
      .slice(0, 3);
  }, [exams, visibleSections]);

  const pending =
    (Number(stats?.pendingUpdates) || 0) + (Number(stats?.pendingOverrides) || 0);
  const deptCode = profile?.department?.code ?? 'CUET';
  const batchName = batchNumberLabel(profile?.batch);
  const scopeLine = batchName ? `${deptCode} \u2022 Batch ${batchName}` : deptCode;

  const statCells = [
    { label: 'Students', value: stats?.totalStudents ?? '\u2013', icon: 'groups', tone: STAT_TONES.primary },
    { label: 'Sections', value: visibleSections.length, icon: 'view_module', tone: STAT_TONES['primary-light'] },
    { label: 'Active CRs', value: stats?.totalCRs ?? '\u2013', icon: 'how_to_reg', tone: STAT_TONES.success },
    { label: 'Needs review', value: pending, icon: 'pending_actions', tone: STAT_TONES.warning, to: '/coordinator/quality' },
  ];

  const quickActions = [
    { label: 'Students', icon: 'groups_2', to: '/coordinator/students' },
    { label: 'Sections & CRs', icon: 'account_tree', to: '/coordinator/academics' },
    { label: 'Exams', icon: 'quiz', to: '/coordinator/exams' },
    { label: 'Events', icon: 'event_note', to: '/events' },
    { label: 'Notices', icon: 'campaign', to: '/coordinator/notices' },
    { label: 'Quality', icon: 'rule_folder', to: '/coordinator/quality' },
    { label: 'Audit log', icon: 'history_edu', to: '/coordinator/audit' },
    { label: 'AI assistant', icon: 'auto_awesome', to: '/coordinator/ai' },
    { label: 'Schedule AI', icon: 'auto_fix', to: '/coordinator/schedule-suggestions' },
  ];

  const issues = Number(quality?.total) || 0;
  const highIssues = Number(quality?.high) || 0;

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark px-4 pb-6 pt-5 text-white sm:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-title-lg font-semibold text-white">{greetingForNow()}</p>
            <p className="mt-0.5 text-label-md text-white/75">
              Course Coordinator • {scopeLine}
            </p>
          </div>
          <IconButton
            icon="auto_awesome"
            label="AI assistant"
            onClick={() => navigate('/coordinator/ai')}
            className="text-white hover:bg-white/15 hover:text-white"
          />
        </div>
      </div>

      <div className="-mt-3 px-4 sm:px-6">
        {loading ? (
          <div className="flex h-80 items-center justify-center">
            <Spinner size={34} />
          </div>
        ) : error ? (
          <Card className="mt-6">
            <ErrorState message={error} onRetry={load} />
          </Card>
        ) : (
          <div className="mt-3">
            {/* Term scope chips */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <button
                type="button"
                onClick={() => setTermId(null)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-lg font-medium transition-colors ${
                  termId == null
                    ? 'border-primary bg-primary/10 text-primary dark:text-primary-light'
                    : 'border-outline text-ink-muted hover:text-ink'
                }`}
              >
                All scope
              </button>
              {terms.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTermId(id)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-lg font-medium transition-colors ${
                    String(termId) === id
                      ? 'border-primary bg-primary/10 text-primary dark:text-primary-light'
                      : 'border-outline text-ink-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Stat grid */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {statCells.map((cell) => (
                <button
                  key={cell.label}
                  type="button"
                  disabled={!cell.to}
                  onClick={cell.to ? () => navigate(cell.to) : undefined}
                  className={`flex items-center gap-2.5 rounded-2xl border border-outline/60 bg-surface p-3 text-left ${
                    cell.to ? 'transition-colors hover:border-primary/50' : ''
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cell.tone.bg}`}
                  >
                    <Icon name={cell.icon} size={18} className={cell.tone.text} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-title-lg font-extrabold leading-tight text-ink">
                      {cell.value}
                    </span>
                    <span className="block truncate text-label-sm text-ink-muted">{cell.label}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Academic health */}
            <Card className="mt-4">
              <p className="text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
                ACADEMIC HEALTH
              </p>
              <div className="mt-3 flex gap-6">
                <div className="flex items-center gap-2">
                  <Icon name="verified_user" size={20} className="text-primary dark:text-primary-light" />
                  <div>
                    <p className="text-title-md font-extrabold leading-tight text-ink">
                      {quality?.scannedSections ?? visibleSections.length}
                    </p>
                    <p className="text-label-sm text-ink-muted">Scanned sections</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Icon
                    name="warning"
                    size={20}
                    className={highIssues > 0 ? 'text-critical' : 'text-success'}
                  />
                  <div>
                    <p
                      className={`text-title-md font-extrabold leading-tight ${
                        highIssues > 0 ? 'text-critical' : 'text-success'
                      }`}
                    >
                      {issues}
                    </p>
                    <p className="text-label-sm text-ink-muted">Open issues</p>
                  </div>
                </div>
              </div>
              {issues > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/coordinator/quality')}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-label-lg font-semibold text-primary transition-colors hover:bg-primary/15 dark:text-primary-light"
                >
                  <Icon name="bug_report" size={18} />
                  Open Conflict & Data Quality Center
                </button>
              )}
            </Card>

            {/* Quick actions */}
            <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
              QUICK ACTIONS
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-3 transition-colors hover:bg-surface-variant"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-primary-light">
                    <Icon name={action.icon} size={21} />
                  </span>
                  <span className="text-center text-label-sm font-medium leading-tight text-ink">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Upcoming exams */}
            <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
              UPCOMING EXAMS
            </p>
            <div className="mt-1.5 space-y-2">
              {upcomingExams.length === 0 ? (
                <p className="text-body-sm text-ink-muted">No upcoming exams in scope.</p>
              ) : (
                upcomingExams.map((exam) => {
                  const course =
                    exam?.courseId && typeof exam.courseId === 'object'
                      ? exam.courseId.code
                      : '?';
                  const section =
                    exam?.sectionId && typeof exam.sectionId === 'object'
                      ? exam.sectionId.label
                      : '';
                  return (
                    <div
                      key={exam._id ?? exam.id}
                      className="flex items-center gap-3 rounded-2xl border border-outline/60 bg-surface px-3.5 py-2.5"
                    >
                      <Icon name="event_available" size={20} className="shrink-0 text-critical" />
                      <div className="min-w-0">
                        <p className="truncate text-title-sm font-semibold text-ink">
                          {course} · {section}
                        </p>
                        <p className="truncate text-label-md text-ink-muted">
                          {String(exam.examDate ?? '').slice(0, 10)} • {exam.startTime}-
                          {exam.endTime}
                          {exam.room ? ` \u2022 ${exam.room}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Recent activity */}
            <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
              RECENT ACTIVITY
            </p>
            <div className="mt-1.5 space-y-1">
              {logs.length === 0 ? (
                <p className="text-body-sm text-ink-muted">No recent activity.</p>
              ) : (
                logs.slice(0, 5).map((log) => (
                  <div key={log._id ?? log.id ?? log.createdAt} className="flex items-center gap-3 py-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary dark:bg-primary-light" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-md text-ink">
                        {String(log.action ?? '').replaceAll('_', ' ')}
                      </p>
                      <p className="truncate text-label-sm text-ink-muted">
                        {log?.userId && typeof log.userId === 'object'
                          ? log.userId.name
                          : log?.userName ?? 'System'}
                      </p>
                    </div>
                    <span className="shrink-0 text-label-sm text-ink-muted">
                      {compactAgo(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
