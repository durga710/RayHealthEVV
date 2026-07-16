import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson, postJson } from '../../lib/api-client.js';
import { EmptyState, LoadingSkeleton, ErrorRetry } from '../../components/state/index.js';

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged' | 'corrected';
  tasks?: { id: string; duty: string }[] | null;
  visitNote?: string | null;
  signature?: { signerRole: 'client' | 'representative'; signerName?: string | null } | null;
}

interface StaffMember { id: string; email: string; role: string; }

interface FraudFactor {
  type: string;
  severity: number;
  contribution: number;
  explanation: string;
}
interface FraudVerdict {
  visitId: string;
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'verified' | 'review' | 'rejected';
  triggeredCount: number;
  factors: FraudFactor[];
}

type Banner = { kind: 'success' | 'error'; text: string } | null;

const RISK_COLOR: Record<FraudVerdict['riskLevel'], string> = {
  low: '#64748B',
  medium: '#D97706',
  high: '#EA580C',
  critical: '#DC2626',
};

const SIGNAL_LABEL: Record<string, string> = {
  impossible_travel: 'Impossible travel',
  duplicate_visit: 'Duplicate visit',
  gps_anomaly: 'GPS / geofence anomaly',
  abnormal_duration: 'Abnormal duration',
};

const statusBadgeClass = (status: EvvVisit['status']): string => {
  const map: Record<EvvVisit['status'], string> = {
    pending: 'badge badge-warning',
    verified: 'badge badge-success',
    flagged: 'badge badge-danger',
    corrected: 'badge badge-info',
  };
  return map[status] ?? 'badge badge-neutral';
};

