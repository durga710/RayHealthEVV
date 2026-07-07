import { useEffect, useState, type ReactElement } from 'react';
import { getJson } from '../../lib/api-client.js';

/**
 * AICopilotPanel, the visible-but-locked surface on the Learning Hub.
 *
 * Per brand guidance: the AI workflow copilot is a paid agency add-on with
 * private billing visibility. When the flag is OFF (the default), the surface
 * still renders so coordinators see what's coming, they just can't use it.
 * The "Enable" CTA is visible only to admins (private billing).
 *
 * The actual AI calls (Gemini per-role defaults, confirm-every-action) are
 * wired in a follow-up, this is the entry surface.
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
  /** Currently-authed user role, drives whether the Enable CTA is shown. */
  userRole?: 'admin' | 'coordinator' | 'caregiver' | 'family';
}

export function AICopilotPanel({ userRole }: AICopilotPanelProps): ReactElement | null {
  const [features, setFeatures] = useState<AgencyFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Source of truth for the copilot add-on flag is the copilot status
        // endpoint (returns { enabled, plan }); map it into the feature shape.
        const response = await getJson<ApiResponse<AiCopilotFlag>>('/api/copilot/status');
        if (cancelled) return;
        if (response.success && response.data) {
          setFeatures({ aiCopilot: { enabled: response.data.enabled, plan: response.data.plan } });
        } else {
          // Failed to load, assume off (safe default).
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
    <section style={lockedSectionStyle}>
      <div style={lockedInnerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <span aria-hidden style={{ display: 'inline-flex', color: '#475569' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>AI Workflow Copilot</h3>
          <span style={addonBadgeStyle}>Add-on</span>
        </div>
        <p style={{ margin: '0 0 0.85rem', color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Ask plain-English questions about your training compliance. "Who's due for
          HIPAA refresh next week?" "Why is Roberto stuck on dementia care?"
          Coordinator-level decisions stay in your hands, the copilot proposes,
          you confirm.
        </p>

        <ul style={featureListStyle}>
          <li>Per-role assistant: caregiver, coordinator, owner</li>
          <li>Smart enrollment suggestions based on visit history</li>
          <li>Automatic reminders before due dates and expiry</li>
          <li>Every action requires your confirmation, nothing automated silently</li>
        </ul>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {isAdmin ? (
            <a href="/admin/billing/ai-copilot" style={primaryCtaStyle}>
              Enable Copilot →
            </a>
          ) : (
            <span style={mutedNoteStyle}>
              Only your agency owner can enable this add-on.
            </span>
          )}
          <a href="/admin/learning/copilot-preview" style={secondaryLinkStyle}>
            See a demo
          </a>
        </div>
      </div>
    </section>
  );
}

// ---------- Unlocked state (stub) ----------

function UnlockedPanel({ plan }: { plan: 'starter' | 'pro' | 'off' }): ReactElement {
  return (
    <section style={unlockedSectionStyle}>
      <div style={lockedInnerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <span aria-hidden style={{ display: 'inline-flex', color: '#534AB7' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
            </svg>
          </span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>AI Workflow Copilot</h3>
          <span style={planBadgeStyle}>{plan === 'pro' ? 'Pro' : 'Starter'}</span>
        </div>
        <p style={{ margin: '0 0 0.85rem', color: '#475569', fontSize: '0.9rem' }}>
          Copilot is active. The chat surface and per-role assistants land in the next release.
          For now, the deterministic insights above cover most coordinator needs.
        </p>
        <a href="/admin/learning/copilot" style={primaryCtaStyle}>
          Open Copilot →
        </a>
      </div>
    </section>
  );
}

// ---------- Styles ----------

const lockedSectionStyle: React.CSSProperties = {
  marginTop: '2rem',
  padding: '1.25rem',
  backgroundColor: '#f8fafc',
  border: '1px dashed #cbd5e1',
  borderRadius: '12px',
  position: 'relative',
};

const unlockedSectionStyle: React.CSSProperties = {
  marginTop: '2rem',
  padding: '1.25rem',
  backgroundColor: '#EEEDFE',
  border: '1px solid #AFA9EC',
  borderRadius: '12px',
};

const lockedInnerStyle: React.CSSProperties = {
  maxWidth: '640px',
};

const featureListStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  padding: '0 0 0 1.25rem',
  color: '#475569',
  fontSize: '0.85rem',
  lineHeight: 1.7,
};

const addonBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.15rem 0.5rem',
  borderRadius: '999px',
  backgroundColor: '#E6F1FB',
  color: '#0C447C',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const planBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.15rem 0.5rem',
  borderRadius: '999px',
  backgroundColor: '#CECBF6',
  color: '#3C3489',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const primaryCtaStyle: React.CSSProperties = {
  textDecoration: 'none',
  backgroundColor: '#534AB7',
  color: '#ffffff',
  padding: '0.55rem 1rem',
  borderRadius: '6px',
  fontSize: '0.9rem',
  fontWeight: 500,
};

const secondaryLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#534AB7',
  fontSize: '0.85rem',
  alignSelf: 'center',
  fontWeight: 500,
};

const mutedNoteStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #64748b)',
  fontSize: '0.85rem',
  alignSelf: 'center',
};
