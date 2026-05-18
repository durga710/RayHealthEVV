import React, { useEffect, useState } from 'react';
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
}

interface Enrollment {
  id: string;
  courseId: string;
  status: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
}

interface ProgressItem {
  enrollment: Enrollment;
  course: Course;
}

interface Progress {
  caregiverId: string;
  enrollments: ProgressItem[];
  isCompliant: boolean;
}

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: '#f0fdf4', text: '#166534', label: 'Completed' },
  in_progress: { bg: '#eff6ff', text: '#1d4ed8', label: 'In progress' },
  overdue: { bg: '#fef2f2', text: '#b91c1c', label: 'Overdue' },
  expired: { bg: '#fef2f2', text: '#b91c1c', label: 'Expired' },
  not_started: { bg: '#f8fafc', text: '#64748b', label: 'Not started' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function LearningPortalPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProgress = () => {
    getJson<{ success: boolean; data: Progress }>('/api/learning/progress')
      .then((res) => { if (res.success) setProgress(res.data); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProgress(); }, []);

  const handleComplete = async (e: React.FormEvent, enrollmentId: string, courseId: string) => {
    e.preventDefault();
    setMsg('');
    try {
      await postJson('/api/learning/complete', {
        enrollmentId,
        courseId,
        score: score ? Number(score) : null,
        notes: notes || null,
      });
      setMsg('Completion recorded!');
      setCompletingId(null);
      setNotes('');
      setScore('');
      fetchProgress();
    } catch {
      setMsg('Failed to record completion.');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading your training…</div>;
  }

  if (!progress || progress.enrollments.length === 0) {
    return (
      <div>
        <h2>My Training</h2>
        <div
          style={{
            marginTop: '2rem',
            padding: '2rem',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          No training courses assigned yet. Your coordinator will assign courses based on your role.
        </div>
      </div>
    );
  }

  const required = progress.enrollments.filter((e) => e.course.required);
  const elective = progress.enrollments.filter((e) => !e.course.required);
  const completedCount = required.filter((e) => e.enrollment.status === 'completed').length;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>My Training</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            PA §52.18 caregiver training portal
          </p>
        </div>
        <div
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: progress.isCompliant ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${progress.isCompliant ? '#86efac' : '#fca5a5'}`,
            borderRadius: '10px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.5rem',
              fontWeight: 900,
              color: progress.isCompliant ? '#166534' : '#b91c1c',
            }}
          >
            {progress.isCompliant ? 'Compliant' : 'Action needed'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
            {completedCount}/{required.length} required done
          </div>
        </div>
      </div>

      {msg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            backgroundColor: msg.includes('!') ? '#f0fdf4' : '#fef2f2',
            color: msg.includes('!') ? '#166534' : '#b91c1c',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}
        >
          {msg}
        </div>
      )}

      {required.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-primary-dark)' }}>
            Required training
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {required.map(({ enrollment, course }) => {
              const s = statusStyle[enrollment.status] ?? statusStyle.not_started;
              const isExpanding = completingId === enrollment.id;
              return (
                <div
                  key={enrollment.id}
                  style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'white' }}
                >
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: 'var(--color-primary-dark)', fontSize: '0.95rem' }}>
                        {course.title}
                      </strong>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                        {course.description}
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <span>{course.durationMinutes} min</span>
                        {enrollment.dueAt && <span>Due {formatDate(enrollment.dueAt)}</span>}
                        {enrollment.lastCompletedAt && <span>Completed {formatDate(enrollment.lastCompletedAt)}</span>}
                        {enrollment.expiresAt && <span>Expires {formatDate(enrollment.expiresAt)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          backgroundColor: s.bg,
                          color: s.text,
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.label}
                      </span>
                      {enrollment.status !== 'completed' && (
                        <button
                          onClick={() => setCompletingId(isExpanding ? null : enrollment.id)}
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.9rem',
                            backgroundColor: 'var(--color-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {isExpanding ? 'Cancel' : 'Mark complete'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanding && (
                    <form
                      onSubmit={(e) => handleComplete(e, enrollment.id, course.id)}
                      style={{
                        padding: '1rem 1.25rem',
                        borderTop: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                        Record that you have completed <strong>{course.title}</strong>.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Score (0–100, optional)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            placeholder="e.g. 85"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Notes (optional)</label>
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. in-person classroom"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        style={{
                          alignSelf: 'flex-start',
                          padding: '0.5rem 1.25rem',
                          backgroundColor: '#166534',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontFamily: 'inherit',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Confirm completion
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {elective.length > 0 && (
        <section>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-primary-dark)' }}>
            Elective training
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {elective.map(({ enrollment, course }) => {
              const s = statusStyle[enrollment.status] ?? statusStyle.not_started;
              const isExpanding = completingId === enrollment.id;
              return (
                <div
                  key={enrollment.id}
                  style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'white' }}
                >
                  <div
                    style={{
                      padding: '0.875rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: 'var(--color-primary-dark)', fontSize: '0.9rem' }}>
                        {course.title}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        {course.durationMinutes} min
                        {enrollment.lastCompletedAt && ` · completed ${formatDate(enrollment.lastCompletedAt)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: s.bg,
                          color: s.text,
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {s.label}
                      </span>
                      {enrollment.status !== 'completed' && (
                        <button
                          onClick={() => setCompletingId(isExpanding ? null : enrollment.id)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.35rem 0.8rem',
                            backgroundColor: 'var(--color-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {isExpanding ? 'Cancel' : 'Mark complete'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanding && (
                    <form
                      onSubmit={(e) => handleComplete(e, enrollment.id, course.id)}
                      style={{
                        padding: '0.875rem 1.25rem',
                        borderTop: '1px solid #f1f5f9',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Notes (optional)</label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="delivery method…"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', width: '200px' }}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          padding: '0.4rem 1rem',
                          backgroundColor: '#166534',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontFamily: 'inherit',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Confirm
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
