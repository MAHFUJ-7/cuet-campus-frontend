// Chat history persistence — port of chat_history_service.dart.
import { KEYS, readJson, removeRaw, writeJson } from '../storage.js';

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 200;

function ownerKey(owner) {
  const value = typeof owner === 'object' ? owner?.id ?? owner?.email : owner;
  return String(value ?? 'anonymous').trim().toLowerCase() || 'anonymous';
}

function readStore() {
  const decoded = readJson(KEYS.chatConversations, {});
  if (Array.isArray(decoded)) return { __legacy__: decoded };
  return decoded && typeof decoded === 'object' ? decoded : {};
}

function writeStore(store) {
  writeJson(KEYS.chatConversations, store);
}

/** One persisted AI conversation. */
export function makeConversation({ id, title, messages, updatedAt }) {
  return {
    id: String(id ?? ''),
    title: String(title ?? 'Chat'),
    updatedAt: updatedAt instanceof Date ? updatedAt : new Date(updatedAt ?? Date.now()),
    messages: Array.isArray(messages)
      ? messages.map((m) => ({ role: String(m?.role ?? 'user'), content: String(m?.content ?? '') }))
      : [],
  };
}

export const chatHistory = {
  loadAll(owner) {
    try {
      const key = ownerKey(owner);
      const store = readStore();
      const legacy = Array.isArray(store.__legacy__) ? store.__legacy__ : null;
      const entries = Array.isArray(store[key]) ? store[key] : legacy ?? [];
      if (legacy && key !== '__legacy__') {
        store[key] = legacy;
        delete store.__legacy__;
        writeStore(store);
      }
      return entries
        .map((entry) => makeConversation(entry ?? {}))
        .filter((c) => c.id)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },

  upsert(owner, conversation) {
    try {
      const key = ownerKey(owner);
      const store = readStore();
      const all = this.loadAll(owner).filter((c) => c.id !== conversation.id);
      all.unshift(conversation);
      const trimmed = all.slice(0, MAX_CONVERSATIONS).map((c) => {
        if (c.messages.length <= MAX_MESSAGES_PER_CONVERSATION) return c;
        return {
          ...c,
          messages: c.messages.slice(c.messages.length - MAX_MESSAGES_PER_CONVERSATION),
        };
      });
      store[key] = trimmed.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
        messages: c.messages,
      }));
      delete store.__legacy__;
      writeStore(store);
    } catch {
      /* persistence failures never break the chat itself */
    }
  },

  delete(owner, id) {
    try {
      const key = ownerKey(owner);
      const store = readStore();
      store[key] = this.loadAll(owner)
        .filter((c) => c.id !== id)
        .map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
          messages: c.messages,
        }));
      writeStore(store);
    } catch {
      /* ignore */
    }
  },

  deleteAll(owner) {
    try {
      if (owner == null) {
        removeRaw(KEYS.chatConversations);
        return;
      }
      const key = ownerKey(owner);
      const store = readStore();
      delete store[key];
      writeStore(store);
    } catch {
      /* ignore */
    }
  },
};
