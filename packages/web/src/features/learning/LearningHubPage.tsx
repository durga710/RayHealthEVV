import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getJson, postJson, deleteJson } from '../../lib/api-client.js';

interface CourseModules {
  objectives?: string[];
  sections?: Array<{ title: string; content: string }>;
  quiz?: Array<unknown> | null;
}

interface Course {
  id: string;
  agencyId: string | null;
  code: string;
  title: string;
  description: string;
  cadence: string;
  required: boolean;
  durationMinutes: number;
  expiresAfterDays: number | null;
  modules: CourseModules | null;
}

interface Rollup {
  totalCaregivers: number;
  totalEnrollments: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  expired: number;
  complianceRate: number;
}

interface InsightCaregiver {
  caregiverId: string;
  firstName: string;
  lastName: string;
  context: string;
}

interface Insight {
  kind: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  summary: string;
  caregivers: InsightCaregiver[];
  totalCount: number;
}

interface StaffMember { id: string; email: string; role: string; }

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  warning: { bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' },
  info: { bg: 'rgba(16, 116, 128, 0.08)', text: '#0c5d66', border: 'rgba(16, 116, 128, 0.25)' },
};

const cadenceLabel: Record<string, string> = {
  one_time: 'One-time',
  annual: 'Annual',
  biennial: 'Biennial',
  certification: 'Certification',
};

