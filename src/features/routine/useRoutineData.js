// Routine data hooks — ports of weeklyRoutineProvider + routinePdfProvider.
import { useCallback, useEffect, useRef, useState } from 'react';
import { extractPayload } from '../../api/client.js';
import { getLatestRoutinePdf, getWeeklyRoutine } from '../../api/endpoints.js';
import { studentRoutine } from '../../data/seedData.js';
import { parseRoutineEntry } from '../../lib/models.js';
import { offlineCache } from '../../lib/offlineCache.js';
import { applyRoutineOverrides } from '../../lib/routineOverrides.js';
import { isOfflineSession } from '../../lib/session.js';

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

/**
 * Weekly routine: live from the backend when reachable, otherwise the
 * section's cached copy (seeded for offline demo accounts).
 */
export function useWeeklyRoutine(section = null) {
  const [state, setState] = useState({ loading: true, error: null, entries: [], fromCache: false });
  const runId = useRef(0);

  const load = useCallback(async () => {
    const id = runId.current + 1;
    runId.current = id;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const response = await getWeeklyRoutine();
      const list = toList(extractPayload(response));
      if (list.length > 0) {
        // Cache the official rows, then apply on-device permanent edits on top.
        const rawEntries = list.map(parseRoutineEntry);
        try {
          offlineCache.cacheWeeklyRoutine(rawEntries);
        } catch {
          /* best-effort */
        }
        if (id === runId.current) {
          setState({
            loading: false,
            error: null,
            entries: applyRoutineOverrides(rawEntries, section),
            fromCache: false,
          });
        }
        return;
      }
    } catch {
      /* fall back to cache */
    }

    let cached = offlineCache.getCachedWeeklyRoutine();
    // Older offline sessions may only have a one-day snapshot; the demo
    // weekly grid must still render after an upgrade.
    if ((!cached || cached.length === 0) && isOfflineSession()) {
      cached = studentRoutine({ section: section?.name ?? 'A' });
    }
    if (id === runId.current) {
      setState({
        loading: false,
        error: null,
        entries: applyRoutineOverrides(cached ?? [], section),
        fromCache: true,
      });
    }
  }, [section]);

  useEffect(() => {
    load();
    return () => {
      runId.current += 1;
    };
  }, [load]);

  return { ...state, refresh: load };
}

/**
 * Latest routine PDF metadata. 404/400 means "none uploaded yet" — not an
 * error. Any other failure surfaces as { error }.
 */
export function useRoutinePdfInfo() {
  const [state, setState] = useState({ loading: true, error: null, info: null });
  const runId = useRef(0);

  const load = useCallback(async () => {
    const id = runId.current + 1;
    runId.current = id;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const response = await getLatestRoutinePdf();
      const payload = extractPayload(response);
      let info = null;
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        info = {
          id: payload._id ?? payload.id ?? '',
          title: payload.title ?? 'Class Routine',
          filename: payload.filename ?? '',
          originalName: payload.originalName ?? 'routine.pdf',
          size: Number(payload.size ?? 0),
          createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
        };
      }
      if (id === runId.current) setState({ loading: false, error: null, info });
    } catch (err) {
      if (err?.status === 404 || err?.status === 400) {
        if (id === runId.current) setState({ loading: false, error: null, info: null });
        return;
      }
      if (id === runId.current) {
        setState({
          loading: false,
          error: err?.message ? String(err.message) : 'Failed to load routine PDF info',
          info: null,
        });
      }
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      runId.current += 1;
    };
  }, [load]);

  return { ...state, refresh: load };
}
