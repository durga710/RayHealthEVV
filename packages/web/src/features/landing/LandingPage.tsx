import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SupportChat } from '../support/SupportChat.js';
import { BrandLogo } from '../../components/brand/BrandLogo.js';
import { MetricCard, StatusPill, DataTable, Timeline, TrustBadge, WorkflowStepper, Icon, type IconName, type WorkflowStep } from '../../components/index.js';
import { RayVerifySection } from './RayVerifySection.js';

/* ─────────────────────────────────────────────────────────────
   RayHealth landing, premium, honest, buyer-conversion page.
   Self-contained: the scoped <style> block below is the landing's
   own layout/typography layer, but every color it defines is an
   alias of a shared token from ../../index.css (:root), no brand
   hex lives here. Structural surfaces (MetricCard, StatusPill,
   DataTable, Timeline, TrustBadge, WorkflowStepper) are imported
   straight from the design system so the "product mockups" below
   are literally built from the same primitives the admin app uses.
   ───────────────────────────────────────────────────────────── */

const ic = (d: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

const check = ic(<path d="M20 6 9 17l-5-5" />);

// ── Hero trust row, facts and alignments only, no endorsements, no counts ──
const heroTrust = [
  'PA-first, built for Pennsylvania homecare',
  'Six federal EVV elements, every visit',
  'Tamper-evident audit trail',
  'Caregiver mobile app for GPS clock-in',
];

// ── Trust/fact strip, replaces the old fabricated "40% fewer denials" /
// "100% aligned" metric band. Every value here is a verifiable capability,
// never an invented outcome number. ──
const trustFacts = [
  { value: '6/6', label: 'Federal EVV elements captured on every visit' },
  { value: 'Server-verified', label: 'GPS clock-in decision made on our servers, never the phone' },
  { value: 'Append-only', label: 'Audit trail by database design, corrections are new events' },
  { value: 'PA DHS-aligned', label: 'Aligned with PA DHS EVV requirements and the Cures Act' },
];

// ── Pain → outcome (the "before/after" of running an agency on RayHealth) ──
const painToOutcome = [
  { label: 'Scheduling & records', before: 'Spreadsheets, sticky notes, tribal knowledge', after: 'One command center, one login' },
  { label: 'Clock-outs', before: 'Missed clock-outs nobody notices until payroll', after: 'Every fallback becomes a same-day exception' },
  { label: 'Claim denials', before: 'Cleanup after the claim already bounced', after: 'Denial-risk flags before you bill' },
  { label: 'Audit letters', before: 'A week of panic and a filing cabinet', after: 'An exportable evidence packet, ready in an afternoon' },
  { label: 'Systems', before: 'Five disconnected tools and a coordinator’s memory', after: 'Scheduling, EVV, compliance, and billing in one place' },
];

// ── Role-based sections, condensed from the persona messaging in
// docs/agent-reports/02-product-strategy.md §2. These are role-based
// outcome statements, not fabricated customer quotes. ──
const roles = [
  {
    role: 'Agency owners & administrators',
    body: 'One screen that says “you’re fine” or “here’s the one thing that isn’t”, in ten seconds. Proof on demand when the audit letter arrives.',
    quote: 'You’ll know in ten seconds if anything’s wrong, and when the audit letter comes, you’re ready that afternoon.',
    points: ['A live command center, no scrolling required', 'A Go-Live Readiness checklist for onboarding', 'One audit trail across the whole agency'],
  },
  {
    role: 'Schedulers & coordinators',
    body: 'Build the week and let the platform catch the conflicts, expired credentials, drained authorizations, double-bookings, before you publish.',
    quote: 'Publish with confidence, conflicts, credentials, and authorizations are checked before the schedule goes out, not after.',
    points: ['Conflict-aware weekly scheduling', 'Draft and publish modes', 'A live Today Board, no phone calls needed'],
  },
  {
    role: 'Compliance officers',
    body: 'Every exception, resolution, and correction is a permanent record, actor, timestamp, reason, the moment it happens.',
    quote: 'Every action is logged, the log can’t be edited, even by us, and corrections are new events, never overwrites.',
    points: ['Exception queues that drain to zero', 'An append-only audit event browser', 'Aggregator submission status in one place'],
  },
  {
    role: 'Caregivers in the field',
    body: 'A phone app built around one job: clock in confidently, see exactly where to be, and never get stuck.',
    quote: 'Clock in with confidence, the app shows you exactly where you stand, and you’re never locked out of clocking out.',
    points: ['A live map with your geofence distance', 'Clock-out that always works as a fallback', 'Training built into the same app'],
  },
];

// ── Implementation timeline (Day 1 → Week 2) ──
const timelineSteps: WorkflowStep[] = [
  { id: 'day1', label: 'Day 1. Agency setup', description: 'Configure your agency profile, users, and PA task codes.', status: 'active' },
  { id: 'day2', label: 'Day 2. Import caregivers & clients', description: 'Bulk import from your existing system, no manual re-entry.', status: 'upcoming' },
  { id: 'day3', label: 'Day 3. Authorizations & task codes', description: 'Load authorizations and confirm PA task-code mapping.', status: 'upcoming' },
  { id: 'day4', label: 'Day 4. Caregiver training', description: 'Caregivers complete onboarding and EVV training in the mobile app.', status: 'upcoming' },
  { id: 'day5', label: 'Day 5. Pilot visits', description: 'Run real visits with GPS clock-in before full rollout.', status: 'upcoming' },
  { id: 'week2', label: 'Week 2. Live rollout', description: 'The full schedule runs on RayHealthEVV.', status: 'upcoming' },
];

// ── Trust Center teaser items, approved HIPAA phrasing only. ──
const trustTeaserItems: { icon: IconName; label: string; detail: string; tone: 'primary' | 'accent' }[] = [
  { icon: 'lock', label: 'HIPAA-ready architecture', detail: 'Encryption in transit, per-agency data isolation, immutable audit logging.', tone: 'primary' },
  { icon: 'calendar', label: 'Operational HIPAA readiness in progress', detail: 'Vendor BAAs and readiness milestones are published on a dated status table, see exactly where we stand.', tone: 'accent' },
  { icon: 'shield-check', label: 'Role-based access control', detail: 'Capability-scoped roles gate every admin action, never a client-supplied permission.', tone: 'primary' },
  { icon: 'file-text', label: 'Tamper-evident audit logging', detail: 'Every state change is appended to a log that cannot be edited, not even by us.', tone: 'accent' },
  { icon: 'smartphone', label: 'Mobile secure auth', detail: 'Mobile sessions are individually revocable, a lost phone is a two-click problem.', tone: 'primary' },
  { icon: 'cpu', label: 'AI/PHI boundaries', detail: 'The copilot proposes, a human approves; inference runs only through BAA-covered vendors.', tone: 'accent' },
];

const pricingTiers = [
  { name: 'Starter', price: 'Custom', desc: 'For new and small agencies getting compliant fast.', feat: ['Scheduling & EVV', 'PA DHS task codes', 'Caregiver mobile app', 'Tamper-evident audit trail'], featured: false, cta: 'Get a quote' },
  { name: 'Growth', price: 'Custom', desc: 'For scaling agencies that live in the platform.', feat: ['Everything in Starter', 'Billing reconciliation', 'Exception queues & alerts', 'Priority onboarding'], featured: true, cta: 'Book a demo' },
  { name: 'Enterprise', price: "Let's talk", desc: 'For multi-site providers with advanced needs.', feat: ['Everything in Growth', 'AI automation suite', 'Custom integrations', 'Dedicated success manager'], featured: false, cta: 'Talk to sales' },
];

const faqs = [
  { q: 'Are you HIPAA compliant?', a: 'We build to HIPAA-ready architecture, per-agency data isolation, encryption in transit, and an append-only audit log enforced today. Our operational HIPAA readiness, including vendor business associate agreements, is in progress and published openly on our compliance page, we execute a BAA with every agency before any PHI is processed.' },
  { q: 'Does RayHealthEVV submit to the Pennsylvania EVV aggregator?', a: 'Visits are captured against the federal six-element schema and mapped for downstream submission through Sandata Alt-EVV and HHAeXchange, the aggregators PA DHS uses.' },
  { q: 'What happens if a caregiver has no signal in the home?', a: 'Caregiver clock-in relies on the mobile app’s GPS and connection today. We’re validating full offline capture and a telephony fallback before advertising them as guaranteed in every dead zone, if your caregivers regularly work without signal, that’s one of the first things we test with you during the pilot week.' },
  { q: 'How do we get our data out?', a: 'Exports are a feature, not a hostage negotiation, payroll-ready and claim exports are built in, and your records leave with you if you ever do.' },
  { q: 'How long does implementation take?', a: 'Most agencies import authorizations and onboard their first caregivers within a week, with full rollout by week two. See the timeline above, we handle the data migration with you.' },
  { q: 'Is RayHealthEVV only for Pennsylvania?', a: 'Today we are purpose-built for Pennsylvania personal-assistance and home-health programs. The compliance core is designed to extend to additional states.' },
];

type TheaterTab = 'command' | 'clockin' | 'exceptions' | 'audit';

const THEATER_TABS: { id: TheaterTab; label: string }[] = [
  { id: 'command', label: 'Command Center' },
  { id: 'clockin', label: 'Caregiver Clock-In' },
  { id: 'exceptions', label: 'Exception Queue' },
  { id: 'audit', label: 'Audit Packet' },
];

interface ExceptionRow {
  id: string;
  caregiver: string;
  client: string;
  issue: string;
  status: 'Open' | 'Resolved';
}

const exceptionRows: ExceptionRow[] = [
  { id: 'e1', caregiver: 'M. Rivera', client: 'Client 4021', issue: 'Missed clock-out', status: 'Open' },
  { id: 'e2', caregiver: 'D. Whitfield', client: 'Client 3312', issue: 'Out-of-fence clock-out', status: 'Open' },
  { id: 'e3', caregiver: 'H. Vance', client: 'Client 2207', issue: 'Missing service code', status: 'Resolved' },
];

function chromeDots() {
  return (
    <span className="rh-vischrome" aria-hidden>
      <i data-role="danger" /><i data-role="warning" /><i data-role="success" />
    </span>
  );
}

function CSS() {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.rh{
  /* Every custom property below aliases a shared token from index.css , 
     no brand hex is defined in this file. */
  --ink: var(--color-text);
  --ink-soft: var(--color-text-secondary);
  --body-c: var(--color-text-secondary);
  --muted: var(--color-text-muted);
  --paper: var(--color-surface);
  --warm: var(--color-bg);
  --surface2: var(--color-bg);
  --line: var(--color-border);
  --line-2: var(--color-border-strong);
  --accent: var(--color-primary);
  --accent-deep: var(--color-primary-dark);
  --accent-light: var(--color-primary-light);
  --accent-tint: var(--color-primary-bg);
  --accent2: var(--color-accent);
  --accent2-deep: var(--color-accent-dark);
  --accent2-tint: var(--color-accent-bg);
  --dark: var(--color-sidebar);
  --dark-line: rgba(255,255,255,.10);
  --dark-text-muted: var(--color-sidebar-text);
  --maxw:1120px;
  font-family: var(--font-sans);
  color:var(--body-c); background:var(--paper); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
.rh *{box-sizing:border-box;}
.rh h1,.rh h2,.rh h3,.rh h4{color:var(--ink); font-weight:600; letter-spacing:-0.02em;}
/* Margin resets use :where() so they add no specificity: any single-class
   rule (.rh-h2, .rh-rolefoot, ...) can set its own margins and win. */
.rh :where(h1,h2,h3,h4){margin:0;}
.rh :where(p){margin:0;}
.rh :where(a){text-decoration:none; color:inherit;}
html{scroll-behavior:smooth;}
.rh [id]{scroll-margin-top:88px;}
.rh-wrap{max-width:var(--maxw); margin:0 auto; padding:0 24px;}

/* buttons */
.rh-btn{display:inline-flex; align-items:center; gap:.5rem; height:44px; padding:0 1.25rem; border-radius:10px; font-size:.9375rem; font-weight:550; transition:transform .16s ease, background .16s ease, box-shadow .16s ease, border-color .16s ease;}
.rh-btn-pri{background:var(--accent); color:white; box-shadow:0 1px 0 rgba(10,30,20,.04), 0 8px 24px -12px color-mix(in srgb, var(--accent) 60%, transparent);}
.rh-btn-pri:hover{background:var(--accent-deep); transform:translateY(-1px);}
.rh-btn-ghost{color:var(--ink); border:1px solid var(--line-2); background:var(--paper);}
.rh-btn-ghost:hover{border-color:var(--ink); }
.rh-btn-dark{background:white; color:var(--ink);}
.rh-btn-dark:hover{transform:translateY(-1px); box-shadow:0 10px 30px -14px rgba(0,0,0,.5);}
.rh-btn-line{color:var(--ink); font-weight:550; font-size:.9375rem; display:inline-flex; align-items:center; gap:.4rem;}
.rh-btn-line .arr{transition:transform .18s ease;}
.rh-btn-line:hover .arr{transform:translateX(3px);}
.rh-btn:focus-visible,.rh-btn-line:focus-visible{outline:none; box-shadow:var(--shadow-focus);}

/* nav */
.rh-nav{position:sticky; top:0; z-index:60; background:rgba(255,255,255,.72); backdrop-filter:blur(16px) saturate(160%); border-bottom:1px solid var(--line);}
.rh-navin{max-width:var(--maxw); margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between;}
.rh-navmid{display:flex; gap:4px;}
.rh-navmid a{padding:.5rem .8rem; border-radius:8px; font-size:.9rem; font-weight:500; color:var(--ink-soft); transition:color .15s, background .15s;}
.rh-navmid a:hover{color:var(--ink); background:var(--surface2);}
.rh-navmid a:focus-visible,.rh-navend a:focus-visible{outline:none; box-shadow:var(--shadow-focus);}
.rh-navend{display:flex; align-items:center; gap:.6rem;}
.rh-navend .signin{font-size:.9rem; font-weight:550; color:var(--ink); padding:.5rem .4rem;}
.rh-burger{display:none; width:42px; height:42px; align-items:center; justify-content:center; border:1px solid var(--line-2); border-radius:10px; background:var(--paper); color:var(--ink); cursor:pointer; padding:0; transition:border-color .15s ease, background .15s ease;}
.rh-burger:hover{border-color:var(--ink); background:var(--surface2);}
.rh-burger:focus-visible{outline:none; box-shadow:var(--shadow-focus);}
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
  background:radial-gradient(48% 52% at 80% 14%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 72%), radial-gradient(38% 38% at 6% 0%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 70%);}
.rh-hero-grid{position:absolute; inset:0; pointer-events:none;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:64px 64px; opacity:.45;
  -webkit-mask-image:radial-gradient(ellipse 80% 70% at 28% 8%, #000 8%, transparent 64%);
  mask-image:radial-gradient(ellipse 80% 70% at 28% 8%, #000 8%, transparent 64%);}
.rh-heroin{position:relative; max-width:var(--maxw); margin:0 auto; padding:72px 24px 64px; display:grid; grid-template-columns:1.02fr .98fr; gap:56px; align-items:center;}
.rh-herotext{max-width:34rem;}
.rh-eyebrow{display:inline-flex; align-items:center; gap:.5rem; padding:.4rem .8rem .4rem .55rem; border-radius:999px; background:var(--paper); border:1px solid var(--line-2); font-size:.78rem; font-weight:550; color:var(--ink-soft); box-shadow:0 1px 2px rgba(10,20,15,.03);}
.rh-eyebrow .pip{width:7px; height:7px; border-radius:50%; background:var(--accent2); box-shadow:0 0 0 0 color-mix(in srgb, var(--accent2) 45%, transparent); animation:rh-pip 2.4s ease-out infinite;}
@keyframes rh-pip{0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--accent2) 45%, transparent);}70%{box-shadow:0 0 0 7px color-mix(in srgb, var(--accent2) 0%, transparent);}100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--accent2) 0%, transparent);}}
.rh-display{margin:22px 0 0; font-size:clamp(2.4rem,4.4vw,3.4rem); line-height:1.05; letter-spacing:-0.035em; font-weight:600; color:var(--ink); text-wrap:balance;}
.rh-display .em{color:var(--accent-deep);}
.rh-sublede{margin:20px 0 0; max-width:46ch; font-size:1.125rem; line-height:1.6; color:var(--body-c);}
.rh-herocta{margin-top:28px; display:flex; gap:.75rem; flex-wrap:wrap;}
.rh-herotrust{list-style:none; margin:26px 0 0; padding:0; display:flex; flex-direction:column; gap:13px;}
.rh-herotrust li{display:flex; align-items:center; gap:.55rem; font-size:.9rem; font-weight:500; color:var(--ink-soft);}
.rh-herotrust svg{width:17px; height:17px; color:var(--accent); flex-shrink:0;}
.rh-heromedia{position:relative;}
@media(max-width:880px){ .rh-heroin{grid-template-columns:1fr; gap:36px; padding-top:52px;} .rh-herotext{max-width:none;} }

