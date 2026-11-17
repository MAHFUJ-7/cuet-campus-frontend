// Routine Proposals — coordinator review of CR-submitted full weekly class
// routines. Approving a proposal publishes it as the section's official
// class routine (replacing the previous one); rejecting returns it with a
// note for the CR to revise.
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import { getRoutineProposals, reviewRoutineProposal } from '../../api/endpoints.js';
import { isOfflineSession } from '../../lib/session.js';

const toArray = (payload) =>
  Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];

const proposalIdOf = (proposal) => String(proposal?._id ?? proposal?.id ?? '');

const STATUS_META = {
  pending: {
    label: 'PENDING',
    badge: 'bg-warning/15 text-warning',
    icon: 'schedule',
    iconTone: 'text-warning',
  },
  approved: {
    label: 'PUBLISHED',
    badge: 'bg-success/15 text-success',
    icon: 'verified',
    iconTone: 'text-success',
  },
  rejected: {
    label: 'REJECTED',
    badge: 'bg-critical/15 text-critical',
    icon: 'cancel',
    iconTone: 'text-critical',
  },
};

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

function ProposalCard({ proposal, busy, onReview }) {
  const status = String(proposal.status ?? 'pending');
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const sectionName = proposal.sectionId?.name ?? proposal.sectionId?.label ?? 'Section';
  const submittedBy = proposal.submittedBy?.name ?? 'CR';
  const entries = [...(proposal.entries ?? [])].sort(
    (a, b) =>
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
      String(a.startTime).localeCompare(String(b.startTime))
  );

  return (
    <div className="rounded-2xl border border-outline/70 bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-variant ${meta.iconTone}`}>
          <Icon name={meta.icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-title-md font-extrabold text-ink">Section {sectionName}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-label-sm text-ink-muted">
            {entries.length} classes · submitted by {submittedBy}
            {proposal.reviewedBy?.name ? ` · reviewed by ${proposal.reviewedBy.name}` : ''}
          </p>
        </div>
      </div>

      {proposal.reviewNote && (
        <p className="mt-2 rounded-xl bg-surface-variant px-3 py-2 text-label-md text-ink-muted">
          Review note: {proposal.reviewNote}
        </p>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-outline/60">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-variant text-[10px] font-extrabold tracking-wider text-ink-muted">
              <th className="px-2.5 py-1.5">DAY</th>
              <th className="px-2.5 py-1.5">PERIOD</th>
              <th className="px-2.5 py-1.5">SUBJECT</th>
              <th className="px-2.5 py-1.5">TIME</th>
              <th className="hidden px-2.5 py-1.5 sm:table-cell">TEACHERS</th>
              <th className="hidden px-2.5 py-1.5 sm:table-cell">ROOM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline/50">
            {entries.map((entry, index) => (
              <tr key={index} className="text-body-sm">
                <td className="px-2.5 py-1.5 font-bold text-ink">{entry.day}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 font-bold text-ink">
                  P{entry.period}
                  {entry.periodEnd > entry.period ? `–P${entry.periodEnd}` : ''}
                </td>
                <td className="px-2.5 py-1.5">
                  <span className="font-bold text-ink">{entry.courseCode}</span>
                  <span className="block text-label-sm text-ink-muted">{entry.courseTitle}</span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-ink-muted">
                  {entry.startTime}–{entry.endTime}
                  {entry.classType && entry.classType !== 'lecture' ? (
                    <span className="ml-1 rounded bg-info/10 px-1 text-[10px] font-bold text-info">
                      {entry.classType}
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-2.5 py-1.5 text-ink-muted sm:table-cell">
                  {(entry.teachers ?? []).join(', ') || '—'}
                </td>
                <td className="hidden px-2.5 py-1.5 text-ink-muted sm:table-cell">
                  {entry.room || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="filled"
            className="flex-1"
            disabled={busy}
            onClick={() => onReview(proposal, 'approved')}
          >
            <Icon name="check_circle" size={18} />
            <span>Publish routine</span>
          </Button>
          <Button
            variant="outlined"
            className="flex-1"
            disabled={busy}
            onClick={() => onReview(proposal, 'rejected')}
          >
            <Icon name="cancel" size={18} />
            <span>Reject</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CoordinatorRoutineProposalsPage() {
  const toast = useToast();
  const [proposals, setProposals] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [reviewingId, setReviewingId] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await getRoutineProposals({});
      setProposals(toArray(extractPayload(response)));
    } catch (loadError) {
      setError(describeApiError(loadError));
      setProposals([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (proposal, decision, reviewNote = null) => {
    if (isOfflineSession()) {
      toast.info('Reviewing proposals requires a connection.');
      return;
    }
    setReviewingId(proposalIdOf(proposal));
    try {
      await reviewRoutineProposal(proposalIdOf(proposal), decision, reviewNote);
      toast.success(
        decision === 'approved'
          ? 'Routine approved and published as the class routine'
          : 'Proposal rejected — the CR can revise and resubmit'
      );
      load();
    } catch (reviewError) {
      toast.error(describeApiError(reviewError));
    } finally {
      setReviewingId(null);
    }
  };

  const rejectWithNote = async () => {
    const target = noteTarget;
    setNoteTarget(null);
    if (!target) return;
    await review(target, 'rejected', note.trim() || null);
    setNote('');
  };

  const visible = (proposals ?? []).filter((proposal) =>
    filter === 'all' ? true : proposal.status === filter
  );
  const pendingCount = (proposals ?? []).filter((proposal) => proposal.status === 'pending').length;

  const filters = [
    { key: 'pending', label: `Pending (${pendingCount})` },
    { key: 'approved', label: 'Published' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Routine Proposals"
        subtitle="Review CR-submitted weekly routines — approval publishes them."
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-surface-variant p-1">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-label-md font-bold transition-colors ${
              filter === item.key
                ? 'bg-surface text-primary shadow-sm dark:text-primary-light'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {proposals == null ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={24} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="No proposals here"
          subtitle="When a CR submits a full weekly routine it appears here for review."
        />
      ) : (
        <div className="space-y-4">
          {visible.map((proposal) => (
            <ProposalCard
              key={proposalIdOf(proposal)}
              proposal={proposal}
              busy={reviewingId === proposalIdOf(proposal)}
              onReview={(target, decision) => {
                if (decision === 'rejected') {
                  setNoteTarget(target);
                  setNote('');
                } else {
                  review(target, decision);
                }
              }}
            />
          ))}
        </div>
      )}

      {noteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 animate-fade-in"
          onClick={() => setNoteTarget(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-title-md font-extrabold text-ink">Reject proposal</p>
            <p className="mt-1 text-label-md text-ink-muted">
              Tell the CR what to fix (optional) — they can revise and resubmit.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Please include the lab sessions too"
              className="mt-3 w-full rounded-xl border border-outline bg-surface px-3 py-2 text-body-md text-ink outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="outlined" className="flex-1" onClick={() => setNoteTarget(null)}>
                Cancel
              </Button>
              <Button variant="filled" className="flex-1" onClick={rejectWithNote}>
                <Icon name="send" size={16} />
                <span>Reject</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
