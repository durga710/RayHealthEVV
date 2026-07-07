import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Platform › Compliance & audit.
 * LIVE capability. RayHealth records a tamper-evident audit trail and enforces
 * EVV compliance against the frameworks Pennsylvania home-care agencies answer
 * to: the 21st Century Cures Act, PA DHS / PROMISe, HIPAA, and Sandata
 * aggregator submission. This page describes shipped behavior.
 */

const frameworks = [
  { t: '21st Century Cures Act', b: 'Federal EVV mandate. RayHealth captures all six required elements on every visit, type of service, individual receiving it, the date, the location, the caregiver, and the begin/end times.',
    i: mkic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>) },
  { t: 'PA DHS / PROMISe', b: 'Built for Pennsylvania. Visit and service data is structured to line up with DHS expectations and the PROMISe claim world your billing flows through.',
    i: mkic(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h6" /></>) },
  { t: 'HIPAA safeguards', b: 'PHI is scoped per agency, sessions use HttpOnly cookies, passwords are hashed with bcrypt, and state-changing requests carry CSRF protection, privacy and security by construction.',
    i: mkic(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>) },
  { t: 'Sandata aggregator mapping', b: 'Pennsylvania routes EVV through the Sandata aggregator. RayHealth maps visit records to the aggregator’s expected format so submissions go out structured the way the state ingests them.',
    i: mkic(<><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></>) },
] as const;

const auditSteps = [
  { n: '01', t: 'Reviewer requests records', b: 'A DHS reviewer or internal auditor asks for the evidence behind a set of visits, who, when, where, and what was done.' },
  { n: '02', t: 'Pull the visit trail', b: 'Each visit carries its EVV elements and a tamper-evident log of every action taken on the record, with actor and timestamp.' },
  { n: '03', t: 'Show the chain', b: 'Edits, approvals, and submissions appear in order, nothing is silently overwritten, so the history reads as one defensible chain.' },
  { n: '04', t: 'Export the evidence', b: 'The verified visits and their audit trail export cleanly, so the answer to “prove it” is a file, not a scramble.' },
] as const;

const stats = [
  { v: '6/6', l: 'Cures Act EVV elements captured per visit' },
  { v: 'Per-agency', l: 'PHI scoping isolates each agency’s data' },
  { v: 'Every action', l: 'Logged with actor and timestamp' },
  { v: 'Append-only', l: 'Audit history, never silently overwritten' },
] as const;

const faqs = [
  { q: 'Is the audit trail and EVV compliance live today?', a: 'Yes. Tamper-evident audit logging and EVV compliance are shipped and in use. Every visit captures the six federal EVV elements, and actions on records are written to an append-only audit trail with the actor and a timestamp.' },
  { q: 'How does RayHealth protect PHI under HIPAA?', a: 'PHI is scoped per agency so one agency can never see another’s data, sessions run on HttpOnly cookies to keep tokens out of JavaScript, passwords are hashed with bcrypt, and state-changing requests are CSRF-protected. These are live safeguards, not roadmap items.' },
  { q: 'How do you handle Pennsylvania’s Sandata aggregator?', a: 'Pennsylvania routes EVV data through the Sandata aggregator. RayHealth maps each visit record to the aggregator’s expected structure so submissions are formatted the way the state ingests them, rather than left for staff to reshape by hand.' },
  { q: 'What makes the audit trail “tamper-evident”?', a: 'The trail is append-only: actions are recorded in sequence with their actor and timestamp, and history isn’t silently overwritten. When a record changes, the change is logged alongside what came before, so a reviewer sees the full chain, not just the latest state.' },
] as const;

const Chrome = ({ url }: { url: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', padding: '0 4px 14px' }}>
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
    <span style={{ marginLeft: '.5rem', fontSize: '.72rem', color: 'var(--mut)', fontWeight: 500 }}>{url}</span>
  </div>
);

type LogRow = { actor: string; action: string; ts: string; dot: string };

const logRows: readonly LogRow[] = [
  { actor: 'm.santos@agency', action: 'visit.clock_in', ts: '2026-06-22 09:01:14', dot: '#16a34a' },
  { actor: 'm.santos@agency', action: 'visit.task_complete', ts: '2026-06-22 09:46:03', dot: '#16a34a' },
  { actor: 'm.santos@agency', action: 'visit.clock_out', ts: '2026-06-22 11:02:51', dot: '#16a34a' },
  { actor: 'k.lee@agency', action: 'visit.edit_time', ts: '2026-06-22 14:18:22', dot: '#b45309' },
  { actor: 'k.lee@agency', action: 'visit.approve', ts: '2026-06-22 14:19:07', dot: '#107480' },
  { actor: 'system', action: 'evv.submit.sandata', ts: '2026-06-22 18:00:00', dot: '#107480' },
] as const;

export function CompliancePlatformPage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Platform · Compliance</span>
          <h1 className="mk-h1">Compliance you can prove, not just promise.</h1>
          <p className="mk-lead">
            RayHealth records a tamper-evident audit trail and enforces EVV compliance against the frameworks
            Pennsylvania home-care agencies actually answer to. When a reviewer asks you to prove a visit happened,
            the evidence is already there, captured, scoped, and exportable. This is live today.
          </p>
          <div className="mk-herocta">
            <span className="mk-pill">{mkic(MK_CHECK)} Live · audit trail &amp; EVV compliance</span>
          </div>
          <div className="mk-herocta">
            <Link to="/demo" className="mk-btn mk-pri">Book a demo</Link>
            <Link to="/compliance/hipaa" className="mk-btn mk-ghost">Read our HIPAA posture</Link>
          </div>
        </div>
      </header>

      {/* Frameworks grid */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">The frameworks you answer to</p>
          <h2 className="mk-h2">Built around the rules that govern PA home care.</h2>
          <p className="mk-deck">RayHealth isn&rsquo;t compliance theater bolted on after the fact, these requirements shape how visits are captured, stored, and submitted.</p>
          <div className="mk-grid cols2">
            {frameworks.map((f) => (
              <div className="mk-card" key={f.t}>
                <div className="mk-ficon">{f.i}</div>
                <h3>{f.t}</h3>
                <p>{f.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep dives with crafted visuals */}
      <section className="mk-sec mk-alt">
        <div className="mk-wrap">
          {/* Tamper-evident audit log */}
          <div className="mk-feat">
            <div className="mk-feattext">
              <p className="mk-eylabel">Tamper-evident audit log</p>
              <h3>Every action, in order, with a name on it.</h3>
              <p>
                RayHealth writes an append-only record of what happened to each visit, who clocked in, who edited a
                time, who approved it, and when it went to the aggregator. History isn&rsquo;t silently overwritten,
                so the chain reads as evidence a reviewer can trust.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Actor, action, and timestamp on every event</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Append-only, edits are logged, not erased</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Scoped per agency, exportable for a review</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="app.rayhealthevv.com · Audit trail · visit #48217" />
              <div style={{ background: '#0a0f0d', border: '1px solid var(--line)', borderRadius: 12, padding: 14, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}>
                {logRows.map((r, i) => (
                  <div key={r.ts} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '9px 2px', borderTop: i ? '1px solid rgba(255,255,255,.08)' : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: '.72rem', color: '#9fa8a3', width: '6.2rem', flexShrink: 0 }}>{r.actor}</span>
                    <span style={{ fontSize: '.72rem', color: '#5fd0d6', flex: 1 }}>{r.action}</span>
                    <span style={{ fontSize: '.68rem', color: '#6b746f', flexShrink: 0 }}>{r.ts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cures Act six elements */}
          <div className="mk-feat rev">
            <div className="mk-feattext">
              <p className="mk-eylabel">21st Century Cures Act</p>
              <h3>All six EVV elements, on every visit.</h3>
              <p>
                The federal mandate names six things every electronic visit must record. RayHealth captures all of
                them automatically at clock-in and clock-out, so a verified visit is complete by construction, not
                by a coordinator remembering to fill in a field.
              </p>
              <ul className="mk-checks">
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Type of service, individual served, and caregiver identity</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Date, location, and begin/end times of the visit</li>
                <li><span className="mk-ck">{mkic(MK_CHECK)}</span>Captured at the point of care, not reconstructed later</li>
              </ul>
            </div>
            <div className="mk-visual">
              <Chrome url="Visit #48217 · EVV elements" />
              <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
                {[
                  { l: 'Type of service', v: 'PCA, personal care' },
                  { l: 'Individual receiving service', v: 'Member #PA-····-2291' },
                  { l: 'Date of service', v: '2026-06-22' },
                  { l: 'Location of service', v: 'Home · GPS verified' },
                  { l: 'Individual providing service', v: 'M. Santos' },
                  { l: 'Begin & end time', v: '09:01, 11:02' },
                ].map((r, i) => (
                  <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, display: 'grid', placeItems: 'center', background: '#e7f6ec', color: '#16a34a', flexShrink: 0 }}>{mkic(MK_CHECK)}</span>
                    <span style={{ fontSize: '.82rem', color: 'var(--mut)', flex: 1 }}>{r.l}</span>
                    <span style={{ fontSize: '.82rem', color: 'var(--ink)', fontWeight: 600 }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How an audit goes */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <p className="mk-eylabel">How it operates</p>
          <h2 className="mk-h2">How an audit goes with RayHealth.</h2>
          <p className="mk-deck">When the request for evidence lands, the work is mostly already done, because every visit was captured cleanly the first time.</p>
          <div className="mk-steps">
            {auditSteps.map((s) => (
              <div className="mk-step" key={s.n}>
                <div className="sn">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mk-sec tight mk-alt">
        <div className="mk-wrap">
          <div className="mk-stats">
            {stats.map((s) => (
              <div className="mk-stat" key={s.l}><div className="v">{s.v}</div><div className="l">{s.l}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-center"><p className="mk-eylabel">Questions</p><h2 className="mk-h2">Compliance &amp; audit, answered.</h2></div>
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
            <h2>See the audit trail on a real visit.</h2>
            <p>We&rsquo;ll walk a visit from clock-in to aggregator submission and show you the tamper-evident log a reviewer would see, live, today.</p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/compliance/hipaa" className="mk-btn mk-outline">Read our HIPAA posture</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
