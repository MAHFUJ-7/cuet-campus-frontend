// Routine helpers shared by the Routine page, Home and CR dialogs.
//
// A lab/sessional is stored as one entry per period (the backend models it the
// same way). For display we collapse consecutive periods of the same block
// into a single item so a 3-period lab reads as one class, matching the
// official routine PDF.

const periodOf = (entry) => Number(entry?.period) || 0;

const sameBlock = (a, b) => {
  if (!a || !b) return false;
  if (a.day !== b.day) return false;
  if (periodOf(b) !== periodOf(a) + 1) return false;
  if (a.courseId !== b.courseId) return false;
  if ((a.room ?? null) !== (b.room ?? null)) return false;
  if ((a.classType ?? 'lecture') !== (b.classType ?? 'lecture')) return false;
  if ((a.status ?? 'scheduled') !== (b.status ?? 'scheduled')) return false;
  if ((a.overrideType ?? null) !== (b.overrideType ?? null)) return false;
  if ((a.teacher?.id ?? a.teacherId ?? null) !== (b.teacher?.id ?? b.teacherId ?? null)) {
    return false;
  }
  return true;
};

/**
 * Groups consecutive periods of the same course/room/teacher.
 * Returns display items with `periodStart`, `periodEnd`, `periodCount`,
 * `startTime` (first period) and `endTime` (last period).
 */
export function groupRoutineEntries(entries = []) {
  const sorted = [...entries].sort((a, b) => {
    const aTime = String(a?.startTime ?? '');
    const bTime = String(b?.startTime ?? '');
    if (aTime && bTime && aTime !== bTime) return aTime.localeCompare(bTime);
    return periodOf(a) - periodOf(b);
  });
  const groups = [];

  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    if (last && sameBlock(last.entries[last.entries.length - 1], entry)) {
      last.entries.push(entry);
      last.periodEnd = periodOf(entry);
      last.endTime = entry.endTime;
      last.periodCount = last.entries.length;
    } else {
      groups.push({
        ...entry,
        periodStart: periodOf(entry),
        periodEnd: periodOf(entry),
        periodCount: 1,
        entries: [entry],
      });
    }
  }

  return groups;
}

/** "P4–P6" or "P3". */
export function periodRangeLabel(item) {
  if (!item) return '';
  const start = item.periodStart ?? periodOf(item);
  const end = item.periodEnd ?? start;
  if (!start) return '';
  return start === end ? `P${start}` : `P${start}–P${end}`;
}
