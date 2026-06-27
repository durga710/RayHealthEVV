import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, BarChart3, BookOpen, GraduationCap, Users } from 'lucide-react';
import { EnrollCaregiverModal } from './EnrollCaregiverModal.js';
import { InsightsPanel } from './InsightsPanel.js';
import { AICopilotPanel } from './AICopilotPanel.js';
import { useAuth } from '../../lib/AuthContext.js';
import { useApiResource } from '../../lib/use-api-resource.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard } from '@/components/patterns/stat-card';
import { Skeleton } from '@/components/ui/skeleton';

interface LearningAgencyRollup {
  totalCaregivers: number;
  totalEnrollments: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  expired: number;
  complianceRate: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function LearningDashboardPage() {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const { user } = useAuth();
  const userRole = user?.role as 'admin' | 'coordinator' | 'caregiver' | 'family' | undefined;

  const { data: envelope, isLoading, isError, refetch } = useApiResource<
    ApiResponse<LearningAgencyRollup>
  >(['learning-dashboard', refreshTick], '/api/learning/dashboard');

  const rollup = envelope?.success ? envelope.data ?? null : null;
  const loadFailed = isError || (envelope !== undefined && !envelope.success);
  const errorMessage =
    envelope && !envelope.success ? envelope.error : undefined;

  const compliancePercent = rollup ? Math.round(rollup.complianceRate * 100) : 0;
  const attentionCount = rollup ? rollup.overdue + rollup.expired : 0;

  return (
    <div>
      <PageHeader
        title="Learning Hub"
        description="Caregiver training compliance — at-a-glance and per-person."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setEnrollOpen(true)}>
              <UserPlus className="size-4" aria-hidden />
              Enroll caregivers
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/learning/analytics">
                <BarChart3 className="size-4" aria-hidden />
                Analytics
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/learning/courses">
                <BookOpen className="size-4" aria-hidden />
                Course catalog
              </Link>
            </Button>
          </div>
        }
      />

      {loadFailed ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load dashboard.</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            {errorMessage ?? 'Something went wrong while loading the dashboard.'}
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* AI-flavored compliance signals — prioritized actionable insights */}
          <InsightsPanel refreshKey={refreshTick} />

          {/* Top KPI row */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {isLoading || !rollup ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={`kpi-skeleton-${i}`} className="h-28 rounded-xl" />
              ))
            ) : (
              <>
                <StatCard label="Active caregivers" value={rollup.totalCaregivers} icon={Users} />
                <StatCard
                  label="Total enrollments"
                  value={rollup.totalEnrollments}
                  icon={GraduationCap}
                />
                <StatCard
                  label="Agency compliance"
                  value={`${compliancePercent}%`}
                  icon={BarChart3}
                  hint="Across all active enrollments"
                />
              </>
            )}
          </div>

          {rollup && (
            <>
              {/* Status breakdown */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="size-5 text-primary" aria-hidden />
                    Enrollments by status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard label="Completed" value={rollup.completed} />
                    <StatCard label="In progress" value={rollup.inProgress} />
                    <StatCard label="Not started" value={rollup.notStarted} />
                    <StatCard label="Overdue" value={rollup.overdue} />
                    <StatCard label="Expired" value={rollup.expired} />
                  </div>
                </CardContent>
              </Card>

              {/* Compliance bar */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="size-5 text-primary" aria-hidden />
                    Compliance breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ComplianceBar rollup={rollup} />
                </CardContent>
              </Card>

              {attentionCount > 0 && (
                <Alert variant="warning" className="mt-8">
                  <AlertTitle>
                    {attentionCount} enrollment{attentionCount === 1 ? '' : 's'} need attention.
                  </AlertTitle>
                  <AlertDescription>
                    {rollup.overdue > 0 && `${rollup.overdue} overdue`}
                    {rollup.overdue > 0 && rollup.expired > 0 && ', '}
                    {rollup.expired > 0 && `${rollup.expired} expired`}. Open per-caregiver detail
                    from the Staff page.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </>
      )}

      <AICopilotPanel userRole={userRole} />

      <EnrollCaregiverModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onSuccess={() => setRefreshTick((n) => n + 1)}
      />
    </div>
  );
}

// ---------- Subcomponents ----------

interface ComplianceBarProps {
  rollup: LearningAgencyRollup;
}

function ComplianceBar({ rollup }: ComplianceBarProps) {
  const total = rollup.totalEnrollments || 1;
  const segments = [
    { label: 'Completed', value: rollup.completed, color: '#10A4A4' },
    { label: 'In progress', value: rollup.inProgress, color: '#185FA5' },
    { label: 'Not started', value: rollup.notStarted, color: '#888780' },
    { label: 'Overdue', value: rollup.overdue, color: '#BA7517' },
    { label: 'Expired', value: rollup.expired, color: '#E24B4A' }
  ];

  return (
    <>
      <div className="flex h-8 overflow-hidden rounded-md border border-border">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              width: `${(seg.value / total) * 100}%`,
              backgroundColor: seg.color,
            }}
            title={`${seg.label}: ${seg.value}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-5 text-sm">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ backgroundColor: seg.color }}
            />
            {seg.label} <strong>{seg.value}</strong>
          </span>
        ))}
      </div>
    </>
  );
}
