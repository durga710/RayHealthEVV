import type { ReactNode } from 'react';
import { Icon } from './Icon.js';

interface CommandPanelProps {
  /** Small uppercase label, e.g. "AI briefing". */
  eyebrow: ReactNode;
  /** Decorative glyph next to the eyebrow — purely visual, hidden from AT. */
  icon?: ReactNode;
  /** Right-aligned control, usually a call-to-action button. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * The dark "command panel" surface used for the AI briefing card and similar
 * callouts that need to stand apart from the light page background. Uses the
 * shared `--gradient-panel-dark` token instead of a component-local gradient
 * hex pair.
 */
export function CommandPanel({ eyebrow, icon = <Icon name="sparkles" size={16} />, action, children }: CommandPanelProps) {
  return (
    <section className="command-panel">
      <div className="command-panel__header">
        <div className="command-panel__eyebrow">
          <span aria-hidden="true" className="command-panel__icon">
            {icon}
          </span>
          <span>{eyebrow}</span>
        </div>
        {action}
      </div>
      <div className="command-panel__body">{children}</div>
    </section>
  );
}
