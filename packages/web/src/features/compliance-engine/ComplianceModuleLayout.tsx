import React from 'react';
import { Link } from 'react-router-dom';

export type KpiTone = 'neutral' | 'warning' | 'success' | 'accent';

export interface KpiTile {
  label: string;
  value: string;
  hint?: string;
  tone?: KpiTone;
}

export type ModuleStatus = 'scaffold' | 'beta' | 'live';

export interface ModuleRelatedLink {
  label: string;
  to: string;
}

interface ComplianceModuleLayoutProps {
  title: string;
  tagline: string;
  status?: ModuleStatus;
  kpis: KpiTile[];
  dataSources?: string[];
  nextSteps?: string[];
  related?: ModuleRelatedLink[];
  children?: React.ReactNode;
}

const KPI_TONE_COLOR: Record<KpiTone, string> = {
  neutral: 'var(--color-text)',
  warning: 'var(--color-warning)',
  success: 'var(--color-success)',
  accent: 'var(--color-accent)',
};

/**
 * Status chip palette. Scaffold = primary-tinted (informational, work-in-
 * progress); Beta = accent-tinted (the Deep Red brand signal that this is
 * regulator-facing and demands attention); Live = success-tinted (verified
 * and shipping).
 */
const STATUS_STYLE: Record<ModuleStatus, { bg: string; fg: string; label: string }> = {
  scaffold: { bg: 'var(--color-primary-bg)', fg: 'var(--color-primary-dark)', label: 'Scaffold' },
  beta:     { bg: 'var(--color-accent-bg)',  fg: 'var(--color-accent)',      label: 'Beta' },
  live:     { bg: 'var(--color-success-bg)', fg: 'var(--color-success)',     label: 'Live' },
};

const eyebrowStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  margin: 0,
  textTransform: 'uppercase',
};

const titleStyle: React.CSSProperties = {
  color: 'var(--color-text)',
  fontSize: '1.75rem',
  fontWeight: 800,
  margin: '0.25rem 0 0.5rem',
};

const taglineStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  lineHeight: 1.5,
  margin: 0,
  maxWidth: 680,
};

const sectionCard: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '1rem',
};

const sectionTitle: React.CSSProperties = {
  color: 'var(--color-text)',
  fontSize: '0.85rem',
  fontWeight: 800,
  margin: 0,
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  listStyle: 'none',
  margin: '0.5rem 0 0',
  padding: 0,
};

const listItem: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.85rem',
};

/**
 * Shared scaffold for Compliance Engine module pages.
 * Dense operations-console layout: eyebrow + title + tagline, KPI grid,
 * main content (queue/table), and side notes (data sources, next steps, related links).
 */
export function ComplianceModuleLayout({
  title,
  tagline,
  status = 'scaffold',
  kpis,
  dataSources,
  nextSteps,
  related,
  children,
}: ComplianceModuleLayoutProps) {
  const statusStyle = STATUS_STYLE[status];
  return (
    <div>
      <header
        style={{
          alignItems: 'flex-start',
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <p style={eyebrowStyle}>Compliance Engine</p>
          <h2 style={titleStyle}>{title}</h2>
          <p style={taglineStyle}>{tagline}</p>
        </div>
        <span
          style={{
            alignItems: 'center',
            backgroundColor: statusStyle.bg,
            borderRadius: 999,
            color: statusStyle.fg,
            display: 'inline-flex',
            flexShrink: 0,
            fontSize: '0.75rem',
            fontWeight: 800,
            gap: '0.4rem',
            letterSpacing: '0.04em',
            padding: '0.4rem 0.75rem',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              backgroundColor: statusStyle.fg,
              borderRadius: 999,
              height: 6,
              width: 6,
            }}
          />
          {statusStyle.label}
        </span>
      </header>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          marginBottom: '1.5rem',
        }}
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '0.875rem 1rem',
            }}
          >
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              {kpi.label}
            </p>
            <p
              style={{
                color: KPI_TONE_COLOR[kpi.tone ?? 'neutral'],
                fontSize: '1.5rem',
                fontWeight: 800,
                margin: '0.25rem 0 0',
              }}
            >
              {kpi.value}
            </p>
            {kpi.hint ? (
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.75rem',
                  margin: '0.15rem 0 0',
                }}
              >
                {kpi.hint}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          alignItems: 'flex-start',
          display: 'grid',
          gap: '1.25rem',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)',
        }}
      >
        <div>{children}</div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {dataSources && dataSources.length > 0 ? (
            <section style={sectionCard}>
              <h3 style={sectionTitle}>Data sources</h3>
              <ul style={listStyle}>
                {dataSources.map((source) => (
                  <li key={source} style={listItem}>
                    · {source}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {nextSteps && nextSteps.length > 0 ? (
            <section style={sectionCard}>
              <h3 style={sectionTitle}>Next steps</h3>
              <ul style={listStyle}>
                {nextSteps.map((step) => (
                  <li key={step} style={listItem}>
                    · {step}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {related && related.length > 0 ? (
            <section style={sectionCard}>
              <h3 style={sectionTitle}>Related</h3>
              <ul style={listStyle}>
                {related.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      style={{
                        color: 'var(--color-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      → {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

interface ComplianceEmptyQueueProps {
  title: string;
  body: string;
}

/** Dashed empty-state used inside a module's main queue/table area. */
export function ComplianceEmptyQueue({ title, body }: ComplianceEmptyQueueProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px dashed var(--color-border)',
        borderRadius: 12,
        padding: '2rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <h3 style={{ color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
        {title}
      </h3>
      <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '0.5rem 0 0' }}>
        {body}
      </p>
    </div>
  );
}
