// Teacher Directory — port of teacher_directory_screen.dart.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
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
import { getTeachers } from '../../api/endpoints.js';
import { parseTeacher } from '../../lib/models.js';
import { useApi } from '../../hooks/useApi.js';

const DEPARTMENTS = ['all', 'CSE', 'EEE', 'CE', 'ME', 'ChE', 'ARCH'];

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
};

export default function DirectoryPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');

  const { data, loading, error, refresh } = useApi(getTeachers, {
    parse: (response) =>
      toList(extractPayload(response))
        .map(parseTeacher)
        .filter(Boolean),
    initial: [],
  });

  const teachers = data ?? [];

  const filtered = useMemo(() => {
    let list = teachers;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.email ?? '').toLowerCase().includes(q)
      );
    }
    if (department !== 'all') {
      list = list.filter(
        (t) => (t.department?.code ?? '').toUpperCase() === department.toUpperCase()
      );
    }
    return list;
  }, [teachers, query, department]);

  const mailTo = (teacher) => {
    window.location.href = `mailto:${teacher.email}`;
  };

  const callTo = (teacher) => {
    if (!teacher.phone) {
      toast.info('No phone number on file');
      return;
    }
    window.location.href = `tel:${teacher.phone}`;
  };

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Teacher Directory"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={refresh} />}
      />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search teachers..."
        className="mb-3 w-full rounded-xl border border-outline bg-surface px-4 py-3 text-body-md text-ink placeholder:text-ink-muted/70 focus:border-primary focus:outline-none"
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {DEPARTMENTS.map((dept) => {
          const selected = department === dept;
          return (
            <button
              key={dept}
              type="button"
              onClick={() => setDepartment(dept)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-label-md font-semibold transition-colors ${
                selected
                  ? 'border-primary bg-primary text-white'
                  : 'border-outline bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              {dept === 'all' ? 'All' : dept}
            </button>
          );
        })}
      </div>

      {loading && teachers.length === 0 ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="person_search" title="No teachers found" />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((teacher) => (
            <Card key={teacher.id} className="flex items-center gap-3">
              <Avatar name={teacher.name} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-title-md font-semibold text-ink">{teacher.name}</p>
                <p className="truncate text-body-sm text-ink-muted">
                  {teacher.designation ?? 'Teacher'}
                </p>
                {teacher.department && (
                  <p className="truncate text-label-sm text-ink-muted/80">
                    {teacher.department.name}
                    {teacher.department.code ? ` (${teacher.department.code})` : ''}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {teacher.email && (
                  <IconButton
                    icon="mail"
                    label="Send email"
                    onClick={() => mailTo(teacher)}
                    className="text-primary dark:text-primary-light"
                  />
                )}
                {teacher.phone && (
                  <IconButton
                    icon="call"
                    label="Call"
                    onClick={() => callTo(teacher)}
                    className="text-primary dark:text-primary-light"
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
