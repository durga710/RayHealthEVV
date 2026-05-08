import { z } from 'zod';
export const auditEventTypes = [
    'visit.created', 'visit.clock-out', 'visit.approved', 'visit.flagged',
    'credential.created', 'credential.expired', 'credential.renewed',
    'caregiver.created', 'caregiver.status-changed',
    'assignment.created', 'assignment.cancelled',
    'exception.filed', 'exception.approved',
    'auth.login.success', 'auth.login.failure', 'auth.logout',
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