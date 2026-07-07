import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-0000000000b1';
const userId = '00000000-0000-4000-8000-0000000000b2';
const caregiverId = '00000000-0000-4000-8000-0000000000b3';
const enrollmentId = '00000000-0000-4000-8000-0000000000b4';
const courseId = '00000000-0000-4000-8000-0000000000b5';

describe('POST /learning/complete — tenant scoping (finding #3)', () => {
  it('passes the caller agencyId to recordCompletion so the enrollment is agency-scoped', async () => {
    const recordCompletion = vi.fn().mockResolvedValue({ id: 'c1', enrollmentId, caregiverId, courseId });
    vi.spyOn(core, 'LearningRepository').mockImplementation(
      () => ({ recordCompletion }) as unknown as core.LearningRepository,
    );

    const res = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
      .send({ enrollmentId, courseId });

    expect(res.status).toBe(201);
    // Second argument is the caller's agencyId — the ownership scope.
    expect(recordCompletion).toHaveBeenCalledWith(expect.objectContaining({ enrollmentId, courseId }), agencyId);
  });

  it('returns 404 (not 500) when the enrollment is not in the caller agency', async () => {
    const recordCompletion = vi.fn().mockRejectedValue(new Error(`Enrollment ${enrollmentId} not found`));
    vi.spyOn(core, 'LearningRepository').mockImplementation(
      () => ({ recordCompletion }) as unknown as core.LearningRepository,
    );

    const res = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
      .send({ enrollmentId, courseId });

    expect(res.status).toBe(404);
  });
});

describe('POST /learning/start — tenant scoping (finding #14)', () => {
  it('passes agencyId to markInProgress and 404s a non-owned enrollment', async () => {
    const markInProgress = vi.fn().mockResolvedValue(false);
    vi.spyOn(core, 'LearningRepository').mockImplementation(
      () => ({ markInProgress }) as unknown as core.LearningRepository,
    );

    const res = await request(createApp())
      .post('/learning/start')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
      .send({ enrollmentId });

    expect(res.status).toBe(404);
    expect(markInProgress).toHaveBeenCalledWith(enrollmentId, agencyId);
  });

  it('returns 200 when the enrollment is owned and transitioned', async () => {
    const markInProgress = vi.fn().mockResolvedValue(true);
    vi.spyOn(core, 'LearningRepository').mockImplementation(
      () => ({ markInProgress }) as unknown as core.LearningRepository,
    );

    const res = await request(createApp())
      .post('/learning/start')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
      .send({ enrollmentId });

    expect(res.status).toBe(200);
  });
});
