import React, { useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';

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

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' },
  warning: { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  info: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
};

const cadenceLabel: Record<string, string> = {
  one_time: 'One-time',
  annual: 'Annual',
  biennial: 'Biennial',
  certification: 'Certification',
};

export function LearningHubPage() {
  const [rollup, setRollup] = useState<Rollup | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollCaregiverId, setEnrollCaregiverId] = useState('');
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrollDueAt, setEnrollDueAt] = useState('');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getJson<{ success: boolean; data: Rollup }>('/api/learning/rollup'),
      getJson<{ success: boolean; data: { insights: Insight[] } }>('/api/learning/insights'),
      getJson<{ success: boolean; data: Course[] }>('/api/learning/courses'),
    ])
      .then(([rollupRes, insightsRes, coursesRes]) => {
        if (rollupRes.success) setRollup(rollupRes.data);
        if (insightsRes.success) setInsights(insightsRes.data.insights ?? []);
        if (coursesRes.success) setCourses(coursesRes.data ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollMsg('');
    try {
      await postJson('/api/learning/enroll', {
        caregiverId: enrollCaregiverId,
        courseId: enrollCourseId,
        dueAt: enrollDueAt || null,
      });
      setEnrollMsg('Enrolled successfully.');
      setEnrollCaregiverId('');
      setEnrollCourseId('');
      setEnrollDueAt('');
    } catch {
      setEnrollMsg('Failed to enroll — check caregiver and course IDs.');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading learning data…</div>;
  }

  const compliancePct = rollup ? Math.round(rollup.complianceRate * 100) : 0;

  return (
    <div>
      <h2 style={{ marginBottom: '0.25rem' }}>Learning Hub</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        PA §52.18 training compliance — caregiver enrollments, completions, and expirations.
      </p>

      {/* Rollup strip */}
      {rollup && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1px',
            backgroundColor: '#c9d8e8',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '2rem',
            boxShadow: '0 2px 8px rgba(26,95,168,0.08)',
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
            ] as const
          ).map(({ label, value, ok, warn }) => (
            <div key={label} style={{ backgroundColor: 'white', padding: '1.25rem 1rem', textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2rem',
                  fontWeight: 900,
                  color: (warn as boolean | undefined) ? '#b91c1c' : (ok as boolean | undefined) ? '#166534' : 'var(--color-primary-dark)',
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  marginTop: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  fontWeight: 600,
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
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Action items</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                  <strong style={{ color: colors.text, fontSize: '0.95rem' }}>{insight.title}</strong>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
                    {insight.summary}
                  </p>
                  {insight.caregivers.length > 0 && (
                    <ul
                      style={{
                        margin: '0.5rem 0 0',
                        padding: '0 0 0 1rem',
                        fontSize: '0.8rem',
                        color: '#6b7280',
                      }}
                    >
                      {insight.caregivers.slice(0, 4).map((cg) => (
                        <li key={cg.caregiverId}>
                          {cg.firstName} {cg.lastName} — {cg.context}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Course catalog */}
        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Course catalog</h3>
          {courses.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#64748b',
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
                    padding: '0.875rem 1rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--color-primary-dark)' }}>
                        {c.title}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        {c.code}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      {c.required && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                            borderRadius: '4px',
                            fontWeight: 700,
                          }}
                        >
                          Required
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          borderRadius: '4px',
                        }}
                      >
                        {cadenceLabel[c.cadence] ?? c.cadence}
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      margin: '0.4rem 0 0',
                      fontSize: '0.8rem',
                      color: '#64748b',
                      lineHeight: 1.4,
                    }}
                  >
                    {c.description}
                  </p>
                  <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {c.durationMinutes} min
                    {c.expiresAfterDays ? ` · expires after ${c.expiresAfterDays} days` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enroll a caregiver */}
        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Enroll a caregiver</h3>
          <form onSubmit={handleEnroll} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="enroll-caregiver" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Caregiver ID
              </label>
              <input
                id="enroll-caregiver"
                type="text"
                value={enrollCaregiverId}
                onChange={(e) => setEnrollCaregiverId(e.target.value)}
                placeholder="Caregiver UUID"
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="enroll-course" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Course
              </label>
              <select
                id="enroll-course"
                value={enrollCourseId}
                onChange={(e) => setEnrollCourseId(e.target.value)}
                required
                style={{
                  padding: '0.75rem 1rem',
                  border: '1px solid #c9d8e8',
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                }}
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
              <label htmlFor="enroll-due" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                Due date (optional)
              </label>
              <input
                id="enroll-due"
                type="date"
                value={enrollDueAt}
                onChange={(e) => setEnrollDueAt(e.target.value)}
              />
            </div>
            <button type="submit">Enroll Caregiver</button>
            {enrollMsg && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: enrollMsg.includes('success') ? '#f0fdf4' : '#fef2f2',
                  color: enrollMsg.includes('success') ? '#166534' : '#b91c1c',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}
              >
                {enrollMsg}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
