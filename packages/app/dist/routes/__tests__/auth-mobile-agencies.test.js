import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
afterEach(() => {
    vi.restoreAllMocks();
});
const userId = '00000000-0000-4000-8000-000000000041';
const agencyA = '00000000-0000-4000-8000-000000000042';
const agencyB = '00000000-0000-4000-8000-000000000043';
const caregiverA = '00000000-0000-4000-8000-000000000044';
const caregiverB = '00000000-0000-4000-8000-000000000045';
function membership(agencyId, caregiverId, overrides = {}) {
    return {
        userId,
        agencyId,
        agencyName: agencyId === agencyA ? 'Alpha Home Care' : 'Beacon Care LLC',
        role: 'caregiver',
        caregiverId,
        status: 'active',
        agencyReviewStatus: 'approved',
        ...overrides,
    };
}
describe('GET /auth/mobile/agencies', () => {
    it('lists active memberships with the current agency id', async () => {
        vi.spyOn(core, 'UserAgencyRepository').mockImplementation(() => ({
            listActiveForUser: vi.fn().mockResolvedValue([
                membership(agencyA, caregiverA),
                membership(agencyB, caregiverB),
            ]),
        }));
        const response = await request(createApp())
            .get('/auth/mobile/agencies')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyA, userId, caregiverA)}`);
        expect(response.status).toBe(200);
        expect(response.body.currentAgencyId).toBe(agencyA);
        expect(response.body.agencies).toEqual([
            { agencyId: agencyA, agencyName: 'Alpha Home Care', role: 'caregiver' },
            { agencyId: agencyB, agencyName: 'Beacon Care LLC', role: 'caregiver' },
        ]);
    });
    it('falls back to the token agency when the membership table is unavailable', async () => {
        vi.spyOn(core, 'UserAgencyRepository').mockImplementation(() => ({
            listActiveForUser: vi.fn().mockRejectedValue(new Error('relation "user_agencies" does not exist')),
        }));
        vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({
            findById: vi.fn().mockResolvedValue({ id: agencyA, name: 'Alpha Home Care' }),
        }));
        const response = await request(createApp())
            .get('/auth/mobile/agencies')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyA, userId, caregiverA)}`);
        expect(response.status).toBe(200);
        expect(response.body.agencies).toEqual([
            { agencyId: agencyA, agencyName: 'Alpha Home Care', role: 'caregiver' },
        ]);
    });
    it('rejects unauthenticated requests with 401', async () => {
        const response = await request(createApp()).get('/auth/mobile/agencies');
        expect(response.status).toBe(401);
    });
});
describe('POST /auth/mobile/switch-agency', () => {
    it('issues a token re-scoped to the target agency from the membership row', async () => {
        const findMembership = vi.fn().mockResolvedValue(membership(agencyB, caregiverB));
        vi.spyOn(core, 'UserAgencyRepository').mockImplementation(() => ({ findMembership }));
        const response = await request(createApp())
            .post('/auth/mobile/switch-agency')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyA, userId, caregiverA)}`)
            .send({ agencyId: agencyB });
        expect(response.status).toBe(200);
        expect(findMembership).toHaveBeenCalledWith(userId, agencyB);
        expect(response.body).toMatchObject({
            role: 'caregiver',
            agencyId: agencyB,
            agencyName: 'Beacon Care LLC',
        });
        const claims = jwt.decode(response.body.token);
        expect(claims.sub).toBe(userId);
        expect(claims.agencyId).toBe(agencyB);
        expect(claims.caregiverId).toBe(caregiverB);
    });
    it('denies switching to an agency without an active membership', async () => {
        vi.spyOn(core, 'UserAgencyRepository').mockImplementation(() => ({ findMembership: vi.fn().mockResolvedValue(undefined) }));
        const response = await request(createApp())
            .post('/auth/mobile/switch-agency')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyA, userId, caregiverA)}`)
            .send({ agencyId: agencyB });
        expect(response.status).toBe(403);
        expect(response.body.code).toBe('AGENCY_ACCESS_DENIED');
    });
    it('denies a disconnected membership', async () => {
        vi.spyOn(core, 'UserAgencyRepository').mockImplementation(() => ({
            findMembership: vi.fn().mockResolvedValue(membership(agencyB, caregiverB, { status: 'disconnected' })),
        }));
        const response = await request(createApp())
            .post('/auth/mobile/switch-agency')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyA, userId, caregiverA)}`)
            .send({ agencyId: agencyB });
        expect(response.status).toBe(403);
    });
    it('denies an agency that is not approved', async () => {
        vi.spyOn(core, 'UserAgencyRepository').mockImplementation(() => ({
            findMembership: vi.fn().mockResolvedValue(membership(agencyB, caregiverB, { agencyReviewStatus: 'pending' })),
        }));
        const response = await request(createApp())
            .post('/auth/mobile/switch-agency')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyA, userId, caregiverA)}`)
            .send({ agencyId: agencyB });
        expect(response.status).toBe(403);
    });
    it('rejects a malformed agencyId with 400', async () => {
        const response = await request(createApp())
            .post('/auth/mobile/switch-agency')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyA, userId, caregiverA)}`)
            .send({ agencyId: 'not-a-uuid' });
        expect(response.status).toBe(400);
    });
    it('rejects unauthenticated requests with 401', async () => {
        const response = await request(createApp())
            .post('/auth/mobile/switch-agency')
            .send({ agencyId: agencyB });
        expect(response.status).toBe(401);
    });
});
//# sourceMappingURL=auth-mobile-agencies.test.js.map