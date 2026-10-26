// Client-side routine analysis — port of conflict_detector.dart.
// Works entirely offline on a list of parsed routine entries. Exam conflicts
// are added when the caller supplies parsed exams.
const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_ORDER = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** "08:10" / "8:10" / "08:10:00" → minutes since midnight. */
export function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** True when two HH:mm ranges visibly overlap (touching endpoints are fine). */
export function timeRangesOverlap(startA, endA, startB, endB) {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** Same day and either the same period or overlapping clock times. */
function sameTimeSlot(a, b) {
  if (!a || !b || a.day !== b.day) return false;
  if (a.period && b.period && Number(a.period) === Number(b.period)) return true;
  return timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
}

/** Days to report on: the teaching week plus any day the routine actually uses. */
function daysOfInterest(routine) {
  const days = new Set(WEEK);
  for (const entry of routine) {
    if (entry?.day) days.add(entry.day);
  }
  return days;
}

/** days → entries map helper */
function groupByDay(routine) {
  const byDay = {};
  for (const entry of routine) {
    (byDay[entry.day] = byDay[entry.day] ?? []).push(entry);
  }
  return byDay;
}

const courseCode = (entry) => entry?.course?.code ?? entry?.courseId ?? 'Unknown';
const slotLabel = (a) =>
  a?.startTime && a?.endTime ? `${a.startTime}–${a.endTime}` : 'time not set';

function detectTimeOverlaps(routine) {
  const conflicts = [];
  const byDay = groupByDay(routine);
  for (const [day, entries] of Object.entries(byDay)) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (!sameTimeSlot(a, b)) continue;
        const courseA = courseCode(a);
        const courseB = courseCode(b);
        conflicts.push({
          type: 'time_overlap',
          severity: 'high',
          description: `${courseA} and ${courseB} overlap on ${day} (${slotLabel(a)})`,
          involvedCourses: [courseA, courseB],
          day,
          timeSlot: `${slotLabel(a)} / ${slotLabel(b)}`,
          routineEntryId: a.id,
          otherRoutineEntryId: b.id,
          courseId: a.course?.id ?? a.courseId,
        });
      }
    }
  }
  return conflicts;
}

function detectRoomClashes(routine) {
  const conflicts = [];
  const byDay = groupByDay(routine.filter((entry) => entry.room));
  for (const [day, entries] of Object.entries(byDay)) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (!sameTimeSlot(a, b) || a.room !== b.room) continue;
        const courseA = courseCode(a);
        const courseB = courseCode(b);
        conflicts.push({
          type: 'room_clash',
          severity: 'high',
          description: `${courseA} and ${courseB} are both assigned to ${a.room} on ${day}`,
          involvedCourses: [courseA, courseB],
          day,
          timeSlot: `${slotLabel(a)} / ${slotLabel(b)}`,
          routineEntryId: a.id,
          otherRoutineEntryId: b.id,
        });
      }
    }
  }
  return conflicts;
}

function detectTeacherConflicts(routine) {
  const conflicts = [];
  const byDay = groupByDay(routine.filter((entry) => entry.teacherId));
  for (const [day, entries] of Object.entries(byDay)) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (!sameTimeSlot(a, b) || a.teacherId !== b.teacherId) continue;
        const courseA = courseCode(a);
        const courseB = courseCode(b);
        const teacherName = a.teacher?.name ?? 'Unknown teacher';
        conflicts.push({
          type: 'teacher_conflict',
          severity: 'high',
          description: `${teacherName} is assigned to both ${courseA} and ${courseB} on ${day}`,
          involvedCourses: [courseA, courseB],
          day,
          timeSlot: `${slotLabel(a)} / ${slotLabel(b)}`,
          routineEntryId: a.id,
          otherRoutineEntryId: b.id,
        });
      }
    }
  }
  return conflicts;
}

