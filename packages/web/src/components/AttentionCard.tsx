import { Link } from 'react-router-dom';
import { StatusPill, type StatusTone } from './StatusPill.js';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

interface AttentionCardProps {
  severity: AttentionSeverity;
  title: string;
  detail: string;
  /** Route this item deep-links to (e.g. the exception queue, the readiness checklist). */
  to: string;
}

const TONE: Record<AttentionSeverity, StatusTone> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
};

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

/**
 * A single row in an "attention queue", the master list of things a coordinator
 * or owner needs to act on today. Every fear gets a queue (Agent 00 §5); this
 * is the shared row for that queue wherever it appears.
 */
export function AttentionCard({ severity, title, detail, to }: AttentionCardProps) {
  const tone = TONE[severity];
  return (
    <Link to={to} className="attention-card" data-tone={tone}>
      <span className="status-dot" data-tone={tone} aria-hidden="true" />
      <span className="attention-card__body">
        <span className="attention-card__title">{title}</span>
        <span className="attention-card__detail">{detail}</span>
      </span>
      <StatusPill tone={tone} label={SEVERITY_LABEL[severity]} />
      <span className="attention-card__arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
