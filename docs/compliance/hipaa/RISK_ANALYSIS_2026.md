# RayHealth EVV — Annual HIPAA Security Rule Risk Analysis

**Document version:** 1.0
**Analysis period:** 2026-05 → 2027-05
**Date conducted:** 2026-05-11
**Conducted by:** Durga Ghimeray, Founder & Security Officer, RayHealth EVV
**Reviewed by:** _____________________ (counter-signature)
**Next scheduled review:** 2027-05-11 (or within 30 days of any material architecture change)
**Controlling regulation:** 45 CFR §164.308(a)(1)(ii)(A) — Risk Analysis (Required)
**Companion documents:** SECURITY_POLICY.md, INCIDENT_RESPONSE.md, DATA_RETENTION.md, ENCRYPTION_VERIFICATION.md, BAA_REQUEST_EMAILS.md

---

## 1. Purpose & scope

This document is the annual risk analysis required by 45 CFR §164.308(a)(1)(ii)(A). It satisfies the HHS guidance that covered entities and business associates "conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of electronic protected health information held by the covered entity or business associate."

**Scope of this analysis:** the production RayHealth EVV platform — caregiver mobile app (Capacitor iOS/Android), web admin (Vercel), backend API (`rayhealth-evv-platform`), Neon Postgres database (`late-art-87716813`), AWS Bedrock for in-app support, Resend for transactional email, Firebase for push notifications. Public marketing pages and synthetic-data sandboxes are out of scope per SECURITY_POLICY.md §1.

**Methodology:** NIST SP 800-30 Rev. 1 — Guide for Conducting Risk Assessments, adapted for a small-team SaaS business associate.

---

## 2. Risk-rating matrix

| Likelihood ↓ / Impact → | **Low** | **Moderate** | **High** | **Critical** |
|---|---|---|---|---|
| **Rare** (≤ 1× per 5y) | Low | Low | Moderate | High |
| **Unlikely** (≤ 1× per 2y) | Low | Moderate | High | High |
| **Possible** (≤ 1× per year) | Moderate | Moderate | High | Critical |
| **Likely** (multiple/yr) | Moderate | High | Critical | Critical |
| **Almost certain** | High | Critical | Critical | Critical |

Impact bands:
- **Low:** internal-only, no PHI exposure, no regulatory reporting required.
- **Moderate:** small PHI exposure (< 50 records), no media-grade incident, recoverable in < 24h.
- **High:** PHI exposure 50 – 500 records, HHS notification window triggered (60 days), agency BAA notification required, possible media coverage.
- **Critical:** PHI exposure > 500 records (HHS public posting required per §164.408), regulatory action probable, contractual termination probable, business-existence-threatening.

---

## 3. Asset inventory

| Asset ID | System | PHI? | Tier |
|---|---|---|---|
| A-01 | Caregiver mobile app (Capacitor) | Yes — visit data, client name, GPS | Front-end |
| A-02 | Web admin (Vercel, React/Vite) | Yes — full platform PHI | Front-end |
| A-03 | Backend API (`rayhealth-evv-platform`, Node/Hono on Vercel) | Yes — passes through all PHI | Server |
| A-04 | Neon Postgres (`late-art-87716813`) | Yes — primary data store | Data |
| A-05 | AWS Bedrock (Claude Haiku 3.5) | Conditional — only if user pastes PHI into chat | Server |
| A-06 | Resend (transactional email) | Conditional — verification/invite codes only | Server |
| A-07 | Firebase Cloud Messaging | No — device tokens only, no PHI in payload | Server |
| A-08 | Mobile secure storage (Keychain / Keystore via Capacitor) | Yes — session tokens | Front-end |
| A-09 | Vercel deployment platform | Yes — hosts A-02 and A-03 | Platform |
| A-10 | GitHub source repos (`rayhealth-evv-platform`, `rayhealth-evv-mobile`, `rayhealthevv-fresh`) | No — code, no PHI committed | Build |
| A-11 | Audit event log (`audit_events` table in A-04) | Yes — references PHI by ID | Data |

---

## 4. Threat / vulnerability / risk register

Each row is a discrete, individually-trackable risk. ID is stable across annual reviews. **Residual rating** is after the **current** mitigations listed; **target rating** is what we expect after the planned remediation.

