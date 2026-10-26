// Students — port of coordinator_students_screen.dart.
// Global search within scope: filter by section, query by ID/name/email, and
// act (profile / move / assign-remove CR).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
  TextField,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  assignCR,
  getCoordinatorSections,
  getCoordinatorStudents,
  moveStudent,
  removeCR,
} from '../../api/endpoints.js';
import { coordinatorSections, coordinatorStudents } from '../../data/seedData.js';
import { isOfflineSession } from '../../lib/session.js';
import { sectionIdOf } from './CoordinatorAcademicsPage.jsx';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const studentIdOf = (student) => String(student?._id ?? student?.id ?? '');

const studentSectionId = (student) => {
  if (student?._sectionId != null) return String(student._sectionId);
  const section = student?.sectionId ?? student?.section;
  return String(
    section && typeof section === 'object' ? section?._id ?? section?.id ?? '' : section ?? ''
  );
};

const studentSectionLabel = (student, sections) => {
  if (student?._sectionLabel) return student._sectionLabel;
  const raw = student?.sectionId ?? student?.section;
  const id = studentSectionId(student);
  const match = sections.find((section) => sectionIdOf(section) === id);
  if (match) return match.label ?? match.name ?? '-';
  return raw && typeof raw === 'object' ? raw.label ?? raw.name ?? '-' : '-';
};

