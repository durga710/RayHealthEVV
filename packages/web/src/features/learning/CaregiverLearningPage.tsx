import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJson, postJson } from '../../lib/api-client.js';
import { EnrollCaregiverModal } from './EnrollCaregiverModal.js';

type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';
type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';

interface LearningCourse {
  id: string;
  agencyId: string | null;
  code: string;
  title: string;
  description: string;
  cadence: CourseCadence;
  expiresAfterDays: number | null;
  required: boolean;
  durationMinutes: number;
}

interface CourseEnrollment {
  id: string;
  agencyId: string;
  caregiverId: string;
  courseId: string;
  assignedAt: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
  status: EnrollmentStatus;
}

interface CaregiverLearningProgress {
  caregiverId: string;
  enrollments: Array<{
    enrollment: CourseEnrollment;
    course: LearningCourse;
  }>;
  isCompliant: boolean;
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

const STATUS_COLOR: Record<EnrollmentStatus, { fg: string; bg: string }> = {
  not_started: { fg: '#5F5E5A', bg: '#F1EFE8' },
  in_progress: { fg: '#0C447C', bg: '#E6F1FB' },
  completed: { fg: '#085041', bg: '#E1F5EE' },
  overdue: { fg: '#633806', bg: '#FAEEDA' },
  expired: { fg: '#791F1F', bg: '#FCEBEB' },
};

export function CaregiverLearningPage() {
  const params = useParams<{ id: string }>();
  const caregiverId = params.id ?? '';

  const [progress, setProgress] = useState<CaregiverLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJson<ApiResponse<CaregiverLearningProgress>>(
        `/api/learning/caregivers/${caregiverId}`,
      );
      if (response.success && response.data) {
        setProgress(response.data);
      } else {
        setError(response.error ?? 'Failed to load progress');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!caregiverId) return;
    void refresh();
    // refresh is a stable closure over set-state functions, eslint
    // doesn't have react-hooks/exhaustive-deps configured here so we leave
    // it out of the dep array; the function captures the current caregiverId
    // via outer scope.
  }, [caregiverId]);

  const recordCompletion = async (enrollment: CourseEnrollment): Promise<void> => {
    setCompletingId(enrollment.id);
    try {
      await postJson('/api/learning/complete', {
        enrollmentId: enrollment.id,
        caregiverId: enrollment.caregiverId,
        courseId: enrollment.courseId,
        completedAt: new Date().toISOString(),
        score: null,
        notes: 'Marked complete by coordinator from caregiver detail page',
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record completion');
    } finally {
      setCompletingId(null);
    }
  };

  if (!caregiverId) {
    return <p>Missing caregiver id.</p>;
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Caregiver learning</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
            Caregiver <code style={codeStyle}>{caregiverId}</code>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setEnrollOpen(true)} style={primaryActionStyle}>+ Assign course</button>
          <Link to="/admin/learning" style={linkButtonStyle}>← Learning Hub</Link>
        </div>
      </header>

      {loading && <p>Loading…</p>}
      {error && (
        <div style={errorBoxStyle}>
          <strong>Could not load progress.</strong> {error}
        </div>
      )}

      {progress && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={progress.isCompliant ? compliantBadgeStyle : nonCompliantBadgeStyle}>
              {progress.isCompliant ? 'Compliant' : 'Non-compliant'}
            </span>
            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)' }}>
              {progress.enrollments.length} enrollment{progress.enrollments.length === 1 ? '' : 's'}
            </span>
          </div>

          {progress.enrollments.length === 0 && (
            <div style={emptyStateStyle}>
              <p style={{ margin: 0 }}>No courses assigned yet.</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)' }}>
                Use the Enroll button on the Learning Hub to assign training.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {progress.enrollments.map(({ enrollment, course }) => {
              const colors = STATUS_COLOR[enrollment.status];
              return (
                <article key={enrollment.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{course.title}</h3>
                      {course.required && <span style={requiredBadgeStyle}>Required</span>}
                    </div>
                    <span style={{ ...statusBadgeStyle, color: colors.fg, backgroundColor: colors.bg }}>
                      {STATUS_LABEL[enrollment.status]}
                    </span>
                  </div>

                  <div style={metaRowStyle}>
                    <span><strong>Code:</strong> {course.code}</span>
                    <span><strong>Assigned:</strong> {formatDate(enrollment.assignedAt)}</span>
                    {enrollment.dueAt && (
                      <span><strong>Due:</strong> {formatDate(enrollment.dueAt)}</span>
                    )}
                    {enrollment.lastCompletedAt && (
                      <span><strong>Completed:</strong> {formatDate(enrollment.lastCompletedAt)}</span>
                    )}
                    {enrollment.expiresAt && (
                      <span><strong>Expires:</strong> {formatDate(enrollment.expiresAt)}</span>
                    )}
                  </div>

                  {(enrollment.status === 'not_started' || enrollment.status === 'in_progress' ||
                    enrollment.status === 'overdue' || enrollment.status === 'expired') && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        onClick={() => void recordCompletion(enrollment)}
                        disabled={completingId === enrollment.id}
                        aria-busy={completingId === enrollment.id}
                        style={actionButtonStyle}
                      >
                        {completingId === enrollment.id ? 'Recording…' : 'Mark complete'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      <EnrollCaregiverModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onSuccess={() => void refresh()}
        lockedCaregiverId={caregiverId}
      />
    </div>
  );
}

// ---------- Helpers ----------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------- Styles ----------

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1.25rem',
  fontSize: '0.85rem',
  color: 'var(--color-text-muted, #64748b)',
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: '0.8rem',
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '0.25rem 0.6rem',
  borderRadius: '12px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const requiredBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.5rem',
  borderRadius: '12px',
  backgroundColor: '#fef3c7',
  color: '#7c2d12',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const compliantBadgeStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '0.3rem 0.75rem',
  borderRadius: '6px',
  backgroundColor: '#E1F5EE',
  color: '#085041',
  fontWeight: 500,
};

const nonCompliantBadgeStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  padding: '0.3rem 0.75rem',
  borderRadius: '6px',
  backgroundColor: '#FCEBEB',
  color: '#791F1F',
  fontWeight: 500,
};

const linkButtonStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#185FA5',
  fontSize: '0.9rem',
  border: '1px solid #185FA5',
  padding: '0.4rem 0.85rem',
  borderRadius: '6px',
};

const actionButtonStyle: React.CSSProperties = {
  backgroundColor: '#185FA5',
  color: '#ffffff',
  border: 'none',
  padding: '0.45rem 0.9rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const primaryActionStyle: React.CSSProperties = {
  backgroundColor: '#185FA5',
  color: '#ffffff',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontWeight: 500,
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
