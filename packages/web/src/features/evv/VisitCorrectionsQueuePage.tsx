/**
 * Coordinator review queue for VMUR (Visit Maintenance Unlock Request) items.
 *
 * Consumes `GET /api/maintenance/queue`. Each row exposes Approve and Reject
 * controls that hit the corresponding POST endpoints. Approve optionally
 * accepts adjusted clock-in / clock-out timestamps; Reject requires a reason.
 *
 * Caregiver-originated corrections (visit-card → mobile app) land in the
 * same queue with `originatorRole = 'caregiver'`. Coordinator-filed
 * corrections still arrive here as `coordinator` / `admin` and can be
 * self-approved by an admin if they have schedule.write — the UI doesn't
 * enforce four-eyes; that's a policy decision the backend would gate.
 */

import React, { useState, type FormEvent } from 'react';
import { ClipboardCheck, Inbox } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/patterns/empty-state';
import { FormField } from '@/components/patterns/form-field';

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

interface ApproveVars {
  id: string;
  args: { adjustedStartTime?: string; adjustedEndTime?: string };
}

interface RejectVars {
  id: string;
  reason: string;
}

const QUEUE_KEY = ['maintenance-queue'];

const REASON_CODE_LABELS: Record<string, string> = {
  MTLB: 'Mobile — no internet at start',
  DCDB: 'Device damaged / broken',
  MFLB: 'Manual entry — late',
  MFLA: 'Manual entry — added',
  ACLN: 'Client refused app',
  ATGL: 'GPS lookup failed',
  AGRS: 'Aggregator system issue',
  WKAP: 'Worker not available',
  CNCL: 'Visit cancelled',
  HOLI: 'Holiday adjustment',
  WKLI: 'Worker called in late',
  OTHR: 'Other',
};

const CORRECTION_CODE_LABELS: Record<string, string> = {
  TIME_CHANGE: 'Time changed',
  CAREGIVER_CHANGE: 'Caregiver changed',
  CLIENT_CHANGE: 'Client changed',
  TASK_CHANGE: 'Task changed',
  VISIT_ADDED: 'Visit added',
  VISIT_CANCELED: 'Visit canceled',
  VISIT_VERIFIED: 'Visit verified',
  OTHER: 'Other',
};

