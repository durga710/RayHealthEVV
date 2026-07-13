# HIPAA Business Associate Agreement (BAA) Request Emails

**Purpose:** Each vendor below processes electronic Protected Health
Information (ePHI) on RayHealth EVV's behalf. Under HIPAA §164.308(b)(1),
every such "business associate" must sign a written BAA before live PHI
flows through their systems. This document holds drafted request emails —
copy, fill in your title/contact info, send.

Primary guidance: [HHS cloud-computing guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html)
states that a cloud provider creating, receiving, maintaining, or transmitting
ePHI is generally a business associate and that the conduit exception is narrow.

**Tracking checklist (reviewed 2026-07-12):**

- [ ] Vercel — sent / received / signed
- [ ] Neon — sent / received / signed
- [ ] Google — identify the exact Maps/notification services in the production
      data flow, confirm each is a covered service, and execute the applicable BAA
- [ ] Resend — sent / received / signed
- [x] **AWS — Active in AWS Artifact** (verified 2026-05-08)
- [ ] Cloudflare — complete and retain a written conduit/business-associate
      applicability decision based on the actual proxy, WAF, and logging config

When each BAA is signed, store the executed PDF in your password manager
or a private vault (do **not** commit BAA PDFs to git). Note the signing
date in this checklist and update `SECURITY_POLICY.md` §10.

> **Authorship note.** Ported from a predecessor codebase on 2026-05-08
> and adapted to match the current production deployment:
> Vercel project `rayhealth-evv-platform-app`, Neon project
> `late-art-87716813`, Cloudflare DNS in front of Vercel, AWS Bedrock
> for AI inference.

---

## 1. Vercel

**Recipient:** `compliance@vercel.com`
**Cc:** `support@vercel.com`
**Subject:** BAA request — RayHealth EVV (production hosting on Vercel)

```
Hi Vercel team,

I'm writing on behalf of RayHealth EVV (rayhealthevv.com), a home-care
operations platform that handles electronic Protected Health Information
(ePHI) for U.S. home-care agencies and their caregivers.

We host our production web app, API, and serverless functions on Vercel.
Before we put live PHI into the system, we need a signed Business
Associate Agreement under HIPAA §164.308(b)(1).

Could you please:

1. Send the Vercel BAA / DPA package
2. Confirm our current plan tier is BAA-eligible — and if not, what plan
   we need to upgrade to
3. Note any infrastructure changes required (e.g., enabling PHI-mode
   regions, secure log routing) once the BAA is in place

Vercel project: rayhealth-evv-platform-app (project ID prj_Y0bFZJZND68I4eBeBfE2oqCzo5OG)
Production domain: rayhealthevv.com
Account email: reyghim1093@gmail.com

Thanks,
[Your name]
[Your title — e.g., Founder, RayHealth EVV]
[Phone, optional]
```

**Current official position:** Vercel's security page says HIPAA support is for
Enterprise customers, and its Terms prohibit hosting PHI without Vercel's prior
written approval. Obtain that approval and executed terms before live ePHI.

---

## 2. Neon

**Recipient:** `support@neon.tech`
**Cc:** `compliance@neon.tech` (if it exists; otherwise just support)
**Subject:** BAA request — RayHealth EVV (production Postgres on Neon)

```
Hi Neon team,

RayHealth EVV (rayhealthevv.com) runs production Postgres on Neon for a
HIPAA-regulated home-care operations platform. We need a signed Business
Associate Agreement under HIPAA §164.308(b)(1) before we put live ePHI
into the database.

Could you please:

1. Send the Neon BAA package
2. Confirm our current Neon project tier supports BAA coverage (we're
   currently on the standard tier; if Scale or Business is required,
   please indicate)
3. Note any configuration changes needed once the BAA is signed
   (e.g., turning on additional encryption or log retention)

Neon project: late-art-87716813
Region: us-east-1
Account email: reyghim1093@gmail.com

Thanks,
[Your name]
[Your title — e.g., Founder, RayHealth EVV]
```

