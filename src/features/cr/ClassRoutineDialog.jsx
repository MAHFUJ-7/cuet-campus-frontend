// Class Routine studio for CRs — two ways to shape the weekly routine.
// Everything is entered manually, matching the official CUET routine:
// subject code, subject full name, one or more teacher names, and the
// period (1–9) with its fixed time slot. Break (10:30–10:45) and Lunch
// (13:00–13:45) are fixed gaps between periods — no class can span them.
//
// 1. "Edit routine" — direct edits to the published weekly routine (add,
//    retime, re-room, retake or remove a slot). CRs may do this without
//    coordinator approval; every change lands instantly.
// 2. "Submit full routine" — build the complete Sunday–Thursday week and
//    send it for coordinator review. Approval publishes it as the section's
//    official class routine.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Icon, Spinner } from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  createRoutine,
  deleteRoutine,
  getRoutineProposals,
  getWeeklyRoutine,
  submitRoutineProposal,
  updateRoutine,
  withdrawRoutineProposal,
} from '../../api/endpoints.js';
import { parseRoutineEntry } from '../../lib/models.js';
import { PERIODS, periodByNumber, periodRangeCrossesBreak } from '../../lib/constants.js';
import { CrDialog } from './CrShared.jsx';
import { useBatchSections } from './CrDialogs.jsx';

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const CLASS_TYPES = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Lab / Sessional' },
  { value: 'tutorial', label: 'Tutorial' },
];

const INPUT_CLASS =
  'w-full rounded-xl border border-outline bg-surface px-3 py-2 text-body-md text-ink outline-none transition-colors focus:border-primary';

const toList = (payload) =>
  Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-label-sm font-bold tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const emptyRow = () => ({
  day: 'Sunday',
  period: 1,
  periodEnd: 1,
  courseCode: '',
  courseTitle: '',
  teachers: '',
  classType: 'lecture',
  room: '',
});

/** Periods a row occupies, inclusive. */
const rowPeriods = (row) => {
  const from = Number(row.period) || 1;
  const to = Number(row.periodEnd) || from;
  const list = [];
  for (let p = from; p <= to; p += 1) list.push(p);
  return list;
};

const timeLabelFor = (row) => {
  const from = periodByNumber(row.period);
  const to = periodByNumber(row.periodEnd ?? row.period);
  if (!from || !to) return '';
  return `${from.label.split(' – ')[0]} – ${to.label.split(' – ')[1]}`;
};

const rowProblem = (row, others = []) => {
  if (!String(row.courseCode ?? '').trim()) return 'Enter the subject code (e.g. CSE-321)';
  const from = Number(row.period);
  const to = Number(row.periodEnd ?? row.period);
  if (!Number.isInteger(from) || from < 1 || from > 9) return 'Pick a period';
  if (!Number.isInteger(to) || to < from || to > 9) return 'The period range is invalid';
  if (periodRangeCrossesBreak(from, to)) {
    return 'A class cannot span Break (10:30–10:45) or Lunch (1:00–1:45) — split it into separate periods';
  }
  const taken = others.find((other) =>
    rowPeriods(other).some((p) => rowPeriods(row).includes(p)) && other.day === row.day
  );
  if (taken) return `Period clash on ${row.day} with ${taken.courseCode || 'another class'}`;
  return null;
};

