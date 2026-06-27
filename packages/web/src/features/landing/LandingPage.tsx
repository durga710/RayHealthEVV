import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const stats = [
  { value: '100%', label: 'PA DHS aligned' },
  { value: '6/6', label: 'Federal EVV elements' },
  { value: '<60s', label: 'Caregiver clock-in' },
  { value: '21CC', label: 'Cures Act ready' },
];

const steps = [
  {
    n: '01',
    title: 'Build the care plan',
    body: 'Coordinators import authorizations from Sandata or PROMISe and turn them into reusable visit templates with PA-coded tasks.',
  },
  {
    n: '02',
    title: 'Assign a credentialed caregiver',
    body: 'The eligibility engine blocks any assignment whose caregiver has expired TB screening, background check, training, or license records.',
  },
  {
    n: '03',
    title: 'Verify the visit at the door',
    body: 'Caregivers clock in from the mobile app with GPS — accuracy, identity, time, and service code captured for all six federal EVV elements.',
  },
  {
    n: '04',
    title: 'Approve, file, audit',
    body: 'Coordinators review exceptions and every state-changing event is appended to an immutable audit log keyed by agency, actor, entity.',
  },
];

const roles = [
  {
    title: 'Administrators',
    body: 'Single source of truth for agency, payer, and PROMISe credentials. Drill into any visit, any audit row, any caregiver record.',
    points: ['Agency + branch hierarchy', 'Capability-scoped access', 'Audit trail with payload diffs'],
  },
  {
    title: 'Coordinators',
    body: 'Build templates, fill the schedule, and clear exceptions before they age out of the billing window.',
    points: ['Template-driven scheduling', 'Eligibility checks at assignment', 'Visit Review queue'],
  },
  {
    title: 'Caregivers',
    body: 'A single-screen mobile flow for clock-in, task documentation, and clock-out — with GPS verification and offline retry.',
    points: ['One-tap clock-in/out', 'Per-task PA duty codes', 'Telephony fallback for no-signal homes'],
  },
  {
    title: 'Families',
    body: 'Read-only visibility into the care plan and the visits actually delivered — without exposing PHI from other clients.',
    points: ['Care plan read access', 'Visit history view', 'No back-channel chat'],
  },
];

const compliance = [
  { name: '21st Century Cures Act', detail: 'All six federal EVV data elements captured and validated on every clock-out.' },
  { name: 'PA DHS / PROMISe', detail: 'Built around PA personal-assistance and home-health operating tracks; PA task codes 106–256 are first-class.' },
  { name: 'HIPAA', detail: 'PHI is scoped per agency and capability. Access tokens are JWT, password storage is bcrypt with cost 12.' },
  { name: 'Sandata aggregator ready', detail: 'EVV records map cleanly to the federal element schema for downstream submission.' },
  { name: 'Audit-grade trail', detail: 'Immutable audit_events records the actor, entity, payload, and timestamp for every state change.' },
  { name: 'Operational guardrails', detail: 'Rate-limited login and bootstrap, advisory-locked first-admin creation, CORS scoped to allowlisted origins.' },
];

const operations = [
  {
    title: 'Credential-first staffing',
    body: 'Assignments are designed to fail closed when required background checks, TB screening, training, or role credentials are missing or expired.',
  },
  {
    title: 'Authorization-aware scheduling',
    body: 'Templates and visits stay tied to payer authorization windows and units, reducing over-service, missed billing support, and retroactive cleanup.',
  },
  {
    title: 'Field-ready EVV capture',
    body: 'Caregivers get a small mobile workflow for GPS clock-in/out, task completion, exception notes, and offline-friendly retry behavior.',
  },
  {
    title: 'Audit packets on demand',
    body: 'Every protected write and PHI-sensitive read can be reconstructed from immutable audit events with actor, agency, resource, and outcome context.',
  },
];

