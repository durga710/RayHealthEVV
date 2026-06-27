import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

// Mock the gemini-client module BEFORE importing the route so the route's
// import resolves to the mocked exports. Vitest's vi.mock is hoisted.
vi.mock('../../services/gemini-client.js', () => ({
  isGeminiConfigured: vi.fn(),
  askGemini: vi.fn(),
  GEMINI_MODELS: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  isGeminiModel: (value: unknown) =>
    value === 'gemini-2.5-flash' || value === 'gemini-2.5-pro',
  GeminiNotConfiguredError: class GeminiNotConfiguredError extends Error {
    constructor() {
      super('GOOGLE_AI_API_KEY is not set');
      this.name = 'GeminiNotConfiguredError';
    }
  },
  GeminiApiError: class GeminiApiError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
      this.name = 'GeminiApiError';
    }
  },
}));

// Import after the mock so app.ts -> copilot-routes.ts picks up the stubs.
import { createApp } from '../../app.js';
import * as gemini from '../../services/gemini-client.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(gemini.isGeminiConfigured).mockReset();
  vi.mocked(gemini.askGemini).mockReset();
});

interface KnexLike {
  (table: string): KnexBuilder;
  fn: { now: () => string };
}
interface KnexBuilder {
  where: (filter: unknown) => KnexBuilder;
  first: (col?: string) => Promise<unknown>;
}

function makeMockDb(features: unknown): KnexLike {
  const builder: KnexBuilder = {
    where: () => builder,
    first: async () => ({ features }),
  };
  const fn = ((_table: string) => builder) as KnexLike;
  fn.fn = { now: () => 'NOW()' };
  return fn;
}

function mockAuditCreate(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ id: 'audit-x', eventType: 'copilot.query' });
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
    return { create: fn } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);
  return fn;
}

// ---------- /copilot/status ----------

describe('GET /copilot/status', () => {
  it('returns enabled=false + plan=off when no flag is set', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    const app = createApp();
    app.set('db', makeMockDb({}));

    const response = await request(app)
      .get('/copilot/status')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.enabled).toBe(false);
    expect(response.body.data.plan).toBe('off');
    expect(response.body.data.geminiConfigured).toBe(true);
  });

  it('reports live state when flag is on and Gemini is configured', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'pro' } }));

    const response = await request(app)
      .get('/copilot/status')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.enabled).toBe(true);
    expect(response.body.data.plan).toBe('pro');
    expect(response.body.data.geminiConfigured).toBe(true);
  });

  it('reports geminiConfigured=false when env key is missing', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(false);
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .get('/copilot/status')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.data.geminiConfigured).toBe(false);
  });
});

// ---------- /copilot/ask ----------

