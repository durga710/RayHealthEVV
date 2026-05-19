import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { postJson, getJson } from '../../lib/api-client.js';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: string;
  required: boolean;
  durationMinutes: number;
  expiresAfterDays: number | null;
  externalUrl: string | null;
}

interface Enrollment {
  id: string;
  courseId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
}

interface ProgressItem {
  enrollment: Enrollment;
  course: Course;
}

interface ProgressData {
  caregiverId: string;
  enrollments: ProgressItem[];
  isCompliant: boolean;
}

type TrainingTab = 'all' | 'required' | 'in_progress' | 'completed' | 'overdue';

const STATUS_CONFIG = {
  completed:   { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Completed' },
  in_progress: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', label: 'In Progress' },
  overdue:     { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Overdue' },
  expired:     { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Expired' },
  not_started: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0', label: 'Not Started' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.not_started;
  return (
    <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '100px', padding: '0.2rem 0.6rem' }}>
      {s.label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '100px', overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: pct === 100 ? '#16A34A' : 'var(--color-primary, #6366F1)',
        borderRadius: '100px',
        transition: 'width 0.3s',
      }} />
    </div>
  );
}

export function CaregiverTrainingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TrainingTab>('all');
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getJson<{ success: boolean; data: ProgressData }>('/api/learning/progress')
      .then((r) => setData(r.data))
      .catch(() => setError('Failed to load training data'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const all = data.enrollments;
    switch (tab) {
      case 'required':    return all.filter((i) => i.course.required);
      case 'in_progress': return all.filter((i) => i.enrollment.status === 'in_progress');
      case 'completed':   return all.filter((i) => i.enrollment.status === 'completed');
      case 'overdue':     return all.filter((i) => i.enrollment.status === 'overdue' || i.enrollment.status === 'expired');
      default:            return all;
    }
  }, [data, tab]);

  const counts = useMemo(() => {
    if (!data) return { all: 0, required: 0, in_progress: 0, completed: 0, overdue: 0 };
    const all = data.enrollments;
    return {
      all: all.length,
      required: all.filter((i) => i.course.required).length,
      in_progress: all.filter((i) => i.enrollment.status === 'in_progress').length,
      completed: all.filter((i) => i.enrollment.status === 'completed').length,
      overdue: all.filter((i) => ['overdue', 'expired'].includes(i.enrollment.status)).length,
    };
  }, [data]);

  const handleMarkComplete = async (item: ProgressItem) => {
    setCompleting(item.enrollment.id);
    setError(null);
    try {
      await postJson('/api/learning/complete', {
        enrollmentId: item.enrollment.id,
        courseId: item.course.id,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      setCompleting(null);
    }
  };

  const openCourse = (courseId: string) => {
    navigate(`/portal/training/${courseId}`);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.9rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--color-primary, #6366F1)' : 'transparent',
    color: active ? '#fff' : '#64748B',
  });

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.25rem' }}>
        My Training
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1.5rem' }}>
        Your assigned courses, progress, and certificates
      </p>

      {data && (
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          background: data.isCompliant ? '#F0FDF4' : '#FFFBEB',
          border: `1px solid ${data.isCompliant ? '#BBF7D0' : '#FDE68A'}`,
          borderRadius: '10px',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '1.25rem' }}>{data.isCompliant ? '✅' : '⚠️'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: data.isCompliant ? '#15803D' : '#92400E' }}>
              {data.isCompliant ? 'Training compliant' : 'Training incomplete'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: data.isCompliant ? '#16A34A' : '#B45309' }}>
              {data.isCompliant
                ? 'All required training is up to date.'
                : `${counts.overdue} course(s) overdue or expired. Complete them to maintain compliance.`}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#DC2626' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.25rem', flexWrap: 'wrap' }}>
        {([
          ['all', 'All'],
          ['required', 'Required'],
          ['in_progress', 'In Progress'],
          ['completed', 'Completed'],
          ['overdue', 'Overdue'],
        ] as [TrainingTab, string][]).map(([t, label]) => (
          <button key={t} type="button" style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {label} ({counts[t]})
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#64748B' }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', color: '#94A3B8' }}>
          {tab === 'all'
            ? 'No training assigned yet. Your coordinator will enroll you in required courses.'
            : 'No courses in this category.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.map(({ enrollment, course }) => {
          const pct = enrollment.status === 'completed' ? 100 : enrollment.status === 'in_progress' ? 50 : 0;
          const isCompleted = enrollment.status === 'completed';
          const isActionable = !isCompleted && enrollment.status !== 'expired';

          return (
            <div
              key={enrollment.id}
              style={{
                background: '#fff',
                border: `1px solid ${enrollment.status === 'overdue' ? '#FECACA' : '#E2E8F0'}`,
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.6rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>{course.title}</span>
                    {course.required && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: '4px', padding: '0.1rem 0.45rem' }}>
                        Required
                      </span>
                    )}
                    <StatusBadge status={enrollment.status} />
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>{course.description}</p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                  {isCompleted && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '0.3rem 0.7rem' }}>
                      🏅 Certificate
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => openCourse(course.id)}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: isCompleted ? '#64748B' : '#fff',
                      background: isCompleted ? '#F8FAFC' : 'var(--color-primary, #6366F1)',
                      border: isCompleted ? '1px solid #E2E8F0' : 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {isCompleted ? 'Review' : enrollment.status === 'in_progress' ? 'Continue →' : 'Open Course →'}
                  </button>
                </div>
              </div>

              <ProgressBar pct={pct} />

              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <span>⏱ {course.durationMinutes} min</span>
                <span>{pct}% complete</span>
                {enrollment.dueAt && <span>Due: {formatDate(enrollment.dueAt)}</span>}
                {enrollment.lastCompletedAt && <span>Completed: {formatDate(enrollment.lastCompletedAt)}</span>}
                {enrollment.expiresAt && <span>Expires: {formatDate(enrollment.expiresAt)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
