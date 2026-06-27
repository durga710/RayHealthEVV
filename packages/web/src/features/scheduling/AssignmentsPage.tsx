import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarClock, ShieldAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getJson, HttpError, postJson } from '../../lib/api-client.js';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/patterns/form-field';
import { SearchInput } from '@/components/patterns/search-input';
import { DataTable, type DataTableColumn } from '@/components/patterns/data-table';

interface Template {
  id: string;
  name: string;
  clientId: string;
}

interface CaregiverSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface StaffResponse {
  success: boolean;
  data?: CaregiverSummary[];
  error?: string;
}

interface ClientSummary {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  medicaidNumber?: string | null;
}

interface Assignment {
  id: string;
  clientId: string;
  caregiverId: string;
  visitDate?: string;
  visitTemplateId: string;
}

interface ComplianceBlocker {
  enrollmentId: string;
  courseCode: string;
  courseTitle: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';
  reason: string;
}

interface ComplianceErrorBody {
  code?: string;
  message?: string;
  blockers?: ComplianceBlocker[];
}

interface AssignmentDraft {
  clientId: string;
  caregiverId: string;
  visitTemplateId: string;
  visitDate: string;
}

const ASSIGNMENTS_KEY = ['assignments'];

export function AssignmentsPage() {
  const queryClient = useQueryClient();

  const {
    data: assignmentsData,
    isLoading: assignmentsLoading,
    isError: assignmentsError,
    refetch: refetchAssignments,
  } = useApiResource<Assignment[]>(ASSIGNMENTS_KEY, '/api/assignments');
  const assignments = assignmentsData ?? [];

  const { data: templatesData } = useApiResource<Template[]>(['templates'], '/api/templates');
  const templates = templatesData ?? [];

  const { data: staffData } = useApiResource<StaffResponse>(['staff'], '/api/staff');
  const caregivers = staffData?.success && Array.isArray(staffData.data) ? staffData.data : [];

  const { data: clientsData } = useApiResource<ClientSummary[]>(['clients'], '/api/clients');
  const clients = Array.isArray(clientsData) ? clientsData : [];

  const [clientId, setClientId] = useState('');
  const [caregiverId, setCaregiverId] = useState('');
  const [visitTemplateId, setVisitTemplateId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');

  // Compliance-gate state
  const [blockers, setBlockers] = useState<ComplianceBlocker[]>([]);
  const [blockedDraft, setBlockedDraft] = useState<AssignmentDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Override-reason dialog (replaces window.prompt). The reason is audited, so
  // it is collected in a proper, accessible form control before submitting.
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');

  // Preflight compliance state — checked as the coordinator types the caregiver ID
  const [preflight, setPreflight] = useState<{ compliant: boolean; blockers: ComplianceBlocker[] } | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // Debounced preflight check: 600ms after the caregiverId stops changing,
  // hit /api/assignments/compliance-check/:caregiverId so coordinators see
  // the compliance state up front instead of hitting a 422 after submitting.
  useEffect(() => {
    if (!caregiverId || caregiverId.length < 8) {
      setPreflight(null);
      return;
    }
    const handle = setTimeout(() => {
      void (async () => {
        setPreflightLoading(true);
        try {
          const response = await getJson<{ success: boolean; data?: { compliant: boolean; blockers: ComplianceBlocker[] }; error?: string }>(
            `/api/assignments/compliance-check/${caregiverId}`,
          );
          if (response.success && response.data) {
            setPreflight(response.data);
          } else {
            setPreflight(null);
          }
        } catch {
          // Silent — preflight is a helpful hint, not a hard requirement.
          // The 422 gate still fires on submit if something's wrong.
          setPreflight(null);
        } finally {
          setPreflightLoading(false);
        }
      })();
    }, 600);
    return () => clearTimeout(handle);
  }, [caregiverId]);

  // Map of caregiverId → "First Last" for inline name display. Falls back to
  // a slice of the ID when the caregiver isn't in the staff list (deleted,
  // not yet synced, etc.).
  const caregiverNameById = caregivers.reduce<Record<string, string>>((map, c) => {
    map[c.id] = `${c.firstName} ${c.lastName}`;
    return map;
  }, {});

  const displayCaregiver = (id: string): string => {
    return caregiverNameById[id] ?? `${id.slice(0, 6)}…`;
  };

  const clientNameById = clients.reduce<Record<string, string>>((map, c) => {
    map[c.id] = `${c.lastName}, ${c.firstName}`;
    return map;
  }, {});

  const displayClient = (id: string): string => {
    return clientNameById[id] ?? `${id.slice(0, 6)}…`;
  };

  const filteredAssignments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((a) =>
      `${displayCaregiver(a.caregiverId)} ${displayClient(a.clientId)} ${a.visitDate ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [assignments, query, caregiverNameById, clientNameById]);

  const resetForm = (): void => {
    setClientId('');
    setCaregiverId('');
    setVisitTemplateId('');
    setVisitDate('');
  };

  const submitAssignment = async (
    draft: AssignmentDraft,
    options: { force?: boolean; overrideReason?: string } = {},
  ): Promise<void> => {
    setMessage(null);
    setSubmitting(true);
    try {
      const payload = options.force
        ? { ...draft, force: true, overrideReason: options.overrideReason ?? '' }
        : draft;
      const newAssign = await postJson<Assignment>('/api/assignments', payload);
      queryClient.setQueryData<Assignment[]>(ASSIGNMENTS_KEY, (prev) => [...(prev ?? []), newAssign]);
      resetForm();
      setBlockers([]);
      setBlockedDraft(null);
      setMessage({
        kind: 'success',
        text: options.force
          ? 'Assignment created with training-override on file'
          : 'Assignment created successfully',
      });
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as ComplianceErrorBody | null;
        if (body?.code === 'CAREGIVER_NOT_COMPLIANT' && body.blockers) {
          setBlockers(body.blockers);
          setBlockedDraft(draft);
          setMessage(null);
          return;
        }
      }
      setMessage({ kind: 'error', text: 'Failed to create assignment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await submitAssignment({ clientId, caregiverId, visitTemplateId, visitDate });
  };

  const openOverrideDialog = (): void => {
    setOverrideReason('');
    setOverrideError('');
    setOverrideOpen(true);
  };

  const handleOverrideConfirm = async (): Promise<void> => {
    if (!blockedDraft) return;
    const reason = overrideReason.trim();
    if (!reason) {
      setOverrideError('A reason is required and will be written to the audit log.');
      return;
    }
    setOverrideError('');
    await submitAssignment(blockedDraft, { force: true, overrideReason: reason });
    setOverrideOpen(false);
    setOverrideReason('');
  };

  const handleClearBlockers = (): void => {
    setBlockers([]);
    setBlockedDraft(null);
  };

  const preflightHint: React.ReactNode = preflightLoading
    ? 'Checking training compliance…'
    : preflight && preflight.compliant
      ? <span className="text-success">✓ Caregiver is training-compliant</span>
      : preflight && !preflight.compliant
        ? (
            <span className="text-destructive">
              ⚠ {preflight.blockers.length} training blocker
              {preflight.blockers.length === 1 ? '' : 's'} — submit will require override
            </span>
          )
        : undefined;

  const columns: DataTableColumn<Assignment>[] = [
    {
      id: 'caregiver',
      header: 'Caregiver',
      sortValue: (a) => displayCaregiver(a.caregiverId).toLowerCase(),
      cell: (a) => (
        <span className="font-medium text-foreground">{displayCaregiver(a.caregiverId)}</span>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      sortValue: (a) => displayClient(a.clientId).toLowerCase(),
      cell: (a) => <span className="text-muted-foreground">{displayClient(a.clientId)}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      align: 'right',
      sortValue: (a) => a.visitDate ?? '',
      cell: (a) =>
        a.visitDate ? (
          <Badge variant="secondary" className="tabular-nums">
            {a.visitDate}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caregiver Assignments"
        description="Schedule and assign caregivers to client visits."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="size-5 text-primary" aria-hidden />
              New Assignment
            </CardTitle>
            <CardDescription>Assign a caregiver to a client visit template.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <FormField label="Client">
                {clients.length > 0 ? (
                  <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                    <option value="">Select a client</option>
                    {clients
                      .slice()
                      .sort((a, b) =>
                        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.lastName}, {c.firstName}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Client ID"
                    required
                  />
                )}
              </FormField>

              <FormField label="Caregiver" hint={preflightHint}>
                {caregivers.length > 0 ? (
                  <Select
                    value={caregiverId}
                    onChange={(e) => setCaregiverId(e.target.value)}
                    required
                  >
                    <option value="">Select a caregiver</option>
                    {caregivers
                      .filter((c) => c.status === 'active')
                      .sort((a, b) =>
                        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.lastName}, {c.firstName} · {c.email}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input
                    value={caregiverId}
                    onChange={(e) => setCaregiverId(e.target.value)}
                    placeholder="Caregiver ID"
                    required
                  />
                )}
              </FormField>

              <FormField label="Visit Template">
                <Select
                  value={visitTemplateId}
                  onChange={(e) => setVisitTemplateId(e.target.value)}
                  required
                >
                  <option value="">Select a template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {displayClient(t.clientId)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Visit Date">
                <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              </FormField>

              <Button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? 'Creating…' : 'Create Assignment'}
              </Button>
            </form>

            {blockers.length > 0 && blockedDraft && (
              <ComplianceBlockerBanner
                blockers={blockers}
                caregiverId={blockedDraft.caregiverId}
                onOverride={openOverrideDialog}
                onCancel={handleClearBlockers}
                submitting={submitting}
              />
            )}

            {message && (
              <Alert variant={message.kind === 'error' ? 'destructive' : 'success'} className="mt-4">
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" aria-hidden />
                Upcoming Assignments
              </CardTitle>
              <CardDescription>
                {assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}
              </CardDescription>
            </div>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search assignments…"
              aria-label="Search assignments"
              className="w-full sm:w-56"
            />
          </CardHeader>
          <CardContent>
            {assignmentsError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-3">
                  Couldn’t load assignments.
                  <Button variant="outline" size="sm" onClick={() => void refetchAssignments()}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <DataTable
                columns={columns}
                rows={filteredAssignments}
                rowKey={(a) => a.id}
                isLoading={assignmentsLoading}
                pageSize={10}
                empty={{
                  icon: CalendarClock,
                  title: query ? 'No matching assignments' : 'No assignments yet',
                  description: query
                    ? `No assignments match “${query}”.`
                    : 'Create an assignment to schedule a visit.',
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={overrideOpen}
        onOpenChange={(open) => {
          setOverrideOpen(open);
          if (!open) setOverrideError('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record training override</DialogTitle>
            <DialogDescription>
              This assignment is being made despite incomplete training. The reason below is written
              to the agency audit log alongside the assignment.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Override reason" required error={overrideError || undefined}>
            <Textarea
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                if (overrideError) setOverrideError('');
              }}
              placeholder="Explain why this assignment proceeds despite incomplete training…"
              rows={4}
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOverrideOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleOverrideConfirm()}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Recording…' : 'Confirm override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Subcomponents ----------

interface ComplianceBlockerBannerProps {
  blockers: ComplianceBlocker[];
  caregiverId: string;
  onOverride: () => void;
  onCancel: () => void;
  submitting: boolean;
}

function ComplianceBlockerBanner({
  blockers,
  caregiverId,
  onOverride,
  onCancel,
  submitting,
}: ComplianceBlockerBannerProps) {
  return (
    <Alert variant="destructive" icon={ShieldAlert} className="mt-4">
      <AlertTitle className="flex items-center gap-2">
        Caregiver not training-compliant
        <Badge variant="destructive">
          {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        <ul className="mb-3 mt-1 list-disc space-y-1 pl-5">
          {blockers.map((b) => (
            <li key={b.enrollmentId}>
              <strong>{b.courseTitle}</strong> ({b.courseCode}) — {b.reason}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="destructive">
            <Link to={`/admin/learning/caregivers/${caregiverId}`}>Resolve training →</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOverride}
            disabled={submitting}
          >
            Override (record reason)
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
