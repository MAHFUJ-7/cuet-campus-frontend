// Offline-first store for CR activity — port of local_feed_service.dart.
// Every CR action is written here FIRST so it appears in the Updates feed and
// declaration list instantly, then synced best-effort to the backend.
import { KEYS, readJson, writeJson } from './storage.js';

const MAX_ENTRIES = 200;

const token = (value) => String(value ?? '').trim().toUpperCase();
const batchNumberToken = (value) => {
  const match = String(value ?? '').match(/\d{2,4}/);
  if (!match) return '';
  const number = Number(match[0]);
  // "Batch 2022" and batchNumber 22 are the same cohort.
  return String(number >= 2000 ? number % 100 : number);
};

function profileBatch(profile) {
  const batch = profile?.batch;
  return {
    id: token(batch?.id),
    number: batchNumberToken(batch?.batchNumber || batch?.label || batch?.name),
  };
}

function updateBatch(update) {
  return {
    id: token(update?.batchId),
    number: batchNumberToken(
      update?.batchNumber ?? update?.batch?.batchNumber ?? update?.batch?.label ?? update?.batch?.name
    ),
  };
}

/**
 * Local announcements must obey the same audience rules as the server feed.
 * Batch announcements reach every section of that department + batch; section
 * announcements stay inside the author's section. Coordinators/admins may
 * audit every local post.
 */
export function isUpdateVisibleTo(update, profile) {
  if (!update) return false;
  if (!profile) return false;
  if (['coordinator', 'admin'].some((role) => profile.roles?.includes(role))) return true;
  if (update.authorId && String(update.authorId) === String(profile.id)) return true;

  const scope = update.scope ?? 'section';
  if (scope === 'global') return true;

  if (scope === 'department') {
    return Boolean(
      update.departmentCode &&
        token(profile.department?.code) === token(update.departmentCode)
    );
  }

  if (scope === 'batch') {
    const mine = profileBatch(profile);
    const theirs = updateBatch(update);
    const deptMatches =
      !update.departmentCode ||
      token(profile.department?.code) === token(update.departmentCode);
    if (!deptMatches) return false;
    return Boolean(
      (mine.id && theirs.id && mine.id === theirs.id) ||
        (mine.number && theirs.number && mine.number === theirs.number)
    );
  }

  const sectionId = token(profile.section?.id);
  const sectionName = token(profile.section?.name);
  const updateSectionId = token(update.sectionId);
  const updateSectionName = token(update.sectionName);
  return Boolean(
    (sectionId && updateSectionId && sectionId === updateSectionId) ||
      (sectionName && updateSectionName && sectionName === updateSectionName)
  );
}

export const localFeed = {
  // --- Updates feed --------------------------------------------------------
  getLocalUpdates() {
    const list = readJson(KEYS.crLocalUpdates, []) ?? [];
    return list
      .filter(Boolean)
      .slice()
      .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
  },

  /**
   * Local posts the signed-in profile is allowed to see. Posts that already
   * reached the server are skipped so the feed does not show them twice.
   */
  visibleLocalUpdates(profile) {
    return this.getLocalUpdates().filter(
      (update) => !update.synced && isUpdateVisibleTo(update, profile)
    );
  },

  /** Prepends a locally posted update. Returns the stored copy. */
  postLocalUpdate(update) {
    const existing = this.getLocalUpdates();
    existing.unshift(update);
    writeJson(KEYS.crLocalUpdates, existing.slice(0, MAX_ENTRIES));
    return update;
  },

  /** Records the server id once a local post has synced. */
  markLocalUpdateSynced(localId, serverId) {
    const list = this.getLocalUpdates().map((update) =>
      String(update.id) === String(localId)
        ? { ...update, synced: true, serverId: String(serverId) }
        : update
    );
    writeJson(KEYS.crLocalUpdates, list);
  },

  /** Removes a single local update (e.g. after its declaration is withdrawn). */
  removeLocalUpdate(id) {
    const remaining = this.getLocalUpdates().filter((u) => String(u.id) !== String(id));
    writeJson(KEYS.crLocalUpdates, remaining);
  },

  clearLocalUpdates() {
    writeJson(KEYS.crLocalUpdates, []);
  },

  // --- Declarations (schedule overrides) ------------------------------------
  saveLocalOverride(record) {
    const list = readJson(KEYS.crLocalOverrides, []) ?? [];
    list.unshift({
      ...record,
      createdAt: record.createdAt ?? new Date().toISOString(),
    });
    writeJson(KEYS.crLocalOverrides, list.slice(0, MAX_ENTRIES));
  },

  getLocalOverrides() {
    const list = readJson(KEYS.crLocalOverrides, []) ?? [];
    return list.filter(Boolean);
  },

  removeLocalOverride(localId) {
    const remaining = this.getLocalOverrides().filter((r) => r.localId !== localId);
    writeJson(KEYS.crLocalOverrides, remaining);
  },

  /** Records the server id once a local declaration has synced. */
  markLocalOverrideSynced(localId, serverId) {
    const list = this.getLocalOverrides().map((record) =>
      record.localId === localId ? { ...record, synced: true, serverId: String(serverId) } : record
    );
    writeJson(KEYS.crLocalOverrides, list);
  },

  clearAll() {
    writeJson(KEYS.crLocalUpdates, []);
    writeJson(KEYS.crLocalOverrides, []);
  },
};
