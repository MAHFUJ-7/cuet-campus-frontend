// Home data hook — port of homeDataProvider + homeExamsProvider +
// homeAssignmentsProvider + attendanceProvider (fails soft per section).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractPayload } from '../../api/client.js';
import {
  getAssignments,
  getAttendanceView,
  getCalendarDay,
  getDailyRoutine,
  getExams,
  getUpdates,
} from '../../api/endpoints.js';
import { offlineCache } from '../../lib/offlineCache.js';
import { localFeed } from '../../lib/localFeed.js';
import {
  parseCrUpdate,
  parseDaySchedule,
  parseExamEntry,
  parseRoutineEntry,
} from '../../lib/models.js';
import { applyRoutineOverrides } from '../../lib/routineOverrides.js';
import { isoDate } from '../../lib/datetime.js';

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

async function safe(promiseFactory) {
  try {
    return await promiseFactory();
  } catch {
    return null;
  }
}

export function useHomeData() {
  const auth = useAuth();
  const section = auth.profile?.section ?? null;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const runId = useRef(0);

  const load = useCallback(async () => {
    const id = runId.current + 1;
    runId.current = id;
    setState((s) => ({ ...s, loading: true, error: null }));

    // Fire requests concurrently; tolerate individual failures so one broken
    // endpoint doesn't blank the entire home screen.
    const [routineRes, updatesRes, dayRes] = await Promise.all([
      safe(() => getDailyRoutine()),
      safe(() => getUpdates({ page: 1, limit: 20 })),
      safe(() => getCalendarDay(isoDate(new Date()))),
    ]);

    let routine = null;
    let updates = null;
    let daySchedule = null;

    if (routineRes) {
      routine = toList(extractPayload(routineRes)).map(parseRoutineEntry);
    }
    if (dayRes) {
      const dayPayload = extractPayload(dayRes);
      if (dayPayload && Array.isArray(dayPayload.classes)) {
        daySchedule = parseDaySchedule(dayPayload);
      }
    }
    if (updatesRes) {
      updates = toList(extractPayload(updatesRes)).map(parseCrUpdate);
    }

    // The calendar endpoint is the authoritative date-aware view: it already
    // contains CR-declared CTs, extra classes and class changes from the
    // server, so every account sees them (not just the CR's own browser).
    const cachedRoutine = (routine ?? offlineCache.getCachedRoutine() ?? []).map(parseRoutineEntry);
    const effectiveRoutine = daySchedule ? daySchedule.classes : cachedRoutine;
    const cachedUpdates = updates ?? (offlineCache.getCachedUpdates() ?? []).map(parseCrUpdate);

    // Local CR declarations are published before the backend responds. Keep
    // them in Home's important-updates list so students see them immediately.
    const localUpdates = localFeed
      .visibleLocalUpdates(auth.profile)
      .map((update) => parseCrUpdate(update));
    const mergedUpdates = [...localUpdates, ...(cachedUpdates ?? [])].filter(
      (update, index, list) =>
        list.findIndex((item) => String(item.id) === String(update.id)) === index
    );

    // Partial freshness: if any core feed came from cache, disclose it.
    const fromCache = routine == null || updates == null || daySchedule == null;

    // Persist for offline use (best effort).
    try {
      if (routine) offlineCache.cacheRoutine(routine);
    } catch {
      /* ignore */
    }
    try {
      if (updates) offlineCache.cacheUpdates(updates);
    } catch {
      /* ignore */
    }

    // Only a total failure (both feeds unavailable AND nothing cached) is an error.
    // A successful but empty feed is legitimate data.
    if (
      routine == null &&
      updates == null &&
      !cachedRoutine.length &&
      !cachedUpdates.length &&
      !localUpdates.length
    ) {
      if (id === runId.current) setState({ loading: false, error: 'No data available', data: null });
      return;
    }

    if (id !== runId.current) return;
    setState({
      loading: false,
      error: null,
      data: {
        routine: applyRoutineOverrides(effectiveRoutine, section),
        updates: mergedUpdates,
        fromCache,
      },
    });
  }, [section, auth.profile]);

  useEffect(() => {
    load();
    return () => {
      runId.current += 1;
    };
  }, [load]);

  return { ...state, refresh: load };
}

/** Upcoming exams — fails soft (empty list) so home never blocks. */
export function useHomeExams() {
  const [exams, setExams] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getExams({ page: 1, limit: 50 });
        const list = toList(extractPayload(response)).map(parseExamEntry);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const upcoming = list
          .filter((exam) => exam.examDate && exam.examDate >= today)
          .sort((a, b) => a.examDate - b.examDate);
        if (!cancelled) setExams(upcoming);
      } catch {
        if (!cancelled) setExams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return exams;
}

/** Open assignments due within the next 7 days. */
export function useHomeAssignmentsDue() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;

    const countDue = (list) => {
      const now = new Date();
      const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      let due = 0;
      for (const raw of list) {
        if (`${raw?.status}` === 'completed') continue;
        const deadline = raw?.deadline ? new Date(raw.deadline) : null;
        if (!deadline || Number.isNaN(deadline.getTime())) continue;
        if (deadline > now && deadline < weekAhead) due += 1;
      }
      return due;
    };

    (async () => {
      try {
        const response = await getAssignments({ page: 1, limit: 100 });
        const list = toList(extractPayload(response));
        if (!cancelled) setCount(countDue(list));
      } catch {
        const cached = offlineCache.getCachedAssignments() ?? [];
        if (!cancelled) setCount(countDue(cached));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}

/** Derived attendance view (effective schedule + manual overrides). */
export function useAttendanceSummary() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getAttendanceView({ days: 90 });
        const payload = extractPayload(response);
        if (!payload) throw new Error('empty');
        const overall = payload.overall ?? {};
        const percent = overall.percent == null ? null : Number(overall.percent);
        const result = {
          needsProfile: payload.needsProfile === true,
          present: Number(overall.present ?? 0),
          absent: Number(overall.absent ?? 0),
          eligible: Number(overall.eligible ?? 0),
          percent,
          courses: payload.courses ?? [],
          absences: payload.absences ?? [],
          windowDays: Number(payload.windowDays ?? 90),
        };
        const level =
          (percent ?? 100) >= 85 ? 'Healthy' : (percent ?? 100) >= 75 ? 'Needs attention' : 'Low';
        if (!cancelled) setData({ ...result, level });
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
