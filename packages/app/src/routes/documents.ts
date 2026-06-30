/**
 * Prior-authorization document upload.
 *
 * Stores the source PDF in the BAA-covered S3 bucket, scoped per tenant and per
 * client, and returns a short-lived presigned URL plus the stored object key.
 *
 * Security posture (this route handles PHI-bearing documents):
 *  - Auth + tenant scope come from req.auth (set by authContext); never from
 *    request-supplied fields.
 *  - requireCapability('client.write') gates the write, matching the
 *    authorization routes these documents belong to.
 *  - The target client must belong to the caller's agency.
 *  - File content is validated by magic bytes (%PDF-), not the client-supplied
 *    Content-Type, which is trivially spoofable.
 *  - The original filename is sanitized before it becomes part of the S3 key.
 *  - Every upload writes an append-only audit_events row via the repository
 *    (correct schema + agency attribution), not an ad-hoc insert.
 *
 * NOTE: automated field extraction (client name / dates / authorized hours /
 * HCPCS) is intentionally NOT performed here yet. The previous WIP used Google
 * Document AI, a non-BAA vendor; auto-extraction is deferred to a follow-up
 * built on a BAA-covered service (Amazon Textract). Until then, structured
 * authorization data is entered through the existing /authorizations flow and
 * this endpoint attaches the source document.
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { AuditEventRepository, ClientRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { S3StorageService } from '../services/s3-storage.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

// In-memory storage keeps the route stateless/serverless-friendly. The real
// content check happens after multer hands us the buffer (magic bytes); the
// mimetype filter here is only a cheap first pass.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  },
});

/** A PDF always starts with the bytes `%PDF-`. */
function looksLikePdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * Reduce an attacker-controlled filename to a safe, bounded token suitable for
 * use inside an S3 key. Strips path separators and anything outside a small
 * allowlist, collapses runs, and caps length. Falls back to 'document'.
 */
function sanitizeFilename(name: string): string {
  const base = name.replace(/\.[Pp][Dd][Ff]$/, '');
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);
  return cleaned.length > 0 ? cleaned : 'document';
}

router.post(
  '/prior-auth/upload',
  requireCapability('client.write'),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, agencyId, authMethod } = req.auth;

    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'Missing file upload (field "file").' });
      return;
    }

    if (!looksLikePdf(file.buffer)) {
      res.status(400).json({ message: 'Prior authorizations must be a valid PDF.' });
      return;
    }

    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId : '';
    if (!clientId) {
      res.status(400).json({ message: 'clientId is required.' });
      return;
    }

    try {
      const db = req.app.get('db');

      // Tenant isolation: the document can only be attached to a client in the
      // caller's own agency.
      const clientRepo = new ClientRepository(db);
      const inAgency = await clientRepo.clientBelongsToAgency(clientId, agencyId);
      if (!inAgency) {
        res.status(404).json({ message: 'client not found in this agency' });
        return;
      }

      const safeName = sanitizeFilename(file.originalname || 'document');
      // ISO timestamp without separators keeps keys sortable and filesystem-safe.
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const key = `agencies/${agencyId}/prior-authorizations/${clientId}/${stamp}-${safeName}.pdf`;

      const storage = new S3StorageService();
      const { uri } = await storage.uploadDocument({
        key,
        body: file.buffer,
        contentType: 'application/pdf',
        metadata: { agencyId, clientId, uploadedBy: userId },
      });

      const signedUrl = await storage.getSignedDownloadUrl({ key });

      await new AuditEventRepository(db).create({
        agencyId,
        actorId: userId,
        actorType: 'user',
        eventType: 'phi.create',
        entityType: 'document',
        entityId: clientId,
        outcome: 'success',
        payload: { kind: 'prior-authorization', key, sizeBytes: file.size, authMethod },
        occurredAt: new Date().toISOString(),
      });

      res.status(201).json({ success: true, key, uri, signedUrl });
    } catch (error) {
      safeError('prior-auth document upload failed', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
);

export default router;