function examDateOf(exam) {
  const raw = exam?.examDate ?? exam?.date;
  const date = raw instanceof Date ? raw : new Date(raw ?? 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateLabel(date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

/** Exam-versus-class and exam-versus-exam time clashes. */
function detectExamConflicts(routine, exams) {
  const conflicts = [];
  const classes = routine.filter((entry) => !entry?.isBreak && entry?.day);
  const datedExams = exams
    .map((exam) => ({ exam, date: examDateOf(exam) }))
    .filter((item) => item.date);
  // A multi-period lab spans several rows; report one clash per exam/course.
  const reportedCourseClashes = new Set();

  for (const { exam, date } of datedExams) {
    const day = DAY_ORDER[date.getDay()];
    const examCode = courseCode(exam);
    for (const entry of classes) {
      if (entry.day !== day) continue;
      if (!timeRangesOverlap(exam.startTime, exam.endTime, entry.startTime, entry.endTime)) {
        continue;
      }
      const clashKey = `${exam.id}|${entry.course?.id ?? courseCode(entry)}|${localDateLabel(date)}`;
      if (reportedCourseClashes.has(clashKey)) continue;
      reportedCourseClashes.add(clashKey);
      conflicts.push({
        type: 'exam_conflict',
        severity: 'high',
        description: `${examCode} exam overlaps ${courseCode(entry)} on ${day} (${localDateLabel(
          date
        )})`,
        involvedCourses: [examCode, courseCode(entry)],
        day,
        date: localDateLabel(date),
        timeSlot: `${exam.startTime}–${exam.endTime} / ${slotLabel(entry)}`,
        examId: exam.id,
        routineEntryId: entry.id,
        courseId: entry.course?.id ?? entry.courseId,
      });
    }
  }

  for (let i = 0; i < datedExams.length; i++) {
    for (let j = i + 1; j < datedExams.length; j++) {
      const a = datedExams[i];
      const b = datedExams[j];
      if (localDateLabel(a.date) !== localDateLabel(b.date)) continue;
      if (
        !timeRangesOverlap(
          a.exam.startTime,
          a.exam.endTime,
          b.exam.startTime,
          b.exam.endTime
        )
      ) {
        continue;
      }
      const codeA = courseCode(a.exam);
      const codeB = courseCode(b.exam);
      conflicts.push({
        type: 'exam_conflict',
        severity: 'high',
        description: `${codeA} and ${codeB} exams overlap on ${localDateLabel(a.date)}`,
        involvedCourses: [codeA, codeB],
        day: DAY_ORDER[a.date.getDay()],
        date: localDateLabel(a.date),
        timeSlot: `${a.exam.startTime}–${a.exam.endTime} / ${b.exam.startTime}–${b.exam.endTime}`,
        examId: a.exam.id,
      });
    }
  }

  return conflicts;
}

export const conflictDetector = {
  /** Routine conflicts plus (optionally) exam conflicts. */
  detectConflicts(routine, exams = []) {
    const cleanRoutine = (Array.isArray(routine) ? routine : []).filter(
      (entry) => entry && !entry.isBreak
    );
    return [
      ...detectTimeOverlaps(cleanRoutine),
      ...detectRoomClashes(cleanRoutine),
      ...detectTeacherConflicts(cleanRoutine),
      ...detectExamConflicts(cleanRoutine, Array.isArray(exams) ? exams : []),
    ];
  },

  /** Optimal free slots for a new class, given the existing routine. */
  suggestSlots(existingRoutine, day, courseId) {
    const usable = existingRoutine.filter((entry) => !entry.isBreak);
    const occupied = new Set(
      usable.filter((e) => e.day === day).map((e) => e.period)
    );
    const free = ALL_PERIODS.filter((p) => !occupied.has(p));

    let isLab = false;
    if (usable.length > 0) {
      const matching =
        usable.find((e) => e.day === day && e.courseId === courseId) ??
        usable.find((e) => e.courseId === courseId) ??
        usable[0];
      isLab = matching.classType === 'lab';
    }

    // Prefer later periods for labs, earlier for lectures.
    free.sort((a, b) => (isLab ? b - a : a - b));
    return free.map((p) => `Period ${p}`);
  },

  /** Workload distribution across the week (teaching week + any extra days). */
  analyzeWorkload(routine) {
    const usable = routine.filter((entry) => !entry.isBreak);
    const days = daysOfInterest(usable);
    const workload = {};
    for (const day of DAY_ORDER) {
      if (days.has(day)) workload[day] = 0;
    }
    for (const entry of usable) {
      if (workload[entry.day] != null) workload[entry.day] += 1;
    }
    return workload;
  },

  /** Free periods per weekday for a given section. */
  findFreeSlots(routine) {
    const usable = routine.filter((entry) => !entry.isBreak);
    const days = daysOfInterest(usable);
    const freeSlots = {};
    for (const day of DAY_ORDER) {
      if (!days.has(day)) continue;
      const occupied = new Set(
        usable.filter((e) => e.day === day).map((e) => e.period)
      );
      freeSlots[day] = ALL_PERIODS.filter((p) => !occupied.has(p));
    }
    return freeSlots;
  },
};
