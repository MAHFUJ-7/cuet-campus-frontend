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
      dayOffCount: declarations.filter((item) => item.type === 'auto_day_off').length,
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
          sectionId: profile?.section?.id ?? '',
          sectionName: profile?.section?.name ?? profile?.section?.label ?? '',
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
          sectionId: profile?.section?.id ?? '',
          sectionName: profile?.section?.name ?? profile?.section?.label ?? '',
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

      // 3) Best-effort server sync. Local-only matching/display fields are
      // stripped so a strict backend validator never rejects the request.
      let feedback;
      try {
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
        if (serverId) {
          try {
            localFeed.markLocalOverrideSynced(localId, serverId);
            // The matching Updates post synced too — stop showing it twice.
            localFeed.markLocalUpdateSynced(localId, serverId);
          } catch {
            /* non-critical */
          }
        }
        const message =
          body && typeof body === 'object' && typeof body.message === 'string'
            ? body.message
            : 'Declaration submitted';
        feedback = `${successContext} \u2014 ${message}`;
      } catch {
        feedback = `${successContext} \u2014 published to your section`;
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
