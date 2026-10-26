// Shared display mappings (classes, tones) used across feed/schedule widgets.

/** Class-type chip tones (lecture/lab/sessional/tutorial…). */
export const CLASS_TYPE_TONES = {
  lecture: 'bg-lecture/15 text-lecture',
  lab: 'bg-lab/15 text-lab',
  sessional: 'bg-sessional/15 text-sessional',
  tutorial: 'bg-tutorial/15 text-tutorial',
  project: 'bg-tutorial/15 text-tutorial',
  ct: 'bg-violet/15 text-violet',
  other: 'bg-surface-variant text-ink-muted',
};

export const classTypeTone = (type) => CLASS_TYPE_TONES[type] ?? CLASS_TYPE_TONES.other;

/** Avoid "Room Room 3305" while still prefixing plain room numbers. */
export function roomDisplayLabel(room) {
  const value = String(room ?? '').trim();
  if (!value) return '';
  if (/^room\b/i.test(value) || /\blab\b/i.test(value)) return value;
  if (/^\d+[a-z]?$/i.test(value)) return `Room ${value}`;
  return value;
}

/** Update-type chip tones (updates feed / home highlights). */
export const UPDATE_TYPE_TONES = {
  announcement: 'bg-announcement/15 text-announcement',
  cancellation: 'bg-cancellation/15 text-cancellation',
  class_cancellation: 'bg-cancellation/15 text-cancellation',
  room_change: 'bg-room-change/15 text-room-change',
  time_change: 'bg-room-change/15 text-room-change',
  extra_class: 'bg-extra-class/15 text-extra-class',
  auto_day_off: 'bg-extra-class/15 text-extra-class',
  mid_break: 'bg-violet/15 text-violet',
  exam_reminder: 'bg-cancellation/15 text-cancellation',
  ct_reminder: 'bg-announcement/15 text-announcement',
  assignment_reminder: 'bg-sessional/15 text-sessional',
};

export const updateTypeTone = (type) => UPDATE_TYPE_TONES[type] ?? UPDATE_TYPE_TONES.announcement;

/** Priority tones. */
export const PRIORITY_TONES = {
  urgent: 'bg-critical/15 text-critical',
  important: 'bg-important/15 text-important',
  high: 'bg-critical/15 text-critical',
  medium: 'bg-important/15 text-important',
  normal: 'bg-normal/15 text-normal',
  low: 'bg-surface-variant text-ink-muted',
};

export const priorityTone = (priority) => PRIORITY_TONES[priority] ?? PRIORITY_TONES.normal;

/** Schedule-entry status tones (calendar). */
export const SCHEDULE_STATUS_TONES = {
  cancelled: 'bg-cancellation/15 text-cancellation',
  updated: 'bg-room-change/15 text-room-change',
  extra: 'bg-extra-class/15 text-extra-class',
  scheduled: 'bg-surface-variant text-ink-muted',
};

/** Assignment status labels (matches Flutter's strings). */
export const ASSIGNMENT_STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const assignmentStatusLabel = (status) => ASSIGNMENT_STATUS_LABELS[status] ?? status;

/** Exam-type label. */
export function examTypeLabel(type) {
  const value = String(type ?? '').trim();
  if (!value) return 'Exam';
  return value.length <= 4 ? value.toUpperCase() : value[0].toUpperCase() + value.slice(1);
}