**Current official position:** Neon documents HIPAA as an add-on to the Scale
plan, with enablement/BAA access through the Console settings. Use
`hipaa@neon.tech` if the account workflow is unavailable; do not place ePHI in
the project until the add-on and BAA are active.

---

## 3. Google (Firebase + Cloud)

First inventory the Google services actually enabled. This repository uses
Expo local notifications and an Android Maps key; it does not currently show a
Firebase Auth or Firestore application path. Do not attest to unused services.

Google requires customers using PHI to accept the Google Cloud BAA and limit
PHI workloads to services explicitly covered by that BAA. Follow the current
official Google Cloud privacy/compliance console flow and retain the accepted
agreement plus covered-service list.

1. Open: <https://console.cloud.google.com>
2. Top nav → switch to the project that hosts your Firebase: **rayhealthevv**
3. Open the current **Privacy compliance and records** / legal-compliance area
4. Review and accept the **Business Associate Agreement** if the account is eligible
5. The acceptance flow walks through:
   - Confirming you're the authorized signer
   - Confirming only currently covered and actually used services
   - Accepting the standard Google BAA terms
6. Save the confirmation email Google sends you — that's your signed BAA

**No human email required.** Google's BAA is a standard click-through;
takes ~5 minutes.

If for some reason the BAA option doesn't appear in your console (rare,
usually means the project type is set wrong), email
`gcp-baa-support@google.com` with:

```
Subject: Cannot accept BAA — RayHealth EVV / project rayhealthevv

Hi Google Cloud compliance,

I'm trying to accept the Business Associate Agreement for our Google
Cloud project but the Compliance section doesn't show the BAA option.

Project ID: rayhealthevv
Account email: reyghim1093@gmail.com
Services under review: Google Maps SDK for Android; Expo notification delivery

Could you please enable the BAA workflow on this project, or confirm
what project configuration is required?

Thanks,
[Your name]
[Your title — e.g., Founder, RayHealth EVV]
```

---

## 4. Resend

**Recipient:** `support@resend.com`
**Cc:** Use the in-app help chat at <https://resend.com/help> if email is slow
**Subject:** BAA request — RayHealth EVV (transactional email through Resend)

```
Hi Resend team,

RayHealth EVV (rayhealthevv.com) uses Resend for transactional email —
caregiver invitations, password resets, agency notifications. Some of
these emails reference patient/client identifiers, so they fall under
HIPAA's ePHI scope.

Before we go live, we need a signed Business Associate Agreement under
HIPAA §164.308(b)(1).

Could you please:

1. Send the Resend BAA package
2. Confirm our current plan tier supports a BAA (we're on the standard
   tier; if Pro is required, please indicate)
3. Note any sender configuration changes required once the BAA is in
   place — for example, do we need to use a specific subdomain or
   route through a HIPAA-tier IP pool?

Resend account email: reyghim1093@gmail.com
Sending domain: send.rayhealthevv.com (DNS verified)

Thanks,
[Your name]
[Your title — e.g., Founder, RayHealth EVV]
```

**Required evidence:** RayHealth has no current public Resend source proving a
BAA-eligible tier. Obtain written plan eligibility and an executed BAA directly
from Resend. Until then, keep PHI/client identifiers out of Resend messages or
use a separately approved provider.

---

## 5. AWS

**Status: ACTIVE.** The AWS Business Associate Addendum was confirmed
active in AWS Artifact on 2026-05-08, prior to enabling Bedrock for
PHI-bearing workloads. Re-verify on each annual evaluation per
`SECURITY_POLICY.md` §5.6.

To re-verify:

1. AWS Console → search **Artifact** → open
2. Left menu → **Agreements** → **Active agreements**
3. Confirm **"AWS Business Associate Addendum"** is listed with status
   **Active**

