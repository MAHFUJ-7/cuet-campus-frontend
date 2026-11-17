// CR declaration dialogs — port of the interactive flows in
// cr_center_controller.dart. Each dialog gathers its inputs, shows the same
// structured preview the Flutter app confirms, then publishes local-first.
import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { getCalendarDay, getSections, getWeeklyRoutine, createExam, getExams } from '../../api/endpoints.js';
import { studentRoutine } from '../../data/seedData.js';
import { roomDisplayLabel } from '../../lib/display.js';
import { dayMatches, isoDate } from '../../lib/datetime.js';
import { parseRoutineEntry, parseScheduleEntry, parseSection } from '../../lib/models.js';
import { applyRoutineOverrides } from '../../lib/routineOverrides.js';
import { applyDayDeclarations, weekdayName } from '../../lib/crSchedule.js';
import { groupRoutineEntries } from '../../lib/routine.js';
import { offlineCache } from '../../lib/offlineCache.js';
import { isOfflineSession } from '../../lib/session.js';
import { CrDialog } from './CrShared.jsx';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const INPUT_CLASS =
  'w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-body-md text-ink focus:border-primary focus:outline-none';

const dmyFromIso = (iso) => {
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${Number(d)}/${Number(m)}/${y}`;
};

const tomorrowIso = () => isoDate(new Date(Date.now() + 86_400_000));

function dayNameFor(dateIso) {
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return DAY_LABELS[d.getDay()] ?? null;
}

/**
 * Base entries for a date in one section. Online uses the calendar endpoint,
 * but always falls back to the saved/official weekly routine so CR actions
 * keep working offline.
 */
async function loadEntriesForDate(section, date) {
  const dateIso = isoDate(date);
  let entries = null;

  if (!isOfflineSession()) {
    try {
      const response = await getCalendarDay(dateIso, section?.id ? { sectionId: section.id } : {});
      const payload = extractPayload(response);
      if (Array.isArray(payload?.classes)) {
        entries = payload.classes.map(parseScheduleEntry);
      }
    } catch {
      /* use the saved weekly routine */
    }
  }

  if (!entries) {
    let weekly = [];
    if (isOfflineSession()) {
      weekly = studentRoutine({ section: section?.name ?? 'A' });
    } else {
      try {
        const response = await getWeeklyRoutine(
          section?.id ? { sectionId: section.id } : {}
        );
        const payload = extractPayload(response);
        weekly = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        if (weekly.length > 0) offlineCache.cacheWeeklyRoutine(weekly);
      } catch {
        /* fall through to the cache */
      }
      if (weekly.length === 0) weekly = offlineCache.getCachedWeeklyRoutine() ?? [];
      if (weekly.length === 0) weekly = studentRoutine({ section: section?.name ?? 'A' });
    }

    const parsed = weekly.map(parseRoutineEntry);
    const dayName = weekdayName(dateIso);
    return applyRoutineOverrides(parsed, section).filter((entry) =>
      dayMatches(entry.day, dayName)
    );
  }

  return applyRoutineOverrides(entries, section);
}

/** Effective classes on a date (excludes cancelled); 0 when unavailable. */
export async function countClassesOn(dateIso, section) {
  if (!dayNameFor(dateIso)) return 0;
  try {
    const entries = await loadEntriesForDate(section, dateIso);
    const effective = applyDayDeclarations(entries, {
      section,
      date: dateIso,
      includeCancelled: false,
      includeExtras: true,
    });
    return effective.entries.filter((entry) => entry.course?.code).length;
  } catch {
    return 0;
  }
}

/** Grouped classes for the class-change picker. null while loading. */
function useClassesOnDate(section, date) {
  const [classes, setClasses] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setClasses(null);
    (async () => {
      const entries = await loadEntriesForDate(section, date);
      const effective = applyDayDeclarations(entries, {
        section,
        date,
        includeCancelled: false,
        includeExtras: true,
      });
      const list = groupRoutineEntries(
        effective.entries.filter(
          (entry) => !entry.isBreak && entry.course?.code && entry.status !== 'cancelled'
        )
      ).map((entry) => ({
        id: entry.id,
        routineEntryIds: (entry.entries ?? [entry]).map((item) => item.id).filter(Boolean),
        courseId: entry.course?.id ?? entry.courseId ?? null,
        courseCode: entry.course?.code ?? 'Class',
        courseTitle: entry.course?.title ?? '',
        startTime: entry.startTime,
        endTime: entry.endTime,
        room: entry.room ?? null,
        classType: entry.classType ?? 'lecture',
      }));
      if (!cancelled) setClasses(list);
    })().catch(() => {
      if (!cancelled) setClasses([]);
    });
    return () => {
      cancelled = true;
    };
  }, [date, section?.id, section?.name]);

  return classes;
}

/**
 * Sessional subjects carry an even numeric code (e.g. CSE-352, CSE-324);
 * theory subjects are odd (CSE-345). "Even" means the numeric part of the
 * code — for combined codes the last number decides (CSE-300/CSE-302 → 302).
 */
export function evenCourseCode(code) {
  const match = String(code ?? '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) % 2 === 0 : false;
}

/**
 * Base subject code: strips a trailing group/group-variant suffix so
 * "CSE-346 A1", "CSE-346 A2" and "CSE-356-A" all resolve to their subject
 * code ("CSE-346" / "CSE-356"). Combined codes ("CSE-300/CSE-302") are left
 * intact — they are their own subject.
 */
export function baseCourseCode(code) {
  const raw = String(code ?? '').trim();
  const stripped = raw
    .replace(/\s+[A-Za-z]\d*$/i, '')
    .replace(/-[A-Za-z]\d?$/i, '');
  return stripped || raw;
}

/**
 * Unique courses from one section's weekly routine. null while loading.
 * With `excludeSessional`, courses that are purely lab/sessional (or whose
 * title says "Sessional", or whose numeric code is even — sessional subjects
 * carry an even code, e.g. CSE-352) are dropped — they have no class tests.
 * With `sessionalOnly`, the list is INVERTED: only sessional courses stay
 * (quiz/viva territory).
 */
export function useRoutineCourses(
  section,
  { excludeSessional = false, sessionalOnly = false } = {}
) {
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const collect = (entries) => {
        const seen = new Map();
        for (const entry of entries) {
          const course = entry?.course;
          if (course?.id && course.code !== 'CT' && !seen.has(course.id)) {
            seen.set(course.id, {
              id: course.id,
              code: course.code,
              title: course.title,
            });
          }
        }
        const list = [...seen.values()];
        // One entry per subject: group variants ("CSE-346 A1" / "CSE-346 A2",
        // "CSE-356-A") are the same subject — dedupe by the base subject code
        // so every picker lists each subject exactly once, keyed by its code.
        // The variant whose code IS the base code wins when one exists.
        const byBase = new Map();
        for (const course of list) {
          const base = baseCourseCode(course.code);
          const existing = byBase.get(base);
          if (!existing || (course.code === base && existing.code !== base)) {
            byBase.set(base, { ...course, code: base });
          }
        }
        const deduped = [...byBase.values()];
        if (!excludeSessional && !sessionalOnly) return deduped;
        // A course is sessional when every routine slot it occupies is a
        // lab/sessional block, when its title says so (covers combined
        // codes like "CSE-300/CSE-302" and group variants), or when its
        // numeric code is even — sessional subjects carry an even code
        // (e.g. CSE-352) and are quiz/viva territory.
        const theoryTypes = new Set(['lecture', 'tutorial']);
        const sessionalTypes = new Set(['lab', 'sessional']);
        const theoryIds = new Set(
          entries
            .filter((entry) => theoryTypes.has(String(entry?.classType ?? '').toLowerCase()))
            .map((entry) => entry?.course?.id)
            .filter(Boolean)
        );
        const sessionalIds = new Set(
          entries
            .filter((entry) => sessionalTypes.has(String(entry?.classType ?? '').toLowerCase()))
            .map((entry) => entry?.course?.id)
            .filter(Boolean)
        );
        const isSessional = (course) =>
          /sessional/i.test(String(course.title ?? '')) ||
          evenCourseCode(course.code) ||
          (!theoryIds.has(course.id) && sessionalIds.has(course.id));
        if (sessionalOnly) {
          return deduped.filter((course) => isSessional(course));
        }
        return deduped.filter((course) => {
          // Even-coded subjects are sessional (quiz/viva territory) — they
          // have no class test, even when the routine also shows them as a
          // lecture slot.
          return !isSessional(course);
        });
      };

      if (isOfflineSession()) {
        if (!cancelled) {
          setCourses(collect(applyRoutineOverrides(studentRoutine({ section: section?.name ?? 'A' }), section)));
        }
        return;
      }
      try {
        const response = await getWeeklyRoutine(section?.id ? { sectionId: section.id } : {});
        const payload = extractPayload(response);
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        const entries = applyRoutineOverrides(list.map(parseRoutineEntry), section);
        if (!cancelled) setCourses(collect(entries));
      } catch {
        if (!cancelled) setCourses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section?.id, section?.name]);

  return courses;
}

/**
 * Sections the CR may address: every section of their own batch, own section
 * first. Falls back to just the CR's section offline or without a batch id.
 */
export function useBatchSections(profile) {
  const [sections, setSections] = useState(null);
  const ownSection = profile?.section ?? null;
  const ownId = ownSection?.id ?? '';
  const batchId = profile?.batch?.id ?? '';

  useEffect(() => {
    let cancelled = false;
    const ownList = ownSection
      ? [{
          id: ownSection.id ?? '',
          name: ownSection.name ?? '',
          label:
            ownSection.label ||
            (ownSection.name ? `Section ${ownSection.name}` : 'My section'),
        }]
      : [];
    if (isOfflineSession() || !batchId || !ownId) {
      if (!cancelled) setSections(ownList);
      return undefined;
    }
    (async () => {
      try {
        const response = await getSections({ batchId });
        const payload = extractPayload(response);
        const list = (Array.isArray(payload) ? payload : payload?.items ?? [])
          .map(parseSection)
          .filter(Boolean)
          .map((s) => ({ id: s.id, name: s.name, label: s.label || `Section ${s.name}` }));
        const ordered = [
          ...list.filter((s) => s.id === ownId),
          ...list.filter((s) => s.id !== ownId),
        ];
        if (!cancelled) setSections(ordered.length > 0 ? ordered : ownList);
      } catch {
        if (!cancelled) setSections(ownList);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownId, batchId]);

  return sections;
}

export function resolveTargetSection(batchSections, sectionId, profile) {
  const picked = batchSections?.find((s) => (s.id || s.name) === sectionId);
  if (picked) return picked;
  const own = profile?.section;
  if (!own) return null;
  return {
    id: own.id ?? '',
    name: own.name ?? '',
    label: own.label || (own.name ? `Section ${own.name}` : 'My section'),
  };
}

/** Section chooser shown whenever the CR's batch has more than one section. */
function SectionPicker({ sections, value, onChange }) {
  if (!sections || sections.length <= 1) return null;
  return (
    <Field label="For section">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      >
        {sections.map((s) => (
          <option key={s.id || s.name} value={s.id || s.name}>
            {s.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// The routine no longer carries a fixed CT slot — every CT is declared by a
// CR with its own explicit times, so the dialog always asks for them.

// ---------------------------------------------------------------------------
// Shared dialog shell with structured preview
// ---------------------------------------------------------------------------

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-label-md font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function PreviewBox({ details }) {
  if (!Array.isArray(details) || details.length === 0) return null;
  return (
    <div className="rounded-2xl bg-surface-variant/70 p-4">
      {details.map((row) => (
        <div key={row.label} className="flex items-start gap-3 py-0.5">
          <span className="w-[110px] shrink-0 text-label-md text-ink-muted">{row.label}</span>
          <span className="min-w-0 flex-1 whitespace-pre-line text-body-md font-semibold text-ink">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CrFormDialog({
  open,
  onClose,
  icon,
  tone,
  title,
  details,
  warning,
  busy,
  confirmDisabled = false,
  confirmLabel = 'Confirm',
  onConfirm,
  children,
}) {
  return (
    <CrDialog open={open} onClose={busy ? () => {} : onClose}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone.bg}`}>
          <Icon name={icon} size={22} className={tone.text} />
        </span>
        <p className="text-title-lg font-extrabold text-ink">{title}</p>
      </div>

      <div className="mt-4 space-y-3">{children}</div>

      <div className="mt-4">
        <PreviewBox details={details} />
      </div>

      {warning && <p className="mt-3 text-label-md text-warning">{warning}</p>}

      <div className="mt-5 flex gap-3">
        <Button variant="outlined" className="flex-1" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="filled"
          className="flex-1"
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
        >
          {busy ? <Spinner size={16} /> : <Icon name="check" size={18} />}
          <span>{confirmLabel}</span>
        </Button>
      </div>
    </CrDialog>
  );
}

