import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, Clock, Info } from 'lucide-react';
import { useApiResource } from '../../lib/use-api-resource.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

type InsightSeverity = 'critical' | 'warning' | 'info';

type InsightKind =
  | 'due_in_7_days'
  | 'expired_recently'
  | 'orientation_incomplete'
  | 'stalled_enrollment'
  | 'certification_expiring_soon';

interface InsightCaregiver {
  caregiverId: string;
  firstName: string;
  lastName: string;
  context: string;
}

interface LearningInsight {
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  summary: string;
  actionLabel: string;
  caregivers: InsightCaregiver[];
  totalCount: number;
}

interface LearningInsightsEnvelope {
  generatedAt: string;
  insights: LearningInsight[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface InsightsPanelProps {
  /** Bumped by parent when a mutation lands so insights refresh. */
  refreshKey?: number;
}

type SeverityVariant = 'destructive' | 'warning' | 'secondary';

const SEVERITY_META: Record<
  InsightSeverity,
  { variant: SeverityVariant; Icon: typeof AlertTriangle; iconClass: string }
> = {
  critical: { variant: 'destructive', Icon: AlertTriangle, iconClass: 'text-destructive' },
  warning: { variant: 'warning', Icon: Clock, iconClass: 'text-warning' },
  info: { variant: 'secondary', Icon: Info, iconClass: 'text-primary' },
};

function PanelShell({ children }: { children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Compliance signals
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function InsightsPanel({ refreshKey = 0 }: InsightsPanelProps): ReactElement | null {
  const { data: envelope, isLoading, isError, refetch } = useApiResource<
    ApiResponse<LearningInsightsEnvelope>
  >(['learning-insights', refreshKey], '/api/learning/insights');

  if (isLoading) {
    return (
      <PanelShell>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={`insight-skeleton-${i}`} className="h-24 rounded-lg" />
          ))}
        </div>
      </PanelShell>
    );
  }

  const data = envelope?.success ? envelope.data ?? null : null;
  const loadFailed = isError || (envelope !== undefined && !envelope.success);
  const errorMessage =
    envelope && !envelope.success ? envelope.error : undefined;

  if (loadFailed) {
    return (
      <PanelShell>
        <Alert variant="destructive">
          <AlertTitle>Could not load insights.</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {errorMessage ?? 'Something went wrong while loading compliance signals.'}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </PanelShell>
    );
  }

  if (!data || data.insights.length === 0) {
    return (
      <PanelShell>
        <Alert variant="success">
          <AlertTitle>All clear.</AlertTitle>
          <AlertDescription>
            No actionable training items right now. Compliance signals refresh on every page load.
            Last checked {formatTime(data?.generatedAt ?? new Date().toISOString())}.
          </AlertDescription>
        </Alert>
      </PanelShell>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Compliance signals
        </CardTitle>
        <CardDescription>
          {data.insights.length} signal{data.insights.length === 1 ? '' : 's'} need attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {data.insights.map((insight) => (
            <InsightCard key={insight.kind} insight={insight} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Subcomponents ----------

function InsightCard({ insight }: { insight: LearningInsight }): ReactElement {
  const meta = SEVERITY_META[insight.severity];
  const { Icon } = meta;

  return (
    <article className="rounded-lg border border-border bg-muted/30 p-4">
      <header className="mb-2 flex items-center gap-2">
        <Icon className={`size-4 ${meta.iconClass}`} aria-hidden />
        <h4 className="m-0 text-sm font-medium text-foreground">{insight.title}</h4>
        <Badge variant={meta.variant} className="ml-auto capitalize">
          {insight.severity}
        </Badge>
      </header>
      <p className="mb-3 text-sm text-muted-foreground">{insight.summary}</p>

      <div className="flex flex-wrap items-center gap-2">
        {insight.caregivers.map((cg) => (
          <Button
            key={cg.caregiverId}
            asChild
            variant="outline"
            size="sm"
            title={cg.context}
          >
            <Link to={`/admin/learning/caregivers/${cg.caregiverId}`}>
              {cg.firstName} {cg.lastName}
              <span className="text-muted-foreground">· {cg.context}</span>
            </Link>
          </Button>
        ))}
        {insight.totalCount > insight.caregivers.length && (
          <Badge variant="secondary">
            +{insight.totalCount - insight.caregivers.length} more
          </Badge>
        )}
      </div>
    </article>
  );
}

// ---------- Helpers ----------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
