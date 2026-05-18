import React, { useCallback, useEffect, useState } from 'react';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged' | 'corrected';
}

interface StaffMember { id: string; email: string; role: string; }

type Banner = { kind: 'success' | 'error'; text: string } | null;

const statusStyle = (status: EvvVisit['status']): React.CSSProperties => {
  const palette: Record<EvvVisit['status'], { bg: string; fg: string }> = {
    pending: { bg: '#fef3c7', fg: '#92400e' },
    verified: { bg: '#f0fdf4', fg: '#15803d' },
    flagged: { bg: '#fef2f2', fg: '#991b1b' },
    corrected: { bg: '#eff6ff', fg: '#1d4ed8' },
  };
  const p = palette[status] ?? palette.pending;
  return {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    backgroundColor: p.bg,
    color: p.fg,
    textTransform: 'capitalize',
    letterSpacing: '0.04em',
  };
};

export function VisitReviewPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  const caregiverLabel = (id: string) => {
    const s = staff.find(x => x.id === id);
    return s ? s.email : `${id.slice(0, 8)}…`;
  };

  const fetchVisits = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getJson<EvvVisit[]>('/api/evv/visits'),
      getJson<StaffMember[]>('/api/staff'),
    ])
      .then(([visitData, staffData]) => {
        setVisits(visitData || []);
        setStaff(staffData || []);
      })
      .catch((err: Error) => setLoadError(err.message || 'Failed to load visits'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const handleRequestCorrection = async (id: string) => {
    setBanner(null);
    try {
      await postJson('/api/maintenance/request-unlock', {
        visitId: id,
        reason: 'Coordinator requested EVV correction review from Visit Review',
      });
      setBanner({ kind: 'success', text: 'Correction request submitted successfully.' });
      fetchVisits();
    } catch (err) {
      setBanner({ kind: 'error', text: (err as Error).message || 'Failed to submit correction request.' });
    }
  };

  return (
    <div>
      <h2>EVV Visit Review</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        Review electronically verified visits and route corrections through visit maintenance.
      </p>

      {banner && (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          style={{
            marginBottom: '1rem', padding: '1rem', borderRadius: '8px', fontWeight: 600,
            backgroundColor: banner.kind === 'success' ? '#ecfdf5' : '#fef2f2',
            color: banner.kind === 'success' ? '#065f46' : '#991b1b',
          }}
        >
          {banner.text}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} columns={5} />
      ) : loadError ? (
        <ErrorRetry message={loadError} onRetry={fetchVisits} />
      ) : visits.length === 0 ? (
        <EmptyState
          title="No visits yet"
          body="Verified visits will appear here once caregivers complete a clock-in/clock-out cycle."
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Caregiver</th>
                <th style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Clock In</th>
                <th style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Clock Out</th>
                <th style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                <th style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => (
                <tr key={visit.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{caregiverLabel(visit.caregiverId)}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{new Date(visit.clockInTime).toLocaleString()}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    {visit.clockOutTime ? new Date(visit.clockOutTime).toLocaleString() : <em style={{ color: '#94a3b8' }}>In progress</em>}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={statusStyle(visit.status)}>{visit.status}</span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {(visit.status === 'pending' || visit.status === 'flagged') && (
                      <button
                        onClick={() => handleRequestCorrection(visit.id)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.35rem 0.75rem',
                          backgroundColor: 'transparent',
                          color: 'var(--color-primary)',
                          border: '1px solid var(--color-primary)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          marginTop: 0,
                        }}
                      >
                        Request Correction
                      </button>
                    )}
                    {visit.status === 'verified' && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Closed</span>
                    )}
                    {visit.status === 'corrected' && (
                      <span style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>Corrected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
