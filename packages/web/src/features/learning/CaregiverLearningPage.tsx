import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GraduationCap, BookOpen, ArrowLeft, Plus } from 'lucide-react';
import { getJson, postJson } from '../../lib/api-client.js';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

interface CaregiverLearningProgress {
  caregiverId: string;
  enrollments: Array<{
    enrollment: CourseEnrollment;
    course: LearningCourse;
  }>;
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

  const [progress, setProgress] = useState<CaregiverLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJson<ApiResponse<CaregiverLearningProgress>>(
        `/api/learning/caregivers/${caregiverId}`,
      );
      if (response.success && response.data) {
        setProgress(response.data);
      } else {
        setError(response.error ?? 'Failed to load progress');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!caregiverId) return;
    void refresh();
    // refresh is a stable closure over set-state functions — eslint
    // doesn't have react-hooks/exhaustive-deps configured here so we leave
    // it out of the dep array; the function captures the current caregiverId
    // via outer scope.
  }, [caregiverId]);

  const recordCompletion = async (enrollment: CourseEnrollment): Promise<void> => {
    setCompletingId(enrollment.id);
    try {
      await postJson('/api/learning/complete', {
        enrollmentId: enrollment.id,
        caregiverId: enrollment.caregiverId,
        courseId: enrollment.courseId,
        completedAt: new Date().toISOString(),
        score: null,
        notes: 'Marked complete by coordinator from caregiver detail page',
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record completion');
    } finally {
      setCompletingId(null);
    }
  };

  if (!caregiverId) {
    return <p className="text-sm text-muted-foreground">Missing caregiver id.</p>;
  }

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

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <strong>Could not load progress.</strong> {error}
        </div>
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
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !progress ? (
            <EmptyState message="No progress available." />
          ) : progress.enrollments.length === 0 ? (
            <EmptyState message="No courses assigned yet. Use Assign course to add training." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Course</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progress.enrollments.map(({ enrollment, course }) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{course.title}</span>
                          {course.required && <Badge variant="outline">Required</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{course.code}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(enrollment.assignedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrollment.dueAt ? formatDate(enrollment.dueAt) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrollment.lastCompletedAt ? formatDate(enrollment.lastCompletedAt) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {enrollment.expiresAt ? formatDate(enrollment.expiresAt) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(enrollment.status)}>
                          {STATUS_LABEL[enrollment.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {enrollment.status !== 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void recordCompletion(enrollment)}
                            disabled={completingId === enrollment.id}
                            aria-busy={completingId === enrollment.id}
                          >
                            {completingId === enrollment.id ? 'Recording…' : 'Mark complete'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EnrollCaregiverModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onSuccess={() => void refresh()}
        lockedCaregiverId={caregiverId}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <BookOpen className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
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