### R-01 — Neon HIPAA mode not enabled on production project
- **Asset(s):** A-04
- **Threat:** Postgres data plane is operated under Neon's standard SOC 2 controls only; no signed BAA, no HIPAA-mode encryption posture (per-tenant encryption keys, audit logging, breach-notification SLA).
- **Vulnerability:** Real PHI cannot lawfully be stored on a non-HIPAA Neon project. Today only synthetic fixtures live there; this is enforced by the seed-script guard (`packages/core/scripts/seed-app-store-fixture.ts`) but a misconfigured agency onboarding could write real PHI.
- **Likelihood:** Possible (until HIPAA mode is enabled)
- **Impact:** Critical (BAA gap + every PHI record exposed)
- **Inherent rating:** Critical
- **Current mitigations:** Production traffic is restricted to fixture caregiver only; no agency has been onboarded to the prod default branch; seed script prod-guard refuses non-Neon-branch targets.
- **Residual rating:** **High** (blocked by onboarding refusal)
- **Target rating:** Low (after HIPAA mode + signed BAA)
- **Owner action:** Enable HIPAA mode on Neon project `late-art-87716813` and execute Neon BAA. **Tracked: RELEASE_PREP_GAPS.md CRIT.**
- **Status:** OPEN — owner action

### R-02 — Test fixtures resident in production default branch
- **Asset(s):** A-04
- **Threat:** Synthetic fixture rows (caregiver `0000…0002`, client `0000…0001`, plus visit_template, assignment, evv_visits) currently live on Neon project default branch instead of a dedicated `app-store-screenshots` branch.
- **Vulnerability:** A fixture row + a future onboarded agency on the same default branch could co-mingle in production reports unless gated by an email-domain filter.
- **Likelihood:** Unlikely (no agency onboarded yet)
- **Impact:** Moderate (data-quality issue, not PHI exposure — fixtures are synthetic)
- **Inherent rating:** Moderate
- **Current mitigations:** Fixtures use a clearly-marked `.local` domain; seed script is idempotent and prod-guarded going forward.
- **Residual rating:** **Moderate**
- **Target rating:** Low
- **Owner action:** Move fixtures to a Neon branch named `app-store-screenshots`. **Tracked: RELEASE_PREP_GAPS.md CRIT.**
- **Status:** OPEN — owner action

### R-03 — Vercel BAA gap
- **Asset(s):** A-09, A-02, A-03
- **Threat:** Vercel does not sign a BAA on the Pro plan; Enterprise is required. Production currently runs on Pro.
- **Vulnerability:** Every request and response passes through Vercel edge/serverless, including PHI. Without a BAA, this is a regulatory gap.
- **Likelihood:** Almost certain (every PHI request)
- **Impact:** High (regulatory enforcement; agency BAAs require subprocessor BAAs)
- **Inherent rating:** Critical
- **Current mitigations:** No real PHI in production yet; only synthetic fixtures.
- **Residual rating:** **High**
- **Target rating:** Low (after Vercel Enterprise BAA OR moving the API to a BAA-compliant runtime such as AWS Fargate behind CloudFront).
- **Owner action:** Decide between (a) Vercel Enterprise BAA or (b) migrate `packages/app` backend off Vercel. BAA request template ready in BAA_REQUEST_EMAILS.md.
- **Status:** OPEN — owner action

### R-04 — Outstanding BAAs (AWS Bedrock, Neon, Resend, Firebase)
- **Asset(s):** A-04, A-05, A-06, A-07
- **Threat:** Subprocessors that touch PHI or PHI-adjacent data require signed BAAs before real PHI flows.
- **Vulnerability:** No BAAs are signed today. AWS Bedrock requires the standard AWS BAA; Neon requires HIPAA-mode upgrade first; Resend depends on whether email content includes PHI (today: only auth verification codes); Firebase only routes device tokens (no PHI payload) — BAA optional.
- **Likelihood:** Almost certain (without BAAs)
- **Impact:** High
- **Inherent rating:** Critical
- **Current mitigations:** Production fixture-only; AWS Bedrock support chat is currently used for "hi"-style smoke testing, no PHI prompts.
- **Residual rating:** **High**
- **Target rating:** Low (after all four BAAs)
- **Owner action:** Send the four BAA request emails from BAA_REQUEST_EMAILS.md.
- **Status:** OPEN — owner action

