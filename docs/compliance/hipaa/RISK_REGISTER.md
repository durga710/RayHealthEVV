# RayHealth EVV — Security and Privacy Risk Register

**Version:** 1.1
**Assessment date:** 2026-07-16
**Owner:** Privacy Officer / Security Officer
**Review cadence:** Quarterly, annually as part of the formal risk analysis,
and within 30 days of a material architecture or vendor change

This register records known security, privacy, availability, and compliance
risks for the RayHealth platform. It is an operational input to the HIPAA
Security Rule risk-analysis process; it is not a certification or legal opinion.

Scores use likelihood × impact on a 1–5 scale. Review Low (1–4), Moderate
(5–9), High (10–16), and Critical (17–25) items at the stated cadence. Store
supporting evidence in the private compliance vault and record only its
non-sensitive evidence ID here.

| ID | Risk | L | I | Score | Current controls | Treatment / exit criterion | Owner | Status |
|---|---|---:|---:|---:|---|---|---|---|
| R-001 | Live ePHI reaches a cloud or messaging vendor before a BAA is executed | 4 | 5 | 20 | AWS BAA recorded active; application fails closed when Bedrock is unavailable; vendor tracker exists | Keep production data synthetic until Vercel, Neon, Google, Resend, and the selected claims clearinghouse (see R-011) applicability is confirmed and required BAAs are executed; record vault evidence IDs | Privacy Officer | Open — launch blocker |
| R-002 | A lost or shared caregiver phone exposes locally retained visit data | 3 | 5 | Expo SecureStore with this-device-only keychain accessibility; data scoped by user and agency; cache limited to 100 assignments; schedule cache cleared on logout/401 | Validate device-loss procedure and remote session revocation in production; consider managed-device requirements for higher-risk agencies | Security Officer | Mitigated; verify in production |
| R-003 | A copied mobile JWT remains usable after logout or device loss | 2 | 5 | Source now issues a unique `jti`, requires an active `mobile_sessions` row on every bearer request, revokes on logout, and replaces the row on agency switch | Apply the schema and deploy; run login → logout → rejected-token production smoke and retain evidence | Engineering | Source complete; deployment evidence pending |
| R-004 | Archived audit evidence can be altered after leaving the hot table | 2 | 5 | Source adds `audit_events_archive_block_mutation_trg`; verifier checks hot audit, archived audit, and EVV immutability triggers | Apply migration and obtain a passing production `verify-audit-triggers` run | Engineering | Source complete; deployment evidence pending |
| R-005 | A secret exposed in chat, logs, Git history, or a local file enables production access | 3 | 5 | Encrypted platform variables; secret scan; no secrets in release metadata; prior AWS key exposure documented | Confirm compromised AWS key deactivation/rotation in IAM; rotate on exposure; retain incident/vault evidence, never identifiers in Git | Security Officer | Open |
| R-006 | Recovery cannot meet the stated RTO/RPO because no current drill evidence exists | 3 | 5 | Disaster-recovery runbook; Neon PITR design; immutable schema history | Complete a branch-based restore drill, verify triggers and a synthetic EVV cycle, then record evidence ID and measured RTO/RPO | Security Officer | Open |
| R-007 | A vulnerability remains undetected without an independent penetration test | 3 | 4 | CI, CodeQL, dependency review, secret scan, unit/integration tests | Schedule an independent authenticated multi-tenant and mobile/API assessment before broad production rollout | Security Officer | Open |
| R-008 | Transactional email or push content discloses PHI unnecessarily | 3 | 4 | Push design prohibits PHI payloads; notification cleanup on logout; drafted vendor BAA steps | Minimize all templates, test redaction, execute applicable BAA, and review payload samples quarterly | Privacy Officer | Open |
| R-009 | An uncertified HHAeXchange or clearinghouse payload is treated as production-ready | 2 | 5 | UI/docs label HHA output as a mapping preview; production config defaults disabled | Obtain vendor-issued specs, payer code tables, issued integration credentials, certification and UAT evidence, and selected clearinghouse companion guide | Product / Engineering | Externally blocked |
| R-010 | Public product claims describe controls or features that are not implemented | 4 | 4 | Some pages distinguish roadmap features; release checks prevent selected placeholders | Complete the repository-wide claims-to-evidence audit and remove or qualify unsupported IVR, fraud, family, and certification claims | Product | Open — Sprint 6 |
| R-011 | Client ePHI in an 837P claim reaches an external clearinghouse before a BAA is executed, or travels over an unverified transport | 3 | 5 | 15 | Sandbox transport (no network, no real credentials) is the default and the integration is disabled per agency until explicitly configured; real SFTP/HTTPS transports validate the endpoint against SSRF host rules at construction and call time (`clearinghouse-transport.ts`), REST is HTTPS-only and an SFTP host may not resolve to a private address; per-agency credentials are sealed with AES-256-GCM (`cell-cipher.ts`, write-only, never returned or logged); upstream error bodies are never reflected; the 835 ledger stores filename + content sha256 + counts only, not raw remittance text | Execute a BAA with the selected clearinghouse and obtain its companion guide, payer code tables, and UAT evidence before enabling any non-sandbox transport with production ePHI; add the clearinghouse to the subprocessor inventory (see R-001) and record the vault evidence ID | Privacy Officer / Engineering | Source controls verified; sandbox-only until clearinghouse BAA + certification |

## Review procedure

1. Confirm the system inventory, vendors, data flows, and supported states.
2. Review incidents, audit anomalies, dependency findings, and vendor changes.
3. Re-score every open item and add newly identified threats or vulnerabilities.
4. Assign a dated treatment and evidence ID; do not mark an item closed from a
   source commit alone when deployment or operational proof is required.
5. Sign the review in the private compliance vault and update the review log.

## Review log

| Date | Reviewer | Result |
|---|---|---|
| 2026-07-12 | Engineering-assisted source review | Initial current-repository register created; two source control gaps fixed, with production evidence explicitly pending |
| 2026-07-16 | Engineering-assisted source review | Added R-011 for the clearinghouse 837P/835 transport shipped in #118 (external ePHI path); extended R-001 subprocessor scope to the selected clearinghouse. Transport-security controls verified in source; sandbox-only until a clearinghouse BAA and certification exist |
