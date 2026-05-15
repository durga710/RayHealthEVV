import { z } from 'zod';
export declare const auditEventTypes: readonly ["visit.created", "visit.clock-out", "visit.approved", "visit.flagged", "credential.created", "credential.expired", "credential.renewed", "caregiver.created", "caregiver.status-changed", "assignment.created", "assignment.cancelled", "exception.filed", "exception.approved", "auth.login.success", "auth.login.failure", "auth.logout", "session.created", "session.revoked", "csrf.failure", "phi.read", "phi.create", "phi.update", "phi.delete", "phi.export", "request.write", "permission.denied", "invite.created", "invite.accepted", "invite.access_code_failed"];
export declare const auditOutcomes: readonly ["success", "failure", "denied"];
export declare const auditActorTypes: readonly ["user", "service", "system"];
export declare const auditEventSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodString;
    actorId: z.ZodString;
    actorType: z.ZodDefault<z.ZodEnum<{
        user: "user";
        service: "service";
        system: "system";
    }>>;
    eventType: z.ZodEnum<{
        "visit.created": "visit.created";
        "visit.clock-out": "visit.clock-out";
        "visit.approved": "visit.approved";
        "visit.flagged": "visit.flagged";
        "credential.created": "credential.created";
        "credential.expired": "credential.expired";
        "credential.renewed": "credential.renewed";
        "caregiver.created": "caregiver.created";
        "caregiver.status-changed": "caregiver.status-changed";
        "assignment.created": "assignment.created";
        "assignment.cancelled": "assignment.cancelled";
        "exception.filed": "exception.filed";
        "exception.approved": "exception.approved";
        "auth.login.success": "auth.login.success";
        "auth.login.failure": "auth.login.failure";
        "auth.logout": "auth.logout";
        "session.created": "session.created";
        "session.revoked": "session.revoked";
        "csrf.failure": "csrf.failure";
        "phi.read": "phi.read";
        "phi.create": "phi.create";
        "phi.update": "phi.update";
        "phi.delete": "phi.delete";
        "phi.export": "phi.export";
        "request.write": "request.write";
        "permission.denied": "permission.denied";
        "invite.created": "invite.created";
        "invite.accepted": "invite.accepted";
        "invite.access_code_failed": "invite.access_code_failed";
    }>;
    entityType: z.ZodString;
    entityId: z.ZodString;
    outcome: z.ZodDefault<z.ZodEnum<{
        success: "success";
        failure: "failure";
        denied: "denied";
    }>>;
    correlationId: z.ZodOptional<z.ZodString>;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    occurredAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditEventType = typeof auditEventTypes[number];
//# sourceMappingURL=audit.d.ts.map