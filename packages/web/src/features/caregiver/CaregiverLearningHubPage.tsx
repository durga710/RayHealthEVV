import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: 'one_time' | 'annual' | 'biennial' | 'certification';
  required: boolean;
  durationMinutes: number;
  expiresAfterDays: number | null;
}

interface Enrollment {
  id: string;
  courseId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
}

interface ProgressData {
  caregiverId: string;
  enrollments: Array<{ enrollment: Enrollment; course: Course }>;
  isCompliant: boolean;
}

const CADENCE_LABEL: Record<string, string> = {
  one_time: 'Orientation',
  annual: 'Annual Training',
  biennial: 'Biennial Training',
  certification: 'Certifications',
};

const STATUS_MAP = {
  completed:   { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Completed' },
  in_progress: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', label: 'In Progress' },
  overdue:     { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Overdue' },
  expired:     { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Expired' },
  not_started: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0', label: 'Not Started' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.not_started;
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '100px', padding: '0.2rem 0.6rem' }}>
      {s.label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type FilterTab = 'all' | 'required' | 'optional';

export function CaregiverLearningHubPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [cadenceFilter, setCadenceFilter] = useState<string>('all');

  useEffect(() => {
    void Promise.all([
      getJson<{ success: boolean; data: Course[] }>('/api/learning/courses')
        .catch(() => ({ success: false, data: [] as Course[] })),
      getJson<{ success: boolean; data: ProgressData }>('/api/learning/progress')
        .catch(() => ({ success: false, data: null as unknown as ProgressData })),
    ]).then(([c, p]) => {
      setCourses(c.data ?? []);
      setProgress(p.data ?? null);
      setLoading(false);
    });
  }, []);

  const enrollmentByCourseId = useMemo(() => {
    const map = new Map<string, Enrollment>();
    progress?.enrollments.forEach(({ enrollment }) => map.set(enrollment.courseId, enrollment));
    return map;
  }, [progress]);

  const filtered = useMemo(() => {
    let list = courses;
    if (tab === 'required') list = list.filter((c) => c.required);
    if (tab === 'optional') list = list.filter((c) => !c.required);
    if (cadenceFilter !== 'all') list = list.filter((c) => c.cadence === cadenceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [courses, tab, cadenceFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Course[]>();
    filtered.forEach((c) => {
      const label = CADENCE_LABEL[c.cadence] ?? c.cadence;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(c);
    });
    return map;
  }, [filtered]);

  const overdueCourses = courses.filter((c) => enrollmentByCourseId.get(c.id)?.status === 'overdue').length;
  const completedCourses = courses.filter((c) => enrollmentByCourseId.get(c.id)?.status === 'completed').length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 1rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--color-primary, #107480)' : 'transparent',
    color: active ? '#fff' : '#64748B',
  });

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.25rem' }}>
            Learning Hub
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Your training catalog and compliance courses
          </p>
        </div>
        <Link
          to="/portal/training"
          style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary, #107480)', textDecoration: 'none' }}
        >
          My Training →
        </Link>
      </div>

      {!loading && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total courses', value: String(courses.length) },
            { label: 'Completed', value: String(completedCourses), color: '#16A34A' },
            { label: 'Overdue', value: String(overdueCourses), color: overdueCourses > 0 ? '#DC2626' : '#64748B' },
            {
              label: 'Compliant',
              value: progress?.isCompliant ? 'Yes' : 'No',
              color: progress?.isCompliant ? '#16A34A' : '#DC2626',
            },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color ?? '#0F172A', marginTop: '0.2rem' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '180px', padding: '0.45rem 0.75rem', fontSize: '0.875rem', border: '1px solid #CBD5E1', borderRadius: '8px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '0.25rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.25rem' }}>
          {(['all', 'required', 'optional'] as FilterTab[]).map((t) => (
            <button key={t} type="button" style={tabStyle(tab === t)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <select
          value={cadenceFilter}
          onChange={(e) => setCadenceFilter(e.target.value)}
          style={{ padding: '0.45rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #CBD5E1', borderRadius: '8px', outline: 'none', background: '#fff' }}
        >
          <option value="all">All types</option>
          {Object.entries(CADENCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading && <div style={{ color: '#64748B' }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', color: '#94A3B8' }}>
          No courses match your filter.
        </div>
      )}

      {[...grouped.entries()].map(([group, groupCourses]) => (
        <div key={group} style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            {group}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {groupCourses.map((course) => {
              const enrollment = enrollmentByCourseId.get(course.id);
              const status = enrollment?.status ?? 'not_started';
              const dueAt = enrollment?.dueAt ?? null;
              const completedAt = enrollment?.lastCompletedAt ?? null;
              const expiresAt = enrollment?.expiresAt ?? null;
              const btnLabel =
                status === 'completed' ? 'Review' :
                status === 'in_progress' ? 'Continue' : 'Start';

              return (
                <div
                  key={course.id}
                  style={{
                    background: '#fff',
                    border: `1px solid ${status === 'overdue' ? '#FECACA' : '#E2E8F0'}`,
                    borderRadius: '10px',
                    padding: '1rem 1.25rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '1rem',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>{course.title}</span>
                      {course.required && (
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: '4px', padding: '0.1rem 0.45rem' }}>
                          Required
                        </span>
                      )}
                      <StatusBadge status={status} />
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0 0 0.5rem' }}>
                      {course.description}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94A3B8', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {course.durationMinutes} min
                      </span>
                      {dueAt && <span>Due: {formatDate(dueAt)}</span>}
                      {completedAt && <span>Completed: {formatDate(completedAt)}</span>}
                      {expiresAt && <span>Expires: {formatDate(expiresAt)}</span>}
                      {course.expiresAfterDays && !expiresAt && (
                        <span>Valid {course.expiresAfterDays}d after completion</span>
                      )}
                    </div>
                  </div>
                  <Link
                    to="/portal/training"
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: status === 'completed' ? '#64748B' : 'var(--color-primary, #107480)',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      display: 'inline-block',
                    }}
                  >
                    {btnLabel}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
