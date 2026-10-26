// Section Management — port of section_management_screen.dart.
// Coordinator-configured student-ID ranges, CR assignment/removal and a roster
// with manual moves, scoped to one section.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  Spinner,
  TextField,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  applyAssignmentRule,
  assignCR,
  createAssignmentRule,
  deleteAssignmentRule,
  getAssignmentRules,
  getCoordinatorCRs,
  getCoordinatorSections,
  getCoordinatorStudents,
  moveStudent,
  removeCR,
  updateAssignmentRule,
} from '../../api/endpoints.js';
import {
  coordinatorCRs,
  coordinatorSections,
  coordinatorStudents,
} from '../../data/seedData.js';
import { isOfflineSession } from '../../lib/session.js';
import { sectionIdOf, sectionTermIdOf } from './CoordinatorAcademicsPage.jsx';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const CR_PERMISSIONS = {
  allowedUpdateTypes: [
    'announcement',
    'cancellation',
    'room_change',
    'time_change',
    'extra_class',
    'teacher_change',
    'lab_change',
    'other',
    'auto_day_off',
    'mid_break',
  ],
  directPublishTypes: ['announcement'],
};

const studentIdOf = (student) => String(student?._id ?? student?.id ?? '');

const ruleSectionIdOf = (rule) => {
  const raw = rule?.sectionId ?? rule?.section;
  return String(
    raw && typeof raw === 'object' ? raw?._id ?? raw?.id ?? '' : raw ?? ''
  );
};

const ruleLabel = (rule) => `ID ${rule?.startId ?? '0'} — ${rule?.endId ?? '0'}`;

