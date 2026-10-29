// CR declaration dialogs — port of the interactive flows in
// cr_center_controller.dart. Each dialog gathers its inputs, shows the same
// structured preview the Flutter app confirms, then publishes local-first.
import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { getCalendarDay, getWeeklyRoutine } from '../../api/endpoints.js';
import { studentRoutine } from '../../data/seedData.js';
import { roomDisplayLabel } from '../../lib/display.js';
import { dayMatches, isoDate } from '../../lib/datetime.js';
import { parseRoutineEntry, parseScheduleEntry } from '../../lib/models.js';
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
 * Base entries for a date. Online uses the calendar endpoint, but always falls
 * back to the saved/official weekly routine so CR actions keep working offline.
 */
async function loadEntriesForDate(profile, date) {
  const section = profile?.section;
  const dateIso = isoDate(date);
  let entries = null;

  if (!isOfflineSession()) {
    try {
      const response = await getCalendarDay(dateIso);
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
        const response = await getWeeklyRoutine();
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
export async function countClassesOn(dateIso, profile) {
  if (!dayNameFor(dateIso)) return 0;
  try {
    const entries = await loadEntriesForDate(profile, dateIso);
    const effective = applyDayDeclarations(entries, {
      section: profile?.section,
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
function useClassesOnDate(profile, date) {
  const [classes, setClasses] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setClasses(null);
    (async () => {
      const entries = await loadEntriesForDate(profile, date);
      const effective = applyDayDeclarations(entries, {
        section: profile?.section,
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
  }, [date, profile?.section?.name]);

  return classes;
}

/** Unique courses from the section's weekly routine. null while loading. */
function useRoutineCourses(profile) {
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const collect = (entries) => {
        const seen = new Set();
        const list = [];
        for (const entry of entries) {
          const course = entry?.course;
          if (course?.id && course.code !== 'CT' && !seen.has(course.id)) {
            seen.add(course.id);
            list.push({ id: course.id, code: course.code, title: course.title });
          }
        }
        return list;
      };

      if (isOfflineSession()) {
        const section = profile?.section?.name ?? 'A';
        if (!cancelled) {
          setCourses(
            collect(applyRoutineOverrides(studentRoutine({ section }), profile?.section))
          );
        }
        return;
      }
      try {
        const response = await getWeeklyRoutine();
        const payload = extractPayload(response);
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
            ? payload.items
            : [];
        const entries = applyRoutineOverrides(list.map(parseRoutineEntry), profile?.section);
        if (!cancelled) setCourses(collect(entries));
      } catch {
        if (!cancelled) setCourses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.section?.name]);

  return courses;
}

/**
 * CT-slot times per weekday for the section routine.
 *
 * A class test declared "in the CT slot" still needs the slot's real start and
 * end times: local declarations without times are dropped by the calendar
 * overlay, so the declaration must always carry them.
 */
function useCtSlots(profile) {
  const [slots, setSlots] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let weekly = [];
      if (isOfflineSession()) {
        weekly = studentRoutine({ section: profile?.section?.name ?? 'A' });
      } else {
        try {
          const response = await getWeeklyRoutine();
          const payload = extractPayload(response);
          weekly = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.items)
              ? payload.items
              : [];
        } catch {
          /* fall back to the saved routine */
        }
        if (weekly.length === 0) weekly = offlineCache.getCachedWeeklyRoutine() ?? [];
        if (weekly.length === 0) {
          weekly = studentRoutine({ section: profile?.section?.name ?? 'A' });
        }
      }

      const map = {};
      for (const entry of applyRoutineOverrides(
        weekly.map(parseRoutineEntry),
        profile?.section
      )) {
        if (entry.classType !== 'ct' || !entry.startTime || !entry.endTime) continue;
        const day = String(entry.day ?? '').trim();
        if (!day || map[day]) continue;
        map[day] = { startTime: entry.startTime, endTime: entry.endTime };
      }
      if (!cancelled) setSlots(map);
    })().catch(() => {
      if (!cancelled) setSlots({});
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.section?.name]);

  return slots;
}

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
          <span>Confirm</span>
        </Button>
      </div>
    </CrDialog>
  );
}

// ---------------------------------------------------------------------------
// 1. Declare Auto / Day Off
// ---------------------------------------------------------------------------

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
    countClassesOn(date, profile).then((count) => {
      if (!cancelled) setAffected(count);
    });
    return () => {
      cancelled = true;
    };
  }, [open, date, profile]);

  const confirm = async () => {
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
      details={[
        { label: 'Date', value: dmyFromIso(date) },
        { label: 'Section', value: controller.resolvedSectionLabel },
        { label: 'Classes hidden', value: affected == null ? '…' : String(affected) },
        { label: 'Reason', value: reason || '\u2014' },
      ]}
      warning="The official routine is preserved — this only overrides the effective calendar."
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
      let total = 0;
      const start = new Date(`${startDate}T00:00:00`);
      for (let i = 0; i < days; i++) {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        total += await countClassesOn(isoDate(day), profile);
      }
      if (!cancelled) setAffected(total);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, startDate, days, profile]);

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
        { label: 'Section', value: controller.resolvedSectionLabel },
        { label: 'Classes hidden', value: affected == null ? '…' : String(affected) },
        { label: 'Reason', value: reason || '\u2014' },
      ]}
      warning="All CR declarations publish instantly — no coordinator approval required."
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <input
            type="date"
            value={startDate}
            min={isoDate(new Date())}
            onChange={(e) => setStartDate(e.target.value || tomorrowIso())}
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
  const [date, setDate] = useState(today);
  const classes = useClassesOnDate(profile, date);
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
  const courses = useRoutineCourses(profile);
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
  }, [open]);

  useEffect(() => {
    if (!courses || courses.length === 0) return;
    setCourseId((current) =>
      current && courses.some((c) => c.id === current) ? current : courses[0].id
    );
  }, [courses]);

  const course = courses?.find((c) => c.id === courseId) ?? null;

  const confirm = async () => {
    if (!course) return;
    setBusy(true);
    try {
      const feedback = await controller.submitOverride(
        {
          type: 'extra_class',
          date,
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
      confirmDisabled={!course}
      onConfirm={confirm}
      details={[
        { label: 'Course', value: course ? `${course.code} \u2014 ${course.title}` : '—' },
        { label: 'Date', value: dmyFromIso(date) },
        { label: 'Time', value: `${startTime} \u2013 ${endTime}` },
        ...(room.trim() ? [{ label: 'Room', value: room.trim() }] : []),
        { label: 'Note', value: reason || '\u2014' },
      ]}
      warning="Extra classes are clearly badged EXTRA on the calendar, separate from the official routine."
    >
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
// 5. Declare CT (class test)
// ---------------------------------------------------------------------------

export function DeclareCtDialog({ open, onClose, controller, profile }) {
  const toast = useToast();
  const courses = useRoutineCourses(profile);
  const ctSlots = useCtSlots(profile);
  const [courseId, setCourseId] = useState(null);
  const [date, setDate] = useState(tomorrowIso);
  const [useSlot, setUseSlot] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:50');
  const [room, setRoom] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(tomorrowIso());
    setUseSlot(true);
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
  const daySlot = ctSlots?.[weekdayName(date)] ?? null;
  const slotTimes = daySlot?.startTime && daySlot?.endTime ? daySlot : null;
  // Without a CT slot on that weekday the declaration falls back to a custom
  // time instead of silently losing its times.
  const usesSlot = useSlot && Boolean(slotTimes);
  const customTimeValid = Boolean(startTime && endTime && startTime < endTime);
  const timeValid = usesSlot || customTimeValid;
  const timeLabel = usesSlot
    ? `CT slot ${slotTimes.startTime} \u2013 ${slotTimes.endTime}`
    : `${startTime} \u2013 ${endTime}`;

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
          startTime: usesSlot ? slotTimes.startTime : startTime,
          endTime: usesSlot ? slotTimes.endTime : endTime,
          ...(room.trim() ? { room: room.trim() } : {}),
          reason,
        },
        `${course.code} CT on ${dmyFromIso(date)}`
      );
      toast.success(feedback);
      onClose();
    } catch (error) {
      toast.error(`Failed to declare CT: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrFormDialog
      open={open}
      onClose={onClose}
      icon="quiz"
      tone={{ bg: 'bg-info/15', text: 'text-info' }}
      title="Declare Class Test (CT)"
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
      warning="The CT appears on your section's calendar right away — you can reschedule or cancel it from here later."
    >
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
        <div className="col-span-2">
          <Field label="When">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!slotTimes}
                onClick={() => setUseSlot(true)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-label-md font-semibold transition ${
                  usesSlot
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline text-ink-muted hover:border-primary/40'
                } ${slotTimes ? '' : 'cursor-not-allowed opacity-50'}`}
              >
                {slotTimes
                  ? `CT slot ${slotTimes.startTime}\u2013${slotTimes.endTime}`
                  : 'No CT slot'}
              </button>
              <button
                type="button"
                onClick={() => setUseSlot(false)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-label-md font-semibold transition ${
                  !usesSlot
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline text-ink-muted hover:border-primary/40'
                }`}
              >
                Custom time
              </button>
            </div>
            {ctSlots != null && !slotTimes && (
              <span className="mt-1 block text-label-sm text-ink-muted">
                No CT slot in the routine on {weekdayName(date)} — pick a custom time.
              </span>
            )}
          </Field>
        </div>
      </div>

      {!usesSlot && (
        <div className="grid grid-cols-2 gap-3">
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
        label="Syllabus / note (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        hint="e.g. CT-2 · Chapters 4–6"
        multiline
        rows={2}
      />
    </CrFormDialog>
  );
}
