import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FACE_MATCH_THRESHOLD,
  createFaceMatchClient,
  isIdentityVerificationConfigured,
  resetFaceMatchClient,
} from '../face-match-client.js';

const OLD_ENV = { ...process.env };
const IMAGE = Buffer.from('fake-jpeg-bytes');

beforeEach(() => {
  delete process.env.IDENTITY_VERIFICATION_PROVIDER;
  resetFaceMatchClient();
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
  resetFaceMatchClient();
});

describe('provider selection', () => {
  it('falls back to a no-op that reports not_configured, never a pass', async () => {
    // A verification product that reports success when it verified nothing is
    // worse than one that reports nothing at all.
    const result = await createFaceMatchClient().compare(IMAGE, IMAGE);

    expect(result.outcome).toBe('not_configured');
    expect(result.similarity).toBeNull();
    expect(isIdentityVerificationConfigured()).toBe(false);
  });

  it('reports configured only when the provider is explicitly selected', () => {
    expect(isIdentityVerificationConfigured()).toBe(false);
    process.env.IDENTITY_VERIFICATION_PROVIDER = 'rekognition';
    expect(isIdentityVerificationConfigured()).toBe(true);
  });

  it('never claims a liveness check it did not perform', async () => {
    const result = await createFaceMatchClient().compare(IMAGE, IMAGE);
    // Face match answers who is in the frame, not whether a person was there.
    expect(result.livenessChecked).toBe(false);
  });
});

describe('match threshold', () => {
  it('is stricter than the AWS default, because a false accept starts a paid shift', () => {
    expect(FACE_MATCH_THRESHOLD).toBeGreaterThan(80);
  });
});

describe('rekognition result mapping', () => {
  /**
   * Exercises the mapping by driving the real client against a stubbed AWS
   * transport, so the outcome logic is covered without a network call.
   */
  async function compareWith(response: Record<string, unknown>) {
    process.env.IDENTITY_VERIFICATION_PROVIDER = 'rekognition';
    const rekognition = await import('@aws-sdk/client-rekognition');
    vi.spyOn(rekognition.RekognitionClient.prototype, 'send').mockResolvedValue(
      response as never,
    );
    return createFaceMatchClient().compare(IMAGE, IMAGE);
  }

  it('matches above the threshold', async () => {
    const result = await compareWith({ FaceMatches: [{ Similarity: 97.4 }] });
    expect(result).toMatchObject({ outcome: 'matched', similarity: 97, provider: 'rekognition' });
  });

  it('rejects a similar-but-below-threshold face', async () => {
    const result = await compareWith({ FaceMatches: [{ Similarity: 88 }] });
    expect(result).toMatchObject({ outcome: 'not_matched', similarity: 88 });
  });

  it('takes the strongest match when several faces are returned', async () => {
    const result = await compareWith({ FaceMatches: [{ Similarity: 41 }, { Similarity: 95 }] });
    expect(result).toMatchObject({ outcome: 'matched', similarity: 95 });
  });

  it('separates "a different person" from "no face in frame"', async () => {
    // A face that simply is not the enrolled person.
    const different = await compareWith({ FaceMatches: [], UnmatchedFaces: [{}] });
    expect(different.outcome).toBe('not_matched');

    vi.restoreAllMocks();
    // Nothing face-like at all: a dark or blurred capture, which should ask
    // for a retake rather than accuse anyone.
    const empty = await compareWith({ FaceMatches: [], UnmatchedFaces: [] });
    expect(empty.outcome).toBe('no_face');
    expect(empty.similarity).toBeNull();
  });

  it('treats an unreadable source image as a retake, not a system error', async () => {
    process.env.IDENTITY_VERIFICATION_PROVIDER = 'rekognition';
    const rekognition = await import('@aws-sdk/client-rekognition');
    const err = new Error('no face');
    err.name = 'InvalidParameterException';
    vi.spyOn(rekognition.RekognitionClient.prototype, 'send').mockRejectedValue(err as never);

    const result = await createFaceMatchClient().compare(IMAGE, IMAGE);

    expect(result.outcome).toBe('no_face');
  });

  it('reports an error rather than a pass when the provider fails', async () => {
    process.env.IDENTITY_VERIFICATION_PROVIDER = 'rekognition';
    const rekognition = await import('@aws-sdk/client-rekognition');
    vi.spyOn(rekognition.RekognitionClient.prototype, 'send').mockRejectedValue(
      new Error('service unavailable') as never,
    );

    const result = await createFaceMatchClient().compare(IMAGE, IMAGE);

    expect(result.outcome).toBe('error');
    expect(result.similarity).toBeNull();
  });
});
