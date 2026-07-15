# RayHealthEVV™ Elite Multi-Agent Implementation Plan

**Authored by Durga Ghimeray**

Repository: `https://github.com/durga710/rayhealth-evv-platform`
Product: **RayHealthEVV™**
Founder / Author: **Durga Ghimeray**

---

## Permanent Authorship Rule

Every final document, implementation report, planning file, changelog, product strategy note, generated internal `.md` file, README update, sprint report, QA report, and agent report must include:

**Authored by Durga Ghimeray**

Do not over-insert author credit inside every source-code function. Add it naturally in docs, reports, planning files, product artifacts, and generated markdown files.

---

# 1. Mission

You are an elite team of AI software agents working on **RayHealthEVV™**, a Pennsylvania-first Electronic Visit Verification and homecare agency operating platform.

Your mission is to transform RayHealthEVV™ from a feature-rich startup SaaS into a premium, trustworthy, agency-owner-ready homecare operating system.

The product must feel:

* premium
* calm
* fast
* trustworthy
* healthcare-grade
* compliance-aware
* agency-owner friendly
* caregiver friendly
* hard to replace

The goal is **not** to add random features. The goal is to make the existing platform feel polished, useful, believable, and ready to demo to real homecare agencies.

---

# 2. Product Positioning

RayHealthEVV™ should be positioned as:

> **The calm command center for Pennsylvania homecare agencies — scheduling, GPS EVV, compliance, billing readiness, caregiver training, and audit defense in one place.**

The product should help homecare agencies move away from:

* spreadsheets
* paper timesheets
* manual EVV cleanup
* missed clock-outs
* late visit discovery
* disconnected scheduling
* claim-denial surprises
* audit panic
* hard-to-use legacy tools
* HHAeXchange frustration

RayHealthEVV™ should feel like an operational command center for agency owners, administrators, schedulers, compliance officers, and caregivers.

---

# 3. Current Repo Context

The repo is expected to be a Turbo-managed npm workspace.

Likely structure:

* `packages/core`

  * domain entities
  * repositories
  * migrations
  * state strategy registry
  * aggregator integration contracts
  * compliance logic

* `packages/app`

  * Express REST API
  * authentication
  * capability RBAC
  * audit middleware
  * EVV routes
  * billing
  * learning
  * onboarding
  * command center
  * compliance engine
  * AI routes
  * import/export
  * documents
  * super admin

* `packages/web`

  * React + Vite app
  * public marketing site
  * admin portal
  * caregiver/family portal
  * compliance engine
  * audit
  * learning
  * onboarding
  * settings
  * super admin

* `packages/mobile`

  * Expo / React Native caregiver app
  * secure auth
  * schedule
  * GPS EVV
  * notifications
  * maps
  * haptics
  * clock-in / clock-out

Important correction:

If README or docs say the mobile app is **Capacitor**, correct it. The actual mobile app should be described as **Expo / React Native / Expo Router**, unless repo inspection proves otherwise.

---

# 4. Non-Negotiable Rules

All agents must follow these rules:

1. Preserve existing security architecture.
2. Preserve role-based routing.
3. Preserve agency scoping.
4. Preserve CSRF protection.
5. Preserve audit logging.
6. Preserve rate limiting.
7. Preserve secure mobile auth.
8. Do not put PHI in analytics.
9. Do not store browser sessions in `localStorage`.
10. Do not expose cross-agency data.
11. Do not create broad unauthenticated data endpoints.
12. Do not claim HIPAA certification.
13. Do not say "HIPAA certified."
14. Do not say real PHI is safe to onboard until operational controls are complete.
15. Do not invent customer logos.
16. Do not invent testimonials.
17. Do not invent denial-reduction numbers.
18. Do not overclaim compliance status.
19. Do not remove existing tests.
20. Do not perform giant unrelated refactors.
21. Prefer small, reviewable, high-impact changes.
22. Use existing project conventions.
23. Add tests for meaningful changes.
24. Keep UI premium, calm, and readable.
25. Use plain language that homecare owners understand.
26. Keep all generated docs authored by Durga Ghimeray.

---

# 5. HIPAA and Compliance Language Rules

Use honest language.

Allowed language:

