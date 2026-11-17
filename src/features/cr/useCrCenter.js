// CR Center data controller — port of cr_center_controller.dart (state part).
// Every declaration publishes instantly to the local feed (students see it
// immediately) and syncs best-effort to the backend. No coordinator approval
// is required for any CR declaration.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cancelOverride, createOverride, getOverrides } from '../../api/endpoints.js';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { crDeclarations } from '../../data/seedData.js';
import { localFeed } from '../../lib/localFeed.js';
import { parseScheduleOverride, overrideRangeLabel } from '../../lib/models.js';
import { isOfflineSession } from '../../lib/session.js';

const OVERRIDE_TITLES = {
  auto_day_off: 'Day off declared',
  mid_break: 'Mid-break proposed',
  class_cancellation: 'Class cancelled',
  room_change: 'Room changed',
  time_change: 'Time changed',
};

/** Guards against the outbox retry running concurrently on re-mounts. */
let outboxBusy = false;

/**
 * Server sync for one declaration payload. Returns the server ids on success,
 * throws the ApiError otherwise.
 */
async function syncOverrideToServer(payload) {
  // Local-only matching/display fields are stripped so a strict backend
  // validator never rejects the request.
  const {
    courseCode,
    courseTitle,
    originalStartTime,
    originalEndTime,
    originalRoom,
    routineEntryIds,
    ...serverPayload
  } = payload;
  const response = await createOverride(serverPayload);
  const body = extractPayload(response) ?? response?.data;
  const serverId =
    body && typeof body === 'object' ? body.id ?? body._id ?? body.overrideId : null;
  const updateId = body && typeof body === 'object' ? body.updateId ?? body.update ?? null : null;
  return { serverId, updateId };
}

/**
 * HTTP 4xx is a permanent failure — the declaration itself is invalid, so an
 * automatic retry would never succeed. Connection problems stay queued.
 */
function isPermanentSyncError(error) {
  const status = Number(error?.status ?? 0);
  return status >= 400 && status < 500 && status !== 408;
}

function describeSyncError(error) {
  return error?.userMessage ?? String(error?.message ?? error);
}

function describePayloadRange(payload) {
  if (payload.startDate) {
    return overrideRangeLabel({
      type: 'mid_break',
      startDate: payload.startDate,
      endDate: payload.endDate,
    });
  }
  return overrideRangeLabel({
    type: 'auto_day_off',
    specificDate: payload.date ?? new Date().toISOString().split('T')[0],
  });
}

