import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson, postJson } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface ClaimMatchingResponse {
  agencyId: string;
  asOf: string;
  counts: {
    verifiedVisitsLast7d: number;
    verifiedVisitsLast30d: number;
    flaggedVisitsLast7d: number;
    pendingVisits: number;
  };
  policy: {
    sandataSubmissionWindowDays: number;
  };
}

type DenialRisk = 'low' | 'medium' | 'high';

interface ClaimRow {
  id: string;
  clientId: string;
  payerId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalUnits: number;
  totalChargeCents: number;
  denialRisk: DenialRisk;
  controlNumber?: string;
  lineCount: number;
  createdAt?: string;
}

interface GenerateResult {
  generated: number;
  claims: ClaimRow[];
  unbillable: Array<{ visitId: string; clientId: string; reasons: string[] }>;
}

type BlockerReason = 'open' | 'flagged' | 'pending';

interface ClaimBlocker {
  visitId: string;
  reason: BlockerReason;
  clientName: string;
  caregiverName: string;
  clockInTime: string | null;
  clockOutTime: string | null;
}

interface BlockersResponse {
  asOf: string;
  counts: { open: number; flagged: number; pending: number; total: number };
  truncated: boolean;
  blockers: ClaimBlocker[];
}

const BLOCKER_META: Record<BlockerReason, { label: string; detail: string; fg: string; bg: string; to: string }> = {
  open: { label: 'Not clocked out', detail: 'Caregiver clocked in but never clocked out, no duration to bill or pay.', fg: '#991B1B', bg: '#FEF2F2', to: '/admin/review' },
  flagged: { label: 'Flagged', detail: 'Failed an EVV check, review before it can be billed.', fg: '#92400E', bg: '#FFFBEB', to: '/admin/compliance-engine/exceptions' },
  pending: { label: 'Pending verification', detail: 'Awaiting verification before it becomes claim-ready.', fg: '#155E75', bg: '#ECFEFF', to: '/admin/review' },
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-primary)',
  border: 'none',
  borderRadius: 10,
  color: 'var(--color-surface)',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 800,
  padding: '0.6rem 1rem',
};

const ghostButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 700,
  padding: '0.35rem 0.7rem',
};

const sectionCard: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1.25rem',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: '0.9rem',
  padding: '0.45rem 0.6rem',
};

function riskTone(risk: DenialRisk): { bg: string; fg: string } {
  if (risk === 'high') return { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger)' };
  if (risk === 'medium') return { bg: 'var(--color-accent-light)', fg: 'var(--color-accent-dark)' };
  return { bg: 'var(--color-primary-light)', fg: 'var(--color-primary-dark)' };
}

function defaultPeriod(): { start: string; end: string } {
  // Default to "last 30 days" ending today, in UTC calendar dates.
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  return { start, end };
}