/* section scaffolding */
.rh-sec{padding:104px 0;}
.rh-sec.tight{padding:80px 0;}
.rh-sec.warm{background:var(--warm); border-top:1px solid var(--line); border-bottom:1px solid var(--line);}
.rh-eyelabel{font-size:.78rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--accent-deep);}
.rh-h2{font-size:clamp(1.9rem,3.4vw,2.6rem); line-height:1.1; letter-spacing:-.03em; margin-top:14px;}
.rh-deck{margin-top:16px; font-size:1.0625rem; line-height:1.6; color:var(--body-c); max-width:54ch;}
.rh-sechead{max-width:var(--maxw); margin:0 auto; padding:0 24px;}
.rh-sechead.center{text-align:center;} .rh-sechead.center .rh-deck{margin-left:auto; margin-right:auto;}

/* fact strip */
.rh-factband{border-top:1px solid var(--line); border-bottom:1px solid var(--line); background:var(--paper);}
.rh-factgrid{max-width:var(--maxw); margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr);}
.rh-fact{padding:34px 28px; border-right:1px solid var(--line);}
.rh-fact:last-child{border-right:none;}
.rh-fact .v{font-size:1.5rem; font-weight:600; letter-spacing:-.015em; color:var(--ink); line-height:1.2;}
.rh-fact .l{margin-top:10px; font-size:.875rem; line-height:1.5; color:var(--muted);}
@media(max-width:760px){ .rh-factgrid{grid-template-columns:1fr 1fr;} .rh-fact{padding:26px 22px;} .rh-fact:nth-child(2){border-right:none;} .rh-fact:nth-child(1),.rh-fact:nth-child(2){border-bottom:1px solid var(--line);} }