If the status ever shows "Inactive" or the agreement disappears, treat
that as a SEV-1 incident per `INCIDENT_RESPONSE.md` §3 — both AI
endpoints (`/api/support/chat`, `/api/admin-assistant/chat`) must be
disabled (set `AWS_REGION` env var to empty string in Vercel) until the
BAA is reinstated.

**Why this matters:** without an active AWS BAA, Bedrock inference is
**not** HIPAA-eligible regardless of how correct the architecture is —
the contractual protection has to be in place.

---

## 6. Cloudflare (applicability review required)

Cloudflare sits in front of Vercel for DNS and TLS termination. RayHealth
**does not** use Cloudflare features that retain customer content
(no Workers KV, R2, D1, Stream, Images, or Cloudflare Workers running
custom code). Cloudflare's role is limited to:

- DNS resolution for `rayhealthevv.com`
- TLS termination (Universal SSL) and re-encryption to the Vercel origin
- WAF / bot-management rules (operating on metadata, not PHI payloads)

HHS limits the conduit exception to transmission-only services with only
transient storage. Because Cloudflare terminates TLS and may apply WAF/logging
features, RayHealth must document the actual configuration and obtain a written
applicability decision; this file no longer makes a categorical no-BAA claim.

The following features clearly require a new review before use with ePHI:

- Cloudflare Workers (running custom logic on PHI requests)
- KV / R2 / D1 / Durable Objects (storing customer content)
- Cloudflare Logs that include request/response bodies
- Any Cloudflare AI / Workers AI feature

If that day comes, request the Cloudflare BAA through their Enterprise
sales channel — `enterprise@cloudflare.com` — and update this section.

---

## After the remaining BAAs are signed

1. Save executed PDFs in your password manager / private vault
2. Update the checklist at the top of this doc with signing dates
3. Update `SECURITY_POLICY.md` §10 with the signed-BAA dates
4. Update `ENCRYPTION_VERIFICATION.md` §2 if any vendor's BAA changes
   the encryption-at-rest evidence we can rely on (e.g., HSM-backed keys
   become available on a higher tier)

---

## Open questions that may come up during BAA negotiation

You don't need to wait for these — if a vendor asks any of them, here's
the honest answer based on the current architecture:

- **Subprocessors:** RayHealth EVV processes PHI through these
  subprocessors: Vercel (compute), Neon (Postgres), Google Firebase
  (push notifications), Resend (email), AWS Bedrock (AI inference).
  Cloudflare provides DNS + TLS in front of Vercel but does not store
  PHI (see §6). Each that touches PHI is itself a covered Business
  Associate.
- **Data classification:** PHI categories handled — caregiver and client
  names, contact details, visit timestamps, GPS visit-verification
  coordinates, encrypted Medicaid IDs (`clients.medicaid_number`), care
  plan free-text notes, billing-rate data, family communication content.
- **Encryption at rest:** Application-layer AES-256-GCM on Medicaid IDs
  and caregiver NPIs (verified, see `ENCRYPTION_VERIFICATION.md` §3.2);
  vendor-managed encryption is relied on for the rest of the database
  and for vendor-stored content. The exact verification status is
  tracked in `ENCRYPTION_VERIFICATION.md`.
- **Encryption in transit:** TLS 1.2+ everywhere; verified by HSTS in
  the rayhealthevv.com production deployment (response header
  `strict-transport-security: max-age=15552000; includeSubDomains`).
- **Audit logging:** Application-level audit trail in the `audit_events`
  table, made append-only at the database layer via the
  `audit_events_block_mutation_trg` Postgres trigger. Verified on each
  evaluation cycle by `scripts/verify-audit-triggers.mjs`.
- **Incident response:** Documented in
  [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md).
- **Data retention:** Per HIPAA §164.530(j), audit logs retained 6 years
  minimum. Operational PHI records retained 7 years per Pennsylvania's
  state floor. See [`DATA_RETENTION.md`](./DATA_RETENTION.md).
