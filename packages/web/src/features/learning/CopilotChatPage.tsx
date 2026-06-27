import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, Sparkles } from 'lucide-react';
import { postJson, HttpError } from '../../lib/api-client.js';
import { useApiResource } from '../../lib/use-api-resource.js';
import { useAuth } from '../../lib/AuthContext.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';

/**
 * CopilotChatPage — conversational Q&A surface at /admin/learning/copilot.
 *
 * Per brand: confirm-every-action. When the model proposes an action
 * (signaled by a `proposedAction` field in the response) we render a
 * confirm/cancel block instead of automatically executing. If the model
 * also emits structured `proposedActionData` (now routine thanks to the
 * agency-context injection on the backend), clicking Confirm posts that
 * payload to `/api/copilot/execute`, which runs typed executors
 * (enroll_caregiver, send_reminder) with per-action authorization checks.
 * If only the free-text proposal is present, Confirm records an audit
 * event in advisory mode.
 */

interface CopilotStatus {
  enabled: boolean;
  plan: 'off' | 'starter' | 'pro';
  geminiConfigured: boolean;
}

// Mirror of CopilotAction shapes from @rayhealth/core. Inlined here to avoid
// pulling the core package into the web build for one Zod schema; if these
// drift, the /execute call will return 400 and surface the mismatch.
type CopilotActionData =
  | { type: 'enroll_caregiver'; caregiverId: string; courseId: string; dueAt: string | null }
  | { type: 'send_reminder'; caregiverId: string; channel: 'email' | 'push' | 'both'; message: string };

interface CopilotAnswer {
  answer: string;
  proposedAction: string | null;
  proposedActionData: CopilotActionData | null;
  model: string;
  usageTokens: number;
}

