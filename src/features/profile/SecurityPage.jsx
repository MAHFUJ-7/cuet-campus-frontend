// Security & Privacy — port of security_screen.dart (web adaptation:
// biometrics are unavailable in the browser; the app-lock preference is
// stored and enforced by the mobile app).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  ConfirmDialog,
  PageHeader,
  PageShell,
  SettingsTile,
  SwitchRow,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { KEYS, readBool, writeBool } from '../../lib/storage.js';
import { formatSyncAge, offlineCache } from '../../lib/offlineCache.js';

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-title-md font-semibold text-ink">{title}</p>
      <Card padded={false} className="divide-y divide-outline/60 overflow-hidden">
        {children}
      </Card>
    </div>
  );
}

export default function SecurityPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [appLock, setAppLock] = useState(() => readBool(KEYS.appLock, false));
  const [privacyMode, setPrivacyMode] = useState(() => readBool(KEYS.privacyMode, false));
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const toggleAppLock = (value) => {
    writeBool(KEYS.appLock, value);
    setAppLock(value);
    if (value) {
      toast.info('App lock saved — it is enforced by the mobile app.');
    }
  };

  const togglePrivacyMode = (value) => {
    writeBool(KEYS.privacyMode, value);
    setPrivacyMode(value);
  };

  const clearCache = () => {
    setConfirmClear(false);
    offlineCache.clearContentCache();
    toast.success('Cache cleared — you stay signed in');
  };

  const signOut = async () => {
    setConfirmSignOut(false);
    await auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Security & Privacy" onBack={() => navigate(-1)} />

      <Section title="Authentication">
        <SwitchRow
          icon="lock"
          title="App Lock"
          subtitle="Require authentication to open the app"
          checked={appLock}
          onChange={toggleAppLock}
        />
      </Section>

      <Section title="Privacy">
        <SwitchRow
          icon="privacy_tip"
          title="Privacy Mode"
          subtitle="Hide sensitive information in notifications"
          checked={privacyMode}
          onChange={togglePrivacyMode}
        />
        <SettingsTile
          icon="enhanced_encryption"
          title="Data Encryption"
          subtitle="All data is encrypted at rest"
          iconTone="text-success"
        />
        <SettingsTile
          icon="security"
          title="Secure Storage"
          subtitle="Session token stored on this device only"
          iconTone="text-success"
        />
      </Section>

      <Section title="Data Management">
        <SettingsTile
          icon="delete"
          title="Clear Cache"
          subtitle="Remove all cached data"
          onClick={() => setConfirmClear(true)}
          iconTone="text-warning"
        />
        <SettingsTile
          icon="logout"
          title="Sign Out"
          subtitle="Sign out from this device"
          danger
          onClick={() => setConfirmSignOut(true)}
        />
      </Section>

      <Section title="Information">
        <SettingsTile
          icon="sync"
          title="Last Data Sync"
          subtitle={formatSyncAge(offlineCache.lastSync)}
          iconTone="text-ink-muted"
        />
        <SettingsTile
          icon="info"
          title="App Version"
          subtitle="1.0.0"
          iconTone="text-ink-muted"
        />
      </Section>

      <ConfirmDialog
        open={confirmClear}
        title="Clear Cache"
        message="Are you sure you want to clear all cached data? This will not affect your account."
        confirmLabel="Clear"
        danger
        onConfirm={clearCache}
        onCancel={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        danger
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </PageShell>
  );
}
