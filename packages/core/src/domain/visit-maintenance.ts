import { z } from 'zod';

export const visitMaintenanceSchema = z.object({
  id: z.string().uuid().optional(),
  visitId: z.string().uuid(),
  requesterId: z.string().uuid(), // Coordinator/Admin ID
  reason: z.string().min(1),
  originalStartTime: z.string().datetime().optional(),
  originalEndTime: z.string().datetime().optional(),
  adjustedStartTime: z.string().datetime().optional(),
  adjustedEndTime: z.string().datetime().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending')
});

export type VisitMaintenance = z.infer<typeof visitMaintenanceSchema>;