/* mockups (shared "browser chrome" card used by hero + product theater) */
.rh-spotvis{border:1px solid var(--line); border-radius:18px; background:var(--surface2); padding:18px; box-shadow:0 34px 70px -44px rgba(10,30,20,.4); min-height:220px;}
.rh-spotvis--flush{min-height:0;}
.rh-vischrome{display:flex; align-items:center; gap:.4rem; padding:0 4px 14px;}
.rh-vischrome i{width:9px; height:9px; border-radius:50%; display:inline-block;}
.rh-vischrome i[data-role='danger']{background:var(--color-danger);}
.rh-vischrome i[data-role='warning']{background:var(--color-warning);}
.rh-vischrome i[data-role='success']{background:var(--color-success);}
.rh-vischrome .t{margin-left:.5rem; font-size:.72rem; color:var(--muted); font-weight:500;}
.rh-mockcaption{margin-top:.75rem; font-size:.78rem; color:var(--muted); text-align:center;}
.rh-heromock-body{display:flex; flex-direction:column; gap:.85rem;}

/* Manual attention rows for decorative mockups (same tokens/classes as the
   AttentionCard primitive, rendered as <div> here because a marketing
   mockup shouldn't force a real navigation Link). */
.rh-mock-attn-list{display:flex; flex-direction:column; gap:var(--space-2, .5rem);}

