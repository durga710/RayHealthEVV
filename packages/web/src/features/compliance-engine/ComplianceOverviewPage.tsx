import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../../lib/api-client.js';

interface EngineSummary {
  auditEventsLast30d: number;
  activeAuthorizations: number;
  openExceptions: number;
  activeMaCases: number;
  verifiedHoursLast7d: number;
  claimReadyLast7d: number;
  activeCredentials: number;
}

interface EngineSummaryResponse {
  agencyId: string;
  asOf: string;
  counts: EngineSummary;
}

type SummaryKey = keyof EngineSummary;

interface ModuleCard {
  title: string;
  blurb: string;
  status: 'scaffold' | 'beta' | 'live';
  to: string;
  kpiLabel: string;
  /** Static placeholder shown when no live summary is available. */
  fallbackValue: string;
  /** Key in the EngineSummary response that powers the live KPI. */
  summaryKey: SummaryKey;
  /** Optional formatter for the live value (default: locale string). */
  format?: (value: number) => string;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatHours(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

const MODULES: ModuleCard[] = [
  {
    title: 'Medicaid Workflow',
    blurb: 'CHC eligibility, prior auths, and PA Medicaid service mix readiness across 3 MCOs.',
    status: 'live',
    to: '/admin/compliance-engine/medicaid',
    kpiLabel: 'Active MA cases',
    fallbackValue: '-',
    summaryKey: 'activeMaCases',
  },
  {
    title: 'Audit Defense',
    blurb: 'Defensible CSV packets from audit_events + VMUR + Sandata, signed with a reproducible SHA-256 manifest, sized to PA’s 48-hour DHS SLA.',
    status: 'live',
    to: '/admin/compliance-engine/audit-defense',
    kpiLabel: 'Audit events (30d)',
    fallbackValue: '-',
    summaryKey: 'auditEventsLast30d',
  },
  {
    title: 'Payroll Reconciliation',
    blurb: 'Match EVV-verified hours to payroll inside PA’s 15-min grace window (FLSA de minimis).',
    status: 'live',
    to: '/admin/compliance-engine/payroll',
    kpiLabel: 'Verified hours (7d)',
    fallbackValue: '-',
    summaryKey: 'verifiedHoursLast7d',
    format: formatHours,
  },
  {
    title: 'Claim Matching',
    blurb: 'Pair billable claims to verified EVV visits; route to Sandata for PROMISe MMIS.',
    status: 'live',
    to: '/admin/compliance-engine/claims',
    kpiLabel: 'Claim-ready (7d)',
    fallbackValue: '-',
    summaryKey: 'claimReadyLast7d',
  },
  {
    title: 'Authorization Oversight',
    blurb: 'Drill-down list with live unit balance (EVV-consumed vs authorized), 14/30/90-day expiry lenses, and CHC quarterly review tracking per 55 Pa. Code Ch. 6000.',
    status: 'live',
    to: '/admin/compliance-engine/authorizations',
    kpiLabel: 'Active authorizations',
    fallbackValue: '-',
    summaryKey: 'activeAuthorizations',
  },
  {
    title: 'Exception Resolution',
    blurb: 'Unified open-exception queue with row-level drill-down + bulk acknowledge that writes one audit event per ack. Sized to PA’s 48-hour DHS SLA.',
    status: 'live',
    to: '/admin/compliance-engine/exceptions',
    kpiLabel: 'Open exceptions',
    fallbackValue: '-',
    summaryKey: 'openExceptions',
  },
  {
    title: 'Credentials & Background',
    blurb: 'PA PATCH + FBI + Child Abuse + CNA + HHA + RN supervision compliance.',
    status: 'live',
    to: '/admin/compliance-engine/credentials',
    kpiLabel: 'Active credentials',
    fallbackValue: '-',
    summaryKey: 'activeCredentials',
  },
];

export function ComplianceOverviewPage() {
  const [summary, setSummary] = useState<EngineSummaryResponse | null>(null);
  const [summaryUnavailable, setSummaryUnavailable] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await getJson<EngineSummaryResponse>(
          '/api/compliance-engine/summary',
        );
        if (mounted) {
          setSummary(data);
          setSummaryUnavailable(false);
          setSummaryError(null);
        }
      } catch (err) {
        if (!mounted) return;
        // 403 (coordinator without audit.read) and network failures both
        // fall back to the static placeholder view. Overview must stay useful.
        setSummary(null);
        setSummaryUnavailable(true);
        setSummaryError(err instanceof Error ? err.message : 'Summary unavailable');
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          Compliance Engine
        </p>
        <h2
          style={{
            color: 'var(--color-text)',
            fontSize: '1.75rem',
            fontWeight: 800,
            margin: '0.25rem 0 0.5rem',
          }}
        >
          Overview
        </h2>
        <p
          style={{
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 720,
          }}
        >
          Operational compliance across Medicaid workflow, audit defense, payroll, claims,
          authorizations, exceptions, and credentials. Every module reads from the existing EVV and
          audit trail, no PHI is created here.
        </p>
        {summary ? (
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
              margin: '0.75rem 0 0',
            }}
          >
            Live snapshot as of <strong style={{ color: 'var(--color-text)' }}>{summary.asOf}</strong>.
          </p>
        ) : null}
      </header>

