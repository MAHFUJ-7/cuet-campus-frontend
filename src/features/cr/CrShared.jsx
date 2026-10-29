// Shared CR Center widgets — port of cr_center_widgets.dart.
import { EmptyState, Icon, Spinner } from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { describeApiError } from '../../api/errors.js';
import {
  batchNumberLabel,
  overrideRangeLabel,
  overrideStatusLabel,
  overrideTypeLabel,
} from '../../lib/models.js';

export const DECLARATION_ICONS = {
  auto_day_off: 'event_busy',
  mid_break: 'beach_access',
  class_cancellation: 'cancel',
  room_change: 'meeting_room',
  time_change: 'schedule',
  extra_class: 'add_circle',
};

export const declarationIcon = (type) => DECLARATION_ICONS[type] ?? 'add_circle';

export const statusTone = (status) => {
  switch (status) {
    case 'approved':
      return 'text-success';
    case 'rejected':
      return 'text-critical';
    case 'expired':
      return 'text-ink-muted';
    default:
      return 'text-warning';
  }
};

export const statusBgTone = (status) => {
  switch (status) {
    case 'approved':
      return 'bg-success/15';
    case 'rejected':
      return 'bg-critical/15';
    case 'expired':
      return 'bg-ink-muted/15';
    default:
      return 'bg-warning/15';
  }
};

// ---------------------------------------------------------------------------
// Scope hero
// ---------------------------------------------------------------------------

