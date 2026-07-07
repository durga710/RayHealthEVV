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

const statusStyle: Record<string, { className: string; label: string }> = {
  completed: { className: 'badge badge-success', label: 'Completed' },
  in_progress: { className: 'badge badge-info', label: 'In progress' },
  overdue: { className: 'badge badge-danger', label: 'Overdue' },
  expired: { className: 'badge badge-danger', label: 'Expired' },
  not_started: { className: 'badge badge-neutral', label: 'Not started' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '-';
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
    return (
      <div>
        <header className="page-header">
          <div className="page-header__title">
            <h1 style={{ margin: 0 }}>My Training</h1>
          </div>
        </header>
        <div style={{ padding: '2rem', color: '#94A3B8' }}>Loading your training…</div>
      </div>
    );
  }

  if (!progress || progress.enrollments.length === 0) {
    return (
      <div>
        <header className="page-header">
          <div className="page-header__title">
            <h1 style={{ margin: 0 }}>My Training</h1>
            <p style={{ margin: 0, color: '#64748B' }}>PA §52.18 caregiver training portal.</p>
          </div>
        </header>
        <div
          style={{
            padding: '2.5rem',
            backgroundColor: 'white',
            border: '1px dashed #CBD5E1',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#94A3B8',
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
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>My Training</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            PA §52.18 caregiver training portal
          </p>
        </div>
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: progress.isCompliant ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: `1px solid ${progress.isCompliant ? '#A7F3D0' : '#FECDD3'}`,
            borderRadius: '10px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: progress.isCompliant ? '#047857' : '#BE123C',
              letterSpacing: '-0.01em',
            }}
          >
            {progress.isCompliant ? 'Compliant' : 'Action needed'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
            {completedCount}/{required.length} required done
          </div>
        </div>
      </header>

      {msg && (
        <div
          className={`info-banner ${msg.includes('!') ? 'banner-success' : 'banner-error'}`}
          style={{ marginBottom: '1rem' }}
          role={msg.includes('!') ? 'status' : 'alert'}
        >
          {msg}
        </div>
      )}

      {required.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Required training</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {required.map(({ enrollment, course }) => {
              const s = statusStyle[enrollment.status] ?? statusStyle.not_started;
              const isExpanding = completingId === enrollment.id;
              return (
                <div
                  key={enrollment.id}
                  style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}
                >
                  <div
                    style={{
                      padding: '1.1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#0F172A', fontSize: '0.9375rem', fontWeight: 600 }}>
                        {course.title}
                      </strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                        {course.description}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', marginTop: '0.4rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                        <span>{course.durationMinutes} min</span>
                        {enrollment.dueAt && <span>Due {formatDate(enrollment.dueAt)}</span>}
                        {enrollment.lastCompletedAt && <span>Completed {formatDate(enrollment.lastCompletedAt)}</span>}
                        {enrollment.expiresAt && <span>Expires {formatDate(enrollment.expiresAt)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.55rem' }}>
                      <span className={s.className}>{s.label}</span>
                      {enrollment.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => setCompletingId(isExpanding ? null : enrollment.id)}
                          className={isExpanding ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
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
                        borderTop: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                        Record that you have completed <strong>{course.title}</strong>.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label className="label">Score (0-100, optional)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            placeholder="e.g. 85"
                            className="input-field"
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label className="label">Notes (optional)</label>
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. in-person classroom"
                            className="input-field"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn-primary btn-sm"
                        style={{ alignSelf: 'flex-start', backgroundColor: '#10B981', borderColor: '#10B981' }}
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
          <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Elective training</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {elective.map(({ enrollment, course }) => {
              const s = statusStyle[enrollment.status] ?? statusStyle.not_started;
              const isExpanding = completingId === enrollment.id;
              return (
                <div
                  key={enrollment.id}
                  style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}
                >
                  <div
                    style={{
                      padding: '0.95rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: 600 }}>
                        {course.title}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.2rem' }}>
                        {course.durationMinutes} min
                        {enrollment.lastCompletedAt && ` · completed ${formatDate(enrollment.lastCompletedAt)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={s.className}>{s.label}</span>
                      {enrollment.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => setCompletingId(isExpanding ? null : enrollment.id)}
                          className={isExpanding ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
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
                        padding: '0.95rem 1.25rem',
                        borderTop: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label className="label">Notes (optional)</label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="delivery method…"
                          className="input-field"
                          style={{ width: '220px' }}
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn-primary btn-sm"
                        style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
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
