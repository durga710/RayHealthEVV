import React, { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import {
  Sparkles,
  Bell,
  Network,
  Building2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getJson, putJson, HttpError } from '../../lib/api-client.js';
import { useApiResource } from '../../lib/use-api-resource.js';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FormField } from '@/components/patterns/form-field';
import { EmptyState } from '@/components/patterns/empty-state';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const optionCard = (active: boolean): string =>
  cn(
    'flex flex-1 min-w-[200px] cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
    active
      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
      : 'border-border hover:bg-muted/50',
  );

const toggleRowClass =
  'flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm';

/**
 * Agency Settings — admin-only configuration surface. Houses the AI Workflow
 * Copilot add-on, notification policy, the EVV aggregator picker, and the
 * Sandata / HHAeXchange integration configs (identity + caregiver/service
 * mappings). The two integration sections share one generic
 * {@link IntegrationConfigSection} rendered twice with different descriptors.
 *
 * The page is reachable from any nav entry but admin-only controls render a
 * read-only "Owner-only" notice for non-admins, matching the brand requirement
 * that billing/integration controls are private.
 */

// ---------- Shared response + presentational helpers ----------

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function SectionLoading({ label }: { label: string }): ReactElement {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner size="sm" /> {label}
    </p>
  );
}

function OwnerOnlyNotice({ children }: { children: ReactNode }): ReactElement {
  return (
    <Alert variant="warning">
      <AlertTitle>Owner-only setting.</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function SaveError({ message }: { message: string }): ReactElement {
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not save.</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function LoadError({ message }: { message: string }): ReactElement {
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function SavedAt({ at }: { at: Date | null }): ReactElement | null {
  if (!at) return null;
  return (
    <p className="text-right text-xs text-muted-foreground">
      Saved {at.toLocaleTimeString()}.
    </p>
  );
}

interface ToggleRowProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  title: string;
  description: ReactNode;
}

function ToggleRow({ checked, onCheckedChange, disabled, title, description }: ToggleRowProps): ReactElement {
  return (
    <div className={toggleRowClass}>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        className="mt-0.5"
      />
      <span>
        <strong className="block">{title}</strong>
        <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
      </span>
    </div>
  );
}

// ---------- Feature flag types ----------

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

  return (
    <div>
      <PageHeader
        title="Agency Settings"
        description="Per-agency configuration. Add-on entitlements visible only to admins."
      />

      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="evv">EVV &amp; Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-6">
          {loading && <SectionLoading label="Loading settings…" />}

          {error && <SaveError message={error} />}

          {features && (
            <AiCopilotSection
              features={features}
              isAdmin={isAdmin}
              saving={saving}
              savedAt={savedAt}
              onChange={saveFeatures}
            />
          )}

          {features && (
            <NotificationsSection
              features={features}
              isAdmin={isAdmin}
              saving={saving}
              onChange={saveFeatures}
            />
          )}
        </TabsContent>

        <TabsContent value="evv" className="space-y-6">
          <EvvAggregatorSection isAdmin={isAdmin} />
          <IntegrationConfigSection descriptor={SANDATA_DESCRIPTOR} isAdmin={isAdmin} />
          <IntegrationConfigSection descriptor={HHAEXCHANGE_DESCRIPTOR} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- AI Copilot section ----------

interface AiCopilotSectionProps {
  features: AgencyFeatures;
  isAdmin: boolean;
  saving: boolean;
  savedAt: Date | null;
  onChange: (next: AgencyFeatures) => void | Promise<void>;
}

function AiCopilotSection({ features, isAdmin, saving, savedAt, onChange }: AiCopilotSectionProps): ReactElement {
  const toggleCopilot = (enabled: boolean): void => {
    void onChange({
      ...features,
      aiCopilot: {
        ...features.aiCopilot,
        enabled,
        // When enabling for the first time, default to starter.
        plan: enabled ? (features.aiCopilot.plan === 'off' ? 'starter' : features.aiCopilot.plan) : 'off',
      },
    });
  };

  const setPlan = (plan: AiCopilotPlan): void => {
    void onChange({
      ...features,
      aiCopilot: { ...features.aiCopilot, plan, enabled: plan !== 'off' },
    });
  };

  return (
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
          <OwnerOnlyNotice>Only an agency admin can enable or change this add-on.</OwnerOnlyNotice>
        )}

        {isAdmin && (
          <div className="flex flex-col gap-4">
            <ToggleRow
              checked={features.aiCopilot.enabled}
              onCheckedChange={toggleCopilot}
              disabled={saving}
              title="Enable AI Copilot for this agency"
              description="When off, the panel is visible on the Learning Hub but locked."
            />

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

        <SavedAt at={savedAt} />
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
          <OwnerOnlyNotice>Only agency admins can change notification preferences.</OwnerOnlyNotice>
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
          <ToggleRow
            checked={n.caregiverPush}
            onCheckedChange={(checked) => update({ caregiverPush: checked })}
            disabled={!isAdmin || saving}
            title="Caregiver push notifications"
            description="Visit reminders, training due-soon, schedule changes — pushed to the caregiver mobile app."
          />

          <ToggleRow
            checked={n.caregiverEmail}
            onCheckedChange={(checked) => update({ caregiverEmail: checked })}
            disabled={!isAdmin || saving}
            title="Caregiver email"
            description="Same content as push, delivered by email for caregivers who prefer email."
          />

          <ToggleRow
            checked={n.familyEmail}
            onCheckedChange={(checked) => update({ familyEmail: checked })}
            disabled={!isAdmin || saving}
            title="Family email"
            description="Daily visit summary emails to family members on the client's authorized contact list. Requires family-portal opt-in per client."
          />
        </div>
      </CardContent>
    </Card>
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
          <SectionLoading label="Loading EVV configuration…" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent>{error && <LoadError message={error} />}</CardContent>
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
        {error && <SaveError message={error} />}

        {!isAdmin && (
          <OwnerOnlyNotice>Only an agency admin can change the EVV aggregator.</OwnerOnlyNotice>
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
          <ToggleRow
            checked={config.productionReady}
            onCheckedChange={(checked) => void save({
              aggregator: config.aggregator,
              productionReady: checked,
            })}
            disabled={saving}
            title="Production-ready"
            description="When off, the export pipeline runs in dry-run — visits are validated against the aggregator's spec but no submission file is generated. Flip on once your Provider ID is registered and mappings are populated."
          />
        )}

        <SavedAt at={savedAt} />
      </CardContent>
    </Card>
  );
}

// ---------- Caregiver roster (shared, deduped read) ----------

interface CaregiverOption {
  id: string;
  firstName: string;
  lastName: string;
  status?: string;
}

/**
 * Caregiver roster used to resolve names + drive the mapping picker. React
 * Query dedupes the single `/api/staff` read across both editors. Errors are
 * intentionally non-fatal — the editor still works with raw UUIDs.
 */
function useStaffRoster(): CaregiverOption[] {
  const { data } = useApiResource<ApiResponse<CaregiverOption[]>>(['staff'], '/api/staff');
  return data?.success && Array.isArray(data.data) ? data.data : [];
}

// ---------- Generic integration config (Sandata + HHAeXchange) ----------

type CaregiverMapping = { caregiverId: string } & Record<string, string>;
type ServiceMapping = Record<string, string>;

interface IntegrationConfig {
  enabled: boolean;
  caregivers: CaregiverMapping[];
  services: ServiceMapping[];
}

interface IdentityFieldDef<TConfig> {
  /** Patch key sent to the API and input id suffix. */
  name: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  mono?: boolean;
  /** Digit-only numeric input (inputMode + 9-digit pattern). */
  numeric?: boolean;
  /** Seed value from the loaded config. */
  get: (config: TConfig) => string;
  /** Transform the raw input into the persisted value (blank → empty value). */
  toPatch: (raw: string) => string | null;
}

interface MappingFieldDef {
  key: string;
  label: string;
  columnHeader: string;
  placeholder?: string;
  maxLength?: number;
  mono?: boolean;
  /** Renders a <Select> instead of <Input> with these options. */
  options?: readonly string[];
  /** Initial / reset value for the add-row form. */
  default?: string;
  /** Uppercase the value on entry + commit. */
  uppercase?: boolean;
  /** Keep the entered value after a row is added (don't reset). */
  sticky?: boolean;
}

interface IntegrationDescriptor<TConfig extends IntegrationConfig> {
  endpoint: string;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  loadingLabel: string;
  loadErrorFallback: string;
  ownerOnly: ReactNode;
  badge: { on: string; off: string };
  identityFields: IdentityFieldDef<TConfig>[];
  isIdentityComplete: (config: TConfig) => boolean;
  enable: { label: string; hint: ReactNode };
  caregiver: {
    valueKey: string;
    valueLabel: string;
    valueNoun: string;
    valuePlaceholder: string;
    idPrefix: string;
    hint: ReactNode;
  };
  service: {
    fields: MappingFieldDef[];
    keyField: string;
    idPrefix: string;
    hint: ReactNode;
    validate?: (draft: ServiceMapping) => string | null;
  };
  messages: { e422: string; e403: string };
}

function seedIdentityValues<TConfig>(
  fields: IdentityFieldDef<TConfig>[],
  config: TConfig,
): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.name, f.get(config)]));
}

