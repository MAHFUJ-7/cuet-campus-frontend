// Session helpers shared by components outside the Auth context.
import { OFFLINE_SESSION_TOKEN } from './constants.js';
import { KEYS, readString } from './storage.js';

export function getSessionToken() {
  return readString(KEYS.authToken, null);
}

/** True when the active session is a local/offline test session. */
export function isOfflineSession() {
  return getSessionToken() === OFFLINE_SESSION_TOKEN;
}
