import { useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users } from 'lucide-react';
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

export function CourseDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const [envelope, setEnvelope] = useState<CourseCaregiverEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CourseCaregiverEnvelope>>(`/api/learning/courses/${id}/caregivers`);
        if (cancelled) return;
        if (response.success && response.data) {
          setEnvelope(response.data);
        } else {
          setError(response.error ?? 'Failed to load course');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load course');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Group caregivers by status, sorted by STATUS_ORDER (worst first)
  const grouped: Partial<Record<EnrollmentStatus, CourseCaregiverRow[]>> = {};
  for (const row of envelope?.caregivers ?? []) {
    const list = grouped[row.effectiveStatus] ?? [];
    list.push(row);
    grouped[row.effectiveStatus] = list;
  }

  const description = envelope?.course
    ? `${envelope.course.code} · ${envelope.course.required ? 'Required · ' : ''}${cadenceLabel(envelope.course.cadence)}`
    : 'Course enrollment and caregiver progress.';

  return (
    <div>
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

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {envelope && (
        <div className="space-y-6">
          {envelope.course.description && (
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
                {envelope.caregivers.length}{' '}
                {envelope.caregivers.length === 1 ? 'caregiver' : 'caregivers'} enrolled
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {envelope.caregivers.length === 0 ? (
                <EmptyState message="No caregivers enrolled in this course yet." />
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
                      <div className="overflow-hidden rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Caregiver</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Due</TableHead>
                              <TableHead>Completed</TableHead>
                              <TableHead>Expires</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row) => (
                              <TableRow key={row.enrollment.id}>
                                <TableCell className="font-medium">
                                  <Link
                                    to={`/admin/learning/caregivers/${row.caregiver.id}`}
                                    className="hover:underline"
                                  >
                                    {row.caregiver.lastName}, {row.caregiver.firstName}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.caregiver.email}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.enrollment.dueAt ? formatDate(row.enrollment.dueAt) : '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.enrollment.lastCompletedAt
                                    ? formatDate(row.enrollment.lastCompletedAt)
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {row.enrollment.expiresAt
                                    ? formatDate(row.enrollment.expiresAt)
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <Users className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
