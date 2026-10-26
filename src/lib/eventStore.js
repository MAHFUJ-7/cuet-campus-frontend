// Local-first academic events.
//
// The backend does not expose an events endpoint yet, so events are persisted
// on this device and merged into the Academic Calendar. The store is shaped so
// a future API can replace the persistence layer without touching the UI.
import { isoDate } from './datetime.js';
import { KEYS, readJson, writeJson } from './storage.js';

const CHANGE_EVENT = 'cuet:events-changed';
const MAX_RANGE_DAYS = 120;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const EVENT_TYPES = {
  academic: {
    label: 'Academic',
    icon: 'school',
    tone: 'bg-violet/10 text-violet',
    dot: 'bg-violet',
  },
  seminar: {
    label: 'Seminar',
    icon: 'co_present',
    tone: 'bg-accent/10 text-accent',
    dot: 'bg-accent',
  },
  workshop: {
    label: 'Workshop',
    icon: 'construction',
    tone: 'bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  holiday: {
    label: 'Holiday',
    icon: 'beach_access',
    tone: 'bg-success/10 text-success',
    dot: 'bg-success',
  },
  exam: {
    label: 'Exam',
    icon: 'quiz',
    tone: 'bg-danger/10 text-danger',
    dot: 'bg-danger',
  },
  club: {
    label: 'Club',
    icon: 'groups',
    tone: 'bg-primary/10 text-primary dark:text-primary-light',
    dot: 'bg-primary',
  },
  other: {
    label: 'Other',
    icon: 'event_note',
    tone: 'bg-surface-variant text-ink-muted',
    dot: 'bg-ink-muted',
  },
};

export const AUDIENCE_LABELS = {
  campus: 'Campus-wide',
  section: 'Section',
  personal: 'Personal',
};

const dateAhead = (days) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + Number(days || 0));
  return isoDate(d);
};

function seedEvents() {
  const createdAt = new Date().toISOString();
  const base = {
    createdBy: { id: 'offline-events', name: 'Campus Events' },
    createdAt,
    isSeed: true,
  };

  return [
    {
      ...base,
      id: 'evt-seed-showcase',
      title: 'CSE Project Showcase',
      description:
        'Final-year and term project teams present working demos to faculty and industry guests.',
      type: 'academic',
      startDate: dateAhead(3),
      endDate: dateAhead(3),
      startTime: '10:00',
      endTime: '13:00',
      location: 'CSE Building Atrium',
      audience: 'campus',
    },
    {
      ...base,
      id: 'evt-seed-advising',
      title: 'Mid-term Advising Session',
      description:
        'Course coordinators answer questions about registration, backlog courses and term planning.',
      type: 'seminar',
      startDate: dateAhead(5),
      endDate: dateAhead(5),
      startTime: '14:00',
      endTime: '16:00',
      location: 'Seminar Room, Academic Building',
      audience: 'campus',
    },
    {
      ...base,
      id: 'evt-seed-lab-a',
      title: 'Section A — Sessional Lab Briefing',
      description: 'Project group formation and lab safety briefing for Section A.',
      type: 'workshop',
      startDate: dateAhead(2),
      endDate: dateAhead(2),
      startTime: '10:00',
      endTime: '11:30',
      location: 'Lab 2, CSE Building',
      audience: 'section',
      sectionName: 'A',
    },
    {
      ...base,
      id: 'evt-seed-lab-b',
      title: 'Section B — Sessional Lab Briefing',
      description: 'Project group formation and lab safety briefing for Section B.',
      type: 'workshop',
      startDate: dateAhead(2),
      endDate: dateAhead(2),
      startTime: '14:00',
      endTime: '15:30',
      location: 'Lab 3, CSE Building',
      audience: 'section',
      sectionName: 'B',
    },
    {
      ...base,
      id: 'evt-seed-codefest',
      title: 'CUET CodeFest 2026',
      description:
        'Inter-department programming contest. Team registration closes one day before the event.',
      type: 'club',
      startDate: dateAhead(12),
      endDate: dateAhead(12),
      startTime: '09:00',
      endTime: '18:00',
      location: 'CSE Building',
      audience: 'campus',
    },
  ];
}

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : isoDate(value);
  }
  const raw = String(value).trim();
  const plain = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(plain)) return plain;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : isoDate(parsed);
}

export function normalizeSectionName(value) {
  if (!value) return '';
  if (typeof value === 'object') {
    return normalizeSectionName(value.name ?? value.label ?? '');
  }
  return String(value).replace(/^section\s*/i, '').trim().toUpperCase();
}

function sameSection(a, b) {
  const left = normalizeSectionName(a);
  const right = normalizeSectionName(b);
  return Boolean(left && right && left === right);
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const startDate = normalizeDate(raw.startDate);
  if (!startDate) return null;
  const endDate = normalizeDate(raw.endDate) || startDate;
  const type = EVENT_TYPES[raw.type] ? raw.type : 'other';
  const audience = ['campus', 'section', 'personal'].includes(raw.audience)
    ? raw.audience
    : 'campus';

  return {
    id: String(raw.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    title: String(raw.title ?? '').trim(),
    description: String(raw.description ?? '').trim(),
    type,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
    startTime: String(raw.startTime ?? '').slice(0, 5),
    endTime: String(raw.endTime ?? '').slice(0, 5),
    location: String(raw.location ?? '').trim(),
    audience,
    sectionName: audience === 'section' ? normalizeSectionName(raw.sectionName) : '',
    createdBy: {
      id: String(raw.createdBy?.id ?? ''),
      name: String(raw.createdBy?.name ?? 'CUET AI Campus'),
    },
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    isSeed: Boolean(raw.isSeed),
  };
}

function readAll() {
  const stored = readJson(KEYS.localEvents, null);
  if (Array.isArray(stored)) {
    return stored.map(normalizeEvent).filter(Boolean);
  }
  const seeded = seedEvents();
  writeJson(KEYS.localEvents, seeded);
  return seeded;
}

function emitChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aKey = `${a.startDate}T${a.startTime || '00:00'}`;
    const bKey = `${b.startDate}T${b.startTime || '00:00'}`;
    return aKey.localeCompare(bKey) || a.title.localeCompare(b.title);
  });
}

