import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type MetricCardTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** Small caption under the value, e.g. "visits today". */
  sub?: ReactNode;
  /** Category color for the top border accent. Defaults to brand primary. */
  tone?: MetricCardTone;
  /** Forces the danger tone regardless of `tone`, for "this needs eyes now" cards. */
  alert?: boolean;
  /** Optional destination, renders the card as a click-through link. */
  to?: string;
}

/**
 * A single KPI tile: label, big number, optional caption, and a tone-colored
 * top border. This is the generalized form of the `Kpi` helper that used to
 * live inline in CommandCenterPage, every color comes from a CSS variable
 * via `data-tone`/`data-alert`, never a hardcoded hex.
 */
export function MetricCard({ label, value, sub, tone = 'primary', alert, to }: MetricCardProps) {
  const card = (
    <div className="metric-card" data-tone={tone} data-alert={alert ? 'true' : undefined}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      {sub && <div className="metric-card__sub">{sub}</div>}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="metric-card-link">
        {card}
      </Link>
    );
  }

  return card;
}