const roadmap = [
  {
    phase: 'Now',
    title: 'Pennsylvania operating core',
    status: 'Live in demo',
    detail: 'Admin login, PA task library, clients, authorizations, templates, assignments, EVV review, CSRF-protected sessions, and audit events.',
    proof: ['PA-only task catalog', 'Protected admin sessions', 'Visit exception review'],
  },
  {
    phase: 'Next',
    title: 'Caregiver mobile completion loop',
    status: 'Hardening',
    detail: 'Tighten the clock-in/out experience, offline queue visibility, caregiver assignment list, and exception submission from the field.',
    proof: ['Offline retry visibility', 'Clock-in packet review', 'Exception note capture'],
  },
  {
    phase: 'Then',
    title: 'Aggregator submission readiness',
    status: 'Designing',
    detail: 'Normalize EVV records for Sandata/PROMISe export, rejection handling, visit-maintenance corrections, and submission evidence packets.',
    proof: ['Submission mapping', 'Rejection queue', 'Audit evidence packets'],
  },
  {
    phase: 'Later',
    title: 'State expansion without dilution',
    status: 'Policy gated',
    detail: 'Add state policy profiles only when credentialing, geofence, retention, and aggregator rules are represented explicitly in the domain model.',
    proof: ['State policy profiles', 'Aggregator rules', 'Retention controls'],
  },
];

const resources = [
  {
    title: 'CMS EVV guidance',
    type: 'Federal rulebook',
    body: 'Baseline EVV mandate, timelines, and Medicaid expectations for personal care and home health services.',
    href: 'https://www.medicaid.gov/medicaid/home-community-based-services/home-community-based-services-guidance-additional-resources/electronic-visit-verification',
  },
  {
    title: 'Pennsylvania DHS EVV',
    type: 'State operating model',
    body: 'Pennsylvania EVV model, provider responsibilities, open vendor approach, and DHS aggregator context.',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv',
  },
  {
    title: 'PA EVV FAQ',
    type: 'Provider questions',
    body: 'Practical DHS answers on capture methods, alternate EVV, aggregator expectations, and provider workflow.',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv/faq-evv',
  },
  {
    title: 'Free DHS EVV solution',
    type: 'Training and Sandata',
    body: 'DHS EVV solution resources, Sandata On-Demand training, and provider onboarding references.',
    href: 'https://www.pa.gov/agencies/dhs/resources/for-providers/evv/free-dhs-evv-solution',
  },
  {
    title: 'HIPAA Security Rule',
    type: 'Privacy and security',
    body: 'HHS overview of administrative, physical, and technical safeguards for electronic PHI.',
    href: 'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
  },
  {
    title: 'RayHealth rollout roadmap',
    type: 'RayHealth internal',
    body: 'Current feature readiness, messaging guardrails, and the implementation work still required before production claims.',
    href: '#roadmap',
  },
];

const faqs = [
  {
    q: 'Why Pennsylvania-only?',
    a: 'Each state encodes EVV differently. By staying scoped to PA we can ship deeper compliance — operating tracks, PROMISe codes, and credential rules — instead of a lowest-common-denominator product.',
  },
  {
    q: 'How does this differ from a general scheduling tool?',
    a: 'Scheduling is one slice. RayHealth EVV ties scheduling to authorization units, caregiver credentials, GPS-verified visits, and an immutable audit trail — the workflow auditors actually look at.',
  },
  {
    q: 'What if a caregiver loses signal during a visit?',
    a: 'The mobile app queues clock-in/out and switches to telephony fallback. Coordinators see the visit flagged with a `telephony-fallback` exception they can approve.',
  },
  {
    q: 'Can families log in?',
    a: 'Yes — with a read-only role scoped to a single client. They cannot see other clients, schedules, or staff records.',
  },
];

/* ------------------------------------------------------------------ */
/* Small composable pieces                                             */
/* ------------------------------------------------------------------ */

