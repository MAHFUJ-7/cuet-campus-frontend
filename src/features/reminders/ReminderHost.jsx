// Global reminder host — mounted once inside the authenticated app.
//
// While the app is open it checks for upcoming classes, exams and assignment
// deadlines, shows an in-app alert, and (when the browser permission is
// granted) raises a native notification. Preferences and quiet hours are
// shared with the Notification Settings screen.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractPayload } from '../../api/client.js';
import { getAssignments, getDailyRoutine, getExams } from '../../api/endpoints.js';
import { coordinatorExams, studentAssignments, studentRoutine } from '../../data/seedData.js';
import { dayMatches, isoDate, todayName } from '../../lib/datetime.js';
import { offlineCache } from '../../lib/offlineCache.js';
import { parseAssignment, parseExamEntry, parseRoutineEntry } from '../../lib/models.js';
import { applyRoutineOverrides } from '../../lib/routineOverrides.js';
import { applyDayDeclarations } from '../../lib/crSchedule.js';
import {
  buildTestReminder,
  collectDueReminders,
  hasFired,
  isWithinQuietHours,
  markFired,
  readReminderPrefs,
} from '../../lib/reminders.js';

const CHECK_INTERVAL_MS = 30_000;
const DATA_INTERVAL_MS = 5 * 60_000;

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

function sectionOf(profile) {
  const raw = profile?.section?.name ?? profile?.section?.label ?? 'A';
  return String(raw).replace(/^section\s*/i, '').trim().toUpperCase() || 'A';
}

function demoExams(section) {
  return coordinatorExams()
    .filter((exam) => {
      const raw = exam?.sectionId?.name ?? exam?.sectionId?.label ?? '';
      return !section || String(raw).replace(/^section\s*/i, '').toUpperCase() === section;
    })
    .map(parseExamEntry);
}

export default function ReminderHost() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profileId = auth.profile?.id ?? null;
  const section = sectionOf(auth.profile);
  const [sources, setSources] = useState({ routine: [], exams: [], assignments: [] });
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);

  const notify = useCallback(
    (reminder) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      try {
        const notification = new Notification(reminder.title, {
          body: reminder.body,
          icon: '/images/cuet_logo.png',
          tag: reminder.key,
        });
        notification.onclick = () => {
          window.focus();
          navigate(reminder.href);
          notification.close();
        };
      } catch {
        // Some browsers reject notifications outside a service worker. The
        // in-app alert still covers the reminder.
      }
    },
    [navigate]
  );

  // Load reminder sources: cached/seed data first, then fresh API data online.
  useEffect(() => {
    if (!auth.isLoggedIn || !profileId) {
      setSources({ routine: [], exams: [], assignments: [] });
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const cachedRoutine = offlineCache.getCachedRoutine() ?? [];
      const cachedAssignments = offlineCache.getCachedAssignments() ?? [];
      let routine = (cachedRoutine.length ? cachedRoutine : studentRoutine({ section })).map(
        parseRoutineEntry
      );
      let exams = demoExams(section);
      let assignments = (cachedAssignments.length
        ? cachedAssignments
        : studentAssignments({ section })
      ).map(parseAssignment);

      if (!auth.isOfflineSession) {
        const [routineResult, examResult, assignmentResult] = await Promise.allSettled([
          getDailyRoutine(),
          getExams({ page: 1, limit: 50 }),
          getAssignments({ page: 1, limit: 100 }),
        ]);

        if (routineResult.status === 'fulfilled') {
          const list = toList(extractPayload(routineResult.value)).map(parseRoutineEntry);
          if (list.length > 0) {
            routine = list;
            offlineCache.cacheRoutine(list);
          }
        }

        if (examResult.status === 'fulfilled') {
          const list = toList(extractPayload(examResult.value)).map(parseExamEntry);
          if (list.length > 0) exams = list;
        }

        if (assignmentResult.status === 'fulfilled') {
          const list = toList(extractPayload(assignmentResult.value)).map(parseAssignment);
          if (list.length > 0) {
            assignments = list;
            offlineCache.cacheAssignments(list);
          }
        }
      }

      if (!cancelled) {
        const today = todayName();
        const overridden = applyRoutineOverrides(routine, auth.profile?.section);
        // The daily endpoint may omit `day`; if no entry carries one, trust it
        // as today's list instead of filtering everything out.
        const hasDay = overridden.some((entry) => Boolean(entry.day));
        const todayEntries = hasDay
          ? overridden.filter((entry) => dayMatches(entry.day, today))
          : overridden;
        const effective = applyDayDeclarations(todayEntries, {
          section: auth.profile?.section,
          date: isoDate(new Date()),
          includeCancelled: false,
        });
        setSources({
          routine: effective.entries,
          exams,
          assignments,
        });
      }
    };

    load();
    const timer = window.setInterval(load, DATA_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [auth.isLoggedIn, auth.isOfflineSession, profileId, section]);

  // Evaluate the current window every 30 seconds.
  useEffect(() => {
    if (!auth.isLoggedIn || !profileId) {
      setQueue([]);
      setActive(null);
      return undefined;
    }

    const check = () => {
      const prefs = readReminderPrefs();
      const now = new Date();
      if (!prefs.enabled || isWithinQuietHours(now, prefs)) return;

      const due = collectDueReminders({ ...sources, now, prefs }).filter(
        (reminder) => !hasFired(reminder.key)
      );
      if (due.length === 0) return;

      markFired(due.map((reminder) => reminder.key));
      setQueue((current) => [...current, ...due]);
      due.forEach(notify);
    };

    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [auth.isLoggedIn, profileId, sources, notify]);

  // Display queued reminders one at a time.
  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0]);
      setQueue((current) => current.slice(1));
    }
  }, [active, queue]);

  // Keep the card visible long enough to read, then fade it out.
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setActive(null), 30_000);
    return () => window.clearTimeout(timer);
  }, [active]);

  // Settings screen test button.
  useEffect(() => {
    const handleTest = () => {
      const reminder = buildTestReminder();
      setQueue((current) => [...current, reminder]);
      notify(reminder);
    };
    window.addEventListener('cuet:test-reminder', handleTest);
    return () => window.removeEventListener('cuet:test-reminder', handleTest);
  }, [notify]);

  const tone = useMemo(() => {
    if (active?.kind === 'exam') return 'bg-danger/10 text-danger';
    if (active?.kind === 'assignment') return 'bg-warning/10 text-warning';
    if (active?.kind === 'test') return 'bg-success/10 text-success';
    return 'bg-primary/10 text-primary dark:text-primary-light';
  }, [active?.kind]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 top-24 z-[90] sm:left-auto sm:right-6 sm:w-[380px]">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto animate-fade-in-up rounded-2xl border border-primary/20 bg-surface p-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon name={active.icon ?? 'notifications_active'} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary dark:text-primary-light">
              Reminder
            </p>
            <p className="mt-0.5 text-title-sm font-bold leading-snug text-ink">{active.title}</p>
            <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{active.body}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss reminder"
            onClick={() => setActive(null)}
            className="-mr-1 -mt-1 rounded-full p-1 text-ink-muted hover:bg-surface-variant hover:text-ink"
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-outline/60 pt-2.5">
          <Button variant="text" size="sm" onClick={() => setActive(null)}>
            Dismiss
          </Button>
          <Button
            variant="tonal"
            size="sm"
            icon="arrow_forward"
            onClick={() => {
              navigate(active.href);
              setActive(null);
            }}
          >
            Open
          </Button>
        </div>
      </div>
    </div>
  );
}
