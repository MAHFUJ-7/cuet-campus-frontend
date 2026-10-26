// My Attendance — port of attendance_screen.dart + attendance_provider.dart.
// Personal tracker derived from the Effective Schedule. Default = PRESENT for
// completed sessions; the student may mark ABSENT (with confirmation) and
// revert. Cancelled / Auto / Mid-Break are excluded from the denominator.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bars,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  SkeletonBlock,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { getAttendanceView, markAttendance } from '../../api/endpoints.js';
import { useApi } from '../../hooks/useApi.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function prettyDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function parseAttendance(response) {
  const data = extractPayload(response);
  if (!data || typeof data !== 'object') throw new Error('Empty attendance payload');
  const overall = data.overall && typeof data.overall === 'object' ? data.overall : {};
  return {
    needsProfile: data.needsProfile === true,
    present: Number(overall.present ?? 0),
    absent: Number(overall.absent ?? 0),
    eligible: Number(overall.eligible ?? 0),
    percent: overall.percent == null ? null : Number(overall.percent),
    courses: Array.isArray(data.courses) ? data.courses : [],
    absences: Array.isArray(data.absences) ? data.absences : [],
    windowDays: Number(data.windowDays ?? 90),
  };
}

/** Neutral level vocabulary — no university policy is hard-coded. */
function levelOf(percent) {
  const p = percent ?? 100;
  if (p >= 85) return 'Healthy';
  if (p >= 75) return 'Needs attention';
  return 'Low';
}

function levelTone(level) {
  if (level === 'Healthy') return { text: 'text-success', bg: 'bg-success/15', bar: 'bg-success' };
  if (level === 'Needs attention')
    return { text: 'text-warning', bg: 'bg-warning/15', bar: 'bg-warning' };
  return { text: 'text-critical', bg: 'bg-critical/15', bar: 'bg-critical' };
}

