import type { ReactNode } from 'react';

interface TrustBadgeProps {
  icon: ReactNode;
  label: string;
  detail?: string;
  tone?: 'primary' | 'accent';
}

/**
 * A single trust-mechanism callout for marketing/trust-center surfaces , 
 * pairs a claim ("The log cannot be edited") with room for the mechanism
 * that backs it, per Agent 00/02's "claim → mechanism → where to see it"
 * pattern. Not wired into any page yet (no marketing screen was in this
 * agent's scope); ready for the Trust Center / landing follow-up work.
 */
export function TrustBadge({ icon, label, detail, tone = 'primary' }: TrustBadgeProps) {
  return (
    <div className="trust-badge" data-tone={tone}>
      <span className="trust-badge__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="trust-badge__text">
        <span className="trust-badge__label">{label}</span>
        {detail && <span className="trust-badge__detail">{detail}</span>}
      </div>
    </div>
  );
}
