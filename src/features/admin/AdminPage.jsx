// Admin Panel — port of admin_panel_screen.dart.
// Platform-wide stats, role distribution, recent audit activity and system
// placeholders. Admin-only (guarded at the router).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Card,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  SettingsTile,
  Spinner,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { getAdminStats, getAuditLogs, getUsers } from '../../api/endpoints.js';
import { parseUserProfile, profileHasRole } from '../../lib/models.js';
import { isOfflineSession } from '../../lib/session.js';
import {
  coordinatorAuditLogs,
  coordinatorStudents,
} from '../../data/seedData.js';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

function StatCard({ title, value, icon, tone }) {
  return (
    <div className="rounded-2xl border border-outline/60 bg-surface p-3.5">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone.bg}`}>
        <Icon name={icon} size={18} className={tone.text} />
      </span>
      <p className="mt-2 text-headline-sm font-extrabold leading-tight text-ink">{value}</p>
      <p className="mt-0.5 truncate text-body-sm text-ink-muted">{title}</p>
    </div>
  );
}

function RoleRow({ label, count, icon, tone }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone.bg}`}>
        <Icon name={icon} size={20} className={tone.text} />
      </span>
      <p className="min-w-0 flex-1 text-body-lg text-ink">{label}</p>
      <p className="text-title-md font-bold text-ink">{count}</p>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const canGoBack = location.key !== 'default';

  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, auditRes, statsRes] = await Promise.all([
        // The backend pages users — ask for a large page so the role counts
        // below are the real totals, not just the first 20 users.
        getUsers({ page: 1, limit: 500 }),
        getAuditLogs({ limit: 5 }),
        getAdminStats(),
      ]);

      const usersPayload = extractPayload(usersRes);
      const auditPayload = extractPayload(auditRes);
      const statsPayload = extractPayload(statsRes);

      setUsers(
        toArray(usersPayload?.users ?? usersPayload)
          .map(parseUserProfile)
          .filter(Boolean)
      );
      setAuditLogs(toArray(auditPayload?.logs ?? auditPayload));
      setStats(statsPayload && typeof statsPayload === 'object' ? statsPayload : {});
      setLoading(false);
    } catch (loadError) {
      if (isOfflineSession()) {
        // Offline demo: derive the overview from the seeded campus data.
        const seededUsers = [
          ...coordinatorStudents().map((student) => ({
            id: student.id,
            name: student.name,
            roles: student.isCr ? ['student', 'cr'] : ['student'],
            role: student.isCr ? 'cr' : 'student',
          })),
          { id: 'coord-1', name: 'Md. Rashadur Rahman', roles: ['coordinator'], role: 'coordinator' },
          { id: 'admin-1', name: 'System Admin', roles: ['admin'], role: 'admin' },
        ];
        const crCount = seededUsers.filter((user) => profileHasRole(user, 'cr')).length;
        setUsers(seededUsers);
        setAuditLogs(coordinatorAuditLogs());
        setStats({
          totalUsers: seededUsers.length,
          activeCRs: crCount,
          totalUpdates: 3,
        });
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

  // Prefer server-provided role distribution when the API sends one; fall back
  // to counting the fetched user list.
  const roleCounts = useMemo(() => {
    const serverCounts =
      stats.roleCounts && typeof stats.roleCounts === 'object' ? stats.roleCounts : null;
    const derived = {
      students: users.filter((user) => profileHasRole(user, 'student')).length,
      crs: users.filter((user) => profileHasRole(user, 'cr')).length,
      coordinators: users.filter((user) => profileHasRole(user, 'coordinator')).length,
      admins: users.filter((user) => profileHasRole(user, 'admin')).length,
    };
    if (!serverCounts) return derived;
    const pick = (...values) => {
      for (const value of values) {
        if (value != null && !Number.isNaN(Number(value))) return Number(value);
      }
      return null;
    };
    return {
      students: pick(serverCounts.students, serverCounts.student) ?? derived.students,
      crs: pick(serverCounts.crs, serverCounts.activeCRs) ?? derived.crs,
      coordinators: pick(serverCounts.coordinators, serverCounts.coordinator) ?? derived.coordinators,
      admins: pick(serverCounts.admins, serverCounts.admin) ?? derived.admins,
    };
  }, [users, stats]);

  const systemTiles = [
    { icon: 'settings', title: 'System Settings' },
    { icon: 'backup', title: 'Database Backup' },
    { icon: 'analytics', title: 'Analytics Dashboard' },
    { icon: 'security', title: 'Security Logs' },
  ];

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Admin Panel"
        onBack={canGoBack ? () => navigate(-1) : null}
        actions={<IconButton icon="refresh" label="Refresh" onClick={load} />}
      />

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : (
        <div>
          {/* Stats overview */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard
              title="Total Users"
              value={stats.totalUsers ?? 0}
              icon="group"
              tone={{ bg: 'bg-primary/15', text: 'text-primary dark:text-primary-light' }}
            />
            <StatCard
              title="Active CRs"
              value={stats.activeCRs ?? 0}
              icon="supervisor_account"
              tone={{ bg: 'bg-success/15', text: 'text-success' }}
            />
            <StatCard
              title="Updates"
              value={stats.totalUpdates ?? 0}
              icon="update"
              tone={{ bg: 'bg-warning/15', text: 'text-warning' }}
            />
          </div>

          {/* User management */}
          <p className="mt-7 text-title-lg font-bold text-ink">User Management</p>
          <Card className="mt-2 divide-y divide-outline/50">
            <RoleRow
              label="Students"
              count={roleCounts.students}
              icon="school"
              tone={{ bg: 'bg-lecture/15', text: 'text-lecture' }}
            />
            <RoleRow
              label="Course Representatives"
              count={roleCounts.crs}
              icon="person"
              tone={{ bg: 'bg-success/15', text: 'text-success' }}
            />
            <RoleRow
              label="Coordinators"
              count={roleCounts.coordinators}
              icon="admin_panel_settings"
              tone={{ bg: 'bg-warning/15', text: 'text-warning' }}
            />
            <RoleRow
              label="Admins"
              count={roleCounts.admins}
              icon="shield"
              tone={{ bg: 'bg-critical/15', text: 'text-critical' }}
            />
          </Card>

          {/* Audit activity */}
          <p className="mt-7 text-title-lg font-bold text-ink">
            Recent Audit Activity ({auditLogs.length})
          </p>
          <div className="mt-2 space-y-2">
            {auditLogs.length === 0 ? (
              <Card>
                <p className="py-6 text-center text-body-md text-ink-muted">
                  No audit activity yet
                </p>
              </Card>
            ) : (
              auditLogs.map((log, index) => (
                <div
                  key={log._id ?? log.id ?? index}
                  className="flex items-center gap-3 rounded-2xl border border-outline/60 bg-surface px-3.5 py-3"
                >
                  <Icon name="terminal" size={20} className="shrink-0 text-primary dark:text-primary-light" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-title-sm font-semibold text-ink">
                      {String(log.action ?? '').replaceAll('_', ' ')}
                    </p>
                    <p className="truncate text-body-sm text-ink-muted">
                      {String(log.createdAt ?? '').split('T')[0]}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* System */}
          <p className="mt-7 text-title-lg font-bold text-ink">System</p>
          <Card padded={false} className="mt-2 divide-y divide-outline/50 overflow-hidden">
            {systemTiles.map((tile) => (
              <SettingsTile
                key={tile.title}
                icon={tile.icon}
                title={tile.title}
                onClick={() => toast.info('Coming soon')}
              />
            ))}
          </Card>
        </div>
      )}
    </PageShell>
  );
}
