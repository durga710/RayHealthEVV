import { z } from 'zod';
export const auditEventTypes = [
    'visit.created', 'visit.clock-out', 'visit.approved', 'visit.flagged',
    'credential.created', 'credential.expired', 'credential.renewed',
    'caregiver.created', 'caregiver.status-changed',
    'assignment.created', 'assignment.cancelled',
    'exception.filed', 'exception.approved',
    'auth.login.success', 'auth.login.failure', 'auth.logout',
    // A multi-agency user re-scoped their mobile token to another agency they
    // hold an active membership in. Row lands under the DESTINATION agency;
    // payload carries fromAgencyId.
    'auth.agency_switch',
    'session.created', 'session.revoked',
    'csrf.failure',
    // PHI lifecycle. `phi.create` / `phi.update` / `phi.delete` replace the
    // legacy `request.write` catch-all so the audit row alone tells you what
    // kind of mutation happened. `request.write` is retained for backward
    // compatibility with historical rows. `phi.read` / `phi.export` cover the
    // disclosure side (HIPAA 164.312(b)).
    'phi.read', 'phi.create', 'phi.update', 'phi.delete', 'phi.export',
    'request.write',
    'permission.denied',
    // Invite lifecycle. `invite.created` is admin-side (a coordinator
    // sending an invite); `invite.accepted` is public-side (a caregiver
    // redeeming the token to create their account). `invite.access_code_failed`
    // logs a brute-force attempt on the access code. `invite.email.sent` /
    // `invite.email.failed` track automated email delivery via Resend so
    // an admin can audit which invites actually reached the recipient's
    // inbox (or fell back to manual-copy). Payload is delivery metadata
    // only (`messageId`, `error` category) — never the URL or token.
    'invite.created', 'invite.accepted', 'invite.access_code_failed',
    'invite.email.sent', 'invite.email.failed',
    'invite.revoked', 'invite.revoked_all',
    'auth.password_reset.requested', 'auth.password_reset.completed',
    'agency.evv-config.changed',
    'copilot.query', 'copilot.action.confirmed', 'copilot.action.declined',
    // Copilot reminder dispatch (now wired to the real email pipeline).
    'copilot.reminder.sent',
    // Billing / claims lifecycle.
    'claim.generated', 'claim.validated', 'claim.submitted', 'claim.status-changed',
    'payroll.exported',
    // State EVV aggregator (Sandata) submission lifecycle. `submitted` marks a
    // batch as sent to the aggregator; `reconciled` records the aggregator's
    // accept/reject response written back onto each visit.
    'evv.sandata.submitted', 'evv.sandata.reconciled',
    // Real Alternate-EVV async transport: `submitted` = clients/employees/visits
    // POSTed in load order; `polled` = status results applied + exceptions queued.
    'evv.sandata.altevv.submitted', 'evv.sandata.altevv.polled',
    // HHAeXchange aggregator submission lifecycle — mirror of the Sandata pair
    // for agencies routed through HHAeXchange instead of Sandata.
    'evv.hhaexchange.submitted', 'evv.hhaexchange.reconciled',
    // Bulk migration import (clients / caregivers / authorizations CSV load).
    'data.imported',
    // ERA / 835 remittance posting (payer payment file matched back onto claims).
    'claim.remittance.posted',
    // Recurring schedule materialized into concrete assignments for a horizon.
    'schedule.recurring.materialized',
    // Platform super-admin (outside agency tenancy). `platform.login.*` track the
    // super-admin's own auth; `agency.review.*` record the manual approval gate on
    // new agency signups; `account.suspended` / `account.reactivated` record the
    // super-admin terminating or restoring a user account.
    'platform.login.success', 'platform.login.failure',
    'agency.review.requested', 'agency.review.approved', 'agency.review.rejected',
    'account.suspended', 'account.reactivated',
];
export const auditOutcomes = ['success', 'failure', 'denied'];
export const auditActorTypes = ['user', 'service', 'system'];
export const auditEventSchema = z.object({
    id: z.string().uuid().optional(),
    agencyId: z.string().uuid(),
    actorId: z.string().uuid(),
    actorType: z.enum(auditActorTypes).default('user'),
    eventType: z.enum(auditEventTypes),
    entityType: z.string().min(1),
    entityId: z.string().uuid(),
    outcome: z.enum(auditOutcomes).default('success'),
    correlationId: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
    occurredAt: z.string().datetime().optional(),
    createdAt: z.string().datetime().optional(),
});
//# sourceMappingURL=audit.js.map