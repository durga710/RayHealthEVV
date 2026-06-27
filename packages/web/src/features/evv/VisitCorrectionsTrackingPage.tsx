/**
 * Visit corrections tracking page.
 *
 * Per the user-stated requirement: "a dedicated tracking page" for missed
 * punch / VMUR corrections, distinct from the coordinator review queue.
 *
 * Differences from `VisitCorrectionsQueuePage`:
 *   - This page lists every status (pending, approved, rejected), not just pending.
 *   - It's read-only. No approve/reject controls — those live on the queue page.
 *   - Supports filter by status, originator, and reason category code.
 *   - Drives off `GET /api/maintenance/history` (new endpoint, capped at 500 rows).
 */

import React, { useMemo, useState } from 'react';
import { History, Filter } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

type VmurStatus = 'pending' | 'approved' | 'rejected';
type VmurOriginator = 'caregiver' | 'coordinator' | 'admin';

interface VmurItem {
  id?: string;
  visitId: string;
  agencyId?: string;
  requesterId: string;
  reason: string;
  reasonCategoryCode?: string;
  correctionCode?: string;
  originatorRole?: VmurOriginator;
  originalStartTime?: string;
  originalEndTime?: string;
  adjustedStartTime?: string;
  adjustedEndTime?: string;
  caregiverSignaturePresent?: boolean;
  clientSignaturePresent?: boolean;
  incompleteSignatureReason?: string;
  status: VmurStatus;
  approverId?: string;
  approvedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface Filters {
  status: '' | VmurStatus;
  originator: '' | VmurOriginator;
  reasonCode: string;
}

const REASON_CODES = [
  'MTLB', 'DCDB', 'MFLB', 'MFLA', 'ACLN', 'ATGL',
  'AGRS', 'WKAP', 'CNCL', 'HOLI', 'WKLI', 'OTHR',
];

function buildHistoryPath(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.originator) params.set('originator', filters.originator);
  if (filters.reasonCode) params.set('reasonCode', filters.reasonCode);
  const qs = params.toString();
  return qs ? `/api/maintenance/history?${qs}` : '/api/maintenance/history';
}

export function VisitCorrectionsTrackingPage(): React.JSX.Element {
  const [filters, setFilters] = useState<Filters>({ status: '', originator: '', reasonCode: '' });

  const path = useMemo(() => buildHistoryPath(filters), [filters]);
  const { data, isLoading, isError, refetch } = useApiResource<ApiResponse<VmurItem[]>>(
    ['maintenance-history', filters],
    path,
  );

  const serverError =
    data && !data.success ? data.error ?? 'Failed to load corrections history' : null;
  const showError = isError || Boolean(serverError);
  const errorMessage = serverError ?? 'Failed to load corrections history';
  const items = data?.data ?? [];

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const columns: DataTableColumn<VmurItem>[] = [
    {
      id: 'status',
      header: 'Status',
      cell: (item) => <StatusBadge status={item.status} />,
    },
    {
      id: 'originator',
      header: 'Originator',
      cell: (item) => (
        <span className="text-muted-foreground">{item.originatorRole ?? '—'}</span>
      ),
    },
    {
      id: 'visit',
      header: 'Visit',
      cell: (item) => (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {item.visitId.slice(0, 8)}…
        </code>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (item) => item.reasonCategoryCode ?? '—',
    },
    {
      id: 'correction',
      header: 'Correction',
      cell: (item) => item.correctionCode ?? '—',
    },
    {
      id: 'signatures',
      header: 'Signatures',
      cell: (item) => (
        <SignaturePair
          caregiver={item.caregiverSignaturePresent}
          client={item.clientSignaturePresent}
        />
      ),
    },
    {
      id: 'filedBy',
      header: 'Filed by',
      cell: (item) => (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {item.requesterId.slice(0, 8)}…
        </code>
      ),
    },
    {
      id: 'approvedBy',
      header: 'Approved by',
      cell: (item) =>
        item.approverId ? (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            {item.approverId.slice(0, 8)}…
          </code>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visit corrections tracking"
        description="Full history of VMUR corrections for your agency — every status, every originator. Read-only. Pending items can be approved or rejected from the Corrections Queue page."
      />

      <FilterBar filters={filters} onChange={updateFilter} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" aria-hidden />
            Corrections History
          </CardTitle>
          <CardDescription>
            {items.length} {items.length === 1 ? 'correction' : 'corrections'} matching the current filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                {errorMessage}
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(item) => item.id ?? item.visitId}
              isLoading={isLoading}
              pageSize={10}
              empty={{
                icon: History,
                title: 'No corrections found',
                description: 'No corrections match the current filters.',
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----- Filter bar -----

interface FilterBarProps {
  filters: Filters;
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
}
function FilterBar({ filters, onChange }: FilterBarProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="size-5 text-primary" aria-hidden />
          Filters
        </CardTitle>
        <CardDescription>Narrow the history by status, originator, or reason code.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="filter-status">Status</Label>
            <Select
              id="filter-status"
              value={filters.status}
              onChange={(e) => onChange('status', e.target.value as Filters['status'])}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-originator">Originator</Label>
            <Select
              id="filter-originator"
              value={filters.originator}
              onChange={(e) => onChange('originator', e.target.value as Filters['originator'])}
            >
              <option value="">All</option>
              <option value="caregiver">Caregiver</option>
              <option value="coordinator">Coordinator</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-reason">Reason code</Label>
            <Select
              id="filter-reason"
              value={filters.reasonCode}
              onChange={(e) => onChange('reasonCode', e.target.value)}
            >
              <option value="">All</option>
              {REASON_CODES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----- Cell helpers -----

interface StatusBadgeProps {
  status: VmurStatus;
}
function StatusBadge({ status }: StatusBadgeProps): React.JSX.Element {
  if (status === 'approved') return <Badge variant="success">Approved</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

interface SignaturePairProps {
  caregiver?: boolean;
  client?: boolean;
}
function SignaturePair({ caregiver, client }: SignaturePairProps): React.JSX.Element {
  return (
    <span className="inline-flex gap-1.5">
      <SigDot label="CG" present={caregiver} />
      <SigDot label="CL" present={client} />
    </span>
  );
}

interface SigDotProps {
  label: string;
  present?: boolean;
}
function SigDot({ label, present }: SigDotProps): React.JSX.Element {
  if (present === undefined) {
    return <Badge variant="secondary">{label}?</Badge>;
  }
  if (present) return <Badge variant="success">{label} ✓</Badge>;
  return <Badge variant="destructive">{label} ✗</Badge>;
}
