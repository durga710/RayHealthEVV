/**
 * Pure helpers for the mileage screen: input parsing and display formatting.
 * No React Native imports, so it is unit-testable.
 */

export type MileageStatus = 'submitted' | 'approved' | 'rejected';

export interface MileageEntry {
  id: string;
  tripDate: string;
  milesHundredths: number;
  purpose: string | null;
  status: MileageStatus;
  reviewNote: string | null;
}

export type ParsedMiles = { ok: true; miles: number } | { ok: false; error: string };

/**
 * Parse what a caregiver typed into the miles box.
 *
 * Deliberately strict about the failure messages: "Enter miles" and "That
 * looks too high" are actionable, where a generic "invalid input" leaves
 * somebody staring at a form they cannot submit. The 500 ceiling matches the
 * server's typo guard, so the client never sends something the API will
 * bounce.
 */
export function parseMiles(raw: string): ParsedMiles {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, error: 'Enter how many miles you drove.' };
  if (!/^\d{0,4}(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: 'Enter miles as a number, like 12.4.' };
  }
  const miles = Number(trimmed);
  if (!Number.isFinite(miles) || miles <= 0) {
    return { ok: false, error: 'Miles must be more than zero.' };
  }
  if (miles > 500) return { ok: false, error: 'That looks too high. Check the number.' };
  return { ok: true, miles };
}

/** Hundredths of a mile to a display string, e.g. 1234 becomes "12.34 mi". */
export function formatMiles(hundredths: number): string {
  return `${(hundredths / 100).toFixed(2)} mi`;
}

/** Total of a set of entries, in hundredths, so callers stay integral. */
export function totalHundredths(entries: MileageEntry[]): number {
  return entries.reduce((sum, e) => sum + e.milesHundredths, 0);
}

/**
 * Totals split by review state. Agencies pay on approved trips, so a
 * caregiver needs to see approved and still-pending as separate numbers
 * rather than one blended figure that overstates what is actually coming.
 */
export function summarize(entries: MileageEntry[]): {
  approvedHundredths: number;
  submittedHundredths: number;
  rejectedCount: number;
} {
  let approvedHundredths = 0;
  let submittedHundredths = 0;
  let rejectedCount = 0;
  for (const e of entries) {
    if (e.status === 'approved') approvedHundredths += e.milesHundredths;
    else if (e.status === 'submitted') submittedHundredths += e.milesHundredths;
    else rejectedCount += 1;
  }
  return { approvedHundredths, submittedHundredths, rejectedCount };
}

/** Today as YYYY-MM-DD, the default trip date. */
export function todayYmd(now: Date): string {
  return now.toISOString().slice(0, 10);
}
