// Offline seed data â€” port of lib/core/data/offline_seed_data.dart.
//
// Built from the official Level-3 Term-II (Batch 2022) routine,
// Academic Year 2025-26, effective 06/07/2026.
//   Section A â€” Room 3403      Section B â€” Room 3305
//   Academic Building-3 (2nd Floor). Labs on 5th floor.
//
// Student test account -> Section A, CR test account -> Section B.

const hoursAgo = (n) => new Date(Date.now() - n * 3600 * 1000);
const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);
const daysAhead = (n) => new Date(Date.now() + n * 24 * 3600 * 1000);
const isoAgo = (n) => hoursAgo(n).toISOString();
const isoDaysAgo = (n) => daysAgo(n).toISOString();
const isoDaysAhead = (n) => daysAhead(n).toISOString();

// ---------------------------------------------------------------------------
// Academic context
// ---------------------------------------------------------------------------

export const seedDepartment = {
  id: 'dept-cse',
  name: 'Computer Science & Engineering',
  code: 'CSE',
};

export const seedBatch = {
  id: 'batch-2022',
  departmentId: 'dept-cse',
  batchNumber: 22,
  label: 'Batch 2022',
  name: 'Batch 2022',
  startYear: 2022,
  endYear: 2026,
};

const sectionA = {
  id: 'section-a',
  termId: 'term-l3t2',
  name: 'A',
  label: 'Section A â€” Room 3403',
  maxStudents: 45,
};

const sectionB = {
  id: 'section-b',
  termId: 'term-l3t2',
  name: 'B',
  label: 'Section B â€” Room 3305',
  maxStudents: 45,
};

/** Resolves a demo section ('A' or 'B', case-insensitive). Defaults to A. */
export function seedSectionFor(letter) {
  const l = String(letter ?? '').trim().toUpperCase();
  return l === 'B' ? sectionB : sectionA;
}

export const seedSession = {
  id: 'session-2022',
  name: '2022â€“2026',
  startYear: 2022,
  endYear: 2026,
  isActive: true,
};

// ---------------------------------------------------------------------------
// Courses â€” Level-3 Term-II (official course list)
// ---------------------------------------------------------------------------

const cse300 = { id: 'cse-300', code: 'CSE-300', title: 'S/W Development Project (Sessional)', credits: 0.75 };
const cse302 = { id: 'cse-302', code: 'CSE-302', title: 'Technical Writing and Presentation (Sessional)', credits: 0.75 };
const cse311 = { id: 'cse-311', code: 'CSE-311', title: 'Computer Networks', credits: 3 };
const cse321 = { id: 'cse-321', code: 'CSE-321', title: 'Computer Architecture', credits: 3 };
const cse345 = { id: 'cse-345', code: 'CSE-345', title: 'Artificial Intelligence', credits: 3 };
const cse347 = { id: 'cse-347', code: 'CSE-347', title: 'Introduction to Mathematical Programming', credits: 3 };
const cse355 = { id: 'cse-355', code: 'CSE-355', title: 'Software Engineering', credits: 3 };

/** Class Test slot shown in the weekly grid. */
const ctSlot = { id: 'ct-slot', code: 'CT', title: 'Class Test', credits: 0 };
/** Combined sessional block "CSE-300/CSE-302" (shared 3-hour slot). */
const cse300302 = { id: 'cse-300-302', code: 'CSE-300/CSE-302', title: 'S/W Development Project + Technical Writing (Sessional)', credits: 1.5 };
/** Combined block "CSE-356/CSE-300" (Section B, shared slot). */
const cse356300 = { id: 'cse-356-300', code: 'CSE-356/CSE-300', title: 'Software Engineering + S/W Project (Sessional)', credits: 1.5 };

const teachers = [
  { id: 't-tista', name: 'Sharmistha Chanda Tista' },
  { id: 't-rizvi', name: 'Md. Atiqul Islam Rizvi' },
  { id: 't-arefin', name: 'Prof. Dr. Mohammad Shamsul Arefin' },
  { id: 't-kowsar', name: 'Mir Md. Saki Kowsar' },
  { id: 't-mahfuz', name: 'Prof. Dr. Mahfuzulhoq Chowdhury' },
  { id: 't-rashadur', name: 'Md. Rashadur Rahman' },
  { id: 't-moshiul', name: 'Prof. Dr. Mohammed Moshiul Hoque' },
  { id: 't-afroza', name: 'Afroza Akter' },
  { id: 't-ayesha', name: 'Ayesha Banu' },
  { id: 't-annesha', name: 'Annesha Das' },
  { id: 't-maisha', name: 'Maisha Fahmida' },
];

