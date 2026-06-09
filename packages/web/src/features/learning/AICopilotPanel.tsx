import { useEffect, useState, type ReactElement } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { getJson } from '../../lib/api-client.js';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * AICopilotPanel — the visible-but-locked surface on the Learning Hub.
 *
 * Per brand guidance: the AI workflow copilot is a paid agency add-on with
 * private billing visibility. When the flag is OFF (the default), the surface
 * still renders so coordinators see what's coming — they just can't use it.
 * The "Enable" CTA is visible only to admins (private billing).
 *
 * The actual AI calls (Gemini per-role defaults, confirm-every-action) are
 * wired in a follow-up — this is the entry surface.
 */

interface AiCopilotFlag {
  enabled: boolean;
  plan: 'off' | 'starter' | 'pro';
}

interface AgencyFeatures {
  aiCopilot: AiCopilotFlag;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AICopilotPanelProps {
  /** Currently-authed user role — drives whether the Enable CTA is shown. */
  userRole?: 'admin' | 'coordinator' | 'caregiver' | 'family';
}

export function AICopilotPanel({ userRole }: AICopilotPanelProps): ReactElement | null {
  const [features, setFeatures] = useState<AgencyFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<AgencyFeatures>>('/api/agencies/me/features');
        if (cancelled) return;
        if (response.success && response.data) {
          setFeatures(response.data);
        } else {
          // Failed to load — assume off (safe default).
          setFeatures({ aiCopilot: { enabled: false, plan: 'off' } });
        }
      } catch {
        if (!cancelled) {
          setFeatures({ aiCopilot: { enabled: false, plan: 'off' } });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // While we don't know yet, render nothing. Avoids flashing locked-then-unlocked.
  if (loading) return null;

  const enabled = features?.aiCopilot.enabled ?? false;

  return enabled
    ? <UnlockedPanel plan={features?.aiCopilot.plan ?? 'starter'} />
    : <LockedPanel userRole={userRole} />;
}

// ---------- Locked state ----------

function LockedPanel({ userRole }: { userRole?: string }): ReactElement {
  const isAdmin = userRole === 'admin';

  return (
    <Card className="mt-8 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-5 text-primary" aria-hidden />
          AI Workflow Copilot
          <Badge variant="secondary" className="ml-1 uppercase">Add-on</Badge>
        </CardTitle>
        <CardDescription>
          Ask plain-English questions about your training compliance. "Who's due for
          HIPAA refresh next week?" "Why is Roberto stuck on dementia care?"
          Coordinator-level decisions stay in your hands — the copilot proposes,
          you confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-2xl space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Per-role assistant: caregiver, coordinator, owner</li>
          <li>Smart enrollment suggestions based on visit history</li>
          <li>Automatic reminders before due dates and expiry</li>
          <li>Every action requires your confirmation — nothing automated silently</li>
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <Button asChild>
              <a href="/admin/billing/ai-copilot">Enable Copilot</a>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">
              Only your agency owner can enable this add-on.
            </span>
          )}
          <Button asChild variant="link">
            <a href="/admin/learning/copilot-preview">See a demo</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Unlocked state (stub) ----------

function UnlockedPanel({ plan }: { plan: 'starter' | 'pro' | 'off' }): ReactElement {
  return (
    <Card className="mt-8 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" aria-hidden />
          AI Workflow Copilot
          <Badge variant="accent" className="ml-1 uppercase">{plan === 'pro' ? 'Pro' : 'Starter'}</Badge>
        </CardTitle>
        <CardDescription>
          Copilot is active. The chat surface and per-role assistants land in the next release.
          For now, the deterministic insights above cover most coordinator needs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href="/admin/learning/copilot">Open Copilot</a>
        </Button>
      </CardContent>
    </Card>
  );
}