interface IntegrationConfigSectionProps<TConfig extends IntegrationConfig> {
  descriptor: IntegrationDescriptor<TConfig>;
  isAdmin: boolean;
}

function IntegrationConfigSection<TConfig extends IntegrationConfig>({
  descriptor,
  isAdmin,
}: IntegrationConfigSectionProps<TConfig>): ReactElement {
  const [config, setConfig] = useState<TConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<TConfig>>(descriptor.endpoint);
        if (cancelled) return;
        if (response.success && response.data) {
          setConfig(response.data);
          setValues(seedIdentityValues(descriptor.identityFields, response.data));
        } else {
          setError(response.error ?? descriptor.loadErrorFallback);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : descriptor.loadErrorFallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [descriptor]);

  const save = async (patch: Record<string, unknown>): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const response = await putJson<ApiResponse<TConfig>>(descriptor.endpoint, patch);
      if (response.success && response.data) {
        setConfig(response.data);
        setSavedAt(new Date());
      } else {
        setError(response.error ?? 'Failed to save');
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? descriptor.messages.e422);
      } else if (err instanceof HttpError && err.status === 400) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? 'Validation failed.');
      } else if (err instanceof HttpError && err.status === 403) {
        setError(descriptor.messages.e403);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const submitIdentity = (e: React.FormEvent): void => {
    e.preventDefault();
    const patch: Record<string, string | null> = {};
    for (const field of descriptor.identityFields) {
      patch[field.name] = field.toPatch(values[field.name] ?? '');
    }
    void save(patch);
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <SectionLoading label={descriptor.loadingLabel} />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent>{error && <LoadError message={error} />}</CardContent>
      </Card>
    );
  }

  const Icon = descriptor.icon;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" aria-hidden />
            {descriptor.title}
          </CardTitle>
          <CardDescription className="max-w-[480px]">{descriptor.description}</CardDescription>
        </div>
        <Badge variant={config.enabled ? 'success' : 'secondary'}>
          {config.enabled ? descriptor.badge.on : descriptor.badge.off}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <SaveError message={error} />}

        {!isAdmin && <OwnerOnlyNotice>{descriptor.ownerOnly}</OwnerOnlyNotice>}

        <form onSubmit={submitIdentity} className="flex flex-col gap-3.5">
          <fieldset className="rounded-lg border border-border p-4 disabled:opacity-60" disabled={!isAdmin || saving}>
            <legend className="px-1 text-sm font-medium text-muted-foreground">Identity</legend>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {descriptor.identityFields.map((field) => (
                <FormField key={field.name} label={field.label}>
                  <Input
                    type="text"
                    value={values[field.name] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: field.numeric ? e.target.value.replace(/\D/g, '') : e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                    inputMode={field.numeric ? 'numeric' : undefined}
                    pattern={field.numeric ? '\\d{9}' : undefined}
                    className={field.mono ? 'font-mono' : undefined}
                  />
                </FormField>
              ))}
            </div>
            <div className="mt-3">
              <Button type="submit" disabled={!isAdmin || saving}>
                {saving ? 'Saving…' : 'Save identity'}
              </Button>
            </div>
          </fieldset>
        </form>

        {isAdmin && (
          <ToggleRow
            checked={config.enabled}
            onCheckedChange={(checked) => void save({ enabled: checked })}
            disabled={saving || (!descriptor.isIdentityComplete(config) && !config.enabled)}
            title={descriptor.enable.label}
            description={descriptor.enable.hint}
          />
        )}

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Badge variant="outline">{config.caregivers.length}</Badge> caregiver mapping{config.caregivers.length === 1 ? '' : 's'}
          {' · '}
          <Badge variant="outline">{config.services.length}</Badge> service mapping{config.services.length === 1 ? '' : 's'}
        </p>

        {isAdmin && (
          <CaregiverMappingEditor
            mappings={config.caregivers}
            saving={saving}
            spec={descriptor.caregiver}
            onCommit={(next) => save({ caregivers: next })}
          />
        )}

        {isAdmin && (
          <ServiceMappingEditor
            mappings={config.services}
            saving={saving}
            spec={descriptor.service}
            onCommit={(next) => save({ services: next })}
          />
        )}

        <SavedAt at={savedAt} />
      </CardContent>
    </Card>
  );
}

