# Deploy this session's work — runbook

**Prepared:** 2026-05-12 (rev 5 — GitHub-only canonical remote)
**Scope of session 6:** security hardening (helmet, JWT HS256 pinning, default + per-route rate limits, body size cap, CORS fail-closed in prod, sameSite=strict cookies) + `.github/` governance scaffold (branch + tag rulesets, CI workflow with 6 required status checks, CodeQL, dependency-review, gitleaks) + doc consolidation + Bitbucket removal.
**Test totals:** 197 (74 core / 109 app / 14 web) · typecheck clean · lint clean · security:scan clean

This is the **shortest path** from `main` on your Mac to a live deploy at `rayhealthevv.com`. Every command runs on your machine.

---

## 0. Pre-flight from your terminal (60 seconds)

```bash
cd "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"
npm run lint && npm run typecheck && npm run security:scan
(cd packages/core && npx vitest run)
(cd packages/app && npx vitest run)
(cd packages/web && npx vitest run)
```

If anything is red, stop. Last known-good run: **all green, 197/197 tests.**

---

## 1. GitHub auth (one-time)

Vercel is wired to `github.com/durga710/rayhealth-evv-platform` on the Hobby plan. We push directly to GitHub — no Bitbucket detour.

```bash
brew install gh
gh auth login        # GitHub.com → HTTPS → Yes (authenticate Git) → Login with browser
gh auth setup-git    # ← critical: wires gh's stored token into git itself
gh auth status       # should say "Hi durga710!"
```

If you don't want to install `gh`, the no-install fallback is a Personal Access Token from https://github.com/settings/tokens (classic, scope `repo`). You paste the token as the password when git prompts.

---

## 2. Set / update production env vars in Vercel

https://vercel.com/dashboard → RayHealth project → Settings → Environment Variables → Production.

| Variable | Value | Why |
|---|---|---|
| `DATABASE_URL` | rotated Neon URL — `postgres://…?sslmode=require` | Neon connection |
| `JWT_SECRET` | (existing) | Auth signing key |
| `ALLOWED_ORIGINS` | `https://rayhealthevv.com,capacitor://localhost` | CORS allowlist. The app refuses to boot in production if this is unset. |
| `GOOGLE_AI_API_KEY` | (existing if AI Copilot enabled) | Gemini key |
| `CRON_SECRET` | `$(openssl rand -hex 32)` | Audit-retention cron auth |
| `RESEND_API_KEY` | `re_…` from https://resend.com/api-keys | Caregiver invite emails |
| `RESEND_FROM_ADDRESS` | `RayHealth EVV <noreply@send.rayhealthevv.com>` | Invite email From: |
| `RESEND_REPLY_TO` | `durga@rayhealthevv.com` | Invite email Reply-To: |
| `APP_BASE_URL` | `https://rayhealthevv.com` | Used in invite acceptance links |
| `NODE_ENV` | `production` | Triggers helmet HSTS, secure cookies, CORS fail-closed, rate-limit enforcement |

If `RESEND_API_KEY` isn't set, the invite flow degrades to copy-link (existing behavior). Before invite emails actually deliver, verify the sender domain `send.rayhealthevv.com` at https://resend.com/domains.

---

## 3. Push the session 6 work to GitHub

```bash
bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/sync-session6-to-github.sh"
```

This script:
1. Ensures `/tmp/rayhealth-combined` has the `github` remote pointed at the right URL.
2. Resets local `main` to track `github/main`.
3. Rsyncs every changed file from your Desktop workspace.
4. Deletes the 15 stale handoff docs + Bitbucket-only sync scripts (their content lives at `docs/handoffs-archive/` and `scripts/archive/`).
5. Stages, commits with the full session-6 message.
6. Pushes to `github/main` with `--force-with-lease` (safe overwrite).

Vercel auto-triggers a production deploy from the push. Watch at https://vercel.com/dashboard → RayHealth → Deployments.

---

## 4. Apply the 8 Neon migrations

```bash
bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/run-migrations-prompted.sh"
```

Hidden prompt for the rotated Neon URL. Expected output is JSON with `"ok": true` and 9 steps `"status": "ok"`.

If you get a connection failure, run the diagnostic first:

```bash
bash "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/scripts/neon-connection-test.sh"
```

It does a 10-second `SELECT 1` probe with clear failure-cause hints (cold start, `channel_binding=require` quirk, missing `sslmode`, Pooled toggle off).

---

## 5. Apply the GitHub branch protection rulesets (one-time)

After the push lands and CI has shown a green run on `main`, lock the branch down:

