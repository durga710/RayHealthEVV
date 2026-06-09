import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, BarChart3, BookOpen, GraduationCap, AlertTriangle } from 'lucide-react';
import { getJson } from '../../lib/api-client.js';
import { EnrollCaregiverModal } from './EnrollCaregiverModal.js';
import { InsightsPanel } from './InsightsPanel.js';
import { AICopilotPanel } from './AICopilotPanel.js';
import { useAuth } from '../../lib/AuthContext.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
  const [rollup, setRollup] = useState<LearningAgencyRollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const { user } = useAuth();
  const userRole = user?.role as 'admin' | 'coordinator' | 'caregiver' | 'family' | undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<LearningAgencyRollup>>('/api/learning/dashboard');
        if (cancelled) return;
        if (response.success && response.data) {
          setRollup(response.data);
        } else {
          setError(response.error ?? 'Failed to load dashboard');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const compliancePercent = rollup ? Math.round(rollup.complianceRate * 100) : 0;
  const complianceClass =
    compliancePercent >= 95 ? 'text-emerald-600' :
    compliancePercent >= 80 ? 'text-amber-600' :
    'text-destructive';

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

      {loading && <p className="text-sm text-muted-foreground">Loading dashboard…</p>}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <strong>Could not load dashboard.</strong> {error}
        </div>
      )}

      {rollup && (
        <>
          {/* AI-flavored compliance signals — prioritized actionable insights */}
          <InsightsPanel refreshKey={refreshTick} />

          {/* Top KPI row */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="Active caregivers" value={rollup.totalCaregivers} />
            <KpiCard label="Total enrollments" value={rollup.totalEnrollments} />
            <KpiCard
              label="Agency compliance"
              value={`${compliancePercent}%`}
              valueClassName={complianceClass}
            />
          </div>

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
                <StatusCard label="Completed" value={rollup.completed} accentClass="border-l-emerald-500" />
                <StatusCard label="In progress" value={rollup.inProgress} accentClass="border-l-primary" />
                <StatusCard label="Not started" value={rollup.notStarted} accentClass="border-l-muted-foreground" />
                <StatusCard label="Overdue" value={rollup.overdue} accentClass="border-l-amber-500" />
                <StatusCard label="Expired" value={rollup.expired} accentClass="border-l-destructive" />
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

          {rollup.overdue + rollup.expired > 0 && (
            <div
              role="status"
              className="mt-8 flex items-start gap-2 rounded-md border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>{rollup.overdue + rollup.expired} enrollment{rollup.overdue + rollup.expired === 1 ? '' : 's'} need attention.</strong>{' '}
                {rollup.overdue > 0 && `${rollup.overdue} overdue`}{rollup.overdue > 0 && rollup.expired > 0 && ', '}{rollup.expired > 0 && `${rollup.expired} expired`}.
                {' '}Open per-caregiver detail from the Staff page.
              </span>
            </div>
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

interface KpiCardProps {
  label: string;
  value: number | string;
  valueClassName?: string;
}

function KpiCard({ label, value, valueClassName }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`mt-1 text-3xl font-medium ${valueClassName ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

interface StatusCardProps {
  label: string;
  value: number;
  accentClass: string;
}

function StatusCard({ label, value, accentClass }: StatusCardProps) {
  return (
    <div className={`rounded-lg border border-border border-l-4 ${accentClass} bg-card px-4 py-3`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-medium">{value}</div>
    </div>
  );
}

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
