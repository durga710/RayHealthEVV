import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApiResource } from '../../lib/use-api-resource.js';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard } from '@/components/patterns/stat-card';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

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

const QUERY_KEY = ['learning', 'analytics'];

export function LearningAnalyticsPage(): ReactElement {
  const { data, isLoading, isError, refetch } = useApiResource<ApiResponse<CourseAnalyticsEnvelope>>(
    QUERY_KEY,
    '/api/learning/analytics',
  );

  const envelope = data?.success ? data.data ?? null : null;
  const errorMessage = isError
    ? 'Failed to load analytics'
    : data && !data.success
      ? data.error ?? 'Failed to load analytics'
      : null;

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

  const statValue = (value: string | number): ReactElement | string | number =>
    isLoading ? <Skeleton className="h-8 w-16" /> : value;

  const columns: DataTableColumn<CourseAnalyticsRow>[] = [
    {
      id: 'course',
      header: 'Course',
      sortValue: (r) => r.courseTitle.toLowerCase(),
      cell: (r) => (
        <div>
          <Link
            to={`/admin/learning/courses/${r.courseId}`}
            className="font-medium text-foreground hover:underline"
          >
            {r.courseTitle}
          </Link>
          {r.required && (
            <Badge variant="warning" className="ml-2 align-middle">
              Required
            </Badge>
          )}
          <div className="mt-0.5 text-xs text-muted-foreground">
            {r.courseCode} · {cadenceLabel(r.cadence)}
          </div>
        </div>
      ),
    },
    {
      id: 'enrolled',
      header: 'Enrolled',
      align: 'right',
      sortValue: (r) => r.totalEnrollments,
      cell: (r) => <span className="tabular-nums">{r.totalEnrollments}</span>,
    },
    {
      id: 'completion',
      header: 'Completion rate',
      sortValue: (r) => r.completionRate,
      cell: (r) => (
        <CompletionBar
          rate={r.completionRate}
          completed={r.completedCount}
          total={r.totalEnrollments}
        />
      ),
    },
    {
      id: 'avgDays',
      header: 'Avg. days to complete',
      align: 'right',
      sortValue: (r) => r.averageDaysToComplete ?? Number.POSITIVE_INFINITY,
      cell: (r) => (
        <span className="text-muted-foreground tabular-nums">
          {r.averageDaysToComplete === null ? '—' : `${Math.round(r.averageDaysToComplete)} d`}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Action needed',
      align: 'right',
      sortValue: (r) => r.overdueCount + r.expiredCount + r.pendingCount,
      cell: (r) => (
        <ActionCount
          overdue={r.overdueCount}
          expired={r.expiredCount}
          pending={r.pendingCount}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
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

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load analytics</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {errorMessage}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Courses" value={statValue(totalCourses)} icon={BookOpen} />
            <StatCard
              label="Total enrollments"
              value={statValue(totalEnrollments)}
              icon={BarChart3}
            />
            <StatCard
              label="Overall completion"
              value={statValue(`${overallCompletion}%`)}
              icon={CheckCircle2}
            />
            <StatCard
              label="Action needed"
              value={statValue(totalActionNeeded)}
              icon={AlertTriangle}
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
                {envelope?.generatedAt
                  ? ` · generated ${new Date(envelope.generatedAt).toLocaleString()}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(r) => r.courseId}
                isLoading={isLoading}
                pageSize={10}
                empty={{
                  icon: BookOpen,
                  title: 'No courses in the catalog yet',
                  description:
                    'Seed the PA-required baseline, then come back when caregivers have enrollments.',
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

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