// ---------------------------------------------------------------------------
// 1. Declare Auto / Day Off
// ---------------------------------------------------------------------------

/**
 * Existing day-level declaration that already covers `date` (day off,
 * mid-break or DL). Reads both server declarations and unsynced local ones
 * so the dialog can warn BEFORE the server rejects the request.
 */
export function localDayConflict(declarations, localOverrides, date) {
  if (!date) return null;
  const all = [...(declarations ?? []), ...(localOverrides ?? [])];
  for (const item of all) {
    const type = item?.type ?? item?.payload?.type;
    const status = item?.status ?? item?.payload?.status ?? 'approved';
    if (!['auto_day_off', 'mid_break', 'classes_end'].includes(type)) continue;
    if (status === 'rejected' || status === 'withdrawn') continue;
    if (type === 'auto_day_off') {
      const d = item.specificDate ?? item.payload?.date;
      if (d === date) {
        return `A day off is already declared for ${dmyFromIso(date)} — withdraw it from the declarations list before declaring again`;
      }
    } else if (type === 'mid_break') {
      const s = item.startDate ?? item.payload?.startDate;
      const e = item.endDate ?? item.payload?.endDate;
      if (s && e && date >= s && date <= e) {
        return `Mid-break (${dmyFromIso(s)} → ${dmyFromIso(e)}) already covers this date`;
      }
    } else if (type === 'classes_end') {
      const s = item.startDate ?? item.payload?.startDate;
      if (s && date >= s) {
        return `DL has already started (${dmyFromIso(s)}) — classes are over`;
      }
    }
  }
  return null;
}

