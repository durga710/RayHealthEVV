import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { CONSENT_VERSION } from '../identity-routes.js';
import * as s3 from '../../services/s3-storage.js';
import * as faceMatch from '../../identity/face-match-client.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-00000000c001';
const userId = '00000000-0000-4000-8000-00000000c002';
const caregiverId = '00000000-0000-4000-8000-00000000c003';
const visitId = '00000000-0000-4000-8000-00000000c004';

// A base64 payload long enough to clear the schema's minimum length.
const IMAGE_B64 = Buffer.from('x'.repeat(200)).toString('base64');

function mockRepo(overrides: Record<string, unknown> = {}) {
  const base = {
    hasActiveConsent: vi.fn().mockResolvedValue(true),
    findActiveConsent: vi.fn().mockResolvedValue(null),
    findEnrollment: vi.fn().mockResolvedValue({ referenceKey: 'identity/ref.jpg' }),
    grantConsent: vi.fn().mockResolvedValue({ consentVersion: CONSENT_VERSION, grantedAt: 'now' }),
    revokeConsent: vi.fn().mockResolvedValue({ referenceKey: 'identity/ref.jpg' }),
    upsertEnrollment: vi.fn().mockResolvedValue({ previousKey: null }),
    recordVerification: vi.fn().mockResolvedValue(undefined),
    markVisitIdentity: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  vi.spyOn(core, 'IdentityRepository').mockImplementation(
    () => base as unknown as core.IdentityRepository,
  );
  return base;
}

function mockStorage(overrides: Record<string, unknown> = {}) {
  const base = {
    uploadDocument: vi.fn().mockResolvedValue({ uri: 's3://b/k', key: 'k' }),
    getObject: vi.fn().mockResolvedValue(Buffer.from('reference')),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  vi.spyOn(s3, 'S3StorageService').mockImplementation(
    () => base as unknown as s3.S3StorageService,
  );
  return base;
}

function mockMatch(outcome: string, similarity: number | null = null) {
  const compare = vi
    .fn()
    .mockResolvedValue({ outcome, similarity, provider: 'rekognition', livenessChecked: false });
  vi.spyOn(faceMatch, 'getFaceMatchClient').mockReturnValue({ compare });
  return compare;
}

const auth = () => `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`;
const adminAuth = () => `Bearer ${makeToken('admin', agencyId, userId)}`;

describe('the consent gate', () => {
  it('refuses to store an enrollment photo without consent', async () => {
    const repo = mockRepo({ hasActiveConsent: vi.fn().mockResolvedValue(false) });
    const storage = mockStorage();

    const res = await request(createApp())
      .post('/identity/enroll')
      .set('Authorization', auth())
      .send({ imageBase64: IMAGE_B64 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONSENT_REQUIRED');
    // Nothing biometric may touch storage before consent exists.
    expect(storage.uploadDocument).not.toHaveBeenCalled();
    expect(repo.upsertEnrollment).not.toHaveBeenCalled();
  });

  it('refuses to compare a capture without consent', async () => {
    mockRepo({ hasActiveConsent: vi.fn().mockResolvedValue(false) });
    const storage = mockStorage();
    const compare = mockMatch('matched', 99);

    const res = await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: IMAGE_B64 });

    expect(res.status).toBe(403);
    expect(compare).not.toHaveBeenCalled();
    expect(storage.uploadDocument).not.toHaveBeenCalled();
  });

  it('rejects consent recorded against stale wording', async () => {
    // The client echoes the version it displayed; a mismatch means the app
    // showed text this server would not record.
    const repo = mockRepo();

    const res = await request(createApp())
      .post('/identity/consent')
      .set('Authorization', auth())
      .send({ consentVersion: '1999-01-01.1' });

    expect(res.status).toBe(409);
    expect(repo.grantConsent).not.toHaveBeenCalled();
  });

  it('records consent verbatim with its version', async () => {
    const repo = mockRepo();

    const res = await request(createApp())
      .post('/identity/consent')
      .set('Authorization', auth())
      .send({ consentVersion: CONSENT_VERSION });

    expect(res.status).toBe(201);
    expect(repo.grantConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId,
        caregiverId,
        consentVersion: CONSENT_VERSION,
        consentText: expect.stringContaining('photograph'),
      }),
    );
  });
});

