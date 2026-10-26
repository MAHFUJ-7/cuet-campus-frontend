// Date/time helpers ported from routine_models.dart & friends.

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Local YYYY-MM-DD string (never UTC-shifted). */
export function isoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayName(date = new Date()) {
  return DAY_NAMES[date.getDay()];
}

export function dayNameShort(date = new Date()) {
  return DAY_NAMES_SHORT[date.getDay()];
}

/** "d/m/yyyy" — Flutter's default date rendering. */
export function formatDMY(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** "d MMM" → e.g. "3 Jan". */
export function formatDayMonth(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "Mon, 19 Oct". */
export function formatShortWeekday(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${DAY_NAMES_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "yyyy-MM-dd" for date inputs (identical to isoDate). */
export function inputDateValue(date = new Date()) {
  return isoDate(date);
}

/** Relative "timeAgo" from CrUpdate.timeAgo. */
export function timeAgo(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDMY(date);
}

/** Lower-case variant used by the updates feed. */
export function timeAgoLower(input) {
  const value = timeAgo(input);
  return value === 'Just now' ? 'just now' : value;
}

/** "just now / 5m ago / 2h ago / 3d ago / d/m/yyyy" (chat history). */
export function relativeShort(input) {
  return timeAgo(input);
}

/** Minutes between now and a "HH:mm" time today (null when unparsable). */
export function minutesUntil(timeStr, now = new Date()) {
  const cleaned = String(timeStr ?? '').trim().replaceAll('.', ':');
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  return Math.round((target - now) / 60000);
}

/** Parse "HH:mm" into minutes since midnight. */
export function timeToMinutes(timeStr) {
  const cleaned = String(timeStr ?? '').trim().replaceAll('.', ':');
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Case-insensitive day matching ("Sat", "SATURDAY", "Saturday" all match). */
export function dayMatches(entryDay, dayName) {
  const a = String(entryDay ?? '').trim().toLowerCase();
  const b = String(dayName ?? '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 3 && b.startsWith(a.slice(0, 3));
}

/** "B / KB / MB" file size formatting (1 decimal). */
export function formatBytes(size) {
  const value = Number(size) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** "starts in 12 min" helper used by the home hero. */
export function minutesLabel(minutes) {
  if (minutes == null) return null;
  if (minutes <= 0) return null;
  return `${minutes} min`;
}

/** RoutineEntry.startToday — today's Date at the entry's start time (or null). */
export function startToday(timeStr, now = new Date()) {
  const minutes = timeToMinutes(timeStr);
  if (minutes == null) return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, minutes);
}

/** RoutineEntry.endToday — today's Date at the entry's end time (or null). */
export function endToday(timeStr, now = new Date()) {
  const minutes = timeToMinutes(timeStr);
  if (minutes == null) return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, minutes);
}

/** Casual greeting used by the home header. */
export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Thu, 16 Oct" label used by the home schedule header. */
export function todayLabel(date = new Date()) {
  return formatShortWeekday(date);
}
