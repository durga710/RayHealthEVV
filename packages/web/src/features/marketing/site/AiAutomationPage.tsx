import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Platform › AI automation.
 * ACCURATE framing: the RayHealth copilot is a SHIPPED, LIVE feature, a
 * Claude-powered conversational assistant for admins and coordinators. It
 * runs human-in-the-loop by design: the model only *proposes* a structured
 * action; a person reviews and confirms before anything happens. Today it can
 * enroll a caregiver into a training course. Every interaction is audit-logged
 * (prompts are hashed, not stored in plaintext). It is opt-in per agency via a
 * plan flag (Claude on Amazon Bedrock; a faster model on Starter, a more
 * capable model on Pro).
 *
 * Honestly scoped as "coming soon" / roadmap and clearly labeled as such:
 * automated reminder dispatch (wired but the notification pipeline isn't
 * connected yet), schedule drafting, and claim-readiness triage.
 */

interface Capability {
  title: string;
  body: string;
  i: React.ReactNode;
}

interface TrustPoint {
  t: string;
  b: string;
  i: React.ReactNode;
}

interface RoadmapItem {
  status: string;
  title: string;
  body: string;
}

interface Faq {
  q: string;
  a: string;
}

const capabilities: readonly Capability[] = [
  {
    title: 'A conversational copilot',
    body: 'Admins and coordinators ask in plain language, “enroll Maria in EVV Fundamentals”, and the copilot answers, then proposes the structured action to carry it out.',
    i: mkic(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>),
  },
  {
    title: 'Enroll a caregiver',
    body: 'The copilot can enroll a caregiver into a training course today. It validates that the caregiver belongs to your agency and that the course is visible to you before it proposes the enrollment.',
    i: mkic(<><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" /></>),
  },
  {
    title: 'Send a caregiver reminder',
    body: 'Ask the copilot to remind a caregiver, a lapsing credential, an upcoming visit, a required course, and after you confirm, it sends a branded email to the caregiver on file. Email delivery is live today; push and SMS are next.',
    i: mkic(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
  },
  {
    title: 'Grounded in your agency',
    body: 'The copilot is given your agency context, active caregivers and available courses, so its suggestions are tied to real records in your account, not generic guesses.',
    i: mkic(<><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="13" y="7" width="3" height="10" /></>),
  },
  {
    title: 'Human-in-the-loop',
    body: 'The AI never acts on its own. It only proposes; a person reviews the proposed action and confirms it before anything is executed. Decline, and nothing happens.',
    i: mkic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  },
  {
    title: 'Every interaction logged',
    body: 'Each question writes a copilot.query audit event, and each decision writes a confirmed or declined event, so there is a defensible record of what was asked and what a person approved.',
    i: mkic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></>),
  },
  {
    title: 'Opt-in per agency',
    body: 'The copilot is off until you turn it on. Each agency enables it through its plan, a fast model on Starter, a more capable model on Pro, running on Claude via Amazon Bedrock, so you decide whether AI is part of your workflow.',
    i: mkic(<><path d="M12 2 4 5v6c0 6 8 10 8 10s8-4 8-10V5z" /><path d="M9 12l2 2 4-4" /></>),
  },
];

const trustPoints: readonly TrustPoint[] = [
  {
    t: 'You approve, not the AI',
    b: 'The model proposes a structured action; a coordinator confirms it before it runs. The AI has no authority to change your data on its own, the decision is always a person’s.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  },
  {
    t: 'Prompts are hashed, not stored',
    b: 'When you ask the copilot a question, the prompt is recorded as a hash in the audit log, never kept in plaintext, so you get an auditable trail without warehousing what your team typed.',
    i: mkic(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  },
  {
    t: 'A full audit trail',
    b: 'Ask and you get a copilot.query event; confirm or decline a proposed action and you get a copilot.action.confirmed or copilot.action.declined event. Every step is accounted for.',
    i: mkic(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  },
];

const roadmap: readonly RoadmapItem[] = [
  {
    status: 'Coming soon',
    title: 'Push & SMS reminders',
    body: 'Email reminder dispatch is live today, the copilot sends a branded email after you confirm. Push and SMS are the next delivery channels: the intent, confirmation, and audit trail are already wired; we’re connecting the push/SMS providers.',
  },
  {
    status: 'On the roadmap',
    title: 'Schedule drafting',
    body: 'Proposing a draft schedule from open authorizations and caregiver availability for a coordinator to review. This is a future direction, not a current capability.',
  },
  {
    status: 'On the roadmap',
    title: 'Claim-readiness triage',
    body: 'Flagging what a payer is likely to reject before a claim is submitted. On our roadmap, and, like everything here, it would stay human-in-the-loop.',
  },
];

const faqs: readonly Faq[] = [
  {
    q: 'Is the AI copilot live today?',
    a: 'Yes. The copilot is shipped and available in-app to admins and coordinators on agencies that have enabled it. You can ask it questions in natural language and it can propose a structured action for you to confirm.',
  },
  {
    q: 'What can it actually do right now versus later?',
    a: 'Live today: a conversational copilot that answers questions grounded in your agency context, an enroll-a-caregiver action that adds a caregiver to a training course after you confirm it, and a send-reminder action that emails a caregiver after you confirm it. Coming soon: push and SMS reminder channels (email is live). On the roadmap: schedule drafting and claim-readiness triage. We label what’s live and what isn’t so you’re never counting on something that hasn’t shipped.',
  },
  {
    q: 'Does the AI ever act on its own?',
    a: 'No. The copilot only proposes. It returns an answer and, when relevant, a structured action, but a person reviews and confirms that action before anything happens. If you decline, nothing is executed. Human-in-the-loop is enforced, not optional.',
  },
  {
    q: 'How do I turn it on?',
    a: 'The copilot is opt-in per agency and requires enabling the AI plan. It’s powered by Claude on Amazon Bedrock, a fast model on the Starter plan and a more capable model on the Pro plan. Until your agency’s plan enables it, the copilot stays off. See pricing for the plan details.',
  },
  {
    q: 'What does it know about my agency, and what gets stored?',
    a: 'The copilot is given context about your agency, active caregivers and available courses, so its suggestions are grounded in your real records. Every question is audit-logged as a copilot.query event with the prompt stored as a hash, never in plaintext, and every confirm or decline is logged too.',
  },
];

const Chrome = ({ url }: { url: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '0 4px 14px' }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
    <span style={{ marginLeft: '.5rem', fontSize: '.72rem', color: 'var(--mut)', fontWeight: 500 }}>{url}</span>
  </div>
);

const pill = (bg: string, c: string, text: string) => (
  <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '.2rem .5rem', borderRadius: 999, background: bg, color: c }}>{text}</span>
);

/** The trust throughline, rendered in brand colors (teal + orange). */
const SuggestBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', fontSize: '.68rem', fontWeight: 700, padding: '.2rem .5rem', borderRadius: 999, background: 'var(--accent2-tint)', color: 'var(--accent2-deep)' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent2)' }} />
    AI suggestion · review required
  </span>
);

