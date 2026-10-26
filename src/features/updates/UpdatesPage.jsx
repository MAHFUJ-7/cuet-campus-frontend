// Updates — port of updates_screen.dart (feed only).
// CR declarations and notices live in the dedicated CR Center.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  EmptyState,
  Icon,
  PageHeader,
  PageShell,
  SkeletonBlock,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { getUpdates, markUpdateRead } from '../../api/endpoints.js';
import {
  batchNumberLabel,
  parseCrUpdate,
  updateScopeLabel,
} from '../../lib/models.js';
import { timeAgoLower } from '../../lib/datetime.js';
import { updateTypeTone } from '../../lib/display.js';
import { localFeed } from '../../lib/localFeed.js';
import { offlineCache } from '../../lib/offlineCache.js';

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

/** Updates feed: server feed (40 latest) + unpushed local CR posts. */
function useUpdatesFeed(profile) {
  const [state, setState] = useState({ loading: true, items: [], fromCache: false, error: null });
  const runId = useRef(0);

  const load = useCallback(async () => {
    const id = runId.current + 1;
    runId.current = id;
    setState((s) => ({ ...s, loading: true, error: null }));

    let fetched = null;
    try {
      const response = await getUpdates({ page: 1, limit: 40 });
      fetched = toList(extractPayload(response)).map(parseCrUpdate);
    } catch {
      fetched = null;
    }

    const local = localFeed.visibleLocalUpdates(profile).map(parseCrUpdate);

    if (id !== runId.current) return;

    // A successful but empty feed is real data, not a reason to show stale cache.
    if (fetched == null) {
      const cached = (offlineCache.getCachedUpdates() ?? []).map(parseCrUpdate);
      setState({ loading: false, items: [...local, ...cached], fromCache: true, error: null });
      return;
    }

    const knownIds = new Set(fetched.map((u) => u.id));
    setState({
      loading: false,
      items: [...local.filter((u) => !knownIds.has(u.id)), ...fetched],
      fromCache: false,
      error: null,
    });
  }, [profile]);

  useEffect(() => {
    load();
    return () => {
      runId.current += 1;
    };
  }, [load]);

  return { ...state, refresh: load };
}

// ---------------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------------

// A section notice authored by the class CR; everything else is labelled by
// its real scope so coordinator/global notices are never misattributed.
function updateSourceLabel(update, sectionName = '') {
  if (!update) return 'UPDATE';
  if (update.scope === 'section') {
    return sectionName ? `CR • Section ${sectionName}` : 'CR UPDATE';
  }
  return updateScopeLabel(update);
}

