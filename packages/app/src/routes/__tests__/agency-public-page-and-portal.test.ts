import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

// Force the interview AI down so the scripted-fallback path is what's tested.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn().mockRejectedValue(new Error('bedrock down')) };
});

beforeAll(() => setTestJwtSecret());

describe('public agency hiring pages', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves a slug to public agency info', async () => {
    vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({
      getPublicPageBySlug: vi.fn().mockResolvedValue({
        agencyId: 'agency-1',
        name: 'Cyanjel Care LLC',
        state: 'PA',
        about: 'We provide home care.',
      }),
    } as any));

    const res = await request(createApp()).get('/onboarding/agency-page/cyanjelcarellc');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ agencyId: 'agency-1', name: 'Cyanjel Care LLC' });
  });

  it('404s an unknown or malformed slug', async () => {
    vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({
      getPublicPageBySlug: vi.fn().mockResolvedValue(null),
    } as any));

    expect((await request(createApp()).get('/onboarding/agency-page/nope-agency')).status).toBe(404);
    expect((await request(createApp()).get('/onboarding/agency-page/__bad!')).status).toBe(404);
  });

  it('saves the public page from agency settings and normalizes the slug', async () => {
    const updatePublicPage = vi.fn().mockResolvedValue({ slug: 'cyanjelcarellc', about: 'Hi' });
    vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({ updatePublicPage } as any));

    const res = await request(createApp())
      .put('/agencies/current/public-page')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({
        slug: 'CyanjelCareLLC',
        about: 'Hi',
        profile: {
          displayName: 'Cyanjel Home Care',
          tagline: 'Because Home Is Where Care Feels Best',
          phone: '(412) 555-0100',
          services: [{ name: 'Respite Care', blurb: 'Temporary compassionate support.' }],
        },
      });

    expect(res.status).toBe(200);
    expect(updatePublicPage).toHaveBeenCalledWith('agency-1', {
      slug: 'cyanjelcarellc',
      about: 'Hi',
      profile: expect.objectContaining({ displayName: 'Cyanjel Home Care' }),
    });
  });

  it('preserves the stored profile when the field is omitted (slug-only update)', async () => {
    const updatePublicPage = vi.fn().mockResolvedValue({ slug: 'new-slug', about: null, profile: { displayName: 'Kept' } });
    vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({ updatePublicPage } as any));

    const res = await request(createApp())
      .put('/agencies/current/public-page')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ slug: 'new-slug' });

    expect(res.status).toBe(200);
    // profile must be undefined (leave unchanged), never null (which clears).
    expect(updatePublicPage).toHaveBeenCalledWith('agency-1', {
      slug: 'new-slug',
      about: null,
      profile: undefined,
    });
    expect(res.body.profile).toMatchObject({ displayName: 'Kept' });
  });

  it('rejects an invalid profile (bad email) with 400', async () => {
    const res = await request(createApp())
      .put('/agencies/current/public-page')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ slug: 'some-agency', profile: { email: 'not-an-email' } });
    expect(res.status).toBe(400);
  });

  it('rejects reserved and malformed slugs, and 409s a taken slug', async () => {
    vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({
      updatePublicPage: vi.fn().mockResolvedValue('conflict'),
    } as any));
    const app = createApp();
    const auth = { Authorization: `Bearer ${makeToken('admin')}` };

    expect((await request(app).put('/agencies/current/public-page').set(auth).send({ slug: 'admin' })).status).toBe(400);
    expect((await request(app).put('/agencies/current/public-page').set(auth).send({ slug: 'x' })).status).toBe(400);
    const conflict = await request(app).put('/agencies/current/public-page').set(auth).send({ slug: 'taken-name' });
    expect(conflict.status).toBe(409);
  });

  it('forbids caregivers from editing the public page', async () => {
    const res = await request(createApp())
      .put('/agencies/current/public-page')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`)
      .send({ slug: 'some-agency' });
    expect(res.status).toBe(403);
  });
});

describe('applicant portal', () => {
  afterEach(() => vi.restoreAllMocks());

  const portalPayload = {
    applicant: {
      id: 'ap-1', agencyId: 'agency-1', firstName: 'Durga', lastName: 'Thapa',
      email: 'a@b.com', position: 'Direct Support Associate', status: 'applied',
    },
    agencyName: 'Cyanjel Care LLC',
    interview: { id: 'iv-1', applicantId: 'ap-1', sessionToken: 'tok-1', messages: [], status: 'pending' },
    documents: [
      { id: 'doc-1', applicantId: 'ap-1', documentType: 'photo_id', status: 'requested' },
    ],
  };

  it('returns the applicant view for a valid token', async () => {
    vi.spyOn(core, 'OnboardingRepository').mockImplementation(() => ({
      getPortalByToken: vi.fn().mockResolvedValue(portalPayload),
    } as any));

    const res = await request(createApp()).get('/onboarding/portal/tok-1');
    expect(res.status).toBe(200);
    expect(res.body.agencyName).toBe('Cyanjel Care LLC');
    expect(res.body.applicant).toMatchObject({ firstName: 'Durga', position: 'Direct Support Associate' });
    // Never leak email/notes through the public portal payload.
    expect(res.body.applicant.email).toBeUndefined();
    expect(res.body.documents[0]).toMatchObject({ id: 'doc-1', documentType: 'photo_id', status: 'requested' });
  });

  it('accepts a document upload and marks it submitted', async () => {
    const submitDocumentFile = vi.fn().mockResolvedValue({
      id: 'doc-1', applicantId: 'ap-1', documentType: 'photo_id', status: 'submitted', fileName: 'id.png',
    });
    vi.spyOn(core, 'OnboardingRepository').mockImplementation(() => ({
      getInterviewByToken: vi.fn().mockResolvedValue({ id: 'iv-1', applicantId: 'ap-1', messages: [], status: 'pending' }),
      submitDocumentFile,
    } as any));

    const res = await request(createApp())
      .post('/onboarding/portal/tok-1/documents/doc-1?filename=id.png')
      .set('content-type', 'image/png')
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect(res.status).toBe(201);
    expect(submitDocumentFile).toHaveBeenCalledWith('doc-1', 'ap-1', expect.objectContaining({
      fileName: 'id.png',
      contentType: 'image/png',
    }));
  });

  it('rejects disallowed content types with 415', async () => {
    const res = await request(createApp())
      .post('/onboarding/portal/tok-1/documents/doc-1')
      .set('content-type', 'application/zip')
      .send(Buffer.from('zip'));
    expect(res.status).toBe(415);
  });

  it('409s when the document is not awaiting an upload', async () => {
    vi.spyOn(core, 'OnboardingRepository').mockImplementation(() => ({
      getInterviewByToken: vi.fn().mockResolvedValue({ id: 'iv-1', applicantId: 'ap-1', messages: [], status: 'pending' }),
      submitDocumentFile: vi.fn().mockResolvedValue(null),
    } as any));

    const res = await request(createApp())
      .post('/onboarding/portal/tok-1/documents/doc-1')
      .set('content-type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4'));
    expect(res.status).toBe(409);
  });
});

describe('apply + interview resilience', () => {
  afterEach(() => vi.restoreAllMocks());

  it('auto-requests the standard document set on application', async () => {
    const requestDocument = vi.fn().mockResolvedValue({ id: 'doc-x' });
    vi.spyOn(core, 'OnboardingRepository').mockImplementation(() => ({
      createApplicant: vi.fn().mockResolvedValue({ id: 'ap-1' }),
      recordTermsAcceptance: vi.fn().mockResolvedValue(undefined),
      createInterview: vi.fn().mockResolvedValue({ sessionToken: 'tok-1' }),
      requestDocument,
    } as any));

    const app = createApp();
    app.set('db', (table: string) => ({
      where: () => ({ first: async () => (table === 'agencies' ? { id: 'agency-1' } : undefined) }),
    }));

    const res = await request(app)
      .post('/onboarding/apply')
      .send({
        agencyId: '4c8a63a2-8b6e-4f4e-9d3b-9f2c8f6a1b2c',
        firstName: 'Durga',
        lastName: 'Thapa',
        email: 'durga@example.com',
        acceptedTerms: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.sessionToken).toBe('tok-1');
    expect(requestDocument).toHaveBeenCalledTimes(core.documentTypeValues.length);
  });

  it('falls back to scripted questions when the interview AI is down', async () => {
    const updateInterview = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'OnboardingRepository').mockImplementation(() => ({
      getInterviewByToken: vi.fn().mockResolvedValue({
        id: 'iv-1',
        applicantId: 'ap-1',
        sessionToken: 'tok-1',
        status: 'in_progress',
        messages: [{ role: 'assistant', content: 'Q1: tell me about yourself' }],
      }),
      updateInterview,
    } as any));

    const res = await request(createApp())
      .post('/onboarding/interview/tok-1/message')
      .send({ content: 'I have three years of caregiving experience.' });

    // generateText is mocked to reject (see vi.mock at top): the applicant
    // still gets the next scripted question instead of a 502.
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(false);
    expect(res.body.message).toContain('What draws you to working as a Direct Support Associate');
    expect(updateInterview).toHaveBeenCalled();
  });
});
