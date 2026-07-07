import type { ReactNode } from 'react';

export type TimelineTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface TimelineItem {
  id: string;
  /** Pre-formatted display string (e.g. "2:04 PM" or "Jul 3, 2026"). Formatting
   *  is the caller's job so this component makes no locale/timezone assumptions. */
  timestamp: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: TimelineTone;
}

interface TimelineProps {
  items: TimelineItem[];
  emptyLabel?: string;
}

/**
 * A vertical event trail, built for audit-trail / audit-defense style views
 * where every row is "who did what, when" and the chain of custody matters.
 * Purely presentational: it renders whatever items it's given in order, it
 * does not fetch, sort, or paginate.
 */
export function Timeline({ items, emptyLabel = 'No events yet.' }: TimelineProps) {
  if (items.length === 0) {
    return <p className="timeline__empty">{emptyLabel}</p>;
  }

  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={item.id} className="timeline__row" data-tone={item.tone ?? 'neutral'}>
          <span className="timeline__rail" aria-hidden="true">
            <span className="timeline__marker" />
            <span className="timeline__line" />
          </span>
          <div className="timeline__content">
            <span className="timeline__timestamp">{item.timestamp}</span>
            <span className="timeline__title">{item.title}</span>
            {item.description && <p className="timeline__description">{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
