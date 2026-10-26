// Model parsers — ports of the Dart models (academic_models, routine_models,
// schedule_models). Each parser tolerates missing fields the same way.

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const idOf = (json) => str(json?._id) || str(json?.id);
const asArray = (v) => (Array.isArray(v) ? v : []);

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------
export function parseUserProfile(json) {
  if (!json || typeof json !== 'object') return null;
  const roles = asArray(json.roles).map(String);
  const singleRole = str(json.role, 'student');
  return {
    id: idOf(json),
    email: str(json.email),
    name: str(json.name),
    photoUrl: str(json.photoURL) || str(json.photoUrl) || null,
    phone: str(json.phone),
    studentId: str(json.studentId),
    role: singleRole,
    roles: roles.length ? roles : [singleRole],
    permissions: asArray(json.permissions).map(String),
    department: json.departmentId
      ? parseDepartment(json.departmentId)
      : null,
    batch: json.batchId ? parseBatch(json.batchId) : null,
    section: json.sectionId ? parseSection(json.sectionId) : null,
    academicSession: json.academicSessionId
      ? parseAcademicSession(json.academicSessionId)
      : null,
    hasPassword: Boolean(json.hasPassword),
  };
}

export function profileHasRole(profile, role) {
  if (!profile) return false;
  if (profile.roles?.length) return profile.roles.includes(role);
  return profile.role === role;
}

export function profileHasPermission(profile, permission) {
  return Boolean(profile?.permissions?.includes(permission));
}

/** Batch number without a leading "Batch" (handles label/name variants). */
export function batchNumberLabel(batch) {
  const raw = String(batch?.label ?? batch?.name ?? '').trim();
  return raw.replace(/^batch\s+/i, '');
}

/** "CSE • Batch 2022 • Section A" */
export function academicLabel(profile) {
  const parts = [];
  if (profile?.department?.code) parts.push(profile.department.code);
  const batch = batchNumberLabel(profile?.batch);
  if (batch) parts.push(`Batch ${batch}`);
  if (profile?.section?.name) parts.push(`Section ${profile.section.name}`);
  return parts.length ? parts.join(' \u2022 ') : 'Student';
}

/** "Student + CR" style label. */
export function roleLabel(profile) {
  if (!profile) return '';
  const labels = [];
  if (profileHasRole(profile, 'student')) labels.push('Student');
  if (profileHasRole(profile, 'cr')) labels.push('CR');
  if (profileHasRole(profile, 'coordinator')) labels.push('Coordinator');
  if (profileHasRole(profile, 'admin')) labels.push('Admin');
  return labels.length ? labels.join(' + ') : profile.role.toUpperCase();
}

export function parseDepartment(json) {
  if (typeof json === 'string') return { id: json, name: '', code: '' };
  if (!json || typeof json !== 'object') return null;
  return { id: idOf(json), name: str(json.name), code: str(json.code) };
}

export function parseBatch(json) {
  if (typeof json === 'string') return { id: json, name: '', label: '' };
  if (!json || typeof json !== 'object') return null;
  return {
    id: idOf(json),
    departmentId:
      json.departmentId && typeof json.departmentId === 'object'
        ? str(json.departmentId._id)
        : str(json.departmentId),
    batchNumber: Number(json.batchNumber) || 0,
    label: str(json.label),
    name: str(json.name) || str(json.label),
  };
}

export function parseSection(json) {
  if (typeof json === 'string') return { id: json, name: '', label: '' };
  if (!json || typeof json !== 'object') return null;
  return {
    id: idOf(json),
    termId: str(json.termId),
    name: str(json.name),
    label: str(json.label) || str(json.name),
  };
}

export function parseAcademicSession(json) {
  if (!json || typeof json !== 'object') return null;
  return {
    id: idOf(json),
    name: str(json.name),
    startYear: Number(json.startYear) || 0,
    endYear: Number(json.endYear) || 0,
  };
}