export function eventOccursOn(event, dateKey) {
  if (!event || !dateKey) return false;
  return event.startDate <= dateKey && dateKey <= event.endDate;
}

/** Every YYYY-MM-DD covered by an event (multi-day events included). */
export function eventDateKeys(event) {
  if (!event?.startDate) return [];
  const keys = [];
  const cursor = new Date(`${event.startDate}T12:00:00`);
  const end = new Date(`${event.endDate || event.startDate}T12:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return keys;

  let guard = 0;
  while (cursor <= end && guard < MAX_RANGE_DAYS) {
    keys.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return keys;
}

function formatPlainDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

export function eventDateLabel(event) {
  if (!event?.startDate) return '';
  if (!event.endDate || event.endDate === event.startDate) {
    return formatPlainDate(event.startDate);
  }
  const start = formatPlainDate(event.startDate);
  const end = formatPlainDate(event.endDate);
  return `${start} → ${end}`;
}

export function eventTimeLabel(event) {
  if (event?.startTime && event?.endTime) return `${event.startTime} – ${event.endTime}`;
  if (event?.startTime) return `From ${event.startTime}`;
  return 'All day';
}

export function eventAudienceLabel(event) {
  if (!event) return '';
  if (event.audience === 'section') {
    return event.sectionName ? `Section ${event.sectionName}` : 'Section event';
  }
  if (event.audience === 'personal') return 'Personal';
  return 'Campus-wide';
}

export function isEventPast(event, now = new Date()) {
  if (!event?.endDate) return false;
  const today = isoDate(now);
  if (event.endDate < today) return true;
  if (event.endDate > today) return false;
  if (!event.endTime) return false;
  const [hour, minute] = event.endTime.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  return now.getHours() * 60 + now.getMinutes() > hour * 60 + minute;
}

export function canManageEvent(event, auth) {
  if (!event || !auth?.profile) return false;
  if (auth.isCoordinator || auth.isAdmin) return true;
  if (event.audience === 'personal') {
    return String(event.createdBy?.id ?? '') === String(auth.profile.id ?? '');
  }
  if (auth.isCR && event.audience === 'section') {
    return sameSection(event.sectionName, auth.profile.section);
  }
  return false;
}

export const eventStore = {
  /** All raw events, sorted by start date/time. */
  getAll() {
    return sortEvents(readAll());
  },

  /** Events visible to the signed-in profile. */
  visibleFor(auth) {
    const profile = auth?.profile;
    if (!profile) return [];

    return sortEvents(
      readAll().filter((event) => {
        if (event.audience === 'personal') {
          return String(event.createdBy?.id ?? '') === String(profile.id ?? '');
        }
        if (event.audience === 'section') {
          if (auth.isCoordinator || auth.isAdmin) return true;
          return sameSection(event.sectionName, profile.section);
        }
        return true;
      })
    );
  },

  save(values, auth) {
    const profile = auth?.profile;
    if (!profile) throw new Error('Sign in to save events');

    const manager = auth.isCoordinator || auth.isAdmin;
    let audience = values.audience;
    if (!manager && !auth.isCR) audience = 'personal';
    if (auth.isCR && !manager && audience === 'campus') audience = 'section';
    if (!['campus', 'section', 'personal'].includes(audience)) {
      audience = manager ? 'campus' : auth.isCR ? 'section' : 'personal';
    }

    let sectionName = '';
    if (audience === 'section') {
      sectionName = normalizeSectionName(values.sectionName || profile.section);
      if (!sectionName) {
        throw new Error('Choose a section for this event');
      }
    }

    const existing = values.id ? readAll().find((event) => event.id === values.id) : null;
    if (values.id && !existing) throw new Error('Event not found');
    if (existing && !canManageEvent(existing, auth)) {
      throw new Error('You do not have permission to edit this event');
    }

    const next = normalizeEvent({
      ...existing,
      ...values,
      audience,
      sectionName,
      id: existing?.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdBy: existing?.createdBy ?? { id: profile.id, name: profile.name ?? 'User' },
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });

    if (!next) throw new Error('A start date is required');

    const list = readAll();
    const index = list.findIndex((event) => event.id === next.id);
    if (index >= 0) list[index] = next;
    else list.push(next);

    writeJson(KEYS.localEvents, sortEvents(list));
    emitChange();
    return next;
  },

  remove(id, auth) {
    const event = readAll().find((item) => item.id === id);
    if (!event) return false;
    if (!canManageEvent(event, auth)) {
      throw new Error('You do not have permission to delete this event');
    }
    writeJson(
      KEYS.localEvents,
      readAll().filter((item) => item.id !== id)
    );
    emitChange();
    return true;
  },

  /** Subscribe to local changes and cross-tab storage updates. */
  subscribe(listener) {
    if (typeof window === 'undefined') return () => {};
    const onLocal = () => listener();
    const onStorage = (event) => {
      if (!event.key || event.key === `cuet:${KEYS.localEvents}`) listener();
    };
    window.addEventListener(CHANGE_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  },
};