### R-05 — Vercel `npm install` deploy timeout (availability)
- **Asset(s):** A-02, A-03
- **Threat:** `vercel.json` `installCommand` previously used pnpm/turbo `--filter=` syntax which npm silently ignores. Result: every deploy attempted to install all 700+ monorepo packages and timed out at 120 s.
- **Vulnerability:** Inability to deploy = inability to patch a vulnerability quickly. Direct availability + integrity risk.
- **Likelihood:** Almost certain (every deploy)
- **Impact:** Moderate (delays patches; not a direct PHI exposure)
- **Inherent rating:** High
- **Current mitigations:** Fixed in this commit cycle — `installCommand` now uses correct `npm ci --workspace=` syntax, `buildCommand` calls `npx turbo run` directly, added `ignoreCommand` to skip deploys that only touch mobile/docs.
- **Residual rating:** **Low**
- **Target rating:** Low
- **Owner action:** Verify next deploy completes in under 90 s.
- **Status:** **MITIGATED — pending verification**

### R-06 — Mobile token storage (historical)
- **Asset(s):** A-01, A-08
- **Threat:** Mobile auth token theft via filesystem-level attacker (jailbroken device, malware with filesystem access).
- **Vulnerability:** Original implementation stored tokens in `@capacitor/preferences` which is plaintext `UserDefaults` on iOS and plaintext `SharedPreferences` on Android.
- **Likelihood:** Unlikely (filesystem-level attacker required)
- **Impact:** High (per-caregiver PHI access until token expiry)
- **Inherent rating:** High
- **Current mitigations:** Migrated to `@aparajita/capacitor-secure-storage` (iOS Keychain / Android Keystore). Verified live 2026-05-09.
- **Residual rating:** **Low**
- **Target rating:** Low
- **Owner action:** None — keep verified post-upgrade.
- **Status:** **CLOSED**

### R-07 — Web session theft via XSS (historical)
- **Asset(s):** A-02
- **Threat:** Cross-site scripting attacker reads auth token from `localStorage` and exfiltrates it.
- **Vulnerability:** Original web implementation kept a bearer token in `localStorage`.
- **Likelihood:** Possible (single XSS vector = full account takeover)
- **Impact:** High
- **Inherent rating:** Critical
- **Current mitigations:** Migrated to HttpOnly `rayhealth_session` cookie with CSRF token (Security Phase 1 commits `0c55581`, `f526abd`). Added security-surface regression scan (`scripts/security-surface-scan.ts`) that fails CI if `rayhealth_token` or `localStorage.setItem('rayhealth_…')` patterns reappear.
- **Residual rating:** **Low**
- **Target rating:** Low
- **Owner action:** None — keep `npm run security:scan` in CI.
- **Status:** **CLOSED**

### R-08 — Audit log retention growth
- **Asset(s):** A-11
- **Threat:** `audit_events` table is append-only by trigger but has no retention/archival sweep. Per DATA_RETENTION.md the floor is 6 years; today the table grows unbounded.
- **Vulnerability:** Cost growth + slow query performance after multi-year usage. Not a confidentiality risk — an availability/cost risk.
- **Likelihood:** Almost certain (over multi-year horizon)
- **Impact:** Low (recoverable; not a breach)
- **Inherent rating:** Moderate
- **Current mitigations:** Audit retention status endpoint (`GET /api/admin/audit-retention/status`) makes the gap visible to admins. Archival sweep designed and ready to land (this work item — `docs/compliance/hipaa/AUDIT_RETENTION_SWEEP.md`).
- **Residual rating:** **Moderate**
- **Target rating:** Low (after sweep cron runs nightly)
- **Owner action:** Land the sweep in `rayhealth-evv-platform`.
- **Status:** OPEN — pending platform-repo deploy

### R-09 — Offline visit-action queue silently dropping clock-ins (historical)
- **Asset(s):** A-01
- **Threat:** Caregiver clocks in/out without network → API call fails → app silently moves on. Visit data is lost; aggregator submission fails downstream; agency cannot bill for the visit.
- **Vulnerability:** No offline queue in the original mobile build.
- **Likelihood:** Possible (rural caregivers, basement units)
- **Impact:** Moderate (data-integrity + revenue, not confidentiality)
- **Inherent rating:** High
- **Current mitigations:** `src/services/visit-offline-queue.ts` (mobile commit `b08ed82`). FIFO drain on `online` event + on app foreground.
- **Residual rating:** **Low**
- **Target rating:** Low
- **Owner action:** Real-device coverage for the offline queue (HIGH item in RELEASE_PREP_GAPS).
- **Status:** **MITIGATED — pending real-device coverage**

