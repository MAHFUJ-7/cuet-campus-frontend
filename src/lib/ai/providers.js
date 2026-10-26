// AI provider configuration — port of ai_provider_service.dart.
// Priority: custom OpenAI-compatible provider > personal Gemini key > server.
import { KEYS, readJson, readString, removeRaw, writeJson, writeString } from '../storage.js';
import { geminiKey } from './geminiKey.js';

export const AiActiveMode = { custom: 'custom', gemini: 'gemini', server: 'server' };

export const AiPresets = {
  geminiModels: [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ],

  /** OpenAI-compatible endpoints users commonly bring. */
  customBases: {
    'https://openrouter.ai/api/v1': [
      'openrouter/auto',
      'google/gemini-2.0-flash-001',
      'anthropic/claude-3.5-haiku',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
    ],
    'https://api.openai.com/v1': ['gpt-4o-mini', 'gpt-4o'],
    'https://api.groq.com/openai/v1': ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },

  labelForBase(base) {
    const b = String(base ?? '').trim();
    if (b.startsWith('https://openrouter.ai')) return 'OpenRouter';
    if (b.startsWith('https://api.openai.com')) return 'OpenAI';
    if (b.startsWith('https://api.groq.com')) return 'Groq';
    if (b.includes('openzen')) return 'OpenZen';
    if (b.includes('agentrouter')) return 'AgentRouter';
    return 'Custom endpoint';
  },
};

export const defaultGeminiModel = 'gemini-2.0-flash';

function normalizeBase(url) {
  const trimmed = String(url ?? '').trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export const aiProvider = {
  // --- Custom (OpenAI-compatible) provider --------------------------------
  readCustomProvider() {
    try {
      const json = readJson(KEYS.customProvider, null);
      if (!json || typeof json !== 'object') return null;
      const provider = {
        baseUrl: String(json.baseUrl ?? ''),
        apiKey: String(json.apiKey ?? ''),
        modelId: String(json.modelId ?? ''),
      };
      if (!provider.baseUrl || !provider.apiKey || !provider.modelId) return null;
      return { ...provider, normalizedBaseUrl: normalizeBase(provider.baseUrl) };
    } catch {
      return null;
    }
  },

  saveCustomProvider({ baseUrl, apiKey, modelId }) {
    const base = normalizeBase(baseUrl);
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      throw new Error('Base URL must start with http:// or https://');
    }
    if (String(apiKey ?? '').trim().length < 8) {
      throw new Error('That API key looks too short.');
    }
    if (!String(modelId ?? '').trim()) {
      throw new Error('Model ID is required.');
    }
    writeJson(KEYS.customProvider, {
      baseUrl: base,
      apiKey: String(apiKey).trim(),
      modelId: String(modelId).trim(),
    });
  },

  deleteCustomProvider() {
    try {
      removeRaw(KEYS.customProvider);
    } catch {
      /* ignore */
    }
  },

  customProviderMaskedPreview() {
    const p = this.readCustomProvider();
    if (!p) return null;
    const masked = p.apiKey.trim().length <= 4 ? '••••' : `••••${p.apiKey.trim().slice(-4)}`;
    return `${AiPresets.labelForBase(p.baseUrl)} • ${p.modelId} • ${masked}`;
  },

  // --- Gemini --------------------------------------------------------------
  readSelectedGeminiModel() {
    const value = (readString(KEYS.geminiModel) ?? '').trim();
    return value || defaultGeminiModel;
  },

  saveSelectedGeminiModel(model) {
    const trimmed = String(model ?? '').trim();
    if (!trimmed) return;
    writeString(KEYS.geminiModel, trimmed);
  },

  // --- Mode resolution ------------------------------------------------------
  resolveActiveMode() {
    if (this.readCustomProvider() != null) return AiActiveMode.custom;
    if (geminiKey.isSet()) return AiActiveMode.gemini;
    return AiActiveMode.server;
  },

  describeActiveMode() {
    switch (this.resolveActiveMode()) {
      case AiActiveMode.custom: {
        const p = this.readCustomProvider();
        return `${AiPresets.labelForBase(p.baseUrl)} — ${p.modelId}`;
      }
      case AiActiveMode.gemini:
        return `Google Gemini — ${this.readSelectedGeminiModel()}`;
      default:
        return 'Campus server (default)';
    }
  },
};
