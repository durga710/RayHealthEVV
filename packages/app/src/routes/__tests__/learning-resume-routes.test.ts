import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-0000000000c1';
const userId = '00000000-0000-4000-8000-0000000000c2';
const caregiverId = '00000000-0000-4000-8000-0000000000c3';
const enrollmentId = '00000000-0000-4000-8000-0000000000c4';
const courseId = '00000000-0000-4000-8000-0000000000c5';

function mockRepo(overrides: Record<string, unknown>) {
  vi.spyOn(core, 'LearningRepository').mockImplementation(
    () => overrides as unknown as core.LearningRepository,
  );
}

function post(body: object) {
  return request(createApp())
    .post('/learning/resume')
    .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
    .send(body);
}

describe('POST /learning/resume', () => {
  it('saves the position scoped to both the agency and the caregiver', async () => {
    const saveResumeState = vi.fn().mockResolvedValue(true);
    mockRepo({ saveResumeState });

    const res = await post({ enrollmentId, stepIndex: 4, answers: [0, null] });

    expect(res.status).toBe(200);
    // Resume position is personal: one caregiver must never be able to move
    // another's place in a course.
    expect(saveResumeState).toHaveBeenCalledWith(enrollmentId, agencyId, caregiverId, {
      stepIndex: 4,
      answers: [0, null],
    });
  });

  it('returns 404 without disclosing whether a foreign enrollment exists', async () => {
    mockRepo({ saveResumeState: vi.fn().mockResolvedValue(false) });
    const res = await post({ enrollmentId, stepIndex: 2, answers: [] });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed payload with 400', async () => {
    const saveResumeState = vi.fn();
    mockRepo({ saveResumeState });

    expect((await post({ enrollmentId, stepIndex: -1, answers: [] })).status).toBe(400);
    expect((await post({ enrollmentId: 'not-a-uuid', stepIndex: 1, answers: [] })).status).toBe(400);
    expect((await post({ stepIndex: 1, answers: [] })).status).toBe(400);
    expect(saveResumeState).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    mockRepo({ saveResumeState: vi.fn() });
    const res = await request(createApp())
      .post('/learning/resume')
      .send({ enrollmentId, stepIndex: 1, answers: [] });
    expect(res.status).toBe(401);
  });
});

describe('POST /learning/complete clears the resume pointer', () => {
  it('drops the saved position so a finished course does not reopen mid-quiz', async () => {
    const clearResumeState = vi.fn().mockResolvedValue(true);
    mockRepo({
      recordCompletion: vi.fn().mockResolvedValue({ id: 'c1', enrollmentId, caregiverId, courseId }),
      clearResumeState,
    });

    const res = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
      .send({ enrollmentId, courseId });

    expect(res.status).toBe(201);
    expect(clearResumeState).toHaveBeenCalledWith(enrollmentId, agencyId);
  });

  it('still reports the completion when clearing the pointer fails', async () => {
    mockRepo({
      recordCompletion: vi.fn().mockResolvedValue({ id: 'c1', enrollmentId, caregiverId, courseId }),
      clearResumeState: vi.fn().mockRejectedValue(new Error('transient db error')),
    });

    const res = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
      .send({ enrollmentId, courseId });

    // The completion is the record that matters; best-effort cleanup must not
    // turn a saved completion into an error the caregiver sees.
    expect(res.status).toBe(201);
  });
});