export default function CoordinatorStudentsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState(null);
  const [crOnly, setCrOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [actionsFor, setActionsFor] = useState(null);
  const [profileFor, setProfileFor] = useState(null);
  const [moveFor, setMoveFor] = useState(null);
  const [pending, setPending] = useState(null); // { kind, student, section? }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isOfflineSession()) {
      const seedSections = coordinatorSections();
      setSections(seedSections);
      setStudents(
        coordinatorStudents().map((student) => ({
          ...student,
          _sectionId: student.section?.id ?? '',
          _sectionLabel: student.section?.label ?? student.section?.name ?? '',
        }))
      );
      setLoading(false);
      return;
    }

    try {
      const sectionsRes = await getCoordinatorSections();
      const sectionList = toArray(extractPayload(sectionsRes));
      setSections(sectionList);

      // One broken section must never blank the whole roster — collect what
      // loads and surface an honest partial-failure notice.
      let failedSections = 0;
      const rosters = await Promise.all(
        sectionList.map(async (section) => {
          const id = sectionIdOf(section);
          try {
            const response = await getCoordinatorStudents({ sectionId: id });
            return toArray(extractPayload(response)).map((student) => ({
              ...student,
              _sectionId: id,
              _sectionLabel: section.label ?? section.name ?? '',
            }));
          } catch {
            failedSections += 1;
            return [];
          }
        })
      );

      setStudents(rosters.flat());
      setLoading(false);
      if (failedSections > 0) {
        toast.info(`${failedSections} section roster(s) could not be loaded`);
      }
    } catch (loadError) {
      setError(describeApiError(loadError));
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students
      .filter((student) => {
        if (sectionFilter != null && studentSectionId(student) !== sectionFilter) return false;
        if (crOnly && student.isCr !== true) return false;
        if (!query) return true;
        return [student.studentId, student.name, student.email].some((value) =>
          String(value ?? '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => String(a.studentId ?? '').localeCompare(String(b.studentId ?? '')));
  }, [students, search, sectionFilter, crOnly]);

  const requireOnline = () => {
    if (isOfflineSession()) {
      toast.info('This action requires a connection.');
      return false;
    }
    return true;
  };

  const performMove = async () => {
    const { student, section } = pending;
    setPending(null);
    if (!requireOnline()) return;
    try {
      await moveStudent({
        studentId: studentIdOf(student),
        targetSectionId: sectionIdOf(section),
      });
      toast.success('Student moved');
      load();
    } catch (actionError) {
      toast.error(describeApiError(actionError));
    }
  };

  const performCrChange = async () => {
    const { kind, student } = pending;
    setPending(null);
    if (!requireOnline()) return;
    try {
      if (kind === 'assign_cr') {
        await assignCR(studentIdOf(student), studentSectionId(student));
        toast.success('CR assigned');
      } else {
        await removeCR(studentIdOf(student), studentSectionId(student));
        toast.success('CR removed');
      }
      load();
    } catch (actionError) {
      toast.error(describeApiError(actionError));
    }
  };

  const confirmText =
    pending?.kind === 'move'
      ? `ID ${pending.student.studentId} moves from the current section into ${
          pending.section.label ?? pending.section.name
        }. Their effective schedule changes.`
      : pending?.kind === 'assign_cr'
        ? `ID ${pending?.student?.studentId} gains CR permissions for their own section.`
        : `ID ${pending?.student?.studentId} stays a normal student; account and section remain unchanged.`;

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title="Students" onBack={() => navigate(-1)} />

      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        hint="Search ID, name or email"
        icon="search"
      />

      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setSectionFilter(null)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-lg font-medium transition-colors ${
            sectionFilter == null
              ? 'border-primary bg-primary/10 text-primary dark:text-primary-light'
              : 'border-outline text-ink-muted hover:text-ink'
          }`}
        >
          All
        </button>
        {sections.map((section) => {
          const id = sectionIdOf(section);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSectionFilter((current) => (current === id ? null : id))}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-lg font-medium transition-colors ${
                sectionFilter === id
                  ? 'border-primary bg-primary/10 text-primary dark:text-primary-light'
                  : 'border-outline text-ink-muted hover:text-ink'
              }`}
            >
              {section.label ?? section.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCrOnly((current) => !current)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-lg font-medium transition-colors ${
            crOnly
              ? 'border-success bg-success/10 text-success'
              : 'border-outline text-ink-muted hover:text-ink'
          }`}
        >
          CR only
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <Card className="mt-3">
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-body-md text-ink-muted">No students match.</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {filtered.map((student) => (
            <button
              key={studentIdOf(student)}
              type="button"
              onClick={() => setActionsFor(student)}
              className="flex w-full items-center gap-3 rounded-2xl border border-outline/60 bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-primary/50"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-md font-bold text-ink ${
                  student.isCr === true ? 'bg-success/20' : 'bg-primary/15'
                }`}
              >
                {String(student.studentId ?? '?').charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-title-sm text-ink">
                    {student.studentId ?? '-'} · {student.name ?? ''}
                  </span>
                  {student.isCr === true && (
                    <span className="shrink-0 rounded-full bg-success/20 px-1.5 py-0.5 text-label-sm font-bold text-success">
                      CR
                    </span>
                  )}
                </span>
                <span className="block truncate text-label-sm text-ink-muted">
                  {studentSectionLabel(student, sections)}
                </span>
              </span>
              <Icon name="chevron_right" size={20} className="shrink-0 text-ink-muted" />
            </button>
          ))}
        </div>
      )}

      {/* Action sheet */}
      {actionsFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
          onClick={() => setActionsFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-surface p-2 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 pb-1 pt-3 text-label-md font-semibold text-ink-muted">
              {actionsFor.studentId} · {actionsFor.name}
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-body-lg text-ink hover:bg-surface-variant"
              onClick={() => {
                setProfileFor(actionsFor);
                setActionsFor(null);
              }}
            >
              <Icon name="person_search" size={20} className="text-primary dark:text-primary-light" />
              View academic profile
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-body-lg text-ink hover:bg-surface-variant"
              onClick={() => {
                setMoveFor(actionsFor);
                setActionsFor(null);
              }}
            >
              <Icon name="swap_horiz" size={20} className="text-primary dark:text-primary-light" />
              Move to another section
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-body-lg text-ink hover:bg-surface-variant"
              onClick={() => {
                setPending({
                  kind: actionsFor.isCr === true ? 'remove_cr' : 'assign_cr',
                  student: actionsFor,
                });
                setActionsFor(null);
              }}
            >
              <Icon
                name={actionsFor.isCr === true ? 'remove_moderator' : 'add_moderator'}
                size={20}
                className={actionsFor.isCr === true ? 'text-critical' : 'text-success'}
              />
              {actionsFor.isCr === true ? 'Remove CR privileges' : 'Assign as CR'}
            </button>
          </div>
        </div>
      )}

      {/* Student profile sheet */}
      {profileFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
          onClick={() => setProfileFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-title-lg font-bold text-ink">Student profile</p>
            <div className="flex flex-col items-center">
              <Avatar name={profileFor.studentId ?? '?'} size={64} />
              <p className="mt-2 text-title-lg font-bold text-ink">{profileFor.name ?? ''}</p>
              <p className="text-body-sm text-ink-muted">{profileFor.email ?? ''}</p>
            </div>
            <div className="my-3 h-px bg-outline/60" />
            {[
              ['Student ID', profileFor.studentId ?? '-'],
              ['Role', profileFor.isCr === true ? 'Student + CR' : 'Student'],
              ['Section', studentSectionLabel(profileFor, sections)],
              ['Account status', profileFor.isActive === false ? 'Inactive' : 'Active'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 py-1.5">
                <span className="text-body-md text-ink-muted">{label}</span>
                <span className="text-right text-body-md font-semibold text-ink">{value}</span>
              </div>
            ))}
            <Button
              variant="outlined"
              className="mt-4 w-full"
              onClick={() => setProfileFor(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Move target picker */}
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
            <p className="px-4 pb-2 pt-3 text-title-lg font-bold text-ink">Move student to…</p>
            {sections.filter((section) => sectionIdOf(section) !== studentSectionId(moveFor)).length ===
            0 ? (
              <p className="px-4 pb-4 text-body-md text-ink-muted">No other sections available.</p>
            ) : (
              sections
                .filter((section) => sectionIdOf(section) !== studentSectionId(moveFor))
                .map((section) => (
                  <button
                    key={sectionIdOf(section)}
                    type="button"
                    onClick={() => {
                      setPending({ kind: 'move', student: moveFor, section });
                      setMoveFor(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-body-lg text-ink hover:bg-surface-variant"
                  >
                    <Icon name="swap_horiz" size={19} className="text-primary dark:text-primary-light" />
                    {section.label ?? section.name}
                  </button>
                ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending != null}
        title={
          pending?.kind === 'move'
            ? 'Move student?'
            : pending?.kind === 'assign_cr'
              ? 'Assign as CR?'
              : 'Remove CR privileges?'
        }
        message={confirmText}
        confirmLabel={
          pending?.kind === 'move'
            ? 'Confirm move'
            : pending?.kind === 'assign_cr'
              ? 'Grant CR'
              : 'Remove CR'
        }
        danger={pending?.kind === 'remove_cr'}
        onConfirm={pending?.kind === 'move' ? performMove : performCrChange}
        onCancel={() => setPending(null)}
      />
    </PageShell>
  );
}
