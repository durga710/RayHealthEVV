import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-00000000b001';
const userId = '00000000-0000-4000-8000-00000000b002';
const caregiverId = '00000000-0000-4000-8000-00000000b003';
const threadId = '00000000-0000-4000-8000-00000000b004';

function mockRepo(overrides: Record<string, unknown> = {}) {
  const base = {
    ensureThread: vi.fn().mockResolvedValue({ id: threadId, agencyId, caregiverId }),
    listMessages: vi.fn().mockResolvedValue([]),
    listThreadsForAgency: vi.fn().mockResolvedValue([]),
    postMessage: vi.fn().mockResolvedValue({ id: 'm-1', body: 'hi' }),
    markRead: vi.fn().mockResolvedValue(undefined),
    unreadForCaregiver: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
  vi.spyOn(core, 'MessageRepository').mockImplementation(
    () => base as unknown as core.MessageRepository,
  );
  return base;
}

const caregiverAuth = () => `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`;
const adminAuth = () => `Bearer ${makeToken('admin', agencyId, userId)}`;

describe('GET /messages', () => {
  it('gives a caregiver their own thread and marks it read', async () => {
    const repo = mockRepo();

    const res = await request(createApp()).get('/messages').set('Authorization', caregiverAuth());

    expect(res.status).toBe(200);
    // The thread is resolved from the session, never from a parameter.
    expect(repo.ensureThread).toHaveBeenCalledWith(agencyId, caregiverId);
    expect(repo.markRead).toHaveBeenCalledWith(threadId, agencyId, 'caregiver');
    expect(repo.listThreadsForAgency).not.toHaveBeenCalled();
  });

  it('gives staff the agency inbox instead of a single thread', async () => {
    const repo = mockRepo();

    await request(createApp()).get('/messages').set('Authorization', adminAuth());

    expect(repo.listThreadsForAgency).toHaveBeenCalledWith(agencyId);
    expect(repo.ensureThread).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    mockRepo();
    const res = await request(createApp()).get('/messages');
    expect(res.status).toBe(401);
  });
});

describe('POST /messages', () => {
  it('posts as the caregiver and marks their own thread read', async () => {
    const repo = mockRepo();

    const res = await request(createApp())
      .post('/messages')
      .set('Authorization', caregiverAuth())
      .send({ body: 'Running ten minutes late' });

    expect(res.status).toBe(201);
    expect(repo.postMessage).toHaveBeenCalledWith({
      threadId,
      agencyId,
      senderType: 'caregiver',
      senderUserId: userId,
      body: 'Running ten minutes late',
    });
    expect(repo.markRead).toHaveBeenCalledWith(threadId, agencyId, 'caregiver');
  });

  it('rejects an empty or whitespace-only message', async () => {
    const repo = mockRepo();

    expect(
      (await request(createApp()).post('/messages').set('Authorization', caregiverAuth()).send({ body: '' }))
        .status,
    ).toBe(400);
    expect(
      (await request(createApp()).post('/messages').set('Authorization', caregiverAuth()).send({ body: '   ' }))
        .status,
    ).toBe(400);
    expect(repo.postMessage).not.toHaveBeenCalled();
  });

  it('trims the message before storing it', async () => {
    const repo = mockRepo();

    await request(createApp())
      .post('/messages')
      .set('Authorization', caregiverAuth())
      .send({ body: '  hello  ' });

    expect(repo.postMessage).toHaveBeenCalledWith(expect.objectContaining({ body: 'hello' }));
  });

  it('points a non-caregiver at the staff endpoint', async () => {
    const repo = mockRepo();
    const res = await request(createApp())
      .post('/messages')
      .set('Authorization', adminAuth())
      .send({ body: 'hi' });
    expect(res.status).toBe(403);
    expect(repo.postMessage).not.toHaveBeenCalled();
  });
});

describe('POST /messages/staff', () => {
  it('posts as staff into the addressed caregiver thread', async () => {
    const repo = mockRepo();

    const res = await request(createApp())
      .post('/messages/staff')
      .set('Authorization', adminAuth())
      .send({ caregiverId, body: 'Can you cover Thursday?' });

    expect(res.status).toBe(201);
    // Thread is resolved inside the caller's agency, so a caregiver id from
    // another tenant cannot reach that tenant's conversation.
    expect(repo.ensureThread).toHaveBeenCalledWith(agencyId, caregiverId);
    expect(repo.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ senderType: 'staff', senderUserId: userId }),
    );
  });

  it('will not let a caregiver post as staff', async () => {
    const repo = mockRepo();
    const res = await request(createApp())
      .post('/messages/staff')
      .set('Authorization', caregiverAuth())
      .send({ caregiverId, body: 'hi' });
    expect(res.status).toBe(403);
    expect(repo.postMessage).not.toHaveBeenCalled();
  });

  it('requires a caregiver id', async () => {
    const repo = mockRepo();
    const res = await request(createApp())
      .post('/messages/staff')
      .set('Authorization', adminAuth())
      .send({ body: 'hi' });
    expect(res.status).toBe(400);
    expect(repo.postMessage).not.toHaveBeenCalled();
  });
});

describe('GET /messages/unread-count', () => {
  it('returns the caregiver unread count', async () => {
    mockRepo({ unreadForCaregiver: vi.fn().mockResolvedValue(3) });

    const res = await request(createApp())
      .get('/messages/unread-count')
      .set('Authorization', caregiverAuth());

    expect(res.body).toEqual({ count: 3 });
  });

  it('reports zero rather than failing when the count cannot be computed', async () => {
    // A badge is not worth breaking a screen over.
    mockRepo({ unreadForCaregiver: vi.fn().mockRejectedValue(new Error('db down')) });

    const res = await request(createApp())
      .get('/messages/unread-count')
      .set('Authorization', caregiverAuth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0 });
  });

  it('reports zero for a non-caregiver', async () => {
    mockRepo();
    const res = await request(createApp())
      .get('/messages/unread-count')
      .set('Authorization', adminAuth());
    expect(res.body).toEqual({ count: 0 });
  });
});
