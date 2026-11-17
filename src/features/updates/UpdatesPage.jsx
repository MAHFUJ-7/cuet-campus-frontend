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
import PdfViewerModal from '../../components/PdfViewerModal.jsx';
import ImageViewerModal, { isImageAttachment } from '../../components/ImageViewerModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload, resolveAssetUrl } from '../../api/client.js';
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
  const [pdfView, setPdfView] = useState(null);
  const [imageView, setImageView] = useState(null);

  useEffect(() => {
    if (!update) return undefined;
    const handleKeyDown = (event) => {
      // While the PDF viewer is open, Escape closes the viewer, not the sheet.
      if (pdfView || imageView) return;
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [update, onClose, pdfView, imageView]);

  if (!update) return null;
  const attachments = update.attachments ?? [];
  const eventTime = update.eventDateTime instanceof Date && !Number.isNaN(update.eventDateTime.getTime())
    ? update.eventDateTime.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  const openAttachment = (name) => {
    const url = resolveAssetUrl(name);
    // A bare filename (no path) only exists in the device's local mirror
    // until the post syncs — there is nothing to open yet.
    if (!url || !url.includes('/')) {
      toast.info(`Attachment: ${name}`);
      return;
    }
    const filename = decodeURIComponent((url.split('/').pop() ?? 'file').split('?')[0]);
    // PDFs and images open in the in-app viewers so the browser's
    // "download instead of open" setting can never hijack the click.
    if (/\.pdf(?:$|[?#])/i.test(filename)) {
      setPdfView({ title: filename, src: url });
    } else if (isImageAttachment(filename)) {
      setImageView({ title: filename, src: url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-detail-title"
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-3">
          <span className="h-1 w-10 rounded-full bg-outline" />
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

        {eventTime && (
          <div className="mt-4 rounded-xl bg-primary/8 p-3 text-body-sm text-ink">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="event" size={17} className="text-primary" />
              {eventTime}
            </p>
            {update.eventLocation && (
              <p className="mt-1 flex items-center gap-2 text-ink-muted">
                <Icon name="location_on" size={16} />
                {update.eventLocation}
              </p>
            )}
          </div>
        )}

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

      <PdfViewerModal
        open={Boolean(pdfView)}
        title={pdfView?.title ?? 'PDF'}
        src={pdfView?.src ?? null}
        onClose={() => setPdfView(null)}
      />

      <ImageViewerModal
        open={Boolean(imageView)}
        title={imageView?.title ?? 'Image'}
        src={imageView?.src ?? null}
        onClose={() => setImageView(null)}
      />
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

const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority first' },
  { value: 'latest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

function UpdatesPane({ sortBy = 'priority' }) {
  const auth = useAuth();
  const { loading, items, fromCache, refresh } = useUpdatesFeed(auth.profile);
  const [readIds, setReadIds] = useState(() => new Set());
  const [selected, setSelected] = useState(null);

  const section = auth.profile?.section?.name ?? '';
  const sourceLabel = (update) => updateSourceLabel(update, section);

  const sorted = useMemo(() => {
    const priorityRank = (p) => (p === 'urgent' ? 0 : p === 'important' ? 1 : 2);
    return [...items].sort((a, b) => {
      if (sortBy === 'latest') return b.createdAt - a.createdAt;
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      // Priority: urgent first, then important, then newest.
      const ap = priorityRank(a.priority);
      const bp = priorityRank(b.priority);
      if (ap !== bp) return ap - bp;
      return b.createdAt - a.createdAt;
    });
  }, [items, sortBy]);

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
                  {update.type === 'event' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[8px] font-bold text-accent">
                      <Icon name="event" size={10} /> EVENT
                    </span>
                  )}
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
  const [sortBy, setSortBy] = useState('priority');
  const dept = profile?.department?.code ?? 'CUET';
  const batch = batchNumberLabel(profile?.batch);
  const section = profile?.section?.name;
  const identity = [dept, batch ? `Batch ${batch}` : null, section ? `Section ${section}` : null]
    .filter(Boolean)
    .join(' • ');

  return (
    <PageShell>
      <PageHeader
        title="Updates"
        subtitle={identity}
        actions={
          <label className="flex items-center gap-1.5 rounded-xl border border-outline bg-surface px-2.5 py-1.5 shadow-sm">
            <Icon name="swap_horiz" size={16} className="text-ink-muted" />
            <select
              aria-label="Sort updates"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-label-md font-semibold text-ink outline-none [&>option]:bg-surface"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <UpdatesPane sortBy={sortBy} />
    </PageShell>
  );
}
