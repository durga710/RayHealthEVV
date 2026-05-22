import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';

type InsightSeverity = 'critical' | 'warning' | 'info';

type InsightKind =
  | 'due_in_7_days'
  | 'expired_recently'
  | 'orientation_incomplete'
  | 'stalled_enrollment'
  | 'certification_expiring_soon';

interface InsightCaregiver {
  caregiverId: string;
  firstName: string;
  lastName: string;
  context: string;
}

interface LearningInsight {
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  summary: string;
  actionLabel: string;
  caregivers: InsightCaregiver[];
  totalCount: number;
}

interface LearningInsightsEnvelope {
  generatedAt: string;
  insights: LearningInsight[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface InsightsPanelProps {
  /** Bumped by parent when a mutation lands so insights refresh. */
  refreshKey?: number;
}

const SEVERITY_STYLES: Record<InsightSeverity, { bg: string; border: string; fg: string; icon: string }> = {
  critical: {
    bg: '#FCEBEB',
    border: '#E24B4A',
    fg: '#791F1F',
    icon: '⚠',
  },
  warning: {
    bg: '#FAEEDA',
    border: '#BA7517',
    fg: '#633806',
    icon: '◷',
  },
  info: {
    bg: '#E6F1FB',
    border: '#185FA5',
    fg: '#0C447C',
    icon: 'ⓘ',
  },
};

export function InsightsPanel({ refreshKey = 0 }: InsightsPanelProps): ReactElement | null {
  const [envelope, setEnvelope] = useState<LearningInsightsEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await getJson<ApiResponse<LearningInsightsEnvelope>>('/api/learning/insights');
        if (cancelled) return;
        if (response.success && response.data) {
          setEnvelope(response.data);
        } else {
          setError(response.error ?? 'Failed to load insights');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <section style={{ marginTop: '2rem' }}>
        <SectionHeader />
        <p style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>Loading insights…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ marginTop: '2rem' }}>
        <SectionHeader />
        <div style={errorBoxStyle}>
          <strong>Could not load insights.</strong> {error}
        </div>
      </section>
    );
  }

  if (!envelope || envelope.insights.length === 0) {
    return (
      <section style={{ marginTop: '2rem' }}>
        <SectionHeader />
        <div style={emptyStyle}>
          <p style={{ margin: 0 }}>
            <strong>All clear.</strong> No actionable training items right now.
          </p>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.85rem' }}>
            Compliance signals refresh on every page load. Last checked {formatTime(envelope?.generatedAt ?? new Date().toISOString())}.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginTop: '2rem' }}>
      <SectionHeader subtitle={`${envelope.insights.length} signal${envelope.insights.length === 1 ? '' : 's'} need attention`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {envelope.insights.map((insight) => (
          <InsightCard key={insight.kind} insight={insight} />
        ))}
      </div>
    </section>
  );
}

// ---------- Subcomponents ----------

function SectionHeader({ subtitle }: { subtitle?: string }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.85rem' }}>
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-muted, #475569)' }}>
        Compliance signals
      </h3>
      {subtitle && (
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted, #94a3b8)' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: LearningInsight }): ReactElement {
  const styles = SEVERITY_STYLES[insight.severity];

  return (
    <article
      style={{
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        borderLeft: `4px solid ${styles.border}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span aria-hidden style={{ color: styles.fg, fontSize: '1.1rem' }}>{styles.icon}</span>
        <h4 style={{ margin: 0, fontSize: '1rem', color: styles.fg, fontWeight: 500 }}>
          {insight.title}
        </h4>
      </header>
      <p style={{ margin: '0 0 0.75rem', color: styles.fg, fontSize: '0.9rem', lineHeight: 1.5 }}>
        {insight.summary}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {insight.caregivers.map((cg) => (
          <Link
            key={cg.caregiverId}
            to={`/admin/learning/caregivers/${cg.caregiverId}`}
            style={chipStyle(styles.fg)}
            title={cg.context}
          >
            {cg.firstName} {cg.lastName} <span style={{ opacity: 0.65, marginLeft: '0.35rem' }}>· {cg.context}</span>
          </Link>
        ))}
        {insight.totalCount > insight.caregivers.length && (
          <span style={{ ...chipStyle(styles.fg), opacity: 0.7, cursor: 'default' }}>
            +{insight.totalCount - insight.caregivers.length} more
          </span>
        )}
      </div>
    </article>
  );
}

// ---------- Helpers ----------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function chipStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.6rem',
    backgroundColor: '#ffffff',
    color,
    fontSize: '0.8rem',
    borderRadius: '12px',
    textDecoration: 'none',
    border: `1px solid ${color}33`,
  };
}

const errorBoxStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '6px',
};

const emptyStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  backgroundColor: '#E1F5EE',
  borderRadius: '8px',
  borderLeft: '4px solid #10A4A4',
  color: '#085041',
};
