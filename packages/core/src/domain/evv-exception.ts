import { z } from 'zod';
import { paExceptionTypes } from '../config/pennsylvania.js';

export const evvExceptionSchema = z.object({
  id: z.string().uuid().optional(),
  visitId: z.string().uuid(),
  exceptionType: z.enum(paExceptionTypes),
  reason: z.string().min(1),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().datetime().optional(),
});

export type EvvException = z.infer<typeof evvExceptionSchema>;
