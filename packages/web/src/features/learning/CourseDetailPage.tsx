import { type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmptyState } from '@/components/patterns/empty-state';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';
type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';

interface LearningCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: CourseCadence;
  required: boolean;
}

interface CourseEnrollment {
  id: string;
  caregiverId: string;
  assignedAt: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
  status: EnrollmentStatus;
}

interface CourseCaregiverRow {
  enrollment: CourseEnrollment;
  caregiver: { id: string; firstName: string; lastName: string; email: string };
  effectiveStatus: EnrollmentStatus;
}

interface CourseCaregiverEnvelope {
  course: LearningCourse;
  caregivers: CourseCaregiverRow[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
  expired: 'Expired',
};

const STATUS_ORDER: EnrollmentStatus[] = ['expired', 'overdue', 'in_progress', 'not_started', 'completed'];

type BadgeVariant = 'secondary' | 'warning' | 'success' | 'destructive';

const STATUS_VARIANT: Record<EnrollmentStatus, BadgeVariant> = {
  not_started: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'destructive',
  expired: 'destructive',
};

const CAREGIVER_COLUMNS: DataTableColumn<CourseCaregiverRow>[] = [
  {
    id: 'caregiver',
    header: 'Caregiver',
    cell: (row) => (
      <Link
        to={`/admin/learning/caregivers/${row.caregiver.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {row.caregiver.lastName}, {row.caregiver.firstName}
      </Link>
    ),
  },
  {
    id: 'email',
    header: 'Email',
    cell: (row) => <span className="text-muted-foreground">{row.caregiver.email}</span>,
  },
  {
    id: 'due',
    header: 'Due',
    cell: (row) => (
      <span className="text-muted-foreground">
        {row.enrollment.dueAt ? formatDate(row.enrollment.dueAt) : '—'}
      </span>
    ),
  },
  {
    id: 'completed',
    header: 'Completed',
    cell: (row) => (
      <span className="text-muted-foreground">
        {row.enrollment.lastCompletedAt ? formatDate(row.enrollment.lastCompletedAt) : '—'}
      </span>
    ),
  },
  {
    id: 'expires',
    header: 'Expires',
    cell: (row) => (
      <span className="text-muted-foreground">
        {row.enrollment.expiresAt ? formatDate(row.enrollment.expiresAt) : '—'}
      </span>
    ),
  },
];

export function CourseDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useApiResource<ApiResponse<CourseCaregiverEnvelope>>(
    ['learning', 'course', id ?? ''],
    `/api/learning/courses/${id}/caregivers`,
    { enabled: Boolean(id) },
  );

  const envelope = data?.success ? data.data ?? null : null;
  const errorMessage = isError
    ? 'Failed to load course'
    : data && !data.success
      ? data.error ?? 'Failed to load course'
      : null;

  const caregivers = envelope?.caregivers ?? [];

  // Group caregivers by status, sorted by STATUS_ORDER (worst first).
  const grouped: Partial<Record<EnrollmentStatus, CourseCaregiverRow[]>> = {};
  for (const row of caregivers) {
    const list = grouped[row.effectiveStatus] ?? [];
    list.push(row);
    grouped[row.effectiveStatus] = list;
  }

  const description = envelope?.course
    ? `${envelope.course.code} · ${envelope.course.required ? 'Required · ' : ''}${cadenceLabel(envelope.course.cadence)}`
    : 'Course enrollment and caregiver progress.';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={envelope?.course.title ?? 'Course detail'}
        description={description}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/learning/analytics">
              <ArrowLeft className="size-4" aria-hidden />
              Analytics
            </Link>
          </Button>
        }
      />

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load course</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {errorMessage}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {envelope?.course.description && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" aria-hidden />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {envelope.course.description}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden />
                Enrolled Caregivers
              </CardTitle>
              <CardDescription>
                {caregivers.length} {caregivers.length === 1 ? 'caregiver' : 'caregivers'} enrolled
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <DataTable
                  columns={CAREGIVER_COLUMNS}
                  rows={[]}
                  rowKey={(row) => row.enrollment.id}
                  isLoading
                />
              ) : caregivers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No caregivers enrolled"
                  description="No caregivers enrolled in this course yet."
                />
              ) : (
                STATUS_ORDER.map((status) => {
                  const rows = grouped[status];
                  if (!rows || rows.length === 0) return null;
                  return (
                    <div key={status} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {rows.length} caregiver{rows.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <DataTable
                        columns={CAREGIVER_COLUMNS}
                        rows={rows}
                        rowKey={(row) => row.enrollment.id}
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
