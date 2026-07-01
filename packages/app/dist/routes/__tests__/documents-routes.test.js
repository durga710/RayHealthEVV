import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { S3StorageService } from '../../services/s3-storage.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => {
    setTestJwtSecret();
    // S3StorageService constructor requires a bucket; tests never hit AWS because
    // the upload/getSignedDownloadUrl methods are stubbed below.
    process.env.DOCUMENTS_S3_BUCKET = 'test-bucket';
});
const PDF_BYTES = Buffer.from('%PDF-1.4\n%test\n', 'latin1');
const NOT_PDF_BYTES = Buffer.from('<html>not a pdf</html>', 'utf8');
function stubStorage() {
    vi.spyOn(S3StorageService.prototype, 'uploadDocument').mockResolvedValue({
        uri: 's3://test-bucket/key',
        key: 'key',
    });
    vi.spyOn(S3StorageService.prototype, 'getSignedDownloadUrl').mockResolvedValue('https://signed.example/url');
}
function stubClientInAgency(belongs) {
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ clientBelongsToAgency: vi.fn().mockResolvedValue(belongs) }));
}
describe('documents routes — prior-auth upload', () => {
    afterEach(() => vi.restoreAllMocks());
    it('blocks caregivers (client.write required)', async () => {
        const res = await request(createApp())
            .post('/documents/prior-auth/upload')
            .set('Authorization', `Bearer ${makeToken('caregiver')}`)
            .field('clientId', '00000000-0000-4000-8000-000000000001')
            .attach('file', PDF_BYTES, { filename: 'auth.pdf', contentType: 'application/pdf' });
        expect(res.status).toBe(403);
    });
    it('rejects a non-PDF whose content-type is spoofed to application/pdf', async () => {
        stubClientInAgency(true);
        stubStorage();
        const res = await request(createApp())
            .post('/documents/prior-auth/upload')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .field('clientId', '00000000-0000-4000-8000-000000000001')
            .attach('file', NOT_PDF_BYTES, { filename: 'evil.pdf', contentType: 'application/pdf' });
        expect(res.status).toBe(400);
        expect(S3StorageService.prototype.uploadDocument).not.toHaveBeenCalled();
    });
    it('requires a clientId', async () => {
        stubStorage();
        const res = await request(createApp())
            .post('/documents/prior-auth/upload')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .attach('file', PDF_BYTES, { filename: 'auth.pdf', contentType: 'application/pdf' });
        expect(res.status).toBe(400);
    });
    it('404s when the client is not in the caller agency (no cross-tenant attach)', async () => {
        stubClientInAgency(false);
        stubStorage();
        const res = await request(createApp())
            .post('/documents/prior-auth/upload')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .field('clientId', '00000000-0000-4000-8000-000000000099')
            .attach('file', PDF_BYTES, { filename: 'auth.pdf', contentType: 'application/pdf' });
        expect(res.status).toBe(404);
        expect(S3StorageService.prototype.uploadDocument).not.toHaveBeenCalled();
    });
    it('uploads, sanitizes the filename into a tenant-scoped key, and audits', async () => {
        stubClientInAgency(true);
        stubStorage();
        const auditCreate = vi.fn().mockResolvedValue({});
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: auditCreate }));
        const res = await request(createApp())
            .post('/documents/prior-auth/upload')
            .set('Authorization', `Bearer ${makeToken('admin', 'agency-7', 'user-9')}`)
            .field('clientId', '00000000-0000-4000-8000-000000000001')
            .attach('file', PDF_BYTES, {
            filename: '../../../etc/passwd evil name.pdf',
            contentType: 'application/pdf',
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        const uploadArg = S3StorageService.prototype.uploadDocument.mock.calls[0][0];
        // Key is scoped to the caller's agency + client and has no path traversal.
        expect(uploadArg.key).toContain('agencies/agency-7/prior-authorizations/00000000-0000-4000-8000-000000000001/');
        expect(uploadArg.key).not.toContain('..');
        expect(uploadArg.key).not.toContain('/etc/');
        expect(uploadArg.contentType).toBe('application/pdf');
        // The explicit document audit row (distinct from the generic auditLog
        // middleware row) is attributed to the caller's agency + actor, names the
        // client entity, and carries a PHI-free payload.
        const docAudit = auditCreate.mock.calls
            .map((c) => c[0])
            .find((a) => a.entityType === 'document');
        expect(docAudit).toBeDefined();
        expect(docAudit.agencyId).toBe('agency-7');
        expect(docAudit.actorId).toBe('user-9');
        expect(docAudit.eventType).toBe('phi.create');
        expect(docAudit.entityId).toBe('00000000-0000-4000-8000-000000000001');
    });
});
//# sourceMappingURL=documents-routes.test.js.map