function RuleDialog({ rule, onCancel, onSave, busy }) {
  const [start, setStart] = useState(String(rule?.startId ?? 1));
  const [end, setEnd] = useState(String(rule?.endId ?? 66));
  const [errors, setErrors] = useState({});

  const submit = () => {
    const nextErrors = {};
    const startNumber = Number.parseInt(start, 10);
    const endNumber = Number.parseInt(end, 10);
    if (Number.isNaN(startNumber)) nextErrors.start = 'Number required';
    if (Number.isNaN(endNumber)) nextErrors.end = 'Number required';
    else if (!Number.isNaN(startNumber) && endNumber < startNumber)
      nextErrors.end = 'Must be ≥ start';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(startNumber, endNumber);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-title-lg font-bold text-ink">Student ID range</p>
        <div className="mt-4 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              label="Starting ID"
              value={start}
              onChange={(e) => setStart(e.target.value.replace(/[^0-9]/g, ''))}
              error={errors.start}
              inputMode="numeric"
            />
          </div>
          <span className="pt-9 text-body-md text-ink-muted">—</span>
          <div className="min-w-0 flex-1">
            <TextField
              label="Ending ID"
              value={end}
              onChange={(e) => setEnd(e.target.value.replace(/[^0-9]/g, ''))}
              error={errors.end}
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="text" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="filled" onClick={submit} loading={busy}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SectionManagementPage() {
  const { id: sectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const sectionFromState = location.state?.section ?? null;
  const termRef = useRef(
    sectionFromState?.termId
      ? typeof sectionFromState.termId === 'object'
        ? String(sectionFromState.termId._id ?? sectionFromState.termId.id ?? '')
        : String(sectionFromState.termId)
      : ''
  );

  const [rules, setRules] = useState([]);
  const [students, setStudents] = useState([]);
  const [crs, setCrs] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [ruleDialog, setRuleDialog] = useState(null); // { rule }
  const [ruleBusy, setRuleBusy] = useState(false);
  const [deleteRule, setDeleteRule] = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [assignSheet, setAssignSheet] = useState(false);
  const [moveFor, setMoveFor] = useState(null);
  const [removeCrTarget, setRemoveCrTarget] = useState(null);

  // Opened directly (refresh/bookmark) there is no router state — fall back to
  // the section list so the title and term are still correct.
  const section = useMemo(
    () =>
      sectionFromState ??
      allSections.find((item) => sectionIdOf(item) === sectionId) ??
      null,
    [sectionFromState, allSections, sectionId]
  );
  const title = section?.label ?? section?.name ?? 'Section';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let term = termRef.current;
      const sectionsRes = await getCoordinatorSections();
      const sectionList = toArray(extractPayload(sectionsRes));
      setAllSections(sectionList);

      if (!term) {
        const match = sectionList.find((item) => sectionIdOf(item) === sectionId);
        if (match) {
          term = sectionTermIdOf(match);
          termRef.current = term;
        }
      }

      const [studentsRes, crsRes, rulesRes] = await Promise.all([
        getCoordinatorStudents({ sectionId }),
        getCoordinatorCRs({ sectionId }),
        term ? getAssignmentRules({ termId: term }) : Promise.resolve(null),
      ]);

      const ruleList = rulesRes ? toArray(extractPayload(rulesRes)) : [];
      setRules(ruleList.filter((rule) => ruleSectionIdOf(rule) === sectionId));
      setStudents(toArray(extractPayload(studentsRes)));
      setCrs(toArray(extractPayload(crsRes)));
      setLoading(false);
    } catch (loadError) {
      if (isOfflineSession()) {
        setStudents(coordinatorStudents({ sectionId }));
        setCrs(coordinatorCRs({ sectionId }));
        setRules([]);
        setAllSections(coordinatorSections());
        setLoading(false);
        return;
      }
      setError(describeApiError(loadError));
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const requireOnline = () => {
    if (isOfflineSession()) {
      toast.info('This action requires a connection.');
      return false;
    }
    return true;
  };

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      [student?.name, student?.studentId, student?.email].some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      )
    );
  }, [students, search]);

  const saveRule = async (startId, endId) => {
    if (!requireOnline()) return;
    const existing = ruleDialog?.rule ?? null;
    if (!existing && !termRef.current) {
      toast.error('This section has no academic term configured.');
      return;
    }
    setRuleBusy(true);
    try {
      if (existing) {
        await updateAssignmentRule(String(existing._id ?? existing.id), {
          startId,
          endId,
        });
        toast.success('Range updated');
      } else {
        await createAssignmentRule({
          termId: termRef.current,
          sectionId,
          startId,
          endId,
        });
        toast.success('Range created');
      }
      setRuleDialog(null);
      load();
    } catch (ruleError) {
      toast.error(describeApiError(ruleError));
    } finally {
      setRuleBusy(false);
    }
  };

  const removeRule = async () => {
    const rule = deleteRule;
    setDeleteRule(null);
    if (!rule || !requireOnline()) return;
    try {
      await deleteAssignmentRule(String(rule._id ?? rule.id));
      toast.success('Range removed');
      load();
    } catch (ruleError) {
      toast.error(describeApiError(ruleError));
    }
  };

  const applyRule = async (rule) => {
    if (!requireOnline()) return;
    toast.info(`Applying ${ruleLabel(rule)}…`);
    try {
      const response = await applyAssignmentRule(String(rule._id ?? rule.id));
      const data = extractPayload(response) ?? {};
      setApplyResult({
        assignedCount: Number(data.assignedCount) || 0,
        alreadyAssignedCount: Number(data.alreadyAssignedCount) || 0,
      });
      load();
    } catch (ruleError) {
      toast.error(describeApiError(ruleError));
    }
  };

  const grantCr = async (student) => {
    if (!requireOnline()) return;
    try {
      await assignCR(studentIdOf(student), sectionId, CR_PERMISSIONS);
      toast.success(`${student.name ?? student.studentId} is now a CR`);
      setAssignSheet(false);
      load();
    } catch (crError) {
      toast.error(describeApiError(crError));
    }
  };

  const revokeCr = async () => {
    const target = removeCrTarget;
    setRemoveCrTarget(null);
    if (!target || !requireOnline()) return;
    try {
      await removeCR(target.userId, sectionId);
      toast.success('CR removed');
      load();
    } catch (crError) {
      toast.error(describeApiError(crError));
    }
  };

  const confirmMove = async (targetSection) => {
    const student = moveFor;
    setMoveFor(null);
    if (!student || !targetSection || !requireOnline()) return;
    try {
      await moveStudent({
        studentId: studentIdOf(student),
        targetSectionId: sectionIdOf(targetSection),
      });
      toast.success(`${student.name ?? student.studentId} moved`);
      load();
    } catch (moveError) {
      toast.error(describeApiError(moveError));
    }
  };

  const crUser = (assignment) => {
    const user = assignment?.userId ?? assignment?.user ?? {};
    return {
      userId: String(user?._id ?? user?.id ?? assignment?.userId ?? ''),
      name: user?.name ?? 'Unknown',
      studentId: user?.studentId ?? '',
    };
  };

  const candidates = useMemo(
    () => students.filter((student) => student?.isCr !== true),
    [students]
  );

  const otherSections = useMemo(
    () => allSections.filter((item) => sectionIdOf(item) !== sectionId),
    [allSections, sectionId]
  );

  const cardHeader = (icon, heading, action = null) => (
    <div className="flex items-center gap-1.5">
      <Icon name={icon} size={20} className="shrink-0 text-primary dark:text-primary-light" />
      <p className="min-w-0 flex-1 text-title-md font-bold text-ink">{heading}</p>
      {action}
    </div>
  );

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title={title} onBack={() => navigate(-1)} />

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* ID ranges */}
          <Card>
            {cardHeader(
              'format_list_numbered',
              'Student ID Ranges',
              <IconButton
                icon="add_circle"
                label="Add range"
                onClick={() => setRuleDialog({ rule: null })}
              />
            )}
            {rules.length === 0 ? (
              <p className="mt-1.5 text-body-sm text-ink-muted">
                No ranges configured. Students may join freely until ranges exist — add one
                to take control of section assignment.
              </p>
            ) : (
              <div className="mt-1 divide-y divide-outline/50">
                {rules.map((rule) => (
                  <div
                    key={rule._id ?? rule.id}
                    className="flex items-center gap-2.5 py-2"
                  >
                    <Icon name="tag" size={18} className="shrink-0 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-title-sm font-semibold text-ink">
                        {ruleLabel(rule)}
                      </p>
                      <p className="truncate text-label-sm text-ink-muted">
                        {rule.termId?.label ?? rule.termLabel ?? 'Term'} · active
                      </p>
                    </div>
                    <IconButton
                      icon="play_circle"
                      label="Apply to roster"
                      onClick={() => applyRule(rule)}
                      className="text-success hover:text-success"
                    />
                    <IconButton
                      icon="edit"
                      label="Edit range"
                      onClick={() => setRuleDialog({ rule })}
                    />
                    <IconButton
                      icon="delete"
                      label="Delete range"
                      onClick={() => setDeleteRule(rule)}
                      className="hover:text-critical"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* CRs */}
          <Card>
            {cardHeader(
              'how_to_reg',
              'Class Representatives',
              <IconButton
                icon="person_add"
                label="Assign CR"
                onClick={() => {
                  if (candidates.length === 0) {
                    toast.info('No eligible students in this section');
                    return;
                  }
                  setAssignSheet(true);
                }}
              />
            )}
            {crs.length === 0 ? (
              <p className="mt-1.5 text-body-sm text-ink-muted">No CRs assigned yet.</p>
            ) : (
              <div className="mt-1 divide-y divide-outline/50">
                {crs.map((assignment, index) => {
                  const user = crUser(assignment);
                  return (
                    <div
                      key={assignment._id ?? assignment.id ?? index}
                      className="flex items-center gap-2.5 py-2"
                    >
                      <Icon name="verified_user" size={18} className="shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-title-sm font-semibold text-ink">
                          {user.name}
                        </p>
                        <p className="truncate text-label-sm text-ink-muted">
                          {user.studentId}
                        </p>
                      </div>
                      <IconButton
                        icon="do_not_disturb_on"
                        label="Remove CR"
                        onClick={() =>
                          setRemoveCrTarget({ userId: user.userId, name: user.name })
                        }
                        className="hover:text-critical"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Roster */}
          <Card>
            {cardHeader('groups', `Students (${students.length})`)}
            <div className="mt-2">
              <TextField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                hint="Search by name, ID or email"
                icon="search"
              />
            </div>
            {filteredStudents.length === 0 ? (
              <EmptyState
                icon="person_search"
                title="No students found"
                message="Nobody matches your search in this section."
              />
            ) : (
              <div className="mt-1.5 divide-y divide-outline/50">
                {filteredStudents.map((student) => (
                  <div
                    key={studentIdOf(student)}
                    className="flex items-center gap-2.5 py-2"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-md font-bold ${
                        student.isCr === true
                          ? 'bg-success/20 text-success'
                          : 'bg-primary/15 text-primary dark:text-primary-light'
                      }`}
                    >
                      {String(student.name ?? student.email ?? '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-title-sm font-semibold text-ink">
                        {student.name ?? student.email}
                      </p>
                      <p className="truncate text-label-sm text-ink-muted">
                        {[student.studentId ?? '—', student.isCr === true ? 'CR' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {student.isCr !== true && (
                      <IconButton
                        icon="person_add"
                        label="Assign as CR"
                        onClick={() => grantCr(student)}
                      />
                    )}
                    <IconButton
                      icon="swap_horiz"
                      label="Move to another section"
                      onClick={() => setMoveFor(student)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Range dialog */}
      {ruleDialog && (
        <RuleDialog
          rule={ruleDialog.rule}
          busy={ruleBusy}
          onCancel={() => setRuleDialog(null)}
          onSave={saveRule}
        />
      )}

      <ConfirmDialog
        open={deleteRule != null}
        title="Remove range?"
        message={deleteRule ? `${ruleLabel(deleteRule)} will stop enforcing section membership.` : ''}
        confirmLabel="Remove"
        danger
        onConfirm={removeRule}
        onCancel={() => setDeleteRule(null)}
      />

      <ConfirmDialog
        open={removeCrTarget != null}
        title="Remove CR?"
        message={
          removeCrTarget
            ? `${removeCrTarget.name} will lose CR permissions for ${title} immediately.`
            : ''
        }
        confirmLabel="Remove"
        danger
        onConfirm={revokeCr}
        onCancel={() => setRemoveCrTarget(null)}
      />

      {/* Apply result */}
      {applyResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
          onClick={() => setApplyResult(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-title-lg font-bold text-ink">Assignment complete</p>
            <p className="mt-2 text-body-md text-ink">
              {applyResult.assignedCount} student(s) moved into {title}.
            </p>
            <p className="mt-1 text-body-sm text-ink-muted">
              {applyResult.alreadyAssignedCount} already belonged to this section and were
              skipped.
            </p>
            <div className="mt-5 flex justify-end">
              <Button variant="filled" onClick={() => setApplyResult(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign CR picker */}
      {assignSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
          onClick={() => setAssignSheet(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-2 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 pb-1 pt-3 text-title-lg font-bold text-ink">Assign CR</p>
            {candidates.map((student) => (
              <button
                key={studentIdOf(student)}
                type="button"
                onClick={() => grantCr(student)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left hover:bg-surface-variant"
              >
                <Icon name="person" size={20} className="text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-lg text-ink">
                    {student.name ?? student.email}
                  </span>
                  <span className="block truncate text-label-sm text-ink-muted">
                    {student.studentId ?? '—'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Move picker */}
      {moveFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
          onClick={() => setMoveFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-surface p-2 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 pb-1 pt-3 text-title-sm font-semibold text-ink">
              {moveFor.isCr === true
                ? `Moving a CR revokes their CR grant. Move ${
                    moveFor.name ?? moveFor.studentId
                  } to:`
                : `Move ${moveFor.name ?? moveFor.studentId} to:`}
            </p>
            {otherSections.length === 0 ? (
              <p className="px-4 pb-4 text-body-md text-ink-muted">
                No other sections available in your scope
              </p>
            ) : (
              otherSections.map((target) => (
                <button
                  key={sectionIdOf(target)}
                  type="button"
                  onClick={() => confirmMove(target)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left hover:bg-surface-variant"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-md font-bold text-primary dark:text-primary-light">
                    {String(target.name ?? '?').toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-lg text-ink">
                    {target.label ?? target.name ?? ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
