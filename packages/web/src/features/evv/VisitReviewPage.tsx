import React, { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { getJson, postJson } from '../../lib/api-client.js';
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

interface EvvVisit {
  id: string;
  assignmentId: string;
  caregiverId: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'pending' | 'verified' | 'flagged';
}

function statusVariant(status: EvvVisit['status']): 'warning' | 'success' | 'secondary' {
  if (status === 'pending') return 'warning';
  if (status === 'verified') return 'success';
  return 'secondary';
}

export function VisitReviewPage() {
  const [visits, setVisits] = useState<EvvVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const data = await getJson<EvvVisit[]>('/api/evv/visits');
      setVisits(data || []);
    } catch (err) {
      console.error('Failed to fetch visits', err);
    } finally {
      setLoading(false);
    }
  };

  const [pendingVisitId, setPendingVisitId] = useState<string | null>(null);

  const handleRequestCorrection = async (visitId: string) => {
    setMessage('');
    setPendingVisitId(visitId);
    try {
      await postJson('/api/maintenance/request-unlock', {
        visitId,
        reason: 'Coordinator requested EVV correction review from Visit Review'
      });
      setMessage('Correction request created successfully');
      fetchVisits();
      // Auto-clear success message after 4s so the row's hover state isn't masked.
      setTimeout(() => setMessage((current) => (current === 'Correction request created successfully' ? '' : current)), 4000);
    } catch (err) {
      console.error('Failed to create correction request', err);
      setMessage('Failed to create correction request');
    } finally {
      setPendingVisitId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="EVV Visit Review"
        description="Review electronically verified visits and open maintenance requests when corrections are needed."
      />

      {message && (
        <div
          role="status"
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {message}
        </div>
      )}

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
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading visits...</p>
          ) : visits.length === 0 ? (
            <EmptyState message="No visits to review." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Caregiver</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-medium">{visit.caregiverId.slice(0, 8)}...</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(visit.clockInTime).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {visit.clockOutTime ? new Date(visit.clockOutTime).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(visit.status)} className="capitalize">
                          {visit.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {visit.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRequestCorrection(visit.id)}
                            disabled={pendingVisitId === visit.id}
                            aria-busy={pendingVisitId === visit.id}
                          >
                            {pendingVisitId === visit.id ? 'Requesting…' : 'Request Correction'}
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
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <ClipboardCheck className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
