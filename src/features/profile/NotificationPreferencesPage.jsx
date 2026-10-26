// Notification Settings — port of notification_preferences_screen.dart.
// Preferences are stored locally (same keys as Flutter). The web ReminderHost
// consumes them to deliver in-app and browser reminders while the app is open.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Icon,
  PageHeader,
  PageShell,
  SettingsTile,
  SwitchRow,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  KEYS,
  readBool,
  readInt,
  readJson,
  readString,
  writeBool,
  writeInt,
  writeJson,
  writeString,
} from '../../lib/storage.js';

const LEAD_OPTIONS = [5, 10, 15, 30];

function browserPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

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

export default function NotificationPreferencesPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [pushEnabled, setPushEnabled] = useState(() => readBool(KEYS.pushEnabled, true));
  const [routineReminders, setRoutineReminders] = useState(() => readBool(KEYS.routineReminders, true));
  const [assignmentReminders, setAssignmentReminders] = useState(() =>
    readBool(KEYS.assignmentReminders, true)
  );
  const [examReminders, setExamReminders] = useState(() => readBool(KEYS.examReminders, true));
  const [updateNotifications, setUpdateNotifications] = useState(() =>
    readBool(KEYS.updateNotifications, true)
  );
  const [aiInsights, setAiInsights] = useState(() => readBool(KEYS.aiInsights, false));
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(() =>
    readBool(KEYS.quietHoursEnabled, false)
  );
  const [quietStart, setQuietStart] = useState(() => readString(KEYS.quietStart, '22:00'));
  const [quietEnd, setQuietEnd] = useState(() => readString(KEYS.quietEnd, '07:00'));
  const [leadMinutes, setLeadMinutes] = useState(() => readInt(KEYS.reminderLeadMinutes, 10));
  const [permission, setPermission] = useState(browserPermission);
  const [subscribedTopics, setSubscribedTopics] = useState(() => {
    const stored = readJson(KEYS.pushTopics, []) ?? [];
    return Array.isArray(stored) ? stored.map(String) : [];
  });

  const profile = auth.profile;

  const toggle = (key, value, setter) => {
    writeBool(key, value);
    setter(value);
  };

  const askBrowserPermission = async () => {
    if (typeof Notification === 'undefined') {
      toast.warning('This browser does not support system notifications');
      return false;
    }
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }
    if (Notification.permission === 'denied') {
      toast.warning('Notifications are blocked in your browser settings');
      setPermission('denied');
      return false;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') toast.success('Browser notifications enabled');
      else toast.info('In-app reminders will still appear');
      return result === 'granted';
    } catch {
      toast.info('In-app reminders will still appear');
      return false;
    }
  };

  const togglePush = async (next) => {
    if (next && permission !== 'granted') {
      await askBrowserPermission();
    }
    toggle(KEYS.pushEnabled, next, setPushEnabled);
  };

  const updateLeadMinutes = (value) => {
    const next = Number(value);
    setLeadMinutes(next);
    writeInt(KEYS.reminderLeadMinutes, next);
  };

  const sendTestReminder = () => {
    window.dispatchEvent(new CustomEvent('cuet:test-reminder'));
    toast.success('Test reminder sent');
  };

  const toggleTopic = (label, channelId) => {
    setSubscribedTopics((current) => {
      const next = current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [...current, channelId];
      writeJson(KEYS.pushTopics, next);
      toast.success(
        next.includes(channelId) ? `Subscribed to ${label}` : `Unsubscribed from ${label}`
      );
      return next;
    });
  };

  const topicRow = (label, channelId) => {
    const subscribed = subscribedTopics.includes(channelId);
    return (
      <SettingsTile
        key={channelId}
        icon={subscribed ? 'notifications_active' : 'topic'}
        title={label}
        subtitle={channelId}
        iconTone="text-ink-muted"
        trailing={
          <button
            type="button"
            onClick={() => toggleTopic(label, channelId)}
            aria-pressed={subscribed}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-label-lg font-semibold transition-colors ${
              subscribed
                ? 'border-success/50 bg-success/10 text-success'
                : 'border-primary text-primary hover:bg-primary/5 dark:text-primary-light'
            }`}
          >
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        }
      />
    );
  };

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Notification Settings" onBack={() => navigate(-1)} />

      <Section title="Reminders">
        <SwitchRow
          icon="notifications"
          title="Enable Personalized Reminders"
          subtitle="In-app alerts and browser notifications while the app is open"
          checked={pushEnabled}
          onChange={togglePush}
        />
        {pushEnabled && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                permission === 'granted'
                  ? 'bg-success/10 text-success'
                  : permission === 'denied'
                    ? 'bg-danger/10 text-danger'
                    : 'bg-warning/10 text-warning'
              }`}
            >
              <Icon
                name={
                  permission === 'granted'
                    ? 'notifications_active'
                    : permission === 'denied'
                      ? 'do_not_disturb_on'
                      : 'notifications'
                }
                size={19}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-lg font-medium text-ink">Browser notifications</p>
              <p className="text-body-sm text-ink-muted">
                {permission === 'granted'
                  ? 'Allowed — system notifications will appear while the app is open.'
                  : permission === 'denied'
                    ? 'Blocked in browser settings. In-app reminders still work.'
                    : permission === 'unsupported'
                      ? 'Not supported by this browser. In-app reminders still work.'
                      : 'Not enabled yet. Allow notifications for system alerts.'}
              </p>
            </div>
            {permission === 'default' && (
              <Button size="sm" variant="tonal" onClick={askBrowserPermission}>
                Allow
              </Button>
            )}
          </div>
        )}
      </Section>

      <Section title="Notification Types">
        <SwitchRow
          icon="schedule"
          title="Routine Reminders"
          subtitle="Get notified before classes start"
          checked={routineReminders}
          onChange={(v) => toggle(KEYS.routineReminders, v, setRoutineReminders)}
        />
        <SwitchRow
          icon="assignment"
          title="Assignment Reminders"
          subtitle="Get notified about assignment deadlines"
          checked={assignmentReminders}
          onChange={(v) => toggle(KEYS.assignmentReminders, v, setAssignmentReminders)}
        />
        <SwitchRow
          icon="quiz"
          title="Exam Reminders"
          subtitle="Get notified about upcoming exams"
          checked={examReminders}
          onChange={(v) => toggle(KEYS.examReminders, v, setExamReminders)}
        />
        <SwitchRow
          icon="campaign"
          title="Campus Updates"
          subtitle="Get notified about announcements and changes"
          checked={updateNotifications}
          onChange={(v) => toggle(KEYS.updateNotifications, v, setUpdateNotifications)}
        />
        <SwitchRow
          icon="auto_awesome"
          title="AI Study Tips"
          subtitle="Get personalized study recommendations"
          checked={aiInsights}
          onChange={(v) => toggle(KEYS.aiInsights, v, setAiInsights)}
        />
      </Section>

      <Section title="Reminder Timing">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary dark:text-primary-light">
            <Icon name="schedule" size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body-lg font-medium text-ink">Remind me before class</p>
            <p className="text-body-sm text-ink-muted">
              Exams notify at least 1 hour before; assignment deadlines at least 1 day before.
            </p>
          </div>
          <select
            value={String(leadMinutes)}
            onChange={(e) => updateLeadMinutes(e.target.value)}
            aria-label="Class reminder lead time"
            className="rounded-lg border border-outline bg-surface px-2.5 py-1.5 text-body-md text-ink focus:border-primary focus:outline-none"
          >
            {LEAD_OPTIONS.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {minutes} min
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline/60 px-4 py-3">
          <p className="text-body-sm text-ink-muted">
            Test the alert without waiting for a class.
          </p>
          <Button size="sm" variant="tonal" icon="notifications_active" onClick={sendTestReminder}>
            Send test reminder
          </Button>
        </div>
      </Section>

      <Section title="Quiet Hours">
        <SwitchRow
          icon="do_not_disturb"
          title="Enable Quiet Hours"
          subtitle="Mute notifications during specific hours"
          checked={quietHoursEnabled}
          onChange={(v) => toggle(KEYS.quietHoursEnabled, v, setQuietHoursEnabled)}
        />
        {quietHoursEnabled && (
          <>
            <div className="flex items-center gap-3 px-4 py-3">
              <Icon name="schedule" size={19} className="shrink-0 text-primary dark:text-primary-light" />
              <span className="flex-1 text-body-lg text-ink">Start Time</span>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => {
                  setQuietStart(e.target.value);
                  writeString(KEYS.quietStart, e.target.value);
                }}
                className="rounded-lg border border-outline bg-surface px-2.5 py-1.5 text-body-md text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Icon name="schedule" size={19} className="shrink-0 text-primary dark:text-primary-light" />
              <span className="flex-1 text-body-lg text-ink">End Time</span>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => {
                  setQuietEnd(e.target.value);
                  writeString(KEYS.quietEnd, e.target.value);
                }}
                className="rounded-lg border border-outline bg-surface px-2.5 py-1.5 text-body-md text-ink focus:border-primary focus:outline-none"
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Topics">
        {topicRow('All Updates', 'campus_updates')}
        {profile?.department && topicRow('Department', `dept_${profile.department.code}`)}
        {profile?.batch && topicRow('Batch', `batch_${profile.batch.label ?? profile.batch.name}`)}
        {profile?.section && topicRow('Section', `section_${profile.section.name}`)}
      </Section>

      <p className="text-label-sm text-ink-muted">
        Reminders are generated on this device from your routine, exams and assignment deadlines.
        Browser notifications appear while CUET AI Campus is open; in-app alerts always work.
      </p>
    </PageShell>
  );
}
