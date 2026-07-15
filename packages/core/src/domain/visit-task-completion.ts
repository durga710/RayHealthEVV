import { z } from 'zod';

export const visitTaskCompletionStatusSchema = z.enum([
  'performed',
  'refused',
  'not_performed',
]);

export const visitTaskCompletionInputSchema = z.object({
  clientEventId: z.string().uuid(),
  taskCode: z.string().regex(/^\d{3}$/).optional(),
  taskLabel: z.string().trim().min(1).max(200),
  status: visitTaskCompletionStatusSchema,
});

export const visitTaskCompletionBatchSchema = z.object({
  completions: z.array(visitTaskCompletionInputSchema).min(1).max(100),
});

export const visitTaskCompletionSchema = visitTaskCompletionInputSchema.extend({
  id: z.string().uuid(),
  visitId: z.string().uuid(),
  caregiverId: z.string().uuid(),
  recordedAt: z.string().datetime(),
});

export type VisitTaskCompletionStatus = z.infer<typeof visitTaskCompletionStatusSchema>;
export type VisitTaskCompletionInput = z.infer<typeof visitTaskCompletionInputSchema>;
export type VisitTaskCompletion = z.infer<typeof visitTaskCompletionSchema>;

export interface VisitTaskPlanItem {
  taskCode?: string;
  taskLabel: string;
}