/** Crafted chat showing ask → propose → you approve, in brand teal/orange. */
function CopilotVisual() {
  return (
    <div className="mk-visual">
      <Chrome url="app.rayhealthevv.com · Copilot" />
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* User question */}
        <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'var(--accent)', color: '#fff', borderRadius: '12px 12px 4px 12px', padding: '9px 12px', fontSize: '.85rem', lineHeight: 1.5 }}>
          Enroll Maria Santos in EVV Fundamentals.
        </div>

        {/* Copilot answer */}
        <div style={{ alignSelf: 'flex-start', maxWidth: '90%', background: 'var(--surface)', color: 'var(--ink-soft)', borderRadius: '12px 12px 12px 4px', padding: '9px 12px', fontSize: '.85rem', lineHeight: 1.5 }}>
          Maria Santos is an active caregiver at your agency and EVV Fundamentals is available. I’ve prepared the enrollment for your review.
        </div>

        {/* Proposed action card, review required */}
        <div style={{ border: '1px solid var(--accent2)', borderRadius: 12, padding: 14, background: 'var(--accent2-tint)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.85rem' }}>Proposed action</div>
            <SuggestBadge />
          </div>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '.85rem' }}>Enroll caregiver in course</div>
            <div style={{ color: 'var(--mut)', fontSize: '.74rem', marginTop: 2 }}>M. Santos → EVV Fundamentals · validated against your agency</div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: 12 }}>
            <span style={{ flex: 1, textAlign: 'center', fontSize: '.78rem', fontWeight: 600, color: '#fff', background: 'var(--accent)', borderRadius: 8, padding: '8px 0' }}>Confirm</span>
            <span style={{ flex: 1, textAlign: 'center', fontSize: '.78rem', fontWeight: 600, color: 'var(--ink-soft)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 0' }}>Decline</span>
          </div>
        </div>

        {/* Audit footnote */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.72rem', color: 'var(--mut)' }}>
          <span style={{ color: 'var(--accent-deep)', display: 'inline-flex' }}>{mkic(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>)}</span>
          Logged · prompt hashed, not stored in plaintext
        </div>
      </div>
    </div>
  );
}