// Teacher shortcuts.
const tTista = teachers[0];
const tArefin = teachers[2];
const tKowsar = teachers[3];
const tRashadur = teachers[5];
const tAfroza = teachers[7];
const tAyesha = teachers[8];
const tAnnesha = teachers[9];
const tMaisha = teachers[10];
const tRefaj = { id: 't-refaj', name: 'Md. Refaj Hossan' };

// Group-tagged sessional variants (labels match the official routine exactly).
const cse346A1 = { id: 'cse-346-a1', code: 'CSE-346', title: 'Artificial Intelligence (Sessional) â€” Group A1', credits: 1.5 };
const cse346A2 = { id: 'cse-346-a2', code: 'CSE-346', title: 'Artificial Intelligence (Sessional) â€” Group A2', credits: 1.5 };
const cse346B1 = { id: 'cse-346-b1', code: 'CSE-346', title: 'Artificial Intelligence (Sessional) â€” Group B1', credits: 1.5 };
const cse346B2 = { id: 'cse-346-b2', code: 'CSE-346', title: 'Artificial Intelligence (Sessional) â€” Group B2', credits: 1.5 };
const cse312A1 = { id: 'cse-312-a1', code: 'CSE-312', title: 'Computer Networks (Sessional) â€” Group A1', credits: 1.5 };
const cse312A2 = { id: 'cse-312-a2', code: 'CSE-312', title: 'Computer Networks (Sessional) â€” Group A2', credits: 1.5 };
const cse312B1 = { id: 'cse-312-b1', code: 'CSE-312', title: 'Computer Networks (Sessional) â€” Group B1', credits: 1.5 };
const cse312B2 = { id: 'cse-312-b2', code: 'CSE-312', title: 'Computer Networks (Sessional) â€” Group B2', credits: 1.5 };
const cse356A = { id: 'cse-356-a', code: 'CSE-356', title: 'Software Engineering (Sessional) â€” Compiler Lab', credits: 0.75 };

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

const roomA = 'Room 3403';
const roomB = 'Room 3305';
const labNetwork = 'Network Lab (5th Fl)';
const labMultimedia = 'Multimedia Lab (5th Fl)';
const labCompiler = 'Compiler Lab (5th Fl)';

// ---------------------------------------------------------------------------
// Period timetable (Level-3 Term-II)
//
//   P1 08:10-09:00  P2 09:00-09:45  P3 09:45-10:30  [Break 10:30-10:45]
//   P4 10:45-11:30  P5 11:30-12:15  P6 12:15-13:00  [Lunch 13:00-13:45]
//   P7 13:45-14:30  P8 14:30-15:15  P9 15:15-16:00
// ---------------------------------------------------------------------------

const periodStart = (period) =>
  ({ 1: '08:10', 2: '09:00', 3: '09:45', 4: '10:45', 5: '11:30', 6: '12:15', 7: '13:45', 8: '14:30', 9: '15:15' }[
    period
  ] ?? '08:10');

const periodEnd = (period) =>
  ({ 1: '09:00', 2: '09:45', 3: '10:30', 4: '11:30', 5: '12:15', 6: '13:00', 7: '14:30', 8: '15:15', 9: '16:00' }[
    period
  ] ?? '16:00');

// ---------------------------------------------------------------------------
// Routine â€” exact SUNâ€“THU grids for both sections
// ---------------------------------------------------------------------------