/* product theater */
.rh-theater-tabs{max-width:var(--maxw); margin:36px auto 0; padding:0 24px; display:flex; flex-wrap:wrap; gap:.5rem;}
.rh-theater-tab{border:1px solid var(--line-2); background:var(--paper); color:var(--ink-soft); border-radius:999px; padding:.55rem 1.1rem; font-size:.875rem; font-weight:600; cursor:pointer; transition:background .15s ease, color .15s ease, border-color .15s ease;}
.rh-theater-tab:hover{border-color:var(--ink);}
.rh-theater-tab[aria-selected='true']{background:var(--ink); color:white; border-color:var(--ink);}
.rh-theater-tab:focus-visible{outline:none; box-shadow:var(--shadow-focus);}
.rh-theater-panels{max-width:var(--maxw); margin:20px auto 0; padding:0 24px;}
.rh-theater-panel{min-height:340px;}
/* each panel swaps a different component in, so it mounts fresh, crossfade it
   up so switching tabs feels responsive instead of a hard cut */
.rh-theater-inner{padding:.35rem; animation:rh-panelin .42s cubic-bezier(.2,.7,.2,1);}
@keyframes rh-panelin{from{opacity:0; transform:translateY(8px);}to{opacity:1; transform:none;}}
/* gentle "live" breathe on the status dots inside the product mockups so the
   command center reads as actively monitoring, not a screenshot */
.rh-spotvis .status-dot,.rh-theater-inner .status-dot{animation:rh-livedot 2.6s ease-in-out infinite;}
@keyframes rh-livedot{0%,100%{opacity:1;}50%{opacity:.5;}}
.rh-theater-clockin{display:grid; grid-template-columns:220px 1fr; gap:1.5rem; align-items:center;}
.rh-theater-map{height:200px; border-radius:12px; background:linear-gradient(135deg, var(--accent-tint), var(--accent2-tint)); position:relative; overflow:hidden; border:1px solid var(--line);}
.rh-theater-map::before{content:""; position:absolute; inset:0; background-image:linear-gradient(rgba(10,40,30,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(10,40,30,.05) 1px,transparent 1px); background-size:22px 22px;}
.rh-theater-map .zone{position:absolute; left:50%; top:50%; width:96px; height:96px; border-radius:50%; transform:translate(-50%,-50%); border:2px dashed var(--accent); background:color-mix(in srgb, var(--accent) 10%, transparent);}
.rh-theater-map .pin{position:absolute; left:50%; top:50%; width:14px; height:14px; border-radius:50%; background:var(--accent); border:3px solid white; transform:translate(-50%,-50%); box-shadow:0 0 0 6px color-mix(in srgb, var(--accent) 18%, transparent); z-index:2;}
/* live GPS radar ping, a ring that continuously sweeps out from the pin, so
   the geofence reads as an active location check rather than a static mockup */
.rh-theater-map .pin::after{content:""; position:absolute; left:50%; top:50%; width:14px; height:14px; border-radius:50%; border:2px solid var(--accent); transform:translate(-50%,-50%); animation:rh-radar 2.8s cubic-bezier(.2,.6,.3,1) infinite;}
@keyframes rh-radar{0%{width:14px; height:14px; opacity:.65;}70%{opacity:0;}100%{width:150px; height:150px; opacity:0;}}
.rh-theater-clockin-copy p{color:var(--body-c); font-size:.9375rem; line-height:1.6;}
.rh-theater-clockin-copy h4{margin-top:.6rem; font-size:1.0625rem;}
.rh-theater-clockin-actions{margin-top:1rem; display:flex; gap:.6rem; flex-wrap:wrap;}
@media(max-width:760px){.rh-theater-clockin{grid-template-columns:1fr;}}

/* pain to outcome */
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
.rh-cmprow .new{color:var(--ink); background:color-mix(in srgb, var(--accent) 4.5%, transparent);}
@media(max-width:620px){.rh-cmphd .lbl,.rh-cmprow .lbl{display:none;} .rh-cmphd,.rh-cmprow{grid-template-columns:1fr 1fr;}}
.rh-ck{width:18px; height:18px; border-radius:5px; background:var(--accent-tint); color:var(--accent-deep); display:grid; place-items:center; flex-shrink:0;}
.rh-ck svg{width:12px; height:12px;}

/* role cards */
.rh-roles{max-width:var(--maxw); margin:44px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(auto-fit, minmax(250px,1fr)); gap:14px;}
.rh-rolecard{border:1px solid var(--line); border-radius:16px; padding:26px; background:var(--paper); display:flex; flex-direction:column; gap:.9rem; transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;}
.rh-rolecard:hover{border-color:var(--line-2); box-shadow:0 18px 40px -28px rgba(10,30,20,.4); transform:translateY(-2px);}
.rh-rolecard h3{font-size:1.0625rem; letter-spacing:-.02em;}
.rh-rolecard p{font-size:.92rem; line-height:1.6; color:var(--body-c);}
.rh-rolequote{font-size:.9375rem; font-weight:600; color:var(--ink); line-height:1.5; border-left:2px solid var(--accent); padding-left:.75rem;}
.rh-rolelist{margin:0; padding:0; display:flex; flex-direction:column; gap:.55rem;}
.rh-rolelist li{list-style:none; display:flex; gap:.55rem; align-items:center; font-size:.875rem; color:var(--ink-soft);}
.rh-rolefoot{max-width:var(--maxw); margin:20px auto 0; padding:0 24px; font-size:.8125rem; color:var(--muted);}

/* spotlight (EVV audit defense) */
.rh-spot{max-width:var(--maxw); margin:24px auto 0; padding:0 24px;}
.rh-spotrow{display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:center; padding:0;}
.rh-spottext h3{font-size:clamp(1.4rem,2.4vw,1.95rem); letter-spacing:-.025em; margin-top:12px; color:var(--ink); line-height:1.15;}
.rh-spottext p{margin-top:12px; font-size:1.0625rem; line-height:1.6; color:var(--body-c);}
.rh-spotpts{margin:18px 0 0; padding:0; display:flex; flex-direction:column; gap:10px;}
.rh-spotpts li{list-style:none; display:flex; gap:.55rem; align-items:flex-start; font-size:.95rem; color:var(--ink-soft);}
.rh-spotvisuals{display:flex; flex-direction:column; gap:14px;}
@media(max-width:880px){.rh-spotrow{grid-template-columns:1fr; gap:26px;}}
.rh-evvgrid{margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:7px;}
.rh-evvi{display:flex; gap:.4rem; align-items:center; font-size:.72rem; color:var(--ink-soft); border:1px solid var(--line); border-radius:8px; padding:.45rem .55rem;}
.rh-logcard{padding:6px 6px;}
.rh-logrow{display:grid; grid-template-columns:auto 1fr auto; gap:10px; padding:10px 6px; border-bottom:1px solid var(--line); align-items:center;}
.rh-logrow:last-child{border-bottom:none;}
.rh-logrow .dot{width:7px; height:7px; border-radius:50%; background:var(--accent);}
.rh-logrow .ac{font-family:var(--font-mono); font-size:.72rem; color:var(--ink-soft);}
.rh-logrow .ts{font-size:.68rem; color:var(--muted); font-variant-numeric:tabular-nums;}

/* ROI calculator */
.rh-roi{max-width:var(--maxw); margin:40px auto 0; padding:0 24px;}
.rh-roi-card{border:1px solid var(--line); border-radius:18px; background:var(--paper); padding:32px; display:grid; grid-template-columns:1fr 1.3fr; gap:32px;}
.rh-roi-inputs{display:flex; flex-direction:column; gap:1rem;}
.rh-roi-field label{font-size:.8125rem; font-weight:600; color:var(--ink-soft); margin-bottom:.35rem; display:block;}
.rh-roi-field input{width:100%;}
.rh-roi-outputs{display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:.75rem; align-content:start;}
.rh-roi-cta{margin-top:1.25rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap;}
.rh-roi-note{font-size:.8125rem; color:var(--muted); max-width:60ch;}
@media(max-width:820px){.rh-roi-card{grid-template-columns:1fr;}}

/* trust center teaser */
.rh-trustgrid{max-width:var(--maxw); margin:36px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); gap:14px;}
.rh-trustcta{max-width:var(--maxw); margin:28px auto 0; padding:0 24px;}

