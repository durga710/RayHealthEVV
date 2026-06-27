import React, { useMemo, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
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

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidNumber?: string;
}

interface NewClientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidNumber: string;
}

/** Render only the last 4 digits of a Medicaid ID; the rest is PHI. */
function maskMedicaid(value: string): string {
  const digits = value.replace(/\s+/g, '');
  if (digits.length <= 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}

const QUERY_KEY = ['clients'];

export function ClientsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useApiResource<Client[]>(QUERY_KEY, '/api/clients');
  const clients = data ?? [];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [medicaidNumber, setMedicaidNumber] = useState('');
  const [query, setQuery] = useState('');

  const createClient = useMutation({
    mutationFn: (input: NewClientInput) => postJson<Client>('/api/clients', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setMedicaidNumber('');
      toast.success('Client added successfully.');
    },
    onError: (error) => {
      toast.error(
        error instanceof HttpError ? error.message : 'Failed to add client. Please try again.',
      );
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.medicaidNumber ?? ''}`.toLowerCase().includes(q),
    );
  }, [clients, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClient.mutate({ firstName, lastName, dateOfBirth, medicaidNumber });
  };

  const columns: DataTableColumn<Client>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (c) => `${c.lastName} ${c.firstName}`.toLowerCase(),
      cell: (c) => (
        <span className="font-medium text-foreground">
          {c.firstName} {c.lastName}
        </span>
      ),
    },
    {
      id: 'dob',
      header: 'Date of Birth',
      sortValue: (c) => c.dateOfBirth,
      cell: (c) => <span className="tabular-nums text-muted-foreground">{c.dateOfBirth}</span>,
    },
    {
      id: 'medicaid',
      header: 'Medicaid',
      align: 'right',
      cell: (c) =>
        c.medicaidNumber ? (
          <Badge variant="secondary" className="font-mono tabular-nums">
            {maskMedicaid(c.medicaidNumber)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Client Management"
        description="Manage your clients and their demographic information."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" aria-hidden />
              Add New Client
            </CardTitle>
            <CardDescription>Create a client record for scheduling and EVV.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="First Name" required>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </FormField>
                <FormField label="Last Name" required>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </FormField>
              </div>
              <FormField label="Date of Birth" required>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Medicaid Number" hint="Stored securely; shown masked in the roster.">
                <Input
                  value={medicaidNumber}
                  onChange={(e) => setMedicaidNumber(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </FormField>
              <Button type="submit" disabled={createClient.isPending} className="w-full sm:w-auto">
                {createClient.isPending ? 'Adding…' : 'Add Client'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden />
                Client Roster
              </CardTitle>
              <CardDescription>
                {clients.length} {clients.length === 1 ? 'client' : 'clients'} on record
              </CardDescription>
            </div>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search clients…"
              aria-label="Search clients"
              className="w-full sm:w-56"
            />
          </CardHeader>
          <CardContent>
            {isError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-3">
                  Couldn’t load clients.
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(c) => c.id}
                isLoading={isLoading}
                pageSize={10}
                empty={{
                  icon: Users,
                  title: query ? 'No matching clients' : 'No clients yet',
                  description: query
                    ? `No clients match “${query}”.`
                    : 'Add your first client to get started.',
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