/** Shared editable fields for one routine row — all manual, period-based. */
function RowFields({ row, onChange, compact = false }) {
  const update = (patch) => onChange({ ...row, ...patch });
  const periodOptions = (from) =>
    PERIODS.filter((p) => p.period >= from).map((p) => (
      <option key={p.period} value={p.period}>
        Period {p.period} · {p.label}
      </option>
    ));
  const grid = compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 gap-2';
  return (
    <div className="space-y-2">
      <div className={grid}>
        <Field label="Subject code">
          <input
            type="text"
            value={row.courseCode}
            onChange={(e) => update({ courseCode: e.target.value.toUpperCase() })}
            placeholder="CSE-321"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Subject full name">
          <input
            type="text"
            value={row.courseTitle}
            onChange={(e) => update({ courseTitle: e.target.value })}
            placeholder="Computer Architecture"
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <div className={grid}>
        <Field label="Day">
          <select
            value={row.day}
            onChange={(e) => update({ day: e.target.value })}
            className={INPUT_CLASS}
          >
            {WEEK_DAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Class type">
          <select
            value={row.classType}
            onChange={(e) => update({ classType: e.target.value })}
            className={INPUT_CLASS}
          >
            {CLASS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className={grid}>
        <Field label="From period">
          <select
            value={row.period}
            onChange={(e) =>
              update({
                period: Number(e.target.value),
                periodEnd: Math.max(Number(e.target.value), Number(row.periodEnd) || Number(e.target.value)),
              })
            }
            className={INPUT_CLASS}
          >
            {PERIODS.map((p) => (
              <option key={p.period} value={p.period}>
                Period {p.period} · {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To period (labs may span)">
          <select
            value={row.periodEnd ?? row.period}
            onChange={(e) => update({ periodEnd: Number(e.target.value) })}
            className={INPUT_CLASS}
          >
            {periodOptions(Number(row.period))}
          </select>
        </Field>
      </div>
      <div className={grid}>
        <Field label="Teacher name(s) — comma separated">
          <input
            type="text"
            value={row.teachers}
            onChange={(e) => update({ teachers: e.target.value })}
            placeholder="Prof. Dr. Mahfuzulhoq Chowdhury, Md. Rashadur Rahman"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Room (optional)">
          <input
            type="text"
            value={row.room}
            onChange={(e) => update({ room: e.target.value })}
            placeholder="e.g. Room 301"
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <p className="text-label-sm font-semibold text-primary dark:text-primary-light">
        Time: {timeLabelFor(row) || '—'}
      </p>
    </div>
  );
}

const teachersFromEntry = (entry) =>
  Array.isArray(entry?.instructor) ? entry.instructor.filter(Boolean).join(', ') : '';

// ---------------------------------------------------------------------------
// Tab 1 — direct edits to the published routine (no approval needed)
// ---------------------------------------------------------------------------

function EditRoutineTab({ sectionId }) {
  const toast = useToast();
  const [entries, setEntries] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState(emptyRow());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await getWeeklyRoutine({ sectionId });
      const raw = toList(extractPayload(response));
      setEntries(
        raw.map((json) => ({
          ...parseRoutineEntry(json),
          instructors: Array.isArray(json.instructor) ? json.instructor.filter(Boolean) : [],
        }))
      );
    } catch (error) {
      setLoadError(describeApiError(error));
      setEntries([]);
    }
  }, [sectionId]);

  useEffect(() => {
    if (sectionId) load();
  }, [sectionId, load]);

  const byDay = useMemo(() => {
    const groups = new Map(WEEK_DAYS.map((day) => [day, []]));
    for (const entry of entries ?? []) {
      if (groups.has(entry.day)) groups.get(entry.day).push(entry);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => Number(a.period) - Number(b.period));
    }
    return groups;
  }, [entries]);

  const otherEntries = (day, exceptId) =>
    (byDay.get(day) ?? []).filter((entry) => String(entry.id) !== String(exceptId));

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setAdding(false);
    setDraft({
      day: entry.day,
      period: entry.period,
      periodEnd: entry.period,
      courseCode: entry.course?.code ?? '',
      courseTitle: entry.course?.title ?? '',
      teachers: teachersFromEntry(entry),
      classType: entry.classType || 'lecture',
      room: entry.room ?? '',
    });
  };

  const saveEdit = async () => {
    const problem = rowProblem(
      draft,
      otherEntries(draft.day, editingId).map((entry) => ({
        day: entry.day,
        period: entry.period,
        periodEnd: entry.period,
        courseCode: entry.course?.code ?? '',
      }))
    );
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await updateRoutine(editingId, {
        courseCode: draft.courseCode.trim(),
        courseTitle: draft.courseTitle.trim(),
        day: draft.day,
        period: draft.period,
        classType: draft.classType,
        room: draft.room || null,
        teacherId: null,
        teacherNames: draft.teachers
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      });
      toast.success('Routine updated — the change is live instantly');
      setEditingId(null);
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(`Failed to update: ${describeApiError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = async (entry) => {
    setBusy(true);
    try {
      await deleteRoutine(entry.id);
      toast.success(`Removed ${entry.course?.code ?? 'class'} from ${entry.day}`);
      if (editingId === entry.id) {
        setEditingId(null);
        setDraft(null);
      }
      await load();
    } catch (error) {
      toast.error(`Failed to remove: ${describeApiError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const addEntry = async () => {
    const problem = rowProblem(addDraft, otherEntries(addDraft.day, null));
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await createRoutine({
        sectionId,
        day: addDraft.day,
        period: addDraft.period,
        courseCode: addDraft.courseCode.trim(),
        courseTitle: addDraft.courseTitle.trim(),
        classType: addDraft.classType,
        room: addDraft.room || null,
        teacherNames: addDraft.teachers
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      });
      toast.success(`Added ${addDraft.courseCode.trim()} to ${addDraft.day}`);
      setAdding(false);
      setAddDraft(emptyRow());
      await load();
    } catch (error) {
      toast.error(`Failed to add: ${describeApiError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  if (entries == null) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size={22} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl bg-critical/10 px-3 py-2.5 text-label-md text-critical">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-success/10 px-3 py-2 text-label-md text-success">
        Direct edits publish instantly — no coordinator approval needed.
      </p>

      {WEEK_DAYS.map((day) => {
        const dayEntries = byDay.get(day) ?? [];
        if (dayEntries.length === 0 && !adding) return null;
        return (
          <div key={day} className="rounded-2xl border border-outline/70 bg-surface">
            <div className="flex items-center justify-between border-b border-outline/60 px-3 py-2">
              <p className="text-label-lg font-extrabold text-ink">{day}</p>
              <span className="text-label-sm text-ink-muted">
                {dayEntries.length} class{dayEntries.length === 1 ? '' : 'es'}
              </span>
            </div>
            <div className="divide-y divide-outline/50">
              {dayEntries.map((entry) => {
                const editing = String(editingId) === String(entry.id);
                return (
                  <div key={entry.id} className="px-3 py-2.5">
                    {editing && draft ? (
                      <div className="space-y-2">
                        <RowFields row={draft} onChange={setDraft} compact />
                        <div className="flex gap-2">
                          <Button variant="outlined" className="flex-1" onClick={() => setEditingId(null)} disabled={busy}>
                            Cancel
                          </Button>
                          <Button variant="filled" className="flex-1" onClick={saveEdit} disabled={busy}>
                            {busy ? <Spinner size={15} /> : <Icon name="save" size={16} />}
                            <span>Save</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded-lg bg-surface-variant px-1.5 py-0.5 text-[10px] font-extrabold text-ink-muted">
                          P{entry.period}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-md font-bold text-ink">
                            {entry.course?.code ?? '—'}
                            <span className="ml-1.5 font-medium text-ink-muted">
                              {entry.startTime}–{entry.endTime}
                              {entry.room ? ` · ${entry.room}` : ''}
                            </span>
                          </p>
                          <p className="truncate text-label-sm text-ink-muted">
                            {entry.course?.title ?? ''}
                            {entry.instructors.length > 0
                              ? ` · ${entry.instructors.join(', ')}`
                              : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          aria-label={`Edit ${entry.course?.code ?? 'class'}`}
                          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-variant hover:text-primary"
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry)}
                          aria-label={`Remove ${entry.course?.code ?? 'class'}`}
                          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical"
                        >
                          <Icon name="delete" size={17} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!adding ? (
        <Button
          variant="outlined"
          className="w-full"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
        >
          <Icon name="add" size={18} />
          <span>Add a class</span>
        </Button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-outline/70 bg-surface p-3">
          <RowFields row={addDraft} onChange={setAddDraft} />
          <div className="flex gap-2">
            <Button variant="outlined" className="flex-1" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="filled" className="flex-1" onClick={addEntry} disabled={busy}>
              {busy ? <Spinner size={15} /> : <Icon name="add" size={16} />}
              <span>Add class</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tab 2 — two easy steps: (1) add every subject once, (2) tap the timetable
// ---------------------------------------------------------------------------

const STATUS_CHIP = {
  pending: { label: 'Pending coordinator review', tone: 'bg-warning/15 text-warning' },
  approved: { label: 'Approved — published', tone: 'bg-success/15 text-success' },
  rejected: { label: 'Rejected', tone: 'bg-critical/15 text-critical' },
};

const DRAFT_KEY = 'cuet:cr_routine_draft';

const emptySubject = () => ({ code: '', title: '', teachers: '', classType: '' });

/** Even-numbered codes are sessional — default the class type from that. */
const guessClassType = (code) => {
  const numeric = String(code ?? '').match(/(\d+)(?=\D*$)/);
  return numeric && Number(numeric[1]) % 2 === 0 ? 'lab' : 'lecture';
};

const draftKeyFor = (sectionId) => `${DRAFT_KEY}:${sectionId || 'none'}`;

function loadDraft(sectionId) {
  try {
    const raw = localStorage.getItem(draftKeyFor(sectionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.subjects)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(sectionId, draft) {
  try {
    localStorage.setItem(draftKeyFor(sectionId), JSON.stringify(draft));
  } catch {
    /* draft persistence is best-effort */
  }
}

function SubjectsStep({ subjects, step, setStep, onAdd, onRemove }) {
  const [form, setForm] = useState(emptySubject());
  const codeOk = String(form.code).trim().length >= 2;
  const titleOk = String(form.title).trim().length >= 3;
  const canAdd = codeOk && titleOk;

  const add = () => {
    if (!canAdd) return;
    onAdd({
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      teachers: form.teachers.trim(),
      classType: form.classType || guessClassType(form.code),
    });
    setForm(emptySubject());
  };

  return (
    <div className="space-y-3">
      <p className="text-label-md text-ink-muted">
        Add every subject once — code, full name and the teacher(s) who take it. You'll place
        them on the timetable in the next step.
      </p>

      <div className="rounded-2xl border border-outline/70 bg-surface p-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Subject code">
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="CSE-321"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Subject full name">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Computer Architecture"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Teacher(s) — comma separated">
            <input
              type="text"
              value={form.teachers}
              onChange={(e) => setForm({ ...form, teachers: e.target.value })}
              placeholder="Prof. Dr. Mahfuzulhoq Chowdhury, Md. Rashadur Rahman"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Class type">
            <select
              value={form.classType}
              onChange={(e) => setForm({ ...form, classType: e.target.value })}
              className={INPUT_CLASS}
            >
              <option value="">Auto ({form.code ? (guessClassType(form.code) === 'lab' ? 'Lab' : 'Lecture') : 'by code'})</option>
              <option value="lecture">Lecture</option>
              <option value="lab">Lab / Sessional</option>
              <option value="tutorial">Tutorial</option>
            </select>
          </Field>
        </div>
        <Button variant="filled" className="mt-2 w-full" onClick={add} disabled={!canAdd}>
          <Icon name="add" size={18} />
          <span>Add subject</span>
        </Button>
      </div>

      <p className="text-label-sm font-extrabold tracking-wider text-ink-muted">
        ADDED SUBJECTS ({subjects.length})
      </p>
      {subjects.length === 0 ? (
        <p className="rounded-xl bg-surface-variant px-3 py-2 text-label-md text-ink-muted">
          No subjects yet — add them above, e.g. CSE-321 Computer Architecture.
        </p>
      ) : (
        <div className="space-y-1.5">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="flex items-center gap-2 rounded-xl border border-outline/60 bg-surface px-3 py-2"
            >
              <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary dark:text-primary-light">
                {subject.code}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-bold text-ink">{subject.title}</p>
                {subject.teachers && (
                  <p className="truncate text-label-sm text-ink-muted">{subject.teachers}</p>
                )}
              </div>
              <span className="shrink-0 text-[10px] font-bold text-ink-muted">
                {subject.classType === 'lab' ? 'LAB' : subject.classType === 'tutorial' ? 'TUT' : 'LEC'}
              </span>
              <button
                type="button"
                onClick={() => onRemove(subject.id)}
                aria-label={`Remove ${subject.code}`}
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical"
              >
                <Icon name="delete" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {subjects.length > 0 && (
        <Button variant="filled" className="w-full" onClick={() => setStep(2)}>
          <Icon name="arrow_forward" size={18} />
          <span>Next: place classes on the timetable</span>
        </Button>
      )}
      {step > 1 && (
        <Button variant="outlined" className="w-full" onClick={() => setStep(1)}>
          <Icon name="arrow_back" size={16} />
          <span>Back to subjects</span>
        </Button>
      )}
    </div>
  );
}

function TimetableStep({ subjects, grid, setGrid, step, setStep, onSubmit, busy }) {
  const toast = useToast();
  const [activeCell, setActiveCell] = useState(null); // "Sunday-3"

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const filled = Object.values(grid).filter(Boolean).length;

  const assign = (subjectId) => {
    if (!activeCell) return;
    setGrid((current) => ({ ...current, [activeCell]: subjectId }));
    setActiveCell(null);
  };

  const clearCell = () => {
    if (!activeCell) return;
    setGrid((current) => {
      const next = { ...current };
      delete next[activeCell];
      return next;
    });
    setActiveCell(null);
  };

  const submit = () => {
    if (filled === 0) {
      toast.error('Place at least one class on the timetable first');
      return;
    }
    onSubmit();
  };

  const activeSubject = activeCell ? subjectById.get(grid[activeCell]) : null;

  return (
    <div className="space-y-3">
      <p className="text-label-md text-ink-muted">
        Tap any cell and pick the subject that runs in that period. Fill the same subject into
        consecutive periods for a lab — it shows as one long class.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-outline/70">
        <table className="w-full min-w-[560px] border-collapse text-center">
          <thead>
            <tr className="bg-surface-variant">
              <th className="px-1 py-2 text-[10px] font-extrabold tracking-wider text-ink-muted">
                PERIOD
              </th>
              {WEEK_DAYS.map((day) => (
                <th key={day} className="px-1 py-2 text-[10px] font-extrabold tracking-wider text-ink-muted">
                  {day.slice(0, 3).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <Fragment key={period.period}>
                <tr className="border-t border-outline/50">
                  <td className="bg-surface-variant/60 px-1 py-1 text-[10px] font-bold text-ink-muted">
                    P{period.period}
                    <span className="block whitespace-nowrap text-[9px] font-medium">
                      {period.label}
                    </span>
                  </td>
                  {WEEK_DAYS.map((day) => {
                    const cellKey = `${day}-${period.period}`;
                    const subject = subjectById.get(grid[cellKey]);
                    return (
                      <td key={cellKey} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveCell(cellKey)}
                          className={`h-11 w-full rounded-lg border text-[10px] font-bold leading-tight transition-colors ${
                            subject
                              ? 'border-primary/40 bg-primary/10 text-primary dark:text-primary-light'
                              : 'border-dashed border-outline/60 text-ink-muted hover:border-primary/40 hover:bg-surface-variant'
                          }`}
                        >
                          {subject ? (
                            <>
                              <span className="block">{subject.code}</span>
                              {subject.classType === 'lab' && (
                                <span className="block text-[8px] font-medium opacity-70">LAB</span>
                              )}
                            </>
                          ) : (
                            <Icon name="add" size={13} className="mx-auto opacity-50" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
                {period.period === 3 && (
                  <tr className="bg-warning/10">
                    <td colSpan={6} className="px-2 py-1 text-center text-[10px] font-extrabold tracking-wider text-warning">
                      BREAK · 10:30–10:45
                    </td>
                  </tr>
                )}
                {period.period === 6 && (
                  <tr className="bg-info/10">
                    <td colSpan={6} className="px-2 py-1 text-center text-[10px] font-extrabold tracking-wider text-info">
                      LUNCH · 1:00–1:45
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-label-md text-primary dark:text-primary-light">
        <span>{filled} periods filled</span>
        <button
          type="button"
          onClick={() => setGrid({})}
          className="rounded-lg px-2 py-0.5 text-label-sm font-bold text-critical transition-colors hover:bg-critical/10"
        >
          Clear all
        </button>
      </div>

      <div className="flex gap-2">
        <Button variant="outlined" className="flex-1" onClick={() => setStep(1)}>
          <Icon name="arrow_back" size={16} />
          <span>Subjects</span>
        </Button>
        <Button variant="filled" className="flex-1" onClick={submit} disabled={busy || filled === 0}>
          {busy ? <Spinner size={16} /> : <Icon name="send" size={18} />}
          <span>Submit for review</span>
        </Button>
      </div>

      {activeCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 animate-fade-in"
          onClick={() => setActiveCell(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xs rounded-2xl bg-surface p-4 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-title-sm font-extrabold text-ink">
              {activeCell.replace('-', ' · Period ')}
            </p>
            {activeSubject && (
              <p className="mt-0.5 text-label-sm text-ink-muted">
                Currently: {activeSubject.code}
              </p>
            )}
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {subjects.length === 0 && (
                <p className="rounded-xl bg-surface-variant px-3 py-2 text-label-md text-ink-muted">
                  No subjects added yet — go back and add them first.
                </p>
              )}
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => assign(subject.id)}
                  className="flex w-full items-center gap-2 rounded-xl border border-outline/60 bg-surface px-3 py-2 text-left transition-colors hover:border-primary/50"
                >
                  <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary dark:text-primary-light">
                    {subject.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">
                    {subject.title}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {activeSubject && (
                <Button variant="outlined" className="flex-1" onClick={clearCell}>
                  <Icon name="close" size={14} />
                  <span>Clear</span>
                </Button>
              )}
              <Button variant="outlined" className="flex-1" onClick={() => setActiveCell(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposeRoutineTab({ sectionId, onSubmitted }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [grid, setGrid] = useState({});
  const [pending, setPending] = useState(null);
  const [latest, setLatest] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Restore the local draft (or the pending proposal) so nothing is lost.
  useEffect(() => {
    if (!sectionId || loaded) return;
    let cancelled = false;
    (async () => {
      const draft = loadDraft(sectionId);
      if (draft && !cancelled) {
        setSubjects(draft.subjects ?? []);
        setGrid(draft.grid ?? {});
      }
      try {
        const response = await getRoutineProposals({});
        const list = toList(extractPayload(response)).filter(
          (proposal) => String(proposal.sectionId?._id ?? proposal.sectionId) === String(sectionId)
        );
        const pendingProposal = list.find((proposal) => proposal.status === 'pending') ?? null;
        if (!cancelled) {
          setPending(pendingProposal);
          setLatest(list[0] ?? null);
          if (pendingProposal) {
            // Rebuild subjects + timetable from the pending proposal.
            const rebuiltSubjects = [];
            const byCode = new Map();
            const rebuiltGrid = {};
            for (const entry of pendingProposal.entries ?? []) {
              const key = String(entry.courseCode ?? '').toUpperCase();
              if (key === 'CT') continue;
              let subject = byCode.get(key);
              if (!subject) {
                subject = {
                  id: `p-${key}`,
                  code: key,
                  title: entry.courseTitle ?? '',
                  teachers: (entry.teachers ?? []).join(', '),
                  classType: entry.classType || guessClassType(key),
                };
                byCode.set(key, subject);
                rebuiltSubjects.push(subject);
              }
              for (let p = entry.period; p <= (entry.periodEnd ?? entry.period); p += 1) {
                rebuiltGrid[`${entry.day}-${p}`] = subject.id;
              }
            }
            setSubjects(rebuiltSubjects);
            setGrid(rebuiltGrid);
          }
        }
      } catch {
        /* offline — the local draft is enough */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionId, loaded]);

  // Persist the draft after every change.
  useEffect(() => {
    if (!loaded) return;
    saveDraft(sectionId, { subjects, grid });
  }, [sectionId, loaded, subjects, grid]);

  const addSubject = (subject) => {
    // One entry per subject code — adding an existing code updates it.
    setSubjects((current) => {
      const existing = current.find((s) => s.code === subject.code);
      if (existing) {
        return current.map((s) => (s.code === subject.code ? { ...subject, id: s.id } : s));
      }
      return [...current, { ...subject, id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
    });
    toast.success(`${subject.code} added`);
  };

  const removeSubject = (id) => {
    setSubjects((current) => current.filter((s) => s.id !== id));
    setGrid((current) => {
      const next = {};
      for (const [key, value] of Object.entries(current)) {
        if (value !== id) next[key] = value;
      }
      return next;
    });
  };

  const withdraw = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await withdrawRoutineProposal(pending.id ?? pending._id);
      toast.success('Pending proposal withdrawn — your draft stays for editing');
      setPending(null);
    } catch (error) {
      toast.error(`Failed to withdraw: ${describeApiError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  // Convert the timetable into proposal entries, merging consecutive
  // same-subject periods into spans (never across Break/Lunch gaps).
  const buildEntries = () => {
    const byId = new Map(subjects.map((subject) => [subject.id, subject]));
    const entries = [];
    for (const day of WEEK_DAYS) {
      let current = null;
      for (const period of PERIODS) {
        const subject = byId.get(grid[`${day}-${period.period}`]);
        const canMerge =
          current &&
          subject &&
          current.subject.id === subject.id &&
          current.periodEnd + 1 === period.period &&
          !periodRangeCrossesBreak(current.period, period.period);
        if (canMerge) {
          current.periodEnd = period.period;
        } else {
          if (current) entries.push(current);
          current = subject
            ? {
                day,
                period: period.period,
                periodEnd: period.period,
                subject,
              }
            : null;
        }
      }
      if (current) entries.push(current);
    }
    return entries.map((entry) => ({
      day: entry.day,
      period: entry.period,
      periodEnd: entry.periodEnd,
      courseCode: entry.subject.code,
      courseTitle: entry.subject.title,
      teachers: entry.subject.teachers
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
      classType: entry.subject.classType || guessClassType(entry.subject.code),
    }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      await submitRoutineProposal(buildEntries(), sectionId);
      toast.success('Full routine submitted — the coordinator will review and publish it');
      try {
        localStorage.removeItem(draftKeyFor(sectionId));
      } catch {
        /* best-effort */
      }
      onSubmitted?.();
    } catch (error) {
      toast.error(`Failed to submit: ${describeApiError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {loaded && pending && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-warning/10 px-3 py-2">
          <p className="text-label-md text-warning">
            You have a proposal pending review — editing it resubmits the same proposal.
          </p>
          <button
            type="button"
            onClick={withdraw}
            disabled={busy}
            className="shrink-0 rounded-lg px-2 py-1 text-label-sm font-bold text-critical transition-colors hover:bg-critical/10"
          >
            Withdraw
          </button>
        </div>
      )}
      {loaded && !pending && latest && (
        <div
          className={`rounded-xl px-3 py-2 text-label-md ${
            STATUS_CHIP[latest.status]?.tone ?? 'bg-surface-variant text-ink-muted'
          }`}
        >
          Last proposal: {STATUS_CHIP[latest.status]?.label ?? latest.status}
          {latest.reviewNote ? ` — "${latest.reviewNote}"` : ''}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl bg-surface-variant p-1">
        {[1, 2].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-label-md font-bold transition-colors ${
              step === n
                ? 'bg-surface text-primary shadow-sm dark:text-primary-light'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${step === n ? 'bg-primary text-white' : 'bg-outline text-ink-muted'}`}>
              {n}
            </span>
            <span>{n === 1 ? 'Subjects' : 'Timetable'}</span>
          </button>
        ))}
      </div>

      {step === 1 ? (
        <SubjectsStep
          subjects={subjects}
          step={step}
          setStep={setStep}
          onAdd={addSubject}
          onRemove={removeSubject}
        />
      ) : (
        <TimetableStep
          subjects={subjects}
          grid={grid}
          setGrid={setGrid}
          step={step}
          setStep={setStep}
          onSubmit={submit}
          busy={busy}
        />
      )}
    </div>
  );
}

// Dialog shell
// ---------------------------------------------------------------------------

export default function ClassRoutineDialog({ open, onClose, profile, initialTab = 'edit' }) {
  const ownSectionId = profile?.section?.id ?? '';
  const sections = useBatchSections(profile);
  const [activeSectionId, setActiveSectionId] = useState(ownSectionId);
  const [tab, setTab] = useState(initialTab);

  // Keep the selection valid if the sections list loads late.
  useEffect(() => {
    if (sections?.length && !sections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(ownSectionId || sections[0].id);
    }
  }, [sections, activeSectionId, ownSectionId]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab]);

  const sectionLabel =
    sections?.find((s) => s.id === activeSectionId)?.label ??
    profile?.section?.label ??
    profile?.section?.name ??
    '';

  const tabs = [
    { key: 'edit', label: 'Edit routine', icon: 'edit' },
    { key: 'propose', label: 'Full routine', icon: 'menu_book' },
  ];

  return (
    <CrDialog open={open} onClose={onClose}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light/15 text-primary-light">
          <Icon name="calendar_month" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title-lg font-extrabold text-ink">Class Routine</p>
          <p className="text-label-sm text-ink-muted">
            {sectionLabel ? `${sectionLabel} · ` : ''}Periods 1–9 · Sunday to Thursday
          </p>
        </div>
      </div>

      {sections && sections.length > 1 && (
        <div className="mt-3 flex gap-1 rounded-xl bg-surface-variant p-1">
          {sections.map((section) => (
            <button
              key={section.id || section.name}
              type="button"
              onClick={() => setActiveSectionId(section.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-label-md font-bold transition-colors ${
                activeSectionId === section.id
                  ? 'bg-surface text-primary shadow-sm dark:text-primary-light'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon name="groups" size={16} />
              <span>{section.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-1 rounded-xl bg-surface-variant p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-label-md font-bold transition-colors ${
              tab === item.key
                ? 'bg-surface text-primary shadow-sm dark:text-primary-light'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === 'edit' ? (
          <EditRoutineTab key={activeSectionId} sectionId={activeSectionId} />
        ) : (
          <ProposeRoutineTab
            key={activeSectionId}
            sectionId={activeSectionId}
            onSubmitted={onClose}
          />
        )}
      </div>
    </CrDialog>
  );
}
