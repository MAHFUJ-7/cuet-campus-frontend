// Study Materials — port of study_materials_screen.dart.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  SkeletonBlock,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { getStudyMaterials } from '../../api/endpoints.js';
import { parseStudyMaterial } from '../../lib/models.js';
import { useApi } from '../../hooks/useApi.js';

const TYPE_FILTERS = ['all', 'notes', 'slides', 'book', 'video', 'other'];

const TYPE_META = {
  notes: { icon: 'note', tone: 'bg-info/15 text-info' },
  slides: { icon: 'slideshow', tone: 'bg-warning/15 text-warning' },
  book: { icon: 'book', tone: 'bg-success/15 text-success' },
  video: { icon: 'play_circle', tone: 'bg-critical/15 text-critical' },
  other: { icon: 'description', tone: 'bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light' },
};

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

function formatDmy(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function StudyMaterialsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [type, setType] = useState('all');

  const { data, loading, error, refresh } = useApi(getStudyMaterials, {
    parse: (response) => toList(extractPayload(response)).map(parseStudyMaterial),
    initial: [],
  });

  const materials = data ?? [];

  const filtered = useMemo(
    () => (type === 'all' ? materials : materials.filter((m) => m.type === type)),
    [materials, type]
  );

  const openMaterial = (material) => {
    if (!material.url) {
      toast.info('This material has no link attached.');
      return;
    }
    window.open(material.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Study Materials"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={refresh} />}
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((option) => {
          const selected = type === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-md font-semibold transition-colors ${
                selected
                  ? 'border-primary bg-primary text-white'
                  : 'border-outline bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              {option === 'all' ? 'All' : option.toUpperCase()}
            </button>
          );
        })}
      </div>

      {loading && materials.length === 0 ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-[84px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title="No materials found"
          message="Upload study materials to share with your class"
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((material) => {
            const meta = TYPE_META[material.type] ?? TYPE_META.other;
            return (
              <Card key={material.id} className="flex items-center gap-3">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                  <Icon name={meta.icon} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-title-md font-semibold text-ink">{material.title}</p>
                  <p className="truncate text-body-sm text-ink-muted">{material.courseCode || 'General'}</p>
                  <p className="truncate text-label-sm text-ink-muted/80">
                    Uploaded by {material.uploadedBy} • {formatDmy(material.createdAt)}
                  </p>
                </div>
                <IconButton
                  icon="download"
                  label="Open material"
                  onClick={() => openMaterial(material)}
                  className="text-primary dark:text-primary-light"
                />
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
