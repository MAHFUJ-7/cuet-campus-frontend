// HTTP client — port of lib/core/network/api_client.dart (Dio → fetch).
import { KEYS, readString, removeRaw } from '../lib/storage.js';
import { OFFLINE_SESSION_TOKEN } from '../lib/constants.js';
import { messageForStatus } from './errors.js';

const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
/** Either a full URL (from env) or the same-origin dev-proxy path. */
export const API_BASE_URL = configuredBase || '/api/v1';

/** Origin without the /api/v1 suffix (health checks, etc.). */
export function apiOrigin() {
  if (configuredBase) {
    return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  }
  return '';
}

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export const TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor({ status = 0, message, type = 'unknown', response = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type; // timeout | network | badResponse | offline | unknown
    this.response = response;
    this.userMessage = message;
  }
}

function getToken() {
  return readString(KEYS.authToken, null);
}

// 401s are broadcast so AuthContext can drop a dead session immediately.
const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function handleUnauthorized() {
  if (getToken() === OFFLINE_SESSION_TOKEN) return; // never invalidate a demo session
  removeRaw(KEYS.authToken);
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* listeners must never break the HTTP layer */
    }
  });
}

function assertOnline() {
  if (getToken() === OFFLINE_SESSION_TOKEN) {
    throw new ApiError({
      type: 'offline',
      message: 'This action needs a connection to the campus server.',
    });
  }
}

function getGeminiKey() {
  const key = (readString(KEYS.geminiKey, '') ?? '').trim();
  if (key.length >= 30 && key.startsWith('AIza')) return key;
  return null;
}

function buildHeaders(path, extra = {}) {
  const headers = {
    Accept: 'application/json',
    ...extra,
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Personal Gemini key — only AI endpoints, transient, never stored server-side.
  if (path.startsWith('/ai/')) {
    const geminiKey = getGeminiKey();
    if (geminiKey) headers['x-gemini-api-key'] = geminiKey;
  }
  return headers;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

async function request(
  method,
  path,
  { data, query, headers: extraHeaders, raw = false, timeoutMs } = {}
) {
  assertOnline();
  const url = new URL(apiUrl(path), window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? TIMEOUT_MS);

  const init = {
    method,
    signal: controller.signal,
    headers: buildHeaders(path, {
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    }),
  };
  if (data !== undefined) init.body = JSON.stringify(data);

  let response;
  try {
    response = await fetch(url.toString(), init);
  } catch (error) {
    clearTimeout(timer);
    if (error?.name === 'AbortError') {
      throw new ApiError({
        type: 'timeout',
        message: 'Connection timed out. Check your internet and try again.',
      });
    }
    throw new ApiError({ type: 'network', message: 'No internet connection.' });
  }
  clearTimeout(timer);

  if (raw) return response;

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const serverMessage =
      body && typeof body === 'object' && typeof body.message === 'string'
        ? body.message
        : null;

    // Clear the token on 401 to prevent infinite auth error loops.
    if (response.status === 401) handleUnauthorized();

    throw new ApiError({
      status: response.status,
      type: 'badResponse',
      response: body,
      message: messageForStatus(response.status, serverMessage),
    });
  }

  return { status: response.status, data: body };
}

/** multipart/form-data upload (PDFs, attachments). */
export async function upload(path, formData, { timeoutMs = 60_000 } = {}) {
  assertOnline();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = new URL(apiUrl(path), window.location.origin);

  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: buildHeaders(path), // no Content-Type: browser sets the boundary
      body: formData,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error?.name === 'AbortError') {
      throw new ApiError({
        type: 'timeout',
        message: 'Connection timed out. Check your internet and try again.',
      });
    }
    throw new ApiError({ type: 'network', message: 'No internet connection.' });
  }
  clearTimeout(timer);

  const body = await parseResponseBody(response);
  if (!response.ok) {
    const serverMessage =
      body && typeof body === 'object' && typeof body.message === 'string'
        ? body.message
        : null;
    if (response.status === 401) handleUnauthorized();
    throw new ApiError({
      status: response.status,
      type: 'badResponse',
      response: body,
      message: messageForStatus(response.status, serverMessage),
    });
  }
  return { status: response.status, data: body };
}

export const apiClient = {
  get: (path, options) => request('GET', path, options),
  post: (path, data, options) => request('POST', path, { ...options, data }),
  put: (path, data, options) => request('PUT', path, { ...options, data }),
  delete: (path, options) => request('DELETE', path, options),
};

/** Raw Response access (binary downloads like routine PDFs). Rejects on HTTP errors. */
export async function rawRequest(method, path, options = {}) {
  const response = await request(method, path, { ...options, raw: true });
  if (!response.ok) {
    const body = await parseResponseBody(response);
    const serverMessage =
      body && typeof body === 'object' && typeof body.message === 'string' ? body.message : null;
    if (response.status === 401) handleUnauthorized();
    throw new ApiError({
      status: response.status,
      type: 'badResponse',
      response: body,
      message: messageForStatus(response.status, serverMessage),
    });
  }
  return response;
}

/** Envelope helper: unwraps `{ success, data: ... }` response bodies. */
export function extractPayload(response) {
  const body = response?.data;
  if (body && typeof body === 'object' && 'data' in body) return body.data;
  return body;
}

/** Token helpers (ApiClient.setToken / getToken / clearToken). */
export function setAuthToken(token) {
  try {
    if (token) window.localStorage.setItem(`cuet:${KEYS.authToken}`, token);
    else window.localStorage.removeItem(`cuet:${KEYS.authToken}`);
  } catch {
    /* ignore */
  }
}

export function getAuthToken() {
  return getToken();
}

export function clearAuthToken() {
  removeRaw(KEYS.authToken);
}
