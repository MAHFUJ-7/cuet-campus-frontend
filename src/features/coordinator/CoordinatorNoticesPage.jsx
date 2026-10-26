// Notices — port of coordinator_notices_screen.dart.
// Publish tab: scoped broadcast to one section or the whole managed batch,
// with an audience preview before sending. Campus feed tab: read-only mirror
// of what students currently see.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  PageShell,
  SegmentedTabs,
  Spinner,
  SwitchRow,
  TextField,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  getCoordinatorSections,
  getCoordinatorStudents,
  getUpdates,
  publishCoordinatorNotice,
} from '../../api/endpoints.js';
import { coordinatorSections, studentUpdates } from '../../data/seedData.js';
import { isOfflineSession } from '../../lib/session.js';
import { sectionIdOf, sectionTermIdOf } from './CoordinatorAcademicsPage.jsx';
import { useSelectedTerm } from './coordinatorState.js';

const toArray = (payload) =>
  Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

const PRIORITIES = [
  { value: 'normal', label: 'Normal' },
  { value: 'important', label: 'Important' },
  { value: 'urgent', label: 'Urgent' },
];

// ---------------------------------------------------------------------------
// Publish pane
// ---------------------------------------------------------------------------

function PublishPane({ termId }) {
  const auth = useAuth();
  const toast = useToast();

  const [sections, setSections] = useState([]);
  const [counts, setCounts] = useState({});
  const [audienceSectionId, setAudienceSectionId] = useState(null);
  const [wholeBatch, setWholeBatch] = useState(false);
  const [priority, setPriority] = useState('normal');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Escape closes the audience preview.
  useEffect(() => {
    if (!previewOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !sending) setPreviewOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewOpen, sending]);

  const loadSections = useCallback(async () => {
    try {
      const response = await getCoordinatorSections();
      setSections(toArray(extractPayload(response)));
    } catch {
      if (isOfflineSession()) {
        setSections(coordinatorSections());
      }
    }
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const filtered = useMemo(
    () =>
      termId == null
        ? sections
        : sections.filter((section) => sectionTermIdOf(section) === String(termId)),
    [sections, termId]
  );

  // Recipient estimates for the preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        filtered.map(async (section) => {
          const id = sectionIdOf(section);
          if (isOfflineSession()) {
            next[id] = Number(section.studentCount) || 0;
            return;
          }
          try {
            const roster = await getCoordinatorStudents({ sectionId: id });
            next[id] = toArray(extractPayload(roster)).length;
          } catch {
            next[id] = 0;
          }
        })
      );
      if (cancelled) return;
      setCounts(next);
      // Keep the selection only while it is still in scope; otherwise pick
      // the first available section (or clear it when nothing is left).
      setAudienceSectionId((current) =>
        filtered.some((section) => sectionIdOf(section) === current)
          ? current
          : filtered.length > 0
            ? sectionIdOf(filtered[0])
            : null
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered]);

  const previewRecipients = wholeBatch
    ? Object.values(counts).reduce((sum, count) => sum + (Number(count) || 0), 0)
    : counts[audienceSectionId] ?? 0;

  const audienceLabel = wholeBatch
    ? `Entire managed batch (${previewRecipients} members)`
    : `Section ${
        filtered.find((section) => sectionIdOf(section) === audienceSectionId)?.label ??
        filtered.find((section) => sectionIdOf(section) === audienceSectionId)?.name ??
        ''
      } (${previewRecipients} members)`;

  const startPreview = () => {
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = 'Required';
    if (!body.trim()) nextErrors.body = 'Required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!wholeBatch && !audienceSectionId) {
      toast.info('Select an audience section first.');
      return;
    }
    setPreviewOpen(true);
  };

  const publish = async () => {
    setSending(true);
    try {
      await publishCoordinatorNotice({
        audience: wholeBatch ? 'batch' : 'section',
        title: title.trim(),
        body: body.trim(),
        priority,
        sectionId: wholeBatch ? null : audienceSectionId,
      });
      toast.success('Notice published');
      setTitle('');
      setBody('');
      setPriority('normal');
      setPreviewOpen(false);
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        hint="e.g. CSE-345 class rescheduled"
        error={errors.title}
      />

      <div className="mt-4">
        <TextField
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          hint="What do your students need to know?"
          multiline
          rows={5}
          error={errors.body}
        />
      </div>

      <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
        AUDIENCE
      </p>
      <SwitchRow
        icon="campaign"
        title="Send to entire managed batch"
        checked={wholeBatch}
        onChange={setWholeBatch}
      />

      {!wholeBatch && (
        <div className="flex flex-wrap gap-2">
          {filtered.length === 0 && (
            <p className="rounded-xl bg-warning/10 px-3 py-2 text-label-md text-warning">
              No sections available in this term — switch term or send to the entire batch.
            </p>
          )}
          {filtered.map((section) => {
            const id = sectionIdOf(section);
            const label = `${section.label ?? section.name ?? ''}${
              counts[id] != null ? ` (${counts[id]})` : ''
            }`;
            const selected = audienceSectionId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAudienceSectionId(id)}
                className={`rounded-full border px-3 py-1.5 text-label-lg font-medium transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary dark:text-primary-light'
                    : 'border-outline text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-label-lg font-bold tracking-wide text-primary dark:text-primary-light">
        PRIORITY
      </p>
      <div className="mt-1.5">
        <SegmentedTabs tabs={PRIORITIES} value={priority} onChange={setPriority} />
      </div>

      <Button variant="filled" size="lg" className="mt-6 w-full" icon="send" onClick={startPreview}>
        Preview & Publish
      </Button>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
          onClick={() => !sending && setPreviewOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-preview-title"
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="notice-preview-title" className="text-title-lg font-bold text-ink">
              Audience preview
            </p>
            <p className="mt-1 text-body-sm text-ink-muted">This notice will be sent to:</p>
            <p className="mt-2 text-title-sm font-bold text-ink">{audienceLabel}</p>
            <p className="mt-1 text-body-md text-ink">Priority: {priority}</p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="outlined"
                className="flex-1"
                onClick={() => setPreviewOpen(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                variant="filled"
                className="flex-1"
                onClick={publish}
                disabled={sending}
              >
                {sending ? <Spinner size={16} /> : <Icon name="send" size={18} />}
                <span>Publish</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed pane — read-only mirror of approved updates
// ---------------------------------------------------------------------------

function FeedPane() {
  const auth = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getUpdates({ status: 'approved' });
      setItems(toArray(extractPayload(response)));
      setLoading(false);
    } catch (loadError) {
      if (isOfflineSession()) {
        setItems(studentUpdates({ section: auth.profile?.section?.name ?? 'A' }));
        setLoading(false);
        return;
      }
      setError(describeApiError(loadError));
      setLoading(false);
    }
  }, [auth.profile?.section?.name]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={30} />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={load} />
      </Card>
    );
  }

  if (items.length === 0) {
    return <EmptyState icon="campaign" title="No published updates yet." />;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-label-lg font-medium text-primary hover:bg-primary/5 dark:text-primary-light"
        >
          <Icon name="refresh" size={17} /> Refresh
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item._id ?? item.id ?? index}
            className="flex gap-3 rounded-2xl border border-outline/60 bg-surface p-3.5"
          >
            <span className="w-1 shrink-0 rounded-full bg-primary dark:bg-primary-light" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-title-sm font-semibold text-ink">
                {item.title ?? ''}
              </p>
              <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">
                {item.description ?? item.body ?? ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CoordinatorNoticesPage() {
  const [tab, setTab] = useState(0);
  const [termId] = useSelectedTerm();

  return (
    <PageShell className="max-w-3xl">
      <PageHeader title="Notices" subtitle="Scoped broadcast to your sections" />

      <SegmentedTabs
        tabs={[
          { value: 0, label: 'Publish' },
          { value: 1, label: 'Campus feed' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-4">{tab === 0 ? <PublishPane termId={termId} /> : <FeedPane />}</div>
    </PageShell>
  );
}