describe('POST /copilot/ask', () => {
  beforeEach(() => {
    mockAuditCreate();
  });

  it('returns 402 COPILOT_NOT_ENABLED when the feature flag is off', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: false, plan: 'off' } }));

    const response = await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ prompt: 'who is due for HIPAA this week?' });

    expect(response.status).toBe(402);
    expect(response.body.code).toBe('COPILOT_NOT_ENABLED');
  });

  it('returns 503 COPILOT_NOT_CONFIGURED when Gemini env is missing', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(false);
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ prompt: 'who is due for HIPAA this week?' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('COPILOT_NOT_CONFIGURED');
  });

  it('returns 400 when prompt is empty', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ prompt: '' });

    expect(response.status).toBe(400);
  });

  it('returns Gemini answer + writes copilot.query audit on the happy path', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    vi.mocked(gemini.askGemini).mockResolvedValue({
      text: 'Three caregivers are due: Maria, Roberto, and Lin.',
      usageTokens: 142,
      model: 'gemini-2.5-flash',
    });
    const auditCreate = mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ prompt: 'who is due for HIPAA this week?' });

    expect(response.status).toBe(200);
    expect(response.body.data.answer).toContain('Maria');
    expect(response.body.data.proposedAction).toBeNull();
    expect(response.body.data.model).toBe('gemini-2.5-flash');

    // Audit fires with the right shape
    const copilotCall = auditCreate.mock.calls.find(
      (args) => (args[0] as { eventType?: string }).eventType === 'copilot.query',
    );
    expect(copilotCall).toBeDefined();
    const payload = (copilotCall?.[0] as { payload?: Record<string, unknown> })?.payload;
    expect(payload?.role).toBe('coordinator');
    expect(payload?.model).toBe('gemini-2.5-flash');
    expect(payload?.promptHash).toBeTruthy();
    expect(payload?.proposedAction).toBeNull();
    // Prompt itself is NOT in the audit payload
    expect(payload?.prompt).toBeUndefined();
  });

  it('extracts PROPOSE_ACTION line into a separate field and audits it', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    vi.mocked(gemini.askGemini).mockResolvedValue({
      text: 'Roberto is overdue on HIPAA. I can enroll him in the next cohort.\n\nPROPOSE_ACTION: Enroll Roberto in HIPAA-2026 with due date 7 days out',
      usageTokens: 88,
      model: 'gemini-2.5-flash',
    });
    const auditCreate = mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ prompt: 'what should I do about Roberto?' });

    expect(response.status).toBe(200);
    expect(response.body.data.proposedAction).toBe('Enroll Roberto in HIPAA-2026 with due date 7 days out');
    expect(response.body.data.answer).not.toContain('PROPOSE_ACTION');

    const copilotCall = auditCreate.mock.calls.find(
      (args) => (args[0] as { eventType?: string }).eventType === 'copilot.query',
    );
    const payload = (copilotCall?.[0] as { payload?: Record<string, unknown> })?.payload;
    expect(payload?.proposedAction).toBe('Enroll Roberto in HIPAA-2026 with due date 7 days out');
  });

  it('routes Pro plan to gemini-2.5-pro by default', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    vi.mocked(gemini.askGemini).mockResolvedValue({
      text: 'Detailed pro response.',
      usageTokens: 600,
      model: 'gemini-2.5-pro',
    });
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'pro' } }));

    await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ prompt: 'run a deep analysis on Q2 compliance' });

    const args = vi.mocked(gemini.askGemini).mock.calls[0]?.[0];
    expect(args?.model).toBe('gemini-2.5-pro');
  });

  it('ignores a non-allowlisted client model and uses the plan default', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    vi.mocked(gemini.askGemini).mockResolvedValue({
      text: 'Safe response.',
      usageTokens: 100,
      model: 'gemini-2.5-flash',
    });
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      // Attempt to inject a path-traversal value into the request URL via `model`.
      .send({ prompt: 'hi', model: '../../models/evil:generateContent?key=x' });

    const args = vi.mocked(gemini.askGemini).mock.calls[0]?.[0];
    expect(args?.model).toBe('gemini-2.5-flash');
  });

  it('returns 502 when Gemini upstream fails', async () => {
    vi.mocked(gemini.isGeminiConfigured).mockReturnValue(true);
    const { GeminiApiError } = await import('../../services/gemini-client.js');
    vi.mocked(gemini.askGemini).mockRejectedValue(new GeminiApiError(500, 'upstream barfed'));
    mockAuditCreate();
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/ask')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ prompt: 'test' });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('COPILOT_UPSTREAM_ERROR');
  });
});

// ---------- /copilot/execute (action runner) ----------

const CAREGIVER_UUID = '00000000-0000-4000-8000-000000000002';
const COURSE_UUID = '00000000-0000-4000-8000-000000000010';
const AGENCY_UUID = 'agency-1';

interface CaregiverRow {
  id: string;
  agencyId: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive' | 'suspended';
}

function mockExecutorRepos(opts: {
  caregiver?: CaregiverRow | null;
  course?: { id: string; agencyId: string | null; title: string } | null;
  enrollResult?: { id: string; assignedAt: string };
}): { auditCreate: ReturnType<typeof vi.fn> } {
  // `in` check so the test can explicitly pass `null` to simulate not-found
  // without falling back to the default — `null ?? default` collapses null
  // into the default which is the opposite of what these tests need.
  const caregiver: CaregiverRow | null = 'caregiver' in opts
    ? (opts.caregiver as CaregiverRow | null)
    : {
        id: CAREGIVER_UUID,
        agencyId: AGENCY_UUID,
        firstName: 'Roberto',
        lastName: 'Smith',
        status: 'active',
      };
  const course = 'course' in opts
    ? opts.course
    : { id: COURSE_UUID, agencyId: null as string | null, title: 'HIPAA Refresh' };
  const enrollResult = opts.enrollResult ?? { id: 'enroll-1', assignedAt: '2026-05-11T00:00:00Z' };

  vi.spyOn(core, 'CaregiverRepository').mockImplementation(function CaregiverRepoMock() {
    return {
      findById: vi.fn().mockResolvedValue(caregiver),
    } as unknown as core.CaregiverRepository;
  } as unknown as typeof core.CaregiverRepository);

  vi.spyOn(core, 'LearningRepository').mockImplementation(function LearningRepoMock() {
    return {
      findCourseById: vi.fn().mockResolvedValue(course),
      enroll: vi.fn().mockResolvedValue(enrollResult),
    } as unknown as core.LearningRepository;
  } as unknown as typeof core.LearningRepository);

  return { auditCreate: mockAuditCreate() };
}

