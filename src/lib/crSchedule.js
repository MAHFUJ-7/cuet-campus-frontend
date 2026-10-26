// Effective, date-aware schedule overlay for CR declarations.
//
// CR actions are published locally first. This module turns those declaration
// records into the same effects the backend calendar would normally provide:
// day off / mid-break, cancelled classes, room/time changes and extra classes.
// It intentionally reads the local store so every screen works offline.
import { isoDate } from './datetime.js';
import { localFeed } from './localFeed.js';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const CLASS_CHANGE_TYPES = new Set([
  'class_cancellation',
  'room_change',
  'time_change',
  'extra_class',
]);

const normalise = (value) => String(value ?? '').trim().toUpperCase();
const sectionNameToken = (value) =>
  normalise(value).replace(/^SECTION\s+/, '');

const payloadOf = (record) =>
  record?.payload && typeof record.payload === 'object' ? record.payload : {};

const typeOf = (record) => String(record?.type ?? record?.payload?.type ?? '');

const dateToken = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : isoDate(value);
  }
  const raw = String(value).trim();
  const plain = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (plain) return plain[0];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : isoDate(parsed);
};

const recordDate = (record) => {
  const payload = payloadOf(record);
  return dateToken(
    record?.date ??
      record?.specificDate ??
      payload.date ??
      payload.specificDate
  );
};

const recordStartDate = (record) => {
  const payload = payloadOf(record);
  return dateToken(record?.startDate ?? payload.startDate);
};

const recordEndDate = (record) => {
  const payload = payloadOf(record);
  return dateToken(record?.endDate ?? payload.endDate);
};

const isActive = (record) => {
  const status = String(record?.status ?? 'approved').toLowerCase();
  return status === 'approved' || status === 'active';
};

const sectionFor = (sectionOrProfile) => {
  const section = sectionOrProfile?.section ?? sectionOrProfile ?? null;
  return {
    id: normalise(section?.id),
    name: sectionNameToken(section?.name ?? section?.label),
  };
};

const recordSection = (record) => ({
  id: normalise(record?.sectionId ?? record?.section?.id),
  name: sectionNameToken(record?.sectionName ?? record?.section?.name),
});

function sectionMatches(record, target) {
  const own = recordSection(record);
  if (!own.id && !own.name) return false;
  return Boolean(
    (own.id && target.id && own.id === target.id) ||
      (own.name && target.name && own.name === target.name)
  );
}

/**
 * Local declarations for one section, oldest first.
 *
 * Older records did not store the section on the declaration itself. Recover
 * it from the matching local feed post when possible.
 */
export function getSectionDeclarations(sectionOrProfile) {
  const target = sectionFor(sectionOrProfile);
  const posts = new Map(
    localFeed.getLocalUpdates().map((update) => [String(update.id), update])
  );

  return localFeed
    .getLocalOverrides()
    .filter(Boolean)
    .map((record) => {
      if (recordSection(record).id || recordSection(record).name) return record;
      const post = posts.get(String(record.localId ?? record.id ?? ''));
      if (!post) return record;
      return {
        ...record,
        sectionId: post.sectionId ?? '',
        sectionName: post.sectionName ?? '',
      };
    })
    .filter(isActive)
    .filter((record) => sectionMatches(record, target))
    .sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0));
}

export function declarationAppliesOn(record, date) {
  const target = dateToken(date);
  if (!target) return false;
  const type = typeOf(record);

  if (type === 'mid_break') {
    const start = recordStartDate(record);
    const end = recordEndDate(record);
    return Boolean(start && end && target >= start && target <= end);
  }

  return recordDate(record) === target;
}

export function getDeclarationsOnDate(sectionOrProfile, date) {
  return getSectionDeclarations(sectionOrProfile).filter((record) =>
    declarationAppliesOn(record, date)
  );
}

export function declarationDate(record) {
  return recordDate(record);
}

function latest(records) {
  return records.length ? records[records.length - 1] : null;
}

function declarationForBanner(record) {
  if (!record) return null;
  return {
    type: typeOf(record),
    specificDate: recordDate(record),
    startDate: recordStartDate(record),
    endDate: recordEndDate(record),
    reason: String(record.reason ?? record.payload?.reason ?? '') || null,
  };
}