function extractActionError(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    const body = err.body as { error?: string } | null;
    return body?.error ?? `${fallback} (HTTP ${err.status})`;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Convert a stored ISO instant to the `YYYY-MM-DDThh:mm` value a
 * `datetime-local` input expects (local time). Returns '' when absent/invalid. */
function isoToLocalInput(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a `datetime-local` value back to an ISO instant for the API, or
 * `undefined` when the field is empty — preserving the original payload shape. */
function localInputToIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function VisitCorrectionsQueuePage(): React.JSX.Element {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } =
    useApiResource<ApiResponse<VmurItem[]>>(QUEUE_KEY, '/api/maintenance/queue');
  const [actionError, setActionError] = useState<string | null>(null);

  const serverError =
    data && !data.success ? data.error ?? 'Failed to load corrections queue' : null;
  const showLoadError = isError || Boolean(serverError);
  const loadErrorMessage = serverError ?? 'Failed to load corrections queue';
  const items = data?.data ?? [];

  const approveMutation = useMutation({
    mutationFn: ({ id, args }: ApproveVars) =>
      postJson<ApiResponse<VmurItem>>(`/api/maintenance/approve-unlock/${id}`, args),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      toast.success('Correction approved.');
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
    onError: (err) => setActionError(extractActionError(err, 'Approve failed')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: RejectVars) =>
      postJson<ApiResponse<VmurItem>>(`/api/maintenance/reject-unlock/${id}`, { reason }),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      toast.success('Correction rejected.');
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
    onError: (err) => setActionError(extractActionError(err, 'Reject failed')),
  });

  const isActing = (id?: string): boolean =>
    Boolean(id) &&
    ((approveMutation.isPending && approveMutation.variables?.id === id) ||
      (rejectMutation.isPending && rejectMutation.variables?.id === id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visit corrections review"
        description="Pending VMUR submissions awaiting coordinator review. Caregiver-filed corrections from the mobile app land here alongside coordinator-filed ones."
      />

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Could not complete the request.</strong> {actionError}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" aria-hidden />
            Pending corrections
          </CardTitle>
          <CardDescription>
            {items.length} {items.length === 1 ? 'correction' : 'corrections'} awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showLoadError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                {loadErrorMessage}
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner label="Loading queue" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Queue is clear"
              description="No pending visit corrections for your agency right now."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <CorrectionRow
                  key={item.id ?? item.visitId}
                  item={item}
                  acting={isActing(item.id)}
                  onApprove={(id, args) => approveMutation.mutate({ id, args })}
                  onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----- Row -----

interface CorrectionRowProps {
  item: VmurItem;
  acting: boolean;
  onApprove: (id: string, args: { adjustedStartTime?: string; adjustedEndTime?: string }) => void;
  onReject: (id: string, reason: string) => void;
}

function CorrectionRow({ item, acting, onApprove, onReject }: CorrectionRowProps): React.JSX.Element {
  const [adjustedStart, setAdjustedStart] = useState(isoToLocalInput(item.adjustedStartTime));
  const [adjustedEnd, setAdjustedEnd] = useState(isoToLocalInput(item.adjustedEndTime));
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const id = item.id ?? '';
  const reasonLabel = item.reasonCategoryCode
    ? `${item.reasonCategoryCode} — ${REASON_CODE_LABELS[item.reasonCategoryCode] ?? 'unknown reason code'}`
    : 'No reason code on file';
  const correctionLabel = item.correctionCode
    ? `${item.correctionCode} — ${CORRECTION_CODE_LABELS[item.correctionCode] ?? 'unknown correction code'}`
    : 'No correction code on file';

  const submitApprove = (e: FormEvent): void => {
    e.preventDefault();
    if (!id) return;
    onApprove(id, {
      adjustedStartTime: localInputToIso(adjustedStart),
      adjustedEndTime: localInputToIso(adjustedEnd),
    });
  };

  const submitReject = (e: FormEvent): void => {
    e.preventDefault();
    if (!id) return;
    if (!rejectReason.trim()) return;
    onReject(id, rejectReason.trim());
  };

  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">
              Visit <code className="rounded bg-muted px-1 font-mono text-xs">{item.visitId}</code>
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              Originator: <strong>{item.originatorRole ?? 'unknown'}</strong>
              {' · Requested by '}
              <code className="rounded bg-muted px-1 font-mono text-xs">{item.requesterId}</code>
            </div>
          </div>
          <Badge variant="warning" className="uppercase">Pending</Badge>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Reason">{reasonLabel}</Field>
          <Field label="Correction">{correctionLabel}</Field>
          {item.originalStartTime && (
            <Field label="Original start">{formatTimestamp(item.originalStartTime)}</Field>
          )}
          {item.originalEndTime && (
            <Field label="Original end">{formatTimestamp(item.originalEndTime)}</Field>
          )}
          {item.adjustedStartTime && (
            <Field label="Proposed start">{formatTimestamp(item.adjustedStartTime)}</Field>
          )}
          {item.adjustedEndTime && (
            <Field label="Proposed end">{formatTimestamp(item.adjustedEndTime)}</Field>
          )}
        </div>

        <div className="mt-3 text-sm">
          <strong>Notes:</strong> {item.reason}
        </div>

        <SignatureBlock item={item} />

        {!rejectMode ? (
          <form onSubmit={submitApprove} className="mt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Adjusted start (optional)">
                <Input
                  type="datetime-local"
                  value={adjustedStart}
                  onChange={(e) => setAdjustedStart(e.target.value)}
                />
              </FormField>
              <FormField label="Adjusted end (optional)">
                <Input
                  type="datetime-local"
                  value={adjustedEnd}
                  onChange={(e) => setAdjustedEnd(e.target.value)}
                />
              </FormField>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={acting} aria-busy={acting}>
                {acting ? 'Approving…' : 'Approve correction'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectMode(true)}
                disabled={acting}
              >
                Reject…
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitReject} className="mt-4">
            <FormField label="Rejection reason" required>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                placeholder="e.g. insufficient documentation — please re-file with the visit logs attached."
                required
              />
            </FormField>
            <div className="mt-3 flex gap-2">
              <Button type="submit" variant="destructive" disabled={acting || !rejectReason.trim()} aria-busy={acting}>
                {acting ? 'Rejecting…' : 'Confirm rejection'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRejectMode(false)}
                disabled={acting}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ----- Sub-components -----

interface SignatureBlockProps {
  item: VmurItem;
}
function SignatureBlock({ item }: SignatureBlockProps): React.JSX.Element | null {
  // Only render when signature status is explicitly set on the row —
  // older rows pre-VMUR-upgrade won't have these fields populated.
  if (
    item.caregiverSignaturePresent === undefined &&
    item.clientSignaturePresent === undefined &&
    !item.incompleteSignatureReason
  ) {
    return null;
  }

  const cg = item.caregiverSignaturePresent;
  const cl = item.clientSignaturePresent;

  return (
    <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <div className="text-xs font-semibold text-muted-foreground">Signatures</div>
      <div className="mt-1 flex gap-3 text-sm">
        <SigPill label="Caregiver" present={cg} />
        <SigPill label="Client" present={cl} />
      </div>
      {item.incompleteSignatureReason && (
        <div className="mt-1.5 text-sm">
          <strong>Justification:</strong> {item.incompleteSignatureReason}
        </div>
      )}
    </div>
  );
}

interface SigPillProps {
  label: string;
  present?: boolean;
}
function SigPill({ label, present }: SigPillProps): React.JSX.Element {
  if (present === undefined) {
    return <Badge variant="secondary">{label}: unknown</Badge>;
  }
  if (present) {
    return <Badge variant="success">{label}: ✓ present</Badge>;
  }
  return <Badge variant="destructive">{label}: ✗ missing</Badge>;
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}
function Field({ label, children }: FieldProps): React.JSX.Element {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