      {summaryUnavailable ? (
        <div
          style={{
            alignItems: 'center',
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 12,
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
          }}
          role="status"
        >
          <span
            style={{
              backgroundColor: 'var(--color-warning)',
              borderRadius: 999,
              display: 'inline-block',
              height: 8,
              width: 8,
            }}
          />
          <p style={{ color: 'var(--color-warning)', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
            Live summary unavailable for this role, open a module below for its specific KPIs.
            PA regulatory spec at <code>docs/compliance/states/pennsylvania.md</code>.
            {summaryError ? <> ({summaryError})</> : null}
          </p>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}
      >
        {MODULES.map((module) => {
          const liveValue = summary
            ? (module.format ?? formatNumber)(summary.counts[module.summaryKey])
            : module.fallbackValue;
          return (
            <Link
              key={module.to}
              to={module.to}
              style={{ color: 'inherit', display: 'block', textDecoration: 'none' }}
            >
              <article
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  height: '100%',
                  padding: '1.25rem',
                }}
              >
                <header
                  style={{
                    alignItems: 'flex-start',
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'space-between',
                  }}
                >
                  <h3
                    style={{
                      color: 'var(--color-text)',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      margin: 0,
                    }}
                  >
                    {module.title}
                  </h3>
                  <span
                    style={{
                      backgroundColor:
                        module.status === 'live'
                          ? 'var(--color-success-bg)'
                          : module.status === 'beta'
                          ? 'var(--color-accent-bg)'
                          : 'var(--color-primary-bg)',
                      borderRadius: 999,
                      color:
                        module.status === 'live'
                          ? 'var(--color-success)'
                          : module.status === 'beta'
                          ? 'var(--color-accent)'
                          : 'var(--color-primary-dark)',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      padding: '0.25rem 0.5rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {module.status}
                  </span>
                </header>
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    flex: 1,
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {module.blurb}
                </p>
                <div
                  style={{
                    alignItems: 'baseline',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                  }}
                >
                  <div>
                    <p
                      style={{
                        color: 'var(--color-text-muted)',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        margin: 0,
                        textTransform: 'uppercase',
                      }}
                    >
                      {module.kpiLabel}
                    </p>
                    <p
                      style={{
                        color: 'var(--color-text)',
                        fontSize: '1.15rem',
                        fontWeight: 800,
                        margin: '0.1rem 0 0',
                      }}
                    >
                      {liveValue}
                    </p>
                  </div>
                  <span style={{ color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 800 }}>
                    Open &rarr;
                  </span>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