function matchesEntry(record, entry) {
  if (!record || !entry) return false;
  const payload = payloadOf(record);
  const ids = [
    record.routineEntryId,
    payload.routineEntryId,
    ...(Array.isArray(record.routineEntryIds) ? record.routineEntryIds : []),
    ...(Array.isArray(payload.routineEntryIds) ? payload.routineEntryIds : []),
  ]
    .filter(Boolean)
    .map(String);

  if (entry.id && ids.includes(String(entry.id))) return true;

  const code = record.courseCode ?? payload.courseCode;
  const entryCode = entry.course?.code ?? entry.courseId;
  if (!code || !entryCode || String(code) !== String(entryCode)) return false;

  const originalStart = record.originalStartTime ?? payload.originalStartTime;
  if (originalStart && entry.startTime && originalStart !== entry.startTime) {
    return false;
  }
  const originalEnd = record.originalEndTime ?? payload.originalEndTime;
  if (originalEnd && entry.endTime && originalEnd !== entry.endTime) {
    return false;
  }
  const originalRoom = record.originalRoom ?? payload.originalRoom;
  if (originalRoom && entry.room && String(originalRoom) !== String(entry.room)) {
    return false;
  }
  return true;
}

function extraEntry(record) {
  const payload = payloadOf(record);
  const courseCode =
    record.courseCode ?? payload.courseCode ?? record.course?.code ?? 'Class';
  const courseTitle =
    record.courseTitle ?? payload.courseTitle ?? record.course?.title ?? '';
  const courseId = record.courseId ?? payload.courseId ?? record.course?.id ?? '';
  const startTime = record.startTime ?? payload.startTime ?? '';
  const endTime = record.endTime ?? payload.endTime ?? '';
  if (!startTime || !endTime) return null;

  return {
    id: `extra-${record.localId ?? record.id ?? `${courseCode}-${startTime}`}`,
    courseId,
    course: { id: courseId, code: courseCode, title: courseTitle },
    teacher: null,
    teacherId: null,
    day: '',
    period: 0,
    startTime,
    endTime,
    room: record.room ?? payload.room ?? null,
    classType: 'lecture',
    isBreak: false,
    status: 'extra',
    source: 'extra',
    overrideType: 'extra_class',
    overrideReason: String(record.reason ?? payload.reason ?? '') || 'Extra class',
    localDeclarationId: record.localId ?? null,
  };
}

/**
 * Apply every local declaration for a date to a set of class entries.
 *
 * Returns `{ entries, dayStatus, declaration, declarations }`. Day-off and
 * mid-break declarations hide the regular entries; cancelled entries stay in
 * the list (so the UI can show a CANCELLED card) unless `includeCancelled` is
 * false. Extra classes are appended and deduplicated.
 */