interface CopilotActionResult {
  action: CopilotActionData;
  outcome: Record<string, unknown>;
  summary: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

type Turn =
  | { kind: 'user'; text: string }
  | {
      kind: 'assistant';
      text: string;
      proposedAction: string | null;
      proposedActionData: CopilotActionData | null;
      /** Once the user confirms or declines, lock the proposal so it can't be acted on twice. */
      resolution?: 'confirmed' | 'declined';
      model: string;
    };

const SUGGESTED_PROMPTS_BY_ROLE: Record<string, string[]> = {
  admin: [
    'Which caregivers are due for HIPAA refresh in the next 7 days?',
    'Summarize our PA-EVV compliance posture as if a state auditor is reading.',
    'Who hasn\'t completed orientation and has a visit scheduled this week?',
  ],
  coordinator: [
    'Show me the 3 caregivers most likely to be non-compliant tomorrow.',
    'Which courses have the lowest completion rate across our caregivers?',
    'Draft a reminder email for caregivers whose CPR cert expires next month.',
  ],
  caregiver: [
    'What training do I have due this week?',
    'How long is the HIPAA refresh and when is it due?',
    'What do I need to finish before my next visit?',
  ],
  family: [
    'When did the caregiver arrive for mom yesterday?',
    'Did the caregiver finish the visit on time?',
    'Read me the visit notes from this morning.',
  ],
};

export function CopilotChatPage(): ReactElement {
  const { user } = useAuth();
  const role = user?.role ?? 'coordinator';

  const {
    data: statusData,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useApiResource<ApiResponse<CopilotStatus>>(['copilot', 'status'], '/api/copilot/status');
  const status = statusData?.success ? statusData.data ?? null : null;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the conversation to the latest turn.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const submit = async (question: string): Promise<void> => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setError(null);
    setTurns((prev) => [...prev, { kind: 'user', text: trimmed }]);
    setPrompt('');
    setSubmitting(true);
    try {
      const response = await postJson<ApiResponse<CopilotAnswer>>('/api/copilot/ask', { prompt: trimmed });
      if (response.success && response.data) {
        setTurns((prev) => [
          ...prev,
          {
            kind: 'assistant',
            text: response.data!.answer,
            proposedAction: response.data!.proposedAction,
            proposedActionData: response.data!.proposedActionData,
            model: response.data!.model,
          },
        ]);
      } else {
        setError(response.error ?? 'Copilot did not return an answer.');
      }
    } catch (err) {
      if (err instanceof HttpError) {
        const body = err.body as { code?: string; error?: string } | null;
        if (err.status === 402 && body?.code === 'COPILOT_NOT_ENABLED') {
          setError('Copilot add-on is not enabled. Ask an admin to enable it in Settings.');
        } else if (err.status === 503 && body?.code === 'COPILOT_NOT_CONFIGURED') {
          setError('Copilot infrastructure is offline. Try again later.');
        } else if (err.status === 502) {
          setError('Copilot service is temporarily unavailable.');
        } else {
          setError(body?.error ?? `Request failed: ${err.status}`);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to reach Copilot.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    void submit(prompt);
  };

  /**
   * Confirm and execute an assistant-proposed action.
   *
   * If the assistant returned structured `proposedActionData`, this calls
   * /api/copilot/execute with that exact JSON payload. The result summary
   * is appended as a system turn.
   *
   * If only the natural-language `proposedAction` is available (no JSON),
   * this falls back to advisory mode — we just record the confirmation
   * without executing. As of v2.1 the backend injects an agency-context
   * blob into every prompt so the model now has the UUIDs it needs to
   * emit structured proposedActionData routinely; the advisory branch
   * remains as a safety net for the model declining to match a name.
   */
  const confirmAction = async (turnIndex: number): Promise<void> => {
    const turn = turns[turnIndex];
    if (!turn || turn.kind !== 'assistant') return;
    if (turn.resolution) return; // already acted on

    // Mark resolved up-front so double-clicks don't double-execute.
    setTurns((prev) => prev.map((t, i) => (i === turnIndex && t.kind === 'assistant' ? { ...t, resolution: 'confirmed' as const } : t)));

    if (turn.proposedActionData) {
      try {
        const response = await postJson<ApiResponse<CopilotActionResult>>('/api/copilot/execute', turn.proposedActionData);
        if (response.success && response.data) {
          appendSystemTurn(`✓ Done: ${response.data.summary}`);
        } else {
          appendSystemTurn(`Could not run the action: ${response.error ?? 'unknown error'}`);
        }
      } catch (err) {
        if (err instanceof HttpError) {
          appendSystemTurn(`Could not run the action (${err.status}): ${err.message}`);
        } else {
          appendSystemTurn(`Could not run the action: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    } else if (turn.proposedAction) {
      appendSystemTurn(
        `Recorded as confirmed (advisory mode): "${turn.proposedAction}". The model did not emit a structured action — typically because no matching caregiver or course was found in the injected agency context.`,
      );
    }
  };

  const declineAction = (turnIndex: number): void => {
    const turn = turns[turnIndex];
    if (!turn || turn.kind !== 'assistant' || turn.resolution) return;
    setTurns((prev) => prev.map((t, i) => (i === turnIndex && t.kind === 'assistant' ? { ...t, resolution: 'declined' as const } : t)));
    appendSystemTurn(`Declined: ${turn.proposedAction ?? 'the proposed action'}`);
  };

  const appendSystemTurn = (text: string): void => {
    setTurns((prev) => [...prev, { kind: 'assistant', text, proposedAction: null, proposedActionData: null, model: 'system' }]);
  };

  const suggestions = SUGGESTED_PROMPTS_BY_ROLE[role] ?? SUGGESTED_PROMPTS_BY_ROLE.coordinator;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI Workflow Copilot"
        description="Conversational copilot scoped to your role. Every proposed action requires your confirmation."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/learning">← Learning Hub</Link>
          </Button>
        }
      />

      {statusLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          Checking Copilot status…
        </div>
      )}

      {!statusLoading && statusError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load Copilot status</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            We couldn’t check whether Copilot is available right now.
            <Button variant="outline" size="sm" onClick={() => void refetchStatus()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!statusLoading && !statusError && status && !status.enabled && (
        <Alert variant="warning">
          <AlertTitle>Copilot is not enabled for this agency.</AlertTitle>
          <AlertDescription>
            An agency admin can enable the add-on in{' '}
            <Link to="/admin/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              Settings
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      {!statusLoading && !statusError && status && status.enabled && !status.geminiConfigured && (
        <Alert variant="destructive">
          <AlertTitle>Copilot infrastructure is offline.</AlertTitle>
          <AlertDescription>
            The add-on is enabled but the Gemini key isn’t configured on the backend. Operations
            team has been notified.
          </AlertDescription>
        </Alert>
      )}

      {!statusLoading && !statusError && status && status.enabled && status.geminiConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" aria-hidden />
              Copilot Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {turns.length === 0 && (
              <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="size-4" aria-hidden />
                  Suggested prompts
                </p>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start whitespace-normal py-2 text-left"
                      onClick={() => void submit(s)}
                      disabled={submitting}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex max-h-[60vh] min-h-[420px] flex-col gap-3 overflow-y-auto"
            >
              {turns.map((turn, idx) => (
                <TurnView
                  key={idx}
                  turn={turn}
                  onConfirm={() => void confirmAction(idx)}
                  onDecline={() => declineAction(idx)}
                />
              ))}
              {submitting && (
                <div className="mr-auto text-sm italic text-muted-foreground">Copilot is thinking…</div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask Copilot anything about training, schedules, or compliance…"
                aria-label="Ask Copilot a question"
                rows={2}
                className="min-h-0"
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || !prompt.trim()}>
                <Send className="size-4" aria-hidden />
                {submitting ? 'Sending…' : 'Send'}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Copilot reasoning is not a substitute for clinical or legal judgment. Confirm every action before relying on it.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

function TurnView({
  turn,
  onConfirm,
  onDecline,
}: {
  turn: Turn;
  onConfirm: () => void;
  onDecline: () => void;
}): ReactElement {
  if (turn.kind === 'user') {
    return (
      <div className="ml-auto max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
        {turn.text}
      </div>
    );
  }
  const resolved = turn.resolution !== undefined;
  return (
    <div className="mr-auto max-w-[80%] rounded-2xl bg-muted px-4 py-2 text-sm text-foreground">
      <p className="whitespace-pre-wrap">{turn.text}</p>
      {turn.proposedAction && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {resolved ? `Action ${turn.resolution}` : 'Proposed action'}
            {turn.proposedActionData && !resolved && (
              <Badge variant="accent" className="text-[0.65rem]">
                Executable
              </Badge>
            )}
          </div>
          <p className="font-medium">{turn.proposedAction}</p>
          {!resolved && (
            <div className="flex gap-2">
              <Button size="sm" onClick={onConfirm}>
                Confirm{turn.proposedActionData ? ' & run' : ''}
              </Button>
              <Button size="sm" variant="outline" onClick={onDecline}>
                Decline
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">{turn.model}</div>
    </div>
  );
}