describe('withdrawing consent destroys the data', () => {
  it('deletes the stored reference image, not just the row', async () => {
    const repo = mockRepo();
    const storage = mockStorage();

    const res = await request(createApp()).delete('/identity/consent').set('Authorization', auth());

    expect(res.status).toBe(204);
    expect(repo.revokeConsent).toHaveBeenCalledWith(caregiverId, agencyId);
    expect(storage.deleteObject).toHaveBeenCalledWith('identity/ref.jpg');
  });

  it('does not report success when the image could not be deleted', async () => {
    // Telling somebody their biometric data is gone when it is not would be
    // the worst possible lie for this feature to tell.
    mockRepo();
    mockStorage({ deleteObject: vi.fn().mockRejectedValue(new Error('s3 down')) });

    const res = await request(createApp()).delete('/identity/consent').set('Authorization', auth());

    expect(res.status).toBe(500);
  });
});

describe('POST /identity/verify', () => {
  it('records a match and stamps the visit', async () => {
    const repo = mockRepo();
    mockStorage();
    mockMatch('matched', 97);

    const res = await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: IMAGE_B64, visitId });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ outcome: 'matched', similarity: 97, livenessChecked: false });
    expect(repo.markVisitIdentity).toHaveBeenCalledWith(visitId, agencyId, 'matched', 97);
  });

  it('keeps the capture only when it did not match', async () => {
    // A matched selfie is biometric data with no remaining purpose; storing
    // one per visit would build a face archive nobody needs.
    mockRepo();
    const matchedStorage = mockStorage();
    mockMatch('matched', 99);
    await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: IMAGE_B64 });
    expect(matchedStorage.uploadDocument).not.toHaveBeenCalled();

    vi.restoreAllMocks();

    mockRepo();
    const mismatchStorage = mockStorage();
    mockMatch('not_matched', 40);
    await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: IMAGE_B64 });
    expect(mismatchStorage.uploadDocument).toHaveBeenCalled();
  });

  it('reports not_enrolled instead of comparing against nothing', async () => {
    const repo = mockRepo({ findEnrollment: vi.fn().mockResolvedValue(null) });
    mockStorage();
    const compare = mockMatch('matched', 99);

    const res = await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: IMAGE_B64 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_ENROLLED');
    expect(compare).not.toHaveBeenCalled();
    expect(repo.recordVerification).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'not_enrolled' }),
    );
  });

  it('surfaces an unconfigured provider as its own outcome, never as a pass', async () => {
    const repo = mockRepo();
    mockStorage();
    vi.spyOn(faceMatch, 'getFaceMatchClient').mockReturnValue({
      compare: vi.fn().mockResolvedValue({
        outcome: 'not_configured',
        similarity: null,
        provider: 'none',
        livenessChecked: false,
      }),
    });

    const res = await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: IMAGE_B64, visitId });

    expect(res.body.outcome).toBe('not_configured');
    expect(repo.markVisitIdentity).toHaveBeenCalledWith(visitId, agencyId, 'not_configured', null);
  });

  it('rejects an unreadable payload before touching storage', async () => {
    mockRepo();
    const storage = mockStorage();

    const res = await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: 'short' });

    expect(res.status).toBe(400);
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('is caregiver-only', async () => {
    mockRepo();
    mockStorage();
    const res = await request(createApp())
      .post('/identity/verify')
      .set('Authorization', adminAuth())
      .send({ imageBase64: IMAGE_B64 });
    expect(res.status).toBe(403);
  });
});

describe('request body limits', () => {
  it('accepts a realistically sized selfie', async () => {
    // Regression: the app-wide JSON cap is 100KB, which no base64 photo can
    // fit. Identity gets its own larger parser mounted ahead of it. Without
    // that, every capture 413s before reaching the route and the whole
    // feature is dead on arrival.
    mockRepo();
    mockStorage();
    mockMatch('matched', 96);
    const selfie = Buffer.alloc(600 * 1024, 7).toString('base64');

    const res = await request(createApp())
      .post('/identity/verify')
      .set('Authorization', auth())
      .send({ imageBase64: selfie });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('matched');
  });

  it('rejects an image past the decoded cap', async () => {
    mockRepo();
    const storage = mockStorage();
    mockMatch('matched', 96);
    // Over the 2MB decoded ceiling the route enforces.
    const huge = Buffer.alloc(2.2 * 1024 * 1024, 7).toString('base64');

    const res = await request(createApp())
      .post('/identity/enroll')
      .set('Authorization', auth())
      .send({ imageBase64: huge });

    expect(res.status).toBe(400);
    expect(storage.uploadDocument).not.toHaveBeenCalled();
  });
});

describe('GET /identity/status', () => {
  it('states plainly that liveness is not supported', async () => {
    mockRepo();

    const res = await request(createApp()).get('/identity/status').set('Authorization', auth());

    expect(res.status).toBe(200);
    // Declared in the API so an integrator cannot mistake face match for proof
    // of physical presence.
    expect(res.body.livenessSupported).toBe(false);
    expect(res.body.consentText).toContain('photograph');
  });
});
