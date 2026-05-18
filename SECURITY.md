# Security policy

RayHealth EVV processes data on behalf of home-care agencies, including identifiers that — once real-agency onboarding begins — qualify as Protected Health Information (PHI) under HIPAA. We take security disclosures seriously and respond to every reported issue.

## Reporting a vulnerability

**Do not file a public GitHub issue or open a public pull request for security problems.** Public disclosure of an unpatched vulnerability puts every connected agency, caregiver, and family member at risk.

Preferred channel — **GitHub private advisory:**

https://github.com/durga710/rayhealth-evv-platform/security/advisories/new

Use this for anything that could be exploited: authentication bypass, broken access control, injection (SQL, command, prompt), cross-site scripting, deserialization, server-side request forgery, audit-trail tampering, PHI exposure, credential leakage in logs or responses, dependency CVEs that affect us, supply-chain compromise, or unsafe defaults.

Fallback if you cannot use a private advisory — **email:**

`durga@rayhealthevv.com` — encrypt with the PGP key published at https://rayhealthevv.com/.well-known/pgp.asc when available. If no PGP key is published yet, send a plain-text email with the subject `[SECURITY]` and we will follow up with a secure channel.

## What to include

- A clear, reproducible description (or proof-of-concept) of the issue
- The affected version or commit SHA — `git rev-parse HEAD` from your working tree
- The expected impact (data exposure, integrity, availability, compliance)
- Any suggested mitigation, if you have one
- Your preferred name + contact for credit (or "anonymous")

**Do not include real PHI** in the report. If you've stumbled across an exposed dataset, describe the location and shape, do not download or attach it.

## Our response timeline

| Step | Target |
|---|---|
| Acknowledge receipt | Within 1 business day |
| Triage + severity assessment | Within 3 business days |
| Status update | Weekly until resolved |
| Critical / Severity-1 fix in production | Within 7 days of confirmation |
| High / Severity-2 fix | Within 30 days |
| Medium / Low | Best-effort, scheduled into normal release cadence |

We will keep you informed at each step and coordinate on a public disclosure timeline. Default: 90 days from acknowledgment, or sooner if a fix is shipped and patched users have had reasonable time to update.

## Scope

### In scope

- The hosted application at https://rayhealthevv.com and any subdomains
- The API surface (every route under `/api`, including unauthenticated routes like `/api/invites/accept/:token`)
- The mobile Capacitor app shipped to the App Store / Play Store
- Source code in this repository
- Build, CI, and deploy pipelines defined in `.github/workflows/`
- Database migrations and the audit-trail integrity model

### Out of scope

- Social engineering of RayHealth staff
- Physical attacks against any host or device
- DoS / DDoS testing (we do not authorize load testing against production)
- Reports from automated scanners without manual validation
- Self-XSS or attacks requiring an attacker-controlled browser extension
- Reports about software outside our control (Vercel, Neon, AWS SES, Google AI, AWS Bedrock) — report those directly to the provider

## HIPAA-aligned operational posture

We track the security controls expected of a HIPAA Business Associate, even ahead of formal BAA execution with every subprocessor. Notable practices:

- **Audit immutability** — `audit_events` is append-only at the database level via the `audit_events_block_mutation_trg` trigger. Retention sweep bypasses this trigger inside a single transaction with `SET LOCAL session_replication_role = 'replica'` and is itself audited in `audit_retention_runs`.
- **Encryption in transit** — TLS enforced end-to-end; `sslmode=require` on Neon connections; HTTPS on the application surface.
- **Encryption at rest** — provided by Neon (Postgres) and Vercel (filesystem); CMEK migration tracked in `docs/compliance/hipaa/RISK_ANALYSIS_2026.md`.
- **Authentication** — bcrypt cost-12 password hashes, HttpOnly cookie sessions with CSRF for web, JWT bearer with iOS Keychain / Android Keystore for mobile, no auth in browser `localStorage` (`scripts/security-surface-scan.ts` enforces this as a regression gate).
- **Rate limiting** — login endpoints capped at 10/15 min, public invite-acceptance capped at 20/15 min.
- **Least privilege** — capability-based RBAC, every authenticated route gates on a specific capability.
- **Input validation** — Zod schemas validate every untrusted boundary; database access is parameterized.
- **Audit retention** — configurable per-agency retention with archival before purge.
- **CI security gates** — typecheck, lint, security-surface-scan, dependency-review, CodeQL, gitleaks all run on every PR and block merge on failure.

