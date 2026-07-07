import { z } from 'zod';
import { paServiceCodes } from '../config/pennsylvania.js';

export const evvVisitIdSchema = z.string().uuid();
export const evvServiceCodeSchema = z.enum(paServiceCodes);

export const evvLocationSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative()
});

export const evvClockInInputSchema = z.object({
  assignmentId: z.string().uuid(),
  location: evvLocationSchema,
  serviceCode: evvServiceCodeSchema.optional()
});

export const evvClockOutInputSchema = z.object({
  location: evvLocationSchema
});

export const evvVisitSchema = z.object({
  id: z.string().uuid().optional(),
  assignmentId: z.string().uuid(),
  caregiverId: z.string().uuid(),
  // Cures-Act #2 (beneficiary), snapshotted onto the row at clock-in.
  clientId: z.string().uuid().optional(),
  // Cures-Act #1 (type of service). HCPCS code stamped at clock-in.
  serviceCode: evvServiceCodeSchema.optional(),
  clockInTime: z.string().datetime(),
  clockOutTime: z.string().datetime().optional(),
  clockInLocation: evvLocationSchema,
  clockOutLocation: evvLocationSchema.optional(),
  status: z.enum(['pending', 'verified', 'flagged']).default('pending'),
  // Aggregator submission lifecycle. Null until the background job first
  // attempts submission; 'accepted' means Sandata returned a confirmation ID.
  sandataStatus: z.enum(['pending', 'submitted', 'accepted', 'rejected']).nullable().optional(),
  sandataConfirmationId: z.string().nullable().optional(),
  // HHAeXchange analogue of the Sandata pair above, for agencies routed
  // through that aggregator instead.
  hhaexchangeStatus: z.enum(['pending', 'submitted', 'accepted', 'rejected']).nullable().optional(),
  hhaexchangeConfirmationId: z.string().nullable().optional()
});

export type EvvVisit = z.infer<typeof evvVisitSchema>;
export type EvvClockInInput = z.infer<typeof evvClockInInputSchema>;
export type EvvClockOutInput = z.infer<typeof evvClockOutInputSchema>;
