import { z } from 'zod';

export const recurringScheduleStatuses = ['active', 'paused', 'ended'] as const;
export type RecurringScheduleStatus = (typeof recurringScheduleStatuses)[number];

/** 24-hour HH:MM. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const recurringScheduleSchema = z
  .object({
    id: z.string().uuid().optional(),
    agencyId: z.string().uuid().optional(),
    caregiverId: z.string().uuid().or(z.string().min(1)),
    visitTemplateId: z.string().uuid().or(z.string().min(1)),
    // 0 = Sunday … 6 = Saturday.
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startTime: z.string().regex(TIME_RE, 'startTime must be HH:MM'),
    endTime: z.string().regex(TIME_RE, 'endTime must be HH:MM'),
    startDate: z.string().date(),
    endDate: z.string().date(),
    status: z.enum(recurringScheduleStatuses).default('active'),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  })
  .refine((v) => v.endTime > v.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export type RecurringSchedule = z.infer<typeof recurringScheduleSchema>;
