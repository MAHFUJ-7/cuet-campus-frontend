// AI chat orchestrator — port of ai_chat_service.dart.
//
// Sends chat turns through the best available pathway:
//   1. Custom OpenAI-compatible provider (OpenRouter / OpenZen / …) — direct
//   2. Personal Google Gemini key — direct Generative Language REST call.
//   3. Campus backend proxy (POST /ai/chat).
//   4. Deterministic offline fallback answering from the cached routine.
//
// External calls never carry the campus session token.
import { apiUrl, getAuthToken } from '../../api/client.js';
import { dayMatches, endToday, startToday } from '../datetime.js';
import { offlineCache } from '../offlineCache.js';
import { academicLabel, roleLabel } from '../models.js';
import { AiActiveMode, aiProvider } from './providers.js';
import { geminiKey } from './geminiKey.js';

const MAX_HISTORY = 12;
const MAX_MESSAGE_LENGTH = 4000;
const EXTERNAL_TIMEOUT_MS = 60_000;
const SERVER_TIMEOUT_MS = 45_000;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

/** fetch() with an AbortController-based timeout. */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonSafe(response) {
  try {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Maps HTTP failures to human explanations, mirroring _describeDio. */
function httpError(status, body, label) {
  if (status === 401 || status === 403) {
    return new Error(`${label} rejected the API key (HTTP ${status}). Check the key in AI Settings.`);
  }
  if (status === 404) {
    return new Error(
      `${label} does not know that model/endpoint (404). Verify the Model ID and Base URL in AI Settings.`
    );
  }
  if (status === 429) {
    return new Error(`${label} rate limit reached (429). Try again shortly.`);
  }
  const detail =
    body && typeof body === 'object'
      ? String(body?.error?.message ?? body.message ?? '')
      : '';
  return new Error(`${label} error${detail ? `: ${detail}` : ''}`);
}

function describeNetworkError(error, label) {
  if (error?.name === 'AbortError') {
    return new Error(`${label} timed out. Check your connection.`);
  }
  return new Error(`${label} is unreachable. Check your connection.`);
}

/** Keeps only the last 12 non-empty messages. */
function recentHistory(history) {
  const list = Array.isArray(history) ? history : [];
  const trimmed = list.length <= MAX_HISTORY ? list : list.slice(list.length - MAX_HISTORY);
  return trimmed.filter((m) => String(m?.content ?? '').trim().length > 0);
}

async function postCompletions({ provider, modelId, systemPrompt, history, message, maxTokens = 1024 }) {
  const url = `${provider.normalizedBaseUrl}/chat/completions`;
  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory(history).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      },
      EXTERNAL_TIMEOUT_MS
    );
  } catch (error) {
    throw describeNetworkError(error, 'AI provider');
  }

  if (!response.ok) {
    throw httpError(response.status, await parseJsonSafe(response), 'AI provider');
  }

  const data = await parseJsonSafe(response);
  const choices = data?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0];
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
    const text = choice?.text;
    if (typeof text === 'string' && text.trim()) return text;
  }
  throw new Error('The provider returned an empty response.');
}

async function sendViaCustom(message, history, profile) {
  const provider = aiProvider.readCustomProvider();
  if (!provider) throw new Error('Custom provider is not configured anymore');
  const text = await postCompletions({
    provider,
    modelId: provider.modelId,
    systemPrompt: buildSystemPrompt(profile),
    history,
    message,
  });
  return { text, source: AiActiveMode.custom };
}

async function sendViaGemini(message, history, profile) {
  const key = geminiKey.read();
  if (!key) throw new Error('Gemini key is not configured anymore');
  const model = aiProvider.readSelectedGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = recentHistory(history).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt(profile) }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      },
      EXTERNAL_TIMEOUT_MS
    );
  } catch (error) {
    throw describeNetworkError(error, 'Google Gemini');
  }

  if (!response.ok) {
    throw httpError(response.status, await parseJsonSafe(response), 'Google Gemini');
  }

  const data = await parseJsonSafe(response);
  const candidates = data?.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    const parts = candidates[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const text = parts.map((p) => p?.text ?? '').join('').trim();
      if (text) return { text, source: AiActiveMode.gemini };
    }
  }
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`The model declined this request (${blockReason}).`);
  }
  throw new Error('Gemini returned an empty response.');
}

async function sendViaServer(message, history, profile) {
  let response;
  try {
    const token = getAuthToken();
    response = await fetchWithTimeout(
      `${apiUrl('/ai/chat')}`,
      {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history: recentHistory(history).map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [m.content],
          })),
        }),
      },
      SERVER_TIMEOUT_MS
    );
  } catch {
    // Server unreachable → deterministic offline answers from cached data.
    return { text: buildOfflineFallback(message), source: AiActiveMode.server };
  }

  if (!response.ok) {
    // Mirror the Flutter behaviour: HTTP failures degrade to the offline answer.
    return { text: buildOfflineFallback(message), source: AiActiveMode.server };
  }

  const body = await parseJsonSafe(response);
  const payload = body?.data;
  let reply = '';
  if (payload && typeof payload === 'object') {
    reply = String(payload.reply ?? payload.response ?? payload.message ?? '');
  } else if (typeof payload === 'string') {
    reply = payload;
  }
  if (!reply.trim()) throw new Error('Server returned an empty reply');
  return { text: reply, source: AiActiveMode.server };
}

