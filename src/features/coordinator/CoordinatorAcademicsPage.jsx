// Academics hub — port of coordinator_academics_screen.dart.
// Sections, roster, routine PDF, exams, courses, quality and audit.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  getCoordinatorSections,
  getCourses,
  getLatestRoutinePdf,
} from '../../api/endpoints.js';
import { coordinatorCourses, coordinatorSections } from '../../data/seedData.js';
import { isOfflineSession } from '../../lib/session.js';
import { useSelectedTerm } from './coordinatorState.js';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

export const sectionIdOf = (section) => String(section?._id ?? section?.id ?? '');

export const sectionTermIdOf = (section) => {
  const term = section?.termId;
  return typeof term === 'object'
    ? String(term?._id ?? term?.id ?? '')
    : String(term ?? '');
};

function ManageTile({ icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start justify-center rounded-2xl border border-outline/60 bg-surface p-3 text-left transition-colors hover:border-primary/50"
    >
      <Icon name={icon} size={24} className="text-primary dark:text-primary-light" />
      <span className="mt-1.5 text-title-sm font-bold text-ink">{title}</span>
      <span className="w-full truncate text-label-sm text-ink-muted">{subtitle}</span>
    </button>
  );
}

export default function CoordinatorAcademicsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [termId] = useSelectedTerm();

  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [routinePdf, setRoutinePdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const departmentId = auth.profile?.department?.id;
      const [sectionsRes, coursesRes] = await Promise.all([
        getCoordinatorSections(),
        getCourses({ departmentId }),
      ]);

      const allSections = toArray(extractPayload(sectionsRes));
      const allCourses = toArray(extractPayload(coursesRes));

      // Routine PDF may not exist yet (404) — that is a normal state.
      let pdf = null;
      try {
        const pdfRes = await getLatestRoutinePdf();
        const pdfData = extractPayload(pdfRes);
        if (pdfData && typeof pdfData === 'object') pdf = pdfData;
      } catch {
        pdf = null;
      }

      setSections(allSections);
      setCourses(allCourses);
      setRoutinePdf(pdf);
      setLoading(false);
    } catch (loadError) {
      if (isOfflineSession()) {
        setSections(coordinatorSections());
        setCourses(coordinatorCourses());
        setRoutinePdf(null);
        setLoading(false);
        return;
      }
      setError(describeApiError(loadError));
      setLoading(false);
    }
  }, [auth.profile?.department?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleSections = useMemo(
    () =>
      termId == null
        ? sections
        : sections.filter((section) => sectionTermIdOf(section) === String(termId)),
    [sections, termId]
  );

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title="Academics" />

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <Spinner size={32} />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : (
        <div>
          <p className="text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
            MANAGE
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            <ManageTile
              icon="groups_2"
              title="Students"
              subtitle="Search · move · CRs"
              onClick={() => navigate('/coordinator/students')}
            />
            <ManageTile
              icon="quiz"
              title="Exam routine"
              subtitle="Publish & edit exams"
              onClick={() => navigate('/coordinator/exams')}
            />
            <ManageTile
              icon="rule_folder"
              title="Conflicts"
              subtitle="Quality & clashes"
              onClick={() => navigate('/coordinator/quality')}
            />
            <ManageTile
              icon="history_edu"
              title="Audit log"
              subtitle="Scoped history"
              onClick={() => navigate('/coordinator/audit')}
            />
          </div>

          <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
            OFFICIAL ROUTINE PDF
          </p>
          <button
            type="button"
            onClick={() => navigate('/coordinator/routine-pdf')}
            className="mt-1.5 flex w-full items-center gap-3 rounded-2xl border border-outline/60 bg-surface p-3.5 text-left transition-colors hover:border-primary/50"
          >
            <Icon
              name={routinePdf ? 'picture_as_pdf' : 'upload_file'}
              size={24}
              className={routinePdf ? 'shrink-0 text-critical' : 'shrink-0 text-primary dark:text-primary-light'}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-title-sm font-semibold text-ink">
                {routinePdf ? routinePdf.title ?? 'Class Routine' : 'No routine PDF uploaded'}
              </span>
              <span className="block truncate text-body-sm text-ink-muted">
                {routinePdf
                  ? routinePdf.originalName ?? ''
                  : 'Upload the official routine covering every section'}
              </span>
            </span>
            <Icon name="chevron_right" size={20} className="shrink-0 text-ink-muted" />
          </button>

          <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
            SECTIONS ({visibleSections.length})
          </p>
          <div className="mt-1.5 space-y-2">
            {visibleSections.length === 0 ? (
              <EmptyState
                icon="domain_disabled"
                title="No sections"
                message="No sections are configured within this scope yet."
              />
            ) : (
              visibleSections.map((section) => (
                <button
                  key={sectionIdOf(section)}
                  type="button"
                  onClick={() =>
                    navigate(`/coordinator/section/${sectionIdOf(section)}`, {
                      state: { section },
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-outline/60 bg-surface p-3.5 text-left transition-colors hover:border-primary/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-lg font-bold text-primary dark:text-primary-light">
                    {String(section.name ?? '?').toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-title-sm font-semibold text-ink">
                      {section.label ?? section.name ?? ''}
                    </span>
                    <span className="block text-body-sm text-ink-muted">
                      ID ranges · roster · CRs
                    </span>
                  </span>
                  <Icon name="chevron_right" size={20} className="shrink-0 text-ink-muted" />
                </button>
              ))
            )}
          </div>

          <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
            COURSES ({courses.length})
          </p>
          <div className="mt-1.5 space-y-2">
            {courses.map((course) => {
              const instructors = course.instructorIds ?? course.instructors ?? [];
              const names = (Array.isArray(instructors) ? instructors : [])
                .map((teacher) => (teacher && typeof teacher === 'object' ? teacher.name : null))
                .filter(Boolean);
              return (
                <div
                  key={course._id ?? course.id ?? course.code}
                  className="flex items-center gap-3 rounded-2xl border border-outline/60 bg-surface px-3.5 py-2.5"
                >
                  <Icon name="menu_book" size={20} className="shrink-0 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-title-sm font-semibold text-ink">
                      {course.code ?? ''} — {course.title ?? ''}
                    </p>
                    <p className="truncate text-label-md text-ink-muted">
                      {names.length === 0
                        ? 'Instructor not specified'
                        : names.length === 1
                          ? names[0]
                          : `Multiple instructors (${names.join(', ')})`}
                    </p>
                  </div>
                  <span className="shrink-0 text-label-sm text-ink-muted">
                    {course.credits ?? ''} cr
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageShell>
  );
}