/* pricing */
.rh-pricing{max-width:var(--maxw); margin:48px auto 0; padding:0 24px; display:grid; grid-template-columns:repeat(3,1fr); gap:16px; align-items:start;}
.rh-price{border:1px solid var(--line); border-radius:18px; padding:30px; background:var(--paper); display:flex; flex-direction:column; position:relative;}
.rh-price.feat{border-color:var(--accent); box-shadow:0 36px 80px -44px color-mix(in srgb, var(--accent) 55%, transparent);}
.rh-pbadge{position:absolute; top:-11px; left:30px; background:var(--accent); color:white; font-size:.68rem; font-weight:650; letter-spacing:.04em; padding:.28rem .7rem; border-radius:999px;}
.rh-price h3{font-size:1.15rem; letter-spacing:-.02em;}
.rh-price .pr{margin-top:10px; font-size:2rem; font-weight:600; color:var(--ink); letter-spacing:-.03em;}
.rh-price .pd{margin-top:8px; font-size:.9rem; color:var(--body-c); line-height:1.5;}
.rh-plist{margin:20px 0 22px; padding-top:20px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:11px; flex:1;}
.rh-plist li{list-style:none; display:flex; gap:.55rem; align-items:flex-start; font-size:.9rem; color:var(--ink-soft);}
@media(max-width:880px){.rh-pricing{grid-template-columns:1fr; max-width:460px;}}

/* faq accordion */
.rh-faqs{max-width:820px; margin:36px auto 0; padding:0 24px;}
.rh-faq{border-bottom:1px solid var(--line); padding:6px 2px;}
.rh-faqq{width:100%; text-align:left; background:none; border:none; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:20px 0; font:inherit; color:inherit;}
.rh-faqq h3{font-size:1.0625rem; letter-spacing:-.01em; font-weight:600; color:var(--ink);}
.rh-faqtog{flex-shrink:0; width:26px; height:26px; border-radius:7px; border:1px solid var(--line-2); display:grid; place-items:center; color:var(--ink-soft); transition:transform .25s ease, background .2s ease, color .2s ease, border-color .2s ease;}
.rh-faq.open .rh-faqtog{background:var(--accent); color:white; border-color:var(--accent); transform:rotate(45deg);}
.rh-faqa{overflow:hidden; max-height:0; transition:max-height .3s ease;}
.rh-faq.open .rh-faqa{max-height:260px;}
.rh-faqa p{padding:0 0 20px; font-size:.95rem; line-height:1.6; color:var(--body-c); max-width:72ch;}
.rh-faqq:focus-visible{outline:none; box-shadow:var(--shadow-focus); border-radius:8px;}

/* final cta */
.rh-final{max-width:var(--maxw); margin:0 auto; padding:0 24px;}
.rh-finalcard{background:var(--dark); border-radius:24px; padding:72px 40px; text-align:center; position:relative; overflow:hidden;}
.rh-finalcard::before{content:""; position:absolute; inset:0; background:radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%);}
.rh-finalcard h2{position:relative; color:white; font-size:clamp(1.8rem,3.4vw,2.6rem); letter-spacing:-.03em;}
.rh-finalcard p{position:relative; color:var(--dark-text-muted); font-size:1.0625rem; line-height:1.6; max-width:50ch; margin:16px auto 0;}
.rh-finalcard .rh-herocta{position:relative; justify-content:center; margin-top:32px;}
.rh-btn-outline-dark{background:transparent; color:white; border:1px solid rgba(255,255,255,.28);}
.rh-btn-outline-dark:hover{border-color:white;}

/* footer */
.rh-foot{border-top:1px solid var(--line); background:var(--warm); padding:64px 0 40px;}
.rh-footgrid{max-width:var(--maxw); margin:0 auto; padding:0 24px; display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr 1fr; gap:32px;}
.rh-foot .blurb{margin-top:16px; font-size:.9rem; line-height:1.6; color:var(--muted); max-width:30ch;}
.rh-footcol h4{font-size:.78rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:14px;}
.rh-footcol a{display:block; padding:.3rem 0; font-size:.9rem; color:var(--ink-soft);}
.rh-footcol a:hover{color:var(--ink);}
.rh-footcol a:focus-visible{outline:none; box-shadow:var(--shadow-focus); border-radius:6px;}
.rh-footbar{max-width:var(--maxw); margin:48px auto 0; padding:24px 24px 0; border-top:1px solid var(--line); display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; font-size:.82rem; color:var(--muted);}
@media(max-width:760px){ .rh-footgrid{grid-template-columns:1fr 1fr;} }

/* hero entrance, a calm, staggered rise on first paint (not a bounce) */
@keyframes rh-rise{from{opacity:0; transform:translateY(14px);} to{opacity:1; transform:none;}}
.rh-herotext > *{animation:rh-rise .7s cubic-bezier(.2,.7,.2,1) both;}
.rh-herotext > .rh-eyebrow{animation-delay:.04s;}
.rh-herotext > .rh-display{animation-delay:.12s;}
.rh-herotext > .rh-sublede{animation-delay:.22s;}
.rh-herotext > .rh-herocta{animation-delay:.32s;}
.rh-herotext > .rh-herotrust{animation-delay:.42s;}
.rh-heromedia{animation:rh-rise .8s cubic-bezier(.2,.7,.2,1) both; animation-delay:.28s;}

/* hero bloom, an almost-imperceptible slow breathe, so the page feels alive
   without ever calling attention to itself */
