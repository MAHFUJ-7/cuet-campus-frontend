// Official Routine PDF — port of coordinator_routine_pdf_screen.dart.
// Status card, upload (replaces current), AI extraction trigger, removal and
// an in-app PDF viewer (authed binary fetch → object URL → pdf.js canvas).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  deleteRoutinePdf,
  downloadRoutinePdf,
  extractRoutinePdf,
  createRoutine,
  deleteRoutine,
  getCoordinatorSections,
  getCourses,
  getTeachers,
  getLatestRoutinePdf,
  getWeeklyRoutine,
  updateRoutine,
  uploadRoutinePdf,
} from '../../api/endpoints.js';
import PdfViewerModal from '../../components/PdfViewerModal.jsx';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const EMPTY_ENTRY = {
  courseId: '',
  teacherId: '',
  day: 'Sunday',
  period: 1,
  startTime: '08:10',
  endTime: '09:00',
  room: '',
  classType: 'lecture',
};

const formatSize = (bytes) => {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

function RoutineEntryForm({
  entryForm,
  setEntryForm,
  courses,
  teachers,
  onSubmit,
  onCancel,
  saving,
  editing,
}) {
  const fieldClass =
    'w-full rounded-xl border border-outline bg-surface px-3 py-2.5 text-body-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <select
        required
        value={entryForm.courseId}
        onChange={(event) => setEntryForm((old) => ({ ...old, courseId: event.target.value }))}
        className={fieldClass}
      >
        <option value="">Select course</option>
        {courses.map((course) => (
          <option key={course._id ?? course.id} value={course._id ?? course.id}>
            {course.code} — {course.title}
          </option>
        ))}
      </select>
      <select
        value={entryForm.teacherId}
        onChange={(event) => setEntryForm((old) => ({ ...old, teacherId: event.target.value }))}
        className={fieldClass}
      >
        <option value="">No teacher assigned</option>
        {teachers.map((teacher) => (
          <option key={teacher._id ?? teacher.id} value={teacher._id ?? teacher.id}>
            {teacher.name}
          </option>
        ))}
      </select>
      <select
        value={entryForm.day}
        onChange={(event) => setEntryForm((old) => ({ ...old, day: event.target.value }))}
        className={fieldClass}
      >
        {DAYS.map((day) => <option key={day}>{day}</option>)}
      </select>
      <input
        type="number"
        min="1"
        max="12"
        required
        value={entryForm.period}
        onChange={(event) => setEntryForm((old) => ({ ...old, period: event.target.value }))}
        placeholder="Period"
        className={fieldClass}
      />
      <input
        type="time"
        required
        value={entryForm.startTime}
        onChange={(event) => setEntryForm((old) => ({ ...old, startTime: event.target.value }))}
        className={fieldClass}
      />
      <input
        type="time"
        required
        value={entryForm.endTime}
        onChange={(event) => setEntryForm((old) => ({ ...old, endTime: event.target.value }))}
        className={fieldClass}
      />
      <input
        value={entryForm.room}
        onChange={(event) => setEntryForm((old) => ({ ...old, room: event.target.value }))}
        placeholder="Room"
        className={fieldClass}
      />
      <select
        value={entryForm.classType}
        onChange={(event) => setEntryForm((old) => ({ ...old, classType: event.target.value }))}
        className={fieldClass}
      >
        <option value="lecture">Lecture</option>
        <option value="lab">Lab</option>
        <option value="sessional">Sessional</option>
      </select>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel && (
          <Button type="button" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="filled" disabled={saving}>
          {saving ? <Spinner size={16} /> : null}
          {editing ? 'Save Changes' : 'Generate Entry'}
        </Button>
      </div>
    </form>
  );
}

export default function CoordinatorRoutinePdfPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [pdfUrl, setPdfUrl] = useState(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(null);
  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [routineEntries, setRoutineEntries] = useState([]);
  const [routineLoading, setRoutineLoading] = useState(false);
  const [routineError, setRoutineError] = useState(null);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [confirmEntryRemove, setConfirmEntryRemove] = useState(null);
  const [savingEntry, setSavingEntry] = useState(false);

  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const response = await getLatestRoutinePdf();
      const payload = extractPayload(response);
      setInfo(payload && typeof payload === 'object' ? payload : null);
      setInfoError(null);
    } catch (error) {
      // 404 means nothing is uploaded yet — anything else is a real failure
      // and must not masquerade as an empty state.
      if (error?.status === 404) {
        setInfo(null);
        setInfoError(null);
      } else {
        setInfoError(describeApiError(error));
      }
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const loadRoutineOptions = useCallback(async () => {
    try {
      const [sectionsRes, coursesRes, teachersRes] = await Promise.all([
        getCoordinatorSections(),
        getCourses({ departmentId: undefined }),
        getTeachers({ departmentId: undefined }),
      ]);
      const readList = (response) => {
        const payload = extractPayload(response);
        return Array.isArray(payload) ? payload : payload?.items ?? [];
      };
      const nextSections = readList(sectionsRes);
      setSections(nextSections);
      setCourses(readList(coursesRes));
      setTeachers(readList(teachersRes));
      setSelectedSectionId((current) => current || String(nextSections[0]?._id ?? nextSections[0]?.id ?? ''));
    } catch (error) {
      setRoutineError(describeApiError(error));
    }
  }, []);

  const loadRoutine = useCallback(async () => {
    if (!selectedSectionId) return;
    setRoutineLoading(true);
    try {
      const response = await getWeeklyRoutine({ sectionId: selectedSectionId });
      const payload = extractPayload(response);
      setRoutineEntries(Array.isArray(payload) ? payload : payload?.items ?? []);
      setRoutineError(null);
    } catch (error) {
      setRoutineError(describeApiError(error));
    } finally {
      setRoutineLoading(false);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    loadRoutineOptions();
  }, [loadRoutineOptions]);

  useEffect(() => {
    loadRoutine();
  }, [loadRoutine]);

  // Revoke the object URL on unmount / replacement.
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl]
  );

  const pickFile = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onFilePicked = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      toast.error('PDF too large. Maximum is 20 MB.');
      return;
    }

    setUploading(true);
    try {
      await uploadRoutinePdf(file, { title: 'Class Routine' });
      toast.success('Routine PDF published — previous version archived');
      // The old preview belongs to the replaced document — drop it.
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setOpenError(null);
      await loadInfo();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setUploading(false);
    }
  };

  const extractAndReview = async () => {
    const id = info?._id ?? info?.id;
    if (!id || extracting) return;
    setExtracting(true);
    try {
      await extractRoutinePdf(id);
      navigate(`/coordinator/routine-review/${id}`);
    } catch (error) {
      // Still open review — it renders the stored failure reason.
      navigate(`/coordinator/routine-review/${id}`);
      toast.error(describeApiError(error));
    } finally {
      setExtracting(false);
    }
  };

  const remove = async () => {
    const id = info?._id ?? info?.id;
    setConfirmRemove(false);
    if (!id) return;
    try {
      await deleteRoutinePdf(id);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      toast.success('Routine PDF removed');
      loadInfo();
    } catch (error) {
      toast.error(describeApiError(error));
    }
  };

  const openViewer = async () => {
    const id = info?._id ?? info?.id;
    if (!id || opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      const blob = await downloadRoutinePdf(id);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      setOpenError(describeApiError(error));
    } finally {
      setOpening(false);
    }
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    if (!selectedSectionId || savingEntry) return;
    setSavingEntry(true);
    try {
      const payload = {
        ...entryForm,
        sectionId: selectedSectionId,
        period: Number(entryForm.period),
        teacherId: entryForm.teacherId || null,
        room: entryForm.room || null,
      };
      if (editingEntryId) await updateRoutine(editingEntryId, payload);
      else await createRoutine(payload);
      toast.success(editingEntryId ? 'Routine entry updated' : 'Routine entry created');
      setEntryForm(EMPTY_ENTRY);
      setEditingEntryId(null);
      await loadRoutine();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setSavingEntry(false);
    }
  };

  const removeEntry = async (entry) => {
    const id = entry?._id ?? entry?.id;
    setConfirmEntryRemove(null);
    if (!id) return;
    try {
      await deleteRoutine(id);
      toast.success('Routine entry removed');
      await loadRoutine();
    } catch (error) {
      toast.error(describeApiError(error));
    }
  };

  const beginEdit = (entry) => {
    setEditingEntryId(entry._id ?? entry.id);
    setEntryForm({
      courseId: typeof entry.courseId === 'object' ? entry.courseId._id : entry.courseId ?? '',
      teacherId: typeof entry.teacherId === 'object' ? entry.teacherId._id : entry.teacherId ?? '',
      day: entry.day ?? 'Sunday',
      period: entry.period ?? 1,
      startTime: entry.startTime ?? '08:10',
      endTime: entry.endTime ?? '09:00',
      room: entry.room ?? '',
      classType: entry.classType ?? 'lecture',
    });
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setEntryForm(EMPTY_ENTRY);
  };

  // Surface the AI extraction state when the backend reports one.
  const rawStatus = info?.extraction?.status ?? info?.extractionStatus ?? info?.status;
  const extractionStatus = ['pending', 'processing', 'completed', 'failed'].includes(
    String(rawStatus ?? '')
  )
    ? String(rawStatus)
    : null;
  const statusTone =
    extractionStatus === 'failed'
      ? 'text-critical'
      : extractionStatus === 'completed'
        ? 'text-success'
        : 'text-warning';

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Official Routine PDF"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={loadInfo} />}
      />

      <Card>
        {loadingInfo ? (
          <div className="flex justify-center py-6">
            <Spinner size={26} />
          </div>
        ) : infoError && !info ? (
          <ErrorState message={infoError} onRetry={loadInfo} />
        ) : (
          <>
            {infoError && (
              <p className="mb-2.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-label-sm text-warning">
                {infoError}
              </p>
            )}
            <div className="flex items-center gap-2.5">
              <Icon
                name="picture_as_pdf"
                size={24}
                className={info ? 'shrink-0 text-critical' : 'shrink-0 text-ink-muted'}
              />
              <p className="min-w-0 flex-1 truncate text-title-sm font-bold text-ink">
                {info ? info.title ?? 'Class Routine' : 'No PDF uploaded yet'}
              </p>
            </div>

            {info && (
              <p className="mt-1 pl-[34px] text-label-sm text-ink-muted">
                {info.originalName ?? ''} • {formatSize(info.size)}
              </p>
            )}

            {info && extractionStatus && (
              <p className={`mt-1 pl-[34px] text-label-sm font-medium ${statusTone}`}>
                AI extraction: {extractionStatus}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                variant="tonal"
                className="flex-1"
                icon="visibility"
                onClick={openViewer}
                disabled={!info || opening}
              >
                View
              </Button>
              <Button
                variant="filled"
                className="flex-1"
                icon={uploading ? null : 'upload_file'}
                onClick={pickFile}
                disabled={uploading}
              >
                {uploading ? <Spinner size={16} /> : null}
                <span>{info ? 'Replace' : 'Upload'}</span>
              </Button>
            </div>

            {info && (
              <>
                <Button
                  variant="outlined"
                  className="mt-2 w-full"
                  icon={extracting ? null : 'auto_awesome'}
                  onClick={extractAndReview}
                  disabled={extracting}
                >
                  {extracting ? <Spinner size={16} /> : null}
                  <span>AI Extract & Review</span>
                </Button>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    className="mt-2 rounded-lg px-3 py-1.5 text-label-lg font-semibold text-critical transition-colors hover:bg-critical/5"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onFilePicked}
        />
      </Card>

      {/* Viewer prompt */}
      <p className="mt-4 text-center text-body-md text-ink-muted">
        Tap “View” to read the routine PDF inside the app.
      </p>
      {openError && (
        <p className="mt-2 text-center text-label-md text-critical">{openError}</p>
      )}

      <PdfViewerModal
        open={Boolean(pdfUrl)}
        title={info?.title ?? 'Class Routine'}
        src={pdfUrl}
        onClose={() => {
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl(null);
        }}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove routine PDF?"
        message="Students will no longer see the official PDF until a new one is uploaded."
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />

      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-title-md font-bold text-ink">Manual Routine Generator</h2>
            <p className="text-label-sm text-ink-muted">
              Create, edit, or remove official routine entries by section.
            </p>
          </div>
          <select
            value={selectedSectionId}
            onChange={(event) => {
              setSelectedSectionId(event.target.value);
              setEditingEntryId(null);
              setEntryForm(EMPTY_ENTRY);
            }}
            className="rounded-xl border border-outline bg-surface px-3 py-2 text-body-sm text-ink"
          >
            {sections.map((section) => (
              <option key={section._id ?? section.id} value={section._id ?? section.id}>
                {section.label ?? `Section ${section.name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Icon name="add_circle" size={20} className="text-primary" />
            <p className="text-label-lg font-semibold text-ink">Add routine entry</p>
          </div>
          <RoutineEntryForm
            entryForm={entryForm}
            setEntryForm={setEntryForm}
            courses={courses}
            teachers={teachers}
            onSubmit={saveEntry}
            saving={savingEntry || Boolean(editingEntryId) || !selectedSectionId}
            editing={false}
          />
        </div>

        {routineError && <p className="mt-3 text-label-sm text-critical">{routineError}</p>}
        <div className="mt-5 space-y-2">
          {routineLoading ? <Spinner size={22} /> : routineEntries.length === 0 ? (
            <p className="text-label-sm text-ink-muted">No routine entries for this section.</p>
          ) : routineEntries.map((entry) => (
            <div key={entry._id ?? entry.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-outline/60 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{entry.course?.code ?? 'Course'} · P{entry.period}</p>
                <p className="text-label-sm text-ink-muted">
                  {entry.day} · {entry.startTime}–{entry.endTime} · {entry.room || 'Room not set'}
                </p>
              </div>
              <Button type="button" variant="tonal" icon="edit" onClick={() => beginEdit(entry)}>Edit</Button>
              <Button type="button" variant="outlined" icon="delete" onClick={() => setConfirmEntryRemove(entry)}>Remove</Button>
            </div>
          ))}
        </div>
      </Card>

      {editingEntryId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={cancelEdit}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-routine-entry-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon name="edit_calendar" size={23} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="edit-routine-entry-title" className="text-title-lg font-bold text-ink">
                  Edit routine entry
                </h2>
                <p className="mt-1 text-body-sm text-ink-muted">
                  Update the class details for the selected section.
                </p>
              </div>
              <IconButton icon="close" label="Close editor" onClick={cancelEdit} />
            </div>
            <RoutineEntryForm
              entryForm={entryForm}
              setEntryForm={setEntryForm}
              courses={courses}
              teachers={teachers}
              onSubmit={saveEntry}
              onCancel={cancelEdit}
              saving={savingEntry}
              editing
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmEntryRemove)}
        title="Remove routine entry?"
        message="This class will be removed from the selected section's official routine."
        confirmLabel="Remove"
        danger
        onConfirm={() => removeEntry(confirmEntryRemove)}
        onCancel={() => setConfirmEntryRemove(null)}
      />
    </PageShell>
  );
}
