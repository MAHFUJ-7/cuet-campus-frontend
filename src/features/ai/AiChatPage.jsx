// AI Chat — port of ai_chat_screen.dart (+ chat_history_service & chat notifier).
// Messages persist per-conversation in localStorage; error bubbles are
// display-only and never enter the model context.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  Spinner,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { sendChatMessage } from '../../lib/ai/chatService.js';
import { AiActiveMode, AiPresets, aiProvider } from '../../lib/ai/providers.js';
import { chatHistory, makeConversation } from '../../lib/ai/chatHistory.js';

const SUGGESTIONS = [
  'What\u2019s my next class?',
  'Give me study tips for CSE courses',
  'Where is the library?',
  'Plan my week before finals',
];

function newConversationId() {
  return `c${Date.now()}_${Date.now() % 100000}`;
}

function titleFor(firstUserMessage) {
  const clean = String(firstUserMessage ?? '').trim().replaceAll('\n', ' ');
  if (!clean) return 'New chat';
  return clean.length <= 42 ? clean : `${clean.slice(0, 42)}\u2026`;
}

function timeAgoShort(time) {
  const diffMs = Date.now() - new Date(time).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(time);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function previewFor(conversation) {
  const last = [...(conversation.messages ?? [])].reverse().find((m) => m.content);
  return String(last?.content ?? 'No messages yet').replace(/\s+/g, ' ').trim();
}

/** Bottom sheet on mobile, centered panel on desktop. */
function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-outline sm:hidden" />
        {title && (
          <p className="shrink-0 px-5 pt-3 pb-1 text-title-lg font-extrabold text-ink">{title}</p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Bubble({ message, onCopy }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] px-4 pt-3 pb-1 sm:max-w-[78%] ${
          isUser
            ? 'rounded-2xl rounded-br-md bg-primary text-white'
            : isError
              ? 'rounded-2xl rounded-bl-md border border-critical/40 bg-critical/10 text-critical'
              : 'rounded-2xl rounded-bl-md bg-surface-variant text-ink'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-body-md">{message.content}</div>
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            title="Copy"
            onClick={onCopy}
            className={`rounded-lg p-1 transition-colors ${
              isUser ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon name="content_copy" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AiChatPage() {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  // /coordinator/ai renders this page standalone (no app shell).
  const standalone = location.pathname.startsWith('/coordinator');

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const conversationIdRef = useRef('');
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [modelLabel, setModelLabel] = useState(() => aiProvider.describeActiveMode());

  const [sheet, setSheet] = useState(null); // null | 'history' | 'model'
  const [historyList, setHistoryList] = useState([]);
  const [modelPicker, setModelPicker] = useState(null); // {kind:'custom'|'gemini', ...}
  const [customModelPrompt, setCustomModelPrompt] = useState(null); // {baseUrl, apiKey, modelId}
  const [customModelInput, setCustomModelInput] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const historyOwner = auth.profile?.id || auth.profile?.email || 'anonymous';

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // Invalidates an in-flight reply when the user switches/creates a chat.
  const runRef = useRef(0);

  const refreshModelLabel = () => setModelLabel(aiProvider.describeActiveMode());

  // Keep the transcript pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  /** Appends messages and persists the conversation (errors excluded). */
  const commitMessages = (next) => {
    setMessages(next);
    const persistable = next.filter((m) => !m.isError);
    if (persistable.length === 0) return;
    let id = conversationIdRef.current;
    if (!id) {
      id = newConversationId();
      conversationIdRef.current = id;
      setConversationId(id);
    }
    const firstUser = persistable.find((m) => m.role === 'user')?.content;
    chatHistory.upsert(
      historyOwner,
      makeConversation({
        id,
        title: titleFor(firstUser ?? 'New chat'),
        messages: persistable.map((m) => ({ role: m.role, content: m.content })),
        updatedAt: new Date(),
      })
    );
  };

  const startNewChat = () => {
    runRef.current += 1; // discard any in-flight reply for the previous chat
    setIsLoading(false);
    conversationIdRef.current = '';
    setConversationId('');
    setMessages([]);
  };

  const loadConversation = (conversation) => {
    runRef.current += 1;
    setIsLoading(false);
    conversationIdRef.current = conversation.id;
    setConversationId(conversation.id);
    setMessages(conversation.messages.map((m) => ({ role: m.role, content: m.content })));
  };

  const send = async (preset) => {
    const message = String(preset ?? input).trim();
    if (!message || isLoading) return;

    const runId = runRef.current + 1;
    runRef.current = runId;
    const afterUser = [...messages, { role: 'user', content: message }];
    commitMessages(afterUser);
    setInput('');
    setIsLoading(true);

    try {
      // Send recent context so follow-ups keep context; error bubbles excluded.
      const clean = afterUser.filter((m) => !m.isError);
      const historyPayload =
        clean.length <= 1
          ? []
          : clean.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const reply = await sendChatMessage(message, historyPayload, auth.profile);
      if (runRef.current !== runId) return; // user switched chats mid-flight
      commitMessages([...afterUser, { role: 'assistant', content: reply.text }]);
    } catch (error) {
      if (runRef.current !== runId) return;
      // Keep the user's question visible; surface the failure as a reply.
      const text = String(error?.message ?? error ?? 'Something went wrong.');
      setMessages([...afterUser, { role: 'assistant', content: text, isError: true }]);
    } finally {
      if (runRef.current === runId) setIsLoading(false);
    }
  };

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(message.role === 'user' ? 'Your message copied' : 'Response copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  // --- Model picker ---------------------------------------------------------

  const openModelSheet = () => {
    const mode = aiProvider.resolveActiveMode();
    if (mode === AiActiveMode.server) {
      toast.info('No personal AI configured — opening AI Settings.');
      setSheet(null);
      navigate('/ai-settings');
      return;
    }
    if (mode === AiActiveMode.custom) {
      const provider = aiProvider.readCustomProvider();
      if (!provider) return;
      const models = [
        ...new Set(
          Object.entries(AiPresets.customBases)
            .filter(([base]) => provider.normalizedBaseUrl === base)
            .flatMap(([, list]) => list)
        ),
      ].filter((m) => m !== provider.modelId);
      setModelPicker({ kind: 'custom', provider, models });
    } else {
      setModelPicker({ kind: 'gemini', current: aiProvider.readSelectedGeminiModel() });
    }
    setSheet('model');
  };

  const selectCustomModel = (modelId) => {
    const provider = modelPicker?.provider;
    if (!provider) return;
    aiProvider.saveCustomProvider({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      modelId,
    });
    refreshModelLabel();
    setSheet(null);
    toast.success(`Switched to ${modelId}`);
  };

  const selectGeminiModel = (modelId) => {
    aiProvider.saveSelectedGeminiModel(modelId);
    refreshModelLabel();
    setSheet(null);
    toast.success(`Switched to ${modelId}`);
  };

  // --- History sheet --------------------------------------------------------

  const openHistorySheet = () => {
    setHistoryList(chatHistory.loadAll(historyOwner));
    setSheet('history');
  };

  const removeConversation = (conversation) => {
    chatHistory.delete(historyOwner, conversation.id);
    if (conversation.id === conversationIdRef.current) startNewChat();
    setHistoryList(chatHistory.loadAll(historyOwner));
  };

  const removeAllConversations = () => {
    setConfirmDeleteAll(false);
    chatHistory.deleteAll(historyOwner);
    startNewChat();
    setHistoryList([]);
    toast.success('Chat history cleared');
  };

  const empty = messages.length === 0;

  return (
    <div
      className={`mx-auto flex w-full max-w-4xl flex-col px-4 pt-3 ${
        standalone
          ? 'h-[calc(100dvh-1rem)]'
          : 'h-[calc(100dvh-9.5rem)] lg:h-[calc(100dvh-2rem)]'
      }`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 pb-2">
        {standalone && (
          <IconButton icon="arrow_back" label="Back" onClick={() => navigate('/coordinator')} />
        )}
        <button
          type="button"
          onClick={openModelSheet}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-colors hover:bg-surface-variant"
          title="Switch model"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light">
            <Icon name="auto_awesome" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-title-md font-bold text-ink">AI Assistant</span>
            <span className="block truncate text-label-sm text-ink-muted">
              {modelLabel}
            </span>
          </span>
          <Icon name="expand_more" size={18} className="shrink-0 text-ink-muted" />
        </button>
        <IconButton icon="history" label="Chat history" onClick={openHistorySheet} />
        <IconButton
          icon="settings"
          label="AI settings"
          onClick={() => navigate('/ai-settings')}
        />
        <IconButton
          icon="add_comment"
          label="New chat"
          disabled={empty}
          onClick={startNewChat}
        />
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-3">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-[#2D5AA0] to-[#1A3A6B] shadow-lg shadow-primary/30">
              <Icon name="auto_awesome" size={34} className="text-white" />
            </span>
            <p className="mt-5 text-headline-sm font-semibold text-ink">CUET AI Assistant</p>
            <p className="mt-1 text-label-md font-semibold text-primary dark:text-primary-light">
              {modelLabel}
            </p>
            <p className="mt-2 max-w-md text-body-md text-ink-muted">
              Ask me anything about your academic schedule, campus facilities, or study tips.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => send(label)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-outline bg-surface px-3.5 py-2 text-label-md text-ink transition-colors hover:bg-surface-variant"
                >
                  <Icon name="auto_awesome" size={14} className="text-primary dark:text-primary-light" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-0.5">
            {messages.map((message, index) => (
              <Bubble
                key={`${index}-${message.role}`}
                message={message}
                onCopy={() => copyMessage(message)}
              />
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="h-0.5 w-full shrink-0 overflow-hidden rounded-full bg-primary/15">
          <div className="h-full w-1/3 animate-loading-bar rounded-full bg-primary" />
        </div>
      )}

      {/* Composer */}
      <div className="flex shrink-0 items-end gap-2 border-t border-outline/60 pt-3 pb-2">
        <textarea
          ref={inputRef}
          rows={Math.min(5, Math.max(1, input.split('\n').length))}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask something..."
          className="max-h-40 min-h-[46px] flex-1 resize-none rounded-3xl bg-surface-variant px-5 py-3 text-body-md text-ink placeholder:text-ink-muted/70 focus:outline-2 focus:outline-primary/40"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={isLoading || !input.trim()}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          {isLoading ? <Spinner size={20} /> : <Icon name="send" size={20} />}
        </button>
      </div>

      {/* Model picker sheet */}
      <Sheet
        open={sheet === 'model'}
        onClose={() => setSheet(null)}
        title={
          modelPicker?.kind === 'custom'
            ? `Models — ${AiPresets.labelForBase(modelPicker.provider.baseUrl)}`
            : modelPicker?.kind === 'gemini'
              ? 'Models — Google Gemini'
              : null
        }
      >
        {modelPicker?.kind === 'custom' && (
          <div className="pb-3">
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
            >
              <Icon name="check_circle" size={20} className="text-success" filled />
              <span className="min-w-0">
                <span className="block truncate text-body-lg font-semibold text-ink">
                  {modelPicker.provider.modelId}
                </span>
                <span className="block text-body-sm text-ink-muted">Current model</span>
              </span>
            </button>
            {modelPicker.models.map((modelId) => (
              <button
                key={modelId}
                type="button"
                onClick={() => selectCustomModel(modelId)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
              >
                <Icon name="memory" size={20} className="text-ink-muted" />
                <span className="truncate text-body-lg text-ink">{modelId}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomModelInput(modelPicker.provider.modelId);
                setCustomModelPrompt(modelPicker.provider);
                setSheet(null);
              }}
              className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
            >
              <Icon name="edit" size={20} className="text-ink-muted" />
              <span className="text-body-lg text-ink">Enter another model ID…</span>
            </button>
          </div>
        )}

        {modelPicker?.kind === 'gemini' && (
          <div className="pb-3">
            {AiPresets.geminiModels.map((modelId) => (
              <button
                key={modelId}
                type="button"
                onClick={() => selectGeminiModel(modelId)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-variant"
              >
                <Icon
                  name={modelId === modelPicker.current ? 'radio_button_checked' : 'radio_button_unchecked'}
                  size={20}
                  className={
                    modelId === modelPicker.current
                      ? 'text-primary dark:text-primary-light'
                      : 'text-ink-muted'
                  }
                />
                <span className="text-body-lg text-ink">{modelId}</span>
              </button>
            ))}
          </div>
        )}
      </Sheet>

      {/* History sheet */}
      <Sheet open={sheet === 'history'} onClose={() => setSheet(null)}>
        <div className="flex items-center gap-1 px-4 pt-3 pb-1">
          <p className="min-w-0 flex-1 text-title-lg font-extrabold text-ink">Chat history</p>
          <button
            type="button"
            onClick={() => {
              startNewChat();
              setSheet(null);
              inputRef.current?.focus();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-label-lg font-medium text-primary hover:bg-primary/10 dark:text-primary-light"
          >
            <Icon name="add_comment" size={17} /> New
          </button>
          <IconButton
            icon="delete_sweep"
            label="Delete all history"
            disabled={historyList.length === 0}
            onClick={() => setConfirmDeleteAll(true)}
            className="text-danger"
          />
        </div>
        {historyList.length === 0 ? (
          <EmptyState icon="history" title="No saved chats yet" className="py-10" />
        ) : (
          <div className="divide-y divide-outline/60 pb-3">
            {historyList.map((conversation) => {
              const isActive = conversation.id === conversationId;
              return (
                <div
                  key={conversation.id}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 ${
                    isActive ? 'bg-primary/5' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      loadConversation(conversation);
                      setSheet(null);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Icon
                      name={isActive ? 'chat_bubble' : 'chat_bubble_outline'}
                      size={20}
                      filled={isActive}
                      className={isActive ? 'text-primary dark:text-primary-light' : 'text-ink-muted'}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-body-lg text-ink ${
                          isActive ? 'font-extrabold' : 'font-semibold'
                        }`}
                      >
                        {conversation.title}
                      </span>
                      <span className="mt-0.5 block truncate text-label-sm text-ink-muted">
                        {previewFor(conversation)}
                      </span>
                      <span className="mt-1 block text-label-sm text-ink-muted">
                        {conversation.messages.length} messages · {timeAgoShort(conversation.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <IconButton
                    icon="delete"
                    label="Delete chat"
                    onClick={() => removeConversation(conversation)}
                    className="text-danger"
                  />
                </div>
              );
            })}
          </div>
        )}
      </Sheet>

      {/* Custom model ID prompt */}
      {customModelPrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-5"
          onClick={() => setCustomModelPrompt(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-title-lg font-semibold text-ink">Model ID</p>
            <input
              autoFocus
              value={customModelInput}
              onChange={(e) => setCustomModelInput(e.target.value)}
              placeholder="provider/model-name"
              className="mt-3 w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-body-md text-ink focus:border-primary focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomModelPrompt(null)}
                className="rounded-xl px-4 py-2 text-label-lg font-semibold text-primary hover:bg-primary/10 dark:text-primary-light"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const entered = customModelInput.trim();
                  setCustomModelPrompt(null);
                  if (!entered) return;
                  selectCustomModel(entered);
                }}
                className="rounded-xl bg-primary px-4 py-2 text-label-lg font-semibold text-white hover:bg-primary-light"
              >
                Use
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteAll}
        title="Delete all chats?"
        message="Every saved conversation will be removed from this device."
        confirmLabel="Delete all"
        danger
        onConfirm={removeAllConversations}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}
