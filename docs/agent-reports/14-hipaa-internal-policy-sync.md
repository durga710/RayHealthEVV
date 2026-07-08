# Agent 14 - HIPAA Internal Policy Sync

**Authored by Durga Ghimeray**

## Scope

Continued the compliance-readiness sweep by aligning internal HIPAA policy
documents and example configuration with the production posture already
captured in recent evidence: Neon BAA active, HIPAA mode enabled, Bedrock on
Claude Haiku 4.5, and Vercel building from source.

## Changes Completed

- Updated `SECURITY_POLICY.md` to mark Neon as active under an executed BAA
  and HIPAA mode with pgAudit and encryption at rest.
- Updated the Bedrock subprocessor row to the current Claude Haiku 4.5 default
  model and AI-surface coverage.
- Replaced obsolete committed-`dist` deploy language with source-built Vercel
  deploy language.
- Expanded the audit-route summary so it reflects current PHI-bearing mobile,
  command-center, compliance, and billing reads.
- Replaced the Neon BAA request template with active-status tracking and annual
  re-verification steps.
- Updated encryption verification to describe Neon storage encryption under
  active BAA / HIPAA-mode posture while preserving the distinction between
  application-layer encryption and vendor-managed encryption.
- Updated `.env.example` so the documented Bedrock default matches code.

## Verification

- Stale wording sweep found no active old Neon-pending, committed-dist deploy,
  or legacy Bedrock-model defaults outside intentional history.
- `git diff --check` passed, with Windows LF-to-CRLF warnings only.

## Remaining

- Vercel, Google Firebase / Cloud, and Resend BAAs remain outstanding before
  real PHI onboarding.
- DB-backed cross-tenant tests still require a local Postgres service; this
  machine does not currently provide Docker, WSL, `psql`, or a listener on
  `localhost:5432`.
