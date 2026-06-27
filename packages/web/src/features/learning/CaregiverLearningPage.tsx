import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GraduationCap, BookOpen, ArrowLeft, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { postJson, HttpError } from '../../lib/api-client.js';
import { useApiResource } from '../../lib/use-api-resource.js';
import { EnrollCaregiverModal } from './EnrollCaregiverModal.js';
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
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';
type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';

interface LearningCourse {
  id: string;
  agencyId: string | null;
  code: string;
  title: string;
  description: string;
  cadence: CourseCadence;
  expiresAfterDays: number | null;
  required: boolean;
  durationMinutes: number;
}

interface CourseEnrollment {
  id: string;
  agencyId: string;
  caregiverId: string;
  courseId: string;
  assignedAt: string;
  dueAt: string | null;
  lastCompletedAt: string | null;
  expiresAt: string | null;
  status: EnrollmentStatus;
}

interface EnrollmentRow {
  enrollment: CourseEnrollment;
  course: LearningCourse;
}

interface CaregiverLearningProgress {
  caregiverId: string;
  enrollments: EnrollmentRow[];
  isCompliant: boolean;
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

function statusVariant(
  status: EnrollmentStatus,
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'warning';
  if (status === 'overdue' || status === 'expired') return 'destructive';
  return 'secondary';
}

export function CaregiverLearningPage() {
  const params = useParams<{ id: string }>();
  const caregiverId = params.id ?? '';
  const queryClient = useQueryClient();
  const queryKey = ['caregiver-learning', caregiverId];

  const [enrollOpen, setEnrollOpen] = useState(false);

  const { data: envelope, isLoading, isError, refetch } = useApiResource<
    ApiResponse<CaregiverLearningProgress>
  >(queryKey, `/api/learning/caregivers/${caregiverId}`, { enabled: Boolean(caregiverId) });

  const progress = envelope?.success ? envelope.data ?? null : null;
  const loadFailed = isError || (envelope !== undefined && !envelope.success);
  const errorMessage =
    envelope && !envelope.success ? envelope.error : undefined;

  const completeMutation = useMutation({
    mutationFn: (enrollment: CourseEnrollment) =>
      postJson('/api/learning/complete', {
        enrollmentId: enrollment.id,
        caregiverId: enrollment.caregiverId,
        courseId: enrollment.courseId,
        completedAt: new Date().toISOString(),
        score: null,
        notes: 'Marked complete by coordinator from caregiver detail page',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Completion recorded.');
    },
    onError: (error) => {
      toast.error(
        error instanceof HttpError ? error.message : 'Failed to record completion.',
      );
    },
  });

  if (!caregiverId) {
    return <p className="text-sm text-muted-foreground">Missing caregiver id.</p>;
  }

  const columns: DataTableColumn<EnrollmentRow>[] = [
    {
      id: 'course',
      header: 'Course',
      sortValue: ({ course }) => course.title.toLowerCase(),
      cell: ({ course }) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{course.title}</span>
            {course.required && <Badge variant="outline">Required</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">{course.code}</span>
        </div>
      ),
    },
    {
      id: 'assigned',
      header: 'Assigned',
      sortValue: ({ enrollment }) => enrollment.assignedAt,
      cell: ({ enrollment }) => (
        <span className="text-muted-foreground">{formatDate(enrollment.assignedAt)}</span>
      ),
    },
    {
      id: 'due',
      header: 'Due',
      cell: ({ enrollment }) => (
        <span className="text-muted-foreground">
          {enrollment.dueAt ? formatDate(enrollment.dueAt) : '—'}
        </span>
      ),
    },
    {
      id: 'completed',
      header: 'Completed',
      cell: ({ enrollment }) => (
        <span className="text-muted-foreground">
          {enrollment.lastCompletedAt ? formatDate(enrollment.lastCompletedAt) : '—'}
        </span>
      ),
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: ({ enrollment }) => (
        <span className="text-muted-foreground">
          {enrollment.expiresAt ? formatDate(enrollment.expiresAt) : '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: ({ enrollment }) => enrollment.status,
      cell: ({ enrollment }) => (
        <Badge variant={statusVariant(enrollment.status)}>
          {STATUS_LABEL[enrollment.status]}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: ({ enrollment }) => {
        if (enrollment.status === 'completed') return null;
        const pending =
          completeMutation.isPending && completeMutation.variables?.id === enrollment.id;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => completeMutation.mutate(enrollment)}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? 'Recording…' : 'Mark complete'}
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Caregiver Learning"
        description={`Training progress for caregiver ${caregiverId}.`}
        actions={
          <>
            <Button onClick={() => setEnrollOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Assign course
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/learning">
                <ArrowLeft className="size-4" aria-hidden />
                Learning Hub
              </Link>
            </Button>
          </>
        }
      />

      {loadFailed && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Could not load progress.</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {errorMessage ?? 'Something went wrong while loading training progress.'}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" aria-hidden />
              Course Enrollments
            </CardTitle>
            <CardDescription>
              {progress
                ? `${progress.enrollments.length} ${
                    progress.enrollments.length === 1 ? 'enrollment' : 'enrollments'
                  }`
                : 'Training records for this caregiver'}
            </CardDescription>
          </div>
          {progress && (
            <Badge variant={progress.isCompliant ? 'success' : 'destructive'}>
              {progress.isCompliant ? 'Compliant' : 'Non-compliant'}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {loadFailed ? null : (
            <DataTable
              columns={columns}
              rows={progress?.enrollments ?? []}
              rowKey={({ enrollment }) => enrollment.id}
              isLoading={isLoading}
              empty={{
                icon: BookOpen,
                title: 'No courses assigned yet',
                description: 'Use Assign course to add training.',
              }}
            />
          )}
        </CardContent>
      </Card>

      <EnrollCaregiverModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onSuccess={() => void refetch()}
        lockedCaregiverId={caregiverId}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
