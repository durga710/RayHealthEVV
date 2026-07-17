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
    const now = new Date();
    const warnThreshold = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);

    const expired = credentials.filter(c => c.status === 'expired' || new Date(c.expiresAt) < now);
    const expiringSoon = credentials.filter(c => {
      const exp = new Date(c.expiresAt);
      return c.status === 'active' && exp >= now && exp <= warnThreshold;
    });

    const presentTypes = new Set(credentials.map(c => c.credentialType));
    const missing = paCredentialTypes.filter(t => !presentTypes.has(t)) as PaCredentialType[];

    return {
      compliant: expired.length === 0 && missing.length === 0,
      expiringSoon,
      expired,
      missing,
    };
  }

  isEligibleForAssignment(credentials: CaregiverCredential[]): boolean {
    return this.evaluate(credentials).compliant;
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
