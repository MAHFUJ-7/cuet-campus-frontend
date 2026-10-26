// Routine Import Review — port of coordinator_routine_review_screen.dart.
// Shows exactly what the model read from the routine PDF, flags unknown course
// codes, and publishes only after an explicit coordinator decision.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  getCourses,
  getRoutineExtraction,
  publishRoutinePdf,
} from '../../api/endpoints.js';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const TYPE_TONE = {
  lab: 'bg-lab',
  sessional: 'bg-warning',
  tutorial: 'bg-tutorial',
};

export default function CoordinatorRoutineReviewPage() {
  const { id: pdfId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const [extraction, setExtraction] = useState(null);
  const [courseCodes, setCourseCodes] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(
    async (options = {}) => {
      const silent = options?.silent === true;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [extractionRes, coursesRes] = await Promise.all([
          getRoutineExtraction(pdfId),
          getCourses({ departmentId: auth.profile?.department?.id }),
        ]);

        const extractionPayload = extractPayload(extractionRes);
        const courseList = toArray(extractPayload(coursesRes));

        setExtraction(
          extractionPayload && typeof extractionPayload === 'object'
            ? extractionPayload
            : null
        );
        setCourseCodes(
          new Set(
            courseList
              .map((course) =>
                String(course?.code ?? '')
                  .trim()
                  .toUpperCase()
              )
              .filter(Boolean)
          )
        );
        setLoading(false);
      } catch (loadError) {
        setError(describeApiError(loadError));
        setLoading(false);
      }
    },
    [pdfId, auth.profile?.department?.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  // The server extracts asynchronously — keep polling while it works.
  const status = String(extraction?.status ?? '');
  const processing = status === 'pending' || status === 'processing';

  useEffect(() => {
    if (!processing) return undefined;
    const timer = window.setInterval(() => load({ silent: true }), 4_000);
    return () => window.clearInterval(timer);
  }, [processing, load]);

  // Escape closes the publish confirmation.
  useEffect(() => {
    if (!confirmOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setConfirmOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmOpen]);

  const sections = useMemo(() => {
    const data = extraction?.data;
    if (!data || typeof data !== 'object') return [];
    return Array.isArray(data.sections) ? data.sections : [];
  }, [extraction]);

  const warnings = useMemo(() => {
    const data = extraction?.data;
    if (!data || typeof data !== 'object' || !Array.isArray(data.warnings)) return [];
    return data.warnings.map((warning) => String(warning));
  }, [extraction]);

  const totalEntries = useMemo(
    () =>
      sections.reduce(
        (sum, section) => sum + (Array.isArray(section?.entries) ? section.entries.length : 0),
        0
      ),
    [sections]
  );

  const unknownCodes = useMemo(() => {
    const unknown = new Set();
    for (const section of sections) {
      for (const entry of Array.isArray(section?.entries) ? section.entries : []) {
        const code = String(entry?.courseCode ?? '')
          .trim()
          .toUpperCase();
        if (code && !courseCodes.has(code)) unknown.add(code);
      }
    }
    return unknown;
  }, [sections, courseCodes]);

  const publish = async () => {
    setConfirmOpen(false);
    if (publishing) return;

    setPublishing(true);
    try {
      const payloadSections = sections.map((section) => ({
        name: section?.name,
        entries: (Array.isArray(section?.entries) ? section.entries : []).filter(
          (entry) =>
            String(entry?.courseCode ?? '')
              .trim()
              .length > 0
        ),
      }));
      const expectedEntries = payloadSections.reduce(
        (sum, section) => sum + section.entries.length,
        0
      );

      const response = await publishRoutinePdf(pdfId, {
        sections: payloadSections,
        replace: true,
      });
      const data = extractPayload(response) ?? {};
      const unresolved = toArray(data.unresolvedCourses).join(', ');
      const published = Number(data.published) || 0;
      const fullMatch = published === expectedEntries && !unresolved;

      const message =
        `Published ${published} of ${expectedEntries} entries` +
        (unresolved ? ` • unresolved: ${unresolved}` : '') +
        (fullMatch ? '' : ' — review the Conflict Center');

      if (fullMatch) toast.success(message);
      else toast.warning(message);

      navigate(-1);
    } catch (publishError) {
      toast.error(describeApiError(publishError));
    } finally {
      setPublishing(false);
    }
  };

  const failed = extraction?.status === 'failed';

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Routine Import Review"
        onBack={() => navigate(-1)}
        actions={
          <Button variant="text" icon="refresh" onClick={() => load()}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="max-w-md text-body-md text-ink-muted">{error}</p>
          <Button variant="filled" onClick={() => load()}>
            Retry
          </Button>
        </div>
      ) : failed ? (
        <Card>
          <div className="flex flex-col items-center py-4 text-center">
            <Icon name="error" size={42} className="text-critical" />
            <p className="mt-2 text-title-md font-bold text-ink">Extraction failed</p>
            <p className="mt-1 text-body-sm text-ink-muted">
              {extraction?.error ?? 'Unknown error'}
            </p>
          </div>
        </Card>
      ) : processing ? (
        <Card>
          <div className="flex flex-col items-center py-6 text-center">
            <Spinner size={32} />
            <p className="mt-3 text-title-md font-bold text-ink">Extraction in progress</p>
            <p className="mt-1 max-w-sm text-body-sm text-ink-muted">
              The AI is reading the PDF. This usually takes under a minute — the page
              refreshes automatically.
            </p>
          </div>
        </Card>
      ) : !extraction || sections.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-6 text-center">
            <Icon name="find_in_page" size={42} className="text-ink-muted" />
            <p className="mt-2 text-title-md font-bold text-ink">Nothing to review</p>
            <p className="mt-1 max-w-sm text-body-sm text-ink-muted">
              No extracted data for this PDF yet. Run “AI Extract &amp; Review” from the
              Official Routine PDF screen first.
            </p>
          </div>
        </Card>
      ) : (
        <div>
          {/* Summary header */}
          <Card>
            <div className="flex items-center gap-2.5">
              <Icon name="fact_check" size={24} className="shrink-0 text-success" />
              <p className="min-w-0 flex-1 truncate text-title-lg font-bold text-ink">
                {extraction?.data?.title ?? 'Class Routine'}
              </p>
            </div>

            <div className="my-3 h-px bg-outline/60" />

            <div className="flex flex-wrap gap-2">
              {[`${sections.length} sections`, `${totalEntries} entries`, `${extraction?.data?.stats?.labs ?? 0} labs/sessional`].map(
                (text) => (
                  <span
                    key={text}
                    className="inline-flex items-center gap-1 rounded-full border border-outline/60 px-2.5 py-1 text-label-sm text-ink"
                  >
                    <Icon name="check_circle" size={14} className="text-success" />
                    {text}
                  </span>
                )
              )}
              {unknownCodes.size === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-outline/60 px-2.5 py-1 text-label-sm text-ink">
                  <Icon name="check_circle" size={14} className="text-success" />
                  All courses known
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-label-sm font-medium text-warning">
                  <Icon name="warning" size={14} />
                  {unknownCodes.size} unknown code(s)
                </span>
              )}
              {warnings.map((warning, index) => (
                <span
                  key={`${warning}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2.5 py-1 text-label-sm text-info"
                >
                  <Icon name="info" size={14} />
                  {warning}
                </span>
              ))}
            </div>
          </Card>

          {unknownCodes.size > 0 && (
            <p className="mt-3 text-body-sm text-warning">
              Unresolved course codes must be added to Courses before they can publish.
            </p>
          )}

          {/* Per-section extracted entries */}
          {sections.map((section, sectionIndex) => {
            const entries = Array.isArray(section?.entries) ? section.entries : [];
            return (
              <div key={`${section?.name ?? 'section'}-${sectionIndex}`} className="mt-4">
                <p className="text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
                  SECTION {section?.name ?? '?'}
                </p>
                <Card padded={false} className="mt-1.5 divide-y divide-outline/50 overflow-hidden">
                  {entries.length === 0 ? (
                    <p className="p-4 text-body-sm text-ink-muted">No entries extracted</p>
                  ) : (
                    entries.map((entry, entryIndex) => {
                      const code = String(entry?.courseCode ?? '')
                        .trim()
                        .toUpperCase();
                      const known = code.length > 0 && !unknownCodes.has(code);
                      const typeTone = TYPE_TONE[String(entry?.classType ?? '')] ?? 'bg-primary-light';
                      return (
                        <div
                          key={`${code}-${entryIndex}`}
                          className="flex items-start gap-3 px-3.5 py-2.5"
                        >
                          <span className={`mt-1 h-9 w-1 shrink-0 rounded-full ${typeTone}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="min-w-0 flex-1 truncate text-title-sm font-semibold text-ink">
                                {entry?.courseCode ?? '(no code)'}
                                {entry?.courseTitle != null
                                  ? ` — ${entry.courseTitle}`
                                  : ''}
                              </p>
                              {!known && (
                                <Icon name="help" size={15} className="shrink-0 text-warning" />
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-label-sm text-ink-muted">
                              {entry?.day} · P{entry?.period} · {entry?.startTime}-
                              {entry?.endTime}
                              {entry?.room != null ? ` · ${entry.room}` : ' · no room'}
                              {entry?.instructor != null ? ` · ${entry.instructor}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </Card>
              </div>
            );
          })}

          <Button
            variant="filled"
            size="lg"
            className="mt-5 w-full"
            icon="cloud_upload"
            onClick={() => setConfirmOpen(true)}
            disabled={sections.length === 0 || publishing}
            loading={publishing}
          >
            Publish as Official Routine
          </Button>
        </div>
      )}

      {/* Publish confirmation */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
          onClick={() => setConfirmOpen(false)}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="publish-confirm-title"
            className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="publish-confirm-title" className="text-title-lg font-bold text-ink">
              Publish official routine?
            </p>
            <p className="mt-2 text-body-md text-ink">
              {totalEntries - unknownCodes.size} entries across {sections.length} section(s)
              will be written.
            </p>
            {unknownCodes.size > 0 && (
              <p className="mt-2 text-body-sm text-warning">
                Unknown codes will be skipped: {[...unknownCodes].join(', ')}
              </p>
            )}
            <p className="mt-2 text-body-sm text-ink-muted">
              Existing official rows for matched sections are archived and replaced.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="text" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="filled" onClick={publish}>
                Publish
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