/**
 * Sends one chat turn. Returns { text, source }.
 * Throws on provider/config failures (the caller renders an error bubble).
 */
export async function sendChatMessage(message, history, profile) {
  const clean = String(message ?? '').trim();
  if (!clean) throw new Error('Message must not be empty');
  const text = clean.length > MAX_MESSAGE_LENGTH ? clean.slice(0, MAX_MESSAGE_LENGTH) : clean;

  switch (aiProvider.resolveActiveMode()) {
    case AiActiveMode.custom:
      return sendViaCustom(text, history, profile);
    case AiActiveMode.gemini:
      return sendViaGemini(text, history, profile);
    default:
      return sendViaServer(text, history, profile);
  }
}

/** Tiny probe used by AI Settings' "Test connection" button. Returns ms. */
export async function testCustomProvider(provider) {
  const started = performance.now();
  await postCompletions({
    provider,
    modelId: provider.modelId,
    systemPrompt: 'You are a connection tester. Reply with exactly: OK',
    history: [],
    message: 'ping',
    maxTokens: 8,
  });
  return Math.round(performance.now() - started);
}

/**
 * Compact academic context injected into every external call so replies stay
 * relevant even without the campus backend.
 */
export function buildSystemPrompt(profile) {
  const identity = profile
    ? `${profile.name} (${roleLabel(profile)}, ${academicLabel(profile)})`
    : 'an anonymous student';

  let routineText = '';
  try {
    const routine = offlineCache.getCachedRoutine() ?? [];
    if (routine.length > 0) {
      const lines = [];
      for (const day of DAYS) {
        const entries = routine
          .filter((r) => dayMatches(r.day, day))
          .sort((a, b) => (a.period ?? 0) - (b.period ?? 0));
        if (entries.length === 0) continue;
        const parts = entries
          .map(
            (r) =>
              `${r.course?.code ?? r.courseId} ${r.startTime}-${r.endTime}${
                r.room ? ` @${r.room}` : ''
              }`
          )
          .join('; ');
        lines.push(`${day}: ${parts}`);
      }
      routineText = lines.join('\n').trim();
    }
  } catch {
    /* context is best-effort */
  }

  return (
    'You are CUET AI Campus Assistant for Chittagong University of ' +
    `Engineering & Technology (CUET). You are helping ${identity}.\n` +
    'Answer questions about schedules, courses and study help. Be concise, ' +
    'friendly and accurate. Use Markdown sparingly (plain text renders).\n' +
    'Never invent instructors, rooms or dates that are not listed below.\n' +
    (routineText ? `\nSECTION WEEKLY ROUTINE:\n${routineText}\n` : '')
  );
}

/** Deterministic answers when no provider is reachable at all. */
export function buildOfflineFallback(message) {
  const lower = String(message ?? '').toLowerCase();
  if (lower.includes('next class') || lower.includes('today')) {
    let today = [];
    try {
      today = entriesForToday(offlineCache.getCachedRoutine() ?? []);
    } catch {
      today = [];
    }
    if (today.length === 0) {
      return (
        'I\u2019m offline right now and could not reach the campus server. ' +
        'From your saved routine there are no recorded classes today.'
      );
    }
    const now = new Date();
    const remaining = today.filter((e) => {
      const end = endToday(e.endTime, now);
      return end == null || end > now;
    });
    if (remaining.length === 0) {
      return (
        'You are offline and the server is unreachable. According to your ' +
        'saved routine, today\u2019s classes are already over.'
      );
    }
    const next = remaining.find((e) => {
      const start = startToday(e.startTime, now);
      return start == null || start > now || endToday(e.endTime, now) > now;
    }) ?? remaining[0];
    return (
      'Offline answer (server unreachable). Next up per your saved routine: ' +
      `${next.course?.code ?? next.courseId} at ${next.startTime}` +
      (next.room ? ` in ${next.room}.` : '.')
    );
  }
  return (
    'I can\u2019t reach any AI provider right now.\n\n' +
    'To enable full AI answers:\n' +
    '1. Open Profile \u2192 AI Settings\n' +
    '2. Add a Google Gemini key OR set up a custom provider ' +
    '(Base URL + API Key + Model ID)\n\n' +
    'Schedule questions still work from your saved routine while offline.'
  );
}

function entriesForToday(all) {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const name = names[new Date().getDay()];
  return all.filter((e) => dayMatches(e.day, name)).sort((a, b) => (a.period ?? 0) - (b.period ?? 0));
}
