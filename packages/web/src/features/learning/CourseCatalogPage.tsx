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
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
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
              <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-muted, #475569)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {course.description}
              </p>
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)', flexWrap: 'wrap' }}>
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
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
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

const globalBadgeStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  padding: '0.15rem 0.5rem',
  borderRadius: '12px',
  backgroundColor: '#e6f1fb',
  color: '#0c447c',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
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

const codeBlockStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.5rem 0.75rem',
  backgroundColor: '#0f172a',
  color: '#e2e8f0',
  borderRadius: '4px',
  fontSize: '0.85rem',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  overflowX: 'auto',
};
