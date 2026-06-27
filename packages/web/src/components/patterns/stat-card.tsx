import * as React from 'react';
import { type LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps extends React.ComponentProps<'div'> {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Secondary line under the value (e.g. "vs. last week"). */
  hint?: React.ReactNode;
  /** Percentage/point delta. Positive renders success, negative destructive. */
  delta?: number;
  /** When true, a positive delta is bad (e.g. missed visits) and renders destructive. */
  invertDelta?: boolean;
}

/**
 * KPI / metric tile for dashboards and analytics panels. Consolidates the
 * KpiCard / StatusCard / MetricCard variants previously reinvented per page.
 */
function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  invertDelta = false,
  className,
  ...props
}: StatCardProps) {
  const hasDelta = typeof delta === 'number';
  const positive = hasDelta && delta! >= 0;
  const good = invertDelta ? !positive : positive;
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      data-slot="stat-card"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-2">
        {/* div, not p: `value` may be a block element (e.g. a loading Skeleton),
            which is invalid inside <p> and triggers a hydration error. */}
        <div className="font-display text-3xl font-bold tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        {hasDelta ? (
          <span
            className={cn(
              'mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
              good
                ? 'bg-success-subtle text-success-subtle-foreground'
                : 'bg-destructive-subtle text-destructive-subtle-foreground',
            )}
          >
            <DeltaIcon className="size-3.5" aria-hidden />
            {Math.abs(delta!)}%
          </span>
        ) : null}
      </div>

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };
