# HIPAA Business Associate Agreement (BAA) Request Emails

**Authored by Durga Ghimeray**

**Purpose:** Each vendor below processes electronic Protected Health
Information (ePHI) on RayHealth EVV's behalf. Under HIPAA §164.308(b)(1),
every such "business associate" must sign a written BAA before live PHI
flows through their systems. This document holds drafted request emails —
copy, fill in your title/contact info, send.

**Tracking checklist (status as of 2026-07-07):**

- [ ] Vercel — sent / received / signed
- [x] **Neon — Active; executed BAA and HIPAA mode enabled** (verified 2026-07-07)
- [ ] Google (Firebase / Cloud) — sent / received / signed
- [ ] Resend — sent / received / signed
- [x] **AWS — Active in AWS Artifact** (verified 2026-05-08)
- [ ] Cloudflare — request only if storage / Workers / WAF features that
      retain content are enabled (currently RayHealth uses Cloudflare for
      DNS + TLS termination only, so a BAA is not yet required — see §6)

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

**What to expect:** Vercel typically asks you to upgrade to **Enterprise**
or their **HIPAA-eligible Pro tier** before signing. Pricing is on a
quote basis. Turn-around is usually 3–7 business days.

---

## 2. Neon

**Status: ACTIVE.** The Neon Business Associate Agreement is executed,
and project `late-art-87716813` runs in Neon's HIPAA mode with pgAudit
audit logging and encryption at rest enabled.

Store the executed BAA PDF in the private compliance vault. Do not commit
the agreement PDF to git.

Re-verify on each annual evaluation:

1. Open the Neon console.
2. Confirm project `late-art-87716813` is still on the HIPAA-eligible tier.
3. Confirm HIPAA mode remains enabled.
4. Confirm pgAudit/audit logging and encryption-at-rest evidence remain
   available for customer diligence.

If the Neon BAA is terminated or HIPAA mode is disabled, treat that as a
SEV-1 readiness incident and do not onboard real PHI until the posture is
restored.

---

## 3. Google (Firebase + Cloud)

This one is **self-service** — you don't email Google support; you accept
the BAA in the Google Cloud Console.

1. Open: <https://console.cloud.google.com>
2. Top nav → switch to the project that hosts your Firebase: **rayhealthevv**
3. Left menu → **IAM & Admin** → **Compliance** (or search "BAA")
4. Find **"Business Associate Agreement"** → click **Review and accept**
5. The acceptance flow walks through:
   - Confirming you're the authorized signer
   - Listing covered services (enable Firebase Cloud Messaging, Firebase
     Auth, Firestore — even if you don't use all of them yet)
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
Services we use: Firebase Auth, Firebase Cloud Messaging, Firestore (planned)

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

**What to expect:** Resend signs BAAs on **Pro** plan and above. If
you're on the free tier, expect to upgrade. Pricing is monthly;
turn-around is usually 2–5 business days.

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

## 6. Cloudflare (conditional — currently NOT required)

Cloudflare sits in front of Vercel for DNS and TLS termination. RayHealth
**does not** use Cloudflare features that retain customer content
(no Workers KV, R2, D1, Stream, Images, or Cloudflare Workers running
custom code). Cloudflare's role is limited to:

- DNS resolution for `rayhealthevv.com`
- TLS termination (Universal SSL) and re-encryption to the Vercel origin
- WAF / bot-management rules (operating on metadata, not PHI payloads)

Under HHS guidance, mere conduit transit of encrypted traffic does not
make a vendor a Business Associate. **No BAA is required from
Cloudflare today.**

If RayHealth adds any of the following Cloudflare features, this
designation changes and a BAA becomes required:

- Cloudflare Workers (running custom logic on PHI requests)
- KV / R2 / D1 / Durable Objects (storing customer content)
- Cloudflare Logs that include request/response bodies
- Any Cloudflare AI / Workers AI feature

If that day comes, request the Cloudflare BAA through their Enterprise
sales channel — `enterprise@cloudflare.com` — and update this section.

---

## After the remaining BAAs are signed

Remaining outstanding BAAs as of 2026-07-07: Vercel, Google Firebase /
Cloud, and Resend. AWS and Neon are active.

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
