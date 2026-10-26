// AI Settings — port of ai_settings_screen.dart.
// Bring your own Google Gemini key OR wire any OpenAI-compatible provider
// (OpenRouter / OpenZen / AgentRouter / Groq / self-hosted).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { testCustomProvider } from '../../lib/ai/chatService.js';
import { geminiKey } from '../../lib/ai/geminiKey.js';
import { AiActiveMode, AiPresets, aiProvider } from '../../lib/ai/providers.js';

function OptionCard({ icon, accentClass, badge, title, subtitle, active, children }) {
  return (
    <Card className="rounded-2xl">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${accentClass.bg}`}>
          <Icon name={icon} size={22} className={accentClass.text} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-label-sm font-extrabold tracking-widest ${accentClass.text}`}>
              {badge}
            </span>
            {active && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-extrabold text-success">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-title-md font-extrabold text-ink">{title}</p>
        </div>
      </div>
      <p className="mt-1 text-body-sm text-ink-muted">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function StatusStrip({ icon, tone, label, action = null }) {
  return (
    <div className={`mb-2.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${tone.bg}`}>
      <Icon name={icon} size={17} className={tone.text} />
      <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">{label}</span>
      {action}
    </div>
  );
}

function Sheet({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-outline sm:hidden" />
        <p className="shrink-0 px-5 pt-3 pb-1 text-title-md font-bold text-ink">{title}</p>
        <div className="min-h-0 flex-1 overflow-y-auto pb-3">{children}</div>
      </div>
    </div>
  );
}

export default function AiSettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [geminiInput, setGeminiInput] = useState('');
  const [geminiObscure, setGeminiObscure] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [customKeyObscure, setCustomKeyObscure] = useState(true);
  const [modelId, setModelId] = useState('');
  const [busy, setBusy] = useState(false);

  const [activeMode, setActiveMode] = useState(AiActiveMode.server);
  const [activeModeText, setActiveModeText] = useState('Campus server (default)');
  const [geminiMask, setGeminiMask] = useState(null);
  const [customMask, setCustomMask] = useState(null);
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');

  const [baseSheet, setBaseSheet] = useState(false);
  const [modelSheet, setModelSheet] = useState(false);
  const [geminiModelSheet, setGeminiModelSheet] = useState(false);

  const reload = () => {
    setActiveMode(aiProvider.resolveActiveMode());
    setActiveModeText(aiProvider.describeActiveMode());
    setGeminiMask(geminiKey.maskedPreview());
    setCustomMask(aiProvider.customProviderMaskedPreview());
    setGeminiModel(aiProvider.readSelectedGeminiModel());
    const custom = aiProvider.readCustomProvider();
    if (custom) {
      setBaseUrl((current) => current || custom.baseUrl);
      setModelId((current) => current || custom.modelId);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveGeminiKey = async () => {
    setBusy(true);
    try {
      geminiKey.save(geminiInput);
      setGeminiInput('');
      toast.success('Gemini key saved securely on this device');
      reload();
    } catch (error) {
      toast.error(String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const removeGeminiKey = () => {
    geminiKey.delete();
    toast.success('Gemini key removed');
    reload();
  };

  const saveCustomProvider = () => {
    setBusy(true);
    try {
      // If the key field is left blank, keep the stored one.
      let key = apiKey.trim();
      const existing = aiProvider.readCustomProvider();
      if (!key) {
        if (!existing) {
          toast.error('API key is required');
          return;
        }
        key = existing.apiKey;
      }
      const model = modelId.trim() || existing?.modelId || '';
      aiProvider.saveCustomProvider({ baseUrl, apiKey: key, modelId: model });
      setApiKey('');
      toast.success(`${AiPresets.labelForBase(baseUrl)} connected`);
      reload();
    } catch (error) {
      toast.error(String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const removeCustomProvider = () => {
    aiProvider.deleteCustomProvider();
    toast.success('Custom provider removed');
    reload();
  };

  const testConnection = async () => {
    const base = baseUrl.trim();
    const existing = aiProvider.readCustomProvider();
    let key = apiKey.trim();
    let model = modelId.trim();
    if (!key || !model) {
      key = key || (existing?.apiKey ?? '');
      model = model || (existing?.modelId ?? '');
    }
    if (!base || !key || !model) {
      toast.error('Fill Base URL, API key and Model ID first');
      return;
    }
    setBusy(true);
    try {
      const latencyMs = await testCustomProvider({
        baseUrl: base,
        apiKey: key,
        modelId: model,
        normalizedBaseUrl: base.replace(/\/$/, ''),
      });
      toast.success(`Connected — reply in ${latencyMs} ms`);
    } catch (error) {
      toast.error(String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const pickBasePreset = (base) => {
    setBaseUrl(base);
    setModelId(AiPresets.customBases[base]?.[0] ?? '');
    setBaseSheet(false);
  };

  const pickModelSuggestion = (model) => {
    setModelId(model);
    setModelSheet(false);
  };

  const pickGeminiModel = (model) => {
    aiProvider.saveSelectedGeminiModel(model);
    setGeminiModel(model);
    setGeminiModelSheet(false);
    toast.success(`Default Gemini model set to ${model}`);
  };

  const savedModel = aiProvider.readCustomProvider()?.modelId;
  const baseSuggestions = AiPresets.customBases[baseUrl.trim()] ?? [];

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="AI Settings" onBack={() => navigate(-1)} />

      {/* Active pathway status */}
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary/10 to-primary-container/20 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary dark:text-primary-light">
          <Icon name="auto_awesome" size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-label-sm font-extrabold tracking-widest text-primary dark:text-primary-light">
            ACTIVE AI PATHWAY
          </p>
          <p className="truncate text-body-md font-semibold text-ink">{activeModeText}</p>
          <p className="text-label-sm text-ink-muted">
            Priority: Custom provider → Gemini key → Campus server
          </p>
        </div>
      </div>

      {/* Option A — Gemini */}
      <div className="mt-5">
        <OptionCard
          icon="auto_awesome"
          accentClass={{ bg: 'bg-accent/15', text: 'text-accent' }}
          badge="OPTION A"
          title="Google Gemini"
          subtitle="Free keys from aistudio.google.com/apikey"
          active={activeMode === AiActiveMode.gemini}
        >
          <StatusStrip
            icon={geminiMask ? 'key' : 'key_off'}
            tone={geminiMask ? { bg: 'bg-success/10', text: 'text-success' } : { bg: 'bg-warning/10', text: 'text-warning' }}
            label={geminiMask ? `Key set — ${geminiMask}` : 'No personal key set'}
            action={
              geminiMask ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={removeGeminiKey}
                  className="text-label-lg font-semibold text-critical hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null
            }
          />

          <div className="relative">
            <input
              type={geminiObscure ? 'password' : 'text'}
              value={geminiInput}
              onChange={(e) => setGeminiInput(e.target.value)}
              placeholder="Paste a new Gemini API key (AIza...)"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-outline bg-surface px-3.5 py-3 pr-11 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              aria-label={geminiObscure ? 'Show' : 'Hide'}
              onClick={() => setGeminiObscure((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted hover:text-ink"
            >
              <Icon name={geminiObscure ? 'visibility_off' : 'visibility'} size={19} />
            </button>
          </div>

          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setGeminiModelSheet(true)}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary px-3 py-2.5 text-label-lg font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50 dark:text-primary-light"
            >
              <Icon name="memory" size={18} />
              <span className="truncate">{geminiModel}</span>
            </button>
            <button
              type="button"
              disabled={busy || !geminiInput.trim()}
              onClick={saveGeminiKey}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-label-lg font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              {busy ? <Spinner size={16} /> : <Icon name="save" size={18} />} Save
            </button>
          </div>
        </OptionCard>
      </div>

      {/* Option B — Custom provider */}
      <div className="mt-5">
        <OptionCard
          icon="hub"
          accentClass={{ bg: 'bg-info/15', text: 'text-info' }}
          badge="OPTION B"
          title="Custom AI Provider"
          subtitle="Any OpenAI-compatible endpoint — OpenRouter, OpenZen, AgentRouter, Groq…"
          active={activeMode === AiActiveMode.custom}
        >
          <StatusStrip
            icon={customMask ? 'cloud_done' : 'cloud_off'}
            tone={customMask ? { bg: 'bg-success/10', text: 'text-success' } : { bg: 'bg-warning/10', text: 'text-warning' }}
            label={customMask ?? 'Not configured'}
            action={
              customMask ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={removeCustomProvider}
                  className="text-label-lg font-semibold text-critical hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null
            }
          />

          <div className="flex items-center gap-1.5">
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="Base URL — https://openrouter.ai/api/v1"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-outline bg-surface px-3.5 py-3 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              title="Pick a known provider"
              onClick={() => setBaseSheet(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-variant hover:text-ink"
            >
              <Icon name="list" size={20} />
            </button>
          </div>

          <div className="relative mt-2.5">
            <input
              type={customKeyObscure ? 'password' : 'text'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={customMask ? 'API key (leave blank to keep saved)' : 'API key (sk-or-...)'}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-outline bg-surface px-3.5 py-3 pr-11 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              aria-label={customKeyObscure ? 'Show' : 'Hide'}
              onClick={() => setCustomKeyObscure((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted hover:text-ink"
            >
              <Icon name={customKeyObscure ? 'visibility_off' : 'visibility'} size={19} />
            </button>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="Model ID — openrouter/auto"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl border border-outline bg-surface px-3.5 py-3 text-body-md text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              title="Model suggestions"
              onClick={() => setModelSheet(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-variant hover:text-ink"
            >
              <Icon name="lightbulb" size={20} />
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={testConnection}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary px-3 py-2.5 text-label-lg font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50 dark:text-primary-light"
            >
              {busy ? <Spinner size={16} /> : <Icon name="network_check" size={18} />} Test
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={saveCustomProvider}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-label-lg font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              <Icon name="save" size={18} /> Save &amp; use
            </button>
          </div>

          <p className="mt-2 text-label-sm text-ink-muted">
            Keys are stored on this device only and sent solely to the endpoint you choose — never
            to campus servers.
          </p>
        </OptionCard>
      </div>

      {/* Sheets */}
      <Sheet open={baseSheet} title="Choose a provider endpoint" onClose={() => setBaseSheet(false)}>
        {Object.keys(AiPresets.customBases).map((base) => (
          <button
            key={base}
            type="button"
            onClick={() => pickBasePreset(base)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
          >
            <Icon name="dns" size={20} className="shrink-0 text-ink-muted" />
            <span className="min-w-0">
              <span className="block text-body-lg font-semibold text-ink">
                {AiPresets.labelForBase(base)}
              </span>
              <span className="block truncate text-label-md text-ink-muted">{base}</span>
            </span>
          </button>
        ))}
      </Sheet>

      <Sheet
        open={modelSheet}
        title={`Model IDs for ${AiPresets.labelForBase(baseUrl) || 'your endpoint'}`}
        onClose={() => setModelSheet(false)}
      >
        {baseSuggestions.map((model) => (
          <button
            key={model}
            type="button"
            onClick={() => pickModelSuggestion(model)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
          >
            <Icon name="memory" size={20} className="shrink-0 text-ink-muted" />
            <span className="truncate text-body-lg text-ink">{model}</span>
          </button>
        ))}
        {savedModel && (
          <button
            type="button"
            onClick={() => pickModelSuggestion(savedModel)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
          >
            <Icon name="history" size={20} className="shrink-0 text-ink-muted" />
            <span className="min-w-0">
              <span className="block truncate text-body-lg text-ink">{savedModel}</span>
              <span className="block text-label-md text-ink-muted">Currently saved</span>
            </span>
          </button>
        )}
        {baseSuggestions.length === 0 && !savedModel && (
          <p className="px-5 py-4 text-body-sm text-ink-muted">
            No suggestions for this endpoint — type any OpenAI-compatible model ID.
          </p>
        )}
      </Sheet>

      <Sheet open={geminiModelSheet} title="Gemini model" onClose={() => setGeminiModelSheet(false)}>
        {AiPresets.geminiModels.map((model) => (
          <button
            key={model}
            type="button"
            onClick={() => pickGeminiModel(model)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
          >
            <Icon
              name={model === geminiModel ? 'radio_button_checked' : 'radio_button_unchecked'}
              size={20}
              className={model === geminiModel ? 'text-primary dark:text-primary-light' : 'text-ink-muted'}
            />
            <span className="text-body-lg text-ink">{model}</span>
          </button>
        ))}
      </Sheet>
    </PageShell>
  );
}
