// Events — local-first academic event management.
//
// Coordinators can publish campus-wide or section events; CRs can
// publish section events; every student can keep personal events. Events are
// stored on this device and appear immediately in the Academic Calendar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  SegmentedTabs,
  Select,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  EVENT_TYPES,
  canManageEvent,
  eventStore,
  isEventPast,
} from '../../lib/eventStore.js';
import { isoDate } from '../../lib/datetime.js';
import { useVisibleEvents } from '../../hooks/useEvents.js';
import EventCard from './EventCard.jsx';
import EventForm from './EventForm.jsx';

const TYPE_OPTIONS = Object.entries(EVENT_TYPES).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

function addDaysKey(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function EventDialog({ open, event, auth, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previous = document.activeElement;

    const onKeyDown = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault();
        onClose();
        return;
      }
      if (keyboardEvent.key !== 'Tab') return;
      const focusable = [
        ...(dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []),
      ].filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (keyboardEvent.shiftKey && document.activeElement === first) {
        keyboardEvent.preventDefault();
        last.focus();
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-outline/60 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet/10 text-violet">
            <Icon name="event_note" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="event-dialog-title" className="text-title-lg font-bold text-ink">
              {event ? 'Edit event' : 'Add event'}
            </h2>
            <p className="mt-0.5 text-body-sm text-ink-muted">
              Saved on this device and shown in the Academic Calendar.
            </p>
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <EventForm
            event={event}
            auth={auth}
            submitLabel={event ? 'Save changes' : 'Add event'}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();
  const events = useVisibleEvents();
  const [tab, setTab] = useState('upcoming');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const decorated = useMemo(() => {
    const now = new Date();
    return events.map((event) => ({ event, past: isEventPast(event, now) }));
  }, [events]);

  const upcoming = useMemo(
    () =>
      decorated
        .filter((item) => !item.past)
        .sort((a, b) =>
          `${a.event.startDate}T${a.event.startTime || '00:00'}`.localeCompare(
            `${b.event.startDate}T${b.event.startTime || '00:00'}`
          )
        ),
    [decorated]
  );

  const past = useMemo(
    () =>
      decorated
        .filter((item) => item.past)
        .sort((a, b) =>
          `${b.event.startDate}T${b.event.startTime || '00:00'}`.localeCompare(
            `${a.event.startDate}T${a.event.startTime || '00:00'}`
          )
        ),
    [decorated]
  );

  const weekAhead = addDaysKey(7);
  const thisWeek = upcoming.filter(
    (item) => item.event.startDate >= isoDate(new Date()) && item.event.startDate <= weekAhead
  ).length;

  const source = tab === 'upcoming' ? upcoming : tab === 'past' ? past : decorated;
  const filtered = source
    .filter((item) => typeFilter === 'all' || item.event.type === typeFilter)
    .map((item) => item.event);

  const isManager = auth.isCoordinator;

  // CRs compose events on the CR compose page (Event tab); coordinators and
  // students use the local dialog here.
  const openCreate = () => {
    if (auth.isCR && !isManager) {
      navigate('/cr/compose?tab=event');
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (event) => {
    setEditing(event);
    setDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    try {
      eventStore.remove(deleteTarget.id, auth);
      toast.success('Event deleted');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error?.message || 'Could not delete the event');
    }
  };

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Events"
        subtitle="Campus, section and personal events"
        onBack={() => navigate(-1)}
        actions={
          <Button size="sm" icon="add" onClick={openCreate}>
            Add event
          </Button>
        }
      />

      <div className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-light p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 right-20 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Icon name="event_note" size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
              Academic events
            </p>
            <h2 className="mt-0.5 text-headline-sm font-extrabold">Plan what’s next</h2>
            <p className="mt-0.5 text-label-sm text-white/75">
              {upcoming.length} upcoming · Saved on this device
            </p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Upcoming', value: upcoming.length },
            { label: 'This week', value: thisWeek },
            { label: 'All events', value: events.length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/10 px-3 py-2 backdrop-blur">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/65">
                {stat.label}
              </p>
              <p className="mt-0.5 text-title-lg font-extrabold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedTabs
          tabs={[
            { value: 'upcoming', label: 'Upcoming', icon: 'event_available' },
            { value: 'past', label: 'Past', icon: 'history' },
            { value: 'all', label: 'All', icon: 'list' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="ml-auto w-full sm:w-44">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[{ value: 'all', label: 'All event types' }, ...TYPE_OPTIONS]}
            aria-label="Filter by event type"
          />
        </div>
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-xl bg-primary/8 px-3 py-2 text-label-sm text-primary dark:text-primary-light">
        <Icon name="offline_bolt" size={15} className="mt-0.5 shrink-0" />
        <p>
          Events are local-first: they appear on your calendar immediately. Campus-wide events are
          visible to every account using this device; personal events stay private.
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="event_note"
          title={tab === 'past' ? 'No past events' : 'No events yet'}
          message={
            tab === 'past'
              ? 'Events you have finished will appear here.'
              : 'Add a campus, section or personal event and it will show up in the Academic Calendar.'
          }
          action={<Button variant="tonal" icon="add" onClick={openCreate}>Add event</Button>}
        />
      ) : (
        <div>
          {filtered.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              canManage={canManageEvent(event, auth)}
              onEdit={() => openEdit(event)}
              onDelete={() => setDeleteTarget(event)}
            />
          ))}
        </div>
      )}

      <EventDialog
        open={dialogOpen}
        event={editing}
        auth={auth}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete event"
        message={
          deleteTarget
            ? `Remove “${deleteTarget.title}” from your calendar? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}
