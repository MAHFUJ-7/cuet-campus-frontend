// Shared event card — used by the Events manager and the Academic Calendar.
import { Card, Icon, IconButton } from '../../components/ui/index.jsx';
import {
  EVENT_TYPES,
  eventAudienceLabel,
  eventDateLabel,
  eventTimeLabel,
} from '../../lib/eventStore.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateParts(iso) {
  const match = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { day: '—', month: '—' };
  return { day: Number(match[3]), month: MONTHS[Number(match[2]) - 1] ?? '—' };
}

export function EventDateBadge({ event, className = '' }) {
  const meta = EVENT_TYPES[event?.type] ?? EVENT_TYPES.other;
  const { day, month } = dateParts(event?.startDate);
  return (
    <span
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${meta.tone} ${className}`}
    >
      <span className="text-title-lg font-extrabold leading-none">{day}</span>
      <span className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em]">{month}</span>
    </span>
  );
}

export default function EventCard({
  event,
  canManage = false,
  onEdit = null,
  onDelete = null,
  compact = false,
}) {
  const meta = EVENT_TYPES[event?.type] ?? EVENT_TYPES.other;

  return (
    <Card padded={false} className={`mb-2.5 ${compact ? 'p-3.5' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <EventDateBadge event={event} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-title-md font-extrabold leading-snug text-ink">
              {event.title}
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${meta.tone}`}
            >
              {meta.label}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-md text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Icon name="calendar_today" size={14} /> {eventDateLabel(event)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="schedule" size={14} /> {eventTimeLabel(event)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <Icon name="place" size={14} /> {event.location}
              </span>
            )}
          </div>

          {!compact && event.description && (
            <p className="mt-1.5 line-clamp-2 text-body-sm text-ink-muted">{event.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
              <Icon name={event.audience === 'personal' ? 'person' : 'groups'} size={11} />
              {eventAudienceLabel(event)}
            </span>
            {event.isSeed && (
              <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary dark:text-primary-light">
                Sample
              </span>
            )}
          </div>
        </div>
      </div>

      {canManage && (onEdit || onDelete) && (
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-outline/60 pt-2.5">
          <span className="mr-auto text-[10px] font-medium text-ink-muted">
            Stored on this device
          </span>
          {onEdit && <IconButton icon="edit" label="Edit event" onClick={onEdit} />}
          {onDelete && (
            <IconButton
              icon="delete"
              label="Delete event"
              onClick={onDelete}
              className="text-danger hover:bg-danger/10 hover:text-danger"
            />
          )}
        </div>
      )}
    </Card>
  );
}
