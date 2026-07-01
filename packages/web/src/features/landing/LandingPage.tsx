import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SupportChat } from '../support/SupportChat.js';
import { BrandLogo } from '../../components/brand/BrandLogo.js';
import { RayVerifySection } from './RayVerifySection.js';

/* ─────────────────────────────────────────────────────────────
   RayHealth landing — editorial, emerald-accented, enterprise.
   Self-contained: design system lives in the scoped <style> block
   below (main app has no Tailwind).
   ───────────────────────────────────────────────────────────── */

const metrics = [
  { value: '6/6', label: 'Federal EVV elements captured on every visit' },
  { value: '<5m', label: 'GPS accuracy at clock-in and clock-out' },
  { value: '40%', label: 'Fewer claim denials in the first quarter' },
  { value: '100%', label: 'Aligned with PA DHS and the Cures Act' },
];

const ic = (d: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

const capabilities = [
  {
    span: 'wide', live: true, kicker: 'AI copilot',
    title: 'An AI copilot that proposes — you approve',
    body: 'Ask in plain language. The Claude-powered copilot answers with your agency context and proposes the action — enroll a caregiver in required training, surface what needs attention — then waits for a human to confirm. Every query and action is audit-logged.',
    icon: ic(<><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></>),
  },
  {
    span: 'one', live: true, kicker: 'Scheduling',
    title: 'Conflict-aware scheduling',
    body: 'Build the week visually. Credential and authorization clashes surface before you publish.',
    icon: ic(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></>),
  },
  {
    span: 'one', live: true, kicker: 'EVV',
    title: 'Electronic visit verification',
    body: 'Clock-in and clock-out GPS-checked against the client’s registered address, with all six federal data elements captured automatically.',
    icon: ic(<><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
  },
  {
    span: 'one', live: true, kicker: 'Compliance',
    title: 'Audit-ready by design',
    body: 'Every change appended to a tamper-evident log — actor, outcome, payload — keyed per agency.',
    icon: ic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>),
  },
  {
    span: 'half', live: false, kicker: 'Payroll',
    title: 'Visit-to-payroll, reconciled',
    body: 'Turn verified visits into clean payroll and billing runs — units, rates, and EVV status reconciled in one queue, with exceptions surfaced before they cost you.',
    icon: ic(<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>),
  },
  {
    span: 'half', live: true, kicker: 'Agency management',
    title: 'Run the whole agency',
    body: 'Credentialing, training, client records, and authorizations in one operational core — so the office stops living in spreadsheets and email threads.',
    icon: ic(<><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6M3 21h18" /></>),
  },
];

const aiPoints = [
  { title: 'Proposes, you approve', body: 'Ask in plain language. The copilot proposes the action — nothing executes until a human confirms it. Human-in-the-loop by design.' },
  { title: 'Acts in your workflow', body: 'Grounded in your agency’s real caregivers and courses, it can enroll a caregiver in required training on your confirmation. More actions are rolling out.' },
  { title: 'Audit-logged by design', body: 'Every query (prompt hashed, never stored in plaintext) and every confirmed or declined action is written to the tamper-evident trail.' },
];

const standards = [
  { name: 'PA DHS', note: 'PROMISe-aligned' },
  { name: '21st Century Cures Act', note: 'Six-element EVV' },
  { name: 'HIPAA', note: 'PHI scoped per agency' },
  { name: 'Sandata', note: 'Aggregator mapping' },
];

// Outcome statements by role — honest product capabilities, not fabricated
// customer quotes (this is a new product; we will feature named agencies as
// our first customers go live).
const outcomes = [
  {
    quote: 'Replace three systems and a wall of spreadsheets with one operational core — scheduling, EVV, compliance, and the audit trail in the same place.',
    persona: 'For operations directors', featured: true,
  },
  {
    quote: 'GPS clock-in captures all six federal elements automatically, so every visit is defensible and your audit trail builds itself.',
    persona: 'For compliance officers',
  },
  {
    quote: 'Credential and authorization conflicts surface before you publish — so the week you send is the week that holds.',
    persona: 'For schedulers & coordinators',
  },
];

const audiences = [
  { role: 'Agency owners & administrators', body: 'Real-time visibility into visits, compliance posture, and cash flow — without waiting on a coordinator to assemble a report.', points: ['Live operational dashboard', 'Denial and exception trends', 'Per-agency audit trail'] },
  { role: 'Schedulers & coordinators', body: 'Build the week in minutes and let the platform catch the conflicts. Spend the day on people, not paperwork.', points: ['Conflict-aware scheduling', 'One exception queue', 'Credential & authorization guardrails'] },
  { role: 'Caregivers in the field', body: 'A phone app that takes seconds: clock in by GPS, read the care plan at the door, and finish training on the go.', points: ['GPS clock-in / clock-out', 'Care plan & PA task codes', 'In-app EVV Academy'] },
];

const moduleGroups = [
  { group: 'Operations', items: ['Visual weekly scheduling', 'Client & caregiver records', 'Authorization tracking', 'Open-shift management'] },
  { group: 'EVV & Compliance', items: ['Six-element GPS verification', 'Telephony & offline fallback', 'Tamper-evident audit log', 'Task codes 106–256'] },
  { group: 'Billing & Payroll', items: ['Visit-to-claim reconciliation', 'Unit & rate validation', 'Payroll-ready exports', 'Denial-risk flags'] },
  { group: 'Workforce & Training', items: ['Credential & screening tracking', 'Expiry & renewal alerts', 'EVV Academy lessons', 'Certificate management'] },
];

const workflow = [
  { n: '01', t: 'Import authorizations', b: 'Pull from Sandata or PROMISe into reusable, PA-coded visit templates.' },
  { n: '02', t: 'Schedule credentialed staff', b: 'Assign caregivers with live eligibility, credential, and authorization checks.' },
  { n: '03', t: 'Verify at the door', b: 'GPS clock-in captures all six federal EVV elements automatically.' },
  { n: '04', t: 'Reconcile billing & payroll', b: 'Turn verified visits into clean claims and payroll runs in one queue.' },
  { n: '05', t: 'File & defend the audit', b: 'Every action is logged and keyed per agency — audits become an afternoon.' },
];

const integrations = ['Sandata aggregator', 'PA PROMISe', 'Telephony / IVR', 'Payroll export', 'iOS & Android', 'Secure messaging'];

const resources = [
  { tag: 'Guide', t: 'Everything PA agencies need to know about EVV', b: 'The six federal elements, aggregator submission, and the mistakes that trigger denials.', to: '/resources/evv-guide' },
  { tag: 'Reference', t: 'PA DHS task codes 106–256, explained', b: 'A plain-English map of personal-assistance duty codes and how to use them in care plans.', to: '/resources/task-codes' },
  { tag: 'Checklist', t: 'Preparing for a DHS audit', b: 'What auditors actually ask for — and how an immutable trail answers it in minutes.', to: '/resources/audit-checklist' },
  { tag: 'Playbook', t: 'Cutting claim denials in your first quarter', b: 'The exception-resolution workflow that turns rejected claims into paid ones.', to: '/solutions/billing-payroll' },
  { tag: 'Guide', t: 'Onboarding caregivers onto GPS clock-in', b: 'A rollout plan that gets your field team verifying visits in days, not weeks.', to: '/solutions/electronic-visit-verification' },
  { tag: 'Article', t: 'Telephony & offline EVV: covering every home', b: 'How RayHealth verifies visits where there is no signal — and stays compliant.', to: '/solutions/electronic-visit-verification' },
];

const spotlights = [
  { key: 'scheduling', kicker: 'Scheduling', title: 'Build the week, catch every conflict.', body: 'Drag visits onto a calendar and let the platform enforce the rules — expired credentials, overlapping authorizations, and travel gaps surface before you publish.', points: ['Live eligibility & credential checks', 'Authorization burn-down per client', 'Open-shift and coverage alerts'] },
  { key: 'evv', kicker: 'Electronic visit verification', title: 'Proof on every visit, automatically.', body: 'Clock-in and clock-out are GPS-checked against the client’s registered address and capture all six federal EVV elements the moment a visit begins — with telephony and offline fallback so no home is left uncovered.', points: ['Six federal elements per visit', 'Geofenced to the client’s registered address', 'Offline capture with automatic retry'] },
  { key: 'audit', kicker: 'Compliance & audit', title: 'An audit trail that defends itself.', body: 'Every state change is appended to a tamper-evident log — actor, action, outcome, timestamp — scoped per agency. What used to take a week of binders takes an afternoon.', points: ['Append-only, tamper-evident log', 'Filter by actor, client, or action', 'Export-ready for DHS review'] },
];

const comparison = {
  rows: [
    { label: 'Visit verification', old: 'Paper timesheets, phone calls', neu: 'GPS-verified, six EVV elements' },
    { label: 'Scheduling conflicts', old: 'Found after the fact', neu: 'Caught before you publish' },
    { label: 'Claim denials', old: 'Chased one by one', neu: 'Flagged before billing' },
    { label: 'Audit prep', old: 'A week of binders', neu: 'An afternoon of exports' },
    { label: 'Caregiver training', old: 'Separate LMS & spreadsheets', neu: 'Built into the platform' },
  ],
};

const pricingTiers = [
  { name: 'Starter', price: 'Custom', unit: '', desc: 'For new and small agencies getting compliant fast.', feat: ['Scheduling & EVV', 'PA DHS task codes', 'Caregiver mobile app', 'Immutable audit trail'], featured: false, cta: 'Get a quote' },
  { name: 'Growth', price: 'Custom', unit: '', desc: 'For scaling agencies that live in the platform.', feat: ['Everything in Starter', 'Billing reconciliation', 'Exception queues & alerts', 'Priority onboarding'], featured: true, cta: 'Book a demo' },
  { name: 'Enterprise', price: "Let's talk", unit: '', desc: 'For multi-site providers with advanced needs.', feat: ['Everything in Growth', 'AI automation suite', 'Custom integrations', 'Dedicated success manager'], featured: false, cta: 'Talk to sales' },
];

const missionStats = [
  { v: '100%', l: 'PA DHS & Cures Act aligned' },
  { v: '6/6', l: 'EVV elements per visit' },
  { v: '1 wk', l: 'Typical time to first visits' },
  { v: '24/7', l: 'Tamper-evident audit trail' },
];

const faqs = [
  { q: 'Does RayHealth submit to the Pennsylvania EVV aggregator?', a: 'Visits are captured against the federal six-element schema and mapped for downstream submission to the Sandata aggregator used by PA DHS.' },
  { q: 'What if a caregiver has no signal in the home?', a: 'The app captures the visit offline and retries automatically; a telephony (IVR) fallback covers devices without data.' },
  { q: 'How long does implementation take?', a: 'Most agencies import authorizations and onboard their first caregivers within a week. We handle the data migration with you.' },
  { q: 'Is RayHealth only for Pennsylvania?', a: 'Today we are purpose-built for Pennsylvania personal-assistance and home-health programs. The compliance core is designed to extend to additional states.' },
  { q: 'How is our data protected?', a: 'PHI is scoped per agency with HttpOnly sessions, bcrypt hashing, CSRF protection, and a tamper-evident audit log of every action.' },
  { q: 'Can caregivers be trained inside the platform?', a: 'The EVV Academy delivers lessons, quizzes, and certificate renewals so training and compliance live in one place. (Rolling out.)' },
];


const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.rh{
  --ink:#0a0f0d; --ink-soft:#39433e; --body:#525c57; --muted:#8a948e;
  --paper:#ffffff; --warm:#fbfbf8; --surface:#f5f6f3; --line:#e8eae4; --line-2:#dde0d9;
  --accent:#107480; --accent-deep:#0c5d66; --accent-tint:#e7f3f4;
  --accent2:#ee6c2c; --accent2-deep:#d8551b; --accent2-tint:#fdeee4;
  --dark:#0a0f0d; --dark-line:rgba(255,255,255,.10);
  --maxw:1120px;
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  color:var(--body); background:var(--paper); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
.rh *{box-sizing:border-box;}
.rh h1,.rh h2,.rh h3,.rh h4{color:var(--ink); margin:0; font-weight:600; letter-spacing:-0.02em;}
.rh p{margin:0;}
.rh :where(a){text-decoration:none; color:inherit;}
html{scroll-behavior:smooth;}
.rh [id]{scroll-margin-top:88px;}
.rh-wrap{max-width:var(--maxw); margin:0 auto; padding:0 24px;}

/* buttons */
.rh-btn{display:inline-flex; align-items:center; gap:.5rem; height:44px; padding:0 1.25rem; border-radius:10px; font-size:.9375rem; font-weight:550; transition:transform .16s ease, background .16s ease, box-shadow .16s ease, border-color .16s ease;}
.rh-btn-pri{background:var(--accent); color:#fff; box-shadow:0 1px 0 rgba(10,30,20,.04), 0 8px 24px -12px rgba(16,116,128,.6);}
.rh-btn-pri:hover{background:var(--accent-deep); transform:translateY(-1px);}
.rh-btn-ghost{color:var(--ink); border:1px solid var(--line-2); background:var(--paper);}
.rh-btn-ghost:hover{border-color:var(--ink); }
.rh-btn-dark{background:#fff; color:var(--ink);}
.rh-btn-dark:hover{transform:translateY(-1px); box-shadow:0 10px 30px -14px rgba(0,0,0,.5);}
.rh-btn-line{color:var(--ink); font-weight:550; font-size:.9375rem; display:inline-flex; align-items:center; gap:.4rem;}
.rh-btn-line .arr{transition:transform .18s ease;}
.rh-btn-line:hover .arr{transform:translateX(3px);}

/* nav */
.rh-nav{position:sticky; top:0; z-index:60; background:rgba(255,255,255,.72); backdrop-filter:blur(16px) saturate(160%); border-bottom:1px solid var(--line);}
.rh-navin{max-width:var(--maxw); margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between;}
.rh-logo{display:inline-flex; align-items:center; gap:.55rem; font-weight:650; font-size:1.0625rem; color:var(--ink); letter-spacing:-.02em;}
.rh-navmid{display:flex; gap:4px;}
.rh-navmid a{padding:.5rem .8rem; border-radius:8px; font-size:.9rem; font-weight:500; color:var(--ink-soft); transition:color .15s, background .15s;}
.rh-navmid a:hover{color:var(--ink); background:var(--surface);}
.rh-navend{display:flex; align-items:center; gap:.6rem;}
.rh-navend .signin{font-size:.9rem; font-weight:550; color:var(--ink); padding:.5rem .4rem;}
.rh-burger{display:none; width:42px; height:42px; align-items:center; justify-content:center; border:1px solid var(--line-2); border-radius:10px; background:var(--paper); color:var(--ink); cursor:pointer; padding:0; transition:border-color .15s ease, background .15s ease;}
.rh-burger:hover{border-color:var(--ink); background:var(--surface);}
.rh-mobile{display:none; border-top:1px solid var(--line); background:var(--paper);}
.rh-mobile-in{max-width:var(--maxw); margin:0 auto; padding:6px 24px 18px; display:flex; flex-direction:column;}
.rh-mobile a{padding:14px 4px; font-size:1rem; font-weight:500; color:var(--ink); border-bottom:1px solid var(--line);}
.rh-mobile a:hover{color:var(--accent-deep);}
.rh-mobile .rh-btn-pri{margin-top:16px; width:100%; border-bottom:none;}
@media(max-width:860px){ .rh-navmid{display:none;} .rh-navend .signin{display:none;} .rh-burger{display:inline-flex;} .rh-mobile.open{display:block;} }
@media(max-width:420px){ .rh-navend .rh-btn-pri{display:none;} }

/* hero */
.rh-hero{position:relative; overflow:hidden; background:var(--warm); border-bottom:1px solid var(--line);}
.rh-hero-bloom{position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(48% 52% at 80% 14%, rgba(16,116,128,.12), transparent 72%), radial-gradient(38% 38% at 6% 0%, rgba(16,116,128,.06), transparent 70%);}
.rh-hero-grid{position:absolute; inset:0; pointer-events:none;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:64px 64px; opacity:.45;
  -webkit-mask-image:radial-gradient(ellipse 80% 70% at 28% 8%, #000 8%, transparent 64%);
  mask-image:radial-gradient(ellipse 80% 70% at 28% 8%, #000 8%, transparent 64%);}
.rh-heroin{position:relative; max-width:var(--maxw); margin:0 auto; padding:72px 24px 0; display:grid; grid-template-columns:1.02fr .98fr; gap:56px; align-items:center;}
.rh-herotext{max-width:34rem;}
.rh-eyebrow{display:inline-flex; align-items:center; gap:.5rem; padding:.4rem .8rem .4rem .55rem; border-radius:999px; background:var(--paper); border:1px solid var(--line-2); font-size:.78rem; font-weight:550; color:var(--ink-soft); box-shadow:0 1px 2px rgba(10,20,15,.03);}
.rh-eyebrow .pip{width:7px; height:7px; border-radius:50%; background:var(--accent2); box-shadow:0 0 0 0 rgba(238,108,44,.45); animation:rh-pip 2.4s ease-out infinite;}
@keyframes rh-pip{0%{box-shadow:0 0 0 0 rgba(238,108,44,.45);}70%{box-shadow:0 0 0 7px rgba(238,108,44,0);}100%{box-shadow:0 0 0 0 rgba(238,108,44,0);}}
.rh-display{margin:22px 0 0; font-size:clamp(2.4rem,4.4vw,3.4rem); line-height:1.05; letter-spacing:-0.035em; font-weight:600; color:var(--ink); text-wrap:balance;}
.rh-display .em{color:var(--accent-deep);}
.rh-sublede{margin:20px 0 0; max-width:46ch; font-size:1.125rem; line-height:1.6; color:var(--body);}
.rh-herocta{margin-top:28px; display:flex; gap:.75rem; flex-wrap:wrap;}
.rh-herotrust{list-style:none; margin:26px 0 0; padding:0; display:flex; flex-wrap:wrap; gap:10px 22px;}
.rh-herotrust li{display:inline-flex; align-items:center; gap:.45rem; font-size:.875rem; font-weight:500; color:var(--ink-soft);}
.rh-herotrust svg{width:17px; height:17px; color:var(--accent); flex-shrink:0;}
.rh-heromedia{position:relative;}
.rh-photo{position:relative; border-radius:20px; overflow:hidden; aspect-ratio:4/5; border:1px solid var(--line-2);
  background:#e9ece8 center 22% / cover no-repeat;
  background-image:url('https://images.unsplash.com/photo-1581579439134-50af06bb2dd0?q=80&w=1100&auto=format&fit=crop');
  box-shadow:0 44px 84px -44px rgba(10,30,20,.45);}
.rh-photobadge{position:absolute; left:16px; bottom:16px; display:flex; align-items:center; gap:.6rem; background:rgba(255,255,255,.94); backdrop-filter:blur(8px); border:1px solid var(--line); border-radius:12px; padding:.55rem .7rem; box-shadow:0 12px 28px -14px rgba(10,30,20,.45);}
.rh-photobadge .chk{width:30px; height:30px; border-radius:8px; background:var(--accent-tint); color:var(--accent-deep); display:grid; place-items:center;}
.rh-photobadge .t1{font-size:.82rem; font-weight:600; color:var(--ink); line-height:1.1;}
.rh-photobadge .t2{font-size:.72rem; color:var(--muted); margin-top:1px;}
.rh-standbar{position:relative; margin-top:64px; border-top:1px solid var(--line); background:var(--paper);}
.rh-standrow{max-width:var(--maxw); margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr);}
.rh-standard{padding:20px 24px; border-right:1px solid var(--line);}
.rh-standard:last-child{border-right:none;}
.rh-standard .nm{font-size:.92rem; font-weight:600; color:var(--ink);}
.rh-standard .nt{font-size:.78rem; color:var(--muted); margin-top:2px;}
@media(max-width:880px){ .rh-heroin{grid-template-columns:1fr; gap:36px; padding-top:52px;} .rh-herotext{max-width:none;} .rh-photo{aspect-ratio:16/10;} }
@media(max-width:680px){ .rh-standrow{grid-template-columns:1fr 1fr;} .rh-standard:nth-child(2){border-right:none;} .rh-standard:nth-child(1),.rh-standard:nth-child(2){border-bottom:1px solid var(--line);} }

/* section scaffolding */
.rh-sec{padding:104px 0;}
.rh-sec.tight{padding:80px 0;}
.rh-eyelabel{font-size:.78rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--accent-deep);}
.rh-h2{font-size:clamp(1.9rem,3.4vw,2.6rem); line-height:1.1; letter-spacing:-.03em; margin-top:14px;}
.rh-deck{margin-top:16px; font-size:1.0625rem; line-height:1.6; color:var(--body); max-width:54ch;}
.rh-sechead{max-width:var(--maxw); margin:0 auto; padding:0 24px;}
.rh-sechead.center{text-align:center;} .rh-sechead.center .rh-deck{margin-left:auto; margin-right:auto;}

/* metric band */
.rh-metricband{border-top:1px solid var(--line); border-bottom:1px solid var(--line); background:var(--paper);}
.rh-metricgrid{max-width:var(--maxw); margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr);}
.rh-metric{padding:40px 28px; border-right:1px solid var(--line);}
.rh-metric:last-child{border-right:none;}
.rh-metric .v{font-size:2.5rem; font-weight:600; letter-spacing:-.04em; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1;}
.rh-metric .l{margin-top:10px; font-size:.875rem; line-height:1.5; color:var(--muted);}
@media(max-width:760px){ .rh-metricgrid{grid-template-columns:1fr 1fr;} .rh-metric:nth-child(2){border-right:none;} .rh-metric:nth-child(1),.rh-metric:nth-child(2){border-bottom:1px solid var(--line);} }

/* bento */
.rh-bento{max-width:var(--maxw); margin:44px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(6,1fr); gap:14px;}
.rh-cell{grid-column:span 2; background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:28px; transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;}
.rh-cell:hover{border-color:var(--line-2); box-shadow:0 18px 40px -28px rgba(10,30,20,.4); transform:translateY(-2px);}
.rh-cell.wide{grid-column:span 6; display:flex; gap:28px; align-items:flex-start; background:linear-gradient(180deg,var(--accent-tint),var(--paper) 60%); border-color:#cdeadd;}
.rh-cell.half{grid-column:span 3;}
.rh-cellicon{width:42px; height:42px; border-radius:11px; display:grid; place-items:center; background:var(--accent-tint); color:var(--accent-deep); flex-shrink:0;}
.rh-cell.wide .rh-celltext{flex:1;}
.rh-kicker{display:flex; align-items:center; gap:.5rem; margin-top:18px; font-size:.74rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--accent-deep);}
.rh-cell.wide .rh-kicker{margin-top:0;}
.rh-celltitle{margin-top:8px; font-size:1.1875rem; letter-spacing:-.02em;}
.rh-cellbody{margin-top:8px; font-size:.9375rem; line-height:1.6; color:var(--body);}
.rh-flag{margin-left:auto; font-size:.68rem; font-weight:650; letter-spacing:.04em; padding:.18rem .5rem; border-radius:6px;}
.rh-flag.live{background:var(--accent-tint); color:var(--accent-deep);}
.rh-flag.soon{background:var(--surface); color:var(--muted); border:1px solid var(--line);}
.rh-cellhead{display:flex; align-items:center; gap:.6rem;}
@media(max-width:880px){ .rh-bento{grid-template-columns:1fr;} .rh-cell,.rh-cell.wide,.rh-cell.half{grid-column:span 1;} .rh-cell.wide{flex-direction:column; gap:18px;} }

/* dark AI band */
.rh-dark{background:var(--dark); color:#cfd6d2; position:relative; overflow:hidden;}
.rh-dark::before{content:""; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(50% 60% at 80% 0%, rgba(16,116,128,.18), transparent 70%);}
.rh-darkin{position:relative; max-width:var(--maxw); margin:0 auto; padding:104px 24px;}
.rh-dark .rh-eyelabel{color:#5fd0d6;}
.rh-dark h2{color:#fff;}
.rh-dark .rh-deck{color:#9fa8a3;}
.rh-aigrid{margin-top:48px; display:grid; grid-template-columns:repeat(3,1fr); gap:0; border:1px solid var(--dark-line); border-radius:16px; overflow:hidden;}
.rh-ai{padding:32px; border-right:1px solid var(--dark-line);}
.rh-ai:last-child{border-right:none;}
.rh-ai .n{display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px; background:rgba(16,116,128,.16); color:#5fd0d6; font-size:.8rem; font-weight:650; font-variant-numeric:tabular-nums;}
.rh-ai h3{color:#fff; font-size:1.0625rem; margin-top:18px; letter-spacing:-.02em;}
.rh-ai p{margin-top:8px; font-size:.9375rem; line-height:1.6; color:#9fa8a3;}
@media(max-width:760px){ .rh-aigrid{grid-template-columns:1fr;} .rh-ai{border-right:none; border-bottom:1px solid var(--dark-line);} .rh-ai:last-child{border-bottom:none;} }

/* compliance */
.rh-complist{max-width:var(--maxw); margin:40px auto 0; padding:0 24px; display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid var(--line); border-radius:16px; overflow:hidden; background:var(--paper);}
.rh-comprow{display:flex; gap:16px; padding:26px 28px; border-right:1px solid var(--line); border-bottom:1px solid var(--line);}
.rh-comprow:nth-child(even){border-right:none;}
.rh-comprow:nth-last-child(-n+2){border-bottom:none;}
.rh-compicon{width:38px; height:38px; border-radius:10px; background:var(--accent-tint); color:var(--accent-deep); display:grid; place-items:center; flex-shrink:0;}
.rh-comprow h3{font-size:1rem; letter-spacing:-.01em;}
.rh-comprow p{margin-top:6px; font-size:.9rem; line-height:1.55; color:var(--body);}
@media(max-width:680px){ .rh-complist{grid-template-columns:1fr;} .rh-comprow{border-right:none;} .rh-comprow:nth-last-child(2){border-bottom:1px solid var(--line);} }

/* testimonials */
.rh-quotes{max-width:var(--maxw); margin:48px auto 0; padding:0 24px; display:grid; grid-template-columns:1.4fr 1fr; gap:14px;}
.rh-q{border:1px solid var(--line); border-radius:16px; padding:32px; background:var(--paper); display:flex; flex-direction:column;}
.rh-q.feat{background:var(--ink); border-color:var(--ink); grid-row:span 2;}
.rh-q .qt{font-size:1.0625rem; line-height:1.6; color:var(--ink); letter-spacing:-.01em; flex:1;}
.rh-q.feat .qt{color:#fff; font-size:1.375rem; line-height:1.5; letter-spacing:-.02em;}
.rh-q .who{margin-top:24px; padding-top:18px; border-top:1px solid var(--line); display:flex; align-items:center; gap:.8rem;}
.rh-q.feat .who{border-top-color:var(--dark-line);}
.rh-qmark{width:30px; height:30px; border-radius:8px; display:grid; place-items:center; flex-shrink:0; background:var(--accent-tint); color:var(--accent-deep);}
.rh-qmark svg{width:18px; height:18px;}
.rh-q.feat .rh-qmark{background:rgba(16,116,128,.22); color:#5fd0d6;}
.rh-q .nm{font-size:.9rem; font-weight:600; color:var(--ink);}
.rh-q.feat .nm{color:#fff;}
@media(max-width:820px){ .rh-quotes{grid-template-columns:1fr;} .rh-q.feat{grid-row:auto;} }

/* final cta */
.rh-final{max-width:var(--maxw); margin:0 auto; padding:0 24px;}
.rh-finalcard{background:var(--ink); border-radius:24px; padding:72px 40px; text-align:center; position:relative; overflow:hidden;}
.rh-finalcard::before{content:""; position:absolute; inset:0; background:radial-gradient(60% 100% at 50% 0%, rgba(16,116,128,.22), transparent 70%);}
.rh-finalcard h2{position:relative; color:#fff; font-size:clamp(1.8rem,3.4vw,2.6rem); letter-spacing:-.03em;}
.rh-finalcard p{position:relative; color:#9fa8a3; font-size:1.0625rem; line-height:1.6; max-width:46ch; margin:16px auto 0;}
.rh-finalcard .rh-herocta{position:relative; justify-content:center; margin-top:32px;}

/* footer */
.rh-foot{border-top:1px solid var(--line); background:var(--warm); padding:64px 0 40px;}
.rh-footgrid{max-width:var(--maxw); margin:0 auto; padding:0 24px; display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr 1fr; gap:32px;}
.rh-foot .blurb{margin-top:16px; font-size:.9rem; line-height:1.6; color:var(--muted); max-width:30ch;}
.rh-footcol h4{font-size:.78rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:14px;}
.rh-footcol a{display:block; padding:.3rem 0; font-size:.9rem; color:var(--ink-soft);}
.rh-footcol a:hover{color:var(--ink);}
.rh-footbar{max-width:var(--maxw); margin:48px auto 0; padding:24px 24px 0; border-top:1px solid var(--line); display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; font-size:.82rem; color:var(--muted);}
@media(max-width:760px){ .rh-footgrid{grid-template-columns:1fr 1fr;} }

/* audiences */
.rh-aud{max-width:var(--maxw); margin:44px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(3,1fr); gap:14px;}
.rh-audcard{border:1px solid var(--line); border-radius:16px; padding:28px; background:var(--paper); transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;}
.rh-audcard:hover{border-color:var(--line-2); box-shadow:0 18px 40px -28px rgba(10,30,20,.4); transform:translateY(-2px);}
.rh-audcard h3{font-size:1.0625rem; letter-spacing:-.02em;}
.rh-audcard p{margin-top:8px; font-size:.92rem; line-height:1.6; color:var(--body);}
.rh-audlist{margin:16px 0 0; padding:16px 0 0; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:11px;}
.rh-audlist li{list-style:none; display:flex; gap:.55rem; align-items:center; font-size:.9rem; color:var(--ink-soft);}
.rh-audlist .ck{width:18px; height:18px; border-radius:5px; background:var(--accent-tint); color:var(--accent-deep); display:grid; place-items:center; flex-shrink:0;}
.rh-audlist .ck svg{width:12px; height:12px;}
@media(max-width:880px){.rh-aud{grid-template-columns:1fr;}}

/* module deep-dive */
.rh-mods{max-width:var(--maxw); margin:44px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(4,1fr); gap:0; border:1px solid var(--line); border-radius:16px; overflow:hidden; background:var(--paper);}
.rh-mod{padding:26px 24px; border-right:1px solid var(--line);}
.rh-mod:last-child{border-right:none;}
.rh-mod h3{font-size:.74rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--accent-deep);}
.rh-mod ul{margin:14px 0 0; padding:0;}
.rh-mod li{list-style:none; font-size:.9rem; color:var(--ink-soft); padding:9px 0; border-top:1px solid var(--line);}
@media(max-width:880px){.rh-mods{grid-template-columns:1fr 1fr;} .rh-mod:nth-child(2){border-right:none;} .rh-mod:nth-child(1),.rh-mod:nth-child(2){border-bottom:1px solid var(--line);}}
@media(max-width:520px){.rh-mods{grid-template-columns:1fr;} .rh-mod{border-right:none; border-bottom:1px solid var(--line);} .rh-mod:last-child{border-bottom:none;}}

/* workflow */
.rh-flow{max-width:var(--maxw); margin:44px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(5,1fr); gap:16px;}
.rh-step{border-top:2px solid var(--accent); padding-top:16px;}
.rh-step .sn{font-size:.8rem; font-weight:650; color:var(--accent-deep); font-variant-numeric:tabular-nums;}
.rh-step h3{margin-top:8px; font-size:1rem; letter-spacing:-.01em;}
.rh-step p{margin-top:6px; font-size:.875rem; line-height:1.55; color:var(--body);}
@media(max-width:880px){.rh-flow{grid-template-columns:1fr 1fr;}}
@media(max-width:520px){.rh-flow{grid-template-columns:1fr;}}

/* integrations */
.rh-intg{max-width:var(--maxw); margin:28px auto 0; padding:0 24px; display:flex; flex-wrap:wrap; gap:10px;}
.rh-intg span{border:1px solid var(--line-2); border-radius:999px; padding:.55rem 1.05rem; font-size:.9rem; font-weight:500; color:var(--ink-soft); background:var(--paper);}

/* resources */
.rh-res{max-width:var(--maxw); margin:44px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(3,1fr); gap:14px;}
.rh-rescard{border:1px solid var(--line); border-radius:16px; overflow:hidden; background:var(--paper); display:flex; flex-direction:column; transition:box-shadow .2s ease, transform .2s ease;}
.rh-rescard:hover{box-shadow:0 18px 40px -28px rgba(10,30,20,.4); transform:translateY(-3px);}
.rh-restop{height:8px; background:linear-gradient(90deg,var(--accent),var(--accent-deep));}
.rh-resbody{padding:24px; display:flex; flex-direction:column; flex:1;}
.rh-restag{font-size:.7rem; font-weight:650; letter-spacing:.06em; text-transform:uppercase; color:var(--accent-deep);}
.rh-rescard h3{margin-top:10px; font-size:1.05rem; line-height:1.3; letter-spacing:-.01em; color:var(--ink);}
.rh-rescard p{margin-top:8px; font-size:.9rem; line-height:1.55; color:var(--body); flex:1;}
.rh-reslink{margin-top:16px; font-size:.875rem; font-weight:600; color:var(--accent-deep);}
@media(max-width:880px){.rh-res{grid-template-columns:1fr;}}

/* mission */
.rh-mission{background:var(--ink); color:#cfd6d2;}
.rh-missionin{max-width:var(--maxw); margin:0 auto; padding:80px 24px; display:grid; grid-template-columns:1.15fr 1fr; gap:56px; align-items:center;}
.rh-mission h2{color:#fff; font-size:clamp(1.6rem,3vw,2.2rem); letter-spacing:-.025em; line-height:1.15;}
.rh-mission .md{margin-top:14px; color:#9fa8a3; font-size:1.05rem; line-height:1.65;}
.rh-mstats{display:grid; grid-template-columns:1fr 1fr; gap:28px 24px;}
.rh-mstats .v{font-size:2rem; font-weight:600; color:#fff; letter-spacing:-.03em; font-variant-numeric:tabular-nums;}
.rh-mstats .l{font-size:.85rem; color:#9fa8a3; margin-top:4px; line-height:1.4;}
@media(max-width:760px){.rh-missionin{grid-template-columns:1fr; gap:36px;}}

/* feature spotlights */
.rh-spot{max-width:var(--maxw); margin:24px auto 0; padding:0 24px;}
.rh-spotrow{display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:center; padding:52px 0;}
.rh-spotrow + .rh-spotrow{border-top:1px solid var(--line);}
.rh-spotrow.rev .rh-spottext{order:2;}
.rh-spottext h3{font-size:clamp(1.4rem,2.4vw,1.95rem); letter-spacing:-.025em; margin-top:12px; color:var(--ink); line-height:1.15;}
.rh-spottext p{margin-top:12px; font-size:1.0625rem; line-height:1.6; color:var(--body);}
.rh-spotpts{margin:18px 0 0; padding:0; display:flex; flex-direction:column; gap:10px;}
.rh-spotpts li{list-style:none; display:flex; gap:.55rem; align-items:center; font-size:.95rem; color:var(--ink-soft);}
.rh-ck{width:18px; height:18px; border-radius:5px; background:var(--accent-tint); color:var(--accent-deep); display:grid; place-items:center; flex-shrink:0;}
.rh-ck svg{width:12px; height:12px;}
.rh-spotvis{border:1px solid var(--line); border-radius:18px; background:var(--surface); padding:18px; box-shadow:0 34px 70px -44px rgba(10,30,20,.4); min-height:280px;}
.rh-vischrome{display:flex; align-items:center; gap:.4rem; padding:0 4px 14px;}
.rh-vischrome i{width:9px; height:9px; border-radius:50%; display:inline-block;}
.rh-vischrome .t{margin-left:.5rem; font-size:.72rem; color:var(--muted); font-weight:500;}
@media(max-width:880px){.rh-spotrow{grid-template-columns:1fr; gap:26px; padding:36px 0;} .rh-spotrow.rev .rh-spottext{order:-1;}}
/* visual: week board */
.rh-wk{display:grid; grid-template-columns:repeat(5,1fr); gap:7px; background:var(--paper); border-radius:12px; padding:12px; border:1px solid var(--line);}
.rh-wkhd{font-size:.62rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; padding-bottom:8px; text-align:center;}
.rh-vt{border-radius:7px; padding:7px 8px; margin-bottom:6px;}
.rh-vt .nm{font-weight:600; color:var(--ink); font-size:.7rem; line-height:1.2;}
.rh-vt .tm{color:var(--muted); font-size:.62rem; margin-top:1px;}
.rh-vt.g{background:var(--accent-tint); border:1px solid #cdeadd;}
.rh-vt.b{background:#eef2ff; border:1px solid #dbe3fb;}
.rh-vt.n{background:var(--surface); border:1px solid var(--line);}
/* visual: EVV verify */
.rh-evvcard{background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:14px;}
.rh-map{height:120px; border-radius:10px; background:linear-gradient(135deg,#e9f6ef,#e8eefb); position:relative; overflow:hidden; border:1px solid var(--line);}
.rh-map::before{content:""; position:absolute; inset:0; background-image:linear-gradient(rgba(10,40,30,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(10,40,30,.05) 1px,transparent 1px); background-size:22px 22px;}
.rh-map .pin{position:absolute; left:46%; top:42%; width:14px; height:14px; border-radius:50%; background:var(--accent); border:3px solid #fff; box-shadow:0 0 0 6px rgba(16,116,128,.18);}
.rh-evvgrid{margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:7px;}
.rh-evvi{display:flex; gap:.4rem; align-items:center; font-size:.72rem; color:var(--ink-soft); border:1px solid var(--line); border-radius:8px; padding:.45rem .55rem;}
/* visual: audit log */
.rh-logcard{background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:6px 14px;}
.rh-logrow{display:grid; grid-template-columns:auto 1fr auto; gap:10px; padding:10px 2px; border-bottom:1px solid var(--line); align-items:center;}
.rh-logrow:last-child{border-bottom:none;}
.rh-logrow .dot{width:7px; height:7px; border-radius:50%; background:var(--accent);}
.rh-logrow .ac{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.72rem; color:var(--ink-soft);}
.rh-logrow .ts{font-size:.68rem; color:var(--muted); font-variant-numeric:tabular-nums;}

/* comparison */
.rh-cmp{max-width:920px; margin:40px auto 0; padding:0 24px;}
.rh-cmptbl{border:1px solid var(--line); border-radius:16px; overflow:hidden; background:var(--paper);}
.rh-cmphd, .rh-cmprow{display:grid; grid-template-columns:1.4fr 1fr 1fr;}
.rh-cmphd>div{padding:16px 20px; font-weight:600; font-size:.85rem; letter-spacing:.02em;}
.rh-cmphd .old{color:var(--muted);}
.rh-cmphd .new{color:var(--accent-deep); background:var(--accent-tint);}
.rh-cmprow{border-top:1px solid var(--line);}
.rh-cmprow>div{padding:15px 20px; font-size:.9rem; display:flex; align-items:center; gap:.5rem;}
.rh-cmprow .lbl{color:var(--ink); font-weight:500;}
.rh-cmprow .old{color:var(--muted);}
.rh-cmprow .new{color:var(--ink); background:rgba(16,116,128,.045);}
@media(max-width:620px){.rh-cmphd .lbl,.rh-cmprow .lbl{display:none;} .rh-cmphd,.rh-cmprow{grid-template-columns:1fr 1fr;}}

/* pricing */
.rh-pricing{max-width:var(--maxw); margin:48px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(3,1fr); gap:16px; align-items:start;}
.rh-price{border:1px solid var(--line); border-radius:18px; padding:30px; background:var(--paper); display:flex; flex-direction:column; position:relative;}
.rh-price.feat{border-color:var(--accent); box-shadow:0 36px 80px -44px rgba(16,116,128,.55);}
.rh-pbadge{position:absolute; top:-11px; left:30px; background:var(--accent); color:#fff; font-size:.68rem; font-weight:650; letter-spacing:.04em; padding:.28rem .7rem; border-radius:999px;}
.rh-price h3{font-size:1.15rem; letter-spacing:-.02em;}
.rh-price .pr{margin-top:10px; font-size:2rem; font-weight:600; color:var(--ink); letter-spacing:-.03em;}
.rh-price .pd{margin-top:8px; font-size:.9rem; color:var(--body); line-height:1.5;}
.rh-plist{margin:20px 0 22px; padding-top:20px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:11px; flex:1;}
.rh-plist li{list-style:none; display:flex; gap:.55rem; align-items:flex-start; font-size:.9rem; color:var(--ink-soft);}
@media(max-width:880px){.rh-pricing{grid-template-columns:1fr; max-width:460px;}}

/* faq accordion */
.rh-faqs{max-width:820px; margin:36px auto 0; padding:0 24px;}
.rh-faq{border-bottom:1px solid var(--line); padding:6px 2px;}
.rh-faqq{width:100%; text-align:left; background:none; border:none; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:20px 0; font:inherit; color:inherit;}
.rh-faqq h3{font-size:1.0625rem; letter-spacing:-.01em; font-weight:600; color:var(--ink);}
.rh-faqtog{flex-shrink:0; width:26px; height:26px; border-radius:7px; border:1px solid var(--line-2); display:grid; place-items:center; color:var(--ink-soft); transition:transform .25s ease, background .2s ease, color .2s ease, border-color .2s ease;}
.rh-faq.open .rh-faqtog{background:var(--accent); color:#fff; border-color:var(--accent); transform:rotate(45deg);}
.rh-faqa{overflow:hidden; max-height:0; transition:max-height .3s ease;}
.rh-faq.open .rh-faqa{max-height:260px;}
.rh-faqa p{padding:0 0 20px; font-size:.95rem; line-height:1.6; color:var(--body); max-width:72ch;}

/* reveal */
.rh-rv{opacity:0; transform:translateY(16px); transition:opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1);}
.rh-rv.in{opacity:1; transform:none;}
@media(prefers-reduced-motion:reduce){ html{scroll-behavior:auto;} .rh-rv{opacity:1; transform:none; transition:none;} .rh-btn,.rh-cell,.rh-audcard,.rh-rescard{transition:none;} .rh-eyebrow .pip{animation:none;} }

/* RayVerify — trust engine band */
.rvfy{position:relative; background:var(--dark); color:#cfd6d2; overflow:hidden;}
.rvfy-bloom{position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(620px 320px at 18% 0%, rgba(16,116,128,.28), transparent 70%),
    radial-gradient(520px 300px at 92% 100%, rgba(238,108,44,.16), transparent 72%);}
.rvfy-in{position:relative; max-width:var(--maxw); margin:0 auto; padding:104px 24px;}
.rvfy-head{max-width:62ch;}
.rvfy-eyebrow{display:inline-flex; align-items:center; gap:.5rem; font-size:.78rem; font-weight:600; letter-spacing:.02em; text-transform:uppercase; color:#5fd0d6;}
.rvfy-pip{width:7px; height:7px; border-radius:50%; background:#5fd0d6; box-shadow:0 0 0 4px rgba(95,208,214,.16);}
.rvfy-title{margin-top:18px; color:#fff; font-size:clamp(2rem,4vw,2.9rem); line-height:1.08;}
.rvfy-em{background:linear-gradient(90deg,#5fd0d6,#3fb0bb); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;}
.rvfy-deck{margin-top:18px; font-size:1.0625rem; line-height:1.65; color:#9fa8a3;}
.rvfy-body{margin-top:52px; display:grid; grid-template-columns:minmax(0,0.95fr) minmax(0,1.05fr); gap:56px; align-items:start;}

/* pipeline */
.rvfy-pipe{position:relative; padding-left:8px;}
.rvfy-pipe-rail{position:absolute; left:27px; top:24px; bottom:24px; width:2px; border-radius:2px; background:linear-gradient(180deg, rgba(95,208,214,.5), rgba(255,255,255,.08)); overflow:hidden;}
.rvfy-pulse{position:absolute; left:-3px; width:8px; height:8px; border-radius:50%; background:#5fd0d6; box-shadow:0 0 14px 3px rgba(95,208,214,.7); margin-top:-4px;}
.rvfy-stages{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:14px;}
.rvfy-stage{display:flex; align-items:center; gap:16px;}
.rvfy-node{flex:none; width:40px; height:40px; border-radius:11px; display:inline-flex; align-items:center; justify-content:center; color:#bfeef1; background:rgba(16,116,128,.18); border:1px solid rgba(95,208,214,.34); position:relative; z-index:1;}
.rvfy-node-ok{color:#0a0f0d; background:#5fd0d6; border-color:#5fd0d6; box-shadow:0 0 0 4px rgba(95,208,214,.16);}
.rvfy-stagetext{display:flex; flex-direction:column; gap:2px;}
.rvfy-stagelabel{display:flex; align-items:center; gap:10px; color:#fff; font-weight:600; font-size:.98rem;}
.rvfy-stagedetail{color:#8a948e; font-size:.85rem; line-height:1.4;}
.rvfy-flag{font-size:.66rem; font-weight:600; letter-spacing:.03em; text-transform:uppercase; padding:2px 7px; border-radius:999px;}
.rvfy-flag.live{color:#7ee0b0; background:rgba(16,185,129,.14); border:1px solid rgba(16,185,129,.4);}
.rvfy-flag.soon{color:#e7b894; background:rgba(238,108,44,.12); border:1px solid rgba(238,108,44,.36);}
.rvfy-verified .rvfy-stagelabel{font-size:1.02rem;}

/* value layers */
.rvfy-layers{display:flex; flex-direction:column; gap:4px;}
.rvfy-layer{padding:22px 0; border-bottom:1px solid var(--dark-line);}
.rvfy-layer:first-child{padding-top:0;}
.rvfy-layerk{font-size:.74rem; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:#5fd0d6;}
.rvfy-layert{margin-top:8px; color:#fff; font-size:1.18rem;}
.rvfy-layerb{margin-top:8px; color:#9fa8a3; font-size:.95rem; line-height:1.6;}
.rvfy-cta{margin-top:26px;}
.rvfy-btn{display:inline-flex; align-items:center; gap:.5rem; height:46px; padding:0 1.3rem; border-radius:11px; background:#fff; color:#0a0f0d; font-weight:600; font-size:.94rem; transition:transform .16s ease, box-shadow .16s ease;}
.rvfy-btn:hover{transform:translateY(-1px); box-shadow:0 14px 34px -16px rgba(95,208,214,.7);}
.rvfy-foot{margin-top:16px; font-size:.82rem; line-height:1.55; color:#7a847f; max-width:52ch;}
@media(max-width:880px){ .rvfy-body{grid-template-columns:1fr; gap:40px;} .rvfy-in{padding:80px 24px;} }
@media(prefers-reduced-motion:reduce){ .rvfy-pulse{display:none;} }
`;

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const els = root.current?.querySelectorAll('.rh-rv');
    if (!els || !('IntersectionObserver' in window)) { els?.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="rh" ref={root}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav className="rh-nav">
        <div className="rh-navin">
          <Link to="/" aria-label="RayHealthEVV home"><BrandLogo height={34} /></Link>
          <div className="rh-navmid">
            <Link to="/solutions/scheduling">Scheduling</Link>
            <Link to="/solutions/electronic-visit-verification">EVV</Link>
            <Link to="/rayverify">RayVerify</Link>
            <Link to="/platform/ai-automation">AI automation</Link>
            <Link to="/platform/compliance">Compliance</Link>
            <Link to="/pricing">Pricing</Link>
          </div>
          <div className="rh-navend">
            <Link to="/login" className="signin">Sign in</Link>
            <Link to="/demo" className="rh-btn rh-btn-pri">Book a demo</Link>
            <button
              type="button"
              className="rh-burger"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="rh-mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen
                ? ic(<path d="M18 6 6 18M6 6l12 12" />)
                : ic(<><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>)}
            </button>
          </div>
        </div>
        <div id="rh-mobile-menu" className={`rh-mobile${menuOpen ? ' open' : ''}`} hidden={!menuOpen}>
          <div className="rh-mobile-in">
            <Link to="/solutions/scheduling" onClick={() => setMenuOpen(false)}>Scheduling</Link>
            <Link to="/solutions/electronic-visit-verification" onClick={() => setMenuOpen(false)}>Electronic visit verification</Link>
            <Link to="/rayverify" onClick={() => setMenuOpen(false)}>RayVerify</Link>
            <Link to="/solutions/workforce-training" onClick={() => setMenuOpen(false)}>Workforce & training</Link>
            <Link to="/platform/ai-automation" onClick={() => setMenuOpen(false)}>AI automation</Link>
            <Link to="/platform/compliance" onClick={() => setMenuOpen(false)}>Compliance</Link>
            <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
            <Link to="/demo" className="rh-btn rh-btn-pri" onClick={() => setMenuOpen(false)}>Book a demo</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="rh-hero">
        <div className="rh-hero-bloom" aria-hidden />
        <div className="rh-hero-grid" aria-hidden />
        <div className="rh-heroin">
          <div className="rh-herotext">
            <span className="rh-eyebrow"><span className="pip" />Pennsylvania-built · HIPAA-aware · Cures Act EVV</span>
            <h1 className="rh-display">The operating system for <span className="em">home-care</span> agencies.</h1>
            <p className="rh-sublede">
              Scheduling, electronic visit verification, compliance, and payroll — unified in one
              operational core, with AI that clears the busywork and proof on every visit.
            </p>
            <div className="rh-herocta">
              <Link to="/demo" className="rh-btn rh-btn-pri">Book a demo</Link>
              <a href="#platform" className="rh-btn rh-btn-ghost">Explore the platform</a>
            </div>
            <ul className="rh-herotrust">
              <li>{ic(<path d="M20 6 9 17l-5-5" />)}No per-visit fees</li>
              <li>{ic(<path d="M20 6 9 17l-5-5" />)}Live in days, not months</li>
              <li>{ic(<path d="M20 6 9 17l-5-5" />)}PA DHS &amp; Cures Act aligned</li>
            </ul>
          </div>

          <div className="rh-heromedia">
            <div className="rh-photo" role="img" aria-label="A caregiver supporting a client at home">
              <div className="rh-photobadge">
                <span className="chk">{ic(<path d="M20 6 9 17l-5-5" />)}</span>
                <div>
                  <div className="t1">Visit verified</div>
                  <div className="t2">GPS · 9:02 AM · 6/6 EVV elements</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rh-standbar">
          <div className="rh-standrow">
            {standards.map((s) => (
              <div className="rh-standard" key={s.name}>
                <div className="nm">{s.name}</div>
                <div className="nt">{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Metrics */}
      <div className="rh-metricband">
        <div className="rh-metricgrid">
          {metrics.map((m) => (
            <div className="rh-metric" key={m.label}>
              <div className="v">{m.value}</div>
              <div className="l">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Audiences */}
      <section className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Who it&rsquo;s for</p>
          <h2 className="rh-h2 rh-rv">Built for everyone in the agency.</h2>
          <p className="rh-deck rh-rv">One platform that works the way owners, coordinators, and caregivers actually work.</p>
        </div>
        <div className="rh-aud">
          {audiences.map((a) => (
            <div className="rh-audcard rh-rv" key={a.role}>
              <h3>{a.role}</h3>
              <p>{a.body}</p>
              <ul className="rh-audlist">
                {a.points.map((p) => (
                  <li key={p}><span className="ck">{ic(<path d="M20 6 9 17l-5-5" />)}</span><span>{p}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Platform / bento */}
      <section id="platform" className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">The platform</p>
          <h2 className="rh-h2 rh-rv">Everything the agency runs on, in one place.</h2>
          <p className="rh-deck rh-rv">From the first authorization to a paid, audit-ready claim — without stitching together four vendors and a spreadsheet. Roadmap items are labeled honestly.</p>
        </div>
        <div className="rh-bento">
          {capabilities.map((c) => (
            <div className={`rh-cell ${c.span} rh-rv`} key={c.title}>
              {c.span === 'wide' ? (
                <>
                  <div className="rh-cellicon">{c.icon}</div>
                  <div className="rh-celltext">
                    <div className="rh-kicker">{c.kicker}<span className={`rh-flag ${c.live ? 'live' : 'soon'}`}>{c.live ? 'Live' : 'Roadmap'}</span></div>
                    <h3 className="rh-celltitle">{c.title}</h3>
                    <p className="rh-cellbody">{c.body}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rh-cellhead">
                    <div className="rh-cellicon">{c.icon}</div>
                    <span className={`rh-flag ${c.live ? 'live' : 'soon'}`}>{c.live ? 'Live' : 'Roadmap'}</span>
                  </div>
                  <div className="rh-kicker">{c.kicker}</div>
                  <h3 className="rh-celltitle">{c.title}</h3>
                  <p className="rh-cellbody">{c.body}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* RayVerify — trust engine band */}
      <RayVerifySection />

      {/* Feature spotlights with crafted visuals */}
      <section className="rh-sec tight">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Inside the product</p>
          <h2 className="rh-h2 rh-rv">Designed for the work, down to the pixel.</h2>
        </div>
        <div className="rh-spot">
          {spotlights.map((s, idx) => (
            <div className={`rh-spotrow${idx % 2 === 1 ? ' rev' : ''}`} key={s.key}>
              <div className="rh-spottext rh-rv">
                <p className="rh-eyelabel">{s.kicker}</p>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <ul className="rh-spotpts">
                  {s.points.map((p) => (
                    <li key={p}><span className="rh-ck">{ic(<path d="M20 6 9 17l-5-5" />)}</span><span>{p}</span></li>
                  ))}
                </ul>
              </div>
              <div className="rh-spotvis rh-rv" aria-hidden>
                <div className="rh-vischrome">
                  <i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} />
                  <span className="t">app.rayhealthevv.com</span>
                </div>
                {s.key === 'scheduling' && (
                  <div className="rh-wk">
                    {[
                      { d: 'Mon', v: [{ c: 'g', n: 'M. Cole', t: '9:00 · PA 106' }, { c: 'b', n: 'H. Vance', t: '11:30' }] },
                      { d: 'Tue', v: [{ c: 'n', n: 'D. Whitfield', t: '8:30' }, { c: 'g', n: 'R. Ortiz', t: '1:00' }] },
                      { d: 'Wed', v: [{ c: 'b', n: 'A. Brooks', t: '10:00' }] },
                      { d: 'Thu', v: [{ c: 'g', n: 'M. Cole', t: '9:00' }, { c: 'n', n: 'J. Pierce', t: '2:30' }] },
                      { d: 'Fri', v: [{ c: 'g', n: 'H. Vance', t: '11:30' }] },
                    ].map((col) => (
                      <div key={col.d}>
                        <div className="rh-wkhd">{col.d}</div>
                        {col.v.map((v, i) => (
                          <div className={`rh-vt ${v.c}`} key={i}><div className="nm">{v.n}</div><div className="tm">{v.t}</div></div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {s.key === 'evv' && (
                  <div className="rh-evvcard">
                    <div className="rh-map"><span className="pin" /></div>
                    <div className="rh-evvgrid">
                      {['Caregiver ID', 'Client ID', 'Service type', 'Date & time', 'Location', 'Visit status'].map((e) => (
                        <div className="rh-evvi" key={e}><span className="rh-ck">{ic(<path d="M20 6 9 17l-5-5" />)}</span>{e}</div>
                      ))}
                    </div>
                  </div>
                )}
                {s.key === 'audit' && (
                  <div className="rh-logcard">
                    {[
                      { a: 'visit.verified', t: '09:02:14' },
                      { a: 'auth.checked', t: '09:02:14' },
                      { a: 'schedule.published', t: '08:41:09' },
                      { a: 'credential.renewed', t: '08:12:55' },
                      { a: 'claim.flagged', t: '07:58:30' },
                      { a: 'session.login', t: '07:50:02' },
                    ].map((r, i) => (
                      <div className="rh-logrow" key={i}><span className="dot" /><span className="ac">{r.a}</span><span className="ts">{r.t}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Module deep-dive */}
      <section className="rh-sec tight" style={{ background: 'var(--warm)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">A closer look</p>
          <h2 className="rh-h2 rh-rv">Four toolsets, one operational core.</h2>
          <p className="rh-deck rh-rv">The capabilities an agency touches every day — grouped the way you actually work.</p>
        </div>
        <div className="rh-mods">
          {moduleGroups.map((m) => (
            <div className="rh-mod rh-rv" key={m.group}>
              <h3>{m.group}</h3>
              <ul>{m.items.map((it) => <li key={it}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">End to end</p>
          <h2 className="rh-h2 rh-rv">From authorization to paid, audit-ready claim.</h2>
        </div>
        <div className="rh-flow">
          {workflow.map((s) => (
            <div className="rh-step rh-rv" key={s.n}>
              <div className="sn">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI automation — dark band */}
      <section id="automation" className="rh-dark">
        <div className="rh-darkin">
          <div className="rh-sechead" style={{ padding: 0, maxWidth: '54ch' }}>
            <p className="rh-eyelabel rh-rv">AI automation</p>
            <h2 className="rh-h2 rh-rv">The work that used to take a coordinator all morning.</h2>
            <p className="rh-deck rh-rv">RayHealth proposes; your team approves. Automation handles the repetitive operational load so coordinators spend their time on people, not paperwork.</p>
          </div>
          <div className="rh-aigrid">
            {aiPoints.map((a, i) => (
              <div className="rh-ai rh-rv" key={a.title}>
                <span className="n">{i + 1}</span>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="rh-sec tight">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Connected</p>
          <h2 className="rh-h2 rh-rv">Fits the systems your agency already runs.</h2>
          <p className="rh-deck rh-rv">RayHealth maps to Pennsylvania&rsquo;s EVV ecosystem and exports cleanly to the tools you use downstream.</p>
        </div>
        <div className="rh-intg">
          {integrations.map((i) => <span className="rh-rv" key={i}>{i}</span>)}
        </div>
      </section>

      {/* Comparison */}
      <section className="rh-sec tight" style={{ background: 'var(--warm)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="rh-sechead center">
          <p className="rh-eyelabel rh-rv">Why agencies switch</p>
          <h2 className="rh-h2 rh-rv">The old way vs. RayHealth.</h2>
        </div>
        <div className="rh-cmp rh-rv">
          <div className="rh-cmptbl">
            <div className="rh-cmphd">
              <div className="lbl">&nbsp;</div>
              <div className="old">The old way</div>
              <div className="new">With RayHealth</div>
            </div>
            {comparison.rows.map((r) => (
              <div className="rh-cmprow" key={r.label}>
                <div className="lbl">{r.label}</div>
                <div className="old">{r.old}</div>
                <div className="new"><span className="rh-ck">{ic(<path d="M20 6 9 17l-5-5" />)}</span>{r.neu}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section id="compliance" className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Compliance &amp; trust</p>
          <h2 className="rh-h2 rh-rv">Built for the way Pennsylvania audits.</h2>
          <p className="rh-deck rh-rv">The frameworks your agency answers to are first-class, not afterthoughts.</p>
        </div>
        <div className="rh-complist">
          {[
            { icon: ic(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>), name: '21st Century Cures Act', body: 'All six federal EVV data elements captured and validated on every clock-out.' },
            { icon: ic(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h5" /></>), name: 'PA DHS · PROMISe', body: 'Personal-assistance and home-health tracks; task codes 106–256 are native.' },
            { icon: ic(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>), name: 'HIPAA', body: 'PHI scoped per agency, HttpOnly sessions, and a tamper-evident audit trail.' },
            { icon: ic(<><path d="M4 7h16M4 12h16M4 17h10" /></>), name: 'Sandata aggregator', body: 'Records map cleanly to the federal element schema for downstream submission.' },
          ].map((c) => (
            <div className="rh-comprow rh-rv" key={c.name}>
              <div className="rh-compicon">{c.icon}</div>
              <div><h3>{c.name}</h3><p>{c.body}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="rh-sec tight" style={{ background: 'var(--warm)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Outcomes by role</p>
          <h2 className="rh-h2 rh-rv">Built for the people who run the agency.</h2>
        </div>
        <div className="rh-quotes">
          {outcomes.map((t) => (
            <figure className={`rh-q ${t.featured ? 'feat' : ''} rh-rv`} key={t.persona}>
              <blockquote className="qt">{t.quote}</blockquote>
              <figcaption className="who">
                <span className="rh-qmark" aria-hidden>{ic(<path d="M20 6 9 17l-5-5" />)}</span>
                <div className="nm">{t.persona}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Resources</p>
          <h2 className="rh-h2 rh-rv">Guides for running a compliant agency.</h2>
          <p className="rh-deck rh-rv">Practical, Pennsylvania-specific reading on EVV, task codes, and audits.</p>
        </div>
        <div className="rh-res">
          {resources.map((r) => (
            <Link to={r.to} className="rh-rescard rh-rv" key={r.t}>
              <div className="rh-restop" />
              <div className="rh-resbody">
                <span className="rh-restag">{r.tag}</span>
                <h3>{r.t}</h3>
                <p>{r.b}</p>
                <span className="rh-reslink">Read more →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="rh-mission">
        <div className="rh-missionin">
          <div className="rh-rv">
            <p className="rh-eyelabel" style={{ color: '#5fd0d6' }}>Our mission</p>
            <h2>Make verified, compliant care the easiest way to run an agency.</h2>
            <p className="md">RayHealth is built in Pennsylvania for Pennsylvania providers — so every visit is proven, every claim is defensible, and coordinators get their time back for the people who need it.</p>
          </div>
          <div className="rh-mstats rh-rv">
            {missionStats.map((s) => (
              <div key={s.l}><div className="v">{s.v}</div><div className="l">{s.l}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="rh-sec">
        <div className="rh-sechead center">
          <p className="rh-eyelabel rh-rv">Pricing</p>
          <h2 className="rh-h2 rh-rv">Plans that scale with your agency.</h2>
          <p className="rh-deck rh-rv">Transparent, per-agency pricing. No per-visit surcharges, no surprises.</p>
        </div>
        <div className="rh-pricing">
          {pricingTiers.map((t) => (
            <div className={`rh-price${t.featured ? ' feat' : ''} rh-rv`} key={t.name}>
              {t.featured && <span className="rh-pbadge">Most popular</span>}
              <h3>{t.name}</h3>
              <div className="pr">{t.price}</div>
              <p className="pd">{t.desc}</p>
              <ul className="rh-plist">
                {t.feat.map((f) => (
                  <li key={f}><span className="rh-ck">{ic(<path d="M20 6 9 17l-5-5" />)}</span><span>{f}</span></li>
                ))}
              </ul>
              <Link to="/demo" className={`rh-btn ${t.featured ? 'rh-btn-pri' : 'rh-btn-ghost'}`} style={{ justifyContent: 'center' }}>{t.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="rh-sec">
        <div className="rh-sechead center">
          <p className="rh-eyelabel rh-rv">FAQ</p>
          <h2 className="rh-h2 rh-rv">Questions, answered.</h2>
        </div>
        <div className="rh-faqs">
          {faqs.map((f, i) => (
            <div className={`rh-faq rh-rv${openFaq === i ? ' open' : ''}`} key={f.q}>
              <button type="button" className="rh-faqq" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <h3>{f.q}</h3>
                <span className="rh-faqtog" aria-hidden>{ic(<path d="M12 5v14M5 12h14" />)}</span>
              </button>
              <div className="rh-faqa"><p>{f.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="rh-sec">
        <div className="rh-final">
          <div className="rh-finalcard rh-rv">
            <h2>See RayHealth on your hardest workflow.</h2>
            <p>A focused walkthrough of the admin platform and the caregiver app. Bring a real case — we’ll run it live.</p>
            <div className="rh-herocta">
              <Link to="/demo" className="rh-btn rh-btn-dark">Book a demo</Link>
              <Link to="/contact" className="rh-btn rh-btn-ghost" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>Talk to sales</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="rh-foot">
        <div className="rh-footgrid">
          <div>
            <BrandLogo height={40} />
            <p className="blurb">The operating system for Pennsylvania home-care agencies. Verified visits, defensible claims, one operational core.</p>
          </div>
          <div className="rh-footcol">
            <h4>Platform</h4>
            <a href="#platform">Overview</a>
            <Link to="/rayverify">RayVerify</Link>
            <Link to="/platform/ai-automation">AI automation</Link>
            <Link to="/platform/compliance">Compliance</Link>
            <Link to="/pricing">Pricing</Link>
          </div>
          <div className="rh-footcol">
            <h4>Solutions</h4>
            <Link to="/solutions/scheduling">Scheduling</Link>
            <Link to="/solutions/electronic-visit-verification">Electronic visit verification</Link>
            <Link to="/solutions/billing-payroll">Billing &amp; payroll</Link>
            <Link to="/solutions/workforce-training">Workforce &amp; training</Link>
          </div>
          <div className="rh-footcol">
            <h4>Resources</h4>
            <Link to="/resources/evv-guide">EVV guide</Link>
            <Link to="/resources/task-codes">Task code reference</Link>
            <Link to="/resources/audit-checklist">Audit checklist</Link>
            <Link to="/launch">What’s new</Link>
          </div>
          <div className="rh-footcol">
            <h4>Company</h4>
            <Link to="/contact">Contact</Link>
            <Link to="/demo">Request a demo</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/compliance/hipaa">HIPAA</Link>
            <Link to="/privacy">Privacy</Link>
          </div>
        </div>
        <div className="rh-footbar">
          <span>© {new Date().getFullYear()} RayHealthEVV™ · Built in Pennsylvania</span>
          <span>HIPAA-aware infrastructure · 21st Century Cures Act aligned</span>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
}