// ---------------------------------------------------------------------------
// Routine
// ---------------------------------------------------------------------------
export function parseCourseInfo(json) {
  if (!json || typeof json !== 'object') return null;
  return {
    id: idOf(json),
    code: str(json.code),
    title: str(json.title),
    credits: Number(json.credits) || 0,
  };
}

export function parseTeacherInfo(json) {
  if (!json || typeof json !== 'object') return null;
  return {
    id: idOf(json),
    name: str(json.name),
    title: str(json.title) || str(json.designation) || null,
    email: str(json.email) || null,
    phone: str(json.phone) || null,
    designation: str(json.designation) || str(json.title) || null,
    department:
      json.department && typeof json.department === 'object'
        ? parseDepartment(json.department)
        : null,
  };
}

export function parseRoutineEntry(json) {
  const courseFromField = json.courseId && typeof json.courseId === 'object'
    ? parseCourseInfo(json.courseId)
    : parseCourseInfo(json.course);
  const teacherFromField = json.teacherId && typeof json.teacherId === 'object'
    ? parseTeacherInfo(json.teacherId)
    : parseTeacherInfo(json.teacher);
  return {
    id: idOf(json),
    sectionId:
      json.sectionId && typeof json.sectionId === 'object'
        ? str(json.sectionId._id)
        : str(json.sectionId),
    courseId:
      json.courseId && typeof json.courseId === 'object'
        ? str(json.courseId._id)
        : str(json.courseId),
    teacherId:
      json.teacherId && typeof json.teacherId === 'object'
        ? str(json.teacherId._id)
        : str(json.teacherId) || null,
    day: str(json.day),
    period: Number(json.period) || 0,
    startTime: str(json.startTime),
    endTime: str(json.endTime),
    room: str(json.room) || null,
    classType: str(json.classType, 'lecture'),
    isBreak: Boolean(json.isBreak),
    breakType: str(json.breakType) || null,
    course: courseFromField,
    teacher: teacherFromField,
    isRead: Boolean(json.isRead),
  };
}

/** "HH:mm - HH:mm" */
export const routineDisplayTime = (entry) => `${entry.startTime} - ${entry.endTime}`;

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------
export function parseExamEntry(json) {
  return {
    id: idOf(json),
    sectionId:
      json.sectionId && typeof json.sectionId === 'object'
        ? str(json.sectionId._id)
        : str(json.sectionId),
    courseId:
      json.courseId && typeof json.courseId === 'object'
        ? str(json.courseId._id)
        : str(json.courseId),
    examDate: new Date(str(json.examDate) || str(json.date) || 0),
    startTime: str(json.startTime),
    endTime: str(json.endTime),
    room: str(json.room) || null,
    venue: str(json.venue) || null,
    examType: str(json.examType) || str(json.type, 'midterm'),
    course:
      json.courseId && typeof json.courseId === 'object'
        ? parseCourseInfo(json.courseId)
        : parseCourseInfo(json.course),
  };
}

