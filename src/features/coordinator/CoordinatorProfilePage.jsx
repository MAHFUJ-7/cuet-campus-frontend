// Coordinator Profile tab — port of coordinator_profile_tab.dart.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Card,
  ConfirmDialog,
  Icon,
  PageHeader,
  PageShell,
  SettingsTile,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { batchNumberLabel, roleLabel } from '../../lib/models.js';

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-body-md text-ink-muted">{label}</span>
      <span className="text-right text-body-md font-semibold text-ink">{value}</span>
    </div>
  );
}

export default function CoordinatorProfilePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth.profile;
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const signOut = async () => {
    setConfirmSignOut(false);
    await auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Coordinator Profile" />

      <Card className="rounded-3xl">
        <div className="flex items-center gap-4">
          <Avatar name={profile?.name ?? 'C'} size={60} src={profile?.photoUrl} />
          <div className="min-w-0">
            <p className="truncate text-title-lg font-bold text-ink">
              {profile?.name ?? 'Coordinator'}
            </p>
            <p className="truncate text-body-sm text-ink-muted">{profile?.email ?? ''}</p>
          </div>
        </div>

        <div className="my-3 h-px bg-outline/60" />

        <InfoRow label="Role" value={profile ? roleLabel(profile) : 'coordinator'} />
        <InfoRow label="Department" value={profile?.department?.name ?? '-'} />
        <InfoRow
          label="Batch"
          value={batchNumberLabel(profile?.batch) || '-'}
        />
        <InfoRow label="Session" value={profile?.academicSession?.name ?? '-'} />

        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-primary/8 p-2.5">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-primary dark:text-primary-light" />
          <p className="text-label-sm text-primary dark:text-primary-light">
            Authorization scope is controlled by the backend and cannot be changed here.
          </p>
        </div>
      </Card>

      <Card padded={false} className="mt-4 divide-y divide-outline/60 overflow-hidden">
        {import.meta.env.DEV && (
          <SettingsTile
            icon="code"
            title="Dev Debug"
            subtitle="Network diagnostics & auth state"
            onClick={() => navigate('/dev-debug')}
          />
        )}
        <SettingsTile
          icon="history_edu"
          title="Audit history"
          subtitle="Everything done in your scope"
          onClick={() => navigate('/coordinator/audit')}
        />
        <SettingsTile
          icon="auto_awesome"
          title="AI Settings"
          subtitle="Personal API key, provider & model"
          onClick={() => navigate('/ai-settings')}
        />
        <SettingsTile
          icon="notifications"
          title="Notification settings"
          subtitle="Reminders, quiet hours & topics"
          onClick={() => navigate('/notification-preferences')}
        />
      </Card>

      <button
        type="button"
        onClick={() => setConfirmSignOut(true)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-danger px-4 py-3 text-label-lg font-semibold text-danger transition-colors hover:bg-danger/5"
      >
        <Icon name="logout" size={18} />
        Sign Out
      </button>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out"
        message="Sign out of CUET AI Campus?"
        confirmLabel="Sign out"
        danger
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </PageShell>
  );
}
