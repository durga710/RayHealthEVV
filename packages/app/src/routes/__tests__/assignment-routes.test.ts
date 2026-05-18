import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assignment routes', () => {
  it('creates an assignment when the authorization and caregiver are valid', async () => {
    const mockCreateAssignment = vi.fn().mockResolvedValue({
      id: '123',
      caregiverId: 'caregiver-1',
      visitTemplateId: 'template-1'
    });
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return {
        createAssignment: mockCreateAssignment
      } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);

    const response = await request(createApp())
      .post('/assignments')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({
        clientId: 'client-1',
        caregiverId: 'caregiver-1',
        visitTemplateId: 'template-1',
        authorizationId: 'auth-1',
        visitDate: '2026-05-20'
      });

    expect(response.status).toBe(201);
    expect(mockCreateAssignment).toHaveBeenCalled();
  });

  it('rejects assignment creation when visitTemplateId is missing', async () => {
    const mockCreateAssignment = vi.fn();
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(function ScheduleRepositoryMock() {
      return {
        createAssignment: mockCreateAssignment
      } as unknown as core.ScheduleRepository;
    } as unknown as typeof core.ScheduleRepository);

    const response = await request(createApp())
      .post('/assignments')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({
        clientId: 'client-1',
        caregiverId: 'caregiver-1',
        authorizationId: 'auth-1',
        visitDate: '2026-05-20'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/visitTemplateId/i);
    expect(mockCreateAssignment).not.toHaveBeenCalled();
  });
});