// ---------- Caregiver mappings editor (generic) ----------

interface CaregiverMappingEditorProps {
  mappings: CaregiverMapping[];
  saving: boolean;
  spec: IntegrationDescriptor<IntegrationConfig>['caregiver'];
  onCommit: (next: CaregiverMapping[]) => Promise<void>;
}

function CaregiverMappingEditor({
  mappings,
  saving,
  spec,
  onCommit,
}: CaregiverMappingEditorProps): ReactElement {
  const caregivers = useStaffRoster();
  const [pickedCaregiverId, setPickedCaregiverId] = useState('');
  const [newValue, setNewValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const nameFor = (caregiverId: string): string => {
    const cg = caregivers.find((c) => c.id === caregiverId);
    if (!cg) return caregiverId.slice(0, 8) + '…';
    return `${cg.firstName} ${cg.lastName}`.trim();
  };

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!pickedCaregiverId || !newValue.trim()) {
      setLocalError(`Pick a caregiver and enter an ${spec.valueNoun}.`);
      return;
    }
    if (mappings.some((m) => m.caregiverId === pickedCaregiverId)) {
      setLocalError(`That caregiver already has an ${spec.valueNoun} — remove it first to change.`);
      return;
    }
    const next: CaregiverMapping[] = [
      ...mappings,
      { caregiverId: pickedCaregiverId, [spec.valueKey]: newValue.trim() },
    ];
    await onCommit(next);
    setPickedCaregiverId('');
    setNewValue('');
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
      <p className="mb-2.5 text-xs text-muted-foreground">{spec.hint}</p>

      {localError && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      {mappings.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Caregiver</TableHead>
                <TableHead>{spec.valueLabel}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.caregiverId}>
                  <TableCell className="font-medium">{nameFor(m.caregiverId)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{m[spec.valueKey]}</TableCell>
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
          <EmptyState icon={Users} title="No caregiver mappings yet." />
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor={`${spec.idPrefix}-pick`}>Caregiver</Label>
          <Select
            id={`${spec.idPrefix}-pick`}
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
          <Label htmlFor={`${spec.idPrefix}-value`}>{spec.valueLabel}</Label>
          <Input
            id={`${spec.idPrefix}-value`}
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={spec.valuePlaceholder}
            maxLength={32}
            disabled={saving}
            className="font-mono"
          />
        </div>
        <Button
          onClick={() => void addMapping()}
          disabled={saving || !pickedCaregiverId || !newValue.trim()}
        >
          Add mapping
        </Button>
      </div>
    </div>
  );
}

// ---------- Service mappings editor (generic) ----------

const SERVICE_GRID_BY_FIELD_COUNT: Record<number, string> = {
  3: 'sm:grid-cols-[1fr_1fr_1fr_auto]',
  4: 'sm:grid-cols-[1fr_1fr_1fr_1fr_auto]',
};

function initialServiceDraft(fields: MappingFieldDef[]): ServiceMapping {
  return Object.fromEntries(fields.map((f) => [f.key, f.default ?? '']));
}

interface ServiceMappingEditorProps {
  mappings: ServiceMapping[];
  saving: boolean;
  spec: IntegrationDescriptor<IntegrationConfig>['service'];
  onCommit: (next: ServiceMapping[]) => Promise<void>;
}

function ServiceMappingEditor({
  mappings,
  saving,
  spec,
  onCommit,
}: ServiceMappingEditorProps): ReactElement {
  const { fields, keyField, validate } = spec;
  const [draft, setDraft] = useState<ServiceMapping>(() => initialServiceDraft(fields));
  const [localError, setLocalError] = useState<string | null>(null);

  const allFilled = fields.every((f) => (draft[f.key] ?? '').trim() !== '');

  const setField = (key: string, value: string): void => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const addMapping = async (): Promise<void> => {
    setLocalError(null);
    if (!allFilled) {
      setLocalError('All fields are required.');
      return;
    }
    if (validate) {
      const v = validate(draft);
      if (v) {
        setLocalError(v);
        return;
      }
    }
    if (mappings.some((m) => m[keyField] === draft[keyField].trim())) {
      setLocalError('That internal service code is already mapped — remove it first to change.');
      return;
    }
    const row: ServiceMapping = {};
    for (const f of fields) {
      const trimmed = draft[f.key].trim();
      row[f.key] = f.uppercase ? trimmed.toUpperCase() : trimmed;
    }
    await onCommit([...mappings, row]);
    setDraft((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (!f.sticky) next[f.key] = f.default ?? '';
      }
      return next;
    });
  };

  const removeMapping = async (code: string): Promise<void> => {
    setLocalError(null);
    const next = mappings.filter((m) => m[keyField] !== code);
    await onCommit(next);
  };

  const gridClass = SERVICE_GRID_BY_FIELD_COUNT[fields.length] ?? '';

  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-semibold">Service mappings</h4>
      <p className="mb-2.5 text-xs text-muted-foreground">{spec.hint}</p>

      {localError && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}

      {mappings.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {fields.map((f) => (
                  <TableHead key={f.key}>{f.columnHeader}</TableHead>
                ))}
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m[keyField]}>
                  {fields.map((f) => (
                    <TableCell key={f.key} className={f.mono ? 'font-mono' : undefined}>
                      {m[f.key]}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeMapping(m[keyField])}
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
          <EmptyState icon={Users} title="No service mappings yet." />
        </div>
      )}

      <div className={cn('grid grid-cols-1 items-end gap-2', gridClass)}>
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`${spec.idPrefix}-${f.key}`}>{f.label}</Label>
            {f.options ? (
              <Select
                id={`${spec.idPrefix}-${f.key}`}
                value={draft[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                disabled={saving}
              >
                {f.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <Input
                id={`${spec.idPrefix}-${f.key}`}
                type="text"
                value={draft[f.key]}
                onChange={(e) => setField(f.key, f.uppercase ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={f.placeholder}
                maxLength={f.maxLength}
                disabled={saving}
                className={f.mono ? 'font-mono' : undefined}
              />
            )}
          </div>
        ))}
        <Button onClick={() => void addMapping()} disabled={saving || !allFilled}>
          Add
        </Button>
      </div>
    </div>
  );
}

