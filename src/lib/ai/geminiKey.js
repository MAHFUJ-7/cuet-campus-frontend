// Gemini key management — port of gemini_key_service.dart.
//
// Web note: browsers have no OS keystore, so the key lives in localStorage on
// this device only. It is never written to the backend, logs, or synced.
import { KEYS, readString, removeRaw, writeString } from '../storage.js';

export const geminiKey = {
  /** Returns the stored key, or null when unset/invalid. */
  read() {
    try {
      const trimmed = (readString(KEYS.geminiKey) ?? '').trim();
      if (trimmed.length < 30 || !trimmed.startsWith('AIza')) return null;
      return trimmed;
    } catch {
      return null;
    }
  },

  isSet() {
    return this.read() != null;
  },

  /** "••••abcd" — never the full key. */
  maskedPreview() {
    const key = this.read();
    if (!key) return null;
    return `••••${key.slice(-4)}`;
  },

  save(key) {
    const trimmed = String(key ?? '').trim();
    if (trimmed.length < 30 || !trimmed.startsWith('AIza')) {
      throw new Error(
        'That does not look like a valid Gemini API key (should start with "AIza").'
      );
    }
    writeString(KEYS.geminiKey, trimmed);
  },

  delete() {
    try {
      removeRaw(KEYS.geminiKey);
    } catch {
      /* ignore */
    }
  },
};
