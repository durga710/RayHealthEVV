import type { CaregiverCredential } from '../domain/caregiver.js';
import { paCredentialTypes, type PaCredentialType } from '../config/pennsylvania.js';

export interface CredentialComplianceResult {
  compliant: boolean;
  expiringSoon: CaregiverCredential[];
  expired: CaregiverCredential[];
  missing: PaCredentialType[];
}

/** Booking-time verdict: `blocks` non-empty → refuse the booking (409). */
export interface CredentialBookingGate {
  /** Hard stops , the caregiver has demonstrably lapsed credentials. */
  blocks: string[];
  /** Advisories (missing / expiring soon / pending verification). */
  warnings: string[];
}

const EXPIRY_WARNING_DAYS = 30;

export class CredentialComplianceService {
  evaluate(credentials: CaregiverCredential[]): CredentialComplianceResult {
    // `expiresAt` is date-only (YYYY-MM-DD), so compare calendar dates
    // lexicographically, never instants: new Date('YYYY-MM-DD') is UTC
    // midnight, which would flip a credential to "expired" the prior evening
    // in US timezones. A credential is valid through the whole of its listed
    // expiry day.
    const today = new Date().toISOString().slice(0, 10);
    const warnThreshold = new Date(Date.now() + EXPIRY_WARNING_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const expired = credentials.filter(c => c.status === 'expired' || c.expiresAt < today);
    const expiringSoon = credentials.filter(
      c => c.status === 'active' && c.expiresAt >= today && c.expiresAt <= warnThreshold,
    );

    const presentTypes = new Set(credentials.map(c => c.credentialType));
    const missing = paCredentialTypes.filter(t => !presentTypes.has(t)) as PaCredentialType[];

    return {
      compliant: expired.length === 0 && missing.length === 0,
      expiringSoon,
      expired,
      missing,
    };
  }

  /**
   * The booking-time credential gate shared by assignment creation, reschedule,
   * and recurring-schedule creation.
   *
   * Expired credentials (by status or date) are the only hard stop: the lapse
   * is demonstrated, so new bookings must wait for the renewal. Everything else
   * is an advisory , a caregiver with no credentials entered yet is an agency
   * mid-onboarding, not a proven lapse, and blocking there would freeze every
   * schedule until the back-office catches up on data entry.
   */
  gateForBooking(credentials: CaregiverCredential[]): CredentialBookingGate {
    const { expired, expiringSoon, missing } = this.evaluate(credentials);
    const expiredSet = new Set(expired);
    // A pending credential whose date already lapsed is reported as expired.
    const pending = credentials.filter((c) => c.status === 'pending' && !expiredSet.has(c));
    const types = (list: CaregiverCredential[]) =>
      [...new Set(list.map((c) => c.credentialType))].join(', ');

    const blocks = expired.length
      ? [`Caregiver has expired credentials: ${types(expired)}. Renew them before booking new visits.`]
      : [];

    const warnings: string[] = [];
    if (missing.length) {
      warnings.push(`Caregiver has no ${missing.join(', ')} credential on file.`);
    }
    if (expiringSoon.length) {
      warnings.push(
        `Caregiver credentials expire within ${EXPIRY_WARNING_DAYS} days: ${types(expiringSoon)}.`,
      );
    }
    if (pending.length) {
      warnings.push(`Caregiver credentials pending verification: ${types(pending)}.`);
    }
    return { blocks, warnings };
  }
}
