/**
 * Face matching for RayVerify identity verification.
 *
 * Compares a clock-in selfie against the caregiver's enrolled reference face
 * and reports how confident the provider is that they are the same person.
 *
 * Provider selection (first match wins), same shape as email-client.ts:
 *   1. AWS Rekognition, when IDENTITY_VERIFICATION_PROVIDER=rekognition.
 *      AWS is already the project's BAA-covered vendor for SES, Bedrock, and
 *      PHI document storage, so no new vendor relationship is needed.
 *   2. No-op fallback, which reports `not_configured` rather than pretending
 *      to have verified anybody.
 *
 * A stub that returns a confident score is the single most dangerous thing
 * this module could contain: it would let the product claim verified identity
 * while checking nothing. The fallback therefore fails loudly-in-data
 * (`not_configured`) and callers must not treat that as a pass.
 *
 * LIVENESS IS NOT IMPLEMENTED. See `docs/rayverify-integration.md` §7: face
 * and liveness must be presented as rolling out, not live, until a real
 * provider is wired. AWS Rekognition Face Liveness requires the Amplify
 * FaceLivenessDetector client SDK, which needs a custom native build the
 * managed Expo app does not have today. Without it, a still photograph of a
 * photograph passes face match, so this module verifies WHO is in the frame
 * and says nothing about whether they were physically present. The
 * `livenessChecked` flag is on the result so no caller can silently assume
 * otherwise.
 */

import {
  RekognitionClient,
  CompareFacesCommand,
  type CompareFacesCommandOutput,
} from '@aws-sdk/client-rekognition';
import { safeError } from '../security/safe-log.js';

/**
 * Similarity below which a comparison is not a match, as a percentage.
 *
 * 90 rather than AWS's 80 default: this gates a caregiver's ability to start a
 * paid shift, so a false accept (someone else clocking in) is worse than a
 * false reject (a retake). Agencies see rejected checks and can override the
 * visit through the existing exception path.
 */
export const FACE_MATCH_THRESHOLD = 90;

export type FaceMatchOutcome =
  | 'matched'
  | 'not_matched'
  /** No face found in one of the images, e.g. a dark or blurred capture. */
  | 'no_face'
  | 'error'
  | 'not_configured';

export interface FaceMatchResult {
  outcome: FaceMatchOutcome;
  /** Provider-reported similarity 0..100, null when no comparison happened. */
  similarity: number | null;
  provider: string;
  /**
   * Always false today. Present so a caller can never mistake face match for
   * proof of physical presence. See the module note on liveness.
   */
  livenessChecked: boolean;
}

export interface FaceMatchClient {
  compare(reference: Buffer, capture: Buffer): Promise<FaceMatchResult>;
}

function createRekognitionClient(): FaceMatchClient {
  const region =
    process.env.IDENTITY_REKOGNITION_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  const client = new RekognitionClient({
    region,
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });

  return {
    async compare(reference: Buffer, capture: Buffer): Promise<FaceMatchResult> {
      try {
        const response: CompareFacesCommandOutput = await client.send(
          new CompareFacesCommand({
            // Copied into plain Uint8Arrays: the SDK's Bytes field is typed
            // against ArrayBuffer, and Node's Buffer can be backed by a
            // SharedArrayBuffer, which the type will not accept.
            SourceImage: { Bytes: Uint8Array.from(reference) },
            TargetImage: { Bytes: Uint8Array.from(capture) },
            // Ask below our own threshold so a near-miss comes back with a
            // score we can record, rather than as an empty result we cannot
            // tell apart from "no face in frame".
            SimilarityThreshold: 1,
            QualityFilter: 'AUTO',
          }),
        );

        const best = (response.FaceMatches ?? []).reduce<number | null>((max, match) => {
          const similarity = match.Similarity ?? 0;
          return max == null || similarity > max ? similarity : max;
        }, null);

        if (best == null) {
          // Rekognition reports unmatched faces separately from "no face at
          // all". An empty target set means nothing face-like was found.
          const sawAFace = (response.UnmatchedFaces ?? []).length > 0;
          return {
            outcome: sawAFace ? 'not_matched' : 'no_face',
            similarity: sawAFace ? 0 : null,
            provider: 'rekognition',
            livenessChecked: false,
          };
        }

        const rounded = Math.round(best);
        return {
          outcome: rounded >= FACE_MATCH_THRESHOLD ? 'matched' : 'not_matched',
          similarity: rounded,
          provider: 'rekognition',
          livenessChecked: false,
        };
      } catch (err) {
        // InvalidParameterException is what Rekognition raises when it cannot
        // find a face in the SOURCE image, which is a capture-quality problem
        // rather than a system failure, and the caregiver should be asked to
        // retake rather than shown an error.
        const name = err instanceof Error ? err.name : '';
        if (name === 'InvalidParameterException') {
          return { outcome: 'no_face', similarity: null, provider: 'rekognition', livenessChecked: false };
        }
        safeError('rekognition compare failed', err);
        return { outcome: 'error', similarity: null, provider: 'rekognition', livenessChecked: false };
      }
    },
  };
}

function createNoopClient(): FaceMatchClient {
  return {
    async compare(): Promise<FaceMatchResult> {
      // Deliberately NOT a pass. A verification product that reports success
      // when it verified nothing is worse than one that reports nothing.
      return { outcome: 'not_configured', similarity: null, provider: 'none', livenessChecked: false };
    },
  };
}

export function createFaceMatchClient(): FaceMatchClient {
  if (process.env.IDENTITY_VERIFICATION_PROVIDER?.trim() === 'rekognition') {
    return createRekognitionClient();
  }
  return createNoopClient();
}

let cached: FaceMatchClient | null = null;

export function getFaceMatchClient(): FaceMatchClient {
  if (!cached) cached = createFaceMatchClient();
  return cached;
}

export function resetFaceMatchClient(): void {
  cached = null;
}

/** True when a real provider is wired up, for readiness reporting. */
export function isIdentityVerificationConfigured(): boolean {
  return process.env.IDENTITY_VERIFICATION_PROVIDER?.trim() === 'rekognition';
}
