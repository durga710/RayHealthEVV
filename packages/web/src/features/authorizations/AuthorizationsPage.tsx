import React, { useMemo, useState } from 'react';
import { FileCheck, ClipboardList } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/components/patterns/form-field';
import { SearchInput } from '@/components/patterns/search-input';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

interface Authorization {
  id: string;
  clientId: string;
  payerId: string;
  serviceCode: string;
  unitsAuthorized: number;
  startDate: string;
  endDate: string;
}

interface NewAuthorizationInput {
  clientId: string;
  payerId: string;
  serviceCode: string;
  unitsAuthorized: number;
  startDate: string;
  endDate: string;
}

const QUERY_KEY = ['authorizations'];

export function AuthorizationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useApiResource<Authorization[]>(
    QUERY_KEY,
    '/api/authorizations',
  );
  const authorizations = data ?? [];

  const [clientId, setClientId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [unitsAuthorized, setUnitsAuthorized] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [query, setQuery] = useState('');

  const createAuthorization = useMutation({
    mutationFn: (input: NewAuthorizationInput) =>
      postJson<Authorization>('/api/authorizations', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setClientId('');
      setPayerId('');
      setServiceCode('');
      setUnitsAuthorized('');
      setStartDate('');
      setEndDate('');
      toast.success('Authorization added successfully.');
    },
    onError: (error) => {
      toast.error(
        error instanceof HttpError
          ? error.message
          : 'Failed to add authorization. Please try again.',
      );
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return authorizations;
    return authorizations.filter((a) =>
      `${a.serviceCode} ${a.clientId} ${a.payerId}`.toLowerCase().includes(q),
    );
  }, [authorizations, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAuthorization.mutate({
      clientId,
      payerId,
      serviceCode,
      unitsAuthorized: Number(unitsAuthorized),
      startDate,
      endDate,
    });
  };

  const columns: DataTableColumn<Authorization>[] = [
    {
      id: 'serviceCode',
      header: 'Service Code',
      sortValue: (a) => a.serviceCode.toLowerCase(),
      cell: (a) => <span className="font-medium text-foreground">{a.serviceCode}</span>,
    },
    {
      id: 'units',
      header: 'Units',
      sortValue: (a) => a.unitsAuthorized,
      cell: (a) => (
        <span className="tabular-nums text-muted-foreground">{a.unitsAuthorized} Units</span>
      ),
    },
    {
      id: 'dates',
      header: 'Dates',
      sortValue: (a) => a.startDate,
      cell: (a) => (
        <span className="tabular-nums text-muted-foreground">
          {a.startDate} to {a.endDate}
        </span>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      align: 'right',
      cell: (a) => <Badge variant="secondary">Client: {a.clientId.slice(0, 6)}…</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="PA Authorizations"
        description="Manage service authorizations and unit tracking."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="size-5 text-primary" aria-hidden />
              Add Authorization
            </CardTitle>
            <CardDescription>Record a payer authorization and its unit allotment.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormField label="Client ID" required>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} required />
              </FormField>

              <FormField label="Payer ID" required>
                <Input value={payerId} onChange={(e) => setPayerId(e.target.value)} required />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Service Code" required>
                  <Input
                    value={serviceCode}
                    onChange={(e) => setServiceCode(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Units" required>
                  <Input
                    type="number"
                    min="1"
                    value={unitsAuthorized}
                    onChange={(e) =>
                      setUnitsAuthorized(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    required
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Start Date" required>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="End Date" required>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </FormField>
              </div>

              <Button
                type="submit"
                disabled={createAuthorization.isPending}
                className="w-full sm:w-auto"
              >
                {createAuthorization.isPending ? 'Saving…' : 'Save Authorization'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" aria-hidden />
                Active Authorizations
              </CardTitle>
              <CardDescription>
                {authorizations.length}{' '}
                {authorizations.length === 1 ? 'authorization' : 'authorizations'} on record
              </CardDescription>
            </div>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search authorizations…"
              aria-label="Search authorizations"
              className="w-full sm:w-56"
            />
          </CardHeader>
          <CardContent>
            {isError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-3">
                  Couldn’t load authorizations.
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(a) => a.id}
                isLoading={isLoading}
                pageSize={10}
                empty={{
                  icon: ClipboardList,
                  title: query ? 'No matching authorizations' : 'No authorizations yet',
                  description: query
                    ? `No authorizations match “${query}”.`
                    : 'Add one to get started.',
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
