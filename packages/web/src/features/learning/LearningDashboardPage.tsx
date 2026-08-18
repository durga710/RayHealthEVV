import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';
import { EnrollCaregiverModal } from './EnrollCaregiverModal.js';
import { InsightsPanel } from './InsightsPanel.js';
import { AICopilotPanel } from './AICopilotPanel.js';
import { useAuth } from '../../lib/AuthContext.js';

interface LearningAgencyRollup {
  totalCaregivers: number;
  totalEnrollments: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  expired: number;
  complianceRate: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function LearningDashboardPage() {
  const [rollup, setRollup] = useState<LearningAgencyRollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const { user } = useAuth();
  const userRole = user?.role as 'admin' | 'coordinator' | 'caregiver' | 'family' | undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<LearningAgencyRollup>>('/api/learning/rollup');
        if (cancelled) return;
        if (response.success && response.data) {
          setRollup(response.data);
        } else {
          setError(response.error ?? 'Failed to load dashboard');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const compliancePercent = rollup ? Math.round(rollup.complianceRate * 100) : 0;
  const complianceColor =
    compliancePercent >= 95 ? 'var(--color-primary-dark)' :
    compliancePercent >= 80 ? 'var(--color-accent-dark)' :
    'var(--color-danger)';

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Learning Hub</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Caregiver training compliance, at-a-glance and per-person.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setEnrollOpen(true)} style={primaryActionStyle}>
            + Enroll caregivers
          </button>
          <Link to="/admin/learning/analytics" style={linkButtonStyle}>Analytics →</Link>
          <Link to="/admin/learning/courses" style={linkButtonStyle}>Course catalog →</Link>
        </div>
      </header>

      {loading && <p>Loading dashboard…</p>}
      {error && (
        <div style={errorBoxStyle}>
          <strong>Could not load dashboard.</strong> {error}
        </div>
      )}

      {rollup && (
        <>
          {/* AI-flavored compliance signals, prioritized actionable insights */}
          <InsightsPanel refreshKey={refreshTick} />

          {/* Top KPI row */}
          <div style={{ ...kpiGridStyle, marginTop: '2rem' }}>
            <KpiCard label="Active caregivers" value={rollup.totalCaregivers} />
            <KpiCard label="Total enrollments" value={rollup.totalEnrollments} />
            <KpiCard
              label="Agency compliance"
              value={`${compliancePercent}%`}
              accent={complianceColor}
            />
          </div>

          {/* Status breakdown */}
          <section style={{ marginTop: '2rem' }}>
            <h3 style={sectionHeadingStyle}>Enrollments by status</h3>
            <div style={statusGridStyle}>
              <StatusCard label="Completed" value={rollup.completed} color="var(--color-primary-dark)" />
              <StatusCard label="In progress" value={rollup.inProgress} color="var(--color-primary)" />
              <StatusCard label="Not started" value={rollup.notStarted} color="var(--color-text-subtle)" />
              <StatusCard label="Overdue" value={rollup.overdue} color="var(--color-accent-dark)" />
              <StatusCard label="Expired" value={rollup.expired} color="var(--color-danger)" />
            </div>
          </section>

          {/* Compliance bar */}
          <section style={{ marginTop: '2rem' }}>
            <h3 style={sectionHeadingStyle}>Compliance breakdown</h3>
            <ComplianceBar rollup={rollup} />
          </section>

          {rollup.overdue + rollup.expired > 0 && (
            <div style={alertBoxStyle}>
              <strong>{rollup.overdue + rollup.expired} enrollment{rollup.overdue + rollup.expired === 1 ? '' : 's'} need attention.</strong>{' '}
              {rollup.overdue > 0 && `${rollup.overdue} overdue`}{rollup.overdue > 0 && rollup.expired > 0 && ', '}{rollup.expired > 0 && `${rollup.expired} expired`}.
              {' '}Open per-caregiver detail from the Staff page.
            </div>
          )}
        </>
      )}

      <AICopilotPanel userRole={userRole} />

      <EnrollCaregiverModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onSuccess={() => setRefreshTick((n) => n + 1)}
      />
    </div>
  );
}

// ---------- Subcomponents ----------

interface KpiCardProps {
  label: string;
  value: number | string;
  accent?: string;
}

function KpiCard({ label, value, accent }: KpiCardProps) {
  return (
    <div style={kpiCardStyle}>
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 500, color: accent ?? 'var(--color-primary-dark)' }}>{value}</div>
    </div>
  );
}

interface StatusCardProps {
  label: string;
  value: number;
  color: string;
}

function StatusCard({ label, value, color }: StatusCardProps) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

interface ComplianceBarProps {
  rollup: LearningAgencyRollup;
}

function ComplianceBar({ rollup }: ComplianceBarProps) {
  const total = rollup.totalEnrollments || 1;
  const segments = [
    { label: 'Completed', value: rollup.completed, color: 'var(--color-primary-dark)' },
    { label: 'In progress', value: rollup.inProgress, color: 'var(--color-primary)' },
    { label: 'Not started', value: rollup.notStarted, color: 'var(--color-text-subtle)' },
    { label: 'Overdue', value: rollup.overdue, color: 'var(--color-accent-dark)' },
    { label: 'Expired', value: rollup.expired, color: 'var(--color-danger-text)' }
  ];

  return (
    <>
      <div style={{ display: 'flex', height: '32px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              width: `${(seg.value / total) * 100}%`,
              backgroundColor: seg.color
            }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
        {segments.map((seg) => (
          <span key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: seg.color, display: 'inline-block' }} />
            {seg.label} <strong>{seg.value}</strong>
          </span>
        ))}
      </div>
    </>
  );
}

// ---------- Styles ----------

const kpiGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '1rem',
  marginBottom: '0.5rem',
};

const statusGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '1rem',
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  padding: '1rem 1.25rem',
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1rem',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
};

const linkButtonStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: 'var(--color-primary)',
  fontSize: '0.9rem',
  border: '1px solid var(--color-primary)',
  padding: '0.4rem 0.85rem',
  borderRadius: '6px',
};

const primaryActionStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-surface)',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontWeight: 500,
};

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: 'var(--color-danger-bg)',
  color: 'var(--color-danger-text)',
  borderRadius: '6px',
  marginBottom: '1rem',
};

const alertBoxStyle: React.CSSProperties = {
  marginTop: '2rem',
  padding: '0.85rem 1rem',
  backgroundColor: 'var(--color-warning-bg)',
  color: 'var(--color-accent-dark)',
  borderRadius: '6px',
  borderLeft: '4px solid var(--color-accent-dark)',
};
