// Shared event form used by the /events dialog (edit + personal events) and
// the Event tab on the CR compose page (/cr/compose). Saving goes through the
// local-first eventStore, so events appear in the Academic Calendar instantly.
import { useEffect, useMemo, useState } from 'react';
import { Button, Icon, Select, TextField } from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  EVENT_TYPES,
  eventStore,
  normalizeSectionName,
} from '../../lib/eventStore.js';
import { batchNumberLabel } from '../../lib/models.js';
import { isoDate } from '../../lib/datetime.js';
import { useBatchSections } from '../cr/CrDialogs.jsx';

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

function defaultAudience(auth) {
  if (auth.isCoordinator) return 'campus';
  if (auth.isCR) return 'batch';
  return 'personal';
}

export default function EventForm({
  event,
  auth,
  submitLabel = 'Save event',
  cancelLabel = 'Cancel',
  onCancel,
  onSaved,
}) {
  const toast = useToast();
  const manager = auth.isCoordinator;
  const isCR = Boolean(auth.isCR) && !manager;
  // Real sections of the CR's batch (own section first, offline fallback).
  const batchSections = useBatchSections(auth.profile);

  const [title, setTitle] = useState(event?.title ?? '');
  const [type, setType] = useState(event?.type ?? 'academic');
  const [startDate, setStartDate] = useState(event?.startDate ?? addDaysKey(1));
  const [endDate, setEndDate] = useState(event?.endDate ?? event?.startDate ?? addDaysKey(1));
  const [startTime, setStartTime] = useState(event?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(event?.endTime ?? '11:00');
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [audience, setAudience] = useState(event?.audience ?? defaultAudience(auth));
  const [sectionName, setSectionName] = useState(
    event?.sectionName ?? normalizeSectionName(auth.profile?.section) ?? ''
  );
  const [errors, setErrors] = useState({});

  // Re-seed every field when a different event is loaded (edit mode).
  useEffect(() => {
    setTitle(event?.title ?? '');
    setType(event?.type ?? 'academic');
    setStartDate(event?.startDate ?? addDaysKey(1));
    setEndDate(event?.endDate ?? event?.startDate ?? addDaysKey(1));
    setStartTime(event?.startTime ?? '10:00');
    setEndTime(event?.endTime ?? '11:00');
    setLocation(event?.location ?? '');
    setDescription(event?.description ?? '');
    setAudience(event?.audience ?? defaultAudience(auth));
    setSectionName(event?.sectionName ?? normalizeSectionName(auth.profile?.section) ?? '');
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const sectionList = useMemo(() => {
    const fromBatch = (batchSections ?? [])
      .filter((s) => s.name)
      .map((s) => ({ name: s.name, label: s.label || `Section ${s.name}` }));
    if (fromBatch.length > 0) return fromBatch;
    const names = new Set(['A', 'B']);
    const fallback = normalizeSectionName(auth.profile?.section);
    if (fallback) names.add(fallback);
    if (event?.sectionName) names.add(event.sectionName);
    return [...names].sort().map((name) => ({ name, label: `Section ${name}` }));
  }, [batchSections, auth.profile?.section, event?.sectionName]);

  const audienceOptions = useMemo(() => {
    const opts = [];
    if (manager) opts.push({ value: 'campus', label: 'Campus-wide' });
    opts.push({ value: 'batch', label: manager ? 'All sections' : 'All sections (my batch)' });
    for (const section of sectionList) {
      opts.push({ value: `section:${section.name}`, label: section.label });
    }
    opts.push({ value: 'personal', label: 'Personal (only me)' });
    return opts;
  }, [manager, sectionList]);

  // The audience select encodes section choices inline: "section:A" etc.
  const audienceValue = audience === 'section' ? `section:${sectionName}` : audience;
  const handleAudienceChange = (changeEvent) => {
    const value = changeEvent.target.value;
    if (value.startsWith('section:')) {
      setAudience('section');
      setSectionName(value.slice('section:'.length));
      setErrors((current) => ({ ...current, sectionName: undefined }));
    } else {
      setAudience(value);
    }
  };

  const audienceHint = useMemo(() => {
    const batchLabel = batchNumberLabel(auth.profile?.batch);
    if (audience === 'batch') {
      return `Every section of ${batchLabel ? `Batch ${batchLabel}` : 'your batch'} will see this event.`;
    }
    if (audience === 'section') {
      const own = normalizeSectionName(auth.profile?.section);
      if (!sectionName) return 'Choose which section will see this event.';
      if ((isCR || !manager) && own && sectionName === own) {
        return `Visible to everyone in Section ${sectionName} — your section.`;
      }
      return `Only Section ${sectionName} will see this event.`;
    }
    if (audience === 'personal') return 'Only you will see this event.';
    return 'Everyone using the campus calendar will see this event.';
  }, [audience, isCR, manager, sectionName, auth.profile?.batch, auth.profile?.section]);

  const submit = (submitEvent) => {
    submitEvent.preventDefault();
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = 'Give the event a title';
    if (!startDate) nextErrors.startDate = 'Choose a start date';
    if (endDate && startDate && endDate < startDate) {
      nextErrors.endDate = 'End date cannot be before the start date';
    }
    if (startTime && endTime && endTime <= startTime) {
      nextErrors.endTime = 'End time must be after the start time';
    }
    if (audience === 'section' && !sectionName) {
      nextErrors.sectionName = 'Choose a section';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const saved = eventStore.save(
        {
          id: event?.id,
          title,
          type,
          startDate,
          endDate: endDate || startDate,
          startTime,
          endTime,
          location,
          description,
          audience,
          sectionName,
        },
        auth
      );
      toast.success(event ? 'Event updated' : 'Event added to your calendar');
      onSaved?.(saved);
    } catch (error) {
      toast.error(error?.message || 'Could not save the event');
    }
  };

  return (
    <form className="space-y-3 p-5" onSubmit={submit}>
      <TextField
        label="Event title"
        hint="e.g. CSE Project Showcase"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        required
        autoFocus
      />

      <Select
        label="Event type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={TYPE_OPTIONS}
      />

      <div>
        <Select
          label="Audience"
          value={audienceValue}
          onChange={handleAudienceChange}
          options={audienceOptions}
          error={audience === 'section' ? errors.sectionName : undefined}
        />
        <p className="mt-1.5 flex items-start gap-1.5 text-label-sm text-ink-muted">
          <Icon name="group" size={15} className="mt-0.5 shrink-0" />
          {audienceHint}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Start date"
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
          }}
          error={errors.startDate}
          required
        />
        <TextField
          label="End date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          error={errors.endDate}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Start time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <TextField
          label="End time"
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          error={errors.endTime}
        />
      </div>

      <TextField
        label="Location"
        hint="e.g. Seminar Room, Academic Building"
        icon="place"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <TextField
        label="Description"
        hint="Optional details, registration notes, agenda…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        multiline
        rows={3}
      />

      <div className="flex justify-end gap-2 border-t border-outline/60 pt-4">
        {onCancel && (
          <Button variant="text" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" icon="save">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