function UpdateDetailSheet({ update, section, onClose }) {
  const toast = useToast();

  useEffect(() => {
    if (!update) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [update, onClose]);

  if (!update) return null;
  const attachments = update.attachments ?? [];

  const openAttachment = (name) => {
    if (/^https?:\/\//i.test(name)) {
      window.open(name, '_blank', 'noopener,noreferrer');
    } else {
      toast.info(`Attachment: ${name}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-detail-title"
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-3">
          <span className="h-1 w-10 rounded-full bg-outline sm:hidden" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${updateTypeTone(update.type)}`}>
            {updateSourceLabel(update, section)}
          </span>
          {update.priority === 'urgent' && (
            <span className="rounded-full bg-critical/15 px-1.5 py-0.5 text-[8px] font-extrabold text-critical">
              URGENT
            </span>
          )}
          <span className="ml-auto text-label-sm text-ink-muted">{timeAgoLower(update.createdAt)}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-muted hover:bg-surface-variant"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <h2 id="update-detail-title" className="mt-3 text-title-lg font-bold text-ink">
          {update.title}
        </h2>
        <p className="mt-1.5 whitespace-pre-wrap text-body-md text-ink-muted">{update.description}</p>

        {attachments.length > 0 && (
          <div className="mt-4">
            <p className="text-label-sm font-extrabold tracking-wider text-primary">ATTACHMENTS</p>
            <div className="mt-1.5 space-y-1.5">
              {attachments.map((name) => {
                const isPdf = name.toLowerCase().endsWith('.pdf');
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => openAttachment(name)}
                    className="flex w-full items-center gap-2 rounded-xl border border-outline bg-surface px-3 py-2.5 text-left hover:bg-surface-variant"
                  >
                    <Icon
                      name={isPdf ? 'picture_as_pdf' : 'image'}
                      size={18}
                      className={isPdf ? 'text-cancellation' : 'text-accent'}
                    />
                    <span className="min-w-0 flex-1 truncate text-body-sm text-ink">{name}</span>
                    <Icon name="open_in_new" size={15} className="text-ink-muted" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Updates pane
// ---------------------------------------------------------------------------

const SCOPE_STYLES = {
  global: { icon: 'public', tone: 'text-info bg-info/10' },
  department: { icon: 'account_tree', tone: 'text-accent bg-accent/10' },
  batch: { icon: 'school', tone: 'text-warning bg-warning/10' },
  section: { icon: 'groups', tone: 'text-primary-light bg-primary-light/10 dark:text-primary-light' },
};

function UpdatesPane() {
  const auth = useAuth();
  const { loading, items, fromCache, refresh } = useUpdatesFeed(auth.profile);
  const [readIds, setReadIds] = useState(() => new Set());
  const [selected, setSelected] = useState(null);

  const section = auth.profile?.section?.name ?? '';
  const sourceLabel = (update) => updateSourceLabel(update, section);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ap = a.priority === 'urgent' ? 0 : 1;
      const bp = b.priority === 'urgent' ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return b.createdAt - a.createdAt;
    });
  }, [items]);

  const openUpdate = async (update) => {
    if (!update.isRead) {
      setReadIds((ids) => new Set(ids).add(update.id));
      try {
        await markUpdateRead(update.id);
      } catch {
        /* best-effort */
      }
    }
    setSelected(update);
  };

  return (
    <div>
      {fromCache && (
        <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-warning/10 px-3 py-1.5 text-label-sm text-warning">
          <Icon name="offline_bolt" size={14} />
          Offline — showing your section's saved feed
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-[86px]" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon="inbox" title="You're all caught up." message="No updates have been posted yet." />
      ) : (
        <div className="space-y-2">
          {sorted.map((update) => {
            const unread = !update.isRead && !readIds.has(update.id);
            const scope = SCOPE_STYLES[update.scope] ?? SCOPE_STYLES.section;
            const attachments = update.attachments ?? [];
            const typeTone = updateTypeTone(update.type);

            return (
              <Card key={update.id} onClick={() => openUpdate(update)} className="p-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${unread ? 'bg-accent' : 'bg-transparent'}`}
                    aria-hidden="true"
                  />
                  {unread && <span className="sr-only">Unread</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${typeTone}`}>
                    {sourceLabel(update)}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold ${scope.tone}`}>
                    <Icon name={scope.icon} size={9} />
                    {updateScopeLabel(update)}
                  </span>
                  {update.priority === 'urgent' && (
                    <span className="rounded-full bg-critical/15 px-1.5 py-0.5 text-[8px] font-extrabold text-critical">
                      URGENT
                    </span>
                  )}
                  <span className="ml-auto text-[9px] text-ink-muted">
                    {timeAgoLower(update.createdAt)}
                  </span>
                </div>

                <p className={`mt-1.5 line-clamp-2 text-title-sm font-bold ${unread ? 'text-ink' : 'text-ink'}`}>
                  {update.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{update.description}</p>

                {attachments.length > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-label-sm text-ink-muted">
                    <Icon name="attach_file" size={14} />
                    {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <UpdateDetailSheet
        update={selected}
        section={section}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UpdatesPage() {
  const auth = useAuth();
  const profile = auth.profile;
  const dept = profile?.department?.code ?? 'CUET';
  const batch = batchNumberLabel(profile?.batch);
  const section = profile?.section?.name;
  const identity = [dept, batch ? `Batch ${batch}` : null, section ? `Section ${section}` : null]
    .filter(Boolean)
    .join(' • ');

  return (
    <PageShell>
      <PageHeader title="Updates" subtitle={identity} />
      <UpdatesPane />
    </PageShell>
  );
}
