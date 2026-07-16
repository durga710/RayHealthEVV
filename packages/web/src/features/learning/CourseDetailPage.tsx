import { useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';

type CourseCadence = 'one_time' | 'semi_annual' | 'annual' | 'biennial' | 'certification';
type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';

interface LearningCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: CourseCadence;
  required: boolean;
}

interface CourseEnrollment {
  id: string;
  caregiverId: string;
  assignedAt: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
  status: EnrollmentStatus;
}

interface CourseCaregiverRow {
  enrollment: CourseEnrollment;
  caregiver: { id: string; firstName: string; lastName: string; email: string };
  effectiveStatus: EnrollmentStatus;
}

interface CourseCaregiverEnvelope {
  course: LearningCourse;
  caregivers: CourseCaregiverRow[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
  expired: 'Expired',
};

const STATUS_ORDER: EnrollmentStatus[] = ['expired', 'overdue', 'in_progress', 'not_started', 'completed'];

const STATUS_THEME: Record<EnrollmentStatus, { bg: string; fg: string }> = {
  not_started: { bg: '#F1EFE8', fg: '#5F5E5A' },
  in_progress: { bg: '#E6F1FB', fg: '#0C447C' },
  completed:   { bg: '#E1F5EE', fg: '#085041' },
  overdue:     { bg: '#FAEEDA', fg: '#633806' },
  expired:     { bg: '#FCEBEB', fg: '#791F1F' },
};

export function CourseDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const [envelope, setEnvelope] = useState<CourseCaregiverEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CourseCaregiverEnvelope>>(`/api/learning/courses/${id}/caregivers`);
        if (cancelled) return;
        if (response.success && response.data) {
          setEnvelope(response.data);
        } else {
          setError(response.error ?? 'Failed to load course');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load course');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Group caregivers by status, sorted by STATUS_ORDER (worst first)
  const grouped: Partial<Record<EnrollmentStatus, CourseCaregiverRow[]>> = {};
  for (const row of envelope?.caregivers ?? []) {
    const list = grouped[row.effectiveStatus] ?? [];
    list.push(row);
    grouped[row.effectiveStatus] = list;
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            {envelope?.course.title ?? 'Course detail'}
          </h2>
          {envelope?.course && (
            <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
              {envelope.course.code} · {envelope.course.required ? 'Required · ' : ''}{cadenceLabel(envelope.course.cadence)}
            </p>
          )}
        </div>
        <Link to="/admin/learning/analytics" style={linkButtonStyle}>← Analytics</Link>
      </header>

      {loading && <p>Loading…</p>}

      {error && (
        <div style={errorBoxStyle}>
          <strong>Could not load.</strong> {error}
        </div>
      )}

      {envelope && envelope.course.description && (
        <p style={{ margin: '0 0 1.5rem', color: '#334155', lineHeight: 1.55, fontSize: '0.95rem' }}>
          {envelope.course.description}
        </p>
      )}

      {envelope && envelope.caregivers.length === 0 && (
        <div style={emptyStateStyle}>
          <p style={{ margin: 0 }}>No caregivers enrolled in this course yet.</p>
        </div>
      )}

      {envelope && envelope.caregivers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {STATUS_ORDER.map((status) => {
            const rows = grouped[status];
            if (!rows || rows.length === 0) return null;
            const theme = STATUS_THEME[status];
            return (
              <section key={status}>
                <h3 style={{ ...sectionHeadingStyle, color: theme.fg, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ ...statusPillStyle, color: theme.fg, backgroundColor: theme.bg }}>
                    {STATUS_LABEL[status]}
                  </span>
                  <span style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '0.85rem', fontWeight: 400 }}>
                    {rows.length} caregiver{rows.length === 1 ? '' : 's'}
                  </span>
                </h3>
                <ul style={listStyle}>
                  {rows.map((row) => (
                    <li key={row.enrollment.id}>
                      <Link to={`/admin/learning/caregivers/${row.caregiver.id}`} style={rowLinkStyle}>
                        <article style={rowCardStyle}>
                          <div>
                            <strong>{row.caregiver.lastName}, {row.caregiver.firstName}</strong>
                            <div style={metaLineStyle}>
                              {row.caregiver.email}
                              {row.enrollment.dueAt && ` · Due ${formatDate(row.enrollment.dueAt)}`}
                              {row.enrollment.lastCompletedAt && ` · Completed ${formatDate(row.enrollment.lastCompletedAt)}`}
                              {row.enrollment.expiresAt && ` · Expires ${formatDate(row.enrollment.expiresAt)}`}
                            </div>
                          </div>
                          <span style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.85rem' }}>→</span>
                        </article>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function cadenceLabel(cadence: CourseCadence): string {
  switch (cadence) {
    case 'one_time': return 'One-time';
    case 'annual': return 'Annual';
    case 'semi_annual': return 'Every 6 months';
    case 'biennial': return 'Biennial';
    case 'certification': return 'Certification';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Styles ----------

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1rem',
  fontWeight: 500,
};

const statusPillStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.2rem 0.55rem',
  borderRadius: '999px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const rowLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: 'inherit',
};

const rowCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.85rem 1rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
};

const metaLineStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--color-text-muted, #64748b)',
  marginTop: '0.25rem',
};

const linkButtonStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#185FA5',
  fontSize: '0.9rem',
  border: '1px solid #185FA5',
  padding: '0.4rem 0.85rem',
  borderRadius: '6px',
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
