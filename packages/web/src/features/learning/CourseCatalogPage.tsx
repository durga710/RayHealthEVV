import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';

type CourseCadence = 'one_time' | 'semi_annual' | 'annual' | 'biennial' | 'certification';

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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const CADENCE_LABEL: Record<CourseCadence, string> = {
  one_time: 'One-time',
  annual: 'Annual',
  semi_annual: 'Semi-Annual',
  biennial: 'Biennial',
  certification: 'Certification',
};

export function CourseCatalogPage() {
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<LearningCourse[]>>('/api/learning/courses');
        if (cancelled) return;
        if (response.success && response.data) {
          setCourses(response.data);
        } else {
          setError(response.error ?? 'Failed to load courses');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load courses');
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
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Course catalog</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Training courses available to assign to caregivers.
          </p>
        </div>
        <Link to="/admin/learning" style={linkButtonStyle}>← Back to Learning Hub</Link>
      </header>

      {loading && <p>Loading courses…</p>}
      {error && (
        <div style={errorBoxStyle}>
          <strong>Could not load courses.</strong> {error}
        </div>
      )}

      {!loading && courses.length === 0 && !error && (
        <div style={emptyStateStyle}>
          <p style={{ margin: 0 }}>
            No courses in the catalog yet. Seed the PA-required baseline with:
          </p>
          <pre style={codeBlockStyle}>npx tsx packages/core/scripts/seed-learning-catalog.ts</pre>
        </div>
      )}

      {courses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {courses.map((course) => (
            <article key={course.id} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{course.title}</h3>
                {course.required && <span style={requiredBadgeStyle}>Required</span>}
                {course.agencyId === null && <span style={globalBadgeStyle}>Global</span>}
              </div>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {course.description}
              </p>
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                <span><strong>Code:</strong> {course.code}</span>
                <span><strong>Cadence:</strong> {CADENCE_LABEL[course.cadence]}</span>
                <span><strong>Duration:</strong> {course.durationMinutes} min</span>
                {course.expiresAfterDays !== null && (
                  <span><strong>Expires after:</strong> {course.expiresAfterDays} days</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Styles ----------

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
};

const requiredBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.5rem',
  borderRadius: '12px',
  backgroundColor: 'var(--color-warning-bg)',
  color: 'var(--color-accent-dark)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const globalBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.5rem',
  borderRadius: '12px',
  backgroundColor: 'var(--color-info-bg)',
  color: 'var(--color-primary-dark)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const linkButtonStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: 'var(--color-primary)',
  fontSize: '0.9rem',
  border: '1px solid var(--color-primary)',
  padding: '0.4rem 0.85rem',
  borderRadius: '6px',
};

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: 'var(--color-danger-bg)',
  color: 'var(--color-danger-text)',
  borderRadius: '6px',
  marginBottom: '1rem',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '1.5rem',
  backgroundColor: 'var(--color-bg)',
  borderRadius: '8px',
  border: '1px dashed var(--color-border-strong)',
};

const codeBlockStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.5rem 0.75rem',
  backgroundColor: 'var(--color-text)',
  color: 'var(--color-border)',
  borderRadius: '4px',
  fontSize: '0.85rem',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  overflowX: 'auto',
};
