import { useEffect, useState, type ReactElement } from 'react';
import {
  Sparkles,
  Bell,
  Network,
  Building2,
  Users,
} from 'lucide-react';
import { getJson, postJson, HttpError } from '../../lib/api-client.js';
import { useAuth } from '../../lib/AuthContext.js';
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
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const optionCard = (active: boolean): string =>
  cn(
    'flex flex-1 min-w-[200px] cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
    active
      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
      : 'border-border hover:bg-muted/50',
  );

const toggleRowClass =
  'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm';

const successMessageClass =
  'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800';

const errorMessageClass =
  'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive';

const readOnlyNoticeClass =
  'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800';

function EmptyState({ message }: { message: string }): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <Users className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Agency Settings — admin-only configuration surface. Currently houses the
 * AI Workflow Copilot add-on toggle. Future sections (notification policy,
 * brand customization, billing) hang off the same page.
 *
 * The page is reachable from any nav entry but the AI Copilot section
 * specifically renders a read-only "Owner-only" notice for non-admins,
 * matching the brand requirement that billing controls are private.
 */

type AiCopilotPlan = 'off' | 'starter' | 'pro';
type NotificationDigest = 'off' | 'daily' | 'weekly';

interface AiCopilotFlag {
  enabled: boolean;
  plan: AiCopilotPlan;
}

interface NotificationsFlag {
  coordinatorDigest: NotificationDigest;
  caregiverPush: boolean;
  caregiverEmail: boolean;
  familyEmail: boolean;
}