export function VisitReviewPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [fraudByVisit, setFraudByVisit] = useState<Map<string, FraudVerdict>>(new Map());
  const [expandedFraud, setExpandedFraud] = useState<string | null>(null);

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

    // Fraud scoring is additive and must never block the visit table: on any
    // failure (or an agency without the capability) the Risk column just stays
    // empty rather than surfacing an error.
    getJson<{ verdicts: FraudVerdict[] }>('/api/fraud/flagged?minScore=1&limit=200')
      .then((res) => setFraudByVisit(new Map((res.verdicts || []).map((v) => [v.visitId, v]))))
      .catch(() => setFraudByVisit(new Map()));
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

  const totalVisits = visits.length;
  const pendingCount = visits.filter(v => v.status === 'pending').length;
  const verifiedCount = visits.filter(v => v.status === 'verified').length;
  const flaggedCount = visits.filter(v => v.status === 'flagged').length;

  return (
    <div>
      {/* Gradient banner header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2d52 0%, #1a5fa8 60%, #2d7dd2 100%)',
          borderRadius: '12px',
          padding: '1.75rem 2rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 4px 24px rgba(15,45,82,0.18)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Visit Review
          </h1>
          <p style={{ margin: '0.3rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
            Review electronically verified visits and route corrections through visit maintenance.
          </p>
        </div>
      </div>

      {banner && (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={`info-banner ${banner.kind === 'success' ? 'banner-success' : 'banner-error'}`}
          style={{ marginBottom: '1rem' }}
        >
          {banner.text}
        </div>
      )}

      {!loading && !loadError && visits.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.18)',
              borderRadius: '999px', padding: '0.3rem 0.85rem',
              fontSize: '0.7rem', fontWeight: 700, color: '#64748B',
            }}
          >
            Total: {totalVisits}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)',
              borderRadius: '999px', padding: '0.3rem 0.85rem',
              fontSize: '0.7rem', fontWeight: 700, color: '#D97706',
            }}
          >
            Pending: {pendingCount}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.18)',
              borderRadius: '999px', padding: '0.3rem 0.85rem',
              fontSize: '0.7rem', fontWeight: 700, color: '#059669',
            }}
          >
            Verified: {verifiedCount}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)',
              borderRadius: '999px', padding: '0.3rem 0.85rem',
              fontSize: '0.7rem', fontWeight: 700, color: '#DC2626',
            }}
          >
            Flagged: {flaggedCount}
          </span>
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Caregiver</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Documentation</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => {
              const fraud = fraudByVisit.get(visit.id);
              const expanded = expandedFraud === visit.id;
              return (
              <React.Fragment key={visit.id}>
              <tr>
                <td>{caregiverLabel(visit.caregiverId)}</td>
                <td style={{ whiteSpace: 'nowrap', color: '#475569', fontSize: '0.8125rem' }}>{new Date(visit.clockInTime).toLocaleString()}</td>
                <td style={{ whiteSpace: 'nowrap', color: '#475569', fontSize: '0.8125rem' }}>
                  {visit.clockOutTime ? new Date(visit.clockOutTime).toLocaleString() : <em style={{ color: '#94A3B8' }}>In progress</em>}
                </td>
                <td style={{ maxWidth: 240 }}>
                  {visit.tasks && visit.tasks.length > 0 ? (
                    <div
                      title={visit.tasks.map((t) => t.duty).join(', ')}
                      style={{ fontSize: '0.78rem', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      <strong style={{ color: '#1a5fa8' }}>{visit.tasks.length}</strong>{' '}
                      task{visit.tasks.length === 1 ? '' : 's'}: {visit.tasks.map((t) => t.duty).join(', ')}
                    </div>
                  ) : null}
                  {visit.visitNote ? (
                    <div
                      title={visit.visitNote}
                      style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      “{visit.visitNote}”
                    </div>
                  ) : null}
                  {visit.signature ? (
                    <span
                      title={`Signed by ${visit.signature.signerRole === 'client' ? 'the client' : 'a representative'}${visit.signature.signerName ? ` (${visit.signature.signerName})` : ''}`}
                      style={{ display: 'inline-block', marginTop: '0.15rem', fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.18)', borderRadius: '999px', padding: '0.12rem 0.5rem' }}
                    >
                      Signed
                    </span>
                  ) : null}
                  {!(visit.tasks && visit.tasks.length > 0) && !visit.visitNote && !visit.signature ? (
                    <em style={{ color: '#94A3B8', fontSize: '0.78rem' }}>None</em>
                  ) : null}
                </td>
                <td>
                  {fraud ? (
                    <button
                      type="button"
                      onClick={() => setExpandedFraud(expanded ? null : visit.id)}
                      title={`Fraud score ${fraud.score}/100 — ${fraud.triggeredCount} signal${fraud.triggeredCount === 1 ? '' : 's'}. Click for details.`}
                      style={{
                        cursor: 'pointer', border: `1px solid ${RISK_COLOR[fraud.riskLevel]}40`,
                        background: `${RISK_COLOR[fraud.riskLevel]}14`, color: RISK_COLOR[fraud.riskLevel],
                        borderRadius: '999px', padding: '0.18rem 0.6rem', fontSize: '0.72rem', fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      }}
                    >
                      {fraud.score} · {fraud.riskLevel}
                      <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>{expanded ? '▲' : '▼'}</span>
                    </button>
                  ) : (
                    <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>Clear</span>
                  )}
                </td>
                <td>
                  <span className={statusBadgeClass(visit.status)} style={{ textTransform: 'capitalize' }}>{visit.status}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(visit.status === 'pending' || visit.status === 'flagged') && (
                      <button
                        onClick={() => handleRequestCorrection(visit.id)}
                        className="btn-ghost btn-sm"
                      >
                        Request Correction
                      </button>
                    )}
                    {visit.status === 'verified' && (
                      <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>Closed</span>
                    )}
                    {visit.status === 'corrected' && (
                      <span style={{ fontSize: '0.8125rem', color: '#0c5d66' }}>Corrected</span>
                    )}
                    <Link to={`/admin/audit-packet/${visit.id}`} className="btn-ghost btn-sm">
                      Audit packet
                    </Link>
                  </div>
                </td>
              </tr>
              {expanded && fraud && (
                <tr>
                  <td colSpan={7} style={{ background: '#F8FAFC', borderTop: `2px solid ${RISK_COLOR[fraud.riskLevel]}` }}>
                    <div style={{ padding: '0.5rem 0.25rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: RISK_COLOR[fraud.riskLevel], textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.5rem' }}>
                        Why this visit scored {fraud.score}/100
                      </div>
                      {fraud.factors.length === 0 ? (
                        <em style={{ color: '#94A3B8', fontSize: '0.8rem' }}>No individual signals recorded.</em>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {fraud.factors.map((f, i) => (
                            <li key={i} style={{ fontSize: '0.8rem', color: '#334155' }}>
                              <strong>{SIGNAL_LABEL[f.type] ?? f.type}</strong>
                              <span style={{ color: '#64748B' }}> ({Math.round(f.contribution * 100)}% of score)</span>: {f.explanation}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
