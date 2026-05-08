import { z } from 'zod';
import { paAssignmentStatuses } from '../config/pennsylvania.js';
export const assignmentStatusSchema = z.enum(paAssignmentStatuses);
export const assignmentInputSchema = z.object({
    caregiverId: z.string().min(1),
    visitTemplateId: z.string().min(1),
    credentialStatus: z.literal('active', {
        message: 'Caregiver must be eligible for assignment'
    })
});
//# sourceMappingURL=scheduling.js.map