import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { getJson, postJson, ApiError } from '../../lib/api-client.js';
import { useAuth } from '../../lib/AuthContext.js';

/**
 * CopilotChatPage, conversational Q&A surface at /admin/learning/copilot.
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
  aiConfigured: boolean;
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

  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getJson<ApiResponse<CopilotStatus>>('/api/copilot/status');
        if (cancelled) return;
        if (response.success && response.data) {
          setStatus(response.data);
        }
      } catch {
        if (!cancelled) {
          setStatus({ enabled: false, plan: 'off', aiConfigured: false });
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      if (err instanceof ApiError) {
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
   * this falls back to advisory mode, we just record the confirmation
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
          appendSystemTurn(`Done: ${response.data.summary}`);
        } else {
          appendSystemTurn(`Could not run the action: ${response.error ?? 'unknown error'}`);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          appendSystemTurn(`Could not run the action (${err.status}): ${err.message}`);
        } else {
          appendSystemTurn(`Could not run the action: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    } else if (turn.proposedAction) {
      appendSystemTurn(
        `Recorded as confirmed (advisory mode): "${turn.proposedAction}". The model did not emit a structured action, typically because no matching caregiver or course was found in the injected agency context.`,
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
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>AI Workflow Copilot</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
            Conversational copilot scoped to your role. Every proposed action requires your confirmation.
          </p>
        </div>
        <Link to="/admin/learning" style={linkButtonStyle}>← Learning Hub</Link>
      </header>

      {statusLoading && <p style={{ color: '#64748b' }}>Checking Copilot status…</p>}

      {!statusLoading && status && !status.enabled && (
        <div style={lockedBoxStyle}>
          <strong>Copilot is not enabled for this agency.</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
            An agency admin can enable the add-on in <Link to="/admin/settings" style={{ color: '#185FA5' }}>Settings</Link>.
          </p>
        </div>
      )}

      {!statusLoading && status && status.enabled && !status.aiConfigured && (
        <div style={warningBoxStyle}>
          <strong>Copilot infrastructure is offline.</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
            The add-on is enabled but the AI provider isn't configured on the backend. Operations team has been notified.
          </p>
        </div>
      )}

      {!statusLoading && status && status.enabled && status.aiConfigured && (
        <>
          {turns.length === 0 && (
            <div style={suggestionsCardStyle}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#64748b' }}>Suggested prompts:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => void submit(s)} style={suggestionBtnStyle} disabled={submitting}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} style={chatScrollStyle}>
            {turns.map((turn, idx) => (
              <TurnView
                key={idx}
                turn={turn}
                onConfirm={() => void confirmAction(idx)}
                onDecline={() => declineAction(idx)}
              />
            ))}
            {submitting && <div style={typingStyle}>Copilot is thinking…</div>}
          </div>

          {error && (
            <div role="alert" style={errorBoxStyle}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={formStyle}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask Copilot anything about training, schedules, or compliance…"
              rows={2}
              style={textareaStyle}
              disabled={submitting}
            />
            <button type="submit" disabled={submitting || !prompt.trim()} style={sendBtnStyle}>
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </form>
          <p style={attestationStyle}>
            Copilot reasoning is not a substitute for clinical or legal judgment. Confirm every action before relying on it.
          </p>
        </>
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
      <div style={userBubbleWrapStyle}>
        <div style={userBubbleStyle}>{turn.text}</div>
      </div>
    );
  }
  const resolved = turn.resolution !== undefined;
  return (
    <div style={assistantBubbleWrapStyle}>
      <div style={assistantBubbleStyle}>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{turn.text}</p>
        {turn.proposedAction && (
          <div style={proposedActionStyle}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#3C3489', marginBottom: '0.4rem' }}>
              {resolved ? `Action ${turn.resolution}` : 'Proposed action'}
              {turn.proposedActionData && !resolved && <span style={executableBadgeStyle}>Executable</span>}
            </div>
            <p style={{ margin: '0 0 0.6rem', fontWeight: 500 }}>{turn.proposedAction}</p>
            {!resolved && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={onConfirm} style={confirmBtnStyle}>
                  Confirm{turn.proposedActionData ? ' & run' : ''}
                </button>
                <button onClick={onDecline} style={declineBtnStyle}>Decline</button>
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          {turn.model}
        </div>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const linkButtonStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#185FA5',
  fontSize: '0.9rem',
  border: '1px solid #185FA5',
  padding: '0.4rem 0.85rem',
  borderRadius: '6px',
};

const lockedBoxStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  backgroundColor: '#FAEEDA',
  borderLeft: '4px solid #BA7517',
  color: '#633806',
  borderRadius: '8px',
};

const warningBoxStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  backgroundColor: '#FCEBEB',
  borderLeft: '4px solid #E24B4A',
  color: '#791F1F',
  borderRadius: '8px',
};

const suggestionsCardStyle: React.CSSProperties = {
  marginBottom: '1rem',
  padding: '1rem 1.25rem',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const suggestionBtnStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  color: '#0b1220',
};

const chatScrollStyle: React.CSSProperties = {
  maxHeight: '440px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  padding: '0.5rem',
  backgroundColor: '#fbfcfd',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
};

const userBubbleWrapStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};

const userBubbleStyle: React.CSSProperties = {
  maxWidth: '80%',
  padding: '0.6rem 0.85rem',
  backgroundColor: '#185FA5',
  color: '#ffffff',
  borderRadius: '12px 12px 4px 12px',
  fontSize: '0.92rem',
  lineHeight: 1.5,
};

const assistantBubbleWrapStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-start',
};

const assistantBubbleStyle: React.CSSProperties = {
  maxWidth: '80%',
  padding: '0.75rem 1rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px 12px 12px 4px',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  color: '#0b1220',
};

const proposedActionStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.75rem 0.85rem',
  backgroundColor: '#EEEDFE',
  borderRadius: '8px',
  border: '1px solid #AFA9EC',
};

const confirmBtnStyle: React.CSSProperties = {
  backgroundColor: '#534AB7',
  color: '#ffffff',
  border: 'none',
  padding: '0.45rem 0.9rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontWeight: 500,
};

const declineBtnStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#3C3489',
  border: '1px solid #AFA9EC',
  padding: '0.45rem 0.9rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const executableBadgeStyle: React.CSSProperties = {
  marginLeft: '0.5rem',
  fontSize: '0.65rem',
  padding: '0.1rem 0.45rem',
  backgroundColor: '#534AB7',
  color: '#ffffff',
  borderRadius: '999px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontWeight: 500,
};

const typingStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: '0.85rem',
  color: '#64748b',
  fontStyle: 'italic',
  padding: '0.4rem 0.85rem',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginTop: '1rem',
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.6rem 0.85rem',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  resize: 'vertical',
};

const sendBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-end',
  backgroundColor: '#185FA5',
  color: '#ffffff',
  border: 'none',
  padding: '0.6rem 1.1rem',
  borderRadius: '8px',
  fontSize: '0.95rem',
  cursor: 'pointer',
  fontWeight: 500,
};

const attestationStyle: React.CSSProperties = {
  margin: '0.75rem 0 0',
  fontSize: '0.75rem',
  color: 'var(--color-text-muted, #94a3b8)',
  textAlign: 'center',
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.6rem 0.85rem',
  backgroundColor: '#fef2f2',
  color: '#991b1b',
  borderRadius: '6px',
  fontSize: '0.9rem',
};
