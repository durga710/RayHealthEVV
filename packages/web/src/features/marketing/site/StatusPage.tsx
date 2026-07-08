import React, { useEffect, useRef, useState } from 'react';
import { SiteLayout } from './SiteLayout.js';

/**
 * Public status page, migrated onto the shared SiteLayout (teal/orange
 * brand) to match the rest of the marketing site. Replaces the old
 * MarketingShell version.
 *
 * Polls three real backend probes, liveness, DB, audit pipeline, and
 * renders a card per service plus a roll-up header. Refresh interval is
 * 30s. All three endpoints are unauthenticated and sit behind their own
 * rate limiter (60 / 15-min per IP).
 */

const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api';

const POLL_MS = 30_000;

type ProbeStatus = 'ok' | 'stale' | 'empty' | 'down' | 'error';

interface HealthResp {
  status: string;
  uptimeSeconds?: number;
  version?: string;
  timestamp?: string;
}

interface DbResp {
  status: string;
  latencyMs?: number;
  timestamp?: string;
  error?: string;
}

interface AuditResp {
  status: string;
  lastEventAt?: string | null;
  ageSeconds?: number | null;
  timestamp?: string;
  error?: string;
}

interface ServiceCard {
  name: string;
  status: ProbeStatus;
  metricLabel: string;
  metricValue: string;
  detail?: string;
  lastChecked: number;
}

interface PageState {
  cards: ServiceCard[];
  loading: boolean;
  /** True only when every single probe failed, distinguishes "API down"
   *  from "API up but DB stale". */
  allFailed: boolean;
  lastChecked: number | null;
}

/** Try to parse a JSON response. If the server returned 503 with a body,
 *  we still want the body (it carries `status: 'down'`). Only treat a
 *  network-level failure as "error". */
