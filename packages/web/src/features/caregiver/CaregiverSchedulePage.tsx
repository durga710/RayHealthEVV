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
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.25rem' }}>
        My Schedule
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '2rem' }}>
        Your active client assignments
      </p>

      {loading && <div style={{ color: '#64748B' }}>Loading…</div>}
      {error && <div style={{ color: '#EF4444' }}>{error}</div>}

      {!loading && !error && assignments.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', color: '#94A3B8' }}>
          No assignments yet. Your coordinator will assign clients to you.
        </div>
      )}

      {assignments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {assignments.map((a) => (
            <div
              key={a.id}
              style={{
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>
                  {a.clientName}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '0.2rem' }}>
                  {a.serviceCode
                    ? SERVICE_LABELS[a.serviceCode] ?? a.serviceCode
                    : 'Service code not assigned'}
                </div>
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-primary, #6366F1)',
                  background: 'var(--color-primary-bg, #EEF2FF)',
                  borderRadius: '100px',
                  padding: '0.2rem 0.65rem',
                }}
              >
                Active
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
