import React, { useMemo, useState } from 'react';
import { UserPlus, Users, Copy, Check } from 'lucide-react';
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
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/components/patterns/form-field';
import { SearchInput } from '@/components/patterns/search-input';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

interface StaffMember {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName?: string;
  lastName?: string;
}

interface StaffResponse {
  success: boolean;
  data: StaffMember[];
}

interface InvitePublic {
  id: string;
  agencyId: string;
  email: string;
  role: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  lastSentAt: string | null;
  createdAt: string | null;
  acceptanceUrl: string;
}

interface InviteCreateResponse {
  success: boolean;
  data: InvitePublic;
  emailSent: boolean;
  error?: string;
}

interface NewInviteInput {
  email: string;
  role: string;
  firstName?: string;
}

const QUERY_KEY = ['staff'];

export function StaffPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useApiResource<StaffResponse>(
    QUERY_KEY,
    '/api/staff',
  );
  const staff = data?.data ?? [];

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState('caregiver');
  const [latestInvite, setLatestInvite] = useState<InvitePublic | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [query, setQuery] = useState('');

  const createInvite = useMutation({
    mutationFn: (input: NewInviteInput) => postJson<InviteCreateResponse>('/api/invites', input),
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(response.error ?? 'Failed to create invite');
        return;
      }
      setLatestInvite(response.data);
      setEmailSent(response.emailSent);
      queryClient.setQueryData<StaffMember[]>(QUERY_KEY, (prev) => [
        ...(prev ?? []),
        {
          id: response.data.id,
          email: response.data.email,
          role: response.data.role,
          status: response.data.status,
        },
      ]);
      setEmail('');
      setFirstName('');
      toast.success(`Invite created for ${response.data.email}.`);
    },
    onError: (err) => {
      if (err instanceof HttpError && err.body && typeof err.body === 'object') {
        const body = err.body as { error?: string };
        toast.error(body.error ?? `Request failed: ${err.status}`);
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to send invite');
      }
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => `${s.email} ${s.role}`.toLowerCase().includes(q));
  }, [staff, query]);

  const handleInvite = (e: React.FormEvent): void => {
    e.preventDefault();
    setLatestInvite(null);
    setEmailSent(null);
    setCopyState('idle');
    createInvite.mutate({ email, role, firstName: firstName || undefined });
  };

  const handleCopy = async (): Promise<void> => {
    if (!latestInvite) return;
    try {
      await navigator.clipboard.writeText(latestInvite.acceptanceUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      /* fallthrough: user can manually select */
    }
  };

  const columns: DataTableColumn<StaffMember>[] = [
    {
      id: 'email',
      header: 'Email',
      sortValue: (s) => s.email.toLowerCase(),
      cell: (s) => <span className="font-medium text-foreground">{s.email}</span>,
    },
    {
      id: 'role',
      header: 'Role',
      sortValue: (s) => s.role,
      cell: (s) => <span className="capitalize text-muted-foreground">{s.role}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'right',
      sortValue: (s) => s.status,
      cell: (s) => (
        <Badge variant={s.status === 'pending' ? 'warning' : 'secondary'}>{s.status}</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff Management"
        description="Manage caregivers, coordinators, and invite new staff members."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" aria-hidden />
              Invite Staff Member
            </CardTitle>
            <CardDescription>Send a single-use invite link to onboard a teammate.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <FormField label="Email Address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="staff@example.com"
                />
              </FormField>
              <FormField label="First Name (optional)">
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Maria"
                />
              </FormField>
              <FormField label="Role">
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="caregiver">Caregiver</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormField>
              <Button
                type="submit"
                disabled={createInvite.isPending}
                className="w-full sm:w-auto"
              >
                {createInvite.isPending ? 'Creating…' : 'Create Invite'}
              </Button>
            </form>

            {latestInvite && (
              <Alert variant={emailSent ? 'success' : 'warning'} className="mt-4">
                <AlertTitle>Invite created for {latestInvite.email}</AlertTitle>
                <AlertDescription>
                  {emailSent
                    ? 'An email with the acceptance link is on its way.'
                    : 'Email delivery is not configured — copy the link below and share it.'}
                </AlertDescription>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 text-xs">
                    {latestInvite.acceptanceUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleCopy()}
                  >
                    {copyState === 'copied' ? (
                      <>
                        <Check className="size-3.5" aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" aria-hidden /> Copy link
                      </>
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Expires {new Date(latestInvite.expiresAt).toLocaleString()} · Single-use — once
                  they accept, the link stops working.
                </p>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden />
                Active Staff Directory
              </CardTitle>
              <CardDescription>
                {staff.length} {staff.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search staff…"
              aria-label="Search staff"
              className="w-full sm:w-56"
            />
          </CardHeader>
          <CardContent>
            {isError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-3">
                  Couldn’t load staff.
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(s) => s.id}
                isLoading={isLoading}
                pageSize={10}
                empty={{
                  icon: Users,
                  title: query ? 'No matching staff' : 'No staff yet',
                  description: query
                    ? `No staff match “${query}”.`
                    : 'Send an invite to add your first teammate.',
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