## Email delivery (Amazon SES)

Staff-invite emails are delivered via Amazon SES using the `@aws-sdk/client-sesv2` SDK. The implementation in `packages/app/src/email/email-client.ts` never embeds session tokens or API keys in message bodies — only the time-limited, single-use invite URL is included.

**Operator action required before email actually sends:**

1. **Verify the sender domain in SES.** Add the DKIM CNAME + MAIL FROM MX/SPF + DMARC TXT records SES prescribes to the domain's DNS. The DKIM CNAMEs must be set to **DNS-only** (Cloudflare grey-cloud / proxy off) or DKIM signature verification will fail.
2. **Create an IAM user (or role) with `ses:SendEmail` permission only.** Do NOT reuse a root account or an admin user. The scoped IAM policy is:
   ```json
   { "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"], "Resource": "*" }] }
   ```
3. **Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the Vercel project env vars.** When either is unset, the invite API still works but falls back to the manual-copy flow (the admin shares the URL by hand). The response field `emailDelivery: 'not_configured'` tells the UI to show the copy-link fallback.
4. **Set `AWS_SES_REGION`** to the region where your domain is verified (must match the region prefix in the MX `feedback-smtp.<region>.amazonses.com` record).
5. **Set `EMAIL_FROM`** to a `Display Name <local@verified-domain>` value matching the verified domain.
6. **Set `INVITE_URL_BASE`** to the production origin so emails contain absolute URLs (e.g. `https://rayhealthevv.com`).
7. **Request production access.** SES starts every new account in sandbox mode (recipients must be verified identities, max 200/day). Submit the "Request production access" form in the SES Account dashboard before going to production. Approval is typically 24–48 hours.

**Residual risk — BAA required for HIPAA:** AWS provides a Business Associate Addendum (BAA) for HIPAA-eligible services including SES. The BAA is signed via AWS Artifact (accept the agreement in the AWS console). Until the BAA is accepted, invite emails should not contain PHI. The current template embeds only the recipient email address, the agency display name, the role, and the invite URL — none of which is PHI — but operators handling PHI must accept the BAA before going to production. This is tracked alongside the other subprocessor BAAs in `docs/compliance/hipaa/`.

**Audit trail:** every delivery attempt emits an `invite.email.sent` (with `messageId`) or `invite.email.failed` (with an error category, never the URL or token) audit event. The full invite URL is never written to stdout / Vercel logs.

## Coordinated disclosure credit

If you reported a valid issue and want public credit, we will:

1. Add you to the acknowledgments in the security advisory itself.
2. Add you (with permission) to a "Reporters" section in this file once the issue is patched and disclosed.

We do not currently operate a paid bounty program, but we recognize and thank every legitimate reporter.

## Reporters

Empty until we have something to acknowledge. Welcome to be first.

## Dependency audit posture

### Audit cadence

We run `npm audit --omit=dev` against the production dependency graph on a **weekly cadence** and after every dependency-touching PR. CI runs `npm audit --audit-level=high --omit=dev` on every PR via the dependency-review workflow and blocks merge on a new high or critical finding. The full `npm audit` (including dev tooling) is reviewed manually during the weekly cadence.

### Baseline before the 2026-05 remediation

`npm audit --omit=dev` on `main@e1d9970` reported **11 production advisories (6 high + 5 moderate)** across these transitive chains:

- High: `@vercel/node` → `path-to-regexp`, `undici`, `minimatch` (via `@vercel/python-analysis`, `@vercel/nft`)
- Moderate: `vite` → `esbuild`; `@vercel/static-config` → `ajv`; `@vercel/python-analysis` → `smol-toml`; `vite` itself (path-traversal in dev server)

The full `npm audit` (incl. dev) reported **13 advisories (6 high + 7 moderate)**.

