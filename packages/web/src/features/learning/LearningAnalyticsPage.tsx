import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getJson } from '../../lib/api-client.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';

interface CourseAnalyticsRow {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  required: boolean;
  cadence: CourseCadence;
  totalEnrollments: number;
  completedCount: number;
  overdueCount: number;
  expiredCount: number;
  pendingCount: number;
  completionRate: number;
  averageDaysToComplete: number | null;
}

interface CourseAnalyticsEnvelope {
  generatedAt: string;
  rows: CourseAnalyticsRow[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function LearningAnalyticsPage(): ReactElement {
  const [envelope, setEnvelope] = useState<CourseAnalyticsEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CourseAnalyticsEnvelope>>('/api/learning/analytics');
        if (cancelled) return;
        if (response.success && response.data) {
          setEnvelope(response.data);
        } else {
          setError(response.error ?? 'Failed to load analytics');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = envelope?.rows ?? [];
  const totalCourses = rows.length;
  const totalEnrollments = rows.reduce((sum, r) => sum + r.totalEnrollments, 0);
  const totalCompleted = rows.reduce((sum, r) => sum + r.completedCount, 0);
  const totalActionNeeded = rows.reduce(
    (sum, r) => sum + r.overdueCount + r.expiredCount + r.pendingCount,
    0,
  );
  const overallCompletion = totalEnrollments > 0
    ? Math.round((totalCompleted / totalEnrollments) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title="Course analytics"
        description="Per-course completion rates and bottleneck signal. Sorted by completion rate ascending — worst-performing courses first."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/learning">
              <ArrowLeft className="size-4" aria-hidden />
              Learning Hub
            </Link>
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <strong>Could not load analytics.</strong> {error}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading analytics…</p>}

      {!loading && envelope && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Courses"
              value={totalCourses}
              icon={<BookOpen className="size-5 text-primary" aria-hidden />}
            />
            <MetricCard
              label="Total enrollments"
              value={totalEnrollments}
              icon={<BarChart3 className="size-5 text-primary" aria-hidden />}
            />
            <MetricCard
              label="Overall completion"
              value={`${overallCompletion}%`}
              icon={<CheckCircle2 className="size-5 text-primary" aria-hidden />}
            />
            <MetricCard
              label="Action needed"
              value={totalActionNeeded}
              icon={<AlertTriangle className="size-5 text-primary" aria-hidden />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5 text-primary" aria-hidden />
                Course breakdown
              </CardTitle>
              <CardDescription>
                {totalCourses} {totalCourses === 1 ? 'course' : 'courses'} in the catalog
                {envelope.generatedAt
                  ? ` · generated ${new Date(envelope.generatedAt).toLocaleString()}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <EmptyState message="No courses in the catalog yet. Seed the PA-required baseline, then come back when caregivers have enrollments." />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Enrolled</TableHead>
                        <TableHead>Completion rate</TableHead>
                        <TableHead className="text-right">Avg. days to complete</TableHead>
                        <TableHead className="text-right">Action needed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.courseId}>
                          <TableCell>
                            <Link
                              to={`/admin/learning/courses/${row.courseId}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {row.courseTitle}
                            </Link>
                            {row.required && (
                              <Badge variant="warning" className="ml-2 align-middle">
                                Required
                              </Badge>
                            )}
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {row.courseCode} · {cadenceLabel(row.cadence)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{row.totalEnrollments}</TableCell>
                          <TableCell>
                            <CompletionBar
                              rate={row.completionRate}
                              completed={row.completedCount}
                              total={row.totalEnrollments}
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {row.averageDaysToComplete === null
                              ? <span className="text-muted-foreground">—</span>
                              : `${Math.round(row.averageDaysToComplete)} d`}
                          </TableCell>
                          <TableCell className="text-right">
                            <ActionCount
                              overdue={row.overdueCount}
                              expired={row.expiredCount}
                              pending={row.pendingCount}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactElement;
}

function MetricCard({ label, value, icon }: MetricCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

interface CompletionBarProps {
  rate: number;
  completed: number;
  total: number;
}

function CompletionBar({ rate, completed, total }: CompletionBarProps): ReactElement {
  const percent = Math.round(rate * 100);
  const fillClass =
    percent >= 95
      ? 'bg-emerald-500'
      : percent >= 80
        ? 'bg-amber-500'
        : percent >= 50
          ? 'bg-orange-500'
          : 'bg-destructive';
  const textClass =
    percent >= 95
      ? 'text-emerald-600'
      : percent >= 80
        ? 'text-amber-600'
        : percent >= 50
          ? 'text-orange-600'
          : 'text-destructive';
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-full min-w-[120px] flex-1 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className={`min-w-[60px] text-right text-sm font-medium ${textClass}`}>
        {percent}% ({completed}/{total})
      </span>
    </div>
  );
}

interface ActionCountProps {
  overdue: number;
  expired: number;
  pending: number;
}

function ActionCount({ overdue, expired, pending }: ActionCountProps): ReactElement {
  const total = overdue + expired + pending;
  if (total === 0) {
    return <Badge variant="success">All clear</Badge>;
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {expired > 0 && <Badge variant="destructive">{expired} expired</Badge>}
      {overdue > 0 && <Badge variant="warning">{overdue} overdue</Badge>}
      {pending > 0 && <Badge variant="secondary">{pending} pending</Badge>}
    </div>
  );
}

function cadenceLabel(cadence: CourseCadence): string {
  switch (cadence) {
    case 'one_time': return 'One-time';
    case 'annual': return 'Annual';
    case 'biennial': return 'Biennial';
    case 'certification': return 'Certification';
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <BookOpen className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
