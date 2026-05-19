import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { postJson, getJson } from '../../lib/api-client.js';

interface CourseSection {
  title: string;
  content: string;
}

interface CourseModules {
  objectives: string[];
  sections: CourseSection[];
  note?: string | null;
  videoSearchQuery?: string | null;
}

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
  modules: CourseModules | null;
}

interface Enrollment {
  id: string;
  courseId: string;
  status: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
}

interface ProgressData {
  caregiverId: string;
  enrollments: Array<{ enrollment: Enrollment; course: Course }>;
}

const CADENCE_LABEL: Record<string, string> = {
  one_time: 'One-time',
  annual: 'Annual',
  biennial: 'Every 2 years',
  certification: 'Certification',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const backBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6366F1',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
  padding: '0 0 1.25rem',
  display: 'block',
};

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<{ enrollment: Enrollment; course: Course } | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completedNow, setCompletedNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<number | null>(0);

  useEffect(() => {
    getJson<{ success: boolean; data: ProgressData }>('/api/learning/progress')
      .then((r) => {
        const found = r.data.enrollments.find((e) => e.course.id === courseId) ?? null;
        setItem(found);
      })
      .catch(() => setError('Failed to load course'))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleMarkComplete = async () => {
    if (!item) return;
    setCompleting(true);
    setError(null);
    try {
      await postJson('/api/learning/complete', {
        enrollmentId: item.enrollment.id,
        courseId: item.course.id,
      });
      setCompletedNow(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      setCompleting(false);
    }
  };

  const trackStarted = () => {
    if (!item) return;
    postJson('/api/learning/start', { enrollmentId: item.enrollment.id }).catch(() => {});
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748B' }}>
        Loading course…
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <button type="button" onClick={() => navigate('/portal/training')} style={backBtnStyle}>
          ← Back to My Training
        </button>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '2rem', color: '#DC2626', textAlign: 'center' }}>
          Course not found or you are not enrolled.
        </div>
      </div>
    );
  }

  const { course, enrollment } = item;
  const mods = course.modules;
  const isCompleted = completedNow || enrollment.status === 'completed';
  const isInProgress = !isCompleted && enrollment.status === 'in_progress';
  const ytSearchUrl = mods?.videoSearchQuery
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(mods.videoSearchQuery)}`
    : null;

  return (
    <div style={{ maxWidth: '720px' }}>
      <button type="button" onClick={() => navigate('/portal/training')} style={backBtnStyle}>
        ← Back to My Training
      </button>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
        borderRadius: '14px',
        padding: '1.75rem 2rem',
        color: '#fff',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {course.required && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
              Required
            </span>
          )}
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(255,255,255,0.15)', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
            {CADENCE_LABEL[course.cadence] ?? course.cadence}
          </span>
          {isCompleted && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'rgba(134,239,172,0.3)', color: '#BBF7D0', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
              ✓ Completed
            </span>
          )}
          {isInProgress && (
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: 'rgba(254,215,170,0.3)', color: '#FED7AA', borderRadius: '100px', padding: '0.2rem 0.65rem' }}>
              In Progress
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem', lineHeight: 1.2 }}>{course.title}</h1>
        <p style={{ fontSize: '0.9rem', margin: 0, opacity: 0.85, lineHeight: 1.5 }}>{course.description}</p>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', opacity: 0.75, flexWrap: 'wrap' }}>
          <span>⏱ {course.durationMinutes} min</span>
          {enrollment.dueAt && <span>Due: {formatDate(enrollment.dueAt)}</span>}
          {enrollment.lastCompletedAt && <span>Completed: {formatDate(enrollment.lastCompletedAt)}</span>}
          {enrollment.expiresAt && <span>Cert expires: {formatDate(enrollment.expiresAt)}</span>}
          {course.expiresAfterDays && !enrollment.expiresAt && (
            <span>Valid {course.expiresAfterDays} days after completion</span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Learning objectives */}
      {mods?.objectives && mods.objectives.length > 0 && (
        <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0369A1', margin: '0 0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Learning Objectives
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {mods.objectives.map((obj, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: '#0C4A6E', lineHeight: 1.55 }}>{obj}</li>
            ))}
          </ul>
        </div>
      )}

      {/* In-person / important note */}
      {mods?.note && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '0.85rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#92400E', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ️</span>
          <span>{mods.note}</span>
        </div>
      )}

      {/* Course sections — accordion */}
      {mods?.sections && mods.sections.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Course Content — {mods.sections.length} Sections
            </h2>
            <button
              type="button"
              onClick={() => setOpenSection(openSection === null ? 0 : null)}
              style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#6366F1', fontWeight: 600, cursor: 'pointer' }}
            >
              {openSection !== null ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {mods.sections.map((section, i) => {
              const isOpen = openSection === i;
              return (
                <div key={i} style={{ background: '#fff', border: `1px solid ${isOpen ? '#C7D2FE' : '#E2E8F0'}`, borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(isOpen ? null : i)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '0.75rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: isOpen ? 'var(--color-primary, #6366F1)' : '#F1F5F9',
                        color: isOpen ? '#fff' : '#64748B',
                        fontSize: '0.75rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>{section.title}</span>
                    </div>
                    <span style={{ color: '#94A3B8', fontSize: '0.875rem', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #F1F5F9' }}>
                      <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.8, margin: '1rem 0 0' }}>
                        {section.content}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Video + official resource links */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {ytSearchUrl && (
          <a
            href={ytSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackStarted}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.1rem', background: '#FF0000', color: '#fff',
              borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none',
            }}
          >
            <svg width="18" height="13" viewBox="0 0 18 13" fill="white" aria-hidden="true">
              <path d="M17.6 2.03C17.4 1.27 16.8.66 16.07.45 14.7.07 9 .07 9 .07s-5.7 0-7.07.38C1.2.66.6 1.27.4 2.03.07 3.42.07 6.5.07 6.5s0 3.08.33 4.47c.2.76.8 1.37 1.53 1.58C3.3 12.93 9 12.93 9 12.93s5.7 0 7.07-.38c.73-.21 1.33-.82 1.53-1.58.33-1.39.33-4.47.33-4.47s0-3.08-.33-4.47z" fill="white"/>
              <path d="M7.2 9.29V3.71L11.93 6.5 7.2 9.29z" fill="#FF0000"/>
            </svg>
            Watch Free Training Videos on YouTube
          </a>
        )}
        {course.externalUrl && (
          <a
            href={course.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackStarted}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.6rem 1.1rem', background: '#F8FAFC', color: '#334155',
              border: '1px solid #E2E8F0', borderRadius: '8px', fontWeight: 600,
              fontSize: '0.875rem', textDecoration: 'none',
            }}
          >
            📋 Official Course Resource ↗
          </a>
        )}
      </div>

      {/* Mark complete footer */}
      <div style={{
        background: isCompleted ? '#F0FDF4' : '#F8FAFC',
        border: `1px solid ${isCompleted ? '#BBF7D0' : '#E2E8F0'}`,
        borderRadius: '12px', padding: '1.25rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div>
          {isCompleted ? (
            <>
              <div style={{ fontWeight: 700, color: '#15803D', fontSize: '1rem' }}>🏅 Training Complete</div>
              <div style={{ fontSize: '0.8125rem', color: '#16A34A', marginTop: '0.2rem' }}>
                Completed {formatDate(enrollment.lastCompletedAt)}
                {enrollment.expiresAt && ` · Expires ${formatDate(enrollment.expiresAt)}`}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.9375rem' }}>Ready to mark this course complete?</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem' }}>
                Review all sections above, then confirm completion.
              </div>
            </>
          )}
        </div>
        {!isCompleted && (
          <button
            type="button"
            disabled={completing}
            onClick={() => void handleMarkComplete()}
            style={{
              padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9375rem',
              color: '#fff', background: completing ? '#94A3B8' : 'var(--color-primary, #6366F1)',
              border: 'none', borderRadius: '8px', cursor: completing ? 'wait' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {completing ? 'Saving…' : '✓ Mark Complete'}
          </button>
        )}
      </div>
    </div>
  );
}
