/**
 * RayVerify identity verification.
 *
 * A caregiver consents once, enrolls a reference selfie, and each clock-in
 * selfie is compared against it.
 *
 * THE CONSENT GATE IS THE POINT. Face images are biometric identifiers: PHI
 * under HIPAA, and separately governed by state biometric statutes (Illinois
 * BIPA and friends) that require informed consent BEFORE collection and
 * destruction on revocation. Every capture endpoint here refuses to store
 * anything without a live consent row, and revoking consent deletes both the
 * enrollment row and the stored image. That is enforced in code because a
 * policy nobody executes is not a defense.
 *
 * WHAT THIS DOES NOT DO: liveness. Face match answers "who is in this frame",
 * not "was a person physically present". A photograph of a photograph passes.
 * Every result carries `livenessChecked: false` so no caller, and no marketing
 * page, can quietly assume otherwise. See docs/rayverify-integration.md §7.
 */
import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { IdentityRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
import { S3StorageService } from '../services/s3-storage.js';
import {
  getFaceMatchClient,
  isIdentityVerificationConfigured,
} from '../identity/face-match-client.js';

const router = Router();

/**
 * The consent text a caregiver agrees to. Stored verbatim on the consent row,
 * so a later dispute can show exactly what was presented. Bump the version
 * whenever the wording changes; an old consent does not cover new wording.
 */
export const CONSENT_VERSION = '2026-08-04.1';
export const CONSENT_TEXT = [
  'I agree that RayHealth may collect and store a photograph of my face, and',
  'compare photographs taken when I clock in against it, to confirm that I am',
  'the person working the visit.',
  '',
  'My photographs are stored encrypted, are used only for this purpose, are',
  'never sold or shared for advertising, and are deleted when I withdraw this',
  'agreement or when my account is closed.',
  '',
  'I can withdraw this agreement at any time in the RayHealth app, and my',
  'stored photograph will be deleted.',
].join(' ');

/**
 * Decoded image cap. A selfie for face matching does not need to be large:
 * Rekognition wants roughly 80px of face width, and a compressed front-camera
 * photo lands far under this. Kept in step with the 3MB body limit mounted for
 * this path in app.ts, which allows for base64's expansion.
 */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const imageSchema = z.object({
  imageBase64: z.string().min(100),
});
const captureSchema = imageSchema.extend({
  visitId: z.string().uuid().optional(),
});

function decodeImage(base64: string): Buffer | null {
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, '');
  try {
    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
    return buffer;
  } catch {
    return null;
  }
}

/** Object keys are namespaced per agency so a retention sweep can scope by prefix. */
function referenceKey(agencyId: string, caregiverId: string): string {
  return `identity/${agencyId}/${caregiverId}/reference.jpg`;
}
function captureKey(agencyId: string, caregiverId: string, stamp: string): string {
  return `identity/${agencyId}/${caregiverId}/captures/${stamp}.jpg`;
}

