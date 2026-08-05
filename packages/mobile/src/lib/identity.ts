/**
 * Pure helpers for the RayVerify identity screen: which step to show, and how
 * to describe an outcome to a caregiver. No React Native imports, so it is
 * unit-testable.
 */

export type IdentityOutcome =
  | 'matched'
  | 'not_matched'
  | 'no_face'
  | 'not_enrolled'
  | 'error'
  | 'not_configured';

export interface IdentityStatus {
  /** Whether a real matching provider is wired up server-side. */
  configured: boolean;
  /**
   * Whether photo storage is wired up. Separate from `configured`: without a
   * bucket there is nowhere to put a photo, so the camera must not be offered
   * at all, whatever the matching provider is doing.
   */
  storageConfigured?: boolean;
  consented: boolean;
  enrolled: boolean;
  enrolledAt: string | null;
  consentText: string;
  currentConsentVersion: string;
  /** False until a liveness provider ships. Never inferred client-side. */
  livenessSupported: boolean;
}

/** Which panel the screen should show, derived from server state alone. */
export type IdentityStep = 'loading' | 'unavailable' | 'consent' | 'enroll' | 'ready';

export function stepFor(status: IdentityStatus | null): IdentityStep {
  if (!status) return 'loading';
  // No storage means no camera. Inviting somebody to photograph their own face
  // and then failing to keep it is the worst order to discover this in.
  // Treated as absent only when the server explicitly says so, so an older API
  // that omits the field keeps its previous behaviour.
  if (status.storageConfigured === false && !status.enrolled) return 'unavailable';
  // Consent first, always. Nothing biometric is captured before it, and the
  // server enforces the same order, so a client that skipped ahead would only
  // earn a 403.
  if (!status.consented) return 'consent';
  if (!status.enrolled) return 'enroll';
  return 'ready';
}

export interface OutcomeCopy {
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  /** Whether retaking the photo is the useful next action. */
  retryable: boolean;
}

/**
 * Plain-language result copy.
 *
 * Two rules here. A failed match never accuses the caregiver of anything: the
 * likeliest cause is lighting or an angle, not fraud, and the app is the wrong
 * place to make that call. And `not_configured` is never dressed up as a
 * result, because the check did not happen.
 */
export function describeOutcome(outcome: IdentityOutcome, similarity: number | null): OutcomeCopy {
  switch (outcome) {
    case 'matched':
      return {
        title: 'Identity confirmed',
        detail:
          similarity != null
            ? `Matched your enrolled photo (${similarity}% similarity).`
            : 'Matched your enrolled photo.',
        tone: 'success',
        retryable: false,
      };
    case 'not_matched':
      return {
        title: 'We could not confirm it is you',
        detail:
          'Try again in better light, facing the camera straight on. If it keeps failing, contact your agency.',
        tone: 'warning',
        retryable: true,
      };
    case 'no_face':
      return {
        title: 'No face detected',
        detail: 'Make sure your whole face is in the frame and well lit, then take the photo again.',
        tone: 'warning',
        retryable: true,
      };
    case 'not_enrolled':
      return {
        title: 'No photo on file yet',
        detail: 'Take your enrollment photo first, then you can check it any time.',
        tone: 'info',
        retryable: false,
      };
    case 'not_configured':
      return {
        title: 'Identity checks are not switched on',
        detail:
          'Your agency has not enabled identity verification yet. Nothing was checked and nothing was stored.',
        tone: 'info',
        retryable: false,
      };
    case 'error':
    default:
      return {
        title: 'Something went wrong',
        detail: 'We could not run the check just now. Please try again in a moment.',
        tone: 'error',
        retryable: true,
      };
  }
}

/**
 * Guard the payload before it leaves the device.
 *
 * The server caps the decoded image at 2MB and the route's body parser at 3MB.
 * Catching an oversized capture here turns a confusing 413 into a retake
 * prompt.
 */
export const MAX_UPLOAD_BASE64_CHARS = Math.floor((2 * 1024 * 1024 * 4) / 3);

export function isUploadableCapture(base64: string | undefined | null): boolean {
  if (!base64) return false;
  return base64.length > 0 && base64.length <= MAX_UPLOAD_BASE64_CHARS;
}