async function fetchJsonSafe<T>(url: string): Promise<{ ok: boolean; body: T | null }> {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    let body: T | null = null;
    try {
      body = (await r.json()) as T;
    } catch {
      body = null;
    }
    return { ok: r.ok, body };
  } catch {
    return { ok: false, body: null };
  }
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-';
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3_600);
  const m = Math.floor((seconds % 3_600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.round(seconds)}s`;
}

function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return '-';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

function toCard(name: string, body: unknown, networkOk: boolean): ServiceCard {
  const now = Date.now();
  if (!networkOk && !body) {
    return {
      name,
      status: 'error',
      metricLabel: 'Status',
      metricValue: 'unreachable',
      detail: 'Network error',
      lastChecked: now,
    };
  }
  const obj = (body ?? {}) as Record<string, unknown>;
  const rawStatus = typeof obj.status === 'string' ? obj.status : 'error';

  if (name === 'API') {
    const r = obj as unknown as HealthResp;
    return {
      name,
      status: rawStatus === 'ok' ? 'ok' : 'error',
      metricLabel: 'Uptime',
      metricValue: r.uptimeSeconds != null ? formatUptime(r.uptimeSeconds) : '-',
      detail: r.version ? `v${r.version}` : undefined,
      lastChecked: now,
    };
  }
  if (name === 'Database') {
    const r = obj as unknown as DbResp;
    const status: ProbeStatus = rawStatus === 'ok' ? 'ok' : 'down';
    return {
      name,
      status,
      metricLabel: 'Latency',
      metricValue: r.latencyMs != null ? `${r.latencyMs} ms` : '-',
      detail: status === 'down' ? 'Connection failed' : undefined,
      lastChecked: now,
    };
  }
  // Audit
  const r = obj as unknown as AuditResp;
  let status: ProbeStatus;
  if (rawStatus === 'ok') status = 'ok';
  else if (rawStatus === 'stale') status = 'stale';
  else if (rawStatus === 'empty') status = 'empty';
  else status = 'down';
  return {
    name,
    status,
    metricLabel: 'Last event',
    metricValue:
      r.ageSeconds != null
        ? formatAge(r.ageSeconds)
        : status === 'empty'
          ? 'No events yet'
          : '-',
    detail: status === 'down' ? 'Probe failed' : undefined,
    lastChecked: now,
  };
}

const PILL_COLORS: Record<ProbeStatus, { bg: string; fg: string; label: string }> = {
  ok: { bg: '#dcfce7', fg: '#166534', label: 'OK' },
  stale: { bg: '#fef9c3', fg: '#854d0e', label: 'STALE' },
  empty: { bg: '#fef9c3', fg: '#854d0e', label: 'EMPTY' },
  down: { bg: '#fee2e2', fg: '#991b1b', label: 'DOWN' },
  error: { bg: '#fee2e2', fg: '#991b1b', label: 'ERROR' },
};

function overallStatus(cards: ServiceCard[]): ProbeStatus {
  if (cards.length === 0) return 'error';
  if (cards.some((c) => c.status === 'down' || c.status === 'error')) return 'down';
  if (cards.some((c) => c.status === 'stale' || c.status === 'empty')) return 'stale';
  return 'ok';
}

const OVERALL_TITLE: Record<ProbeStatus, string> = {
  ok: 'All systems operational.',
  stale: 'Degraded, investigating.',
  empty: 'Degraded, investigating.',
  down: 'Outage, investigating.',
  error: 'Unable to reach status API.',
};

export function StatusPage() {
  const [state, setState] = useState<PageState>({
    cards: [],
    loading: true,
    allFailed: false,
    lastChecked: null,
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      const [health, db, audit] = await Promise.all([
        fetchJsonSafe(`${API_BASE}/health`),
        fetchJsonSafe(`${API_BASE}/health/db`),
        fetchJsonSafe(`${API_BASE}/health/audit`),
      ]);
      if (cancelled) return;
      const cards: ServiceCard[] = [
        toCard('API', health.body, health.ok),
        toCard('Database', db.body, db.ok),
        toCard('Audit pipeline', audit.body, audit.ok),
      ];
      // Every probe reachable means we got *some* body back; if the network
      // was dead for all three we render the friendly all-failed banner.
      const allFailed = cards.every((c) => c.status === 'error');
      setState({ cards, loading: false, allFailed, lastChecked: Date.now() });
    };

    probe();
    timer.current = setInterval(probe, POLL_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const overall = overallStatus(state.cards);

  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">System status</span>
          <h1 className="mk-h1">{OVERALL_TITLE[overall]}</h1>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'var(--paper)',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--line)',
                boxShadow: '0 18px 44px -28px rgba(10,30,20,.4)',
              }}
            >
              <strong style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>
                Overall
              </strong>
              <StatusPill status={overall} />
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.85rem',
                  color: 'var(--mut)',
                }}
              >
                {state.lastChecked
                  ? `Last checked ${new Date(state.lastChecked).toLocaleTimeString()}`
                  : state.loading
                    ? 'Checking…'
                    : '-'}
              </span>
            </div>

            {state.loading && state.cards.length === 0 && (
              <div
                style={{
                  backgroundColor: 'var(--paper)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  textAlign: 'center',
                  color: 'var(--mut)',
                }}
              >
                Loading status…
              </div>
            )}

            {state.allFailed && !state.loading && (
              <div
                role="alert"
                style={{
                  backgroundColor: '#fef2f2',
                  color: '#991b1b',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                }}
              >
                We can't reach the status API right now. This page will keep retrying every
                30&nbsp;seconds.
              </div>
            )}

            {state.cards.map((card) => (
              <ServiceCardView key={card.name} card={card} />
            ))}

            <p
              style={{
                textAlign: 'center',
                marginTop: '0.5rem',
                color: 'var(--mut)',
                fontSize: '0.8rem',
              }}
            >
              Probes run every {POLL_MS / 1000}s against {API_BASE}/health, /health/db, /health/audit.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function StatusPill({ status }: { status: ProbeStatus }) {
  const { bg, fg, label } = PILL_COLORS[status];
  return (
    <span
      style={{
        backgroundColor: bg,
        color: fg,
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        letterSpacing: '1px',
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function ServiceCardView({ card }: { card: ServiceCard }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--paper)',
        padding: '1.25rem',
        borderRadius: '12px',
        border: '1px solid var(--line)',
        boxShadow: '0 18px 44px -28px rgba(10,30,20,.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.25rem',
          }}
        >
          <strong style={{ color: 'var(--ink)' }}>{card.name}</strong>
          <StatusPill status={card.status} />
        </div>
        {card.detail && (
          <div style={{ fontSize: '0.8rem', color: 'var(--mut)' }}>{card.detail}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--ink)',
          }}
        >
          {card.metricValue}
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--mut)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {card.metricLabel}
        </div>
      </div>
    </div>
  );
}