// ---------- Integration descriptors ----------

interface SandataPartial extends IntegrationConfig {
  agencyId: string;
  providerId: string | null;
  timezone: string;
  caregivers: Array<{ caregiverId: string; externalWorkerId: string }>;
  services: Array<{ internalServiceCode: string; hcpcsCode: string; hcpcsModifier: string; label: string }>;
}

const HCPCS_MODIFIERS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9'] as const;

const SANDATA_DESCRIPTOR: IntegrationDescriptor<SandataPartial> = {
  endpoint: '/api/agencies/me/sandata-config',
  icon: Network,
  title: 'Sandata identity & mappings',
  description: (
    <>
      Sandata Provider ID is a 9-digit numeric identifier assigned by Sandata when your
      agency registers with the PA Aggregator (or your state&apos;s Sandata-backed program).
      Per-caregiver external worker IDs and HCPCS service mappings drive the visit export.
    </>
  ),
  loadingLabel: 'Loading Sandata configuration…',
  loadErrorFallback: 'Failed to load Sandata config',
  ownerOnly: 'Only an agency admin can change Sandata config.',
  badge: { on: 'Enabled', off: 'Disabled' },
  identityFields: [
    {
      name: 'providerId',
      label: 'Provider ID (9 digits)',
      placeholder: '123456789',
      maxLength: 9,
      mono: true,
      numeric: true,
      get: (c) => c.providerId ?? '',
      toPatch: (raw) => raw.trim() || null,
    },
    {
      name: 'timezone',
      label: 'Timezone',
      placeholder: 'America/New_York',
      get: (c) => c.timezone,
      toPatch: (raw) => raw.trim() || 'America/New_York',
    },
  ],
  isIdentityComplete: (c) => Boolean(c.providerId),
  enable: {
    label: 'Enable Sandata export',
    hint: 'When off, the export pipeline emits no rows to Sandata. Toggling on requires Provider ID to be populated above.',
  },
  caregiver: {
    valueKey: 'externalWorkerId',
    valueLabel: 'External Worker ID',
    valueNoun: 'external worker ID',
    valuePlaceholder: 'EW-1234',
    idPrefix: 'sandata-cg',
    hint: 'Map each RayHealth caregiver to their Sandata External Worker ID. Visits for unmapped caregivers are skipped at export time.',
  },
  service: {
    keyField: 'internalServiceCode',
    idPrefix: 'sandata-svc',
    hint: 'Map each RayHealth internal service code to a Sandata HCPCS code + modifier. PA typically uses T1019 + U4 (personal care), U5 (respite), U7 (companion).',
    validate: (draft) =>
      /^[A-Z]\d{4}$/.test((draft.hcpcsCode ?? '').trim())
        ? null
        : 'HCPCS code must be 1 letter + 4 digits (e.g. T1019).',
    fields: [
      { key: 'internalServiceCode', label: 'Internal code', columnHeader: 'Internal', placeholder: 'PERSONAL_CARE', mono: true },
      { key: 'hcpcsCode', label: 'HCPCS code', columnHeader: 'HCPCS', placeholder: 'T1019', maxLength: 5, mono: true, uppercase: true, default: 'T1019', sticky: true },
      { key: 'hcpcsModifier', label: 'Modifier', columnHeader: 'Modifier', mono: true, options: HCPCS_MODIFIERS, default: 'U4', sticky: true },
      { key: 'label', label: 'Label', columnHeader: 'Label', placeholder: 'Personal Care' },
    ],
  },
  messages: {
    e422: 'Cannot enable until providerId is set.',
    e403: 'Only admins can change Sandata config.',
  },
};