// GET /identity/status, what this caregiver has consented to and enrolled
router.get('/status', requireCapability('evv.read'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Identity verification applies to caregivers' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new IdentityRepository(db);
    const [consent, enrollment] = await Promise.all([
      repo.findActiveConsent(req.auth.caregiverId, req.auth.agencyId),
      repo.findEnrollment(req.auth.caregiverId, req.auth.agencyId),
    ]);
    res.json({
      configured: isIdentityVerificationConfigured(),
      consented: consent !== null,
      consentVersion: consent?.consentVersion ?? null,
      enrolled: enrollment !== null,
      enrolledAt: enrollment?.enrolledAt ?? null,
      consentText: CONSENT_TEXT,
      currentConsentVersion: CONSENT_VERSION,
      // Stated in the API, not just the UI, so an integrator cannot mistake
      // face match for proof of physical presence.
      livenessSupported: false,
    });
  } catch (error) {
    safeError('identity status failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /identity/consent, record informed consent
router.post('/consent', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Identity verification applies to caregivers' });
  }
  const version = typeof req.body?.consentVersion === 'string' ? req.body.consentVersion : '';
  // The client echoes back the version it displayed. A mismatch means the app
  // showed different wording than this server would record, so refuse rather
  // than store a consent whose text we cannot vouch for.
  if (version !== CONSENT_VERSION) {
    return res.status(409).json({
      message: 'Consent wording has changed. Please reopen the screen and read the current text.',
      currentConsentVersion: CONSENT_VERSION,
    });
  }
  try {
    const db = req.app.get('db') as Knex;
    const consent = await new IdentityRepository(db).grantConsent({
      agencyId: req.auth.agencyId,
      caregiverId: req.auth.caregiverId,
      consentText: CONSENT_TEXT,
      consentVersion: CONSENT_VERSION,
    });
    res.status(201).json({ consentVersion: consent.consentVersion, grantedAt: consent.grantedAt });
  } catch (error) {
    safeError('identity consent failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /identity/consent, withdraw and destroy the enrollment
router.delete('/consent', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Identity verification applies to caregivers' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const { referenceKey: retiredKey } = await new IdentityRepository(db).revokeConsent(
      req.auth.caregiverId,
      req.auth.agencyId,
    );
    // Destruction, not just a flag: biometric statutes require the data to go.
    // A storage failure must not leave the caregiver believing it is gone, so
    // it is surfaced rather than swallowed.
    if (retiredKey) {
      try {
        await new S3StorageService().deleteObject(retiredKey);
      } catch (error) {
        safeError('identity reference deletion failed', error);
        return res.status(500).json({
          message:
            'Your consent was withdrawn but the stored photo could not be deleted. Please contact your agency.',
        });
      }
    }
    res.status(204).end();
  } catch (error) {
    safeError('identity revoke failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /identity/enroll, store the reference selfie
router.post('/enroll', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Identity verification applies to caregivers' });
  }
  const parsed = imageSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'A photo is required' });
  }
  const image = decodeImage(parsed.data.imageBase64);
  if (!image) {
    return res.status(400).json({ message: 'That photo could not be read. Please retake it.' });
  }

  try {
    const db = req.app.get('db') as Knex;
    const repo = new IdentityRepository(db);
    // THE GATE: nothing biometric is stored without live consent.
    if (!(await repo.hasActiveConsent(req.auth.caregiverId, req.auth.agencyId))) {
      return res.status(403).json({ message: 'CONSENT_REQUIRED', code: 'CONSENT_REQUIRED' });
    }

    const key = referenceKey(req.auth.agencyId, req.auth.caregiverId);
    const storage = new S3StorageService();
    await storage.uploadDocument({ key, body: image, contentType: 'image/jpeg' });

    const { previousKey } = await repo.upsertEnrollment({
      agencyId: req.auth.agencyId,
      caregiverId: req.auth.caregiverId,
      referenceKey: key,
    });
    // Re-enrolling overwrites the same key, so a differing previous key is the
    // only case with an orphan to clean up.
    if (previousKey && previousKey !== key) {
      try {
        await storage.deleteObject(previousKey);
      } catch (error) {
        safeError('superseded reference deletion failed', error);
      }
    }

    res.status(201).json({ enrolled: true });
  } catch (error) {
    safeError('identity enroll failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /identity/verify, compare a clock-in selfie against the enrollment
router.post('/verify', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Identity verification applies to caregivers' });
  }
  const parsed = captureSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'A photo is required' });
  }
  const image = decodeImage(parsed.data.imageBase64);
  if (!image) {
    return res.status(400).json({ message: 'That photo could not be read. Please retake it.' });
  }

  const db = req.app.get('db') as Knex;
  const repo = new IdentityRepository(db);
  const caregiverId = req.auth.caregiverId;
  const agencyId = req.auth.agencyId;

  try {
    if (!(await repo.hasActiveConsent(caregiverId, agencyId))) {
      return res.status(403).json({ message: 'CONSENT_REQUIRED', code: 'CONSENT_REQUIRED' });
    }

    const enrollment = await repo.findEnrollment(caregiverId, agencyId);
    if (!enrollment) {
      await repo.recordVerification({
        agencyId,
        caregiverId,
        visitId: parsed.data.visitId ?? null,
        outcome: 'not_enrolled',
        provider: 'none',
      });
      return res.status(409).json({ outcome: 'not_enrolled', code: 'NOT_ENROLLED' });
    }

    const storage = new S3StorageService();
    const reference = await storage.getObject(enrollment.referenceKey);
    const result = await getFaceMatchClient().compare(reference, image);

    // The capture is kept only when it did NOT match. A matched selfie is
    // biometric data with no remaining purpose, and storing one per visit
    // would build a face archive nobody needs; a mismatch is evidence an
    // agency may have to review.
    let storedCaptureKey: string | null = null;
    if (result.outcome === 'not_matched') {
      storedCaptureKey = captureKey(agencyId, caregiverId, new Date().toISOString().replace(/[:.]/g, '-'));
      try {
        await storage.uploadDocument({ key: storedCaptureKey, body: image, contentType: 'image/jpeg' });
      } catch (error) {
        safeError('identity capture storage failed', error);
        storedCaptureKey = null;
      }
    }

    await repo.recordVerification({
      agencyId,
      caregiverId,
      visitId: parsed.data.visitId ?? null,
      captureKey: storedCaptureKey,
      outcome: result.outcome === 'not_configured' ? 'not_configured' : result.outcome,
      similarity: result.similarity,
      provider: result.provider,
    });

    if (parsed.data.visitId) {
      await repo.markVisitIdentity(
        parsed.data.visitId,
        agencyId,
        result.outcome === 'not_configured' ? 'not_configured' : result.outcome,
        result.similarity,
      );
    }

    res.json({
      outcome: result.outcome,
      similarity: result.similarity,
      // Never inferred by the client: face match is not presence.
      livenessChecked: result.livenessChecked,
    });
  } catch (error) {
    safeError('identity verify failed', error);
    try {
      await repo.recordVerification({
        agencyId,
        caregiverId,
        visitId: parsed.data.visitId ?? null,
        outcome: 'error',
        provider: 'unknown',
      });
    } catch {
      /* the response below is what matters */
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
