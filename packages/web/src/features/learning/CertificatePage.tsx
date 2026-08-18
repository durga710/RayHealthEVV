import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';
import { tint } from '../../lib/color.js';

/**
 * Printable certificate of completion for a caregiver's completed course.
 * Mounted at /portal/training/:courseId/certificate. Data is authoritative , 
 * fetched from GET /api/learning/certificate/:courseId, which 404s unless the
 * caregiver actually completed the course. The toolbar is hidden when printing
 * so the certificate prints clean (or "Save as PDF").
 */

interface Certificate {
  caregiverName: string;
  agencyName: string;
  courseTitle: string;
  courseCode: string;
  cadence: string;
  completedAt: string;
  expiresAt: string | null;
  score: number | null;
  verificationCode: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function CertificatePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ success: boolean; data: Certificate }>(`/api/learning/certificate/${courseId}`)
      .then((r) => setCert(r.data))
      .catch(() => setError('This certificate is not available yet, complete the course first.'))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading certificate…</div>;
  }

  if (error || !cert) {
    return (
      <div style={{ maxWidth: '640px' }}>
        <button type="button" onClick={() => navigate('/portal/training')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', padding: '0 0 1rem' }}>
          ← Back to My Training
        </button>
        <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: '10px', padding: '2rem', color: 'var(--color-danger-text)', textAlign: 'center' }}>
          {error ?? 'Certificate not available.'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <style>{`@media print { .cert-toolbar { display: none !important; } body { background: var(--color-surface) !important; } .cert-page { box-shadow: none !important; border-color: var(--color-primary-dark) !important; } }`}</style>

      {/* Toolbar (hidden on print) */}
      <div className="cert-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => navigate('/portal/training')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', padding: 0 }}>
          ← Back to My Training
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.2rem', background: 'var(--color-primary)', color: 'var(--color-surface)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Save as PDF
        </button>
      </div>

      {/* Certificate */}
      <div
        className="cert-page"
        style={{
          background: 'var(--color-surface)',
          border: '2px solid var(--color-primary)',
          borderRadius: '16px',
          padding: '3.5rem 3rem',
          boxShadow: '0 20px 50px -20px rgba(12,93,102,0.35)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% -10%, ${tint('var(--color-primary)', 8)}, transparent 60%)`, pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            {cert.agencyName || 'RayHealthEVV'}
          </div>
          <div style={{ width: '56px', height: '4px', background: 'linear-gradient(90deg,var(--color-primary),var(--color-accent))', borderRadius: '4px', margin: '0 auto 1.75rem' }} />

          <h1 style={{ fontSize: '2.1rem', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: '0 0 0.4rem' }}>
            Certificate of Completion
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: '0 0 2.25rem' }}>This certifies that</p>

          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-primary-dark)', margin: '0 0 0.4rem' }}>
            {cert.caregiverName || 'Caregiver'}
          </div>
          <div style={{ width: '320px', maxWidth: '80%', height: '1px', background: 'var(--color-border)', margin: '0 auto 2rem' }} />

          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, margin: '0 0 0.4rem' }}>
            has successfully completed the training course
          </p>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 2.25rem' }}>
            “{cert.courseTitle}”
          </div>

          {cert.score != null && (
            <div style={{ display: 'inline-block', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', color: 'var(--color-success-text)', borderRadius: '100px', padding: '0.35rem 1rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '2rem' }}>
              Score: {cert.score}%
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', marginTop: '1rem', textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-subtle)', marginBottom: '0.2rem' }}>Completed</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text)', fontWeight: 600 }}>{formatDate(cert.completedAt)}</div>
            </div>
            {cert.expiresAt && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-subtle)', marginBottom: '0.2rem' }}>Valid through</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--color-text)', fontWeight: 600 }}>{formatDate(cert.expiresAt)}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-subtle)', marginBottom: '0.2rem' }}>Course code</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text)', fontWeight: 600 }}>{cert.courseCode}</div>
            </div>
          </div>

          <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-surface-soft)', color: 'var(--color-text-subtle)', fontSize: '0.75rem' }}>
            Verification code <strong style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{cert.verificationCode}</strong>
            {' · '}Issued via RayHealthEVV&trade; learning platform
          </div>
        </div>
      </div>
    </div>
  );
}