interface AgencyFeatures {
  aiCopilot: AiCopilotFlag;
  notifications: NotificationsFlag;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Plain fetch with PUT — postJson is hardcoded to POST. Sharing the CSRF logic
// inline keeps this file readable without adding a putJson to api-client.
async function putJson<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = readCsrfToken();
  const response = await fetch(path, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let parsed: unknown = null;
    try { parsed = await response.json(); } catch { /* swallow */ }
    throw new HttpError(response.status, parsed, `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function readCsrfToken(): string | null {
  // Same source the rest of the app uses; duplicated to avoid coupling
  // this page to session-state internals.
  const meta = document.cookie.split(';').find((c) => c.trim().startsWith('rayhealth_csrf='));
  return meta ? decodeURIComponent(meta.split('=')[1] ?? '') : null;
}

export function AgencySettingsPage(): ReactElement {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [features, setFeatures] = useState<AgencyFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<AgencyFeatures>>('/api/agencies/me/features');
        if (cancelled) return;
        if (response.success && response.data) {
          setFeatures(response.data);
        } else {
          setError(response.error ?? 'Failed to load features');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load features');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveFeatures = async (next: AgencyFeatures): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<AgencyFeatures>>('/api/agencies/me/features', next);
      if (response.success && response.data) {
        setFeatures(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change agency features.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleCopilot = (): void => {
    if (!features) return;
    const next: AgencyFeatures = {
      ...features,
      aiCopilot: {
        ...features.aiCopilot,
        enabled: !features.aiCopilot.enabled,
        // When enabling for the first time, default to starter.
        plan: features.aiCopilot.enabled ? 'off' : (features.aiCopilot.plan === 'off' ? 'starter' : features.aiCopilot.plan),
      },
    };
    void saveFeatures(next);
  };

  const setPlan = (plan: AiCopilotPlan): void => {
    if (!features) return;
    void saveFeatures({
      ...features,
      aiCopilot: { ...features.aiCopilot, plan, enabled: plan !== 'off' },
    });
  };

  return (
    <div>
      <PageHeader
        title="Agency Settings"
        description="Per-agency configuration. Add-on entitlements visible only to admins."
      />

      <div className="space-y-6">
        {loading && <p className="text-sm text-muted-foreground">Loading settings…</p>}

        {error && (
          <div role="alert" className={errorMessageClass}>
            <strong>Could not save.</strong> {error}
          </div>
        )}

        {features && (
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" aria-hidden />
                  AI Workflow Copilot
                </CardTitle>
                <CardDescription className="max-w-[480px]">
                  Per-role assistants (caregiver, coordinator, owner) backed by Google Gemini.
                  Every action proposed by the copilot requires admin confirmation before executing.
                </CardDescription>
              </div>
              <Badge variant={features.aiCopilot.enabled ? 'success' : 'secondary'}>
                {features.aiCopilot.enabled ? 'Active' : 'Off'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAdmin && (
                <div className={readOnlyNoticeClass}>
                  <strong>Owner-only setting.</strong> Only an agency admin can enable or change this add-on.
                </div>
              )}

              {isAdmin && (
                <div className="flex flex-col gap-4">
                  <label className={toggleRowClass}>
                    <input
                      type="checkbox"
                      checked={features.aiCopilot.enabled}
                      onChange={toggleCopilot}
                      disabled={saving}
                      className="mt-0.5 size-[18px]"
                    />
                    <span>
                      <strong>Enable AI Copilot for this agency</strong>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        When off, the panel is visible on the Learning Hub but locked.
                      </div>
                    </span>
                  </label>

                  <fieldset
                    className="rounded-lg border border-border p-4 disabled:opacity-60"
                    disabled={!features.aiCopilot.enabled || saving}
                  >
                    <legend className="px-1 text-sm font-medium text-muted-foreground">Plan</legend>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {(['starter', 'pro'] as AiCopilotPlan[]).map((p) => (
                        <label key={p} className={optionCard(features.aiCopilot.plan === p)}>
                          <input
                            type="radio"
                            name="copilot-plan"
                            value={p}
                            checked={features.aiCopilot.plan === p}
                            onChange={() => setPlan(p)}
                            disabled={!features.aiCopilot.enabled || saving}
                            className="mt-0.5"
                          />
                          <span>
                            <strong>{p === 'pro' ? 'Pro' : 'Starter'}</strong>
                            <div className="text-xs text-muted-foreground">
                              {p === 'starter'
                                ? 'Compliance copilot + per-role suggestions'
                                : 'Adds workflow agents that propose multi-step actions'}
                            </div>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {savedAt && (
                <p className="text-right text-xs text-muted-foreground">
                  Saved {savedAt.toLocaleTimeString()}.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {features && (
          <NotificationsSection
            features={features}
            isAdmin={isAdmin}
            saving={saving}
            onChange={saveFeatures}
          />
        )}

        <EvvAggregatorSection isAdmin={isAdmin} />
        <SandataConfigSection isAdmin={isAdmin} />
        <HhaexchangeConfigSection isAdmin={isAdmin} />
      </div>
    </div>
  );
}

// ---------- Sandata config section ----------

interface SandataCaregiverMapping {
  caregiverId: string;
  externalWorkerId: string;
}

interface SandataServiceMapping {
  internalServiceCode: string;
  hcpcsCode: string;
  hcpcsModifier: string;
  label: string;
}

interface SandataPartial {
  agencyId: string;
  providerId: string | null;
  timezone: string;
  caregivers: SandataCaregiverMapping[];
  services: SandataServiceMapping[];
  enabled: boolean;
}

interface SandataConfigSectionProps {
  isAdmin: boolean;
}

function SandataConfigSection({ isAdmin }: SandataConfigSectionProps): ReactElement {
  const [config, setConfig] = useState<SandataPartial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [providerId, setProviderId] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<SandataPartial>>('/api/agencies/me/sandata-config');
        if (cancelled) return;
        if (response.success && response.data) {
          setConfig(response.data);
          setProviderId(response.data.providerId ?? '');
          setTimezone(response.data.timezone);
        } else {
          setError(response.error ?? 'Failed to load Sandata config');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Sandata config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (patch: Partial<{
    providerId: string | null;
    timezone: string;
    enabled: boolean;
    caregivers: SandataCaregiverMapping[];
    services: SandataServiceMapping[];
  }>): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<SandataPartial>>('/api/agencies/me/sandata-config', patch);
      if (response.success && response.data) {
        setConfig(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Cannot enable until providerId is set.');
      } else if (err instanceof HttpError && err.status === 400) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Validation failed.');
      } else if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change Sandata config.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const submitIdentity = (e: React.FormEvent): void => {
    e.preventDefault();
    void save({
      providerId: providerId.trim() || null,
      timezone: timezone.trim() || 'America/New_York',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading Sandata configuration…</p>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent>
          {error && <div role="alert" className={errorMessageClass}>{error}</div>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Network className="size-5 text-primary" aria-hidden />
            Sandata identity & mappings
          </CardTitle>
          <CardDescription className="max-w-[480px]">
            Sandata Provider ID is a 9-digit numeric identifier assigned by Sandata when your
            agency registers with the PA Aggregator (or your state's Sandata-backed program).
            Per-caregiver external worker IDs and HCPCS service mappings drive the visit export.
          </CardDescription>
        </div>
        <Badge variant={config.enabled ? 'success' : 'secondary'}>
          {config.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className={errorMessageClass}>
            <strong>Could not save.</strong> {error}
          </div>
        )}

        {!isAdmin && (
          <div className={readOnlyNoticeClass}>
            <strong>Owner-only setting.</strong> Only an agency admin can change Sandata config.
          </div>
        )}

        <form onSubmit={submitIdentity} className="flex flex-col gap-3.5">
          <fieldset className="rounded-lg border border-border p-4 disabled:opacity-60" disabled={!isAdmin || saving}>
            <legend className="px-1 text-sm font-medium text-muted-foreground">Identity</legend>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sandata-provider-id">Provider ID (9 digits)</Label>
                <Input
                  id="sandata-provider-id"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{9}"
                  maxLength={9}
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456789"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sandata-timezone">Timezone</Label>
                <Input
                  id="sandata-timezone"
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/New_York"
                />
              </div>
            </div>
            <div className="mt-3">
              <Button type="submit" disabled={!isAdmin || saving}>
                {saving ? 'Saving…' : 'Save identity'}
              </Button>
            </div>
          </fieldset>
        </form>

        {isAdmin && (
          <label className={toggleRowClass}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => void save({ enabled: e.target.checked })}
              disabled={saving || (!config.providerId && !config.enabled)}
              className="mt-0.5 size-[18px]"
            />
            <span>
              <strong>Enable Sandata export</strong>
              <div className="mt-0.5 text-sm text-muted-foreground">
                When off, the export pipeline emits no rows to Sandata. Toggling on requires
                Provider ID to be populated above.
              </div>
            </span>
          </label>
        )}

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Badge variant="outline">{config.caregivers.length}</Badge> caregiver mapping{config.caregivers.length === 1 ? '' : 's'}
          {' · '}
          <Badge variant="outline">{config.services.length}</Badge> service mapping{config.services.length === 1 ? '' : 's'}
        </p>

        {isAdmin && (
          <SandataCaregiverMappingsEditor
            mappings={config.caregivers}
            saving={saving}
            onCommit={(next) => save({ caregivers: next })}
          />
        )}

        {isAdmin && (
          <SandataServiceMappingsEditor
            mappings={config.services}
            saving={saving}
            onCommit={(next) => save({ services: next })}
          />
        )}

        {savedAt && (
          <p className="text-right text-xs text-muted-foreground">
            Saved {savedAt.toLocaleTimeString()}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Sandata caregiver mappings editor ----------

interface SandataCaregiverMappingsEditorProps {
  mappings: SandataCaregiverMapping[];
  saving: boolean;
  onCommit: (next: SandataCaregiverMapping[]) => Promise<void>;
}

function SandataCaregiverMappingsEditor({
  mappings,
  saving,
  onCommit,
}: SandataCaregiverMappingsEditorProps): ReactElement {
  const [caregivers, setCaregivers] = useState<CaregiverOption[]>([]);
  const [pickedCaregiverId, setPickedCaregiverId] = useState('');
  const [newWorkerId, setNewWorkerId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CaregiverOption[]>>('/api/staff');
        if (cancelled) return;
        if (response.success && Array.isArray(response.data)) {
          setCaregivers(response.data);
        }
      } catch {
        /* roster lookup is a convenience */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const nameFor = (caregiverId: string): string => {
    const cg = caregivers.find((c) => c.id === caregiverId);
    if (!cg) return caregiverId.slice(0, 8) + '…';
    return `${cg.firstName} ${cg.lastName}`.trim();
  };

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!pickedCaregiverId || !newWorkerId.trim()) {
      setLocalError('Pick a caregiver and enter an external worker ID.');
      return;
    }
    if (mappings.some((m) => m.caregiverId === pickedCaregiverId)) {
      setLocalError('That caregiver already has an external worker ID — remove first to change.');
      return;
    }
    const next: SandataCaregiverMapping[] = [
      ...mappings,
      { caregiverId: pickedCaregiverId, externalWorkerId: newWorkerId.trim() },
    ];
    await onCommit(next);
    setPickedCaregiverId('');
    setNewWorkerId('');
  };

  const removeMapping = async (caregiverId: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.caregiverId !== caregiverId);
    await onCommit(next);
  };

  const unmappedCaregivers = caregivers.filter(
    (c) => !mappings.some((m) => m.caregiverId === c.id),
  );

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-semibold">Caregiver mappings</h4>
      <p className="mb-2.5 text-xs text-muted-foreground">
        Map each RayHealth caregiver to their Sandata External Worker ID. Visits for unmapped
        caregivers are skipped at export time.
      </p>

      {localError && (
        <div role="alert" className={cn(errorMessageClass, 'mb-2')}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Caregiver</TableHead>
                <TableHead>External Worker ID</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.caregiverId}>
                  <TableCell className="font-medium">{nameFor(m.caregiverId)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{m.externalWorkerId}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeMapping(m.caregiverId)}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mb-3">
          <EmptyState message="No caregiver mappings yet." />
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="sandata-cg-pick">Caregiver</Label>
          <Select
            id="sandata-cg-pick"
            value={pickedCaregiverId}
            onChange={(e) => setPickedCaregiverId(e.target.value)}
            disabled={saving}
          >
            <option value="">— pick a caregiver —</option>
            {unmappedCaregivers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="sandata-cg-worker">External Worker ID</Label>
          <Input
            id="sandata-cg-worker"
            type="text"
            value={newWorkerId}
            onChange={(e) => setNewWorkerId(e.target.value)}
            placeholder="EW-1234"
            maxLength={32}
            disabled={saving}
            className="font-mono"
          />
        </div>
        <Button
          onClick={() => void addMapping()}
          disabled={saving || !pickedCaregiverId || !newWorkerId.trim()}
        >
          Add mapping
        </Button>
      </div>
    </div>
  );
}

// ---------- Sandata service mappings editor ----------

const HCPCS_MODIFIERS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9'] as const;

interface SandataServiceMappingsEditorProps {
  mappings: SandataServiceMapping[];
  saving: boolean;
  onCommit: (next: SandataServiceMapping[]) => Promise<void>;
}

function SandataServiceMappingsEditor({
  mappings,
  saving,
  onCommit,
}: SandataServiceMappingsEditorProps): ReactElement {
  const [internalCode, setInternalCode] = useState('');
  const [hcpcsCode, setHcpcsCode] = useState('T1019');
  const [hcpcsModifier, setHcpcsModifier] = useState<typeof HCPCS_MODIFIERS[number]>('U4');
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!internalCode.trim() || !hcpcsCode.trim() || !label.trim()) {
      setLocalError('All fields are required.');
      return;
    }
    if (!/^[A-Z]\d{4}$/.test(hcpcsCode.trim())) {
      setLocalError('HCPCS code must be 1 letter + 4 digits (e.g. T1019).');
      return;
    }
    if (mappings.some((m) => m.internalServiceCode === internalCode.trim())) {
      setLocalError('That internal service code is already mapped — remove first to change.');
      return;
    }
    const next: SandataServiceMapping[] = [
      ...mappings,
      {
        internalServiceCode: internalCode.trim(),
        hcpcsCode: hcpcsCode.trim().toUpperCase(),
        hcpcsModifier,
        label: label.trim(),
      },
    ];
    await onCommit(next);
    setInternalCode('');
    setLabel('');
  };

  const removeMapping = async (code: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.internalServiceCode !== code);
    await onCommit(next);
  };

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-semibold">Service mappings</h4>
      <p className="mb-2.5 text-xs text-muted-foreground">
        Map each RayHealth internal service code to a Sandata HCPCS code + modifier.
        PA typically uses T1019 + U4 (personal care), U5 (respite), U7 (companion).
      </p>

      {localError && (
        <div role="alert" className={cn(errorMessageClass, 'mb-2')}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Internal</TableHead>
                <TableHead>HCPCS</TableHead>
                <TableHead>Modifier</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.internalServiceCode}>
                  <TableCell className="font-mono">{m.internalServiceCode}</TableCell>
                  <TableCell className="font-mono">{m.hcpcsCode}</TableCell>
                  <TableCell className="font-mono">{m.hcpcsModifier}</TableCell>
                  <TableCell>{m.label}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeMapping(m.internalServiceCode)}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mb-3">
          <EmptyState message="No service mappings yet." />
        </div>
      )}

      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="sandata-svc-internal">Internal code</Label>
          <Input
            id="sandata-svc-internal"
            type="text"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            placeholder="PERSONAL_CARE"
            disabled={saving}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sandata-svc-hcpcs">HCPCS code</Label>
          <Input
            id="sandata-svc-hcpcs"
            type="text"
            value={hcpcsCode}
            onChange={(e) => setHcpcsCode(e.target.value.toUpperCase())}
            placeholder="T1019"
            maxLength={5}
            disabled={saving}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sandata-svc-modifier">Modifier</Label>
          <Select
            id="sandata-svc-modifier"
            value={hcpcsModifier}
            onChange={(e) => setHcpcsModifier(e.target.value as typeof HCPCS_MODIFIERS[number])}
            disabled={saving}
          >
            {HCPCS_MODIFIERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sandata-svc-label">Label</Label>
          <Input
            id="sandata-svc-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Personal Care"
            disabled={saving}
          />
        </div>
        <Button
          onClick={() => void addMapping()}
          disabled={saving || !internalCode.trim() || !hcpcsCode.trim() || !label.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ---------- EVV aggregator section ----------

type EvvAggregatorValue = 'sandata' | 'hhaexchange' | 'none';

interface EvvConfig {
  agencyId: string;
  aggregator: EvvAggregatorValue;
  stateCode: string;
  productionReady: boolean;
  choiceAvailable: boolean;
  stateDefaultAggregator: EvvAggregatorValue;
}

interface EvvAggregatorSectionProps {
  isAdmin: boolean;
}

function EvvAggregatorSection({ isAdmin }: EvvAggregatorSectionProps): ReactElement {
  const [config, setConfig] = useState<EvvConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<EvvConfig>>('/api/agencies/me/evv-config');
        if (cancelled) return;
        if (response.success && response.data) {
          setConfig(response.data);
        } else {
          setError(response.error ?? 'Failed to load EVV config');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load EVV config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (next: { aggregator: EvvAggregatorValue; productionReady?: boolean }): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<EvvConfig>>('/api/agencies/me/evv-config', next);
      if (response.success && response.data) {
        setConfig(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'This change is not allowed for your state.');
      } else if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change the EVV aggregator.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading EVV configuration…</p>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent>
          {error && <div role="alert" className={errorMessageClass}>{error}</div>}
        </CardContent>
      </Card>
    );
  }

  const choices: Array<{ value: EvvAggregatorValue; label: string; sub: string }> = [
    { value: 'sandata', label: 'Sandata', sub: 'PA, NY, OH (default), MA, GA — Provider ID required' },
    { value: 'hhaexchange', label: 'HHAeXchange', sub: 'NJ (sole), available in PA — Tax ID + Provider ID required' },
    { value: 'none', label: 'Not configured', sub: 'Exports stay in dry-run until set.' },
  ];

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Network className="size-5 text-primary" aria-hidden />
            EVV aggregator
          </CardTitle>
          <CardDescription className="max-w-[480px]">
            Selects which state-mandated EVV aggregator the visit export pipeline routes
            to for this agency. Mappings and Provider IDs live in their own sections.
            State: <strong>{config.stateCode}</strong>
            {!config.choiceAvailable && (
              <> — your state forces <strong>{config.stateDefaultAggregator}</strong>.</>
            )}
          </CardDescription>
        </div>
        <Badge variant={config.productionReady ? 'success' : 'secondary'}>
          {config.productionReady ? 'Production' : 'Dry-run'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className={errorMessageClass}>
            <strong>Could not save.</strong> {error}
          </div>
        )}

        {!isAdmin && (
          <div className={readOnlyNoticeClass}>
            <strong>Owner-only setting.</strong> Only an agency admin can change the EVV aggregator.
          </div>
        )}

        <fieldset
          className="rounded-lg border border-border p-4 disabled:opacity-60"
          disabled={!isAdmin || saving || !config.choiceAvailable}
        >
          <legend className="px-1 text-sm font-medium text-muted-foreground">
            Aggregator
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {choices.map((c) => (
              <label key={c.value} className={optionCard(config.aggregator === c.value)}>
                <input
                  type="radio"
                  name="evv-aggregator"
                  value={c.value}
                  checked={config.aggregator === c.value}
                  onChange={() => void save({ aggregator: c.value })}
                  disabled={!isAdmin || saving || !config.choiceAvailable}
                  className="mt-0.5"
                />
                <span>
                  <strong>{c.label}</strong>
                  <div className="text-xs text-muted-foreground">{c.sub}</div>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {isAdmin && config.aggregator !== 'none' && (
          <label className={toggleRowClass}>
            <input
              type="checkbox"
              checked={config.productionReady}
              onChange={(e) => void save({
                aggregator: config.aggregator,
                productionReady: e.target.checked,
              })}
              disabled={saving}
              className="mt-0.5 size-[18px]"
            />
            <span>
              <strong>Production-ready</strong>
              <div className="mt-0.5 text-sm text-muted-foreground">
                When off, the export pipeline runs in dry-run — visits are validated against
                the aggregator's spec but no submission file is generated. Flip on once your
                Provider ID is registered and mappings are populated.
              </div>
            </span>
          </label>
        )}

        {savedAt && (
          <p className="text-right text-xs text-muted-foreground">
            Saved {savedAt.toLocaleTimeString()}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Notifications section ----------

interface NotificationsSectionProps {
  features: AgencyFeatures;
  isAdmin: boolean;
  saving: boolean;
  onChange: (next: AgencyFeatures) => void | Promise<void>;
}

function NotificationsSection({ features, isAdmin, saving, onChange }: NotificationsSectionProps): ReactElement {
  const n = features.notifications;

  const update = (patch: Partial<NotificationsFlag>): void => {
    void onChange({
      ...features,
      notifications: { ...n, ...patch },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-5 text-primary" aria-hidden />
          Notifications
        </CardTitle>
        <CardDescription className="max-w-[480px]">
          Coordinator digests, caregiver push, family email. v2 stub — preferences persist but
          delivery wires up when the notification service ships.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin && (
          <div className={readOnlyNoticeClass}>
            <strong>Owner-only setting.</strong> Only agency admins can change notification preferences.
          </div>
        )}

        <fieldset className="rounded-lg border border-border p-4 disabled:opacity-60" disabled={!isAdmin || saving}>
          <legend className="px-1 text-sm font-medium text-muted-foreground">Coordinator digest</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(['off', 'daily', 'weekly'] as NotificationDigest[]).map((d) => (
              <label key={d} className={optionCard(n.coordinatorDigest === d)}>
                <input
                  type="radio"
                  name="coordinator-digest"
                  value={d}
                  checked={n.coordinatorDigest === d}
                  onChange={() => update({ coordinatorDigest: d })}
                  disabled={!isAdmin || saving}
                  className="mt-0.5"
                />
                <strong>{d === 'off' ? 'Off' : d === 'daily' ? 'Daily' : 'Weekly'}</strong>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2.5">
          <label className={toggleRowClass}>
            <input
              type="checkbox"
              checked={n.caregiverPush}
              onChange={(e) => update({ caregiverPush: e.target.checked })}
              disabled={!isAdmin || saving}
              className="mt-0.5 size-[18px]"
            />
            <span>
              <strong>Caregiver push notifications</strong>
              <div className="mt-0.5 text-sm text-muted-foreground">
                Visit reminders, training due-soon, schedule changes — pushed to the caregiver mobile app.
              </div>
            </span>
          </label>

          <label className={toggleRowClass}>
            <input
              type="checkbox"
              checked={n.caregiverEmail}
              onChange={(e) => update({ caregiverEmail: e.target.checked })}
              disabled={!isAdmin || saving}
              className="mt-0.5 size-[18px]"
            />
            <span>
              <strong>Caregiver email</strong>
              <div className="mt-0.5 text-sm text-muted-foreground">
                Same content as push, delivered by email for caregivers who prefer email.
              </div>
            </span>
          </label>

          <label className={toggleRowClass}>
            <input
              type="checkbox"
              checked={n.familyEmail}
              onChange={(e) => update({ familyEmail: e.target.checked })}
              disabled={!isAdmin || saving}
              className="mt-0.5 size-[18px]"
            />
            <span>
              <strong>Family email</strong>
              <div className="mt-0.5 text-sm text-muted-foreground">
                Daily visit summary emails to family members on the client's authorized contact list.
                Requires family-portal opt-in per client.
              </div>
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- HHAeXchange config section ----------

interface HhaexchangeCaregiverMapping {
  caregiverId: string;
  employeeId: string;
}

interface HhaexchangeServiceMapping {
  internalServiceCode: string;
  hhaServiceCode: string;
  label: string;
}

interface HhaexchangePartial {
  agencyId: string;
  agencyTaxId: string | null;
  hhaProviderId: string | null;
  timezone: string;
  caregivers: HhaexchangeCaregiverMapping[];
  services: HhaexchangeServiceMapping[];
  enabled: boolean;
}

interface HhaexchangeConfigSectionProps {
  isAdmin: boolean;
}

function HhaexchangeConfigSection({ isAdmin }: HhaexchangeConfigSectionProps): ReactElement {
  const [config, setConfig] = useState<HhaexchangePartial | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Form state — initialized from the stored config on load.
  const [taxId, setTaxId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<HhaexchangePartial>>(
          '/api/agencies/me/hhaexchange-config',
        );
        if (cancelled) return;
        if (response.success && response.data) {
          setConfig(response.data);
          setTaxId(response.data.agencyTaxId ?? '');
          setProviderId(response.data.hhaProviderId ?? '');
          setTimezone(response.data.timezone);
        } else {
          setError(response.error ?? 'Failed to load HHAeXchange config');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load HHAeXchange config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (patch: Partial<{
    agencyTaxId: string | null;
    hhaProviderId: string | null;
    timezone: string;
    enabled: boolean;
  }>): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<HhaexchangePartial>>(
        '/api/agencies/me/hhaexchange-config',
        patch,
      );
      if (response.success && response.data) {
        setConfig(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Cannot enable until identity fields are set.');
      } else if (err instanceof HttpError && err.status === 400) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Validation failed.');
      } else if (err instanceof HttpError && err.status === 403) {
        setError('Only admins can change HHAeXchange config.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const submitIdentity = (e: React.FormEvent): void => {
    e.preventDefault();
    void save({
      agencyTaxId: taxId.trim() || null,
      hhaProviderId: providerId.trim() || null,
      timezone: timezone.trim() || 'America/New_York',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading HHAeXchange configuration…</p>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent>
          {error && <div role="alert" className={errorMessageClass}>{error}</div>}
        </CardContent>
      </Card>
    );
  }

  const identityComplete = Boolean(config.agencyTaxId && config.hhaProviderId);

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" aria-hidden />
            HHAeXchange identity & mappings
          </CardTitle>
          <CardDescription className="max-w-[480px]">
            Required for NJ and any PA agency that picks HHAeXchange. The agency Tax ID
            (EIN, 9 digits no dash) and HHAeXchange Provider ID are issued by HHAeXchange
            when your agency registers. Caregiver and service mappings are managed
            elsewhere — this section covers identity and the master enable switch.
          </CardDescription>
        </div>
        <Badge variant={config.enabled ? 'success' : 'secondary'}>
          {config.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className={errorMessageClass}>
            <strong>Could not save.</strong> {error}
          </div>
        )}

        {!isAdmin && (
          <div className={readOnlyNoticeClass}>
            <strong>Owner-only setting.</strong> Only an agency admin can change HHAeXchange config.
          </div>
        )}

        <form onSubmit={submitIdentity} className="flex flex-col gap-3.5">
          <fieldset className="rounded-lg border border-border p-4 disabled:opacity-60" disabled={!isAdmin || saving}>
            <legend className="px-1 text-sm font-medium text-muted-foreground">Identity</legend>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hha-tax-id">Agency Tax ID (EIN, 9 digits)</Label>
                <Input
                  id="hha-tax-id"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{9}"
                  maxLength={9}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456789"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hha-provider-id">HHAeXchange Provider ID</Label>
                <Input
                  id="hha-provider-id"
                  type="text"
                  maxLength={32}
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="P-100"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="hha-timezone">Timezone</Label>
              <Input
                id="hha-timezone"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/New_York"
              />
            </div>
            <div className="mt-3">
              <Button type="submit" disabled={!isAdmin || saving}>
                {saving ? 'Saving…' : 'Save identity'}
              </Button>
            </div>
          </fieldset>
        </form>

        {isAdmin && (
          <label className={toggleRowClass}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => void save({ enabled: e.target.checked })}
              disabled={saving || (!identityComplete && !config.enabled)}
              className="mt-0.5 size-[18px]"
            />
            <span>
              <strong>Enable HHAeXchange export</strong>
              <div className="mt-0.5 text-sm text-muted-foreground">
                When off, the export pipeline emits no rows to HHAeXchange even if the EVV
                aggregator picker is set to HHAeXchange. Toggling on requires Tax ID and
                Provider ID to be populated above.
              </div>
            </span>
          </label>
        )}

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Badge variant="outline">{config.caregivers.length}</Badge> caregiver mapping{config.caregivers.length === 1 ? '' : 's'}
          {' · '}
          <Badge variant="outline">{config.services.length}</Badge> service mapping{config.services.length === 1 ? '' : 's'}
        </p>

        {isAdmin && (
          <HhaexchangeCaregiverMappingsEditor
          mappings={config.caregivers}
          saving={saving}
          onCommit={async (nextCaregivers) => {
            setSaving(true);
            setError(null);
            try {
              const response = await putJson<ApiResponse<HhaexchangePartial>>(
                '/api/agencies/me/hhaexchange-config',
                { caregivers: nextCaregivers },
              );
              if (response.success && response.data) {
                setConfig(response.data);
                setSavedAt(new Date());
              } else {
                setError(response.error ?? 'Failed to save caregiver mappings');
              }
            } catch (err) {
              if (err instanceof HttpError && err.status === 400) {
                const body = err.body as { error?: string } | null;
                setError(body?.error ?? 'Caregiver mapping validation failed.');
              } else {
                setError(err instanceof Error ? err.message : 'Failed to save caregiver mappings');
              }
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {isAdmin && (
        <HhaexchangeServiceMappingsEditor
          mappings={config.services}
          saving={saving}
          onCommit={async (nextServices) => {
            setSaving(true);
            setError(null);
            try {
              const response = await putJson<ApiResponse<HhaexchangePartial>>(
                '/api/agencies/me/hhaexchange-config',
                { services: nextServices },
              );
              if (response.success && response.data) {
                setConfig(response.data);
                setSavedAt(new Date());
              } else {
                setError(response.error ?? 'Failed to save service mappings');
              }
            } catch (err) {
              if (err instanceof HttpError && err.status === 400) {
                const body = err.body as { error?: string } | null;
                setError(body?.error ?? 'Service mapping validation failed.');
              } else {
                setError(err instanceof Error ? err.message : 'Failed to save service mappings');
              }
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

        {savedAt && (
          <p className="text-right text-xs text-muted-foreground">
            Saved {savedAt.toLocaleTimeString()}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Caregiver mappings editor ----------

interface CaregiverOption {
  id: string;
  firstName: string;
  lastName: string;
  status?: string;
}

interface CaregiverMappingsEditorProps {
  mappings: HhaexchangeCaregiverMapping[];
  saving: boolean;
  onCommit: (next: HhaexchangeCaregiverMapping[]) => Promise<void>;
}

function HhaexchangeCaregiverMappingsEditor({
  mappings,
  saving,
  onCommit,
}: CaregiverMappingsEditorProps): ReactElement {
  const [caregivers, setCaregivers] = useState<CaregiverOption[]>([]);
  const [pickedCaregiverId, setPickedCaregiverId] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CaregiverOption[]>>('/api/staff');
        if (cancelled) return;
        if (response.success && Array.isArray(response.data)) {
          setCaregivers(response.data);
        }
      } catch {
        // Roster lookup is a convenience — UI still works with raw UUIDs if needed.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const nameFor = (caregiverId: string): string => {
    const cg = caregivers.find((c) => c.id === caregiverId);
    if (!cg) return caregiverId.slice(0, 8) + '…';
    return `${cg.firstName} ${cg.lastName}`.trim();
  };

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!pickedCaregiverId || !newEmployeeId.trim()) {
      setLocalError('Pick a caregiver and enter an employee ID.');
      return;
    }
    if (mappings.some((m) => m.caregiverId === pickedCaregiverId)) {
      setLocalError('That caregiver already has an employee ID mapped — remove it first to change.');
      return;
    }
    const next: HhaexchangeCaregiverMapping[] = [
      ...mappings,
      { caregiverId: pickedCaregiverId, employeeId: newEmployeeId.trim() },
    ];
    await onCommit(next);
    setPickedCaregiverId('');
    setNewEmployeeId('');
  };

  const removeMapping = async (caregiverId: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.caregiverId !== caregiverId);
    await onCommit(next);
  };

  const unmappedCaregivers = caregivers.filter(
    (c) => !mappings.some((m) => m.caregiverId === c.id),
  );

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-semibold">Caregiver mappings</h4>
      <p className="mb-2.5 text-xs text-muted-foreground">
        Map each RayHealth caregiver to their HHAeXchange Employee ID. Without these,
        the export pipeline can't emit rows for that caregiver.
      </p>

      {localError && (
        <div role="alert" className={cn(errorMessageClass, 'mb-2')}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Caregiver</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.caregiverId}>
                  <TableCell className="font-medium">{nameFor(m.caregiverId)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{m.employeeId}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeMapping(m.caregiverId)}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mb-3">
          <EmptyState message="No caregiver mappings yet." />
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="hha-cg-pick">Caregiver</Label>
          <Select
            id="hha-cg-pick"
            value={pickedCaregiverId}
            onChange={(e) => setPickedCaregiverId(e.target.value)}
            disabled={saving}
          >
            <option value="">— pick a caregiver —</option>
            {unmappedCaregivers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="hha-cg-employee">HHAeXchange Employee ID</Label>
          <Input
            id="hha-cg-employee"
            type="text"
            value={newEmployeeId}
            onChange={(e) => setNewEmployeeId(e.target.value)}
            placeholder="E-1234"
            maxLength={32}
            disabled={saving}
            className="font-mono"
          />
        </div>
        <Button
          onClick={() => void addMapping()}
          disabled={saving || !pickedCaregiverId || !newEmployeeId.trim()}
        >
          Add mapping
        </Button>
      </div>
    </div>
  );
}

// ---------- Service mappings editor ----------

interface ServiceMappingsEditorProps {
  mappings: HhaexchangeServiceMapping[];
  saving: boolean;
  onCommit: (next: HhaexchangeServiceMapping[]) => Promise<void>;
}

function HhaexchangeServiceMappingsEditor({
  mappings,
  saving,
  onCommit,
}: ServiceMappingsEditorProps): ReactElement {
  const [internalCode, setInternalCode] = useState('');
  const [hhaServiceCode, setHhaServiceCode] = useState('');
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!internalCode.trim() || !hhaServiceCode.trim() || !label.trim()) {
      setLocalError('All three fields are required.');
      return;
    }
    if (mappings.some((m) => m.internalServiceCode === internalCode.trim())) {
      setLocalError('That internal service code is already mapped — remove it first to change.');
      return;
    }
    const next: HhaexchangeServiceMapping[] = [
      ...mappings,
      {
        internalServiceCode: internalCode.trim(),
        hhaServiceCode: hhaServiceCode.trim(),
        label: label.trim(),
      },
    ];
    await onCommit(next);
    setInternalCode('');
    setHhaServiceCode('');
    setLabel('');
  };

  const removeMapping = async (code: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m.internalServiceCode !== code);
    await onCommit(next);
  };

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-semibold">Service mappings</h4>
      <p className="mb-2.5 text-xs text-muted-foreground">
        Map each RayHealth internal service code to the HHAeXchange service code your
        state Medicaid program assigned for that service. Visits with unmapped service
        codes are skipped at export time.
      </p>

      {localError && (
        <div role="alert" className={cn(errorMessageClass, 'mb-2')}>{localError}</div>
      )}

      {mappings.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Internal code</TableHead>
                <TableHead>HHA code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.internalServiceCode}>
                  <TableCell className="font-mono">{m.internalServiceCode}</TableCell>
                  <TableCell className="font-mono">{m.hhaServiceCode}</TableCell>
                  <TableCell>{m.label}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeMapping(m.internalServiceCode)}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mb-3">
          <EmptyState message="No service mappings yet." />
        </div>
      )}

      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="hha-svc-internal">Internal code</Label>
          <Input
            id="hha-svc-internal"
            type="text"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            placeholder="PERSONAL_CARE"
            disabled={saving}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hha-svc-code">HHAeXchange code</Label>
          <Input
            id="hha-svc-code"
            type="text"
            value={hhaServiceCode}
            onChange={(e) => setHhaServiceCode(e.target.value)}
            placeholder="1051"
            maxLength={16}
            disabled={saving}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hha-svc-label">Label</Label>
          <Input
            id="hha-svc-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Personal Care"
            disabled={saving}
          />
        </div>
        <Button
          onClick={() => void addMapping()}
          disabled={saving || !internalCode.trim() || !hhaServiceCode.trim() || !label.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// Silence unused-import warning — postJson stays imported in case the
// settings page grows to need a non-PUT mutation later.
void postJson;
