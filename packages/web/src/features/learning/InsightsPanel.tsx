import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle, Clock, Info, CheckCircle2 } from 'lucide-react';
import { getJson } from '../../lib/api-client.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  warning: { variant: 'warning', Icon: Clock, iconClass: 'text-amber-600' },
  info: { variant: 'secondary', Icon: Info, iconClass: 'text-primary' },
};

export function InsightsPanel({ refreshKey = 0 }: InsightsPanelProps): ReactElement | null {
  const [envelope, setEnvelope] = useState<LearningInsightsEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await getJson<ApiResponse<LearningInsightsEnvelope>>('/api/learning/insights');
        if (cancelled) return;
        if (response.success && response.data) {
          setEnvelope(response.data);
        } else {
          setError(response.error ?? 'Failed to load insights');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Compliance signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading insights…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Compliance signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <strong>Could not load insights.</strong> {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!envelope || envelope.insights.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Compliance signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="m-0">
                <strong>All clear.</strong> No actionable training items right now.
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Compliance signals refresh on every page load. Last checked {formatTime(envelope?.generatedAt ?? new Date().toISOString())}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
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
          {envelope.insights.length} signal{envelope.insights.length === 1 ? '' : 's'} need attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {envelope.insights.map((insight) => (
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
