// Offline cache — port of lib/core/services/offline_cache_service.dart.
import { KEYS, readInt, readJson, writeInt, writeJson } from './storage.js';

export const offlineCache = {
  /** Milliseconds since epoch of the last successful write, or null. */
  get lastSync() {
    const ms = readInt(KEYS.lastSync, 0);
    return ms > 0 ? new Date(ms) : null;
  },

  _stamp() {
    writeInt(KEYS.lastSync, Date.now());
  },

  // --- Routine -------------------------------------------------------------
  cacheRoutine(entries) {
    writeJson(KEYS.cacheRoutine, entries);
    this._stamp();
  },
  getCachedRoutine() {
    return readJson(KEYS.cacheRoutine, []) ?? [];
  },

  // A daily routine (Home/reminders) must never overwrite the weekly grid.
  cacheWeeklyRoutine(entries) {
    writeJson(KEYS.cacheWeeklyRoutine, entries);
    this._stamp();
  },
  getCachedWeeklyRoutine() {
    const list = readJson(KEYS.cacheWeeklyRoutine, []) ?? [];
    if (Array.isArray(list) && list.length > 0) return list;
    // Migrate snapshots written before the weekly cache was split out.
    const legacy = this.getCachedRoutine();
    const days = new Set((legacy ?? []).map((entry) => entry?.day)).size;
    return days > 1 ? legacy : [];
  },

  // --- Updates -------------------------------------------------------------
  cacheUpdates(updates) {
    writeJson(KEYS.cacheUpdates, updates);
    this._stamp();
  },
  getCachedUpdates() {
    return readJson(KEYS.cacheUpdates, []) ?? [];
  },

  // --- Assignments ---------------------------------------------------------
  cacheAssignments(assignments) {
    writeJson(KEYS.cacheAssignments, assignments);
    this._stamp();
  },
  getCachedAssignments() {
    return readJson(KEYS.cacheAssignments, []) ?? [];
  },

  // --- User profile (PII) --------------------------------------------------
  cacheUser(user) {
    writeJson(KEYS.cacheUser, user);
  },
  getCachedUser() {
    return readJson(KEYS.cacheUser, null);
  },

  // --- Maintenance ---------------------------------------------------------
  /** Clears every cached value including the user profile (sign-out). */
  clearCache() {
    writeJson(KEYS.cacheRoutine, []);
    writeJson(KEYS.cacheUpdates, []);
    writeJson(KEYS.cacheAssignments, []);
    writeInt(KEYS.lastSync, 0);
    writeJson(KEYS.cacheUser, null);
  },

  /**
   * Clears cached content but keeps the signed-in user — used by the Security
   * screen so clearing data never signs the account out.
   */
  clearContentCache() {
    writeJson(KEYS.cacheRoutine, []);
    writeJson(KEYS.cacheUpdates, []);
    writeJson(KEYS.cacheAssignments, []);
    writeInt(KEYS.lastSync, 0);
  },
};

/** "just now / 5 min ago / 2h ago" for the home sync strip. */
export function formatSyncAge(lastSync) {
  if (!lastSync) return 'cached data';
  const mins = Math.floor((Date.now() - lastSync.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
