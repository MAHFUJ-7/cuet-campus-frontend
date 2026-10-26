// Chat history persistence — port of chat_history_service.dart.
import { KEYS, readJson, removeRaw, writeJson } from '../storage.js';

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 200;

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
  loadAll() {
    try {
      const decoded = readJson(KEYS.chatConversations, []);
      if (!Array.isArray(decoded)) return [];
      return decoded
        .map((entry) => makeConversation(entry ?? {}))
        .filter((c) => c.id)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },

  upsert(conversation) {
    try {
      const all = this.loadAll().filter((c) => c.id !== conversation.id);
      all.unshift(conversation);
      const trimmed = all.slice(0, MAX_CONVERSATIONS).map((c) => {
        if (c.messages.length <= MAX_MESSAGES_PER_CONVERSATION) return c;
        return {
          ...c,
          messages: c.messages.slice(c.messages.length - MAX_MESSAGES_PER_CONVERSATION),
        };
      });
      writeJson(
        KEYS.chatConversations,
        trimmed.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
          messages: c.messages,
        }))
      );
    } catch {
      /* persistence failures never break the chat itself */
    }
  },

  delete(id) {
    try {
      const remaining = this.loadAll().filter((c) => c.id !== id);
      writeJson(
        KEYS.chatConversations,
        remaining.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
          messages: c.messages,
        }))
      );
    } catch {
      /* ignore */
    }
  },

  deleteAll() {
    try {
      removeRaw(KEYS.chatConversations);
    } catch {
      /* ignore */
    }
  },
};