export function applyDayDeclarations(
  entries = [],
  {
    section = null,
    date,
    declarations = null,
    includeCancelled = true,
    includeExtras = true,
    baseDayStatus = 'regular',
    baseDeclaration = null,
  } = {}
) {
  const dateIso = dateToken(date);
  const targetSection = sectionFor(section);
  const all = (
    declarations ?? getDeclarationsOnDate(section, dateIso)
  ).filter((record) => {
    if (!targetSection.id && !targetSection.name) return true;
    return sectionMatches(record, targetSection);
  });
  const dayRecord = latest(
    all.filter((record) => {
      const type = typeOf(record);
      return type === 'auto_day_off' || type === 'mid_break';
    })
  );

  if (dayRecord) {
    const type = typeOf(dayRecord);
    return {
      entries: [],
      dayStatus: type === 'mid_break' ? 'mid_break' : 'auto_day_off',
      declaration: declarationForBanner(dayRecord),
      declarations: all,
    };
  }

  const cancellations = all.filter(
    (record) => typeOf(record) === 'class_cancellation'
  );
  const roomChanges = all.filter((record) => typeOf(record) === 'room_change');
  const timeChanges = all.filter((record) => typeOf(record) === 'time_change');

  let effective = (Array.isArray(entries) ? entries : []).map((entry) => {
    const cancellation = latest(
      cancellations.filter((record) => matchesEntry(record, entry))
    );
    if (cancellation) {
      return {
        ...entry,
        status: 'cancelled',
        overrideType: 'class_cancellation',
        overrideReason:
          String(cancellation.reason ?? cancellation.payload?.reason ?? '') ||
          'Class cancelled',
        original: {
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room ?? null,
        },
      };
    }

    const roomChange = latest(
      roomChanges.filter((record) => matchesEntry(record, entry))
    );
    const timeChange = latest(
      timeChanges.filter((record) => matchesEntry(record, entry))
    );
    if (!roomChange && !timeChange) return entry;

    const next = { ...entry, status: 'updated', overrideType: 'room_change' };
    if (roomChange) {
      next.room =
        roomChange.room ?? roomChange.payload?.room ?? entry.room ?? null;
      next.overrideType = 'room_change';
      next.overrideReason =
        String(roomChange.reason ?? roomChange.payload?.reason ?? '') || null;
    }
    if (timeChange) {
      next.overrideType = 'time_change';
      next.startTime =
        timeChange.startTime ?? timeChange.payload?.startTime ?? entry.startTime;
      next.endTime =
        timeChange.endTime ?? timeChange.payload?.endTime ?? entry.endTime;
      next.overrideReason =
        String(timeChange.reason ?? timeChange.payload?.reason ?? '') ||
        next.overrideReason ||
        null;
    }
    next.original = {
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: roomChange ? entry.room ?? null : null,
    };
    return next;
  });

  if (!includeCancelled) {
    effective = effective.filter((entry) => entry.status !== 'cancelled');
  }

  if (includeExtras) {
    const extras = all
      .filter((record) => typeOf(record) === 'extra_class')
      .map(extraEntry)
      .filter(Boolean);

    const seen = new Set(
      effective.map(
        (entry) =>
          `${entry.course?.code ?? entry.courseId}|${entry.startTime}|${entry.endTime}`
      )
    );
    for (const extra of extras) {
      const key = `${extra.course.code}|${extra.startTime}|${extra.endTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const day = entryDayForDate(dateIso);
      effective.push({ ...extra, day });
    }
  }

  effective.sort((a, b) => {
    const aTime = String(a.startTime ?? '');
    const bTime = String(b.startTime ?? '');
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return Number(a.period ?? 0) - Number(b.period ?? 0);
  });

  return {
    entries: effective,
    dayStatus: baseDayStatus || 'regular',
    declaration: baseDeclaration ?? null,
    declarations: all,
  };
}

export function weekdayName(date) {
  const parsed =
    typeof date === 'string' ? new Date(`${String(date).slice(0, 10)}T00:00:00`) : date;
  if (!parsed || Number.isNaN(parsed.getTime())) return '';
  return DAY_NAMES[parsed.getDay()] ?? '';
}

function entryDayForDate(dateIso) {
  return weekdayName(dateIso);
}

/** Next occurrence of a Sunday..Saturday index (today included). */
export function nextDateForWeekdayIndex(dayIndex, now = new Date()) {
  const target = Math.max(0, Math.min(6, Number(dayIndex) || 0));
  const delta = (target - now.getDay() + 7) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
}

/** Month marker overlays for day-off, mid-break and one-off class changes. */
export function getDeclarationMarksForMonth(sectionOrProfile, monthDate) {
  const declarations = getSectionDeclarations(sectionOrProfile);
  const marks = {};
  const add = (key, mark) => {
    marks[key] = marks[key] ?? new Set();
    marks[key].add(mark);
  };

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = isoDate(new Date(year, month, 1));
  const monthEnd = isoDate(new Date(year, month, daysInMonth));

  for (const record of declarations) {
    const type = typeOf(record);
    if (type === 'mid_break') {
      const start = recordStartDate(record) ?? monthStart;
      const end = recordEndDate(record) ?? monthEnd;
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = isoDate(new Date(year, month, day));
        if (key >= start && key <= end) add(key, 'midBreak');
      }
      continue;
    }

    const date = recordDate(record);
    if (!date || date < monthStart || date > monthEnd) continue;
    if (type === 'auto_day_off') add(date, 'autoDayOff');
    else if (CLASS_CHANGE_TYPES.has(type)) add(date, 'classChange');
  }

  return marks;
}