export function CrScopeHero({ profile, sectionLabel, stats = [], refreshing = false, onRefresh }) {
  const batch = batchNumberLabel(profile?.batch);
  const identity = [
    profile?.department?.code,
    batch ? `Batch ${batch}` : null,
    sectionLabel,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-light p-5 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 right-16 h-36 w-36 rounded-full bg-white/5" />

      <div className="relative flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <Icon name="campaign" size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
            Class Representative
          </p>
          <h2 className="mt-0.5 truncate text-headline-sm font-extrabold">
            {profile?.name || 'CR Center'}
          </h2>
          <p className="mt-0.5 truncate text-label-sm text-white/75">
            {identity || 'Authorized representative'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh declarations"
          className="rounded-full p-2 text-white/75 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-60"
        >
          {refreshing ? <Spinner size={18} /> : <Icon name="refresh" size={20} />}
        </button>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white/10 px-3 py-2.5 backdrop-blur">
            <div className="flex items-center gap-1.5 text-white/70">
              <Icon name={stat.icon} size={14} />
              <span className="text-[9px] font-semibold uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="mt-1 text-title-lg font-extrabold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action grid
// ---------------------------------------------------------------------------

export const CR_ACTIONS = [
  { kind: 'auto', icon: 'event_busy', label: 'Declare Day Off', description: 'Cancel every class for a date', tone: 'text-critical bg-critical/10' },
  { kind: 'mid_break', icon: 'beach_access', label: 'Declare Mid-Break', description: 'Pause classes across a date range', tone: 'text-warning bg-warning/10' },
  { kind: 'class_cancellation', icon: 'cancel_schedule_send', label: 'Cancel Class', description: 'Call off one specific class', tone: 'text-cancellation bg-cancellation/10' },
  { kind: 'room_change', icon: 'meeting_room', label: 'Change Room', description: 'Move a class to another room', tone: 'text-room-change bg-room-change/10' },
  { kind: 'time_change', icon: 'schedule', label: 'Change Time', description: 'Reschedule a class time', tone: 'text-accent bg-accent/10' },
  { kind: 'extra_class', icon: 'add_circle', label: 'Extra Class', description: 'Add a make-up class', tone: 'text-success bg-success/10' },
  { kind: 'declare_ct', icon: 'quiz', label: 'Declare CT', description: 'Announce a class test for a course', tone: 'text-info bg-info/10' },
  { kind: 'permanent_routine', icon: 'edit', label: 'Permanent Routine Change', description: 'Edit a weekly class slot until changed again', tone: 'text-info bg-info/10' },
  { kind: 'conflicts', icon: 'fact_check', label: 'Find Time Conflicts', description: 'Scan classes and exams for time clashes', tone: 'text-warning bg-warning/10' },
  { kind: 'announcement', icon: 'campaign', label: 'Announcement', description: 'Post a notice to your section or whole batch — instantly in Updates.', tone: 'text-primary bg-primary/10 dark:text-primary-light', wide: true },
];

export function CrActionsGrid({ onAction }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {CR_ACTIONS.map((action) => (
        <button
          key={action.kind}
          type="button"
          onClick={() => onAction(action.kind)}
          className={`group flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${
            action.wide
              ? 'border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:border-primary/45 sm:col-span-2 xl:col-span-3'
              : 'border-outline/60 bg-surface hover:border-primary/30'
          }`}
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.tone}`}>
            <Icon name={action.icon} size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-label-lg font-bold text-ink">{action.label}</span>
            <span className="mt-0.5 block truncate text-label-sm text-ink-muted">
              {action.description}
            </span>
          </span>
          <Icon
            name="chevron_right"
            size={18}
            className="shrink-0 text-ink-muted/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Declarations section
// ---------------------------------------------------------------------------

export function CrDeclarationTile({ item, onWithdraw }) {
  const tone = statusTone(item.status);
  return (
    <div className="mb-2 flex items-start gap-3 rounded-2xl border border-outline/60 bg-surface p-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${statusBgTone(item.status)}`}>
        <Icon name={declarationIcon(item.type)} size={20} className={tone} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-title-sm font-semibold text-ink">
          {overrideTypeLabel(item.type)} · {overrideRangeLabel(item)}
        </p>
        {item.reason && (
          <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{item.reason}</p>
        )}
        <p className={`mt-0.5 text-label-sm font-bold tracking-wide ${tone}`}>
          {overrideStatusLabel(item.status).toUpperCase()}
        </p>
      </div>
      {onWithdraw && (
        <button
          type="button"
          onClick={onWithdraw}
          className="shrink-0 rounded-lg px-2 py-1 text-label-lg font-semibold text-primary hover:bg-primary/10 dark:text-primary-light"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

export function LocalDeclarationTile({ record, onWithdraw }) {
  const status = String(record.status ?? 'approved');
  const isPending = status === 'pending';
  const tone = isPending ? 'text-warning' : 'text-success';
  return (
    <div className="mb-2 flex items-start gap-3 rounded-2xl border border-outline/60 bg-surface p-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isPending ? 'bg-warning/15' : 'bg-success/15'}`}>
        <Icon name={declarationIcon(record.type)} size={20} className={tone} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-title-sm font-semibold text-ink">
          {overrideTypeLabel(String(record.type ?? ''))} · {record.range ?? ''}
        </p>
        {String(record.reason ?? '') !== '' && (
          <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{record.reason}</p>
        )}
        <p className={`mt-0.5 text-[9px] font-bold tracking-wide ${tone}`}>
          {isPending
            ? 'PENDING — AWAITING COORDINATOR'
            : 'ACTIVE — PUBLISHED TO YOUR SECTION'}
        </p>
      </div>
      {onWithdraw && (
        <button
          type="button"
          onClick={onWithdraw}
          className="shrink-0 rounded-lg px-2 py-1 text-label-lg font-semibold text-primary hover:bg-primary/10 dark:text-primary-light"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

export function CrDeclarationsSection({ title = 'My Declarations', controller, onWithdrawLocal }) {
  const toast = useToast();
  const {
    declarations,
    localOverrides,
    loadingDeclarations,
    error,
    pendingCount,
    loadDeclarations,
    withdraw,
  } = controller;

  // Never let a failed withdraw become an unhandled rejection.
  const handleWithdraw = async (item) => {
    try {
      await withdraw(item);
      toast.success('Declaration withdrawn');
    } catch (withdrawError) {
      toast.error(describeApiError(withdrawError));
    }
  };

  const handleWithdrawLocal = async (localId) => {
    if (!onWithdrawLocal) return;
    try {
      await onWithdrawLocal(localId);
      toast.success('Declaration withdrawn');
    } catch (withdrawError) {
      toast.error(describeApiError(withdrawError));
    }
  };

  const items = declarations;
  // Never render the local mirror of a declaration the server already returned.
  const visibleLocal = localOverrides.filter(
    (record) => !items.some((item) => item.id === record.serverId)
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-title-lg font-bold text-ink">{title}</p>
        {pendingCount > 0 && (
          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-label-md font-semibold text-warning">
            {pendingCount} pending
          </span>
        )}
      </div>

      {loadingDeclarations ? (
        <div className="flex justify-center py-8">
          <Spinner size={26} />
        </div>
      ) : error && items.length === 0 && visibleLocal.length === 0 ? (
        <div className="rounded-2xl border border-outline/60 p-5 text-center">
          <p className="text-body-md text-ink-muted">{error}</p>
          <button
            type="button"
            onClick={loadDeclarations}
            className="mt-3 rounded-xl border border-primary px-4 py-2 text-label-lg font-semibold text-primary hover:bg-primary/5 dark:text-primary-light"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 && visibleLocal.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No declarations yet"
          message="Declare a day off or class change and it will appear here."
        />
      ) : (
        <div>
          {visibleLocal.map((record) => (
            <LocalDeclarationTile
              key={record.localId ?? record.createdAt}
              record={record}
              onWithdraw={
                record.status !== 'withdrawn' && onWithdrawLocal
                  ? () => handleWithdrawLocal(String(record.localId ?? ''))
                  : null
              }
            />
          ))}
          {items.map((item) => (
            <CrDeclarationTile
              key={item.id}
              item={item}
              onWithdraw={
                item.status === 'pending' ||
                item.status === 'approved' ||
                item.status === 'active'
                  ? () => handleWithdraw(item)
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog chrome
// ---------------------------------------------------------------------------

export function CrDialog({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-3">
          <span className="h-1 w-10 rounded-full bg-outline sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-variant hover:text-ink"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
