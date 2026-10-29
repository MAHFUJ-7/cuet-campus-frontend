// Gmail-style announcement composer for CRs — port of cr_compose_screen.dart.
// A CR can address exactly two audiences:
//   * Section → their own section only
//   * Batch   → every section of their department + batch (e.g. 2022 CSE A & B)
// Posts publish INSTANTLY to the local feed, then sync best-effort.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
  SwitchRow,
  TextField,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload, upload } from '../../api/client.js';
import { createUpdate } from '../../api/endpoints.js';
import { localFeed } from '../../lib/localFeed.js';
import { batchNumberLabel } from '../../lib/models.js';

const SCOPES = [
  {
    value: 'section',
    label: 'Section',
    icon: 'groups',
    description: 'Your section only',
  },
  {
    value: 'batch',
    label: 'Batch',
    icon: 'school',
    description: 'Both sections of your batch',
  },
];

const MAX_FILES = 6;
const ALLOWED = /\.(pdf|png|jpe?g|webp)$/i;

export default function ComposeUpdatePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();
  const profile = auth.profile;

  const deptCode = profile?.department?.code ?? 'CSE';
  const sectionName = profile?.section?.name ?? 'A';
  const batchLabel = batchNumberLabel(profile?.batch);
  const rawBatchNumber = Number(profile?.batch?.batchNumber) || Number(batchLabel) || null;
  const batchNumber = rawBatchNumber
    ? rawBatchNumber >= 2000
      ? rawBatchNumber % 100
      : rawBatchNumber
    : null;
  const canTargetBatch = Boolean(profile?.batch?.id || batchNumber);

  const [scope, setScope] = useState('section');
  const [urgent, setUrgent] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [posting, setPosting] = useState(false);
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const activeScope = SCOPES.find((option) => option.value === scope) ?? SCOPES[0];
  const batchAudience = `All ${deptCode}${batchLabel ? ` Batch ${batchLabel}` : ''} students — both sections`;
  const audiencePreview =
    scope === 'batch' ? batchAudience : `Section ${sectionName} only`;
  const audienceIcon = activeScope.icon;

  const pickFiles = (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    const accepted = files.filter((file) => ALLOWED.test(file.name));
    if (accepted.length !== files.length) {
      toast.error('Only PDF, PNG or JPG/WebP files can be attached.');
    }
    if (accepted.length === 0) return;
    setAttachments((current) => {
      const next = [...current, ...accepted].slice(0, MAX_FILES);
      if (current.length + accepted.length > MAX_FILES) toast.info('Maximum 6 attachments');
      return next;
    });
  };

  const removeAttachment = (file) => {
    setAttachments((current) => current.filter((f) => f !== file));
  };

  const post = async () => {
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = 'Give it a title';
    if (!body.trim()) nextErrors.body = 'Write the details';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPosting(true);

    const type = urgent ? 'emergency' : 'announcement';
    const isBatch = scope === 'batch';
    const update = {
      id: `loc-${Date.now()}_compose`,
      authorId: profile?.id ?? '',
      sectionId: isBatch ? '' : (profile?.section?.id ?? ''),
      sectionName: isBatch ? '' : sectionName,
      batchId: isBatch ? (profile?.batch?.id ?? '') : '',
      batchNumber: isBatch ? batchNumber : null,
      batchName: isBatch ? (profile?.batch?.label ?? '') : '',
      type,
      title: title.trim(),
      description: body.trim(),
      priority: urgent ? 'urgent' : 'normal',
      scope,
      departmentCode: deptCode,
      status: 'approved',
      attachments: attachments.length > 0 ? attachments.map((file) => file.name) : null,
      createdAt: new Date().toISOString(),
      author: { id: profile?.id ?? '', name: profile?.name ?? 'CR' },
    };

    // 1) Instant local publish.
    localFeed.postLocalUpdate(update);

    // 2) Best-effort backend sync (multipart when attachments exist).
    const data = {
      type: update.type,
      title: update.title,
      description: update.description,
      priority: update.priority,
      scope: update.scope,
      departmentCode: update.departmentCode,
      ...(isBatch
        ? {
            ...(update.batchId ? { batchId: update.batchId } : {}),
            ...(batchNumber ? { batchNumber } : {}),
          }
        : {}),
    };

    let feedback;
    try {
      const response =
        attachments.length === 0
          ? await createUpdate(data)
          : await (() => {
              const formData = new FormData();
              formData.append(
                'data',
                JSON.stringify({ ...data, attachments: update.attachments })
              );
              for (const file of attachments) formData.append('files', file);
              return upload('/updates', formData);
            })();

      // The server copy now carries this post, so retire the local mirror to
      // avoid showing the same announcement twice in the feed.
      const saved = extractPayload(response);
      const serverId =
        saved && typeof saved === 'object' ? saved.id ?? saved._id ?? null : null;
      if (serverId) {
        try {
          localFeed.markLocalUpdateSynced(update.id, serverId);
        } catch {
          /* non-critical */
        }
      }
      feedback = `Published \u2014 delivered to ${isBatch ? 'your batch' : `Section ${sectionName}`}`;
    } catch {
      feedback = `Published offline \u2014 \u201c${update.title}\u201d is in your ${isBatch ? 'batch' : 'section'} feed`;
    }

    setPosting(false);
    toast.success(feedback);
    navigate(-1);
  };

  return (
    <PageShell className="max-w-xl">
      <PageHeader
        title="New announcement"
        onBack={() => navigate(-1)}
        actions={
          <Button variant="filled" onClick={post} disabled={posting}>
            {posting ? <Spinner size={16} /> : <Icon name="send" size={18} />}
            <span>Post</span>
          </Button>
        }
      />

      {/* Audience */}
      <Card className="rounded-2xl">
        <div className="flex items-center gap-2">
          <Icon name={audienceIcon} size={17} className="text-primary dark:text-primary-light" />
          <p className="text-label-sm font-extrabold tracking-widest text-primary dark:text-primary-light">
            AUDIENCE
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SCOPES.map((option) => {
            const selected = scope === option.value;
            const disabled = option.value === 'batch' && !canTargetBatch;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => setScope(option.value)}
                title={disabled ? 'Your batch could not be identified from your profile.' : option.description}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary dark:border-primary-light dark:text-primary-light'
                    : 'border-outline bg-surface text-ink-muted hover:border-primary/40 hover:text-ink'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Icon name={option.icon} size={19} />
                <span className="min-w-0">
                  <span className="block text-label-lg font-bold">{option.label}</span>
                  <span className="block truncate text-label-sm font-normal opacity-80">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-body-sm text-ink-muted">
          <Icon name={scope === 'batch' ? 'school' : 'groups'} size={15} className="mt-0.5 shrink-0" />
          {audiencePreview}
        </p>
      </Card>

      <div className="mt-4">
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          hint="e.g. CSE-345 class cancelled today"
          error={errors.title}
        />
      </div>

      <div className="mt-4">
        <TextField
          label="Description"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          hint={'Share all details your classmates need…\n\n• What happened\n• When / where\n• What they should do'}
          multiline
          rows={6}
          error={errors.body}
        />
      </div>

      {/* Attachments */}
      <div className="mt-4 rounded-2xl border border-outline/70 p-4">
        <div className="flex items-center gap-2">
          <Icon name="attach_file" size={18} className="shrink-0 text-ink-muted" />
          <p className="min-w-0 flex-1 text-body-md text-ink">
            {attachments.length === 0
              ? 'Attach images or PDFs (up to 6)'
              : `${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`}
          </p>
          <button
            type="button"
            aria-label="Add attachments"
            title="Add attachments"
            disabled={attachments.length >= MAX_FILES}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:opacity-40 dark:text-primary-light"
          >
            <Icon name="add" size={20} />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={pickFiles}
          />
        </div>

        {attachments.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {attachments.map((file) => {
              const isPdf = file.name.toLowerCase().endsWith('.pdf');
              return (
                <span
                  key={`${file.name}-${file.lastModified}`}
                  className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-outline bg-surface px-2.5 py-1"
                >
                  <Icon
                    name={isPdf ? 'picture_as_pdf' : 'image'}
                    size={15}
                    className={isPdf ? 'shrink-0 text-cancellation' : 'shrink-0 text-accent'}
                  />
                  <span className="truncate text-label-md text-ink">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeAttachment(file)}
                    className="shrink-0 rounded-full p-0.5 text-ink-muted hover:text-critical"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Urgent toggle */}
      <div className="mt-3">
        <SwitchRow
          icon="priority_high"
          iconTone={urgent ? 'text-critical' : 'text-ink-muted'}
          title="Mark as urgent"
          subtitle="Urgent posts pin to the top with a red badge"
          checked={urgent}
          onChange={setUrgent}
        />
      </div>

      <Button
        variant="filled"
        size="lg"
        className="mt-5 w-full"
        onClick={post}
        disabled={posting}
      >
        {posting ? <Spinner size={18} /> : <Icon name="send" size={18} />}
        <span>Post announcement</span>
      </Button>
    </PageShell>
  );
}
