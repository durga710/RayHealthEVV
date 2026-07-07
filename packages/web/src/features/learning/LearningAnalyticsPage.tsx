import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';

type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';

interface CourseAnalyticsRow {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  required: boolean;
  cadence: CourseCadence;
  totalEnrollments: number;
  completedCount: number;
  overdueCount: number;
  expiredCount: number;
  pendingCount: number;
  completionRate: number;
  averageDaysToComplete: number | null;
}

interface CourseAnalyticsEnvelope {
  generatedAt: string;
  rows: CourseAnalyticsRow[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function LearningAnalyticsPage(): ReactElement {
  const [envelope, setEnvelope] = useState<CourseAnalyticsEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CourseAnalyticsEnvelope>>('/api/learning/analytics');
        if (cancelled) return;
        if (response.success && response.data) {
          setEnvelope(response.data);
        } else {
          setError(response.error ?? 'Failed to load analytics');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Course analytics</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
            Per-course completion rates and bottleneck signal. Sorted by completion rate ascending, worst-performing courses first.
          </p>
        </div>
        <Link to="/admin/learning" style={linkButtonStyle}>← Learning Hub</Link>
      </header>

      {loading && <p>Loading analytics…</p>}

      {error && (
        <div style={errorBoxStyle}>
          <strong>Could not load analytics.</strong> {error}
        </div>
      )}

      {!loading && envelope && envelope.rows.length === 0 && (
        <div style={emptyStateStyle}>
          <p style={{ margin: 0 }}>No courses in the catalog yet.</p>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.85rem' }}>
            Seed the PA-required baseline, then come back when caregivers have enrollments.
          </p>
        </div>
      )}

      {envelope && envelope.rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Course</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Enrolled</th>
                <th style={thStyle}>Completion rate</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Avg. days to complete</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Action needed</th>
              </tr>
            </thead>
            <tbody>
              {envelope.rows.map((row) => (
                <tr key={row.courseId} style={trStyle}>
                  <td style={tdStyle}>
                    <Link to={`/admin/learning/courses/${row.courseId}`} style={courseLinkStyle}>
                      <strong>{row.courseTitle}</strong>
                    </Link>
                    {row.required && <span style={requiredBadgeStyle}>Required</span>}
                    <div style={courseMetaStyle}>
                      {row.courseCode} · {cadenceLabel(row.cadence)}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {row.totalEnrollments}
                  </td>
                  <td style={tdStyle}>
                    <CompletionBar
                      rate={row.completionRate}
                      completed={row.completedCount}
                      total={row.totalEnrollments}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {row.averageDaysToComplete === null
                      ? <span style={{ color: '#94a3b8' }}>, </span>
                      : `${Math.round(row.averageDaysToComplete)} d`}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <ActionCount overdue={row.overdueCount} expired={row.expiredCount} pending={row.pendingCount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {envelope && (
        <p style={generatedAtStyle}>
          Generated {new Date(envelope.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

interface CompletionBarProps {
  rate: number;
  completed: number;
  total: number;
}

function CompletionBar({ rate, completed, total }: CompletionBarProps): ReactElement {
  const percent = Math.round(rate * 100);
  const color = percent >= 95 ? '#10A4A4' : percent >= 80 ? '#BA7517' : percent >= 50 ? '#D85A30' : '#E24B4A';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', minWidth: '120px' }}>
        <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', backgroundColor: color }} />
      </div>
      <span style={{ fontSize: '0.85rem', fontWeight: 500, color, minWidth: '60px', textAlign: 'right' }}>
        {percent}% ({completed}/{total})
      </span>
    </div>
  );
}

interface ActionCountProps {
  overdue: number;
  expired: number;
  pending: number;
}

function ActionCount({ overdue, expired, pending }: ActionCountProps): ReactElement {
  const total = overdue + expired + pending;
  if (total === 0) {
    return <span style={{ color: '#10A4A4', fontWeight: 500 }}>All clear</span>;
  }
  return (
    <div style={{ fontSize: '0.85rem' }}>
      {expired > 0 && <span style={{ color: '#E24B4A', fontWeight: 500 }}>{expired} expired</span>}
      {expired > 0 && (overdue > 0 || pending > 0) && <span style={{ color: '#94a3b8' }}>, </span>}
      {overdue > 0 && <span style={{ color: '#BA7517', fontWeight: 500 }}>{overdue} overdue</span>}
      {overdue > 0 && pending > 0 && <span style={{ color: '#94a3b8' }}>, </span>}
      {pending > 0 && <span style={{ color: '#64748b' }}>{pending} pending</span>}
    </div>
  );
}

function cadenceLabel(cadence: CourseCadence): string {
  switch (cadence) {
    case 'one_time': return 'One-time';
    case 'annual': return 'Annual';
    case 'biennial': return 'Biennial';
    case 'certification': return 'Certification';
  }
}

// ---------- Styles ----------

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  overflow: 'hidden',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '0.8rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#64748b',
  padding: '0.85rem 1rem',
  borderBottom: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
};

const tdStyle: React.CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  verticalAlign: 'middle',
};

const courseMetaStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-muted, #64748b)',
  marginTop: '0.2rem',
};

const requiredBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.1rem 0.4rem',
  borderRadius: '10px',
  backgroundColor: '#fef3c7',
  color: '#7c2d12',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginLeft: '0.5rem',
  verticalAlign: 'middle',
};

const linkButtonStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#185FA5',
  fontSize: '0.9rem',
  border: '1px solid #185FA5',
  padding: '0.4rem 0.85rem',
  borderRadius: '6px',
};

const courseLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#0b1220',
};

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '6px',
  marginBottom: '1rem',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '1.5rem',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '1px dashed #cbd5e1',
};

const generatedAtStyle: React.CSSProperties = {
  marginTop: '1rem',
  fontSize: '0.75rem',
  color: 'var(--color-text-muted, #94a3b8)',
  textAlign: 'right',
};