function SectionEyebrow({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm font-bold uppercase tracking-[0.25em] text-primary${className}`}>
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mx-auto mt-3 mb-4 max-w-2xl text-balance font-display text-4xl font-bold leading-[1.15] text-primary md:text-[2.75rem]">
      {children}
    </h2>
  );
}

function SectionLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto max-w-2xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
      {children}
    </p>
  );
}

function BrandWordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-2xl font-black tracking-tight text-primary">
      RayHealth
      <span className="rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.2em] text-white">
        EVV
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-8">
        <a href="#main" className="focus-visible:outline-2 focus-visible:outline-ring">
          <BrandWordmark />
        </a>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
          <a href="#how" className="text-secondary-foreground transition-colors hover:text-primary">How it works</a>
          <a href="#roles" className="text-secondary-foreground transition-colors hover:text-primary">Roles</a>
          <a href="#compliance" className="text-secondary-foreground transition-colors hover:text-primary">Compliance</a>
          <a href="#resources" className="text-secondary-foreground transition-colors hover:text-primary">Resources</a>
          <a href="#roadmap" className="text-secondary-foreground transition-colors hover:text-primary">Roadmap</a>
          <a href="#faq" className="text-secondary-foreground transition-colors hover:text-primary">FAQ</a>
          <Button asChild size="sm">
            <Link to="/login">Log in</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 12% 8%, rgba(249, 115, 22, 0.12), transparent 28rem), linear-gradient(180deg, #f6fbff 0%, #eef5fb 34%, #f8fbfd 100%)',
      }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[0.92fr_1.08fr] md:gap-16 md:px-8 md:py-24">
        <div className="flex flex-col items-start gap-5 text-center md:text-left">
          <SectionEyebrow>Pennsylvania Home Care Platform</SectionEyebrow>
          <h1 className="text-balance font-display text-5xl font-black leading-[0.97] tracking-tight text-primary md:text-[clamp(3rem,6.1vw,5.65rem)]">
            EVV operations that prove the visit happened.
          </h1>
          <p className="text-pretty max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            RayHealth EVV turns scheduling, authorization units, caregiver credentials, GPS capture, and visit exceptions into one audit-ready workflow for Pennsylvania agencies.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="default">
              <Link to="/login">
                Access admin portal
                <ArrowRight className="ml-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#resources">Browse resources</a>
            </Button>
          </div>
          <ul aria-label="Implementation status" className="flex flex-wrap gap-2">
            {['CSRF web sessions', 'PA task library', 'EVV exception queue'].map((label) => (
              <li
                key={label}
                className="rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 text-xs font-bold text-secondary-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div
      aria-label="Live visit command center"
      className="relative overflow-hidden rounded-3xl border border-white/20 p-5 text-white shadow-2xl md:p-6"
      style={{
        background:
          'radial-gradient(circle at 20% 0%, rgba(91, 168, 245, 0.26), transparent 18rem), linear-gradient(145deg, #083a83 0%, #0f5da6 58%, #083161 100%)',
      }}
    >
      <div className="relative z-10 mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-sky-300">
            Live visit command center
          </p>
          <strong className="mt-1 block text-xl font-display">Wednesday field operations</strong>
        </div>
        <span className="whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs font-black text-white">
          PA DHS mode
        </span>
      </div>

      <div className="relative z-10 grid grid-cols-[1.2fr_0.9fr] gap-3">
        <div className="row-span-2 min-h-[12rem] rounded-2xl border border-white/15 bg-white/15 p-4">
          <span className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-sky-300">
            Visit exceptions
          </span>
          <strong className="mt-2 block text-lg font-display">7 need coordinator review</strong>
          <p className="mt-2 text-sm leading-relaxed text-sky-100">
            2 GPS drift, 3 late clock-outs, 2 missing task attestations
          </p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
          <span className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-sky-300">
            Credential gate
          </span>
          <strong className="mt-2 block text-base font-display">Blocked assignment</strong>
          <p className="mt-2 text-xs leading-relaxed text-sky-100">
            TB screening expires before scheduled visit window.
          </p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
          <span className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-sky-300">
            Authorization burn
          </span>
          <strong className="mt-2 block text-base font-display">68% units used</strong>
          <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <span
              className="block h-full rounded-[inherit]"
              style={{
                width: '68%',
                background: 'linear-gradient(90deg, #22c55e, #f97316)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#f8fbff] p-4 text-primary">
        <div>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Caregiver mobile
          </span>
          <strong className="mt-1 block text-base font-display">Clock-in packet ready</strong>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Client, service code, GPS accuracy, task checklist, and offline retry state.
          </p>
        </div>
        <span className="whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs font-black text-white">
          Ready
        </span>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-2 rounded-2xl bg-black/15 px-3 py-2 text-sm text-sky-100">
        <span>Audit event:</span>
        <code className="font-bold text-white">visit.exception.created</code>
        <span>actor, agency, entity, payload</span>
      </div>
    </div>
  );
}

function StatsStrip() {
  return (
    <section className="px-4 md:px-8" aria-label="Platform metrics">
      <div className="mx-auto grid max-w-5xl grid-cols-2 overflow-hidden rounded-2xl border border-border bg-border shadow-md md:grid-cols-4 md:gap-px">
        {stats.map((s) => (
          <div key={s.label} className="bg-card p-6 text-center md:p-8">
            <div className="font-display text-4xl font-black leading-none text-primary md:text-5xl">
              {s.value}
            </div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="px-4 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <SectionEyebrow>How it works</SectionEyebrow>
          <SectionHeading>From authorization to audit-ready visit in four steps.</SectionHeading>
          <SectionLead>
            Every step pushes data into the next, so coordinators stop reconciling spreadsheets and start clearing exceptions.
          </SectionLead>
        </div>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.n}
              className="relative rounded-2xl bg-card p-7 pt-10 shadow-md transition-transform hover:-translate-y-1"
            >
              <div className="absolute -top-4 left-6 rounded-full bg-primary px-3 py-1 font-display text-xs font-black tracking-widest text-white">
                STEP {step.n}
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-primary">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section id="roles" className="bg-card px-4 py-20 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <SectionEyebrow>Who it's for</SectionEyebrow>
          <SectionHeading>One platform, four very different jobs to do.</SectionHeading>
          <SectionLead>
            Capabilities are scoped per role, so each user only sees what their work actually requires.
          </SectionLead>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => (
            <article
              key={role.title}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-7"
            >
              <h3 className="font-display text-xl font-semibold text-primary">{role.title}</h3>
              <p className="text-sm leading-relaxed text-foreground/80">{role.body}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {role.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Compliance() {
  return (
    <section id="compliance" className="px-4 py-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <SectionEyebrow>Compliance</SectionEyebrow>
          <SectionHeading>Built for the framework auditors actually use.</SectionHeading>
          <SectionLead>
            Compliance isn't a feature toggle — it's the schema, the validation layer, and the audit trail.
          </SectionLead>
        </div>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {compliance.map((c) => (
            <li
              key={c.name}
              className="flex gap-4 rounded-2xl bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div aria-hidden="true" className="w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <h3 className="font-display text-base font-semibold text-primary">{c.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Resources() {
  return (
    <section
      id="resources"
      className="px-4 py-24 md:px-8"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #edf5fb 100%)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <SectionEyebrow>Resource Library</SectionEyebrow>
          <SectionHeading>Give agencies the receipts, not just the pitch.</SectionHeading>
          <SectionLead>
            These are the source materials and internal readiness notes we use to keep the product honest while we harden the workflows.
          </SectionLead>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => {
            const isExternal = resource.href.startsWith('http');
            return (
              <li key={resource.title}>
                <a
                  href={resource.href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noreferrer' : undefined}
                  className="group flex h-full flex-col rounded-2xl border border-primary/10 bg-card/80 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                    {resource.type}
                  </span>
                  <strong className="mt-3 inline-flex items-center gap-1.5 font-display text-lg text-primary">
                    {resource.title}
                    {isExternal && (
                      <ExternalLink
                        className="size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    )}
                  </strong>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{resource.body}</p>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Operations() {
  return (
    <section id="operations" className="bg-card px-4 py-20 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <SectionEyebrow>Operational proof</SectionEyebrow>
          <SectionHeading>Built around the messy handoffs agencies fight every week.</SectionHeading>
          <SectionLead>
            RayHealth EVV connects compliance checkpoints to the actual work: hiring, scheduling, field documentation, billing support, and audit response.
          </SectionLead>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {operations.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-border bg-background p-6 transition-colors hover:border-primary/30"
            >
              <h3 className="mb-2 font-display text-lg font-semibold text-primary">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roadmap() {
  return (
    <section
      id="roadmap"
      className="relative overflow-hidden px-4 py-24 text-white md:px-8"
      style={{
        background:
          'radial-gradient(circle at 10% 12%, rgba(249, 115, 22, 0.22), transparent 24rem), radial-gradient(circle at 88% 8%, rgba(91, 168, 245, 0.22), transparent 26rem), linear-gradient(135deg, #062b61 0%, #073f8e 46%, #021a3f 100%)',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.16) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-8 md:grid-cols-[0.78fr_1.22fr]">
        <div className="flex flex-col justify-between gap-8 rounded-3xl border border-white/15 bg-white/[0.08] p-8 shadow-2xl backdrop-blur-lg">
          <div>
            <SectionEyebrow className="!text-orange-300">Implementation Roadmap</SectionEyebrow>
            <h2 className="mt-3 font-display text-4xl font-black leading-[0.95] tracking-tight md:text-5xl">
              Roadmap cockpit for launch risk.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-sky-100">
              The sequence is simple: keep the Pennsylvania demo dependable, close the caregiver mobile loop, then harden aggregator submission with evidence packets agencies can actually hand to an auditor.
            </p>
          </div>
          <ul className="grid gap-2">
            {['Updated landing UI', 'Resource library added', 'Production deployed'].map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold"
              >
                <ShieldCheck className="size-4 text-orange-300" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {roadmap.map((item) => (
            <article
              key={item.phase}
              className="flex flex-col rounded-3xl border border-white/15 bg-white/[0.08] p-6 shadow-xl backdrop-blur-lg"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">
                  {item.phase}
                </span>
                <strong className="whitespace-nowrap rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-200">
                  {item.status}
                </strong>
              </div>
              <h3 className="mb-2 font-display text-lg leading-tight">{item.title}</h3>
              <p className="text-sm leading-relaxed text-sky-100">{item.detail}</p>
              <ul className="mt-auto grid gap-1.5 pt-4">
                {item.proof.map((proof) => (
                  <li key={proof} className="flex items-center gap-2 text-sm font-bold">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-orange-400" />
                    {proof}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/15 bg-white/[0.08] p-6 shadow-xl backdrop-blur-lg md:col-span-2">
            <div className="min-w-0 flex-1">
              <SectionEyebrow className="!text-orange-300">Launch resources</SectionEyebrow>
              <strong className="mt-2 block font-display text-lg">
                Use the resource library to validate every roadmap claim.
              </strong>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sky-100">
                CMS EVV, Pennsylvania DHS EVV, PA FAQ, Sandata training, and HIPAA Security Rule references are now linked directly on the page.
              </p>
            </div>
            <Button asChild variant="default" className="bg-white text-primary hover:bg-white/90">
              <a href="#resources">
                Jump to resources
                <ArrowRight />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="bg-card px-4 py-20 md:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <SectionHeading>Common questions.</SectionHeading>
        </div>
        <div className="flex flex-col gap-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group cursor-pointer rounded-2xl bg-background p-5 transition-colors hover:bg-background/80"
            >
              <summary className="flex items-center justify-between gap-4 font-display text-base font-bold text-primary [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-primary px-4 py-20 text-white md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <h2 className="font-display text-4xl font-black leading-[1.15] md:text-5xl">
          Ready to retire the spreadsheets?
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-sky-100 md:text-lg">
          Get a live walkthrough of the admin portal and the caregiver mobile flow. We'll bring sample data — bring your hardest workflow.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="default">
            <Link to="/login">Access admin portal</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <a href="mailto:hello@rayhealthevv.com">Request a demo</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-primary px-4 py-8 text-sm text-sky-200 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span>&copy; {new Date().getFullYear()} RayHealth EVV. All rights reserved.</span>
        <span>Pennsylvania-only • HIPAA-aware • 21st Century Cures Act aligned</span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <StatsStrip />
        <HowItWorks />
        <Roles />
        <Compliance />
        <Resources />
        <Operations />
        <Roadmap />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
