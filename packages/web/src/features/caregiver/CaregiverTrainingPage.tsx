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
  completed:   { bg: 'var(--color-success-bg)', color: 'var(--color-success)', border: 'var(--color-success-border)', label: 'Completed' },
  in_progress: { bg: 'var(--color-info-bg)', color: 'var(--color-primary)', border: 'var(--color-info-border)', label: 'In Progress' },
  overdue:     { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: 'var(--color-danger-border)', label: 'Overdue' },
  expired:     { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: 'var(--color-danger-border)', label: 'Expired' },
  not_started: { bg: 'var(--color-bg)', color: 'var(--color-text-muted)', border: 'var(--color-border)', label: 'Not Started' },
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
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: '100px', overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: pct === 100 ? 'var(--color-success)' : 'var(--color-primary)',
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
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? 'var(--color-surface)' : 'var(--color-text-muted)',
  });

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>
        My Training
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        Your assigned courses, progress, and certificates
      </p>

      {data && (
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          background: data.isCompliant ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
          border: `1px solid ${data.isCompliant ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
          borderRadius: '10px',
          alignItems: 'center',
        }}>
          <span style={{ display: 'inline-flex', flexShrink: 0, color: data.isCompliant ? 'var(--color-success-text)' : 'var(--color-warning-text)' }}>
            {data.isCompliant ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            )}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: data.isCompliant ? 'var(--color-success-text)' : 'var(--color-warning-text)' }}>
              {data.isCompliant ? 'Training compliant' : 'Training incomplete'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: data.isCompliant ? 'var(--color-success)' : 'var(--color-warning-text)' }}>
              {data.isCompliant
                ? 'All required training is up to date.'
                : `${counts.overdue} course(s) overdue or expired. Complete them to maintain compliance.`}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-danger-text)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.25rem', flexWrap: 'wrap' }}>
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

      {loading && <div style={{ color: 'var(--color-text-muted)' }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-subtle)' }}>
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
                background: 'var(--color-surface)',
                border: `1px solid ${enrollment.status === 'overdue' ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.6rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>{course.title}</span>
                    {course.required && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', borderRadius: '4px', padding: '0.1rem 0.45rem' }}>
                        Required
                      </span>
                    )}
                    <StatusBadge status={enrollment.status} />
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>{course.description}</p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => navigate(`/portal/training/${course.id}/certificate`)}
                      title="View certificate of completion"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: '6px', padding: '0.3rem 0.7rem', cursor: 'pointer' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                      Certificate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openCourse(course.id)}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: isCompleted ? 'var(--color-text-muted)' : 'var(--color-surface)',
                      background: isCompleted ? 'var(--color-bg)' : 'var(--color-primary)',
                      border: isCompleted ? '1px solid var(--color-border)' : 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {isCompleted ? 'Review' : enrollment.status === 'in_progress' ? 'Continue →' : 'Open Course →'}
                  </button>
                </div>
              </div>

              <ProgressBar pct={pct} />

              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {course.durationMinutes} min
                </span>
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