function OverallCard({ data }) {
  const level = levelOf(data.percent);
  const tone = levelTone(level);
  const percentText = data.percent == null ? '\u2014' : `${data.percent.toFixed(1)}%`;

  return (
    <Card className="rounded-2xl">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-label-md font-extrabold tracking-wider text-primary dark:text-primary-light">
          OVERALL ATTENDANCE
        </p>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm font-semibold ${tone.bg} ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.bar}`} />
          {level}
        </span>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <p className={`text-display-md font-extrabold ${tone.text}`}>{percentText}</p>
        <p className="pb-1.5 text-label-sm text-ink-muted">{data.eligible} completed classes</p>
      </div>

      <Bars value={data.percent ?? 0} max={100} tone={tone.bar} className="mt-2 h-2.5" />

      <div className="mt-2 flex items-center gap-2 text-label-sm text-ink-muted">
        <Icon name="check_circle" size={14} className="text-success" />
        {data.present} Present
        <span className="w-3" />
        <Icon name="cancel" size={14} className="text-critical" />
        {data.absent} Absent
      </div>
    </Card>
  );
}

function CourseCard({ course, expanded, absences, onToggle, onMark }) {
  const eligible = Number(course.eligible ?? 0);
  const percent = course.percent == null ? null : Number(course.percent);
  const tone = percent == null ? levelTone('') : levelTone(levelOf(percent));

  return (
    <Card padded={false} className="rounded-2xl">
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-title-sm font-extrabold text-ink">{course.code ?? '?'}</p>
            {course.title != null && (
              <p className="truncate text-label-sm text-ink-muted">{course.title}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-title-md font-extrabold ${tone.text}`}>
              {percent == null ? '\u2014' : `${Math.round(percent)}%`}
            </p>
            <p className="text-[9px] text-ink-muted">{eligible} classes</p>
          </div>
        </div>
        <Bars value={percent ?? 0} max={100} tone={tone.bar} className="mt-1.5" />
      </button>

      {expanded && (
        <div className="border-t border-outline/70 px-4 pb-3 pt-2.5">
          <p className="text-label-sm font-bold tracking-wide text-ink-muted">
            RECORDED ABSENCES ({absences.length}) — tap Undo to restore
          </p>
          {absences.length === 0 ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-label-sm text-success">
              <Icon name="check_circle" size={14} /> No absences recorded in the last 90 days.
            </p>
          ) : (
            <div className="mt-1">
              {absences.map((session, index) => (
                <div key={`${session.date}-${session.startTime}-${index}`} className="flex items-center gap-2 py-1">
                  <Icon name="cancel" size={15} className="shrink-0 text-critical" />
                  <p className="min-w-0 flex-1 truncate text-body-sm text-ink">
                    {prettyDate(session.date)} • {session.startTime}–{session.endTime}
                    {session.room ? ` • ${session.room}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => onMark(String(course.courseId), session, 'present')}
                    className="shrink-0 rounded-lg px-2 py-1 text-label-lg font-semibold text-primary hover:bg-primary/10 dark:text-primary-light"
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [pendingAbsent, setPendingAbsent] = useState(null); // { courseId, session }

  const { data, loading, error, refresh } = useApi(() => getAttendanceView({ days: 90 }), {
    parse: parseAttendance,
    initial: null,
  });

  const mark = async (courseId, session, status) => {
    if (status === 'absent') {
      setPendingAbsent({ courseId, session });
      return;
    }
    await doMark(courseId, session, status);
  };

  const doMark = async (courseId, session, status) => {
    try {
      await markAttendance({
        courseId,
        date: String(session.date),
        startTime: String(session.startTime),
        endTime: String(session.endTime),
        status,
        classType: String(session.classType ?? 'lecture'),
      });
      toast.success(
        status === 'absent'
          ? 'Attendance marked absent.'
          : 'Attendance restored to present.'
      );
      refresh();
    } catch (err) {
      // Never pretend the action succeeded.
      toast.error(`Not saved: ${describeApiError(err)}`);
    }
  };

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="My Attendance"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={refresh} />}
      />

      {loading && !data ? (
        <div className="space-y-3">
          <SkeletonBlock className="h-[150px] rounded-2xl" />
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : data?.needsProfile ? (
        <EmptyState
          icon="person_add"
          title="Profile incomplete"
          message="Complete your academic profile to start tracking attendance."
        />
      ) : !data || data.eligible === 0 ? (
        <EmptyState
          icon="event_available"
          title="No completed eligible classes yet"
          message={
            'Attendance appears as your scheduled classes finish.\n' +
            'Cancelled / Auto / Mid-Break classes are excluded.'
          }
        />
      ) : (
        <>
          <OverallCard data={data} />

          <p className="mt-6 mb-2 text-label-md font-extrabold tracking-wider text-primary dark:text-primary-light">
            COURSE ATTENDANCE
          </p>
          <div className="space-y-2.5">
            {data.courses.map((course) => {
              const courseId = String(course.courseId);
              return (
                <CourseCard
                  key={courseId}
                  course={course}
                  expanded={expandedCourseId === courseId}
                  absences={data.absences.filter((a) => String(a.courseId) === courseId)}
                  onToggle={() =>
                    setExpandedCourseId((current) => (current === courseId ? null : courseId))
                  }
                  onMark={mark}
                />
              );
            })}
          </div>

          <p className="mt-6 text-label-sm text-ink-muted">
            Personal tracker derived from your effective schedule — not official university records.
            Cancelled / Auto / Mid-Break classes are excluded from percentages.
          </p>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingAbsent)}
        title="Mark this class as absent?"
        message={
          pendingAbsent
            ? `${pendingAbsent.session.code ?? ''}\n${prettyDate(pendingAbsent.session.date)} • ${
                pendingAbsent.session.startTime
              }\u2013${pendingAbsent.session.endTime}`
            : ''
        }
        confirmLabel="Mark Absent"
        danger
        onConfirm={() => {
          const pending = pendingAbsent;
          setPendingAbsent(null);
          if (pending) doMark(pending.courseId, pending.session, 'absent');
        }}
        onCancel={() => setPendingAbsent(null)}
      />
    </PageShell>
  );
}
