import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const AGENCY_ID = 'agency-1';
const CAREGIVER_ID = 'caregiver-1';
const COURSE_ID = 'course-uuid-1';
const ENROLLMENT_ID = 'enroll-uuid-1';

function makeCourse(overrides: Partial<core.LearningCourse> = {}): core.LearningCourse {
  return {
    id: COURSE_ID,
    agencyId: AGENCY_ID,
    code: 'ORIENT-PA-01',
    title: 'PA Personal Care Orientation',
    description: 'One-time orientation required before first client contact.',
    cadence: 'one_time',
    expiresAfterDays: null,
    required: true,
    durationMinutes: 120,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeEnrollment(overrides: Partial<core.CourseEnrollment> = {}): core.CourseEnrollment {
  return {
    id: ENROLLMENT_ID,
    agencyId: AGENCY_ID,
    caregiverId: CAREGIVER_ID,
    courseId: COURSE_ID,
    assignedAt: '2024-01-10T00:00:00.000Z',
    dueAt: '2024-02-10T00:00:00.000Z',
    lastCompletedAt: null,
    expiresAt: null,
    status: 'not_started',
    ...overrides,
  };
}

function mockRepo(methods: Partial<core.LearningRepository>) {
  vi.spyOn(core, 'LearningRepository').mockImplementation(
    function MockRepo() {
      return methods as unknown as core.LearningRepository;
    } as unknown as typeof core.LearningRepository,
  );
}

describe('GET /learning/courses', () => {
  it('returns the agency course catalog', async () => {
    const courses = [
      makeCourse(),
      makeCourse({ id: 'c2', code: 'HIPAA-2026', title: 'HIPAA Basics', required: false }),
    ];
    mockRepo({ listCourses: vi.fn().mockResolvedValue(courses) });

    const response = await request(createApp())
      .get('/learning/courses')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].code).toBe('ORIENT-PA-01');
  });

  it('returns 401 without auth', async () => {
    const response = await request(createApp()).get('/learning/courses');
    expect(response.status).toBe(401);
  });
});

describe('GET /learning/rollup', () => {
  it('returns the agency compliance rollup', async () => {
    const rollup: core.LearningAgencyRollup = {
      totalCaregivers: 12,
      totalEnrollments: 48,
      notStarted: 4,
      inProgress: 2,
      completed: 36,
      overdue: 4,
      expired: 2,
      complianceRate: 0.75,
    };
    mockRepo({ getAgencyRollup: vi.fn().mockResolvedValue(rollup) });

    const response = await request(createApp())
      .get('/learning/rollup')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.complianceRate).toBe(0.75);
    expect(response.body.data.totalCaregivers).toBe(12);
  });
});

describe('POST /learning/enroll', () => {
  it('enrolls a caregiver and returns 201', async () => {
    const enrollment = makeEnrollment();
    mockRepo({ enroll: vi.fn().mockResolvedValue(enrollment) });

    const response = await request(createApp())
      .post('/learning/enroll')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ caregiverId: CAREGIVER_ID, courseId: COURSE_ID, dueAt: '2024-02-10' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.caregiverId).toBe(CAREGIVER_ID);
  });

  it('returns 400 when caregiverId or courseId is missing', async () => {
    const response = await request(createApp())
      .post('/learning/enroll')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ caregiverId: CAREGIVER_ID });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /learning/complete', () => {
  it('records a completion and returns 201', async () => {
    const completion: core.CourseCompletion = {
      id: 'comp-1',
      enrollmentId: ENROLLMENT_ID,
      caregiverId: CAREGIVER_ID,
      courseId: COURSE_ID,
      completedAt: '2024-01-20T14:00:00.000Z',
      score: 92,
      notes: 'in-person classroom',
    };
    mockRepo({ recordCompletion: vi.fn().mockResolvedValue(completion) });

    const token = makeToken('caregiver', AGENCY_ID, CAREGIVER_ID, CAREGIVER_ID);
    const response = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ enrollmentId: ENROLLMENT_ID, courseId: COURSE_ID, score: 92, notes: 'in-person classroom' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.score).toBe(92);
  });

  it('returns 400 when enrollmentId or courseId is missing', async () => {
    const response = await request(createApp())
      .post('/learning/complete')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`)
      .send({ enrollmentId: ENROLLMENT_ID });

    expect(response.status).toBe(400);
  });
});

describe('/api prefix', () => {
  it('learning courses accessible via /api prefix', async () => {
    mockRepo({ listCourses: vi.fn().mockResolvedValue([makeCourse()]) });

    const response = await request(createApp())
      .get('/api/learning/courses')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