/** Whole days until the exam (negative = past). */
export function examDaysUntil(exam, now = new Date()) {
  const examDay = new Date(
    exam.examDate.getFullYear(),
    exam.examDate.getMonth(),
    exam.examDate.getDate()
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((examDay - today) / 86400000);
}

// ---------------------------------------------------------------------------
// Updates (CrUpdate)
// ---------------------------------------------------------------------------
export function parseCrUpdate(json) {
  const author = json.authorId && typeof json.authorId === 'object'
    ? { id: str(json.authorId._id), name: str(json.authorId.name) }
    : json.author && typeof json.author === 'object'
      ? { id: str(json.author._id), name: str(json.author.name) }
      : null;
  const departmentCode =
    typeof json.departmentCode === 'string'
      ? json.departmentCode
      : json.department && typeof json.department === 'object'
        ? str(json.department.code)
        : null;
  const section =
    json.sectionId && typeof json.sectionId === 'object' ? json.sectionId : null;
  const batch = json.batchId && typeof json.batchId === 'object' ? json.batchId : null;
  const rawBatchNumber =
    json.batchNumber ?? batch?.batchNumber ?? batch?.label ?? batch?.name ?? '';
  const batchNumberMatch = String(rawBatchNumber ?? '').match(/\d{2,4}/);

  return {
    id: idOf(json),
    authorId:
      json.authorId && typeof json.authorId === 'object'
        ? str(json.authorId._id)
        : str(json.authorId),
    sectionId: idOf(section) || str(json.sectionId),
    sectionName: str(section?.name) || str(json.sectionName),
    batchId: idOf(batch) || str(json.batchId),
    batchNumber: batchNumberMatch ? Number(batchNumberMatch[0]) : 0,
    batchName: str(batch?.label) || str(batch?.name) || str(json.batchName),
    courseId:
      json.courseId && typeof json.courseId === 'object'
        ? str(json.courseId._id)
        : str(json.courseId) || null,
    type: str(json.type, 'announcement'),
    title: str(json.title),
    description: str(json.description),
    priority: str(json.priority, 'normal'),
    scope: str(json.scope, 'section'),
    departmentCode,
    effectiveDate: json.effectiveDate ? new Date(json.effectiveDate) : null,
    status: str(json.status, 'draft'),
    upvotes: Number(json.upvotes) || 0,
    attachments: Array.isArray(json.attachments) ? json.attachments.map(String) : null,
    createdAt: new Date(str(json.createdAt) || 0),
    author,
    course:
      json.courseId && typeof json.courseId === 'object'
        ? parseCourseInfo(json.courseId)
        : parseCourseInfo(json.course),
    isRead: Boolean(json.isRead),
  };
}

export function updateScopeLabel(update) {
  if (update.scope === 'global') return 'Global';
  if (update.scope === 'batch') {
    const number = Number(update.batchNumber) || 0;
    if (number) return `Batch ${number}`;
    const label = String(update.batchName ?? '').replace(/^batch\s+/i, '').trim();
    return label ? `Batch ${label}` : 'Batch';
  }
  if (update.scope === 'department') {
    return update.departmentCode ? `Dept \u2022 ${update.departmentCode}` : 'Dept';
  }
  return update.sectionName ? `Section ${update.sectionName}` : 'Section';
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export function parseAssignment(json) {
  const deadline = new Date(str(json.deadline) || 0);
  return {
    id: idOf(json),
    userId:
      json.userId && typeof json.userId === 'object'
        ? str(json.userId._id)
        : str(json.userId),
    courseId:
      json.courseId && typeof json.courseId === 'object'
        ? str(json.courseId._id)
        : str(json.courseId),
    title: str(json.title),
    description: str(json.description) || null,
    deadline,
    priority: str(json.priority, 'medium'),
    status: str(json.status, 'not_started'),
    attachments: Array.isArray(json.attachments) ? json.attachments.map(String) : null,
    createdAt: new Date(str(json.createdAt) || 0),
    course:
      json.courseId && typeof json.courseId === 'object'
        ? parseCourseInfo(json.courseId)
        : parseCourseInfo(json.course),
    teacher: parseTeacherInfo(json.teacher),
  };
}

export function isAssignmentOverdue(assignment, now = new Date()) {
  return assignment.deadline < now && assignment.status !== 'completed';
}

// ---------------------------------------------------------------------------
// Effective schedule (calendar)
// ---------------------------------------------------------------------------
export function parseDeclarationInfo(json) {
  if (!json || typeof json !== 'object') return null;
  return {
    id: str(json.id),
    type: str(json.type),
    reason: str(json.reason) || null,
    startDate: str(json.startDate) || null,
    endDate: str(json.endDate) || null,
  };
}

export function declarationLabel(declaration) {
  return declaration?.type === 'mid_break' ? 'MID-BREAK' : 'AUTO / DAY OFF';
}

export function parseScheduleEntry(json) {
  const rawInstructor = json.instructor;
  let instructorNames = [];
  if (Array.isArray(rawInstructor)) instructorNames = rawInstructor.map(String);
  else if (typeof rawInstructor === 'string' && rawInstructor) instructorNames = [rawInstructor];

  return {
    id: idOf(json),
    day: str(json.day),
    period: Number(json.period) || 0,
    startTime: str(json.startTime),
    endTime: str(json.endTime),
    room: str(json.room) || null,
    classType: str(json.classType, 'lecture'),
    isBreak: Boolean(json.isBreak),
    course:
      json.courseId && typeof json.courseId === 'object'
        ? parseCourseInfo(json.courseId)
        : parseCourseInfo(json.course),
    teacherName:
      json.teacherId && typeof json.teacherId === 'object'
        ? str(json.teacherId.name)
        : null,
    instructorNames,
    instructorState: str(json.instructorState, 'unspecified'),
    status: str(json.status, 'scheduled'), // scheduled | cancelled | updated | extra
    overrideType: str(json.overrideType) || null,
    overrideReason: str(json.overrideReason) || null,
    original:
      json.original && typeof json.original === 'object'
        ? {
            startTime: str(json.original.startTime) || null,
            endTime: str(json.original.endTime) || null,
            room: str(json.original.room) || null,
          }
        : null,
    source: str(json.source, 'official'),
  };
}

export function scheduleEntryInstructor(entry) {
  switch (entry.instructorState) {
    case 'session_specific':
    case 'course_single':
      return entry.instructorNames.length
        ? entry.instructorNames[0]
        : 'Instructor not specified';
    case 'multiple':
      return 'Multiple instructors assigned';
    default:
      return 'Instructor not specified';
  }
}

export const scheduleDisplayTime = (entry) => `${entry.startTime} \u2013 ${entry.endTime}`;

export function parseDaySchedule(json) {
  return {
    date: str(json.date),
    day: str(json.day),
    sectionId: str(json.sectionId),
    dayStatus: str(json.dayStatus, 'regular'), // regular | auto_day_off | mid_break
    declaration: parseDeclarationInfo(json.declaration),
    activeOverrides: asArray(json.activeOverrides),
    classes: asArray(json.classes).map(parseScheduleEntry),
    exams: asArray(json.exams).map(parseExamEntry),
  };
}

export function parseRangeDay(json) {
  return {
    date: str(json.date),
    status: str(json.status, 'regular'),
    declarationId: str(json.declarationId) || null,
  };
}

// ---------------------------------------------------------------------------
// Schedule overrides
// ---------------------------------------------------------------------------
export const OVERRIDE_TYPE_LABELS = {
  auto_day_off: 'Auto / Day off',
  mid_break: 'Mid-break',
  class_cancellation: 'Class cancellation',
  room_change: 'Room change',
  time_change: 'Time change',
  extra_class: 'Extra class',
};

export const OVERRIDE_STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

export function parseScheduleOverride(json) {
  return {
    id: idOf(json),
    section: json.sectionId && typeof json.sectionId === 'object'
      ? parseSection(json.sectionId)
      : null,
    type: str(json.type),
    status: str(json.status, 'pending'),
    specificDate: str(json.specificDate) || null,
    startDate: str(json.startDate) || null,
    endDate: str(json.endDate) || null,
    startTime: str(json.startTime) || null,
    endTime: str(json.endTime) || null,
    room: str(json.room) || null,
    originalValues:
      json.originalValues && typeof json.originalValues === 'object'
        ? {
            startTime: str(json.originalValues.startTime) || null,
            endTime: str(json.originalValues.endTime) || null,
            room: str(json.originalValues.room) || null,
          }
        : null,
    reason: str(json.reason) || null,
    declaredBy:
      json.declaredBy && typeof json.declaredBy === 'object'
        ? { id: str(json.declaredBy._id), name: str(json.declaredBy.name) }
        : null,
    reviewedBy:
      json.reviewedBy && typeof json.reviewedBy === 'object'
        ? { id: str(json.reviewedBy._id), name: str(json.reviewedBy.name) }
        : null,
    reviewNote: str(json.reviewNote) || null,
    createdAt: new Date(str(json.createdAt) || 0),
  };
}

export const overrideTypeLabel = (type) => OVERRIDE_TYPE_LABELS[type] ?? type;
export const overrideStatusLabel = (status) => OVERRIDE_STATUS_LABELS[status] ?? status;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getDate()} ${MONTHS[value.getMonth()]} ${value.getFullYear()}`;
  }
  const raw = String(value).trim();
  const plainDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plainDate) {
    return `${Number(plainDate[3])} ${MONTHS[Number(plainDate[2]) - 1]} ${plainDate[1]}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

export function overrideRangeLabel(override) {
  if (override.type === 'mid_break') {
    const start = dateLabel(override.startDate);
    const end = dateLabel(override.endDate);
    if (start && end) return start === end ? start : `${start} \u2192 ${end}`;
    return start || end || '';
  }
  return dateLabel(override.specificDate) || '';
}

// ---------------------------------------------------------------------------
// Coordinator
// ---------------------------------------------------------------------------
export function parseAssignmentRule(json) {
  return {
    id: idOf(json),
    startId: String(json.startId ?? '0'),
    endId: String(json.endId ?? '0'),
    isActive: json.isActive !== false,
    section:
      json.sectionId && typeof json.sectionId === 'object'
        ? parseSection(json.sectionId)
        : null,
    termLabel:
      json.termId && typeof json.termId === 'object'
        ? str(json.termId.label)
        : null,
  };
}

export const assignmentRuleRangeLabel = (rule) => `ID ${rule.startId} — ${rule.endId}`;

export function parseCoordinatorStudent(json) {
  return {
    id: idOf(json),
    name: str(json.name) || null,
    email: str(json.email),
    studentId: json.studentId != null ? String(json.studentId) : null,
    role: str(json.role, 'student'),
    section:
      json.sectionId && typeof json.sectionId === 'object'
        ? parseSection(json.sectionId)
        : null,
    isCr: Boolean(json.isCr),
    isActive: json.isActive !== false,
  };
}

export function parseApplyRulesResult(json) {
  return {
    assignedCount: Number(json.assignedCount) || 0,
    alreadyAssignedCount: Number(json.alreadyAssignedCount) || 0,
    moved: asArray(json.moved).map((m) => ({
      userId: str(m.userId),
      studentId: String(m.studentId ?? ''),
    })),
  };
}

// ---------------------------------------------------------------------------
// Study materials / teachers
// ---------------------------------------------------------------------------
export function parseStudyMaterial(json) {
  const course = json.courseId ?? json.course;
  return {
    id: idOf(json),
    title: str(json.title),
    description: str(json.description) || null,
    type: str(json.type, 'other'),
    url: str(json.url) || null,
    courseCode:
      course && typeof course === 'object' ? str(course.code) || 'General' : 'General',
    uploadedBy: str(json.uploadedBy, 'Unknown'),
    createdAt: new Date(str(json.createdAt) || 0),
  };
}

export function parseTeacher(json) {
  return {
    id: idOf(json),
    departmentId:
      json.departmentId && typeof json.departmentId === 'object'
        ? str(json.departmentId._id)
        : str(json.departmentId),
    name: str(json.name),
    designation: str(json.designation) || str(json.title) || null,
    email: str(json.email) || null,
    phone: str(json.phone) || null,
    office: str(json.office) || null,
    department:
      json.departmentId && typeof json.departmentId === 'object'
        ? parseDepartment(json.departmentId)
        : null,
  };
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
export function attendanceLevel(percent) {
  if (percent == null) return { label: '—', tone: 'muted' };
  if (percent >= 85) return { label: 'Healthy', tone: 'success' };
  if (percent >= 75) return { label: 'Needs attention', tone: 'warning' };
  return { label: 'Low', tone: 'danger' };
}