@keyframes rh-breathe{from{opacity:.72; transform:scale(1);} to{opacity:1; transform:scale(1.05);}}
.rh-hero-bloom{animation:rh-breathe 16s ease-in-out infinite alternate;}

/* staggered scroll-reveal, cards in a row cascade in rather than snapping
   as a block */
.rh-roles .rh-rv:nth-child(2){transition-delay:.07s;}
.rh-roles .rh-rv:nth-child(3){transition-delay:.14s;}
.rh-roles .rh-rv:nth-child(4){transition-delay:.21s;}
.rh-pricing .rh-rv:nth-child(2){transition-delay:.07s;}
.rh-pricing .rh-rv:nth-child(3){transition-delay:.14s;}

/* hover-lift for the pricing + EVV mockup cards, matching the role cards */
.rh-price{transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease;}
.rh-price:hover{transform:translateY(-3px); box-shadow:0 26px 54px -32px rgba(10,30,20,.42);}
.rh-price.feat:hover{box-shadow:0 44px 88px -44px color-mix(in srgb, var(--accent) 60%, transparent);}
.rh-evvi{transition:border-color .18s ease, background .18s ease, transform .18s ease;}
.rh-evvi:hover{border-color:var(--accent); background:var(--accent-tint); transform:translateY(-1px);}

