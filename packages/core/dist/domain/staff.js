import { z } from 'zod';
import { paCredentialTypes, paCredentialStatuses } from '../config/pennsylvania.js';
export const caregiverCredentialSchema = z.object({
    caregiverId: z.string().uuid().or(z.string().min(1)),
    credentialType: z.enum(paCredentialTypes),
    status: z.enum(paCredentialStatuses),
    expiresAt: z.string().date()
});
//# sourceMappingURL=staff.js.map