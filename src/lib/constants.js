// Ported from lib/core/constants/app_constants.dart
export const APP_NAME = 'CUET AI Campus';
export const APP_TAGLINE = 'Your Intelligent Academic Companion';
export const CUET_DOMAIN = '@student.cuet.ac.bd';
export const COORDINATOR_DOMAIN = '@cuet.ac.bd';
export const APP_VERSION = '1.0.0';

/**
 * Official student email shape:
 *   u + 2-digit batch + 2-digit department + 3-digit roll
 * e.g. u2204037@student.cuet.ac.bd
 *      └22 batch, 04 CSE, 037 roll — student ID 2204037.
 */
export const STUDENT_EMAIL_PATTERN = /^u(\d{2})(\d{2})(\d{3})@student\.cuet\.ac\.bd$/;
/** Legacy local-part form kept only for old demo/server accounts. */
export const LEGACY_STUDENT_EMAIL_PATTERN = /^(\d{2})(\d{2})(\d{3})@student\.cuet\.ac\.bd$/;

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Marker token for offline test sessions — never sent anywhere meaningful. */
export const OFFLINE_SESSION_TOKEN = 'offline-test-session';

/** The CUET academic week (Sunday–Thursday). */
export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
export const WEEK_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

export const CLASS_TYPE_LABELS = {
  lecture: 'Lecture',
  lab: 'Lab',
  sessional: 'Sessional',
  tutorial: 'Tutorial',
  project: 'Project',
  other: 'Other',
};

export const UPDATE_TYPE_LABELS = {
  announcement: 'Announcement',
  cancellation: 'Class Cancellation',
  class_cancellation: 'Class Cancellation',
  auto_day_off: 'Day Off',
  mid_break: 'Mid-Break',
  room_change: 'Room Change',
  time_change: 'Time Change',
  extra_class: 'Extra Class',
  teacher_change: 'Teacher Change',
  lab_change: 'Lab Change',
  ct_reminder: 'CT Reminder',
  exam_reminder: 'Exam Reminder',
  assignment_reminder: 'Assignment Reminder',
  other: 'Other',
};

/** Department code map extracted from CUET student email local parts. */
export const DEPARTMENT_CODES = {
  '01': 'Civil Engineering',
  '02': 'Electrical and Electronic Engineering',
  '03': 'Mechanical Engineering',
  '04': 'Computer Science & Engineering',
  '05': 'Urban & Regional Planning',
  '06': 'Architecture',
  '07': 'Petroleum and Mining Engineering',
  '08': 'Electronics and Telecommunication Engineering',
  '09': 'Mechatronics and Industrial Engineering',
  10: 'Water Resources Engineering',
  11: 'Biomedical Engineering',
  12: 'Materials and Metallurgical Engineering',
};

/** Department options used by profile setup screens. */
export const SETUP_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Civil Engineering',
  'Electrical and Electronic Engineering',
  'Mechanical Engineering',
  'Urban & Regional Planning',
  'Architecture',
  'Petroleum and Mining Engineering',
  'Electronics and Telecommunication Engineering',
  'Mechatronics and Industrial Engineering',
  'Water Resources Engineering',
  'Biomedical Engineering',
  'Materials and Metallurgical Engineering',
];

export const SETUP_BATCHES = ['2020', '2021', '2022', '2023', '2024', '2025'];
export const SETUP_SECTIONS = ['A', 'B', 'C', 'D'];

/** Parse a CUET student email into batch / department / roll. */
export function parseCuetEmail(rawEmail) {
  const email = (rawEmail ?? '').trim().toLowerCase();
  const match = email.match(STUDENT_EMAIL_PATTERN) ?? email.match(LEGACY_STUDENT_EMAIL_PATTERN);
  if (!match) return null;
  const [, batchCode, deptCode, roll] = match;
  return {
    batchCode,
    batch: `20${batchCode}`,
    departmentCode: deptCode,
    department: DEPARTMENT_CODES[deptCode] ?? `Unknown (${deptCode})`,
    roll: Number(roll),
    studentId: `${batchCode}${deptCode}${roll}`,
  };
}

/** "uXXYYZZZ@" variant used by the Setup screen. */
export function parseSetupEmail(rawEmail) {
  const parsed = parseCuetEmail(rawEmail);
  if (!parsed) return null;
  return {
    batchCode: parsed.batchCode,
    batch: parsed.batch,
    departmentCode: parsed.departmentCode,
    department: parsed.department,
    roll: parsed.roll,
    studentId: parsed.studentId,
  };
}
