import { z } from 'zod';
export declare const recurringScheduleStatuses: readonly ["active", "paused", "ended"];
export type RecurringScheduleStatus = (typeof recurringScheduleStatuses)[number];
export declare const recurringScheduleSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodOptional<z.ZodString>;
    caregiverId: z.ZodUnion<[z.ZodString, z.ZodString]>;
    visitTemplateId: z.ZodUnion<[z.ZodString, z.ZodString]>;
    daysOfWeek: z.ZodArray<z.ZodNumber>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        paused: "paused";
        ended: "ended";
    }>>;
}, z.core.$strip>;
export type RecurringSchedule = z.infer<typeof recurringScheduleSchema>;
//# sourceMappingURL=recurring-schedule.d.ts.map