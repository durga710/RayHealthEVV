import React, { useEffect, useMemo, useState } from 'react';
import { FileCheck, ClipboardList, Search } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Authorization {
  id: string;
  clientId: string;
  payerId: string;
  serviceCode: string;
  unitsAuthorized: number;
  startDate: string;
  endDate: string;
}

export function AuthorizationsPage() {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [clientId, setClientId] = useState('');
  const [payerId, setPayerId] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [unitsAuthorized, setUnitsAuthorized] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getJson<Authorization[]>('/api/authorizations')
      .then((data) => setAuthorizations(data || []))
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return authorizations;
    return authorizations.filter((a) =>
      `${a.serviceCode} ${a.clientId} ${a.payerId}`.toLowerCase().includes(q),
    );
  }, [authorizations, query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const newAuth = await postJson<Authorization>('/api/authorizations', {
        clientId,
        payerId,
        serviceCode,
        unitsAuthorized: Number(unitsAuthorized),
        startDate,
        endDate,
      });
      setAuthorizations((prev) => [...prev, newAuth]);
      setClientId('');
      setPayerId('');
      setServiceCode('');
      setUnitsAuthorized('');
      setStartDate('');
      setEndDate('');
      setMessage({ kind: 'ok', text: 'Authorization added successfully' });
    } catch (err) {
      setMessage({ kind: 'error', text: 'Failed to add authorization' });
    }
  };

  return (
    <div>
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payerId">Payer ID</Label>
                <Input
                  id="payerId"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="serviceCode">Service Code</Label>
                  <Input
                    id="serviceCode"
                    value={serviceCode}
                    onChange={(e) => setServiceCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="units">Units</Label>
                  <Input
                    id="units"
                    type="number"
                    min="1"
                    value={unitsAuthorized}
                    onChange={(e) => setUnitsAuthorized(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full sm:w-auto">
                Save Authorization
              </Button>
            </form>

            {message && (
              <div
                role="status"
                className={
                  message.kind === 'ok'
                    ? 'mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
                    : 'mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                }
              >
                {message.text}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" aria-hidden />
                Active Authorizations
              </CardTitle>
              <CardDescription>
                {authorizations.length}{' '}
                {authorizations.length === 1 ? 'authorization' : 'authorizations'} on record
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-56">
              <Search
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search authorizations…"
                className="pl-9"
                aria-label="Search authorizations"
              />
            </div>
          </CardHeader>
          <CardContent>
            {authorizations.length === 0 ? (
              <EmptyState message="No authorizations found. Add one to get started." />
            ) : filtered.length === 0 ? (
              <EmptyState message={`No authorizations match “${query}”.`} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Service Code</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Client</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.serviceCode}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.unitsAuthorized} Units
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.startDate} to {a.endDate}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">Client: {a.clientId.slice(0, 6)}...</Badge>
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
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <ClipboardList className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