interface HhaexchangePartial extends IntegrationConfig {
  agencyId: string;
  agencyTaxId: string | null;
  hhaProviderId: string | null;
  timezone: string;
  caregivers: Array<{ caregiverId: string; employeeId: string }>;
  services: Array<{ internalServiceCode: string; hhaServiceCode: string; label: string }>;
}

const HHAEXCHANGE_DESCRIPTOR: IntegrationDescriptor<HhaexchangePartial> = {
  endpoint: '/api/agencies/me/hhaexchange-config',
  icon: Building2,
  title: 'HHAeXchange identity & mappings',
  description: (
    <>
      Required for NJ and any PA agency that picks HHAeXchange. The agency Tax ID
      (EIN, 9 digits no dash) and HHAeXchange Provider ID are issued by HHAeXchange
      when your agency registers. Caregiver and service mappings are managed
      below — this section covers identity and the master enable switch.
    </>
  ),
  loadingLabel: 'Loading HHAeXchange configuration…',
  loadErrorFallback: 'Failed to load HHAeXchange config',
  ownerOnly: 'Only an agency admin can change HHAeXchange config.',
  badge: { on: 'Enabled', off: 'Disabled' },
  identityFields: [
    {
      name: 'agencyTaxId',
      label: 'Agency Tax ID (EIN, 9 digits)',
      placeholder: '123456789',
      maxLength: 9,
      mono: true,
      numeric: true,
      get: (c) => c.agencyTaxId ?? '',
      toPatch: (raw) => raw.trim() || null,
    },
    {
      name: 'hhaProviderId',
      label: 'HHAeXchange Provider ID',
      placeholder: 'P-100',
      maxLength: 32,
      mono: true,
      get: (c) => c.hhaProviderId ?? '',
      toPatch: (raw) => raw.trim() || null,
    },
    {
      name: 'timezone',
      label: 'Timezone',
      placeholder: 'America/New_York',
      get: (c) => c.timezone,
      toPatch: (raw) => raw.trim() || 'America/New_York',
    },
  ],
  isIdentityComplete: (c) => Boolean(c.agencyTaxId && c.hhaProviderId),
  enable: {
    label: 'Enable HHAeXchange export',
    hint: 'When off, the export pipeline emits no rows to HHAeXchange even if the EVV aggregator picker is set to HHAeXchange. Toggling on requires Tax ID and Provider ID to be populated above.',
  },
  caregiver: {
    valueKey: 'employeeId',
    valueLabel: 'HHAeXchange Employee ID',
    valueNoun: 'employee ID',
    valuePlaceholder: 'E-1234',
    idPrefix: 'hha-cg',
    hint: "Map each RayHealth caregiver to their HHAeXchange Employee ID. Without these, the export pipeline can't emit rows for that caregiver.",
  },
  service: {
    keyField: 'internalServiceCode',
    idPrefix: 'hha-svc',
    hint: 'Map each RayHealth internal service code to the HHAeXchange service code your state Medicaid program assigned for that service. Visits with unmapped service codes are skipped at export time.',
    fields: [
      { key: 'internalServiceCode', label: 'Internal code', columnHeader: 'Internal code', placeholder: 'PERSONAL_CARE', mono: true },
      { key: 'hhaServiceCode', label: 'HHAeXchange code', columnHeader: 'HHA code', placeholder: '1051', maxLength: 16, mono: true },
      { key: 'label', label: 'Label', columnHeader: 'Label', placeholder: 'Personal Care' },
    ],
  },
  messages: {
    e422: 'Cannot enable until identity fields are set.',
    e403: 'Only admins can change HHAeXchange config.',
  },
};
