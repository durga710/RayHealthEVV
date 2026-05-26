import { useState, useEffect } from 'react';
import { getJson } from '../../lib/api-client.js';

interface Assignment {
  id: string;
  clientId: string;
  clientName: string;
  serviceCode?: string;
}

const SERVICE_LABELS: Record<string, string> = {
  T1019: 'Personal Care (T1019)',
  S5125: 'Attendant Care (S5125)',
  T1004: 'Nursing Aide (T1004)',
  T1021: 'Home Health Aide (T1021)',
};

export function CaregiverSchedulePage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<Assignment[]>('/api/assignments/caregiver')
      .then(setAssignments)
      .catch(() => setError('Failed to load schedule'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: '720px' }}>

      {/* ── Hero banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2d52 0%, #1a5fa8 60%, #2d7dd2 100%)',
        borderRadius: '16px',
        padding: '2rem 2.25rem',
        marginBottom: '1.75rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute',
          right: '-2.5rem',
          top: '-2.5rem',
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }} />
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '0.6rem',
        }}>
          Caregiver Portal
        </div>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: '#fff', margin: '0 0 0.3rem', lineHeight: 1.2 }}>
          My Schedule
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)', margin: 0 }}>
          Your active client assignments
        </p>
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <style>{`@keyframes rh-sched-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              height: '72px',
              animation: 'rh-sched-pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ background: '#F1F5F9', borderRadius: '6px', height: '12px', width: '45%', marginBottom: '0.6rem' }} />
              <div style={{ background: '#E2E8F0', borderRadius: '6px', height: '10px', width: '30%' }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="info-banner banner-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && assignments.length === 0 && (
        <div style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '3rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }} aria-hidden>📅</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>
            No assignments yet
          </div>
          <div style={{ fontSize: '0.875rem', color: '#94A3B8', maxWidth: '300px', margin: '0 auto' }}>
            Your coordinator will assign clients to you. Check back soon.
          </div>
        </div>
      )}

      {/* ── Assignment cards ── */}
      {assignments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {assignments.map((a) => {
            const initial = a.clientName.slice(0, 1).toUpperCase();
            const serviceLabel = a.serviceCode
              ? (SERVICE_LABELS[a.serviceCode] ?? a.serviceCode)
              : 'Service code not assigned';
            return (
              <div
                key={a.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(15,23,42,0.08)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLDivElement).style.transform = 'none';
                }}
              >
                {/* Client initial avatar */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1.0625rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {initial}
                </div>

                {/* Client info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.clientName}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {a.serviceCode && (
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        background: '#F1F5F9',
                        color: '#475569',
                        borderRadius: '4px',
                        padding: '0.1rem 0.45rem',
                        border: '1px solid #E2E8F0',
                      }}>
                        {a.serviceCode}
                      </span>
                    )}
                    <span>{serviceLabel}</span>
                  </div>
                </div>

                {/* Active status chip */}
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#7c3aed',
                  background: '#EEF2FF',
                  border: '1px solid #C7D2FE',
                  borderRadius: '100px',
                  padding: '0.25rem 0.7rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  Active
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
