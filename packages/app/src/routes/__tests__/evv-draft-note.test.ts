import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

/**
 * POST /evv/draft-note — AI polish of the caregiver's rough clock-out note.
 *
 * The AI module is mocked at the module boundary: these tests assert the
 * route's gating (caregiver identity, input validation, fail-closed when
 * Bedrock is unconfigured) and its success/upstream-failure envelopes, not
 * model behavior.
 */

const askAI = vi.fn();
const isAIConfigured = vi.fn();

vi.mock('../../ai.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ai.js')>();
  return {
    ...actual,
    askAI: (...args: unknown[]) => askAI(...args),
    isAIConfigured: () => isAIConfigured()
  };
});

import { createApp } from '../../app.js';

const caregiverId = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

function caregiverToken() {
  return makeToken('caregiver', 'agency-1', 'user-1', caregiverId);
}

beforeAll(() => setTestJwtSecret());

describe('POST /evv/draft-note', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects users without a caregiver identity', async () => {
    const response = await request(createApp())
      .post('/evv/draft-note')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ roughNote: 'client was mad about meds' });

    expect(response.status).toBe(403);
    expect(askAI).not.toHaveBeenCalled();
  });

  it('requires a non-empty roughNote', async () => {
    const response = await request(createApp())
      .post('/evv/draft-note')
      .set('Authorization', `Bearer ${caregiverToken()}`)
      .send({ roughNote: '   ' });

    expect(response.status).toBe(400);
    expect(askAI).not.toHaveBeenCalled();
  });

  it('rejects a roughNote over 2000 characters', async () => {
    const response = await request(createApp())
      .post('/evv/draft-note')
      .set('Authorization', `Bearer ${caregiverToken()}`)
      .send({ roughNote: 'x'.repeat(2001) });

    expect(response.status).toBe(400);
    expect(askAI).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the AI provider is not configured', async () => {
    isAIConfigured.mockReturnValue(false);

    const response = await request(createApp())
      .post('/evv/draft-note')
      .set('Authorization', `Bearer ${caregiverToken()}`)
      .send({ roughNote: 'client was mad about meds' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AI_NOT_CONFIGURED');
    expect(askAI).not.toHaveBeenCalled();
  });

  it('returns the polished draft and passes tasks + client name as context', async () => {
    isAIConfigured.mockReturnValue(true);
    askAI.mockResolvedValue({
      text: 'Client expressed frustration about the medication schedule.',
      usageTokens: 120,
      model: 'test-model',
      provider: 'bedrock'
    });

    const response = await request(createApp())
      .post('/evv/draft-note')
      .set('Authorization', `Bearer ${caregiverToken()}`)
      .send({
        roughNote: 'client was mad about meds',
        taskDuties: ['Meal preparation', 'Medication reminder'],
        clientName: 'Rosa'
      });

    expect(response.status).toBe(200);
    expect(response.body.draft).toBe('Client expressed frustration about the medication schedule.');
    expect(response.body.model).toBe('test-model');

    expect(askAI).toHaveBeenCalledTimes(1);
    const call = askAI.mock.calls[0][0] as { prompt: string; systemInstruction: string };
    expect(call.prompt).toContain('client was mad about meds');
    expect(call.prompt).toContain('Meal preparation');
    expect(call.prompt).toContain('Rosa');
    expect(call.systemInstruction).toContain('NEVER add facts');
  });

  it('maps an upstream AI failure to 502, not 500', async () => {
    isAIConfigured.mockReturnValue(true);
    askAI.mockRejectedValue(new Error('bedrock exploded'));

    const response = await request(createApp())
      .post('/evv/draft-note')
      .set('Authorization', `Bearer ${caregiverToken()}`)
      .send({ roughNote: 'client was mad about meds' });

    expect(response.status).toBe(502);
  });

  it('treats an empty model response as an upstream failure', async () => {
    isAIConfigured.mockReturnValue(true);
    askAI.mockResolvedValue({ text: '   ', usageTokens: 5, model: 'test-model', provider: 'bedrock' });

    const response = await request(createApp())
      .post('/evv/draft-note')
      .set('Authorization', `Bearer ${caregiverToken()}`)
      .send({ roughNote: 'client was mad about meds' });

    expect(response.status).toBe(502);
  });
});