export function DeclareAutoDialog({ open, onClose, controller, profile }) {
  const toast = useToast();
  const [date, setDate] = useState(tomorrowIso);
  const [reason, setReason] = useState('');
  const [affected, setAffected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(tomorrowIso());
    setReason('');
    setAffected(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setAffected(null);
    countClassesOn(date, profile?.section).then((count) => {
      if (!cancelled) setAffected(count);
    });
    return () => {
      cancelled = true;
    };
  }, [open, date, profile?.section?.id]);

  // The day is already class-free (day off / mid-break / DL) — block the
  // declaration inline instead of letting the server reject it.
  const dayConflict = useMemo(
    () => localDayConflict(controller.declarations, controller.localOverrides, date),
    [controller.declarations, controller.localOverrides, date]
  );

  const confirm = async () => {
    if (dayConflict) return;
    setBusy(true);
    try {
      const feedback = await controller.submitOverride(
        { type: 'auto_day_off', date, reason },
        `Auto declared for ${dmyFromIso(date)}`
      );
      toast.success(feedback);
      onClose();
    } catch (error) {
      toast.error(`Failed to declare day off: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrFormDialog
      open={open}
      onClose={onClose}
      icon="event_busy"
      tone={{ bg: 'bg-critical/15', text: 'text-critical' }}
      title="Declare Auto / Day Off"
      busy={busy}
      onConfirm={confirm}
      confirmDisabled={Boolean(dayConflict)}
      details={[
        { label: 'Date', value: dmyFromIso(date) },
        { label: 'Scope', value: 'All sections in your batch' },
        { label: 'Classes hidden', value: affected == null ? '…' : `Both sections · ${affected} each` },
        { label: 'Reason', value: reason || '\u2014' },
      ]}
      warning="This day off applies to every section in your batch. The official routine is preserved."
    >
      <Field label="Date">
        <input
          type="date"
          value={date}
          min={isoDate(new Date())}
          onChange={(e) => setDate(e.target.value || tomorrowIso())}
          className={INPUT_CLASS}
        />
      </Field>
      {dayConflict && (
        <div className="flex items-start gap-2 rounded-xl bg-critical/10 px-3 py-2 text-label-sm text-critical">
          <Icon name="info" size={15} className="mt-0.5 shrink-0" />
          <p>{dayConflict}</p>
        </div>
      )}
      <TextField
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="Why is the day off declared?"
        multiline
        rows={2}
      />
    </CrFormDialog>
  );
}

// ---------------------------------------------------------------------------
// 2. Declare Mid-Break
// ---------------------------------------------------------------------------

export function DeclareMidBreakDialog({ open, onClose, controller, profile }) {
  const toast = useToast();
  const [startDate, setStartDate] = useState(tomorrowIso);
  const [endDate, setEndDate] = useState(() => isoDate(new Date(Date.now() + 6 * 86_400_000)));
  const [reason, setReason] = useState('');
  const [affected, setAffected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate(tomorrowIso());
    setEndDate(isoDate(new Date(Date.now() + 6 * 86_400_000)));
    setReason('');
    setAffected(null);
    setBusy(false);
  }, [open]);

  const days = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    return Math.floor((end - start) / 86_400_000) + 1;
  }, [startDate, endDate]);

  useEffect(() => {
    if (!open || days == null) return undefined;
    let cancelled = false;
    setAffected(null);
    (async () => {
      // Count every day in parallel — serial awaits made long breaks crawl.
      const start = new Date(`${startDate}T00:00:00`);
      const dates = Array.from({ length: days }, (_, i) => {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        return isoDate(day);
      });
      const counts = await Promise.all(
        dates.map((dayIso) => countClassesOn(dayIso, profile?.section))
      );
      if (!cancelled) setAffected(counts.reduce((sum, count) => sum + count, 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, startDate, days, profile?.section?.id]);

  const confirm = async () => {
    if (days == null) return;
    setBusy(true);
    try {
      const feedback = await controller.submitOverride(
        { type: 'mid_break', startDate, endDate, reason },
        `Mid-break ${dmyFromIso(startDate)} \u2192 ${dmyFromIso(endDate)}`
      );
      toast.success(feedback);
      onClose();
    } catch (error) {
      toast.error(`Failed to declare mid-break: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrFormDialog
      open={open}
      onClose={onClose}
      icon="beach_access"
      tone={{ bg: 'bg-warning/15', text: 'text-warning' }}
      title="Declare Mid-Break"
      busy={busy}
      confirmDisabled={days == null}
      onConfirm={confirm}
      details={[
        { label: 'From', value: dmyFromIso(startDate) },
        { label: 'To', value: dmyFromIso(endDate) },
        { label: 'Duration', value: days == null ? '—' : `${days} day(s)` },
        { label: 'Scope', value: 'All sections in your batch' },
        { label: 'Classes hidden', value: affected == null ? '…' : `Both sections · ${affected} each` },
        { label: 'Reason', value: reason || '—' },
      ]}
      warning="This mid-break applies to every section in your batch. The official routine is preserved."
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <input
            type="date"
            value={startDate}
            min={isoDate(new Date())}
            onChange={(e) => {
              const next = e.target.value || tomorrowIso();
              setStartDate(next);
              // Keep the range valid when the start moves past the end.
              setEndDate((current) => (current < next ? next : current));
            }}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value || startDate)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      {days == null && (
        <p className="text-label-md text-critical">End date must be on or after the start date.</p>
      )}
      <TextField
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="Why is the break declared?"
        multiline
        rows={2}
      />
    </CrFormDialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Class changes (cancel / room / time)
// ---------------------------------------------------------------------------

const CHANGE_META = {
  class_cancellation: {
    title: 'Cancel Class',
    icon: 'cancel_schedule_send',
    tone: { bg: 'bg-cancellation/15', text: 'text-cancellation' },
    warning: 'Students will see the class marked CANCELLED — the routine entry is preserved.',
  },
  room_change: {
    title: 'Change Room',
    icon: 'meeting_room',
    tone: { bg: 'bg-room-change/15', text: 'text-room-change' },
    warning: 'Students will see ORIGINAL → UPDATED values on their calendar.',
  },
  time_change: {
    title: 'Change Time',
    icon: 'schedule',
    tone: { bg: 'bg-accent/15', text: 'text-accent' },
    warning: 'Students will see ORIGINAL → UPDATED values on their calendar.',
  },
};

export function ClassChangeDialog({ open, changeType, onClose, controller, profile }) {
  const toast = useToast();
  const today = isoDate(new Date());
  const batchSections = useBatchSections(profile);
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(today);

  // Default to the CR's own section; the picker only appears when the batch
  // has more than one section.
  useEffect(() => {
    if (!batchSections || sectionId) return;
    const ownId = profile?.section?.id ?? '';
    const initial =
      batchSections.find((s) => s.id === ownId)?.id ?? batchSections[0]?.id ?? '';
    setSectionId(initial);
  }, [batchSections, sectionId, profile?.section?.id]);

  const targetSection = resolveTargetSection(batchSections, sectionId, profile);
  const classes = useClassesOnDate(targetSection, date);
  const [selectedId, setSelectedId] = useState(null);
  const [room, setRoom] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(isoDate(new Date()));
    setReason('');
    setBusy(false);
    setSelectedId(null);
    setSectionId('');
  }, [open]);

  useEffect(() => {
    if (!classes || classes.length === 0) return;
    setSelectedId((current) =>
      current && classes.some((c) => c.id === current) ? current : classes[0].id
    );
  }, [classes]);

  const selected = classes?.find((c) => c.id === selectedId) ?? null;

  // Reset dependent inputs when the picked class changes.
  useEffect(() => {
    if (!open || !selected) return;
    if (changeType === 'room_change') setRoom(selected.room ?? '');
    if (changeType === 'time_change') {
      setStartTime(selected.startTime);
      setEndTime(selected.endTime);
    }
  }, [open, changeType, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = CHANGE_META[changeType] ?? CHANGE_META.class_cancellation;

  const roomValid = Boolean(room.trim()) && room.trim() !== (selected?.room ?? '');
  const timeValid = Boolean(startTime && endTime && startTime < endTime);
  const timeChanged =
    Boolean(selected) && (startTime !== selected.startTime || endTime !== selected.endTime);
  const confirmDisabled =
    !selected ||
    (changeType === 'room_change' && !roomValid) ||
    (changeType === 'time_change' && (!timeValid || !timeChanged));

  const confirm = async () => {
    if (!selected || confirmDisabled) return;
    setBusy(true);
    try {
      const payload = {
        type: changeType,
        date,
        sectionId: targetSection?.id ?? '',
        sectionName: targetSection?.name ?? '',
        routineEntryId: selected.id,
        routineEntryIds: selected.routineEntryIds,
        courseId: selected.courseId,
        courseCode: selected.courseCode,
        courseTitle: selected.courseTitle,
        originalStartTime: selected.startTime,
        originalEndTime: selected.endTime,
        originalRoom: selected.room,
        ...(changeType === 'room_change' ? { room: room.trim() } : {}),
        ...(changeType === 'time_change' ? { startTime, endTime } : {}),
        reason,
      };
      const feedback = await controller.submitOverride(
        payload,
        `${selected.courseCode} on ${dmyFromIso(date)} updated`
      );
      toast.success(feedback);
      onClose();
    } catch (error) {
      toast.error(`Failed: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  const details = [
    { label: 'Course', value: selected?.courseCode ?? '—' },
    { label: 'Date', value: dmyFromIso(date) },
    { label: 'Section', value: targetSection?.label ?? '—' },
    ...(changeType === 'room_change'
      ? [
          { label: 'Original room', value: selected?.room ?? '—' },
          { label: 'New room', value: room.trim() || '—' },
        ]
      : []),
    ...(changeType === 'time_change'
      ? [
          {
            label: 'Original time',
            value: selected ? `${selected.startTime} \u2013 ${selected.endTime}` : '—',
          },
          { label: 'New time', value: `${startTime} \u2013 ${endTime}` },
        ]
      : []),
    { label: 'Reason', value: reason || '\u2014' },
  ];

  return (
    <CrFormDialog
      open={open}
      onClose={onClose}
      icon={meta.icon}
      tone={meta.tone}
      title={meta.title}
      busy={busy}
      confirmDisabled={confirmDisabled}
      onConfirm={confirm}
      details={details}
      warning={meta.warning}
    >
      <Field label="Date">
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value || today)}
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={() => setDate(isoDate(new Date()))}
            className={`shrink-0 rounded-xl border px-3 text-label-md font-semibold transition ${
              date === today
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline text-ink-muted hover:border-primary/40'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              setDate(isoDate(d));
            }}
            className={`shrink-0 rounded-xl border px-3 text-label-md font-semibold transition ${
              date === tomorrowIso()
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-outline text-ink-muted hover:border-primary/40'
            }`}
          >
            Tomorrow
          </button>
        </div>
      </Field>

      <SectionPicker sections={batchSections} value={sectionId} onChange={setSectionId} />

      {classes == null ? (
        <div className="flex justify-center py-4">
          <Spinner size={24} />
        </div>
      ) : classes.length === 0 ? (
        <p className="text-body-md text-ink-muted">
          No classes scheduled on {dmyFromIso(date)}.
        </p>
      ) : (
        <>
          <Field label={`Class on ${dmyFromIso(date)}`}>
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className={INPUT_CLASS}
            >
              {classes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.courseCode} · {entry.startTime}–{entry.endTime}
                  {entry.room ? ` · ${roomDisplayLabel(entry.room)}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {changeType === 'room_change' && (
            <Field label="New room">
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. 3205"
                className={INPUT_CLASS}
              />
            </Field>
          )}

          {changeType === 'time_change' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="New start time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="New end time">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          )}
        </>
      )}

      <TextField
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="Why is this changing?"
        multiline
        rows={2}
      />
    </CrFormDialog>
  );
}

// ---------------------------------------------------------------------------
// 4. Extra class
// ---------------------------------------------------------------------------

export function ExtraClassDialog({ open, onClose, controller, profile }) {
  const toast = useToast();
  const batchSections = useBatchSections(profile);
  const [sectionId, setSectionId] = useState('');

  useEffect(() => {
    if (!batchSections || sectionId) return;
    const ownId = profile?.section?.id ?? '';
    const initial =
      batchSections.find((s) => s.id === ownId)?.id ?? batchSections[0]?.id ?? '';
    setSectionId(initial);
  }, [batchSections, sectionId, profile?.section?.id]);

  const targetSection = resolveTargetSection(batchSections, sectionId, profile);
  const courses = useRoutineCourses(targetSection);
  const [courseId, setCourseId] = useState(null);
  const [date, setDate] = useState(tomorrowIso);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:30');
  const [room, setRoom] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(tomorrowIso());
    setStartTime('16:00');
    setEndTime('17:30');
    setRoom('');
    setReason('');
    setBusy(false);
    setSectionId('');
  }, [open]);

  useEffect(() => {
    if (!courses || courses.length === 0) return;
    setCourseId((current) =>
      current && courses.some((c) => c.id === current) ? current : courses[0].id
    );
  }, [courses]);

  const course = courses?.find((c) => c.id === courseId) ?? null;
  const timeValid = Boolean(startTime && endTime && startTime < endTime);
  // A class can't be scheduled on a day that is already class-free.
  const dayConflict = useMemo(
    () => localDayConflict(controller.declarations, controller.localOverrides, date),
    [controller.declarations, controller.localOverrides, date]
  );

  const confirm = async () => {
    if (!course || !timeValid || dayConflict) return;
    setBusy(true);
    try {
      const feedback = await controller.submitOverride(
        {
          type: 'extra_class',
          date,
          sectionId: targetSection?.id ?? '',
          sectionName: targetSection?.name ?? '',
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          startTime,
          endTime,
          ...(room.trim() ? { room: room.trim() } : {}),
          reason,
        },
        `Extra ${course.code} class on ${dmyFromIso(date)}`
      );
      toast.success(feedback);
      onClose();
    } catch (error) {
      toast.error(`Failed to schedule extra class: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrFormDialog
      open={open}
      onClose={onClose}
      icon="add_circle"
      tone={{ bg: 'bg-success/15', text: 'text-success' }}
      title="Schedule Extra Class"
      busy={busy}
      confirmDisabled={!course || !timeValid || Boolean(dayConflict)}
      onConfirm={confirm}
      details={[
        { label: 'Course', value: course ? `${course.code} \u2014 ${course.title}` : '—' },
        { label: 'Date', value: dmyFromIso(date) },
        { label: 'Section', value: targetSection?.label ?? '—' },
        { label: 'Time', value: `${startTime} \u2013 ${endTime}` },
        ...(room.trim() ? [{ label: 'Room', value: room.trim() }] : []),
        { label: 'Note', value: reason || '\u2014' },
      ]}
      warning="Extra classes are clearly badged EXTRA on the chosen section's calendar, separate from the official routine. Other sections are not affected."
    >
      <SectionPicker sections={batchSections} value={sectionId} onChange={setSectionId} />

      {courses == null ? (
        <div className="flex justify-center py-4">
          <Spinner size={24} />
        </div>
      ) : courses.length === 0 ? (
        <p className="text-body-md text-ink-muted">No courses found in your routine yet.</p>
      ) : (
        <Field label="Course">
          <select
            value={courseId ?? ''}
            onChange={(e) => setCourseId(e.target.value)}
            className={INPUT_CLASS}
          >
            {courses.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.code} — {entry.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Date">
          <input
            type="date"
            value={date}
            min={isoDate(new Date())}
            onChange={(e) => setDate(e.target.value || tomorrowIso())}
            className={INPUT_CLASS}
          />
        </Field>
        {dayConflict && (
          <div className="flex items-start gap-2 rounded-xl bg-critical/10 px-3 py-2 text-label-sm text-critical">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            <p>{dayConflict}</p>
          </div>
        )}
        <Field label="Start">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="End">
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      {!timeValid && (
        <p className="text-label-md text-critical">End time must be after the start time.</p>
      )}

      <Field label="Room (optional)">
        <input
          type="text"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Leave blank if not decided"
          className={INPUT_CLASS}
        />
      </Field>

      <TextField
        label="Topic / reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="e.g. makeup class for the cancelled lecture"
        multiline
        rows={2}
      />
    </CrFormDialog>
  );
}

// ---------------------------------------------------------------------------
// 5. Declare assessments — CT / Quiz / Viva (all batch-wide, theory only)
// ---------------------------------------------------------------------------

const ASSESSMENT_META = {
  ct: {
    label: 'CT',
    title: 'Declare Class Test (CT)',
    icon: 'quiz',
    tone: { bg: 'bg-info/15', text: 'text-info' },
    reasonHint: 'e.g. CT-2 · Chapters 4–6',
    reasonLabel: 'Syllabus / note (optional)',
  },
  quiz: {
    label: 'Quiz',
    title: 'Declare Quiz',
    icon: 'fact_check',
    tone: { bg: 'bg-info/15', text: 'text-info' },
    reasonHint: 'e.g. Quiz-1 · Chapters 1–3',
    reasonLabel: 'Topic / note (optional)',
  },
  viva: {
    label: 'Viva',
    title: 'Declare Viva',
    icon: 'co_present',
    tone: { bg: 'bg-info/15', text: 'text-info' },
    reasonHint: 'e.g. Viva on lab project · groups 1–6',
    reasonLabel: 'Details / note (optional)',
  },
};

export function DeclareCtDialog({ open, onClose, controller, profile, assessmentKind = 'ct' }) {
  const toast = useToast();
  const meta = ASSESSMENT_META[assessmentKind] ?? ASSESSMENT_META.ct;
  // CT runs on theory (odd-coded) subjects; quiz and viva are sessional
  // territory — sessional subjects carry an even numeric code (e.g. CSE-352).
  const courses = useRoutineCourses(
    profile?.section,
    assessmentKind === 'ct'
      ? { excludeSessional: true }
      : { sessionalOnly: true }
  );
  const [courseId, setCourseId] = useState(null);
  const [date, setDate] = useState(tomorrowIso);
  const [startTime, setStartTime] = useState('08:10');
  const [endTime, setEndTime] = useState('09:00');
  const [room, setRoom] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(tomorrowIso());
    setStartTime('08:10');
    setEndTime('09:00');
    setRoom('');
    setReason('');
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!courses || courses.length === 0) return;
    setCourseId((current) =>
      current && courses.some((c) => c.id === current) ? current : courses[0].id
    );
  }, [courses]);

  const course = courses?.find((c) => c.id === courseId) ?? null;
  const timeValid = Boolean(startTime && endTime && startTime < endTime);
  const timeLabel = `${startTime} \u2013 ${endTime}`;

  const confirm = async () => {
    if (!course) return;
    setBusy(true);
    try {
      const feedback = await controller.submitOverride(
        {
          type: 'extra_class',
          classType: 'ct',
          date,
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          startTime,
          endTime,
          ...(room.trim() ? { room: room.trim() } : {}),
          reason: reason.trim() ? `${meta.label} — ${reason.trim()}` : meta.label,
        },
        `${course.code} ${meta.label} on ${dmyFromIso(date)}`
      );
      toast.success(feedback);
      onClose();
    } catch (error) {
      toast.error(`Failed to declare ${meta.label}: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrFormDialog
      open={open}
      onClose={onClose}
      icon={meta.icon}
      tone={meta.tone}
      title={meta.title}
      busy={busy}
      confirmDisabled={!course || !timeValid}
      onConfirm={confirm}
      details={[
        { label: 'Course', value: course ? `${course.code} \u2014 ${course.title}` : '—' },
        { label: 'Date', value: dmyFromIso(date) },
        { label: 'Time', value: timeLabel },
        ...(room.trim() ? [{ label: 'Room', value: room.trim() }] : []),
        { label: 'Note', value: reason || '\u2014' },
      ]}
      warning={`Declared for the whole batch — the ${meta.label} appears on every section's calendar right away. You can reschedule or cancel it from here later.`}
    >
      {courses == null ? (
        <div className="flex justify-center py-4">
          <Spinner size={24} />
        </div>
      ) : courses.length === 0 ? (
        <p className="text-body-md text-ink-muted">
          {assessmentKind === 'ct'
            ? 'No courses found in your routine yet.'
            : 'No sessional subjects found in your routine yet.'}
        </p>
      ) : (
        <Field label={assessmentKind === 'ct' ? 'Course' : 'Sessional course'}>
          <select
            value={courseId ?? ''}
            onChange={(e) => setCourseId(e.target.value)}
            className={INPUT_CLASS}
          >
            {courses.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.code} — {entry.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <p className="text-label-sm text-ink-muted">
        {assessmentKind === 'ct'
          ? 'Sessional/lab courses are not listed — CT applies to theory courses only.'
          : 'Only sessional subjects are listed — quiz/viva apply to sessional courses (even-numbered codes).'}
      </p>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Date">
          <input
            type="date"
            value={date}
            min={isoDate(new Date())}
            onChange={(e) => setDate(e.target.value || tomorrowIso())}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Start">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="End">
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field label="Room (optional)">
        <input
          type="text"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Leave blank if not decided"
          className={INPUT_CLASS}
        />
      </Field>

      <TextField
        label={meta.reasonLabel}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint={meta.reasonHint}
        multiline
        rows={2}
      />
    </CrFormDialog>
  );
}


// ---------------------------------------------------------------------------
// 6. Declare Final Exam — CR request, published after coordinator approval
// ---------------------------------------------------------------------------

const EXAM_MIN_DAYS = 7;

const examMinDate = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + EXAM_MIN_DAYS);
  return isoDate(d);
};


// ---------------------------------------------------------------------------
// 7. Term wrap-up — end of regular classes (DL) and the full exam routine
// ---------------------------------------------------------------------------

export function WrapUpDialog({ open, onClose, controller }) {
  const toast = useToast();
  const [classesEndDate, setClassesEndDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClassesEndDate('');
    setBusy(false);
  }, [open]);

  const declare = async () => {
    if (!classesEndDate) return;
    setBusy(true);
    try {
      // Replace any previous DL declaration so only one is live.
      const stale = [
        ...(controller.declarations ?? []),
        ...(controller.localOverrides ?? []),
      ].filter((item) => (item.type ?? item.payload?.type) === 'classes_end');
      for (const item of stale) {
        // eslint-disable-next-line no-await-in-loop
        if (item.localId && !item.id) await controller.withdrawLocal(item.localId);
        // eslint-disable-next-line no-await-in-loop
        else if (item.id) await controller.withdraw(item);
      }

      const feedback = await controller.submitOverride(
        {
          type: 'classes_end',
          date: classesEndDate,
          startDate: classesEndDate,
          endDate: null,
          reason: `DL starts from ${dmyFromIso(classesEndDate)} — exam preparation leave`,
        },
        `DL starts from ${dmyFromIso(classesEndDate)}`
      );
      toast.success(feedback);
      onClose();
    } catch (error) {
      toast.error(`Failed to declare: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrFormDialog
      open={open}
      onClose={onClose}
      icon="event_busy"
      tone={{ bg: 'bg-safety/15', text: 'text-safety' }}
      title="Declare DL — End of Classes"
      busy={busy}
      confirmLabel="Start DL"
      onConfirm={declare}
      confirmDisabled={!classesEndDate}
    >
      <p className="text-label-sm text-ink-muted">
        From this date onward regular classes stop and everyone starts their
        DL (duration leave) for exam preparation. Applies to the whole batch.
      </p>

      <Field label="Classes end / DL starts from">
        <input
          type="date"
          value={classesEndDate}
          min={isoDate(new Date())}
          onChange={(e) => setClassesEndDate(e.target.value)}
          className={INPUT_CLASS}
        />
      </Field>
    </CrFormDialog>
  );
}

// ---------------------------------------------------------------------------
// 8. Full exam routine — CR schedules EVERY theory subject (7-day gap between
// exams) and submits the complete routine; each exam stays pending until the
// coordinator approves it.
// ---------------------------------------------------------------------------

/** Weekday label for an ISO date (local to this dialog's rows). */
const weekdayFromIsoLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { weekday: 'short' });
};

export function ExamRoutineBuilderDialog({ open, onClose, profile }) {
  const toast = useToast();
  const sectionId = profile?.section?.id ?? '';
  // Theory courses only — sessionals have no final exam sitting.
  const courses = useRoutineCourses(profile?.section, { excludeSessional: true });
  const minDate = examMinDate();

  const [rows, setRows] = useState([]);
  const [courseId, setCourseId] = useState(null);
  const [date, setDate] = useState(minDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [room, setRoom] = useState('');
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadExisting = async () => {
    if (!sectionId) {
      setExisting([]);
      return;
    }
    try {
      const response = await getExams({ type: 'final', limit: 100 });
      const payload = extractPayload(response);
      const items = Array.isArray(payload) ? payload : payload?.items ?? [];
      setExisting(
        items.filter(
          (e) =>
            String(e.sectionId?._id ?? e.sectionId?.id ?? e.sectionId ?? '') ===
              String(sectionId) && e.status !== 'rejected'
        )
      );
    } catch {
      setExisting([]);
    }
  };

  useEffect(() => {
    if (!open) return;
    setRows([]);
    setDate(examMinDate());
    setStartTime('09:00');
    setEndTime('11:00');
    setRoom('');
    setBusy(false);
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sectionId]);

  useEffect(() => {
    if (!courses || courses.length === 0) return;
    setCourseId((current) =>
      current && courses.some((c) => c.id === current) ? current : courses[0].id
    );
  }, [courses]);

  const course = courses?.find((c) => c.id === courseId) ?? null;
  const timeValid = Boolean(startTime && endTime && startTime < endTime);
  const dateValid = Boolean(date && date >= minDate);

  // Academic rule: two final exams must be at least 7 days apart
  // (e.g. one on the 14th, the next on the 21st or later).
  const gapClash = useMemo(() => {
    if (!dateValid) return null;
    const others = [
      ...rows.map((r) => ({ date: r.date, code: r.courseCode })),
      ...(existing ?? []).map((e) => ({
        date: e.examDate,
        code: e.courseId?.code ?? e.course?.code ?? 'another exam',
      })),
    ];
    const target = new Date(`${date}T12:00:00`).getTime();
    for (const other of others) {
      const diff = Math.abs(
        (new Date(`${other.date}T12:00:00`).getTime() - target) / 86400000
      );
      if (diff < EXAM_MIN_DAYS) return { code: other.code, date: other.date };
    }
    return null;
  }, [date, rows, existing, dateValid]);

  const duplicate =
    rows.some((r) => r.courseId === courseId) ||
    (existing ?? []).some(
      (e) =>
        String(e.courseId?._id ?? e.courseId ?? e.course?.id ?? '') ===
          String(courseId ?? '') && e.examDate === date
    );

  const addRow = () => {
    if (!course || !timeValid || !dateValid || duplicate || gapClash) return;
    setRows((current) => [
      ...current,
      {
        key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        date,
        startTime,
        endTime,
        room: room.trim(),
      },
    ]);
    setRoom('');
  };

  const removeRow = (key) => setRows((current) => current.filter((r) => r.key !== key));

  // Completeness: the routine can only be submitted once EVERY theory
  // subject has an exam in the queue.
  const totalCourses = courses?.length ?? 0;
  const coveredCount = courses
    ? courses.filter((c) => rows.some((r) => r.courseId === c.id)).length
    : 0;
  const missingCourses = courses
    ? courses.filter((c) => !rows.some((r) => r.courseId === c.id))
    : [];
  const complete = totalCourses > 0 && coveredCount === totalCourses;

  const submit = async () => {
    if (!complete || rows.length === 0) return;
    setBusy(true);
    try {
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        await createExam({
          sectionId,
          courseId: row.courseId,
          examType: 'final',
          examDate: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          ...(row.room ? { room: row.room } : {}),
        });
      }
      toast.success(
        `Full exam routine submitted — ${rows.length} exam${rows.length === 1 ? '' : 's'} waiting for coordinator approval`
      );
      setRows([]);
      onClose();
    } catch (error) {
      toast.error(`Failed to submit: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrDialog open={open} onClose={busy ? () => {} : onClose}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-safety/15">
          <Icon name="menu_book" size={22} className="text-safety" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title-lg font-extrabold text-ink">Full Exam Routine</p>
          <p className="text-label-sm text-ink-muted">
            Section {profile?.section?.name ?? '—'} · every subject, 7-day gap
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-label-sm text-warning">
        <Icon name="info" size={15} className="mt-0.5 shrink-0" />
        <p>
          Schedule every subject first, then submit — the whole routine goes to
          the coordinator as pending and appears once approved.
        </p>
      </div>

      {/* Completeness progress */}
      <div className="glass-ember mt-3 rounded-2xl p-3.5 animate-fade-up">
        <div className="flex items-center justify-between gap-3">
          <p className="text-label-md font-extrabold text-ink">
            <span className="text-ember-gradient text-title-md">{coveredCount}</span>
            {' / '}
            {totalCourses} subjects scheduled
          </p>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide ${
              complete ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
            }`}
          >
            {complete ? 'READY TO SUBMIT' : 'INCOMPLETE'}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-variant">
          <div
            className="h-full rounded-full bg-gradient-to-r from-dark-orange to-flame transition-all duration-500"
            style={{ width: `${totalCourses ? (coveredCount / totalCourses) * 100 : 0}%` }}
          />
        </div>
        {missingCourses.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingCourses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCourseId(c.id)}
                className="rounded-full bg-critical/10 px-2.5 py-1 text-label-sm font-bold text-critical transition-colors hover:bg-critical/20"
              >
                {c.code} missing
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add-exam form */}
      <div className="mt-3 space-y-3 rounded-2xl border border-outline/70 p-4">
        {courses == null ? (
          <div className="flex justify-center py-3">
            <Spinner size={24} />
          </div>
        ) : courses.length === 0 ? (
          <p className="text-body-md text-ink-muted">No theory courses found in your routine yet.</p>
        ) : (
          <Field label="Course">
            <select value={courseId ?? ''} onChange={(e) => setCourseId(e.target.value)} className={INPUT_CLASS}>
              {courses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.code} — {entry.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Exam date">
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value || minDate)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Room (optional)">
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. Gallery 204"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label="End">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={INPUT_CLASS} />
          </Field>
        </div>

        {!timeValid && <p className="text-label-md text-critical">End time must be after the start time.</p>}
        {!dateValid && (
          <p className="text-label-md text-critical">
            Exams must be on or after {dmyFromIso(minDate)} — at least {EXAM_MIN_DAYS} days from today.
          </p>
        )}
        {duplicate && <p className="text-label-md text-warning">That course already has an exam on this date.</p>}
        {gapClash && (
          <p className="text-label-md text-critical">
            Two exams must be at least {EXAM_MIN_DAYS} days apart — {gapClash.code} is on{' '}
            {dmyFromIso(gapClash.date)}. Pick a date {EXAM_MIN_DAYS}+ days away from it.
          </p>
        )}

        <Button
          variant="tonal"
          className="w-full"
          icon="add"
          onClick={addRow}
          disabled={!course || !timeValid || !dateValid || duplicate || Boolean(gapClash)}
        >
          Add exam to routine
        </Button>
      </div>

      {/* Queued rows */}
      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-label-sm font-extrabold tracking-wider text-safety">
            SCHEDULED ({rows.length})
          </p>
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="animate-fade-up flex items-center gap-3 rounded-2xl border border-outline/60 bg-surface p-3"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-safety/10 text-label-md font-extrabold text-safety">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-lg font-bold text-ink">
                  {row.courseCode} · {dmyFromIso(row.date)}
                </p>
                <p className="text-label-sm text-ink-muted">
                  {weekdayFromIsoLocal(row.date)} · {row.startTime} – {row.endTime}
                  {row.room ? ` · ${row.room}` : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${row.courseCode}`}
                onClick={() => removeRow(row.key)}
                disabled={busy}
                className="shrink-0 rounded-lg p-1.5 text-ink-muted hover:bg-surface-variant hover:text-critical disabled:opacity-40"
              >
                <Icon name="delete" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <Button variant="outlined" className="flex-1" onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button
          variant="filled"
          className="flex-1"
          onClick={submit}
          disabled={busy || !complete}
        >
          {busy ? <Spinner size={16} /> : <Icon name="send" size={18} />}
          <span>Submit for approval</span>
        </Button>
      </div>
    </CrDialog>
  );
}
