// Shared CR Center widgets — port of cr_center_widgets.dart.
import { useEffect, useState } from 'react';
import { Button, EmptyState, Icon, Spinner } from '../../components/ui/index.jsx';
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
  classes_end: 'event_busy',
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

// Grouped quick actions — related declarations share one entry point and
// open a picker with the individual options.
export const CR_ACTION_GROUPS = [
  {
    kind: 'group_off',
    icon: 'event_busy',
    label: 'Off & Cancellation',
    description: 'Day off, mid-break or cancel a class',
    tone: 'text-critical bg-critical/10',
    options: [
      { kind: 'auto', icon: 'event_busy', label: 'Declare Day Off', description: 'Cancel every class for a date' },
      { kind: 'mid_break', icon: 'beach_access', label: 'Declare Mid-Break', description: 'Pause classes across a date range' },
      { kind: 'class_cancellation', icon: 'cancel_schedule_send', label: 'Cancel Class', description: 'Call off one specific class' },
    ],
  },
  {
    kind: 'group_routine',
    icon: 'edit',
    label: 'Change Routine',
    description: 'Time, room, extra class or permanent edits',
    tone: 'text-accent bg-accent/10',
    options: [
      { kind: 'time_change', icon: 'schedule', label: 'Change Time', description: 'Reschedule a class time' },
      { kind: 'room_change', icon: 'meeting_room', label: 'Change Room', description: 'Move a class to another room' },
      { kind: 'extra_class', icon: 'add_circle', label: 'Extra Class', description: 'Add a make-up class' },
      { kind: 'permanent_routine', icon: 'edit', label: 'Permanent Routine Change', description: 'Edit a weekly class slot until changed again' },
    ],
  },
  {
    kind: 'group_classroutine',
    icon: 'calendar_month',
    label: 'Class Routine',
    description: 'Edit the weekly routine or submit a full routine for review',
    tone: 'text-primary bg-primary/10 dark:text-primary-light',
    options: [
      { kind: 'class_routine_edit', icon: 'edit', label: 'Edit Weekly Routine', description: 'Change classes directly — publishes instantly, no approval needed' },
      { kind: 'class_routine_propose', icon: 'menu_book', label: 'Submit Full Routine', description: 'Build the whole Sunday–Thursday week and send it for coordinator review' },
    ],
  },
  {
    kind: 'group_assessment',
    icon: 'quiz',
    label: 'Assessments',
    description: 'Declare CT, Quiz or Viva',
    tone: 'text-info bg-info/10',
    options: [
      { kind: 'declare_ct', assessmentKind: 'ct', icon: 'quiz', label: 'Class Test (CT)', description: 'Batch-wide class test for a course' },
      { kind: 'declare_ct', assessmentKind: 'quiz', icon: 'fact_check', label: 'Quiz', description: 'Batch-wide quiz for a course' },
      { kind: 'declare_ct', assessmentKind: 'viva', icon: 'co_present', label: 'Viva', description: 'Batch-wide viva for a course' },
    ],
  },
  {
    kind: 'group_wrapup',
    icon: 'event_available',
    label: 'Term Wrap-up',
    description: 'End classes (start DL) and submit the full exam routine',
    tone: 'text-success bg-success/10',
    options: [
      { kind: 'wrap_up', wrapKind: 'classes_end', icon: 'event_busy', label: 'End Classes (Start DL)', description: 'Classes stop from a date — DL for exam prep begins' },
      { kind: 'exam_routine', icon: 'menu_book', label: 'Full Exam Routine', description: 'Schedule every subject, then submit for approval' },
    ],
  },
  { kind: 'conflicts', icon: 'fact_check', label: 'Find Time Conflicts', description: 'Scan classes and exams for time clashes', tone: 'text-warning bg-warning/10' },
  { kind: 'announcement', icon: 'campaign', label: 'Announcement', description: 'Post a notice to your section or whole batch — instantly in Updates.', tone: 'text-primary bg-primary/10 dark:text-primary-light' },
];

/** Picker shown inside a grouped action — lists the individual options. */
function CrGroupPicker({ group, onClose, onPick }) {
  return (
    <CrDialog open={Boolean(group)} onClose={onClose}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${group?.tone ?? ''}`}>
          <Icon name={group?.icon ?? 'list'} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title-lg font-extrabold text-ink">{group?.label}</p>
          <p className="text-label-sm text-ink-muted">Choose what you want to declare</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {(group?.options ?? []).map((option) => (
          <button
            key={`${option.kind}:${option.assessmentKind ?? ''}`}
            type="button"
            onClick={() => onPick(option)}
            className="flex w-full items-center gap-3 rounded-2xl border border-outline/70 bg-surface p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-surface-variant"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-variant">
              <Icon name={option.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg font-bold text-ink">{option.label}</span>
              <span className="block truncate text-label-sm text-ink-muted">{option.description}</span>
            </span>
            <Icon name="chevron_right" size={18} className="shrink-0 text-ink-muted/50" />
          </button>
        ))}
      </div>
    </CrDialog>
  );
}

export function CrActionsGrid({ onAction }) {
  const [picker, setPicker] = useState(null);
  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {CR_ACTION_GROUPS.map((action) => (
          <button
            key={action.kind}
            type="button"
            onClick={() => (action.options ? setPicker(action) : onAction(action.kind))}
            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-outline/60 bg-surface p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.tone} transition-transform group-hover:scale-105`}>
              <Icon name={action.icon} size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg font-bold text-ink">{action.label}</span>
              <span className="mt-0.5 block line-clamp-2 text-label-sm leading-snug text-ink-muted">
                {action.description}
              </span>
            </span>
            <Icon
              name={action.options ? 'expand_more' : 'chevron_right'}
              size={18}
              className="shrink-0 text-ink-muted/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </button>
        ))}
      </div>

      <CrGroupPicker
        group={picker}
        onClose={() => setPicker(null)}
        onPick={(option) => {
          setPicker(null);
          onAction(option.kind, option);
        }}
      />
    </>
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
  const syncError = String(record.syncError ?? '');
  const isPending = status === 'pending';
  // The server rejected this declaration — it only lives on this device.
  const syncFailed = !isPending && syncError !== '';
  const tone = isPending ? 'text-warning' : syncFailed ? 'text-critical' : 'text-success';
  const badgeBg = isPending ? 'bg-warning/15' : syncFailed ? 'bg-critical/15' : 'bg-success/15';
  const statusLine = isPending
    ? 'PENDING — AWAITING COORDINATOR'
    : syncFailed
      ? 'SYNC FAILED — SAVED ON THIS DEVICE ONLY'
      : 'ACTIVE — PUBLISHED TO YOUR SECTION';
  return (
    <div className="mb-2 flex items-start gap-3 rounded-2xl border border-outline/60 bg-surface p-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${badgeBg}`}>
        <Icon name={declarationIcon(record.type)} size={20} className={tone} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-title-sm font-semibold text-ink">
          {overrideTypeLabel(String(record.type ?? ''))} · {record.range ?? ''}
        </p>
        {String(record.reason ?? '') !== '' && (
          <p className="mt-0.5 line-clamp-2 text-body-sm text-ink-muted">{record.reason}</p>
        )}
        <p className={`mt-0.5 text-[9px] font-bold tracking-wide ${tone}`}>{statusLine}</p>
        {syncFailed && (
          <p className="mt-0.5 line-clamp-2 text-label-sm text-critical/90">Server: {syncError}</p>
        )}
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
  // Close on Escape — matches native dialog behaviour.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="glass-strong animate-scale-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-2xl"
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
