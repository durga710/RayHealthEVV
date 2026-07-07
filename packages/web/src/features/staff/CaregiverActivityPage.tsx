import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';
import { EmptyState, ErrorRetry, LoadingSkeleton } from '../../components/state/index.js';
import { Icon } from '../../components/index.js';

// ── Types ───────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  hireDate: string | null;
  status: string;
  hasNpi: boolean;
}
type VisitStatus = 'pending' | 'verified' | 'flagged';
interface Visit {
  id: string;
  clientName: string | null;
  serviceCode?: string;
  clockInTime: string;
  clockOutTime?: string;
  status: VisitStatus;
  flagReason: string | null;
}
interface Credential {
  id: string;
  credentialType: string;
  status: string;
  expiresAt: string;
}
interface Compliance {
  compliant: boolean;
  expiringSoon: Credential[];
  expired: Credential[];
  missing: string[];
}

const TEAL = '#107480';
const SERVICE_LABELS: Record<string, string> = {
  T1019: 'Personal Care', S5125: 'Attendant Care', T1004: 'Home Health Aide', T1021: 'HHA Visit',
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function durationMs(v: Visit): number | null {
  if (!v.clockOutTime) return null;
  const ms = new Date(v.clockOutTime).getTime() - new Date(v.clockInTime).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}
function fmtHours(ms: number): string {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ', ';
}
function fmtTime(iso?: string): string {
  if (!iso) return ', ';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ', ';
}
function statusColor(s: VisitStatus, inProgress: boolean): string {
  if (inProgress) return TEAL;
  return s === 'verified' ? '#059669' : s === 'flagged' ? '#BE123C' : '#64748B';
}

function StatusBadge({ status, inProgress }: { status: VisitStatus; inProgress: boolean }) {
  const color = statusColor(status, inProgress);
  const label = inProgress ? 'In progress' : status;
  return (
    <span style={{
      display: 'inline-block', padding: '0.15em 0.6em', borderRadius: 999, fontSize: '0.75rem',
      fontWeight: 700, background: `${color}18`, color, textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.1rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#94A3B8' }}>{label}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color: accent ?? '#0F172A', marginTop: 4, lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export function CaregiverActivityPage() {
  const { caregiverId = '' } = useParams<{ caregiverId: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | VisitStatus>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const id = encodeURIComponent(caregiverId);
    Promise.all([
      getJson<Profile>(`/api/staff/caregivers/${id}`),
      getJson<{ visits: Visit[] }>(`/api/staff/caregivers/${id}/visits`),
      getJson<{ credentials: Credential[]; compliance: Compliance }>(`/api/staff/caregivers/${id}/credentials`).catch(() => null),
    ])
      .then(([p, v, c]) => {
        setProfile(p);
        setVisits([...v.visits].sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime()));
        if (c) { setCredentials(c.credentials); setCompliance(c.compliance); }
      })
      .catch((e: Error) => setError(e.message || 'Failed to load caregiver'))
      .finally(() => setLoading(false));
  }, [caregiverId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const weekStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); })();
    let allMs = 0, weekMs = 0, completed = 0, verified = 0, flagged = 0;
    for (const v of visits) {
      if (v.status === 'verified') verified++;
      if (v.status === 'flagged') flagged++;
      const ms = durationMs(v);
      if (ms == null) continue;
      completed++; allMs += ms;
      if (new Date(v.clockInTime).getTime() >= weekStart) weekMs += ms;
    }
    return { allMs, weekMs, completed, verified, flagged, total: visits.length };
  }, [visits]);

  // 8-week hours bar chart
  const weekBars = useMemo(() => {
    const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() - base.getDay());
    const buckets = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(base); start.setDate(base.getDate() - (7 - i) * 7);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      return { start, end, label: start.toLocaleDateString([], { month: 'numeric', day: 'numeric' }), ms: 0 };
    });
    for (const v of visits) {
      const ms = durationMs(v);
      if (ms == null) continue;
      const t = new Date(v.clockInTime).getTime();
      const b = buckets.find((bk) => t >= bk.start.getTime() && t < bk.end.getTime());
      if (b) b.ms += ms;
    }
    const max = Math.max(1, ...buckets.map((b) => b.ms));
    return { buckets, max };
  }, [visits]);

  const filteredVisits = useMemo(
    () => (filter === 'all' ? visits : visits.filter((v) => v.status === filter)),
    [visits, filter],
  );

  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() || profile.email : '';
  const initials = name ? name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div>
      <Link to="/admin/staff" style={{ color: TEAL, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>← Staff</Link>

      {loading ? (
        <div style={{ marginTop: '1rem' }}><LoadingSkeleton rows={6} /></div>
      ) : error ? (
        <div style={{ marginTop: '1rem' }}><ErrorRetry message={error} onRetry={load} /></div>
      ) : profile ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Profile header */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1.1rem 1.25rem', flexWrap: 'wrap' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${TEAL}14`, color: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{name}</h1>
                <span style={{ display: 'inline-block', padding: '0.12em 0.6em', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', background: profile.status === 'active' ? '#05966918' : '#64748B18', color: profile.status === 'active' ? '#059669' : '#64748B' }}>{profile.status}</span>
              </div>
              <div style={{ color: '#64748B', fontSize: '0.88rem', marginTop: 4, display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Icon name="mail" size={15} />{profile.email}</span>
                {profile.phone ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Icon name="phone" size={15} />{profile.phone}</span> : null}
                {profile.hireDate ? <span>Hired {fmtDate(profile.hireDate)}</span> : null}
                <span>NPI {profile.hasNpi ? 'on file' : 'missing'}</span>
              </div>
            </div>
            {compliance ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', background: compliance.compliant ? '#05966914' : '#BE123C14', color: compliance.compliant ? '#059669' : '#BE123C' }}>
                <Icon name={compliance.compliant ? 'shield-check' : 'alert-triangle'} size={16} />
                {compliance.compliant ? 'Compliant' : 'Action needed'}
              </div>
            ) : null}
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.9rem' }}>
            <StatTile label="Total visits" value={String(stats.total)} sub={`${stats.completed} completed`} />
            <StatTile label="Hours (all-time)" value={stats.allMs > 0 ? fmtHours(stats.allMs) : '0m'} accent={TEAL} />
            <StatTile label="Hours this week" value={stats.weekMs > 0 ? fmtHours(stats.weekMs) : '0m'} accent={TEAL} />
            <StatTile label="Verified" value={String(stats.verified)} accent="#059669" />
            <StatTile label="Flagged" value={String(stats.flagged)} accent={stats.flagged > 0 ? '#BE123C' : '#0F172A'} sub={stats.flagged > 0 ? 'needs review' : 'all clean'} />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* 8-week hours */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.8rem' }}>Hours · last 8 weeks</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 96 }}>
                {weekBars.buckets.map((b, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div title={fmtHours(b.ms)} style={{ width: '100%', height: `${Math.round((b.ms / weekBars.max) * 78)}px`, minHeight: b.ms > 0 ? 4 : 2, background: b.ms > 0 ? TEAL : '#E2E8F0', borderRadius: 4, transition: 'height 0.3s' }} />
                    <div style={{ fontSize: '0.62rem', color: '#94A3B8' }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Quality bar */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.8rem' }}>Visit quality</div>
              {stats.verified + stats.flagged > 0 ? (
                <>
                  <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: '#F1F5F9' }}>
                    <div style={{ width: `${(stats.verified / (stats.verified + stats.flagged)) * 100}%`, background: '#059669' }} />
                    <div style={{ width: `${(stats.flagged / (stats.verified + stats.flagged)) * 100}%`, background: '#BE123C' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '0.82rem' }}>
                    <span style={{ color: '#059669', fontWeight: 700 }}>● {stats.verified} verified</span>
                    <span style={{ color: '#BE123C', fontWeight: 700 }}>● {stats.flagged} flagged</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 8 }}>
                    {Math.round((stats.verified / (stats.verified + stats.flagged)) * 100)}% of resolved visits verified clean
                  </div>
                </>
              ) : (
                <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>No completed visits yet.</div>
              )}
            </div>
          </div>

          {/* Visit history */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem', flexWrap: 'wrap', gap: '0.6rem' }}>
              <h2 className="section-title" style={{ margin: 0 }}>Visit history</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'verified', 'flagged'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} style={{ textTransform: 'capitalize' }}>{f}</button>
                ))}
              </div>
            </div>
            {filteredVisits.length === 0 ? (
              <EmptyState title="No visits" body={filter === 'all' ? 'This caregiver has no recorded visits yet.' : `No ${filter} visits.`} />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Client</th><th>Clock in</th><th>Clock out</th><th>Duration</th><th>Service</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredVisits.map((v) => {
                      const ms = durationMs(v);
                      const inProgress = !v.clockOutTime;
                      const isOpen = expanded === v.id;
                      return [
                        <tr key={v.id} onClick={() => v.status === 'flagged' && setExpanded(isOpen ? null : v.id)} style={{ cursor: v.status === 'flagged' ? 'pointer' : 'default' }}>
                          <td>{fmtDate(v.clockInTime)}</td>
                          <td>{v.clientName ?? ', '}</td>
                          <td>{fmtTime(v.clockInTime)}</td>
                          <td>{inProgress ? ', ' : fmtTime(v.clockOutTime)}</td>
                          <td>{ms != null ? fmtHours(ms) : ', '}</td>
                          <td>{v.serviceCode ? SERVICE_LABELS[v.serviceCode] ?? v.serviceCode : ', '}</td>
                          <td><StatusBadge status={v.status} inProgress={inProgress} />{v.status === 'flagged' ? <span style={{ marginLeft: 6, color: '#BE123C', fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span> : null}</td>
                        </tr>,
                        isOpen ? (
                          <tr key={`${v.id}-r`}>
                            <td colSpan={7} style={{ background: '#FFF7ED', borderLeft: '3px solid #d97706' }}>
                              <strong style={{ color: '#92400e' }}>Flag reason: </strong>
                              <span style={{ color: '#92400e' }}>{v.flagReason ?? 'No detailed reason recorded.'}</span>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Credentials & compliance */}
          {compliance ? (
            <div>
              <h2 className="section-title" style={{ marginBottom: '0.7rem' }}>Credentials & compliance</h2>
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.1rem' }}>
                {compliance.missing.length > 0 ? (
                  <div style={{ marginBottom: '0.8rem', color: '#BE123C', fontSize: '0.85rem', fontWeight: 600 }}>
                    Missing required: {compliance.missing.join(', ')}
                  </div>
                ) : null}
                {credentials.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>No credentials on file.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.7rem' }}>
                    {credentials.map((c) => {
                      const expired = compliance.expired.some((e) => e.id === c.id);
                      const soon = compliance.expiringSoon.some((e) => e.id === c.id);
                      const col = expired ? '#BE123C' : soon ? '#d97706' : '#059669';
                      return (
                        <div key={c.id} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.7rem 0.8rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>{c.credentialType.replace(/-/g, ' ')}</div>
                          <div style={{ fontSize: '0.78rem', color: col, fontWeight: 600, marginTop: 3 }}>
                            {expired ? 'Expired' : soon ? 'Expiring soon' : 'Valid'} · {fmtDate(c.expiresAt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
