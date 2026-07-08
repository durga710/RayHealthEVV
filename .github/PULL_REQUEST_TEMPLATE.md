# Pull request

## What changed and why

<!-- One paragraph. What's the problem this solves? Why now? -->

## Surface area

- [ ] Backend API routes
- [ ] Database migration
- [ ] Web admin UI
- [ ] Mobile Expo / React Native app
- [ ] AI Copilot prompts / executor
- [ ] EVV aggregator export pipeline (Sandata or HHAeXchange)
- [ ] Audit / compliance / HIPAA posture
- [ ] Build, CI, or scripts only

## Compliance + security checklist

Tick every box that applies. Leaving boxes unticked is fine — they're a forcing function, not a hurdle.

- [ ] No real PHI in fixtures, tests, logs, or audit payloads
- [ ] No secrets (API keys, DB URLs, JWT secrets) committed in any form
- [ ] New audit-event types are registered in `packages/core/src/domain/audit.ts`
- [ ] Inputs from untrusted sources are validated with Zod
- [ ] Database access is parameterized (no string-concat SQL)
- [ ] New routes have explicit capability checks (`requireCapability(...)`)
- [ ] Public/unauthenticated routes are rate-limited
- [ ] PII-equivalent fields are NOT logged at info level or above
- [ ] Migration is idempotent (`hasTable` / `hasColumn` guards) and includes a `down` path

## Test coverage

- [ ] Unit tests added or extended for new behavior
- [ ] Edge cases asserted: expired / revoked / already-used / cross-agency
- [ ] Negative tests: 400 / 401 / 403 / 409 / 422 paths each have at least one test

## Deploy notes

- [ ] No env var changes
- [ ] New env vars listed below (and added to Vercel before merge):
  - `EXAMPLE_VAR` —
- [ ] Migration required — name(s): ___
- [ ] Backwards-incompatible API change (breaks mobile / old web tabs)? If yes, describe rollout plan: ___

## Screenshots / curl output

<!-- Optional. Helpful for UI changes or new endpoints. -->

---

By opening this PR I confirm I've run locally:

```
npm run typecheck
npm run lint
npm run security:scan
npx vitest run   # in each package
```

…and they all pass on this branch.
