export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  /** Show a small solid dot before the label (useful for at-a-glance scanning in dense lists). */
  dot?: boolean;
}

/**
 * A small pill for status/severity labels ("Critical", "In progress",
 * "Completed"...). Built on the existing `.badge` classes so it always
 * matches whatever badge colors index.css defines, no component should
 * invent its own status-color map (several screens hand-rolled a `bg`/
 * `border`/`color` object per status; this replaces that pattern).
 */
export function StatusPill({ label, tone = 'neutral', dot = false }: StatusPillProps) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {label}
    </span>
  );
}