export function useCrCenter(profile) {
  const [declarations, setDeclarations] = useState([]);
  const [localOverrides, setLocalOverrides] = useState([]);
  const [loadingDeclarations, setLoadingDeclarations] = useState(true);
  const [error, setError] = useState(null);
  const [sectionLabel, setSectionLabel] = useState(null);

  const loadDeclarations = useCallback(async () => {
    setLoadingDeclarations(true);
    setError(null);

    // Outbox retry: push declarations whose earlier server sync failed (e.g.
    // the server was down when the CR declared) so classmates stop missing
    // them. Permanent rejections are marked and never retried blindly.
    if (!outboxBusy && !isOfflineSession()) {
      const queued = localFeed
        .getLocalOverrides()
        .filter((record) => !record.synced && !record.syncError && record.payload);
      if (queued.length > 0) {
        outboxBusy = true;
        try {
          for (const record of queued) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const { serverId, updateId } = await syncOverrideToServer(record.payload);
              if (serverId) {
                localFeed.markLocalOverrideSynced(record.localId, serverId);
                localFeed.markLocalUpdateSynced(record.localId, updateId || serverId);
              }
            } catch (error) {
              if (isPermanentSyncError(error)) {
                try {
                  localFeed.markLocalOverrideError(record.localId, describeSyncError(error));
                } catch {
                  /* non-critical */
                }
              }
              // Transient failures stay queued for the next refresh.
            }
          }
        } finally {
          // Always release the guard — a surprise throw above must never
          // deadlock the outbox for the rest of the session.
          outboxBusy = false;
        }
      }
    }

    const storedLocal = localFeed.getLocalOverrides();
    setLocalOverrides(storedLocal);
    try {
      const response = await getOverrides();
      const payload = extractPayload(response);
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      const parsed = list.map(parseScheduleOverride);
      setDeclarations(parsed);
      // A local record that already synced (same server id) must not be shown twice.
      setLocalOverrides(
        storedLocal.filter((record) => !parsed.some((item) => item.id === record.serverId))
      );
      if (parsed.length > 0) {
        setSectionLabel(parsed[0].section?.label ?? parsed[0].section?.name ?? null);
      }
    } catch (err) {
      if (isOfflineSession()) {
        // Offline fallback: seed declarations.
        setDeclarations(crDeclarations().map(parseScheduleOverride));
        setSectionLabel(profile?.section?.label ?? profile?.section?.name ?? null);
      } else {
        // Offline-first: local records still render when the server is down —
        // only surface the error when there is nothing at all to show.
        setDeclarations([]);
        if (storedLocal.length === 0) {
          setError(describeApiError(err));
        }
      }
    } finally {
      setLoadingDeclarations(false);
    }
  }, [profile?.section?.label, profile?.section?.name]);

  useEffect(() => {
    loadDeclarations();
  }, [loadDeclarations]);

  const counts = useMemo(() => {
    const local = (record, field, value) => record[field] === value;
    return {
      pendingCount:
        declarations.filter((item) => item.status === 'pending').length +
        localOverrides.filter((r) => local(r, 'status', 'pending')).length,
      approvedCount:
        declarations.filter((item) => item.status === 'approved').length +
        localOverrides.filter((r) => local(r, 'status', 'approved')).length,
      dayOffCount:
        declarations.filter((item) => item.type === 'auto_day_off').length +
        localOverrides.filter((r) => local(r, 'type', 'auto_day_off')).length,
      midBreakCount:
        declarations.filter((item) => item.type === 'mid_break').length +
        localOverrides.filter((r) => local(r, 'type', 'mid_break')).length,
    };
  }, [declarations, localOverrides]);

  const resolvedSectionLabel =
    sectionLabel ??
    profile?.section?.label ??
    profile?.section?.name ??
    'your section';

  /** Local-first publish + best-effort server sync. Returns feedback text. */
  const submitOverride = useCallback(
    async (payload, successContext) => {
      const localId = `loc-${Date.now()}_${payload.type}`;
      // The declaration may be aimed at a sibling section (class changes,
      // extra classes) — the target section, not the CR's own, decides which
      // calendars and feeds see it.
      const targetSectionId = payload.sectionId ?? profile?.section?.id ?? '';
      const targetSectionName =
        payload.sectionName ?? profile?.section?.name ?? profile?.section?.label ?? '';

      // 1) Instant local declaration record. Keep the full payload so every
      // screen can resolve the exact date / class without the backend.
      try {
        localFeed.saveLocalOverride({
          localId,
          type: payload.type,
          status: 'approved',
          range: describePayloadRange(payload),
          reason: String(payload.reason ?? ''),
          createdAt: new Date().toISOString(),
          synced: false,
          sectionId: targetSectionId,
          sectionName: targetSectionName,
          departmentCode: profile?.department?.code ?? '',
          payload: { ...payload },
          date: payload.date ?? null,
          specificDate: payload.date ?? null,
          startDate: payload.startDate ?? null,
          endDate: payload.endDate ?? null,
          routineEntryId: payload.routineEntryId ?? null,
          routineEntryIds: Array.isArray(payload.routineEntryIds)
            ? payload.routineEntryIds
            : [],
          courseId: payload.courseId ?? null,
          courseCode: payload.courseCode ?? null,
          courseTitle: payload.courseTitle ?? null,
          originalStartTime: payload.originalStartTime ?? null,
          originalEndTime: payload.originalEndTime ?? null,
          originalRoom: payload.originalRoom ?? null,
          startTime: payload.startTime ?? null,
          endTime: payload.endTime ?? null,
          room: payload.room ?? null,
        });
      } catch {
        /* non-critical */
      }

      // 2) Instant local feed update so classmates see it in Updates.
      const reason = String(payload.reason ?? '');
      try {
        localFeed.postLocalUpdate({
          id: localId,
          authorId: profile?.id ?? '',
          sectionId: targetSectionId,
          sectionName: targetSectionName,
          departmentCode: profile?.department?.code ?? '',
          type: payload.type,
          title:
            payload.classType === 'ct'
              ? 'CT declared'
              : OVERRIDE_TITLES[payload.type] ?? 'Extra class scheduled',
          description: `${successContext}${reason ? ` \u2014 ${reason}` : ''}`.trim(),
          priority: 'normal',
          scope: 'section',
          status: 'approved',
          createdAt: new Date().toISOString(),
          author: { id: profile?.id ?? '', name: profile?.name ?? 'CR' },
        });
      } catch {
        /* non-critical */
      }

      // 3) Server sync. Failures must never be reported as success: when the
      // server is unreachable the declaration lives only on this device until
      // the outbox retry pushes it, so the CR gets an honest status instead.
      let feedback;
      if (!isOfflineSession()) {
        try {
          const { serverId, updateId } = await syncOverrideToServer(payload);
          if (serverId) {
            try {
              localFeed.markLocalOverrideSynced(localId, serverId);
              // The matching Updates post synced too — stop showing it twice.
              // The server now creates its own feed post for the declaration, so
              // point the local mirror at that post's id when it is available.
              localFeed.markLocalUpdateSynced(localId, updateId || serverId);
            } catch {
              /* non-critical */
            }
            feedback = `${successContext} \u2014 synced to the section feed`;
          } else {
            feedback = `${successContext} \u2014 saved on this device; it reaches everyone once the connection returns`;
          }
        } catch (error) {
          try {
            if (isPermanentSyncError(error)) {
              localFeed.markLocalOverrideError(localId, describeSyncError(error));
              feedback = `${successContext} \u2014 saved on this device, but the server rejected it: ${describeSyncError(
                error
              )}`;
            } else {
              feedback = `${successContext} \u2014 saved on this device; it reaches everyone once the connection returns`;
            }
          } catch {
            feedback = `${successContext} \u2014 saved on this device; it reaches everyone once the connection returns`;
          }
        }
      } else {
        feedback = `${successContext} \u2014 saved on this device (offline session)`;
      }

      try {
        await loadDeclarations();
      } catch {
        /* non-critical */
      }
      return feedback;
    },
    [profile?.id, profile?.name, profile?.section?.id, loadDeclarations]
  );

  const withdraw = useCallback(
    async (item) => {
      if (isOfflineSession()) {
        // Offline: drop the local mirror best-effort; the server cancel is
        // retried by the outbox flow once the connection returns.
        const match = localFeed
          .getLocalOverrides()
          .find((record) => String(record.serverId ?? '') === String(item.id));
        if (match?.localId) {
          localFeed.removeLocalOverride(match.localId);
          localFeed.removeLocalUpdate(match.localId);
        }
        await loadDeclarations();
        return;
      }
      await cancelOverride(item.id);
      // Also drop the local mirror + its Updates post so nothing lingers.
      try {
        const match = localFeed
          .getLocalOverrides()
          .find((record) => String(record.serverId ?? '') === String(item.id));
        if (match?.localId) {
          localFeed.removeLocalOverride(match.localId);
          localFeed.removeLocalUpdate(match.localId);
        }
      } catch {
        /* non-critical */
      }
      await loadDeclarations();
    },
    [loadDeclarations]
  );

  const withdrawLocal = useCallback(
    async (localId) => {
      localFeed.removeLocalOverride(localId);
      localFeed.removeLocalUpdate(localId);
      await loadDeclarations();
    },
    [loadDeclarations]
  );

  return {
    declarations,
    localOverrides,
    loadingDeclarations,
    error,
    resolvedSectionLabel,
    ...counts,
    loadDeclarations,
    submitOverride,
    withdraw,
    withdrawLocal,
  };
}
