// Personalized reminder engine.
//
// Pure computation lives here so it can be unit-tested without React. The
// ReminderHost decides how to present each due reminder (in-app banner and/or
// browser notification).
import { dayMatches, isoDate, startToday, timeToMinutes, todayName } from './datetime.js';
import { groupRoutineEntries } from './routine.js';
import { KEYS, readBool, readInt, readJson, readString, writeJson } from './storage.js';

const DAY_MS = 86_400_000;
const EXAM_WINDOW_MINUTES = 60;
const ASSIGNMENT_WINDOW_MINUTES = 24 * 60;

export function readReminderPrefs() {
  return {
    enabled: readBool(KEYS.pushEnabled, true),
    routine: readBool(KEYS.routineReminders, true),
    assignment: readBool(KEYS.assignmentReminders, true),
    exam: readBool(KEYS.examReminders, true),
    leadMinutes: Math.max(1, readInt(KEYS.reminderLeadMinutes, 10)),
    quietHoursEnabled: readBool(KEYS.quietHoursEnabled, false),
    quietStart: readString(KEYS.quietStart, '22:00'),
    quietEnd: readString(KEYS.quietEnd, '07:00'),
  };
}

export function isWithinQuietHours(now, prefs = readReminderPrefs()) {
  if (!prefs.quietHoursEnabled) return false;
  const start = timeToMinutes(prefs.quietStart);
  const end = timeToMinutes(prefs.quietEnd);
  if (start == null || end == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  // Overnight range, e.g. 22:00 → 07:00.
  return current >= start || current < end;
}

export function relativeLeadLabel(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

function targetForExam(exam) {
  if (!exam?.examDate) return null;
  const date = exam.examDate instanceof Date ? exam.examDate : new Date(exam.examDate);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = timeToMinutes(exam.startTime);
  if (minutes == null) return date;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60
  );
}

function examDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function courseCode(entity) {
  return entity?.course?.code ?? entity?.courseId ?? 'Course';
}

/**
 * Returns every reminder that is currently inside its notification window.
 *
 * Windows:
 *   classes       → user's lead time (default 10 min)
 *   exams         → at least 60 min
 *   assignments   → at least 24 hours
 */
export function collectDueReminders({
  routine = [],
  exams = [],
  assignments = [],
  now = new Date(),
  prefs = readReminderPrefs(),
} = {}) {
  if (!prefs.enabled) return [];

  const due = [];
  const today = todayName(now);

  if (prefs.routine) {
    const todaysEntries = groupRoutineEntries(
      routine
        .filter(
          (entry) =>
            entry &&
            !entry.isBreak &&
            entry.status !== 'cancelled' &&
            dayMatches(entry.day, today)
        )
        .filter((entry) => {
          const code = String(entry.course?.code ?? '').toUpperCase();
          return entry.classType !== 'ct' && code !== 'CT';
        })
    );

    for (const entry of todaysEntries) {
      const target = startToday(entry.startTime, now);
      if (!target) continue;
      const minutes = Math.ceil((target - now) / 60_000);
      if (minutes <= 0 || minutes > prefs.leadMinutes) continue;

      const code = courseCode(entry);
      const kindLabel = entry.classType === 'lab' ? 'Lab' : 'Class';
      const room = entry.room ? ` · Room ${entry.room}` : '';
      const period =
        entry.periodCount > 1 && entry.periodStart
          ? ` · P${entry.periodStart}–P${entry.periodEnd}`
          : '';
      due.push({
        key: `class:${isoDate(now)}:${entry.id ?? code}:${entry.startTime}`,
        kind: 'routine',
        title: `${code} starts in ${relativeLeadLabel(minutes)}`,
        body: `${kindLabel} ${entry.startTime}–${entry.endTime}${room}${period}`,
        href: '/routine',
        icon: 'schedule',
        target,
        minutes,
      });
    }
  }

  if (prefs.exam) {
    const windowMinutes = Math.max(prefs.leadMinutes, EXAM_WINDOW_MINUTES);
    for (const exam of exams) {
      const target = targetForExam(exam);
      if (!target) continue;
      const minutes = Math.ceil((target - now) / 60_000);
      if (minutes <= 0 || minutes > windowMinutes) continue;

      const code = courseCode(exam);
      const type = String(exam.examType ?? 'Exam').toUpperCase();
      const room = exam.room || exam.venue ? ` · ${exam.room ?? exam.venue}` : '';
      due.push({
        key: `exam:${exam.id ?? code}:${isoDate(target)}`,
        kind: 'exam',
        title: `${code} ${type} in ${relativeLeadLabel(minutes)}`,
        body: `${examDateLabel(target)} · ${exam.startTime || 'Time TBA'}${room}`,
        href: '/exams',
        icon: 'quiz',
        target,
        minutes,
      });
    }
  }

  if (prefs.assignment) {
    const windowMinutes = Math.max(prefs.leadMinutes, ASSIGNMENT_WINDOW_MINUTES);
    for (const assignment of assignments) {
      if (!assignment || assignment.status === 'completed') continue;
      const deadline =
        assignment.deadline instanceof Date ? assignment.deadline : new Date(assignment.deadline);
      if (Number.isNaN(deadline.getTime())) continue;
      const minutes = Math.ceil((deadline - now) / 60_000);
      if (minutes <= 0 || minutes > windowMinutes) continue;

      const code = courseCode(assignment);
      due.push({
        key: `assignment:${assignment.id ?? assignment.title}:${deadline.toISOString()}`,
        kind: 'assignment',
        title: `${code} deadline in ${relativeLeadLabel(minutes)}`,
        body: assignment.title || 'Assignment due soon',
        href: '/assignments',
        icon: 'assignment',
        target: deadline,
        minutes,
      });
    }
  }

  return due.sort((a, b) => a.target - b.target);
}

// ---------------------------------------------------------------------------
// Delivery de-duplication (persisted across reloads)
// ---------------------------------------------------------------------------

function readFiredMap() {
  const raw = readJson(KEYS.reminderFired, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

export function hasFired(key) {
  return Boolean(readFiredMap()[key]);
}

export function markFired(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return;
  const map = readFiredMap();
  const now = Date.now();
  for (const key of keys) map[key] = now;
  for (const [key, timestamp] of Object.entries(map)) {
    if (!Number.isFinite(Number(timestamp)) || now - Number(timestamp) > 14 * DAY_MS) {
      delete map[key];
    }
  }
  writeJson(KEYS.reminderFired, map);
}

export function clearFired() {
  writeJson(KEYS.reminderFired, {});
}

export function buildTestReminder(now = new Date()) {
  return {
    key: `test:${now.getTime()}`,
    kind: 'test',
    title: 'Personalized reminders are working',
    body: 'This is a test alert. Classes, exams and assignment deadlines will appear here before they start.',
    href: '/notification-preferences',
    icon: 'notifications_active',
    target: now,
    minutes: 0,
  };
}