/** Builds the demo routine for a section ('A' or 'B'). */
export function studentRoutine({ section = 'A' } = {}) {
  const sec = seedSectionFor(section);
  const room = sec.name === 'B' ? roomB : roomA;
  const entries = [];
  let n = 0;

  const add = (day, period, course, teacher, roomOverride, classType = 'lecture') => {
    n += 1;
    entries.push({
      id: `r-${sec.name.toLowerCase()}-${n}`,
      sectionId: sec.id,
      courseId: course.id,
      teacherId: teacher?.id ?? null,
      day,
      period,
      startTime: periodStart(period),
      endTime: periodEnd(period),
      room: roomOverride ?? room,
      classType: course.id === 'ct-slot' ? 'ct' : classType,
      isBreak: false,
      breakType: null,
      course: { ...course },
      teacher: teacher ? { ...teacher } : null,
      isRead: false,
    });
  };

  /** Multi-period sessional/lab block. */
  const addBlock = (day, fromPeriod, count, course, teacher, blockRoom) => {
    for (let p = fromPeriod; p < fromPeriod + count; p += 1) {
      add(day, p, course, teacher, blockRoom, 'lab');
    }
  };

  if (sec.name === 'A') {
    // ---- SECTION A â€” Room 3403 ----
    // SUN: CT | CSE-321 | CSE-347 | CSE-300/CSE-302 block | CSE-346 (A2)
    add('Sunday', 1, ctSlot, null);
    add('Sunday', 2, cse321, tTista);
    add('Sunday', 3, cse347, tAnnesha);
    addBlock('Sunday', 4, 3, cse300302, tTista, roomA);
    addBlock('Sunday', 7, 3, cse346A2, tAyesha, labMultimedia);

    // MON: CSE-346 (A1) | CSE-345 | CSE-355 | CSE-311
    addBlock('Monday', 1, 3, cse346A1, tAyesha, labMultimedia);
    add('Monday', 4, cse345, tAfroza);
    add('Monday', 5, cse355, tKowsar);
    add('Monday', 6, cse311, tRashadur);

    // TUE: CT | CSE-347 | â€” | CSE-311 | CSE-355 | CSE-321 | CSE-312 (A1)
    add('Tuesday', 1, ctSlot, null);
    add('Tuesday', 2, cse347, tAnnesha);
    add('Tuesday', 4, cse311, tRashadur);
    add('Tuesday', 5, cse355, tKowsar);
    add('Tuesday', 6, cse321, tTista);
    addBlock('Tuesday', 7, 3, cse312A1, tRashadur, labNetwork);

    // WED: CT | â€” | CSE-311 | CSE-345 | CSE-355 | CSE-347 | CSE-312 (A2)
    add('Wednesday', 1, ctSlot, null);
    add('Wednesday', 3, cse311, tRashadur);
    add('Wednesday', 4, cse345, tAfroza);
    add('Wednesday', 5, cse355, tKowsar);
    add('Wednesday', 6, cse347, tAnnesha);
    addBlock('Wednesday', 7, 3, cse312A2, tRashadur, labNetwork);

    // THU: CT | CSE-345 | CSE-321 | CSE-356
    add('Thursday', 1, ctSlot, null);
    add('Thursday', 2, cse345, tAfroza);
    add('Thursday', 3, cse321, tTista);
    addBlock('Thursday', 4, 3, cse356A, tRefaj, labCompiler);
  } else {
    // ---- SECTION B â€” Room 3305 ----
    // SUN: CT | CSE-347 | CSE-321 | CSE-346 (B1) | CSE-302
    add('Sunday', 1, ctSlot, null);
    add('Sunday', 2, cse347, tAnnesha);
    add('Sunday', 3, cse321, tTista);
    addBlock('Sunday', 4, 3, cse346B1, tAyesha, labMultimedia);
    addBlock('Sunday', 7, 3, cse302, tArefin);

    // MON: CT | â€” | â€” | CSE-311 | CSE-345 | CSE-355
    add('Monday', 1, ctSlot, null);
    add('Monday', 4, cse311, tRashadur);
    add('Monday', 5, cse345, tAfroza);
    add('Monday', 6, cse355, tKowsar);

    // TUE: CT | â€” | CSE-347 | CSE-321 | CSE-311 | CSE-355 | CSE-356/CSE-300
    add('Tuesday', 1, ctSlot, null);
    add('Tuesday', 3, cse347, tAnnesha);
    add('Tuesday', 4, cse321, tTista);
    add('Tuesday', 5, cse311, tRashadur);
    add('Tuesday', 6, cse355, tKowsar);
    addBlock('Tuesday', 7, 3, cse356300, tRefaj, labMultimedia);

    // WED: CT | CSE-311 | â€” | CSE-347 | CSE-345 | CSE-355 | CSE-346 (B2)
    add('Wednesday', 1, ctSlot, null);
    add('Wednesday', 2, cse311, tRashadur);
    add('Wednesday', 4, cse347, tMaisha);
    add('Wednesday', 5, cse345, tAfroza);
    add('Wednesday', 6, cse355, tKowsar);
    addBlock('Wednesday', 7, 3, cse346B2, tAyesha, labMultimedia);

    // THU: CT | CSE-321 | CSE-345 | CSE-312 (B2) | CSE-312 (B1)
    add('Thursday', 1, ctSlot, null);
    add('Thursday', 2, cse321, tTista);
    add('Thursday', 3, cse345, tAfroza);
    addBlock('Thursday', 4, 3, cse312B2, tRashadur, labNetwork);
    addBlock('Thursday', 7, 3, cse312B1, tRashadur, labNetwork);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Updates â€” realistic sample feed tied to the real routine
// ---------------------------------------------------------------------------

export function studentUpdates({ section = 'A' } = {}) {
  const sec = seedSectionFor(section);
  const otherRoom = sec.name === 'A' ? roomB : roomA;
  const crName = sec.name === 'A' ? 'Ariful Islam (CR-A)' : 'Nishat (CR-B)';
  const crId = sec.name === 'A' ? 'offline-u2204001' : 'offline-u2204037';
  const coordName = 'Md. Rashadur Rahman (Course Coordinator)';
  const auth = (id, name) => ({ id, name });

  return [
    {
      id: `upd-${sec.id}-1`,
      authorId: 'coord-1',
      sectionId: sec.id,
      courseId: cse311.id,
      type: 'ct_reminder',
      title: 'CSE-311 CT-1 next Monday',
      description:
        'Computer Networks CT-1 will be held next Monday (first period, ' +
        `${sec.name === 'A' ? roomA : roomB}). Syllabus: Lectures 1â€“4 ` +
        '(Layered architectures through data-link layer). Bring your own calculator.',
      priority: 'important',
      scope: 'department',
      departmentCode: 'CSE',
      effectiveDate: null,
      status: 'approved',
      upvotes: 0,
      attachments: null,
      createdAt: hoursAgo(3),
      author: auth('coord-1', coordName),
      course: { ...cse311 },
      isRead: false,
    },
    {
      id: `upd-${sec.id}-2`,
      authorId: crId,
      sectionId: sec.id,
      courseId: cse345.id,
      type: 'cancellation',
      title: 'CSE-345 class cancelled today',
      description:
        'Todayâ€™s Artificial Intelligence class (Afroza Akter) is ' +
        'cancelled â€” she is on official leave. Compensation will be ' +
        'announced later.',
      priority: 'urgent',
      scope: 'section',
      departmentCode: null,
      effectiveDate: null,
      status: 'approved',
      upvotes: 0,
      attachments: null,
      createdAt: hoursAgo(5),
      author: auth(crId, crName),
      course: { ...cse345 },
      isRead: false,
    },
    {
      id: `upd-${sec.id}-3`,
      authorId: crId,
      sectionId: sec.id,
      courseId: cse355.id,
      type: 'time_change',
      title: 'CSE-355 shifted to 4th period this Thursday',
      description:
        'Software Engineering class moves from 2nd period to 4th period ' +
        'this Thursday (Mir Md. Saki Kowsar has a committee meeting). ' +
        'Same room.',
      priority: 'normal',
      scope: 'section',
      departmentCode: null,
      effectiveDate: null,
      status: 'approved',
      upvotes: 0,
      attachments: null,
      createdAt: hoursAgo(9),
      author: auth(crId, crName),
      course: { ...cse355 },
      isRead: false,
    },
    {
      id: `upd-${sec.id}-4`,
      authorId: 'coord-1',
      sectionId: sec.id,
      courseId: null,
      type: 'announcement',
      title: 'New routine effective 06/07/2026',
      description:
        'Level-3 Term-II routine is now active university-wide. Section A meets in ' +
        `${roomA}, Section B in ${roomB} (Academic Building-3, 2nd floor). ` +
        'All labs are on the 5th floor. Check your updated weekly schedule.',
      priority: 'normal',
      scope: 'global',
      departmentCode: null,
      effectiveDate: null,
      status: 'approved',
      upvotes: 0,
      attachments: null,
      createdAt: daysAgo(1),
      author: auth('coord-1', coordName),
      course: null,
      isRead: false,
    },
    {
      id: `upd-${sec.id}-5`,
      authorId: crId,
      sectionId: sec.id,
      courseId: cse300.id,
      type: 'assignment_reminder',
      title: 'CSE-300 weekly progress report due Friday',
      description:
        'Each group must submit the weekly project progress report before ' +
        'Friday 4:00 PM. The full guideline document is attached.',
      priority: 'normal',
      scope: 'section',
      departmentCode: null,
      effectiveDate: null,
      status: 'approved',
      upvotes: 0,
      attachments: ['CSE300_report_guideline.pdf'],
      createdAt: daysAgo(2),
      author: auth(crId, crName),
      course: { ...cse300 },
      isRead: false,
    },
    {
      id: `upd-${sec.id}-6`,
      authorId: crId,
      sectionId: sec.id,
      courseId: cse321.id,
      type: 'room_change',
      title: 'CSE-321 venue swap for this week',
      description:
        'This weekâ€™s Computer Architecture classes shift between ' +
        `sections: our section takes ${otherRoom || roomA} ` +
        `on Tuesday while Section ${sec.name === 'A' ? 'B' : 'A'} uses ours. ` +
        'Temporary arrangement due to renovation work.',
      priority: 'normal',
      scope: 'section',
      departmentCode: null,
      effectiveDate: null,
      status: 'approved',
      upvotes: 0,
      attachments: null,
      createdAt: daysAgo(3),
      author: auth(crId, crName),
      course: { ...cse321 },
      isRead: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Assignments â€” sample workload referencing real Term-II courses
// ---------------------------------------------------------------------------

export function studentAssignments({ section = 'A' } = {}) {
  const sec = seedSectionFor(section);
  const userId = sec.name === 'A' ? 'offline-u2204001' : 'offline-u2204037';

  return [
    {
      id: `asg-${sec.id}-1`,
      userId,
      courseId: cse345.id,
      title: 'CSE-345: A* Search on 8-Puzzle',
      description:
        'Implement A* search for the 8-puzzle using Manhattan-distance and ' +
        'misplaced-tile heuristics. Compare nodes expanded for 10 random ' +
        'initial states and submit a short analysis.',
      deadline: daysAhead(5),
      priority: 'high',
      status: 'in_progress',
      attachments: null,
      createdAt: daysAgo(3),
      course: { ...cse345 },
      teacher: { ...tAfroza },
    },
    {
      id: `asg-${sec.id}-2`,
      userId,
      courseId: cse355.id,
      title: 'CSE-355: SRS Document (Group)',
      description:
        'Prepare the Software Requirements Specification for your term ' +
        'project following IEEE 830. Include use-case diagrams, functional ' +
        'and non-functional requirements, and a traceability matrix.',
      deadline: daysAhead(10),
      priority: 'high',
      status: 'not_started',
      attachments: null,
      createdAt: daysAgo(1),
      course: { ...cse355 },
      teacher: { ...tKowsar },
    },
    {
      id: `asg-${sec.id}-3`,
      userId,
      courseId: cse347.id,
      title: 'CSE-347: Simplex Method Problem Set',
      description:
        'Solve problems 4.1â€“4.12 using the Big-M and Two-Phase ' +
        'simplex methods. Show tableau iterations for every step.',
      deadline: daysAgo(1),
      priority: 'medium',
      status: 'completed',
      attachments: null,
      createdAt: daysAgo(8),
      course: { ...cse347 },
      teacher: { ...tAnnesha },
    },
    {
      id: `asg-${sec.id}-4`,
      userId,
      courseId: cse311.id,
      title: 'CSE-311: Socket Programming Lab Report',
      description:
        'Build a TCP client-server file transfer program in Python or C. ' +
        'Submit the report with packet captures from Wireshark annotated ' +
        'with handshake, data transfer and teardown phases.',
      deadline: daysAhead(14),
      priority: 'medium',
      status: 'not_started',
      attachments: null,
      createdAt: daysAgo(2),
      course: { ...cse311 },
      teacher: { ...tRashadur },
    },
  ];
}

// ---------------------------------------------------------------------------
// Enriched profile for offline mode
// ---------------------------------------------------------------------------

/** Returns the same profile with full academic bindings attached. */
export function enrichProfile(base, { section = 'A' } = {}) {
  if (!base) return base;
  return {
    ...base,
    department: { ...seedDepartment },
    batch: { ...seedBatch },
    section: { ...seedSectionFor(section) },
    academicSession: { ...seedSession },
  };
}

// ---------------------------------------------------------------------------
// Coordinator offline seed data
// ---------------------------------------------------------------------------

export const coordinatorSections = () => [
  {
    id: 'section-a',
    name: 'A',
    label: 'Section A â€” Room 3403',
    termId: { id: 'term-l3t2', label: 'Level-3 Term-II' },
    studentCount: 42,
    crCount: 1,
  },
  {
    id: 'section-b',
    name: 'B',
    label: 'Section B â€” Room 3305',
    termId: { id: 'term-l3t2', label: 'Level-3 Term-II' },
    studentCount: 40,
    crCount: 1,
  },
];

export const coordinatorStats = () => ({
  totalStudents: 82,
  totalSections: 2,
  totalCRs: 2,
  pendingUpdates: 3,
  pendingOverrides: 1,
});

export const coordinatorAuditLogs = () => [
  {
    id: 'log-1',
    action: 'cr_assigned',
    userName: 'Md. Rashadur Rahman',
    details: 'Nishat assigned as CR for Section B',
    createdAt: isoAgo(2),
  },
  {
    id: 'log-2',
    action: 'update_approved',
    userName: 'Md. Rashadur Rahman',
    details: 'Approved CSE-345 cancellation notice',
    createdAt: isoAgo(5),
  },
  {
    id: 'log-3',
    action: 'student_moved',
    userName: 'Md. Rashadur Rahman',
    details: 'Moved Tanvir Hossain from Section A to Section B',
    createdAt: isoDaysAgo(1),
  },
];

export const coordinatorQuality = () => ({
  summary: { total: 2, high: 0, medium: 2, low: 0, scannedSections: 2 },
  issues: [
    {
      id: 'quality-1',
      severity: 'medium',
      title: 'No CR assigned',
      detail: 'Section B (Batch 2022) has no course representative.',
    },
    {
      id: 'quality-2',
      severity: 'medium',
      title: 'ID-range conflict',
      detail: 'Student-ID ranges overlap between Section A and Section B.',
    },
  ],
});

export const coordinatorExams = () => [
  {
    id: 'exam-1',
    courseId: { id: 'cse-311', code: 'CSE-311', title: 'Computer Networks', credits: 3 },
    sectionId: { id: 'section-a', name: 'A', label: 'Section A' },
    examType: 'CT',
    examDate: isoDaysAhead(5),
    startTime: '09:00',
    endTime: '10:00',
    room: '3403',
  },
  {
    id: 'exam-2',
    courseId: { id: 'cse-345', code: 'CSE-345', title: 'Artificial Intelligence', credits: 3 },
    sectionId: { id: 'section-b', name: 'B', label: 'Section B' },
    examType: 'Midterm',
    examDate: isoDaysAhead(12),
    startTime: '10:00',
    endTime: '12:00',
    room: '3305',
  },
];

export const coordinatorCourses = () => [
  { id: 'cse-300', code: 'CSE-300', title: 'S/W Development Project (Sessional)', credits: 1, instructors: [{ name: 'Sharmistha Chanda Tista' }] },
  { id: 'cse-311', code: 'CSE-311', title: 'Computer Networks', credits: 3, instructors: [{ name: 'Md. Rashadur Rahman' }] },
  { id: 'cse-321', code: 'CSE-321', title: 'Computer Architecture', credits: 3, instructors: [{ name: 'Sharmistha Chanda Tista' }] },
  { id: 'cse-345', code: 'CSE-345', title: 'Artificial Intelligence', credits: 3, instructors: [{ name: 'Afroza Akter' }] },
  { id: 'cse-347', code: 'CSE-347', title: 'Intro to Mathematical Programming', credits: 3, instructors: [{ name: 'Annesha Das' }] },
  { id: 'cse-355', code: 'CSE-355', title: 'Software Engineering', credits: 3, instructors: [{ name: 'Mir Md. Saki Kowsar' }] },
];

const coordinatorStudent = (id, studentId, name, email, sectionId, isCr = false) => ({
  id,
  studentId,
  name,
  email,
  section: {
    id: sectionId,
    name: sectionId === 'section-a' ? 'A' : 'B',
    label: sectionId === 'section-a' ? 'Section A' : 'Section B',
  },
  isCr,
  isActive: true,
});

export function coordinatorStudents({ sectionId = null } = {}) {
  const all = [
    // Section A students
    coordinatorStudent('stu-1', '2204001', 'Ariful Islam', 'u2204001@student.cuet.ac.bd', 'section-a', true),
    coordinatorStudent('stu-2', '2204002', 'Nusrat Jahan', 'u2204002@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-3', '2204003', 'Tanvir Hossain', 'u2204003@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-4', '2204004', 'Fatima Begum', 'u2204004@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-5', '2204005', 'Rafiq Uddin', 'u2204005@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-6', '2204006', 'Sabrina Akter', 'u2204006@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-7', '2204007', 'Kamal Hossain', 'u2204007@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-8', '2204008', 'Sharmin Sultana', 'u2204008@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-9', '2204009', 'Imran Khan', 'u2204009@student.cuet.ac.bd', 'section-a'),
    coordinatorStudent('stu-10', '2204010', 'Taslima Khatun', 'u2204010@student.cuet.ac.bd', 'section-a'),
    // Section B students
    coordinatorStudent('stu-11', '2204037', 'Nishat', 'u2204037@student.cuet.ac.bd', 'section-b', true),
    coordinatorStudent('stu-12', '2204038', 'Mehedi Hasan', 'u2204038@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-13', '2204039', 'Farhana Parveen', 'u2204039@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-14', '2204040', 'Anisur Rahman', 'u2204040@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-15', '2204041', 'Lamia Akter', 'u2204041@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-16', '2204042', 'Jahangir Alam', 'u2204042@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-17', '2204043', 'Nasrin Akhter', 'u2204043@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-18', '2204044', 'Bashir Uddin', 'u2204044@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-19', '2204045', 'Ruma Begum', 'u2204045@student.cuet.ac.bd', 'section-b'),
    coordinatorStudent('stu-20', '2204046', 'Zahurul Haq', 'u2204046@student.cuet.ac.bd', 'section-b'),
  ];
  if (!sectionId) return all;
  return all.filter((s) => s.section?.id === sectionId);
}

export function coordinatorCRs({ sectionId = null } = {}) {
  const all = [
    {
      id: 'cr-1',
      user: { id: 'stu-1', name: 'Ariful Islam', studentId: '2204001' },
      sectionId: 'section-a',
      permissions: { allowedUpdateTypes: ['announcement', 'cancellation', 'room_change'] },
    },
    {
      id: 'cr-2',
      user: { id: 'stu-11', name: 'Nishat', studentId: '2204037' },
      sectionId: 'section-b',
      permissions: { allowedUpdateTypes: ['announcement', 'cancellation', 'room_change'] },
    },
  ];
  if (!sectionId) return all;
  return all.filter((cr) => cr.sectionId === sectionId);
}


// ---------------------------------------------------------------------------
// CR Center offline seed data â€” all declaration types
// ---------------------------------------------------------------------------

export function crDeclarations() {
  return [
    {
      id: 'decl-1',
      type: 'auto_day_off',
      status: 'approved',
      specificDate: isoDaysAgo(3),
      reason: 'University declared holiday for administrative work',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoDaysAgo(3),
    },
    {
      id: 'decl-2',
      type: 'mid_break',
      status: 'approved',
      startDate: isoDaysAhead(20),
      endDate: isoDaysAhead(26),
      reason: 'Mid-semester break as per academic calendar',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoDaysAgo(1),
    },
    {
      id: 'decl-3',
      type: 'mid_break',
      status: 'pending',
      startDate: isoDaysAhead(30),
      endDate: isoDaysAhead(32),
      reason: 'Eid-ul-Adha holiday adjustment',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoAgo(6),
    },
    {
      id: 'decl-4',
      type: 'class_cancellation',
      status: 'approved',
      specificDate: new Date().toISOString(),
      reason: 'CSE-345 professor on official leave',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoAgo(4),
    },
    {
      id: 'decl-5',
      type: 'room_change',
      status: 'approved',
      specificDate: new Date().toISOString(),
      reason: 'Room 3305 unavailable due to maintenance',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoAgo(8),
    },
    {
      id: 'decl-6',
      type: 'extra_class',
      status: 'approved',
      specificDate: isoDaysAhead(1),
      startTime: '16:00',
      endTime: '17:30',
      reason: 'CSE-311 lab makeup session for missed class',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoAgo(12),
    },
    {
      id: 'decl-7',
      type: 'time_change',
      status: 'approved',
      specificDate: new Date().toISOString(),
      reason: 'CSE-355 shifted to 4th period due to committee meeting',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoAgo(10),
    },
  ];
}

// ---------------------------------------------------------------------------
// Review Center offline seed data
// ---------------------------------------------------------------------------

export function reviewUpdates({ status = 'pending' } = {}) {
  const all = [
    {
      id: 'rev-1',
      authorId: 'offline-u2204037',
      sectionId: 'section-b',
      courseId: cse345.id,
      type: 'cancellation',
      title: 'CSE-345 class cancelled today',
      description: 'Artificial Intelligence class cancelled â€” professor on official leave.',
      priority: 'urgent',
      scope: 'section',
      status: 'pending',
      createdAt: hoursAgo(2),
      author: { id: 'offline-u2204037', name: 'Nishat' },
      course: { ...cse345 },
    },
    {
      id: 'rev-2',
      authorId: 'offline-u2204037',
      sectionId: 'section-b',
      courseId: cse311.id,
      type: 'room_change',
      title: 'CSE-311 room changed to 3307',
      description: "Room 3305 under maintenance. Today's Networks class moved to 3307.",
      priority: 'normal',
      scope: 'section',
      status: 'pending',
      createdAt: hoursAgo(5),
      author: { id: 'offline-u2204037', name: 'Nishat' },
      course: { ...cse311 },
    },
    {
      id: 'rev-3',
      authorId: 'offline-u2204037',
      sectionId: 'section-b',
      courseId: cse347.id,
      type: 'announcement',
      title: 'Study materials uploaded for CSE-347',
      description: 'Latest lecture slides and practice problems for Mathematical Programming are now available.',
      priority: 'normal',
      scope: 'section',
      status: 'approved',
      createdAt: daysAgo(1),
      author: { id: 'offline-u2204037', name: 'Nishat' },
      course: { ...cse347 },
    },
    {
      id: 'rev-4',
      authorId: 'offline-u2204037',
      sectionId: 'section-b',
      courseId: cse355.id,
      type: 'time_change',
      title: 'CSE-355 shifted to 4th period Thursday',
      description: 'Software Engineering moved from 2nd to 4th period this Thursday.',
      priority: 'normal',
      scope: 'section',
      status: 'rejected',
      createdAt: daysAgo(2),
      author: { id: 'offline-u2204037', name: 'Nishat' },
      course: { ...cse355 },
    },
    {
      id: 'rev-5',
      authorId: 'offline-u2204001',
      sectionId: 'section-a',
      courseId: cse321.id,
      type: 'announcement',
      title: 'CSE-321 assignment deadline extended',
      description: 'Computer Architecture assignment deadline extended to next Sunday.',
      priority: 'normal',
      scope: 'section',
      status: 'correction_requested',
      createdAt: hoursAgo(8),
      author: { id: 'offline-u2204001', name: 'Ariful Islam' },
      course: { ...cse321 },
    },
  ];
  return all.filter((u) => u.status === status);
}

export function reviewOverrides({ status = 'pending' } = {}) {
  const all = [
    {
      id: 'ovr-1',
      type: 'class_cancellation',
      status: 'pending',
      specificDate: new Date().toISOString(),
      reason: 'CSE-345 professor sick',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoAgo(2),
    },
    {
      id: 'ovr-2',
      type: 'mid_break',
      status: 'pending',
      startDate: isoDaysAhead(30),
      endDate: isoDaysAhead(32),
      reason: 'Eid holiday adjustment request',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoAgo(6),
    },
    {
      id: 'ovr-3',
      type: 'auto_day_off',
      status: 'approved',
      specificDate: isoDaysAgo(3),
      reason: 'University holiday',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoDaysAgo(3),
    },
    {
      id: 'ovr-4',
      type: 'room_change',
      status: 'approved',
      specificDate: isoDaysAgo(1),
      reason: 'Room maintenance',
      sectionId: 'section-b',
      declaredBy: { name: 'Nishat' },
      createdAt: isoDaysAgo(1),
    },
  ];
  return all.filter((o) => o.status === status);
}