async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ClaimMatchingPage() {
  const [snapshot, setSnapshot] = useState<ClaimMatchingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const period = defaultPeriod();
  const [periodStart, setPeriodStart] = useState(period.start);
  const [periodEnd, setPeriodEnd] = useState(period.end);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<BlockersResponse | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<ClaimMatchingResponse>('/api/compliance-engine/claims/overview');
      setSnapshot(data);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    try {
      const data = await getJson<{ total: number; claims: ClaimRow[] }>('/api/billing/claims?limit=100');
      setClaims(data.claims);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setClaimsLoading(false);
    }
  }, []);

  const loadBlockers = useCallback(async () => {
    try {
      const data = await getJson<BlockersResponse>('/api/compliance-engine/claims/blockers');
      setBlockers(data);
    } catch {
      setBlockers(null); // non-critical advisory panel
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
    void loadClaims();
    void loadBlockers();
  }, [loadSnapshot, loadClaims, loadBlockers]);

  const generate = async () => {
    setGenerating(true);
    setActionError(null);
    setGenResult(null);
    try {
      const result = await postJson<GenerateResult>('/api/billing/claims/generate', {
        periodStart,
        periodEnd,
      });
      setGenResult(result);
      await loadClaims();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Claim generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const validateClaim = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await postJson(`/api/billing/claims/${id}/validate`, {});
      await loadClaims();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Validation failed (claim has high-risk lines)');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await postJson(`/api/billing/claims/${id}/status`, { status });
      await loadClaims();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setBusyId(null);
    }
  };

  const download837 = async (claim: ClaimRow) => {
    setBusyId(claim.id);
    setActionError(null);
    try {
      await downloadFile(
        `/api/billing/claims/${claim.id}/837`,
        `claim-${claim.controlNumber ?? claim.id}.837.txt`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '837 download failed');
    } finally {
      setBusyId(null);
    }
  };

  const kpis: KpiTile[] = snapshot
    ? [
        { label: 'Claim-ready (7d)', value: snapshot.counts.verifiedVisitsLast7d.toLocaleString(), hint: 'status=verified', tone: 'success' },
        { label: 'Claim-ready (30d)', value: snapshot.counts.verifiedVisitsLast30d.toLocaleString() },
        { label: 'Flagged (7d)', value: snapshot.counts.flaggedVisitsLast7d.toLocaleString(), tone: 'warning', hint: 'not claim-ready' },
        { label: 'Claims generated', value: claims.length.toLocaleString(), tone: 'accent', hint: 'this agency' },
      ]
    : [
        { label: 'Claim-ready (7d)', value: ', ', tone: 'success' },
        { label: 'Claim-ready (30d)', value: ', ' },
        { label: 'Flagged (7d)', value: ', ', tone: 'warning' },
        { label: 'Claims generated', value: claims.length.toLocaleString(), tone: 'accent' },
      ];

  return (
    <ComplianceModuleLayout
      title="Claim Matching & Generation"
      tagline="Generate Medicaid claims from GPS-verified visits, validate each against its authorization, score denial risk, and export the 837P. Direct clearinghouse transmission needs your trading-partner credentials."
      status="live"
      kpis={kpis}
      dataSources={[
        'EVV visits (status = verified) → claim lines',
        'authorizations table (units + service code + date window)',
        'clients (Medicaid id) + caregivers (NPI)',
        'X12 837P (005010X222A1) export',
      ]}
      nextSteps={[
        'Load your fee schedule to populate claim charge amounts',
        'Complete the agency billing profile (NPI, tax id, address) for a clean 837',
        'Connect a clearinghouse for automated 837 transmission',
      ]}
      related={[
        { label: 'Authorizations (CRUD)', to: '/admin/authorizations' },
        { label: 'Visit Review', to: '/admin/review' },
        { label: 'Payroll Reconciliation', to: '/admin/compliance-engine/payroll' },
      ]}
    >
      {/* Generate */}
      <div style={sectionCard}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          Generate claims
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0.4rem 0 0.9rem' }}>
          Assemble verified visits in a service period into draft claims, grouped by client and payer.
          Visits already on a claim are skipped automatically.
        </p>
        <div style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', fontWeight: 700, gap: 4 }}>
            From
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem', fontWeight: 700, gap: 4 }}>
            To
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={inputStyle} />
          </label>
          <button type="button" disabled={generating} onClick={() => void generate()} style={{ ...primaryButtonStyle, opacity: generating ? 0.55 : 1 }}>
            {generating ? 'Generating…' : 'Generate claims'}
          </button>
        </div>

        {genResult ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.9rem' }}>
            Generated <strong style={{ color: 'var(--color-text)' }}>{genResult.generated}</strong> claim(s).{' '}
            {genResult.unbillable.length > 0 ? (
              <span>
                {genResult.unbillable.length} visit(s) could not be billed, most commonly missing an
                active authorization.
              </span>
            ) : (
              <span>Every eligible visit was billable.</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Readiness blockers, the actionable list behind the flagged/pending KPIs */}
      {blockers && blockers.counts.total > 0 ? (
        <div style={sectionCard}>
          <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
            Readiness blockers
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0.4rem 0 0.9rem' }}>
            {blockers.counts.total} visit{blockers.counts.total === 1 ? '' : 's'} can&apos;t be billed yet
            {' '}({blockers.counts.open} not clocked out · {blockers.counts.flagged} flagged · {blockers.counts.pending} pending).
            Clear these before your next claim run.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem', minWidth: 520 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Reason</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Client</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Caregiver</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Clock-in</th>
                  <th style={{ padding: '0.4rem 0.6rem' }}>Fix</th>
                </tr>
              </thead>
              <tbody>
                {blockers.blockers.map((b) => {
                  const m = BLOCKER_META[b.reason];
                  return (
                    <tr key={b.visitId} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.5rem 0.6rem' }}>
                        <span style={{ background: m.bg, color: m.fg, borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {m.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: 'var(--color-text)' }}>{b.clientName}</td>
                      <td style={{ padding: '0.5rem 0.6rem', color: 'var(--color-text-muted)' }}>{b.caregiverName}</td>
                      <td style={{ padding: '0.5rem 0.6rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {b.clockInTime ? new Date(b.clockInTime).toLocaleDateString() : ', '}
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem' }}>
                        <Link to={m.to} style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
                          Resolve →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {blockers.truncated ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', marginTop: '0.6rem' }}>
              Showing the oldest {blockers.blockers.length}. Clear these, then refresh to see more.
            </p>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 10,
            color: 'var(--color-danger)',
            fontSize: '0.9rem',
            fontWeight: 700,
            marginTop: '1rem',
            padding: '0.75rem 1rem',
          }}
        >
          {actionError}
        </div>
      ) : null}

      {/* Claims list */}
      <div style={{ ...sectionCard, marginTop: '1rem' }}>
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>Claims</h3>
          <button type="button" disabled={claimsLoading} onClick={() => void loadClaims()} style={ghostButtonStyle}>
            {claimsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {claims.length === 0 ? (
          <ComplianceEmptyQueue
            title="No claims yet"
            body="Generate claims for a service period above. Each claim line is backed by one GPS-verified visit."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem', width: '100%' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  {['Control #', 'Payer', 'Period', 'Lines', 'Units', 'Risk', 'Status', 'Actions'].map((h) => (
                    <th key={h} scope="col" style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 700, padding: '0.5rem 0.6rem' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => {
                  const tone = riskTone(c.denialRisk);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ fontFamily: 'monospace', padding: '0.5rem 0.6rem' }}>{c.controlNumber ?? c.id.slice(0, 8)}</td>
                      <td style={{ padding: '0.5rem 0.6rem' }}>{c.payerId}</td>
                      <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap' }}>{c.periodStart} → {c.periodEnd}</td>
                      <td style={{ padding: '0.5rem 0.6rem' }}>{c.lineCount}</td>
                      <td style={{ padding: '0.5rem 0.6rem' }}>{c.totalUnits}</td>
                      <td style={{ padding: '0.5rem 0.6rem' }}>
                        <span style={{ backgroundColor: tone.bg, borderRadius: 999, color: tone.fg, fontSize: '0.72rem', fontWeight: 800, padding: '0.15rem 0.55rem', textTransform: 'capitalize' }}>
                          {c.denialRisk}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', textTransform: 'capitalize' }}>{c.status}</td>
                      <td style={{ padding: '0.5rem 0.6rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {(c.status === 'draft' || c.status === 'rejected' || c.status === 'denied') ? (
                            <button type="button" disabled={busyId === c.id} onClick={() => void validateClaim(c.id)} style={ghostButtonStyle}>
                              Validate
                            </button>
                          ) : null}
                          {c.status === 'ready' ? (
                            <button type="button" disabled={busyId === c.id} onClick={() => void setStatus(c.id, 'submitted')} style={ghostButtonStyle}>
                              Mark submitted
                            </button>
                          ) : null}
                          <button type="button" disabled={busyId === c.id} onClick={() => void download837(c)} style={ghostButtonStyle}>
                            837
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error ? (
        <div role="alert" style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
          Readiness snapshot unavailable: {error}
        </div>
      ) : null}

      {snapshot ? (
        <div style={{ ...sectionCard, marginTop: '1rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Snapshot as of <strong style={{ color: 'var(--color-text)' }}>{snapshot.asOf}</strong>. Sandata
            submission window: <strong>{snapshot.policy.sandataSubmissionWindowDays} days</strong> from visit
            date, verified visits should be submitted within this window for first-pass acceptance.
          </p>
        </div>
      ) : null}
    </ComplianceModuleLayout>
  );
}
