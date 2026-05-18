import { z } from 'zod';

export const evvVisitIdSchema = z.string().uuid();

export const evvClockLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative()
});

export const evvClockInInputSchema = z.object({
  assignmentId: z.string().uuid(),
  location: evvClockLocationSchema
});

export const evvClockOutInputSchema = z.object({
  location: evvClockLocationSchema
});

export const evvVisitSchema = z.object({
  id: evvVisitIdSchema.optional(),
  assignmentId: z.string().uuid(),
  caregiverId: z.string().uuid(),
  clockInTime: z.string().datetime(),
  clockOutTime: z.string().datetime().optional(),
  clockInLocation: evvClockLocationSchema,
  clockOutLocation: evvClockLocationSchema.optional(),
  status: z.enum(['pending', 'verified', 'flagged']).default('pending')
});

export type EvvVisit = z.infer<typeof evvVisitSchema>;
