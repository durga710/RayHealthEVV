import { describe, expect, it } from 'vitest';
import {
  MAX_UPLOAD_BASE64_CHARS,
  describeOutcome,
  isUploadableCapture,
  stepFor,
  type IdentityStatus,
} from './identity';

function status(overrides: Partial<IdentityStatus> = {}): IdentityStatus {
  return {
    configured: true,
    consented: false,
    enrolled: false,
    enrolledAt: null,
    consentText: 'text',
    currentConsentVersion: 'v1',
    livenessSupported: false,
    ...overrides,
  };
}

describe('stepFor', () => {
  it('waits while status is unknown', () => {
    expect(stepFor(null)).toBe('loading');
  });

  it('asks for consent before anything else', () => {
    expect(stepFor(status())).toBe('consent');
    // Even if somehow already enrolled, consent comes first; the server
    // enforces the same order and would 403 a client that skipped ahead.
    expect(stepFor(status({ enrolled: true }))).toBe('consent');
  });

  it('asks to enroll once consent is given', () => {
    expect(stepFor(status({ consented: true }))).toBe('enroll');
  });

  it('is ready once consented and enrolled', () => {
    expect(stepFor(status({ consented: true, enrolled: true }))).toBe('ready');
  });

  it('still walks the flow when the provider is switched off', () => {
    // The caregiver can consent and enroll before an agency finishes setup;
    // only the check itself needs the provider.
    expect(stepFor(status({ configured: false }))).toBe('consent');
    expect(stepFor(status({ configured: false, consented: true }))).toBe('enroll');
  });
});

describe('describeOutcome', () => {
  it('reports a match with its similarity', () => {
    const copy = describeOutcome('matched', 97);
    expect(copy.tone).toBe('success');
    expect(copy.detail).toContain('97%');
    expect(copy.retryable).toBe(false);
  });

  it('handles a match with no similarity figure', () => {
    expect(describeOutcome('matched', null).detail).not.toContain('null');
  });

  it('does not accuse the caregiver when a match fails', () => {
    const copy = describeOutcome('not_matched', 40);
    const text = `${copy.title} ${copy.detail}`.toLowerCase();
    // The likeliest cause is lighting, not fraud, and the app is the wrong
    // place to make that call.
    for (const word of ['fraud', 'imposter', 'someone else', 'not you']) {
      expect(text).not.toContain(word);
    }
    expect(copy.retryable).toBe(true);
  });

  it('treats a missing face as a retake, not a failure', () => {
    const copy = describeOutcome('no_face', null);
    expect(copy.retryable).toBe(true);
    expect(copy.tone).toBe('warning');
  });

  it('never presents an unconfigured provider as a result', () => {
    const copy = describeOutcome('not_configured', null);
    expect(copy.tone).toBe('info');
    expect(copy.detail).toContain('Nothing was checked');
    expect(copy.retryable).toBe(false);
  });

  it('points an unenrolled caregiver at enrollment rather than retrying', () => {
    expect(describeOutcome('not_enrolled', null).retryable).toBe(false);
  });

  it('offers a retry on a transient error', () => {
    expect(describeOutcome('error', null).retryable).toBe(true);
  });
});

describe('isUploadableCapture', () => {
  it('rejects a missing or empty capture', () => {
    expect(isUploadableCapture(undefined)).toBe(false);
    expect(isUploadableCapture(null)).toBe(false);
    expect(isUploadableCapture('')).toBe(false);
  });

  it('accepts a normal-sized photo', () => {
    expect(isUploadableCapture('a'.repeat(500 * 1024))).toBe(true);
  });

  it('rejects one past what the server will decode', () => {
    // Better a retake prompt here than a confusing 413 from the API.
    expect(isUploadableCapture('a'.repeat(MAX_UPLOAD_BASE64_CHARS + 1))).toBe(false);
  });

  it('leaves headroom under the route body limit', () => {
    // 3MB parser cap on the server; the base64 ceiling must sit below it.
    expect(MAX_UPLOAD_BASE64_CHARS).toBeLessThan(3 * 1024 * 1024);
  });
});

describe('storage gate', () => {
  it('hides the camera when the server has nowhere to keep the photo', () => {
    // Inviting somebody to photograph their face and then failing to store it
    // is the worst order to discover missing configuration in.
    expect(stepFor(status({ storageConfigured: false }))).toBe('unavailable');
    expect(stepFor(status({ storageConfigured: false, consented: true }))).toBe('unavailable');
  });

  it('still shows an already-enrolled caregiver their setup', () => {
    // Their photo exists; a transient config gap should not imply it is gone.
    expect(
      stepFor(status({ storageConfigured: false, consented: true, enrolled: true })),
    ).toBe('ready');
  });

  it('proceeds normally once storage is configured', () => {
    expect(stepFor(status({ storageConfigured: true }))).toBe('consent');
    expect(stepFor(status({ storageConfigured: true, consented: true }))).toBe('enroll');
  });

  it('keeps working against an API that predates the field', () => {
    // Absent is not the same as false; an older server should behave as before.
    expect(stepFor(status())).toBe('consent');
  });
});
