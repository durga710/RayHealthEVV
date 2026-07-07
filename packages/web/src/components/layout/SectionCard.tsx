import type { ReactNode } from 'react';

interface SectionCardProps {
  /** Uppercase eyebrow heading for the section, e.g. "Needs attention". */
  title: ReactNode;
  /** Optional control rendered next to the title (a link, a filter, etc). */
  action?: ReactNode;
  children: ReactNode;
  /**
   * When true, wraps the content in a bordered white surface. Leave false
   * (default) for sections whose children already carry their own card
   * styling (metric grids, attention lists), matches how Command Center's
   * sections are just a labeled grouping, not a nested card.
   */
  bordered?: boolean;
  className?: string;
}

/**
 * A titled grouping used to break a page into labeled zones ("Today",
 * "Compliance & readiness", "Quick actions"...). Renders a semantic
 * <section> with an <h2> eyebrow so screen readers get real landmarks
 * instead of a wall of unlabeled <div>s.
 */
export function SectionCard({ title, action, children, bordered = false, className }: SectionCardProps) {
  const classes = ['section-card', bordered ? 'section-card--bordered' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      <div className="section-card__header">
        <h2 className="section-eyebrow">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
