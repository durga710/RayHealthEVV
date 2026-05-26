import React, { useEffect, useState } from 'react';
import { getJson } from '../../lib/api-client.js';
import {
  ComplianceEmptyQueue,
  ComplianceModuleLayout,
  type KpiTile,
} from './ComplianceModuleLayout.js';

interface CredentialsOverviewResponse {
  agencyId: string;
  asOf: string;
  counts: {
    activeCredentials: number;
    pendingCredentials: number;
    expiredCredentials: number;
    expiringIn30d: number;
    expiringIn90d: number;
    recentlyExpired: number;
  };
  policy: {
    backgroundCheckRenewalYears: number;
    paComplianceCredentials: string[];
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const labelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-text)',
  fontSize: '0.95rem',
  padding: '0.55rem 0.75rem',
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

const sectionCard: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1.25rem',
};

/** Map machine credential codes to friendly display labels. */
const CREDENTIAL_DISPLAY: Record<string, string> = {
  'pa-patch': 'PA PATCH (State Police criminal history)',
  'fbi-fingerprint': 'FBI Fingerprint Check',
  'pa-child-abuse-clearance': 'PA Child Abuse Clearance',
  'pa-cna-registry': 'PA Nurse Aide Registry (CNA)',
  'pa-hha-training': 'PA HHA Training (75-hour)',
  'pa-rn-supervision': 'RN Supervision Compliance',
};

export function CredentialsPage() {
  const [asOf, setAsOf] = useState<string>(todayIso());
  const [snapshot, setSnapshot] = useState<CredentialsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (effectiveAsOf: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<CredentialsOverviewResponse>(
        `/api/compliance-engine/credentials/overview?asOf=${encodeURIComponent(effectiveAsOf)}`,
      );
      setSnapshot(data);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(todayIso());
  }, []);

  const handleRefresh = (event: React.FormEvent) => {
    event.preventDefault();
    void load(asOf);
  };

  const kpis: KpiTile[] = snapshot
    ? [
        {
          label: 'Active credentials',
          value: snapshot.counts.activeCredentials.toLocaleString(),
        },
        {
          label: 'Expiring 30d',
          value: snapshot.counts.expiringIn30d.toLocaleString(),
          tone: snapshot.counts.expiringIn30d > 0 ? 'warning' : 'neutral',
        },
        {
          label: 'Expiring 90d',
          value: snapshot.counts.expiringIn90d.toLocaleString(),
        },
        {
          label: 'Expired (active list)',
          value: snapshot.counts.expiredCredentials.toLocaleString(),
          tone: snapshot.counts.expiredCredentials > 0 ? 'warning' : 'neutral',
          hint: 'must be renewed',
        },
      ]
    : [
        { label: 'Active credentials', value: '—' },
        { label: 'Expiring 30d', value: '—', tone: 'warning' },
        { label: 'Expiring 90d', value: '—' },
        { label: 'Expired (active list)', value: '—', tone: 'warning', hint: 'must be renewed' },
      ];

  return (
    <ComplianceModuleLayout
      title="Credentials & Background"
      tagline="PA caregiver-credential compliance: PATCH + FBI + Child Abuse Clearance + CNA Registry + HHA Training + RN Supervision. Background checks renew on a 5-year cycle per 23 Pa.C.S. §6344."
      status="live"
      kpis={kpis}
      dataSources={[
        'caregiver_credentials (joined to caregivers for agency scope)',
        'PA spec-tracked credential types (see policy block)',
      ]}
      nextSteps={[
        'Drill-down per credential type → caregiver list with expiry dates',
        'Renewal reminders + assignment-block when a required cred is expired',
        'Disqualifying-offense workflow + audit-event emission on hire/decline',
      ]}
      related={[
        { label: 'Staff', to: '/admin/staff' },
        { label: 'Audit Defense', to: '/admin/compliance-engine/audit-defense' },
      ]}
    >
      <div style={sectionCard}>
        <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
          Refresh credential snapshot
        </h3>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            margin: '0.4rem 0 1rem',
          }}
        >
          Pick the &quot;as of&quot; date and refresh active / expiring / expired credentials.
        </p>
        <form
          onSubmit={handleRefresh}
          style={{
            alignItems: 'flex-end',
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={labelStyle}>As of</span>
            <input
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={loading || !asOf}
            style={{ ...primaryButtonStyle, opacity: loading || !asOf ? 0.55 : 1 }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </form>
      </div>

      {error ? (
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
          {error}
        </div>
      ) : null}

      {snapshot ? (
        <div style={{ ...sectionCard, marginTop: '1rem' }}>
          <h4 style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
            PA credential taxonomy
          </h4>
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: '0.35rem 0 0.75rem',
            }}
          >
            Tracked types (from <code>paComplianceCredentials</code>). Once
            <code> caregiver_credentials.credential_type</code> uses these codes, this list becomes
            a per-type breakdown.
          </p>
          <ul
            style={{
              display: 'grid',
              gap: '0.4rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {snapshot.policy.paComplianceCredentials.map((code) => (
              <li
                key={code}
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '0.55rem 0.75rem',
                }}
              >
                <code style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{code}</code>
                <br />
                {CREDENTIAL_DISPLAY[code] ?? code}
              </li>
            ))}
          </ul>
          <p
            style={{
              borderTop: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontSize: '0.8rem',
              margin: '1rem 0 0',
              paddingTop: '0.75rem',
            }}
          >
            Snapshot as of <strong style={{ color: 'var(--color-text)' }}>{snapshot.asOf}</strong>.
            Background-check renewal cycle:{' '}
            <strong>{snapshot.policy.backgroundCheckRenewalYears} years</strong> (23 Pa.C.S. §6344).
            Pending: <strong>{snapshot.counts.pendingCredentials.toLocaleString()}</strong> ·
            Recently expired (14d):{' '}
            <strong>{snapshot.counts.recentlyExpired.toLocaleString()}</strong>.
          </p>
        </div>
      ) : !loading && !error ? (
        <div style={{ marginTop: '1rem' }}>
          <ComplianceEmptyQueue
            title="No snapshot loaded"
            body="Pick a date and click Refresh to load the credentials compliance snapshot."
          />
        </div>
      ) : null}
    </ComplianceModuleLayout>
  );
}
