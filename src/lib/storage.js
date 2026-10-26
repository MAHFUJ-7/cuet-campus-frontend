// Local persistence helpers.
//
// The Flutter app used FlutterSecureStorage (token + keys) and
// SharedPreferences (cache + preferences). On the web both map to
// localStorage; JSON values are encoded/decoded transparently.

const PREFIX = 'cuet:';

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readRaw(key) {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeRaw(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeRaw(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function readString(key, fallback = null) {
  const raw = readRaw(key);
  return raw === null ? fallback : raw;
}

export function writeString(key, value) {
  return writeRaw(key, String(value));
}

export function readJson(key, fallback = null) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  const parsed = safeParse(raw);
  return parsed === null ? fallback : parsed;
}

export function writeJson(key, value) {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function readBool(key, fallback = false) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

export function writeBool(key, value) {
  return writeRaw(key, value ? 'true' : 'false');
}

export function readInt(key, fallback = 0) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function writeInt(key, value) {
  return writeRaw(key, String(value));
}

/** Remove every key the app owns (used by sign-out / clear cache). */
export function clearAppStorage({ keep = [] } = {}) {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX) && !keep.some((kp) => k === PREFIX + kp)) {
        keys.push(k);
      }
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// Storage keys (mirrors the Flutter key names).
export const KEYS = {
  authToken: 'auth_token',
  cacheUser: 'cache_user',
  cacheRoutine: 'cache_routine',
  cacheWeeklyRoutine: 'cache_weekly_routine_v1',
  cacheUpdates: 'cache_updates',
  cacheAssignments: 'cache_assignments',
  lastSync: 'cache_last_sync',
  crLocalUpdates: 'cr_local_updates_v1',
  crLocalOverrides: 'cr_local_overrides_v1',
  routineOverrides: 'routine_overrides_v1',
  chatConversations: 'ai_chat_conversations_v1',
  geminiKey: 'gemini_api_key',
  geminiModel: 'ai_selected_model_gemini_v1',
  customProvider: 'ai_custom_provider_v1',
  themeMode: 'theme_mode',
  hasSeenOnboarding: 'has_seen_onboarding',
  profileCompleted: 'profile_completed',
  // Notification preferences
  pushEnabled: 'push_enabled',
  routineReminders: 'routine_reminders',
  assignmentReminders: 'assignment_reminders',
  examReminders: 'exam_reminders',
  updateNotifications: 'update_notifications',
  aiInsights: 'ai_insights',
  quietHoursEnabled: 'quiet_hours_enabled',
  quietStart: 'quiet_start',
  quietEnd: 'quiet_end',
  pushTopics: 'push_topics_v1',
  reminderLeadMinutes: 'reminder_lead_minutes',
  reminderFired: 'reminder_fired_v1',
  localEvents: 'local_events_v1',
  appLock: 'app_lock_enabled',
  privacyMode: 'privacy_mode_enabled',
};
