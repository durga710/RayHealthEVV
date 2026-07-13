# RayHealth EVV — Workforce Access Register

**Version:** 1.0
**Effective:** 2026-07-12
**Owner:** Privacy Officer / Security Officer
**Review cadence:** Quarterly and within 24 hours of a role change or departure

This is the Git-safe index for workforce access. Keep names, personal contact
details, console exports, recovery codes, and credentials in the private
compliance vault. Agencies manage their own workforce inside RayHealth; this
register covers RayHealth personnel and contractors with platform-level access.

## Current roles

| Record | Role | Approved scope | Start | End | Last review | Evidence ID |
|---|---|---|---|---|---|---|
| WA-001 | Founder; Privacy and Security Officer | GitHub administration; production deployment, database, AWS, Google/Firebase, email, DNS, and compliance-vault administration | 2026-05-09 | — | Pending first signed quarterly review | Pending |

No additional RayHealth workforce member or contractor is documented as
authorized for production ePHI access. Add a row and complete the joiner process
before granting access.

## Joiner, mover, leaver procedure

- Joiner: document business need, approve least-privilege role, require MFA and
  managed endpoint controls, complete training, then grant access and record the
  vault evidence ID.
- Mover: review every console and application role within 24 hours; remove
  access no longer required before adding broader access.
- Leaver: disable application and vendor accounts, revoke sessions/API tokens,
  rotate shared secrets they could access, recover devices, and record completion
  within 24 hours (immediately for involuntary or security-related separation).

## Quarterly review checklist

- Export or inspect users, service accounts, API credentials, and recent logins
  for GitHub, Vercel, Neon, AWS, Google/Firebase, Resend, Cloudflare, and the
  private compliance vault.
- Match every identity to an active row and documented need.
- Review privileged application accounts and active web/mobile sessions.
- Remove stale access, rotate unexplained credentials, and open an incident for
  suspicious activity.
- Store the signed review privately and record only its evidence ID and date.
