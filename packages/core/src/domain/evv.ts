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
  serviceCode: evvServiceCodeSchema.optional(),
  // Store-and-forward: when the mobile app captured this punch offline, the
  // original capture moment rides along at replay so the visit carries the
  // real punch time, not the sync time. The route bounds the window (no
  // future stamps beyond clock skew, nothing older than 72h).
  capturedAt: z.string().datetime().optional()
});

/**
 * A task documented as performed during a visit. Snapshotted from the PA
 * task catalog ({id, duty}) at clock-out so the visit row stands alone for
 * audit-packet and aggregator use, same philosophy as the Cures-Act
 * service-code/client snapshots taken at clock-in.
 */
export const evvVisitTaskSchema = z.object({
  id: z.string().min(1),
  duty: z.string().min(1)
});

/**
 * Verification-of-service e-signature, captured as stroke vectors (arrays of
 * [x, y] integer points in the pad's coordinate space) rather than an image:
 * a few KB of JSON that stays under the API body limit, renders losslessly
 * as SVG on any surface, and cannot smuggle binary content. Bounds keep a
 * worst-case payload around 40KB against the 100KB express.json limit.
 */
const signaturePointSchema = z.tuple([
  z.number().int().min(0).max(4000),
  z.number().int().min(0).max(4000)
]);

export const evvSignatureInputSchema = z
  .object({
    strokes: z.array(z.array(signaturePointSchema).min(1).max(1000)).min(1).max(60),
    width: z.number().int().positive().max(4000),
    height: z.number().int().positive().max(4000),
    // Who signed on the pad. The caregiver's own identity is already proven
    // by the authenticated punch, so the pad is for the person receiving care.
    signerRole: z.enum(['client', 'representative']),
    signerName: z.string().trim().min(1).max(120).optional()
  })
  .refine(
    (sig) => sig.strokes.reduce((total, stroke) => total + stroke.length, 0) <= 4000,
    { message: 'signature exceeds the 4000-point limit' }
  );

/** Stored form: the validated input plus the signing moment (= clockOutTime). */
export const evvSignatureSchema = z.object({
  strokes: z.array(z.array(signaturePointSchema)),
  width: z.number(),
  height: z.number(),
  signerRole: z.enum(['client', 'representative']),
  signerName: z.string().nullable().optional(),
  signedAt: z.string().datetime()
});

export const evvClockOutInputSchema = z.object({
  location: evvLocationSchema,
  // Optional service documentation captured with the clock-out. taskIds are
  // PA task-catalog IDs; the route resolves them against paTasks and rejects
  // unknown codes, so the DB only ever stores catalog-backed snapshots.
  taskIds: z.array(z.string().min(1).max(16)).max(100).optional(),
  note: z.string().trim().max(2000).optional(),
  // Store-and-forward capture time, see evvClockInInputSchema.capturedAt.
  capturedAt: z.string().datetime().optional(),
  // Verification-of-service e-signature drawn on the caregiver's phone.
  signature: evvSignatureInputSchema.optional()
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
  // Service documentation recorded at clock-out: catalog-snapshotted tasks
  // performed and a free-text note. Null/absent on visits documented before
  // this feature or when the caregiver skipped documentation.
  tasks: z.array(evvVisitTaskSchema).nullable().optional(),
  visitNote: z.string().nullable().optional(),
  // Verification-of-service e-signature recorded at clock-out; null when the
  // client couldn't or chose not to sign.
  signature: evvSignatureSchema.nullable().optional(),
  // Aggregator submission lifecycle. Null until the background job first
  // attempts submission; 'accepted' means Sandata returned a confirmation ID.
  sandataStatus: z.enum(['pending', 'submitted', 'accepted', 'rejected']).nullable().optional(),
  sandataConfirmationId: z.string().nullable().optional(),
  // HHAeXchange analogue of the Sandata pair above, for agencies routed
  // through that aggregator instead.
  hhaexchangeStatus: z.enum(['pending', 'submitted', 'accepted', 'rejected']).nullable().optional(),
  hhaexchangeConfirmationId: z.string().nullable().optional(),
  // Server insert time. For an offline store-and-forward punch this trails
  // clockInTime by the sync delay, making delayed submissions auditable
  // without a separate flag.
  createdAt: z.string().datetime().optional()
});

export type EvvVisit = z.infer<typeof evvVisitSchema>;
export type EvvClockInInput = z.infer<typeof evvClockInInputSchema>;
export type EvvClockOutInput = z.infer<typeof evvClockOutInputSchema>;
export type EvvSignature = z.infer<typeof evvSignatureSchema>;
export type EvvSignatureInput = z.infer<typeof evvSignatureInputSchema>;
