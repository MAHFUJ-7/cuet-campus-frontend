// Profile — port of profile_screen.dart.
// Identity + academic info, account/preferences/campus/support settings.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Card,
  ConfirmDialog,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  SettingsTile,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { APP_NAME, APP_VERSION } from '../../lib/constants.js';
import { batchNumberLabel } from '../../lib/models.js';
import { forgotPassword } from '../../api/endpoints.js';

function SectionTitle({ children }) {
  return <p className="mb-2 text-title-sm font-semibold text-ink-muted">{children}</p>;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-6 py-1.5">
      <span className="shrink-0 text-body-md text-ink-muted">{label}</span>
      <span className="min-w-0 text-right text-body-md font-semibold text-ink">{value}</span>
    </div>
  );
}

function AppearanceRow() {
  const { mode, setMode } = useTheme();
  const options = [
    { value: 'light', icon: 'light_mode', label: 'Light' },
    { value: 'dark', icon: 'dark_mode', label: 'Dark' },
    { value: 'system', icon: 'settings_suggest', label: 'System' },
  ];
  const currentLabel =
    mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System default';

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light">
        <Icon name={mode === 'dark' ? 'dark_mode' : mode === 'light' ? 'light_mode' : 'settings_suggest'} size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-lg font-medium text-ink">Appearance</p>
        <p className="text-body-sm text-ink-muted">{currentLabel}</p>
      </div>
      <div className="flex rounded-xl bg-surface-variant p-0.5">
        {options.map((option) => {
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              title={option.label}
              onClick={() => setMode(option.value)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                active ? 'bg-surface text-primary shadow-sm dark:text-primary-light' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon name={option.icon} size={17} filled={active} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AboutDialog({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img src="/images/cuet_logo.png" alt="CUET" className="mx-auto h-14 w-14 object-contain" />
        <p className="mt-3 text-title-lg font-bold text-ink">{APP_NAME}</p>
        <p className="text-label-md text-ink-muted">Version {APP_VERSION}</p>
        <p className="mt-4 text-body-sm text-ink-muted">
          Academic Operating System for Chittagong University of Engineering &amp; Technology
          students.
        </p>
        <p className="mt-3 text-label-sm text-ink-muted">
          Campus photos: Wikimedia Commons (CC BY-SA 4.0). Font: Poppins (SIL OFL).
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-primary py-2.5 text-label-lg font-semibold text-white hover:bg-primary-light"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const profile = auth.profile;
  const isCR = auth.isCR;
  const isCoordinator = auth.isCoordinator;
  const isAdmin = auth.isAdmin;

  // Refresh live profile when online (offline sessions stay local).
  useEffect(() => {
    if (!auth.isOfflineSession) {
      auth.refreshProfile().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordReset = async () => {
    const email = profile?.email;
    if (!email) {
      toast.error('Login required to reset password');
      return;
    }
    try {
      await forgotPassword(email);
      toast.success(`Reset link sent to ${email}`);
    } catch {
      toast.error('Could not send reset email');
    }
  };

  const handleSignOut = async () => {
    setSignOutOpen(false);
    await auth.signOut();
    navigate('/login', { replace: true });
  };

  const name = profile?.name ?? 'Student';
  const email = profile?.email ?? '';

  return (
    <PageShell>
      <PageHeader
        title="Profile"
        actions={
          <IconButton
            icon="logout"
            label="Sign out"
            onClick={() => setSignOutOpen(true)}
          />
        }
      />

      {/* Identity header */}
      <div className="flex flex-col items-center pb-2">
        <Avatar name={name} size={96} src={profile?.photoUrl} className="ring-4 ring-primary/10" />
        <p className="mt-3 text-headline-sm font-semibold text-ink">{name}</p>
        <p className="text-body-md text-ink-muted">{email}</p>
      </div>

      {/* Academic & identity info */}
      <div className="mt-6">
        <SectionTitle>Academic Information</SectionTitle>
        <Card>
          {profile ? (
            <>
              <InfoRow label="Email" value={profile.email || 'N/A'} />
              <InfoRow label="Name" value={profile.name || 'N/A'} />
              <InfoRow label="Phone" value={profile.phone || 'Not set'} />
              <InfoRow label="Student ID" value={profile.studentId || 'N/A'} />
              <InfoRow label="Department" value={profile.department?.name ?? 'N/A'} />
              <InfoRow
                label="Batch"
                value={batchNumberLabel(profile?.batch) || 'N/A'}
              />
              <InfoRow label="Section" value={profile.section?.name ?? 'N/A'} />
              <InfoRow label="Session" value={profile.academicSession?.name ?? 'N/A'} />
              {auth.isOfflineSession && (
                <p className="mt-1.5 flex items-center gap-1.5 text-label-sm text-ink-muted">
                  <Icon name="offline_bolt" size={14} />
                  Offline session — details stored on this device
                </p>
              )}
            </>
          ) : (
            <div className="py-6 text-center text-body-md text-ink-muted">Loading profile…</div>
          )}
        </Card>
      </div>

      {/* Account */}
      <div className="mt-5">
        <SectionTitle>Account</SectionTitle>
        <Card padded={false} className="divide-y divide-outline/70 overflow-hidden">
          <SettingsTile
            icon="auto_awesome"
            title="AI Settings"
            subtitle="Gemini key or custom provider (OpenRouter…)"
            onClick={() => navigate('/ai-settings')}
          />
          <SettingsTile
            icon="edit"
            title="Edit Profile"
            subtitle="Update your name & contact details"
            onClick={() => navigate('/profile/edit')}
          />
          <SettingsTile
            icon="lock_reset"
            title="Change Password"
            subtitle="Send a password reset email"
            onClick={handlePasswordReset}
          />
          <SettingsTile
            icon="security"
            title="Security & Privacy"
            subtitle="App lock, privacy mode, data management"
            onClick={() => navigate('/security')}
          />
        </Card>
      </div>

      {/* Preferences */}
      <div className="mt-5">
        <SectionTitle>Preferences</SectionTitle>
        <Card padded={false} className="divide-y divide-outline/70 overflow-hidden">
          <SettingsTile
            icon="notifications"
            title="Notification Settings"
            subtitle="Configure push notifications"
            onClick={() => navigate('/notification-preferences')}
          />
          <AppearanceRow />
        </Card>
      </div>

      {/* Campus */}
      <div className="mt-5">
        <SectionTitle>Campus</SectionTitle>
        <Card padded={false} className="divide-y divide-outline/70 overflow-hidden">
          <SettingsTile
            icon="fact_check"
            title="My Attendance"
            subtitle="Personal class tracker & percentages"
            onClick={() => navigate('/attendance')}
          />
          <SettingsTile
            icon="map"
            title="Campus Map"
            subtitle="Explore CUET campus"
            onClick={() => navigate('/campus-map')}
          />
          <SettingsTile
            icon="calendar_month"
            title="Academic Calendar"
            subtitle="Classes, exams, auto & mid-break"
            onClick={() => navigate('/calendar')}
          />
          <SettingsTile
            icon="event_note"
            title="Events"
            subtitle="Campus, section & personal events"
            onClick={() => navigate('/events')}
          />
          <SettingsTile
            icon="call"
            title="Directory"
            subtitle="Contact faculty & staff"
            onClick={() => navigate('/directory')}
          />
          {isCR && (
            <SettingsTile
              icon="campaign"
              title="CR Center"
              subtitle="Declare day off, mid-break & class changes"
              onClick={() => navigate('/cr-dashboard')}
            />
          )}
          {(isCoordinator || isAdmin) && (
            <SettingsTile
              icon="co_present"
              title="Coordinator Dashboard"
              subtitle="Sections, ID ranges, roster & approvals"
              onClick={() => navigate('/coordinator')}
            />
          )}
          {isAdmin && (
            <SettingsTile
              icon="admin_panel_settings"
              title="Admin Panel"
              subtitle="System administration"
              onClick={() => navigate('/admin')}
            />
          )}
        </Card>
      </div>

      {/* Support */}
      <div className="mt-5">
        <SectionTitle>Support</SectionTitle>
        <Card padded={false} className="divide-y divide-outline/70 overflow-hidden">
          <SettingsTile
            icon="rate_review"
            title="Send Feedback"
            subtitle="Help us improve"
            onClick={() => navigate('/feedback')}
          />
          <SettingsTile
            icon="info"
            title="About"
            subtitle="Version, licenses & credits"
            onClick={() => setAboutOpen(true)}
          />
          {import.meta.env.DEV && (
            <SettingsTile
              icon="code"
              title="Dev Debug"
              subtitle="Network diagnostics & auth state"
              onClick={() => navigate('/dev-debug')}
            />
          )}
        </Card>
      </div>

      <button
        type="button"
        onClick={() => setSignOutOpen(true)}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-danger py-3 text-title-md font-semibold text-danger transition-colors hover:bg-danger/5"
      >
        <Icon name="logout" size={18} /> Sign Out
      </button>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        danger
        onConfirm={handleSignOut}
        onCancel={() => setSignOutOpen(false)}
      />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </PageShell>
  );
}