* "HIPAA-ready architecture"
* "HIPAA operational readiness in progress"
* "designed with HIPAA-grade controls"
* "audit-ready architecture"
* "PHI-safe architecture planning"
* "BAA readiness roadmap"
* "operational HIPAA controls still required before real PHI onboarding"

Forbidden language:

* "HIPAA certified"
* "fully HIPAA compliant" unless all operational requirements are completed and legally verified
* "certified by HIPAA"
* "guaranteed compliance"
* "real PHI ready today" unless Durga explicitly confirms operational controls are complete
* fake compliance badges
* fake customer logos
* fake agency testimonials

Always be honest that operational HIPAA readiness may require:

* signed BAAs
* HIPAA-mode database / compliant hosting
* formal risk analysis
* penetration testing
* cyber-liability insurance
* incident response plan
* disaster recovery / backup policy
* workforce access policy
* subprocessor review
* production monitoring
* logging policy
* data retention policy

---

# 6. Model Assignment Strategy

Use models by task complexity to save tokens.

## Fable 5

Use Fable 5 only for the highest-value reasoning work.

Use Fable 5 for:

* executive product architecture
* final product judgment
* compliance-sensitive planning
* security review
* audit packet architecture
* AI/PHI review
* cross-package architecture decisions
* final "is this ready for real agencies?" review

Do not use Fable 5 for:

* file discovery
* simple CSS edits
* routine React component cleanup
* formatting
* simple README fixes
* basic test writing
* repeated summaries
* file listing

Fable 5 is the **executive architect and final judge**, not the everyday implementation worker.

## Opus-Level Model

Use Opus-level model for:

* hard backend planning
* complex debugging
* compliance-sensitive backend logic
* cross-package reasoning
* deep architecture decisions
* security-sensitive design

## Sonnet-Level Model

Use Sonnet-level model for:

* most implementation
* React/Vite UI work
* Expo mobile UI work
* CSS and design system work
* API route implementation
* tests
* component refactors
* landing page implementation

## Haiku-Level Model

Use Haiku-level model for:

* repo scanning
* file maps
* summaries
* TODO inventories
* repeated pattern discovery
* simple docs cleanup
* locating duplicate styles
* listing routes/components

Working rule:

> **Haiku finds. Sonnet builds. Opus solves. Fable 5 judges and architects.**

---

# 7. Token-Saving Rules

Do not let every agent reread the whole repo.

Each agent should read:

1. Repo Scout report
2. previous relevant agent report
3. only the files needed for its task

Fable 5 should only read:

* Repo Scout report
* product strategy report
* relevant changed files
* security-sensitive files
* final implementation report

Do not use Fable 5 to repeatedly scan the whole repository unless absolutely necessary.

---

# 8. Execution Order

Run agents in this exact order:

1. **Agent 01 — Repo Scout** — Model: Haiku-level
2. **Agent 00 — Fable 5 Executive Architect** — Model: Fable 5
3. **Agent 02 — Product Strategist** — Model: Fable 5 preferred, Opus-level acceptable
4. **Agent 03 — Design System Architect** — Model: Sonnet-level
5. **Agent 04 — Landing Page Conversion Designer** — Model: Sonnet-level
6. **Agent 05 — Admin Command Center Builder** — Model: Sonnet-level
7. **Agent 07 — Trust Center Builder** — Model: Sonnet-level with Fable 5 review
8. **Agent 06 — EVV Audit Packet Architect and Engineer** — Model: Fable 5 for planning, Sonnet-level for implementation
9. **Agent 08 — Mobile Caregiver UX Specialist** — Model: Sonnet-level
10. **Agent 09 — Compliance and Security Reviewer** — Model: Fable 5 preferred, Opus-level acceptable
11. **Agent 10 — QA and Test Engineer** — Model: Sonnet-level
12. **Agent 11 — Fable 5 Final Product Judge** — Model: Fable 5

---

_(Full agent briefs 01–11, sidebar cleanup, prioritized features, copy/UI direction, quality gate, and report formats are as specified in the master brief provided by Durga Ghimeray.)_

---

# 27. Starting Instruction

Begin with **Agent 01 — Repo Scout** only.

Do not code yet.

Create:

`docs/agent-reports/01-repo-scout.md`

The report must be concise, specific, and include:

**Authored by Durga Ghimeray**

After Agent 01 finishes, stop and wait for instruction to continue with Agent 00.

Do not skip ahead.
