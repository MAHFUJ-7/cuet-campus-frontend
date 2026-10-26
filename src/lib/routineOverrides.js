// Permanent weekly-routine changes made from the CR Center.
//
// The backend treats routine rows as coordinator-owned data, so a CR edit is
// stored locally first and synced best-effort with PUT /routine/:id. The local
// record is keyed by section + routine-entry id and is applied every time the
// weekly routine / calendar is read, which makes the change survive reloads
// and work offline.
import { KEYS, readJson, writeJson } from './storage.js';

const MAX_SECTION_RECORDS = 200;
const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Stable key for a section object or letter. */
export function routineSectionKey(section) {
  if (!section) return 'default';
  if (typeof section === 'string') return section.trim().toUpperCase() || 'default';
  const raw = section.id ?? section.name ?? section.label ?? '';
  return String(raw).trim().toUpperCase() || 'default';
}

function readAll() {
  const all = readJson(KEYS.routineOverrides, {});
  return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
}

export function getSectionRoutineOverrides(section) {
  const all = readAll();
  const records = all[routineSectionKey(section)];
  return records && typeof records === 'object' && !Array.isArray(records) ? records : {};
}

export function getRoutineOverrideList(section) {
  return Object.values(getSectionRoutineOverrides(section))
    .filter(Boolean)
    .sort((a, b) => {
      const aDay = DAY_ORDER.indexOf(String(a.day ?? ''));
      const bDay = DAY_ORDER.indexOf(String(b.day ?? ''));
      if (aDay !== bDay) return (aDay < 0 ? 99 : aDay) - (bDay < 0 ? 99 : bDay);
      return Number(a.period ?? 0) - Number(b.period ?? 0);
    });
}

export function getRoutineOverride(section, entryId) {
  if (!entryId) return null;
  return getSectionRoutineOverrides(section)[String(entryId)] ?? null;
}

/**
 * Persist a permanent change for one routine row. The first edit keeps the
 * original values so the UI can show "original → updated".
 */
export function saveRoutineOverride({
  section,
  entry,
  changes,
  profile = null,
  reason = '',
  synced = false,
}) {
  if (!entry?.id) throw new Error('A routine entry is required');
  const key = routineSectionKey(section);
  const all = readAll();
  const sectionRecords = {
    ...(all[key] && typeof all[key] === 'object' ? all[key] : {}),
  };
  const entryId = String(entry.id);
  const previous = sectionRecords[entryId] ?? null;

  const record = {
    entryId,
    courseCode: entry.course?.code ?? entry.courseCode ?? 'Class',
    courseTitle: entry.course?.title ?? entry.courseTitle ?? '',
    day: changes.day ?? entry.day,
    period: Number(changes.period ?? entry.period ?? 0),
    startTime: changes.startTime ?? entry.startTime,
    endTime: changes.endTime ?? entry.endTime,
    room: changes.room !== undefined ? changes.room || null : entry.room ?? null,
    reason: String(reason ?? '').trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: {
      id: profile?.id ?? '',
      name: profile?.name ?? 'CR',
    },
    synced: Boolean(synced),
    original:
      previous?.original ?? {
        day: entry.day,
        period: Number(entry.period ?? 0),
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room ?? null,
      },
  };

  sectionRecords[entryId] = record;
  all[key] = Object.fromEntries(
    Object.entries(sectionRecords)
      .sort(([, a], [, b]) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0))
      .slice(0, MAX_SECTION_RECORDS)
  );
  writeJson(KEYS.routineOverrides, all);
  return record;
}

export function markRoutineOverrideSynced(section, entryId, synced = true) {
  const key = routineSectionKey(section);
  const all = readAll();
  const records = all[key];
  if (!records || !records[String(entryId)]) return;
  all[key] = {
    ...records,
    [String(entryId)]: { ...records[String(entryId)], synced: Boolean(synced) },
  };
  writeJson(KEYS.routineOverrides, all);
}

export function clearRoutineOverride(section, entryId) {
  const key = routineSectionKey(section);
  const all = readAll();
  const records = all[key];
  if (!records || !records[String(entryId)]) return;
  const next = { ...records };
  delete next[String(entryId)];
  if (Object.keys(next).length === 0) delete all[key];
  else all[key] = next;
  writeJson(KEYS.routineOverrides, all);
}

export function clearSectionRoutineOverrides(section) {
  const all = readAll();
  delete all[routineSectionKey(section)];
  writeJson(KEYS.routineOverrides, all);
}

export function hasRoutineOverrides(section) {
  return Object.keys(getSectionRoutineOverrides(section)).length > 0;
}

/** Apply saved changes to parsed routine / calendar entries. */
export function applyRoutineOverrides(entries, section) {
  if (!Array.isArray(entries) || entries.length === 0) return entries ?? [];
  const records = getSectionRoutineOverrides(section);
  if (Object.keys(records).length === 0) return entries;

  return entries.map((entry) => {
    const change = records[String(entry?.id ?? '')];
    if (!change) return entry;

    const original = entry.original ?? {
      startTime: change.original?.startTime ?? entry.startTime,
      endTime: change.original?.endTime ?? entry.endTime,
      room: change.original?.room ?? entry.room,
    };

    return {
      ...entry,
      day: change.day ?? entry.day,
      period: Number(change.period ?? entry.period ?? 0),
      startTime: change.startTime ?? entry.startTime,
      endTime: change.endTime ?? entry.endTime,
      room: change.room !== undefined ? change.room : entry.room,
      routineOverride: true,
      routineOverrideReason: change.reason || '',
      routineOriginal: change.original ?? null,
      ...(entry.status ? { status: 'updated' } : {}),
      ...(entry.status ? { original } : {}),
    };
  });
}