export function LearningHubPage() {
  const navigate = useNavigate();
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [caregivers, setCaregivers] = useState<StaffMember[]>([]);
  const [enrollCaregiverId, setEnrollCaregiverId] = useState('');
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrollDueAt, setEnrollDueAt] = useState('');
  const [enrollMsg, setEnrollMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getJson<{ success: boolean; data: Rollup }>('/api/learning/rollup'),
      getJson<{ success: boolean; data: { insights: Insight[] } }>('/api/learning/insights'),
      getJson<{ success: boolean; data: Course[] }>('/api/learning/courses'),
      getJson<StaffMember[]>('/api/staff'),
    ])
      .then(([rollupRes, insightsRes, coursesRes, staffData]) => {
        if (rollupRes.success) setRollup(rollupRes.data);
        if (insightsRes.success) setInsights(insightsRes.data.insights ?? []);
        if (coursesRes.success) setCourses(coursesRes.data ?? []);
        const cgList = (staffData || []).filter(s => s.role === 'caregiver' || s.role === 'coordinator');
        setCaregivers(cgList);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollMsg(null);
    try {
      await postJson('/api/learning/enroll', {
        caregiverId: enrollCaregiverId,
        courseId: enrollCourseId,
        dueAt: enrollDueAt || null,
      });
      setEnrollMsg({ kind: 'success', text: 'Enrolled successfully.' });
      setEnrollCaregiverId('');
      setEnrollCourseId('');
      setEnrollDueAt('');
    } catch {
      setEnrollMsg({ kind: 'error', text: 'Failed to enroll caregiver.' });
    }
  };

  if (loading) {
    return (
      <div>
        <header className="page-header">
          <div className="page-header__title">
            <h1 style={{ margin: 0 }}>Learning Hub</h1>
          </div>
        </header>
        <div style={{ padding: '2rem', color: '#94A3B8' }}>Loading learning data…</div>
      </div>
    );
  }

  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm(`Delete "${course.title}"? Enrollments and completion records for this course will also be removed. This cannot be undone.`)) {
      return;
    }
    setDeletingId(course.id);
    try {
      await deleteJson(`/api/learning/courses/${course.id}`);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch {
      window.alert('Failed to delete course.');
    } finally {
      setDeletingId(null);
    }
  };

  const compliancePct = rollup ? Math.round(rollup.complianceRate * 100) : 0;

  return (
    <div>
      <header className="page-header">
        <div className="page-header__title">
          <h1 style={{ margin: 0 }}>Learning Hub</h1>
          <p style={{ margin: 0, color: '#64748B' }}>
            PA §52.18 training compliance &mdash; caregiver enrollments, completions, and expirations.
          </p>
        </div>
      </header>

      {/* Rollup strip */}
      {rollup && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '2rem',
          }}
        >
          {(
            [
              { label: 'Compliance', value: `${compliancePct}%`, ok: compliancePct >= 80 },
              { label: 'Caregivers', value: rollup.totalCaregivers },
              { label: 'Completed', value: rollup.completed },
              { label: 'Overdue', value: rollup.overdue, warn: rollup.overdue > 0 },
              { label: 'Expired', value: rollup.expired, warn: rollup.expired > 0 },
              { label: 'Not started', value: rollup.notStarted },
            ] as Array<{ label: string; value: string | number; ok?: boolean; warn?: boolean }>
          ).map(({ label, value, ok, warn }) => (
            <div key={label} className="stat-card" style={{ padding: '1.25rem 1.1rem' }}>
              <div
                style={{
                  fontSize: '1.875rem',
                  fontWeight: 700,
                  color: warn ? '#F43F5E' : ok ? '#10B981' : '#0F172A',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748B',
                  marginTop: '0.45rem',
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 className="section-title" style={{ marginBottom: '0.85rem' }}>Action items</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {insights.map((insight) => {
              const colors = severityColors[insight.severity] ?? severityColors.info;
              return (
                <div
                  key={insight.kind}
                  style={{
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px',
                    padding: '1rem 1.25rem',
                  }}
                >
                  <strong style={{ color: colors.text, fontSize: '0.9375rem' }}>{insight.title}</strong>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
                    {insight.summary}
                  </p>
                  {insight.caregivers.length > 0 && (
                    <ul
                      style={{
                        margin: '0.5rem 0 0',
                        padding: '0 0 0 1rem',
                        fontSize: '0.8rem',
                        color: '#64748B',
                      }}
                    >
                      {insight.caregivers.slice(0, 4).map((cg) => (
                        <li key={cg.caregiverId}>
                          {cg.firstName} {cg.lastName} &mdash; {cg.context}
                        </li>
                      ))}
                      {insight.totalCount > 4 && (
                        <li style={{ fontStyle: 'italic' }}>+{insight.totalCount - 4} more</li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Course catalog */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Course catalog</h3>
            <Link
              to="/admin/learning/courses/new"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.9rem', background: '#107480', color: '#fff', borderRadius: '8px', fontWeight: 600, fontSize: '0.8125rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              + New course
            </Link>
          </div>
          {courses.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                backgroundColor: 'white',
                border: '1px dashed #CBD5E1',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#94A3B8',
              }}
            >
              No courses configured for this agency yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {courses.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '1rem 1.1rem',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    backgroundColor: 'white',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9375rem', color: '#0F172A', fontWeight: 600 }}>
                        {c.title}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                        {c.code}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                      {c.required && (
                        <span className="badge badge-danger">Required</span>
                      )}
                      <span className="badge badge-info">
                        {cadenceLabel[c.cadence] ?? c.cadence}
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      margin: '0.5rem 0 0',
                      fontSize: '0.8125rem',
                      color: '#64748B',
                      lineHeight: 1.5,
                    }}
                  >
                    {c.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>{c.durationMinutes} min</span>
                      {c.expiresAfterDays ? <span>· expires after {c.expiresAfterDays} days</span> : null}
                      {c.modules?.sections?.length ? <span style={{ color: '#0c5d66' }}>· {c.modules.sections.length} section{c.modules.sections.length === 1 ? '' : 's'}</span> : null}
                      {c.modules?.quiz?.length ? <span style={{ color: '#0c5d66' }}>· {c.modules.quiz.length}-question quiz</span> : null}
                      {!c.modules?.sections?.length && !c.modules?.quiz?.length ? <span style={{ color: '#B45309' }}>· no content yet</span> : null}
                    </div>
                    {c.agencyId === null ? (
                      <span className="badge badge-info" title="Shared across all agencies, read only">Global</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/learning/courses/${c.id}/edit`)}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#334155', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === c.id}
                          onClick={() => void handleDeleteCourse(c)}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: deletingId === c.id ? 'wait' : 'pointer' }}
                        >
                          {deletingId === c.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enroll a caregiver */}
        <div className="form-card">
          <h3 className="section-title" style={{ marginBottom: '1rem', margin: '0 0 1rem' }}>Enroll a caregiver</h3>
          <form onSubmit={handleEnroll} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="enroll-caregiver" className="label">Caregiver</label>
              <select
                id="enroll-caregiver"
                value={enrollCaregiverId}
                onChange={(e) => setEnrollCaregiverId(e.target.value)}
                required
                className="select-field"
              >
                <option value="">Select a caregiver…</option>
                {caregivers.map(s => (
                  <option key={s.id} value={s.id}>{s.email} ({s.role})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="enroll-course" className="label">Course</label>
              <select
                id="enroll-course"
                value={enrollCourseId}
                onChange={(e) => setEnrollCourseId(e.target.value)}
                required
                className="select-field"
              >
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="enroll-due" className="label">Due date (optional)</label>
              <input
                id="enroll-due"
                type="date"
                value={enrollDueAt}
                onChange={(e) => setEnrollDueAt(e.target.value)}
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>
              Enroll Caregiver
            </button>
            {enrollMsg && (
              <div
                role={enrollMsg.kind === 'error' ? 'alert' : 'status'}
                className={`info-banner ${enrollMsg.kind === 'success' ? 'banner-success' : 'banner-error'}`}
              >
                {enrollMsg.text}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