```bash
cd "/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh"

gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/durga710/rayhealth-evv-platform/rulesets \
  --input .github/rulesets/main-branch-protection.json

gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/durga710/rayhealth-evv-platform/rulesets \
  --input .github/rulesets/tags-protection.json
```

After these activate:
- `main` cannot be deleted or force-pushed
- All PRs require 1 code-owner approval, dismiss stale reviews on push, require last-push approval, require thread resolution
- All 6 CI checks (typecheck, lint, security-scan, test-core, test-app, test-web) must pass strictly before merge
- Linear history (squash or rebase only)
- Conventional Commits enforced via commit-message regex
- All tags immutable (no deletion, force-push, or update)
- No bypass actors — even the owner uses PRs

Verify with: `gh api /repos/durga710/rayhealth-evv-platform/rulesets`

---

## 6. Smoke test the live site

```bash
# 1. Health check
curl -s https://rayhealthevv.com/api/healthz

# 2. Security headers present (should see strict-transport-security, x-frame-options: DENY, content-security-policy, etc.)
curl -sI https://rayhealthevv.com/api/healthz

# 3. Fixture caregiver login still works (regression)
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"email":"test-caregiver-fixture@rayhealthevv.local","password":"TestCaregiver2026!"}' \
  https://rayhealthevv.com/api/auth/mobile/login

# 4. JWT alg lockdown — a token forged with alg=none should be rejected with 401
TOKEN_NONE='eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJoYWNrZXIifQ.'
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $TOKEN_NONE" \
  https://rayhealthevv.com/api/agencies/current
# expect: 401

# 5. Rate limit — invite acceptance should 429 after 20 requests in a 15-min window
for i in {1..25}; do
  curl -s -o /dev/null -w '%{http_code} ' https://rayhealthevv.com/api/invites/accept/fake-token
done
# expect: a stream of 404s followed by 429s

# 6. New admin surfaces (after signing in)
open https://rayhealthevv.com/admin/settings              # Sandata + HHAeXchange admin
open https://rayhealthevv.com/admin/corrections           # VMUR review queue
open https://rayhealthevv.com/admin/corrections/tracking  # VMUR history

# 7. Public invite acceptance page (replace TOKEN with one from staff_invites)
open https://rayhealthevv.com/accept/TOKEN
```

---

## 7. Reminders that don't block deploy

- **HIPAA mode on Neon** — still deferred to "last stage" per your call. Don't onboard real PHI until that flip happens.
- **BAA emails** — see `docs/compliance/hipaa/BAA_REQUEST_EMAILS.md` for Vercel/Neon/Resend/Google.
- **Bitbucket** — dropped. No remote, no app passwords, no team workspace.
- **Mobile deep-link** — the `/accept/<token>` route only works in the web browser today. The Capacitor app side is Google AI's lane.
- **PA DHS reason-code list** — verify the live list against the current Sandata Provider Spec before the first agency's first production submission.
- **`.mts` serverless entrypoints** — directive requires this; still not implemented. Architectural refactor for a later session.

---

## What landed in this session (rev 5 / session 6)

- **Security hardening** — closed every High/Medium finding from a senior-cybersecurity review of the session 5 surface (helmet, JWT HS256 pinning, body size cap, default + per-route rate limits, CORS fail-closed in prod, sameSite=strict cookies, security-surface-scan regex tightened).
- **Migration script resilience** — 15s connection timeouts, SELECT 1 probe with actionable hints, unhandledRejection handler that filters benign tarn aborts on destroy so successful runs print their JSON.
- **`.github/` governance** — CI workflow (6 required status checks), CodeQL, dependency-review, gitleaks secret scan, branch + tag rulesets, CODEOWNERS, PR + issue templates.
- **Docs** — `SECURITY.md` disclosure policy, README rewritten (was stale "Legal Templates" boilerplate), `DEPLOY_NOW.md` simplified to a single GitHub-only path.
- **Consolidation** — 7 stale handoff docs archived to `docs/handoffs-archive/`; 10 one-shot Bitbucket sync scripts archived to `scripts/archive/`. Active scripts trimmed to 6: `check.sh`, `deploy.sh`, `neon-connection-test.sh`, `run-migrations-prompted.sh`, `sync-session5-to-github.sh`, `sync-session6-to-github.sh`.
- **Credential cleanup** — a Bitbucket app password committed to `NEXT_STEPS.md` was redacted; the credential itself should be revoked at https://bitbucket.org/account/settings/app-passwords/ (and all Bitbucket app passwords revoked, since the platform is GitHub-only now).