### Current baseline (post-remediation, 2026-05)

| Severity | Production (`--omit=dev`) | Full graph |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Moderate | 0 | 2 (dev-only: vite + vitest) |
| Low | 0 | 0 |

### What the 2026-05 remediation PR resolved

Per-advisory disposition:

| Package | GHSA | Severity | Disposition |
|---|---|---|---|
| `path-to-regexp` (via `@vercel/node`) | GHSA-9wv6-86v2-598j | High | Override pinned to `^6.3.0` (fixed). API-compatible patch in same 6.x line. |
| `undici` (via `@vercel/node`) | GHSA-c76h-2ccp-4975, g9mf-h72j-4rw9, cxrh-j4jr-qwg3, 2mjp-6q6p-2qxm, vrm6-8vpv-qv8q, v9p9-hfj2-hcw8, 4992-7rv2-5pvq | High (×7) | Override pinned to `^6.24.0`. `@vercel/node` shipped 5.28.4; no in-line patch exists. Undici is only used by `@vercel/node`'s `dev-server.mjs` (local `vercel dev`), not by deployed serverless functions (which use Node's built-in `fetch`). |
| `minimatch` 10.x (via `@vercel/python-analysis`, `@vercel/nft`) | GHSA-3ppc-4f35-3m26, 7r86-cg39-jmmj, 23c5-xmqv-rm74 | High | Override pinned to `^10.2.3` (fixed). |
| `ajv` 8.x (via `@vercel/static-config`) | GHSA-2g4f-4pwh-qvx6 | Moderate | Override pinned to `^8.18.0` (fixed). |
| `smol-toml` (via `@vercel/python-analysis`) | GHSA-v3rj-xjv7-4jmq | Moderate | Override pinned to `^1.6.1` (fixed). |
| `esbuild` (via `vite`, `@vercel/node`) | GHSA-67mh-4wv8-2f99 | Moderate | Global override pinned to `^0.25.0` (fixed at 0.25.0). Dev-server-only issue. |
| `postcss` (via `@expo/metro-config`) | GHSA-qx2v-qp2m-jg93 | Moderate | Override pinned to `^8.5.10` (fixed). |
| `vite` (root, direct) | GHSA-4w7w-66w2-5vf9 | Moderate | Moved `vite` + `@vitejs/plugin-react` from `dependencies` to `devDependencies`. Vite is a build-time tool; it is never executed at production runtime on Vercel (Vercel runs the no-op echo build and serves pre-built static `packages/web/dist`). Relocating removes the advisory from the production audit. The advisory affects the dev server only (path traversal in optimized-deps `.map` handling). |

All overrides are listed in root `package.json` under `overrides`, scoped to the specific parent package so other consumers of the same transitive (e.g. expo's `undici@6.25.0`, jsdom's `undici@7.25.0`, eslint's `minimatch@3.x`) are unaffected.

### Residual risk

1. **`vite@5.4.21` in dev tooling (GHSA-4w7w-66w2-5vf9, moderate, dev-only).**
   - The vite path-traversal advisory has no patched version in the 5.x line; the first fix is `6.4.2`.
   - We deliberately stay on vite 5.x for the moment to avoid a major version bump that could destabilise the React 19 + `@vitejs/plugin-react` chain.
   - Mitigation: the advisory affects `vite dev` only. CI does not run `vite dev`. Developers running `vite dev` locally should not bind it to public interfaces.
   - Tracking: revisit vite 6 (or 7) upgrade in a follow-up PR once the React 19 plugin ecosystem on vite 6+ stabilises further.

2. **`vitest`'s embedded `vite@8.0.13`-as-dependency-of-`@vitest/mocker`.**
   - Appears in the full `npm audit` but not in `--omit=dev`. Test-runner-only. No deployment exposure.

### Re-audit commitment

- Weekly: maintainer runs `npm audit --omit=dev` and reviews any new advisory.
- Per-PR: CI enforces `npm audit --audit-level=high --omit=dev` and fails on regression.
- Quarterly: review whether vite (and any other temporarily-pinned transitive) has a clean path to upgrade.
