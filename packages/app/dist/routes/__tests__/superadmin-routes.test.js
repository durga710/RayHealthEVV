import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { setTestJwtSecret } from './test-helpers.js';
const USERNAME = 'TestSuper';
const PASSWORD = 'super-secret-pass';
beforeAll(async () => {
    setTestJwtSecret();
    process.env.SUPER_ADMIN_USERNAME = USERNAME;
    process.env.SUPER_ADMIN_PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);
});
afterEach(() => vi.restoreAllMocks());
/** A full platform token is normally issued only after WebAuthn. Tests that
 *  exercise the token-gated endpoints mint one directly. */
function platformToken() {
    return jwt.sign({ sub: 'platform-superadmin', scope: 'platform', username: USERNAME }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' });
}
describe('super-admin login + WebAuthn 2FA', () => {
    it('returns the enroll stage when no device is registered yet', async () => {
        vi.spyOn(core, 'PlatformCredentialRepository').mockImplementation(() => ({
            listByUsername: vi.fn().mockResolvedValue([]),
        }));
        const res = await request(createApp())
            .post('/superadmin/login')
            .send({ username: USERNAME, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.stage).toBe('enroll');
        expect(res.body.stageToken).toEqual(expect.any(String));
        expect(res.body.options.challenge).toEqual(expect.any(String));
        expect(res.body.token).toBeUndefined(); // no full token before 2FA
    });
    it('returns the 2fa stage when a device is registered', async () => {
        vi.spyOn(core, 'PlatformCredentialRepository').mockImplementation(() => ({
            listByUsername: vi.fn().mockResolvedValue([
                { credentialId: 'cred-1', transports: [], publicKey: 'pk', counter: 0 },
            ]),
        }));
        const res = await request(createApp())
            .post('/superadmin/login')
            .send({ username: USERNAME, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.stage).toBe('2fa');
        expect(res.body.options.challenge).toEqual(expect.any(String));
    });
    it('rejects wrong credentials with 401', async () => {
        const res = await request(createApp())
            .post('/superadmin/login')
            .send({ username: USERNAME, password: 'wrong' });
        expect(res.status).toBe(401);
    });
    it('rejects WebAuthn register verify with an invalid stage token', async () => {
        const res = await request(createApp())
            .post('/superadmin/webauthn/register/verify')
            .send({ stageToken: 'not-a-jwt', response: {} });
        expect(res.status).toBe(401);
    });
    it('rejects WebAuthn authenticate verify with an invalid stage token', async () => {
        const res = await request(createApp())
            .post('/superadmin/webauthn/authenticate/verify')
            .send({ stageToken: 'not-a-jwt', response: {} });
        expect(res.status).toBe(401);
    });
});
describe('super-admin token-gated actions', () => {
    it('blocks agency listing without a platform token', async () => {
        const res = await request(createApp()).get('/superadmin/agencies');
        expect(res.status).toBe(401);
    });
    it('rejects an agency-scoped (non-platform) token', async () => {
        const agencyToken = jwt.sign({ sub: 'u1', agencyId: 'a1', role: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
        const res = await request(createApp())
            .get('/superadmin/agencies')
            .set('Authorization', `Bearer ${agencyToken}`);
        expect(res.status).toBe(403);
    });
    it('lists agencies with a valid platform token', async () => {
        const listAgencies = vi.fn().mockResolvedValue([{ id: 'a1', name: 'Acme', reviewStatus: 'pending' }]);
        vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ listAgencies }));
        const res = await request(createApp())
            .get('/superadmin/agencies')
            .set('Authorization', `Bearer ${platformToken()}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });
    it('approves an agency and audits it', async () => {
        const setAgencyReview = vi.fn().mockResolvedValue({ id: 'a1', name: 'Acme' });
        vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ setAgencyReview }));
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: vi.fn().mockResolvedValue({}) }));
        const res = await request(createApp())
            .post('/superadmin/agencies/a1/approve')
            .set('Authorization', `Bearer ${platformToken()}`)
            .send({});
        expect(res.status).toBe(200);
        expect(res.body.reviewStatus).toBe('approved');
        expect(setAgencyReview).toHaveBeenCalledWith('a1', 'approved', USERNAME, null);
    });
    it('404s approving an unknown agency', async () => {
        vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({
            setAgencyReview: vi.fn().mockResolvedValue(null),
        }));
        const res = await request(createApp())
            .post('/superadmin/agencies/missing/approve')
            .set('Authorization', `Bearer ${platformToken()}`)
            .send({});
        expect(res.status).toBe(404);
    });
    it('returns platform stats with a valid token', async () => {
        const getPlatformStats = vi.fn().mockResolvedValue({ agencies: { total: 6 }, users: { total: 9, byRole: {} } });
        vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ getPlatformStats }));
        const res = await request(createApp())
            .get('/superadmin/stats')
            .set('Authorization', `Bearer ${platformToken()}`);
        expect(res.status).toBe(200);
        expect(res.body.agencies.total).toBe(6);
    });
    it('blocks stats without a platform token', async () => {
        const res = await request(createApp()).get('/superadmin/stats');
        expect(res.status).toBe(401);
    });
    it('returns the global activity feed', async () => {
        const getRecentActivity = vi.fn().mockResolvedValue([{ id: 'e1', eventType: 'agency.review.approved' }]);
        vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ getRecentActivity }));
        const res = await request(createApp())
            .get('/superadmin/activity?limit=10')
            .set('Authorization', `Bearer ${platformToken()}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });
    it('returns an agency drill-down detail', async () => {
        const getAgencyDetail = vi.fn().mockResolvedValue({ id: 'a1', name: 'Acme', users: [], recentActivity: [] });
        vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ getAgencyDetail }));
        const res = await request(createApp())
            .get('/superadmin/agencies/a1')
            .set('Authorization', `Bearer ${platformToken()}`);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Acme');
    });
    it('suspends a user and audits it', async () => {
        const setUserSuspended = vi.fn().mockResolvedValue({ agencyId: 'a1', email: 'x@y.z' });
        vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ setUserSuspended }));
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: vi.fn().mockResolvedValue({}) }));
        const res = await request(createApp())
            .post('/superadmin/users/u1/suspend')
            .set('Authorization', `Bearer ${platformToken()}`)
            .send({});
        expect(res.status).toBe(200);
        expect(res.body.suspended).toBe(true);
        expect(setUserSuspended).toHaveBeenCalledWith('u1', true);
    });
});
//# sourceMappingURL=superadmin-routes.test.js.map