describe('POST /copilot/execute', () => {
  it('returns 400 on a malformed action payload', async () => {
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ type: 'unknown_action' });

    expect(response.status).toBe(400);
  });

  it('returns 402 when Copilot add-on is disabled', async () => {
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: false, plan: 'off' } }));

    const response = await request(app)
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({
        type: 'enroll_caregiver',
        caregiverId: CAREGIVER_UUID,
        courseId: COURSE_UUID,
        dueAt: null,
      });

    expect(response.status).toBe(402);
    expect(response.body.code).toBe('COPILOT_NOT_ENABLED');
  });

  it('executes enroll_caregiver and writes copilot.action.confirmed audit', async () => {
    const { auditCreate } = mockExecutorRepos({});
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('coordinator', AGENCY_UUID)}`)
      .send({
        type: 'enroll_caregiver',
        caregiverId: CAREGIVER_UUID,
        courseId: COURSE_UUID,
        dueAt: null,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toContain('Roberto Smith');
    expect(response.body.data.summary).toContain('HIPAA Refresh');

    const confirmed = auditCreate.mock.calls.find(
      (args) => (args[0] as { eventType?: string }).eventType === 'copilot.action.confirmed',
    );
    expect(confirmed).toBeDefined();
    const payload = (confirmed?.[0] as { payload?: Record<string, unknown> })?.payload;
    expect(payload?.actionType).toBe('enroll_caregiver');
  });

  it('rejects caregivers as actors with 403 + writes declined audit', async () => {
    const { auditCreate } = mockExecutorRepos({});
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('caregiver', AGENCY_UUID, 'user-x', CAREGIVER_UUID)}`)
      .send({
        type: 'enroll_caregiver',
        caregiverId: CAREGIVER_UUID,
        courseId: COURSE_UUID,
        dueAt: null,
      });

    expect(response.status).toBe(403);
    const declined = auditCreate.mock.calls.find(
      (args) => (args[0] as { eventType?: string }).eventType === 'copilot.action.declined',
    );
    expect(declined).toBeDefined();
  });

  it('rejects cross-agency caregivers with 403', async () => {
    mockExecutorRepos({
      caregiver: { id: CAREGIVER_UUID, agencyId: 'other-agency', firstName: 'X', lastName: 'Y', status: 'active' },
    });
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('coordinator', AGENCY_UUID)}`)
      .send({
        type: 'enroll_caregiver',
        caregiverId: CAREGIVER_UUID,
        courseId: COURSE_UUID,
        dueAt: null,
      });

    expect(response.status).toBe(403);
  });

  it('returns 422 when the caregiver is not found', async () => {
    mockExecutorRepos({ caregiver: null });
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('coordinator', AGENCY_UUID)}`)
      .send({
        type: 'enroll_caregiver',
        caregiverId: CAREGIVER_UUID,
        courseId: COURSE_UUID,
        dueAt: null,
      });

    expect(response.status).toBe(422);
  });

  it('send_reminder returns a simulated success outcome (v2 stub)', async () => {
    mockExecutorRepos({});
    const app = createApp();
    app.set('db', makeMockDb({ aiCopilot: { enabled: true, plan: 'starter' } }));

    const response = await request(app)
      .post('/copilot/execute')
      .set('Authorization', `Bearer ${makeToken('coordinator', AGENCY_UUID)}`)
      .send({
        type: 'send_reminder',
        caregiverId: CAREGIVER_UUID,
        channel: 'email',
        message: 'Quick reminder: your HIPAA refresh is due Friday.',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.outcome.simulated).toBe(true);
    expect(response.body.data.summary).toContain('Roberto');
  });
});
