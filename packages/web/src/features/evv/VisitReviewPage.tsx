import { ClipboardCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { postJson, HttpError } from '../../lib/api-client.js';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged';
}

const QUERY_KEY = ['evv-visits'];

function statusVariant(status: EvvVisit['status']): 'warning' | 'success' | 'secondary' {
  if (status === 'pending') return 'warning';
  if (status === 'verified') return 'success';
  return 'secondary';
}

export function VisitReviewPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useApiResource<EvvVisit[]>(
    QUERY_KEY,
    '/api/evv/visits',
  );
  const visits = data ?? [];

  const requestCorrection = useMutation({
    mutationFn: (visitId: string) =>
      postJson('/api/maintenance/request-unlock', {
        visitId,
        reason: 'Coordinator requested EVV correction review from Visit Review',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Correction request created successfully');
    },
    onError: (error) => {
      toast.error(
        error instanceof HttpError ? error.message : 'Failed to create correction request',
      );
    },
  });

  const columns: DataTableColumn<EvvVisit>[] = [
    {
      id: 'caregiver',
      header: 'Caregiver',
      cell: (visit) => (
        <span className="font-medium text-foreground">{visit.caregiverId.slice(0, 8)}...</span>
      ),
    },
    {
      id: 'clockIn',
      header: 'Clock In',
      sortValue: (visit) => visit.clockInTime,
      cell: (visit) => (
        <span className="text-muted-foreground">
          {new Date(visit.clockInTime).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'clockOut',
      header: 'Clock Out',
      cell: (visit) => (
        <span className="text-muted-foreground">
          {visit.clockOutTime ? new Date(visit.clockOutTime).toLocaleString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (visit) => visit.status,
      cell: (visit) => (
        <Badge variant={statusVariant(visit.status)} className="capitalize">
          {visit.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (visit) => {
        if (visit.status !== 'pending') return null;
        const pending =
          requestCorrection.isPending && requestCorrection.variables === visit.id;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => requestCorrection.mutate(visit.id)}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? 'Requesting…' : 'Request Correction'}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="EVV Visit Review"
        description="Review electronically verified visits and open maintenance requests when corrections are needed."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" aria-hidden />
            Verified Visits
          </CardTitle>
          <CardDescription>
            {visits.length} {visits.length === 1 ? 'visit' : 'visits'} awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                Couldn’t load visits.
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              rows={visits}
              rowKey={(visit) => visit.id}
              isLoading={isLoading}
              pageSize={10}
              empty={{
                icon: ClipboardCheck,
                title: 'No visits to review.',
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
