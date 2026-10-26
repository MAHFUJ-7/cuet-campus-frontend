// Permanent weekly-routine editor for CRs.
//
// Unlike a calendar declaration (which affects one dated class), this edits the
// section's weekly routine row. It is saved on-device immediately and synced to
// PUT /routine/:id on a best-effort basis; if the backend denies CR edits, the
// local change still survives reloads and offline sessions.
import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Spinner, TextField } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { updateRoutine } from '../../api/endpoints.js';
import { conflictDetector, timeToMinutes } from '../../lib/conflictDetector.js';
import {
  clearRoutineOverride,
  getRoutineOverrideList,
  saveRoutineOverride,
} from '../../lib/routineOverrides.js';
import { useWeeklyRoutine } from '../routine/useRoutineData.js';
import { CrDialog } from './CrShared.jsx';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_TIMES = {
  1: { start: '08:10', end: '09:00' },
  2: { start: '09:00', end: '09:45' },
  3: { start: '09:45', end: '10:30' },
  4: { start: '10:45', end: '11:30' },
  5: { start: '11:30', end: '12:15' },
  6: { start: '12:15', end: '13:00' },
  7: { start: '13:45', end: '14:30' },
  8: { start: '14:30', end: '15:15' },
  9: { start: '15:15', end: '16:00' },
};

const INPUT_CLASS =
  'w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const entryLabel = (entry) =>
  `${entry.course?.code ?? entry.courseCode ?? 'Class'} · P${entry.period} · ${entry.startTime}–${entry.endTime}${
    entry.room ? ` · ${entry.room}` : ''
  }`;

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-label-md font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 py-0.5">
      <span className="w-[96px] shrink-0 text-label-md text-ink-muted">{label}</span>
      <span className="min-w-0 flex-1 whitespace-pre-line text-body-md font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}

