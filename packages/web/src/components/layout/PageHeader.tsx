import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderEyebrow {
  label: string;
  to: string;
}

interface PageHeaderProps {
  /** Optional back-link shown above the title, e.g. "← Command Center". */
  eyebrow?: PageHeaderEyebrow;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned controls, usually a refresh button or primary action. */
  actions?: ReactNode;
}

/**
 * The title row every admin/portal page opens with: an optional back-link,
 * an <h1>, a muted subtitle, and right-aligned actions. Wraps gracefully on
 * narrow screens (the existing `.page-header` class already handles that).
 */
export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__title">
        {eyebrow && (
          <Link to={eyebrow.to} className="page-header__eyebrow">
            ← {eyebrow.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