### R-10 — Geofence bypass / fake GPS
- **Asset(s):** A-01, A-03
- **Threat:** Caregiver uses a mock-location app to clock in from outside the actual visit address.
- **Vulnerability:** Capacitor Geolocation does not detect mock-location providers without native plugin overrides.
- **Likelihood:** Unlikely (requires intent + technical knowledge)
- **Impact:** Moderate (Medicaid fraud risk; not PHI exposure)
- **Inherent rating:** Moderate
- **Current mitigations:** Server-side geofence enforcement returns `422 GEOFENCE_OUT_OF_BOUNDS`; visit metadata persists the GPS reading for audit; 150 m geofence; audit_events row written on every clock-in attempt.
- **Residual rating:** **Moderate**
- **Target rating:** Moderate (acceptable — defense in depth via aggregator audit, not detection at app layer)
- **Owner action:** Add a mock-location detector (`@capacitor-community/mock-location`) if PA DHS audit ever flags this.
- **Status:** ACCEPTED — risk is within tolerance for pilot

### R-11 — Aggregator submission missing (Sandata / PROMISe)
- **Asset(s):** A-03
- **Threat:** Visits cannot be transmitted to PA DHS, blocking Medicaid Assistance billing for agencies that need MA billing.
- **Vulnerability:** Skeleton CSV export exists at `/api/exports/sandata.csv` but Provider ID / Worker ID / HCPCS mapping is not wired in.
- **Likelihood:** Almost certain (every agency that needs MA billing)
- **Impact:** Moderate (revenue blocker, not PHI exposure)
- **Inherent rating:** High
- **Current mitigations:** Mapping config schema designed in this cycle (see `packages/app/src/services/sandata-mapping.ts`). Agency fills a single config file.
- **Residual rating:** **Moderate**
- **Target rating:** Low (after first agency onboards a Provider ID and a real export is reconciled with Sandata's portal).
- **Owner action:** First pilot agency onboarding gets the config file and a test transmission.
- **Status:** **DESIGNED — pending first-agency onboarding**

### R-12 — Cyber liability insurance gap
- **Asset(s):** Business entity
- **Threat:** A breach without insurance leaves the company personally exposed to defense costs, notification costs ($1–5 per record), and forensic investigation costs (~$50–250k for a small platform).
- **Vulnerability:** No policy in force.
- **Likelihood:** Possible (any breach trips this)
- **Impact:** Critical (existential)
- **Inherent rating:** Critical
- **Current mitigations:** None.
- **Residual rating:** **High**
- **Target rating:** Low (after policy with HIPAA-breach rider)
- **Owner action:** Bind a policy. Hiscox, Coalition, Embroker quote at ~$1.5–4k/year for a small healthcare SaaS at pilot scale.
- **Status:** OPEN — owner action

### R-13 — No third-party penetration test on record
- **Asset(s):** A-02, A-03, A-04
- **Threat:** Latent vulnerabilities (auth flaws, IDOR, injection) that our own review and CI scanners missed.
- **Vulnerability:** Untested attack surface.
- **Likelihood:** Possible (any moderately complex codebase has them)
- **Impact:** High (depends on what they find; could be Critical)
- **Inherent rating:** High
- **Current mitigations:** Security regression scan (`security:scan`), HttpOnly cookie sessions, CSRF middleware, parameterized queries via Knex, no string-concat SQL, structured audit logging.
- **Residual rating:** **Moderate**
- **Target rating:** Low (after pen test + remediation of findings)
- **Owner action:** Engage a HIPAA-aware pen test firm (~$8–15k, one-week engagement).
- **Status:** OPEN — owner action

### R-14 — Phishing / credential compromise of Founder account
- **Asset(s):** Founder admin access (all assets)
- **Threat:** Targeted phishing → Founder credentials stolen → full platform compromise.
- **Vulnerability:** Single admin identity.
- **Likelihood:** Possible
- **Impact:** Critical (single point of compromise)
- **Inherent rating:** Critical
- **Current mitigations:** Email account uses Google Workspace 2FA. Vercel, Neon, AWS Bedrock, Resend, Firebase consoles all use SSO with Google + 2FA. Production secrets are in Vercel env-vars (not committed). Passwords are stored in a password manager.
- **Residual rating:** **Moderate**
- **Target rating:** Moderate (acceptable for a single-founder pilot)
- **Owner action:** Add a hardware security key (YubiKey) as second factor on Google, AWS, GitHub, Vercel. Quarterly review of authorized devices.
- **Status:** PARTIAL — recommend YubiKey addition

### R-15 — Workforce expansion without documented access list
- **Asset(s):** Founder + future contractors
- **Threat:** First contractor or hire gets PHI access without documented authorization.
- **Vulnerability:** `WORKFORCE_ACCESS.md` referenced in SECURITY_POLICY.md §2 does not yet exist.
- **Likelihood:** Possible (first hire is a high-probability event)
- **Impact:** Moderate
- **Inherent rating:** Moderate
- **Current mitigations:** Single-founder team today.
- **Residual rating:** **Low** (until first hire)
- **Target rating:** Low (after WORKFORCE_ACCESS.md is created at first hire)
- **Owner action:** Create WORKFORCE_ACCESS.md before onboarding any contractor with PHI access. Each entry: name, role, granted-on date, scope, training-date.
- **Status:** OPEN — trigger on first hire

---

## 5. Summary of residual ratings

| Residual rating | Count | Risk IDs |
|---|---|---|
| Critical | 0 | — |
| High | 4 | R-01, R-03, R-04, R-12 |
| Moderate | 4 | R-02, R-08, R-10, R-14 |
| Low | 5 | R-05, R-06, R-07, R-09, R-15 |
| Closed | 2 | R-06, R-07 (also counted in Low) |

**Aggregate posture (pre-pilot):** Moderate. Acceptable to operate with synthetic data and pre-pilot agencies under design partnerships. **Not yet acceptable** to onboard a real Medicaid-billing agency with live PHI. Gating items: R-01, R-03, R-04, R-12.

---

## 6. Remediation roadmap & target dates

| Risk | Action | Target | Owner |
|---|---|---|---|
| R-01 | Enable Neon HIPAA mode + sign BAA | Before first real agency onboards | Founder |
| R-02 | Move fixtures to `app-store-screenshots` Neon branch | Before App Store submission | Founder |
| R-03 | Decide Vercel Enterprise BAA vs. backend migration | Before first real agency onboards | Founder |
| R-04 | Execute AWS, Resend, Firebase BAAs | Before first real agency onboards | Founder |
| R-05 | Verify Vercel deploy succeeds under 90 s | Next deploy | Founder |
| R-08 | Land audit retention sweep in platform repo | Q3 2026 | Founder + future eng |
| R-10 | Monitor; reconsider mock-location detection if DHS flags | As-needed | Founder |
| R-11 | First agency onboarding test transmission | At first pilot | Founder |
| R-12 | Bind cyber liability policy | Before first paid agency | Founder |
| R-13 | Engage HIPAA-aware pen test firm | Before first paid agency | Founder |
| R-14 | Add YubiKey 2FA on top-tier accounts | Q3 2026 | Founder |
| R-15 | Create WORKFORCE_ACCESS.md | At first hire | Founder |

---

## 7. Attestation

I attest that I conducted this risk analysis in good faith, that the asset inventory is complete to the best of my knowledge, that each risk has been evaluated for likelihood and impact, and that the residual ratings reflect mitigations actually in place at the date of this document — not aspirational controls.

**Signed:** _______________________________
**Print name:** Durga Ghimeray
**Title:** Founder & Security Officer, RayHealth EVV
**Date:** 2026-05-11

---

## 8. Review log

| Date | Reviewer | Summary of changes |
|---|---|---|
| 2026-05-11 | Durga Ghimeray | Initial annual risk analysis. Establishes 15-risk register, NIST SP 800-30 methodology, remediation roadmap. |

---

## 9. Reference

- **45 CFR §164.308(a)(1)(ii)(A)** — Risk Analysis (Required)
- **45 CFR §164.316(b)(2)** — Time limit on documentation (6 years from creation or last effective date, whichever is later)
- **NIST SP 800-30 Rev. 1** — Guide for Conducting Risk Assessments
- **HHS Risk Analysis Guidance** — Office for Civil Rights, "Guidance on Risk Analysis Requirements under the HIPAA Security Rule"

This document must be retained for 6 years from the date it is superseded by the next annual review.