export default function PermanentRoutineDialog({ open, onClose, profile, section }) {
  const auth = useAuth();
  const toast = useToast();
  const { entries, loading, refresh } = useWeeklyRoutine(section);

  const classes = useMemo(
    () =>
      (entries ?? [])
        .filter((entry) => !entry.isBreak && entry.course?.code)
        .slice()
        .sort((a, b) => {
          const day = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
          return day !== 0 ? day : Number(a.period ?? 0) - Number(b.period ?? 0);
        }),
    [entries]
  );

  const [selectedId, setSelectedId] = useState(null);
  const [day, setDay] = useState('Sunday');
  const [period, setPeriod] = useState(1);
  const [startTime, setStartTime] = useState('08:10');
  const [endTime, setEndTime] = useState('09:00');
  const [room, setRoom] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [activeOverrides, setActiveOverrides] = useState([]);

  const selected = classes.find((entry) => String(entry.id) === String(selectedId)) ?? null;

  useEffect(() => {
    if (!open) return;
    setReason('');
    setBusy(false);
    setResettingId(null);
    setActiveOverrides(getRoutineOverrideList(section));
  }, [open, section]);

  useEffect(() => {
    if (!open || classes.length === 0) return;
    setSelectedId((current) =>
      current && classes.some((entry) => String(entry.id) === String(current))
        ? current
        : classes[0].id
    );
  }, [open, classes]);

  useEffect(() => {
    if (!open || !selected) return;
    setDay(selected.day);
    setPeriod(Number(selected.period) || 1);
    setStartTime(selected.startTime);
    setEndTime(selected.endTime);
    setRoom(selected.room ?? '');
    // Only re-initialise when a different class is picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId]);

  const invalidTime =
    Boolean(startTime && endTime) &&
    (timeToMinutes(endTime) == null ||
      timeToMinutes(startTime) == null ||
      timeToMinutes(endTime) <= timeToMinutes(startTime));

  const proposed = selected
    ? {
        ...selected,
        day,
        period: Number(period),
        startTime,
        endTime,
        room: room.trim() || null,
      }
    : null;

  const localConflicts = useMemo(() => {
    if (!open || !selected || !proposed || invalidTime) return [];
    const modified = classes.map((entry) =>
      String(entry.id) === String(selected.id) ? proposed : entry
    );
    return conflictDetector
      .detectConflicts(modified)
      .filter(
        (conflict) =>
          String(conflict.routineEntryId ?? '') === String(selected.id) ||
          String(conflict.otherRoutineEntryId ?? '') === String(selected.id)
      );
  }, [open, selected, proposed, invalidTime, classes]);

  const changed =
    selected &&
    (selected.day !== day ||
      Number(selected.period) !== Number(period) ||
      selected.startTime !== startTime ||
      selected.endTime !== endTime ||
      (selected.room ?? '') !== room.trim());

  const canSave =
    Boolean(selected) && !invalidTime && Boolean(startTime) && Boolean(endTime) && Boolean(changed);

  const handlePeriodChange = (value) => {
    setPeriod(value);
    const preset = PERIOD_TIMES[Number(value)];
    if (preset) {
      setStartTime(preset.start);
      setEndTime(preset.end);
    }
  };

  const save = async () => {
    if (!selected || !canSave) return;
    setBusy(true);
    const changes = {
      day,
      period: Number(period),
      startTime,
      endTime,
      room: room.trim() || null,
    };
    let synced = false;
    if (!auth.isOfflineSession) {
      try {
        await updateRoutine(selected.id, changes);
        synced = true;
      } catch {
        // CR accounts are often not allowed to PUT the official routine. The
        // local-first record below is still permanent on this device.
      }
    }
    try {
      saveRoutineOverride({
        section,
        entry: selected,
        changes,
        profile,
        reason,
        synced,
      });
      setActiveOverrides(getRoutineOverrideList(section));
      try {
        await refresh();
      } catch {
        /* non-critical */
      }
      toast.success(
        synced
          ? 'Permanent routine change saved and synced'
          : 'Permanent routine change saved on this device'
      );
      onClose();
    } catch (error) {
      toast.error(`Could not save the routine change: ${String(error?.message ?? error)}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (record) => {
    if (!record?.entryId) return;
    setResettingId(record.entryId);
    let synced = false;
    if (!auth.isOfflineSession && record.original) {
      try {
        await updateRoutine(record.entryId, {
          day: record.original.day,
          period: Number(record.original.period) || 1,
          startTime: record.original.startTime,
          endTime: record.original.endTime,
          ...(record.original.room ? { room: record.original.room } : {}),
        });
        synced = true;
      } catch {
        // Keep the local reset useful even when the server refuses.
      }
    }
    try {
      clearRoutineOverride(section, record.entryId);
      setActiveOverrides(getRoutineOverrideList(section));
      await refresh();
      toast.success(synced ? 'Routine change reset' : 'Local routine change reset');
    } catch (error) {
      toast.error(`Could not reset the routine change: ${String(error?.message ?? error)}`);
    } finally {
      setResettingId(null);
    }
  };

  const preview = selected
    ? [
        {
          label: 'Course',
          value: `${selected.course?.code ?? 'Class'}${
            selected.course?.title ? ` — ${selected.course.title}` : ''
          }`,
        },
        {
          label: 'Original',
          value: `${selected.day} · P${selected.period} · ${selected.startTime}–${selected.endTime}${
            selected.room ? ` · ${selected.room}` : ''
          }`,
        },
        {
          label: 'New',
          value: `${day} · P${period} · ${startTime}–${endTime}${room.trim() ? ` · ${room.trim()}` : ''}`,
        },
        { label: 'Section', value: section?.label ?? section?.name ?? '—' },
        { label: 'Note', value: reason.trim() || '—' },
      ]
    : [];

  return (
    <CrDialog open={open} onClose={busy ? () => {} : onClose}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-info/15">
          <Icon name="edit" size={22} className="text-info" />
        </span>
        <div className="min-w-0">
          <p className="text-title-lg font-extrabold text-ink">Permanent Routine Change</p>
          <p className="text-label-sm text-ink-muted">Changes the weekly grid, not one date</p>
        </div>
      </div>

      {loading && classes.length === 0 ? (
        <div className="flex justify-center py-8">
          <Spinner size={26} />
        </div>
      ) : classes.length === 0 ? (
        <div className="mt-4 rounded-xl border border-outline/60 p-4 text-center text-body-md text-ink-muted">
          No routine classes were found for your section.
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            <Field label="Weekly class">
              <select
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                className={INPUT_CLASS}
              >
                {WEEK_DAYS.map((weekday) => {
                  const dayClasses = classes.filter((entry) => entry.day === weekday);
                  if (dayClasses.length === 0) return null;
                  return (
                    <optgroup key={weekday} label={weekday}>
                      {dayClasses.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entryLabel(entry)}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Day">
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {WEEK_DAYS.map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {weekday}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Period">
                <select
                  value={period}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      Period {value}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="End time">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            {invalidTime && (
              <p className="text-label-md text-critical">End time must be after the start time.</p>
            )}

            <Field label="Room">
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. Room 3403 or Network Lab"
                className={INPUT_CLASS}
              />
            </Field>

            <TextField
              label="Note (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              hint="Why is the routine changing permanently?"
              multiline
              rows={2}
            />
          </div>

          <div className="mt-4 rounded-2xl bg-surface-variant/70 p-4">
            {preview.map((row) => (
              <PreviewRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>

          {localConflicts.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-warning">
              <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0 text-label-md">
                <p className="font-bold">This change conflicts with {localConflicts.length} class(es).</p>
                {localConflicts.slice(0, 2).map((conflict) => (
                  <p key={`${conflict.type}-${conflict.timeSlot}`} className="mt-0.5">
                    {conflict.description}
                  </p>
                ))}
                <p className="mt-1">You can still save, then use Find Time Conflicts to review.</p>
              </div>
            </div>
          )}

          {activeOverrides.length > 0 && (
            <div className="mt-4 rounded-2xl border border-outline/60 p-3.5">
              <p className="flex items-center gap-1.5 text-label-lg font-bold text-ink">
                <Icon name="history" size={17} className="text-info" />
                Active permanent changes
              </p>
              <div className="mt-2 space-y-2">
                {activeOverrides.map((record) => (
                  <div
                    key={record.entryId}
                    className="flex items-center gap-2 rounded-xl bg-surface-variant/60 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md font-semibold text-ink">
                        {record.courseCode} · {record.day} P{record.period}
                      </p>
                      <p className="truncate text-label-sm text-ink-muted">
                        {record.startTime}–{record.endTime}
                        {record.room ? ` · ${record.room}` : ''}
                        {record.synced ? ' · synced' : ' · on this device'}
                      </p>
                    </div>
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => reset(record)}
                      disabled={busy || resettingId != null}
                    >
                      {resettingId === record.entryId ? <Spinner size={14} /> : 'Reset'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-label-md text-warning">
            Unlike a declaration, this changes every matching week until you change or reset it.
            The CR edit is kept on this device and synced to the server when permitted.
          </p>

          <div className="mt-5 flex gap-3">
            <Button variant="outlined" className="flex-1" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="filled"
              className="flex-1"
              onClick={save}
              disabled={busy || !canSave}
            >
              {busy ? <Spinner size={16} /> : <Icon name="check" size={18} />}
              <span>Save permanently</span>
            </Button>
          </div>
        </>
      )}
    </CrDialog>
  );
}