const loopSteps: readonly { n: string; t: string; b: string }[] = [
  { n: '01', t: 'You ask', b: 'A coordinator types a request in natural language. The copilot has your agency context to ground its answer.' },
  { n: '02', t: 'It proposes', b: 'Claude answers and, when there’s an action to take, returns a structured proposal, validated against your agency first.' },
  { n: '03', t: 'You approve', b: 'You review the proposed action and confirm or decline. Nothing runs until a person says yes.' },
  { n: '04', t: 'It’s recorded', b: 'The question and your decision are written to the audit log, with the prompt stored as a hash.' },
];

export function AiAutomationPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Platform · AI automation</span>
          <div style={{ marginTop: 16 }}>
            <span className="mk-pill">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent2)', display: 'inline-block' }} />
              Live
            </span>
          </div>
          <h1 className="mk-h1">An AI copilot that proposes. Your team approves.</h1>
          <p className="mk-lead">
            RayHealth&rsquo;s copilot is live in the app today. Ask it in plain language and it answers,
            grounded in your agency&rsquo;s caregivers and courses, then proposes a structured action for a
            person to review. It&rsquo;s <strong>human-in-the-loop by design</strong>: the AI never acts on its
            own, and every interaction is audit-logged. Powered by Claude on Amazon Bedrock.
          </p>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">See it in a demo</Link>
            <a href="#loop" className="mk-btn mk-ghost">How it works</a>
          </div>
        </div>
      </header>

      {/* The ask → propose → you-approve loop, with crafted visual */}
      <section id="loop" className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">The loop</p>
              <h3>Ask in plain language. Approve the action.</h3>
              <p>
                The copilot is conversational. A coordinator asks a question; Claude answers and, when there&rsquo;s
                something to do, returns a proposed action. A person confirms it before anything happens, and the
                whole exchange is written to the audit trail.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Natural-language questions, grounded in your agency</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>The AI proposes, it never executes on its own</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>You confirm or decline; nothing runs until you do</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Ask and decision both logged, prompt stored as a hash</li>
              </ul>
            </div>
            <CopilotVisual />
          </div>

          {/* Four-step rail */}
          <div className="mk-steps" style={{ marginTop: 8 }}>
            {loopSteps.map((s) => (
              <div className="mk-step" key={s.n}>
                <div className="sn">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it does today */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <p className="mk-eylabel">Live today</p>
          <h2 className="mk-h2">What the copilot does now.</h2>
          <p className="mk-deck">
            Shipped and available in-app to admins and coordinators on agencies that have enabled it. No vaporware
            on this list, everything here works today.
          </p>
          <div className="mk-grid">
            {capabilities.map((c) => (
              <div className="mk-card" key={c.title}>
                <div className="mk-ficon">{c.i}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built on trust, dark section */}
      <section className="mk-sec mk-dark">
        <div className="mk-wrap">
          <div className="mk-center">
            <p className="mk-eylabel">Built on trust</p>
            <h2 className="mk-h2">AI you can put in front of an auditor.</h2>
            <p className="mk-deck">
              This is a Medicaid EVV product, so the copilot is designed for accountability first. The AI assists;
              a person decides; and there&rsquo;s a record of both.
            </p>
          </div>
          <div className="mk-grid" style={{ marginTop: 44 }}>
            {trustPoints.map((r) => (
              <div
                className="mk-card"
                key={r.t}
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--dark-line)' }}
              >
                <div className="mk-ficon" style={{ background: 'rgba(95,214,166,.14)', color: '#5fd0d6' }}>{r.i}</div>
                <h3 style={{ color: '#fff' }}>{r.t}</h3>
                <p style={{ color: '#9fa8a3' }}>{r.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* On the roadmap, clearly separated */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel" style={{ color: 'var(--accent2-deep)' }}>Not yet live</p>
          <h2 className="mk-h2">On the roadmap.</h2>
          <p className="mk-deck">
            We&rsquo;d rather be clear about what hasn&rsquo;t shipped than oversell it. These are honestly scoped, and
            every one of them would stay human-in-the-loop.
          </p>
          <div className="mk-grid">
            {roadmap.map((r) => (
              <div className="mk-card" key={r.title} style={{ background: 'var(--warm)' }}>
                <div style={{ marginBottom: 14 }}>{pill('var(--accent2-tint)', 'var(--accent2-deep)', r.status)}</div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">AI automation, answered straight.</h2></div>
          <div className="mk-faqs">
            {faqs.map((f) => (
              <div className="mk-faq" key={f.q}><h3>{f.q}</h3><p>{f.a}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>See the copilot, live.</h2>
            <p>
              Book a walkthrough and we&rsquo;ll show you the copilot answer a real question and propose an action you
              approve, then check the pricing plan that turns it on for your agency.
            </p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/pricing" className="mk-btn mk-outline">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