/* reveal */
.rh-rv{opacity:0; transform:translateY(16px); transition:opacity .6s cubic-bezier(.2,.7,.2,1), transform .6s cubic-bezier(.2,.7,.2,1);}
.rh-rv.in{opacity:1; transform:none;}
@media(prefers-reduced-motion:reduce){ html{scroll-behavior:auto;} .rh-rv{opacity:1; transform:none; transition:none;} .rh-btn,.rh-rolecard,.rh-price,.rh-evvi{transition:none;} .rh-eyebrow .pip,.rh-hero-bloom,.rh-herotext > *,.rh-heromedia,.rh-theater-map .pin::after,.rh-theater-inner,.rh-spotvis .status-dot,.rh-theater-inner .status-dot{animation:none;} }
`,
    }}
    />
  );
}

function HeroMock() {
  return (
    <>
      <div className="rh-spotvis" aria-hidden>
        {chromeDots()}
        <span className="rh-vischrome"><span className="t">app.rayhealthevv.com/admin</span></span>
        <div className="rh-heromock-body">
          <div className="rh-mock-attn-list">
            <div className="attention-card" data-tone="warning">
              <span className="status-dot" data-tone="warning" />
              <span className="attention-card__body">
                <span className="attention-card__title">Missed clock-out</span>
                <span className="attention-card__detail">M. Rivera · 8:42 AM visit</span>
              </span>
              <StatusPill tone="warning" label="Warning" />
            </div>
            <div className="attention-card" data-tone="info">
              <span className="status-dot" data-tone="info" />
              <span className="attention-card__body">
                <span className="attention-card__title">Authorization expiring in 5 days</span>
                <span className="attention-card__detail">Client 2207 · Personal assistance</span>
              </span>
              <StatusPill tone="info" label="Info" />
            </div>
          </div>
          <div className="metric-grid metric-grid--compliance">
            <MetricCard label="Verified today" value="41 / 44" tone="success" sub="3 in progress" />
            <MetricCard label="Open exceptions" value="2" tone="warning" sub="Both same-day" />
            <MetricCard label="Billing-ready" value="Clean" tone="primary" sub="No blockers" />
          </div>
        </div>
      </div>
      <p className="rh-mockcaption">Illustrative preview on a seeded demo agency, not a customer’s live data.</p>
    </>
  );
}

function TheaterCommand() {
  return (
    <div className="rh-theater-inner">
      <div className="rh-mock-attn-list" style={{ marginBottom: '1rem' }}>
        <div className="attention-card" data-tone="warning">
          <span className="status-dot" data-tone="warning" />
          <span className="attention-card__body">
            <span className="attention-card__title">Missed clock-out</span>
            <span className="attention-card__detail">M. Rivera · flagged as an exception, not hidden</span>
          </span>
          <StatusPill tone="warning" label="Warning" />
        </div>
        <div className="attention-card" data-tone="danger">
          <span className="status-dot" data-tone="danger" />
          <span className="attention-card__body">
            <span className="attention-card__title">Out-of-fence clock-out</span>
            <span className="attention-card__detail">D. Whitfield · needs a reason code</span>
          </span>
          <StatusPill tone="danger" label="Critical" />
        </div>
      </div>
      <div className="metric-grid metric-grid--compliance">
        <MetricCard label="Visits verified" value="41 / 44" tone="success" />
        <MetricCard label="Schedule integrity" value="Holds" tone="primary" sub="0 conflicts this week" />
        <MetricCard label="Credentials expiring" value="1" tone="warning" sub="Within 14 days" />
      </div>
    </div>
  );
}

function TheaterClockIn() {
  return (
    <div className="rh-theater-inner rh-theater-clockin">
      <div className="rh-theater-map">
        <span className="zone" />
        <span className="pin" />
      </div>
      <div className="rh-theater-clockin-copy">
        <StatusPill tone="success" label="Inside the geofence" />
        <h4>You’re 12m from the client’s registered address.</h4>
        <p>The map is feedback, the actual clock-in decision is made on our servers, so a modified phone can’t fake a visit. All six federal EVV elements are captured the moment the caregiver taps Clock In.</p>
        <div className="rh-theater-clockin-actions">
          <span className="rh-btn rh-btn-pri" aria-hidden style={{ pointerEvents: 'none' }}>Clock In</span>
          <StatusPill tone="neutral" label="Clock-out always available" />
        </div>
      </div>
    </div>
  );
}

function TheaterExceptions() {
  return (
    <div className="rh-theater-inner">
      <DataTable<ExceptionRow>
        caption="Example exception queue"
        columns={[
          { key: 'caregiver', header: 'Caregiver', render: (r) => r.caregiver },
          { key: 'client', header: 'Client', render: (r) => r.client },
          { key: 'issue', header: 'Issue', render: (r) => r.issue },
          {
            key: 'status',
            header: 'Status',
            align: 'right',
            render: (r) => <StatusPill tone={r.status === 'Open' ? 'warning' : 'success'} label={r.status} />,
          },
        ]}
        rows={exceptionRows}
        getRowKey={(r) => r.id}
      />
    </div>
  );
}

function TheaterAudit() {
  return (
    <div className="rh-theater-inner">
      <Timeline
        items={[
          { id: 't1', timestamp: '09:02:14', title: 'visit.verified', description: 'Six of six EVV elements present', tone: 'success' },
          { id: 't2', timestamp: '08:41:09', title: 'exception.resolved', description: 'Actor: office admin · reason code recorded', tone: 'info' },
          { id: 't3', timestamp: '08:12:55', title: 'credential.renewed', tone: 'neutral' },
          { id: 't4', timestamp: '07:58:30', title: 'claim.flagged', description: 'Denial-risk check, held before submission', tone: 'warning' },
        ]}
      />
    </div>
  );
}

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theaterTab, setTheaterTab] = useState<TheaterTab>('command');

  // ROI calculator inputs, a real, controlled component ready for future
  // interactivity. Outputs intentionally stay as honest placeholders: per
  // the brief, we never show a fabricated result number as if it were real.
  const [caregivers, setCaregivers] = useState(10);
  const [visitsPerWeek, setVisitsPerWeek] = useState(150);
  const [cleanupHours, setCleanupHours] = useState(6);

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
      <CSS />

      <nav className="rh-nav">
        <div className="rh-navin">
          <Link to="/" aria-label="RayHealthEVV home"><BrandLogo height={34} /></Link>
          <div className="rh-navmid">
            <Link to="/solutions/scheduling">Scheduling</Link>
            <Link to="/solutions/electronic-visit-verification">EVV</Link>
            <Link to="/rayverify">RayVerify</Link>
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
            <Link to="/platform/compliance" onClick={() => setMenuOpen(false)}>Compliance</Link>
            <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
            <Link to="/demo" className="rh-btn rh-btn-pri" onClick={() => setMenuOpen(false)}>Book a demo</Link>
          </div>
        </div>
      </nav>

      {/* 1. Premium hero */}
      <header className="rh-hero">
        <div className="rh-hero-bloom" aria-hidden />
        <div className="rh-hero-grid" aria-hidden />
        <div className="rh-heroin">
          <div className="rh-herotext">
            <span className="rh-eyebrow"><span className="pip" />Pennsylvania-built · Cures Act EVV aligned</span>
            <h1 className="rh-display">The calm command center for <span className="em">Pennsylvania homecare</span>.</h1>
            <p className="rh-sublede">
              Scheduling, GPS-verified EVV, compliance, billing readiness, caregiver training, and audit
              defense, one platform, one login, one answer to “is anything wrong today?”
            </p>
            <div className="rh-herocta">
              <Link to="/demo" className="rh-btn rh-btn-pri">Book a demo</Link>
              <a href="#product-theater" className="rh-btn rh-btn-ghost">View product tour</a>
            </div>
            <ul className="rh-herotrust">
              {heroTrust.map((t) => <li key={t}>{check}{t}</li>)}
            </ul>
          </div>
          <div className="rh-heromedia">
            <HeroMock />
          </div>
        </div>
      </header>

      {/* Trust / fact strip, honest replacement for the old fabricated metrics */}
      <div className="rh-factband">
        <div className="rh-factgrid">
          {trustFacts.map((m) => (
            <div className="rh-fact" key={m.label}>
              <div className="v">{m.value}</div>
              <div className="l">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Interactive product theater */}
      <section id="product-theater" className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">See it in action</p>
          <h2 className="rh-h2 rh-rv">One product, four moments in the day.</h2>
          <p className="rh-deck rh-rv">Switch tabs to preview the same product a coordinator, a caregiver, and a compliance officer each open every day. Every screen below is built from the platform’s real UI components, on a seeded demo agency.</p>
        </div>
        <div className="rh-theater-tabs rh-rv" role="tablist" aria-label="Product preview">
          {THEATER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`theater-tab-${t.id}`}
              aria-selected={theaterTab === t.id}
              aria-controls={`theater-panel-${t.id}`}
              className="rh-theater-tab"
              onClick={() => setTheaterTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="rh-theater-panels rh-rv">
          <div
            id={`theater-panel-${theaterTab}`}
            role="tabpanel"
            aria-labelledby={`theater-tab-${theaterTab}`}
            className="rh-spotvis rh-theater-panel"
          >
            {chromeDots()}
            <span className="rh-vischrome"><span className="t">{THEATER_TABS.find((t) => t.id === theaterTab)?.label}</span></span>
            {theaterTab === 'command' && <TheaterCommand />}
            {theaterTab === 'clockin' && <TheaterClockIn />}
            {theaterTab === 'exceptions' && <TheaterExceptions />}
            {theaterTab === 'audit' && <TheaterAudit />}
          </div>
          <p className="rh-mockcaption">Illustrative preview on a seeded demo agency, not a customer’s live data.</p>
        </div>
      </section>

      {/* 3. Pain to outcome */}
      <section className="rh-sec tight warm">
        <div className="rh-sechead center">
          <p className="rh-eyelabel rh-rv">Before / after</p>
          <h2 className="rh-h2 rh-rv">What changes when you switch.</h2>
        </div>
        <div className="rh-cmp rh-rv">
          <div className="rh-cmptbl">
            <div className="rh-cmphd">
              <div className="lbl">&nbsp;</div>
              <div className="old">Before</div>
              <div className="new">With RayHealthEVV</div>
            </div>
            {painToOutcome.map((r) => (
              <div className="rh-cmprow" key={r.label}>
                <div className="lbl">{r.label}</div>
                <div className="old">{r.before}</div>
                <div className="new"><span className="rh-ck">{check}</span>{r.after}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Role-based sections */}
      <section className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Who it’s for</p>
          <h2 className="rh-h2 rh-rv">Built for everyone in the agency.</h2>
          <p className="rh-deck rh-rv">One platform that works the way owners, coordinators, compliance officers, and caregivers actually work.</p>
        </div>
        <div className="rh-roles">
          {roles.map((r) => (
            <div className="rh-rolecard rh-rv" key={r.role}>
              <h3>{r.role}</h3>
              <p>{r.body}</p>
              <p className="rh-rolequote">“{r.quote}”</p>
              <ul className="rh-rolelist">
                {r.points.map((p) => <li key={p}><span className="rh-ck">{check}</span><span>{p}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="rh-rolefoot rh-rv">These are role-based outcome statements describing product capabilities, not fabricated customer quotes. We’ll feature named agencies once our first customers go live.</p>
      </section>

      {/* 5. EVV audit defense */}
      <section id="audit-defense" className="rh-sec tight warm">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">EVV & audit defense</p>
          <h2 className="rh-h2 rh-rv">Every visit, provably verified.</h2>
        </div>
        <div className="rh-spot">
          <div className="rh-spotrow">
            <div className="rh-spottext rh-rv">
              <p className="rh-eyelabel">How it holds up under audit</p>
              <h3>An audit trail that defends itself.</h3>
              <p>Six federal elements are captured automatically at clock-in and clock-out. The geofence decision is made on our servers, never trusted from the phone. Every correction is a new event, not an overwrite, and every exception carries a reason code on its way into a queue that drains to zero.</p>
              <ul className="rh-spotpts">
                <li><span className="rh-ck">{check}</span>All six federal EVV elements captured on every visit</li>
                <li><span className="rh-ck">{check}</span>GPS proof, the clock-in decision is server-verified</li>
                <li><span className="rh-ck">{check}</span>Append-only edit trail, corrections are new events</li>
                <li><span className="rh-ck">{check}</span>Every exception carries a reason code and an owner</li>
                <li><span className="rh-ck">{check}</span>Pick a date range and get a structured, exportable evidence packet</li>
              </ul>
            </div>
            <div className="rh-spotvisuals rh-rv" aria-hidden>
              <div className="rh-spotvis rh-spotvis--flush">
                {chromeDots()}
                <span className="rh-vischrome"><span className="t">Visit · six-element capture</span></span>
                <div className="rh-evvgrid">
                  {['Caregiver ID', 'Client ID', 'Service type', 'Date & time', 'Location', 'Visit status'].map((e) => (
                    <div className="rh-evvi" key={e}><span className="rh-ck">{check}</span>{e}</div>
                  ))}
                </div>
              </div>
              <div className="rh-spotvis rh-spotvis--flush">
                {chromeDots()}
                <span className="rh-vischrome"><span className="t">Audit event log</span></span>
                <div className="rh-logcard">
                  {[
                    { a: 'visit.verified', t: '09:02:14' },
                    { a: 'exception.resolved', t: '08:41:09' },
                    { a: 'claim.flagged', t: '07:58:30' },
                  ].map((r) => (
                    <div className="rh-logrow" key={r.a}><span className="dot" /><span className="ac">{r.a}</span><span className="ts">{r.t}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RayVerify, deeper dive on verification, already honest/labeled live-vs-rolling-out */}
      <RayVerifySection />

      {/* 6. Implementation timeline */}
      <section className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Switching systems</p>
          <h2 className="rh-h2 rh-rv">Live in days, not months.</h2>
          <p className="rh-deck rh-rv">A structured onboarding plan, not a sales calendar, you go live when the checklist says you’re ready.</p>
        </div>
        <div className="rh-wrap rh-rv" style={{ marginTop: '32px' }}>
          <WorkflowStepper orientation="vertical" steps={timelineSteps} />
        </div>
      </section>

      {/* 7. ROI calculator teaser */}
      <section className="rh-sec tight warm">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Estimate your impact</p>
          <h2 className="rh-h2 rh-rv">See what a calmer operation could look like.</h2>
          <p className="rh-deck rh-rv">A quick starting point, plug in your numbers. We’ll build your real estimate together, from your own data, during a walkthrough.</p>
        </div>
        <div className="rh-roi rh-rv">
          <div className="rh-roi-card">
            <div className="rh-roi-inputs">
              <div className="rh-roi-field">
                <label htmlFor="roi-caregivers">Caregivers on staff</label>
                <input
                  id="roi-caregivers"
                  type="number"
                  min={1}
                  value={caregivers}
                  onChange={(e) => setCaregivers(Number(e.target.value))}
                />
              </div>
              <div className="rh-roi-field">
                <label htmlFor="roi-visits">Visits scheduled per week</label>
                <input
                  id="roi-visits"
                  type="number"
                  min={1}
                  value={visitsPerWeek}
                  onChange={(e) => setVisitsPerWeek(Number(e.target.value))}
                />
              </div>
              <div className="rh-roi-field">
                <label htmlFor="roi-hours">Hours/month spent on denial cleanup today</label>
                <input
                  id="roi-hours"
                  type="number"
                  min={0}
                  value={cleanupHours}
                  onChange={(e) => setCleanupHours(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <div className="rh-roi-outputs">
                <MetricCard label="EVV cleanup hours saved / month" value=", " tone="neutral" sub="Estimated live during your walkthrough" />
                <MetricCard label="Denial-risk issues caught pre-billing" value=", " tone="neutral" sub="Illustrative, not a guaranteed outcome" />
                <MetricCard label="Coordinator time recovered / week" value=", " tone="neutral" sub="Calculated from your real schedule" />
              </div>
              <div className="rh-roi-cta">
                <Link to="/demo" className="rh-btn rh-btn-pri">Get your custom estimate</Link>
                <p className="rh-roi-note">This calculator previews the inputs we’ll use, {caregivers} caregivers, {visitsPerWeek} visits/week, {cleanupHours} cleanup hours/month today, to build a real, agency-specific estimate. We don’t publish a formula-based number here because we haven’t measured it on your data yet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Trust center teaser */}
      <section id="compliance" className="rh-sec">
        <div className="rh-sechead">
          <p className="rh-eyelabel rh-rv">Compliance & trust</p>
          <h2 className="rh-h2 rh-rv">Security you can verify. Compliance we won’t overstate.</h2>
          <p className="rh-deck rh-rv">
            RayHealthEVV is engineered to HIPAA Security Rule controls: per-agency data isolation enforced
            on every request, an audit trail that is append-only by database design, revocable mobile
            sessions, and server-side verification of every clock-in. Our operational HIPAA readiness , 
            including vendor business associate agreements, is in progress, and we publish its status
            openly. We’ll execute a BAA with every agency before any PHI is processed.
          </p>
        </div>
        <div className="rh-trustgrid rh-rv">
          {trustTeaserItems.map((t) => (
            <TrustBadge key={t.label} icon={<Icon name={t.icon} size={20} />} label={t.label} detail={t.detail} tone={t.tone} />
          ))}
        </div>
        <div className="rh-trustcta rh-rv">
          <Link to="/trust" className="rh-btn rh-btn-ghost">See our compliance status →</Link>
        </div>
      </section>

      {/* Pricing teaser */}
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
                {t.feat.map((f) => <li key={f}><span className="rh-ck">{check}</span><span>{f}</span></li>)}
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
          <h2 className="rh-h2 rh-rv">Questions, answered honestly.</h2>
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

      {/* 9. CTA footer */}
      <section className="rh-sec">
        <div className="rh-final">
          <div className="rh-finalcard rh-rv">
            <h2>See your agency calm.</h2>
            <p>A focused walkthrough of the admin platform and the caregiver app. Bring a real case, we’ll run it live.</p>
            <div className="rh-herocta">
              <Link to="/demo" className="rh-btn rh-btn-dark">Book a RayHealth walkthrough</Link>
              <Link to="/resources/audit-checklist" className="rh-btn rh-btn-ghost rh-btn-outline-dark">See PA EVV readiness checklist</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="rh-foot">
        <div className="rh-footgrid">
          <div>
            <BrandLogo height={40} />
            <p className="blurb">The calm command center for Pennsylvania homecare agencies. Verified visits, defensible claims, one operational core.</p>
          </div>
          <div className="rh-footcol">
            <h4>Platform</h4>
            <a href="#product-theater">Product tour</a>
            <Link to="/rayverify">RayVerify</Link>
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
          <span>HIPAA-ready architecture · 21st Century Cures Act aligned</span>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
}
