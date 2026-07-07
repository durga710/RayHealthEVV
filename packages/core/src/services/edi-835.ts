/**
 * ERA / 835 remittance parser.
 *
 * The back half of the billing loop. After we send an 837P claim, the payer
 * returns an 835 Electronic Remittance Advice telling us, per claim, what was
 * charged / paid / adjusted / denied. This module parses the 835 EDI text into
 * structured per-claim records that the posting path matches back onto our
 * claims (by the patient control number we put in CLM01 → echoed in CLP01).
 *
 * Pragmatic scope: we read the segments that carry claim-level money and
 * identity. BPR (total paid), TRN (check/EFT trace), CLP (claim payment), and
 * CAS (adjustments). Service-line (SVC) detail is summarized at the claim level
 * via CAS. Separators are auto-detected from the ISA envelope when present, and
 * otherwise default to '*' (element) and '~' (segment); newlines are tolerated.
 */

export interface Era835Adjustment {
  group: string; // CAS01. CO (contractual), PR (patient resp), OA, PI, CR
  reasonCode: string; // CAS02. CARC code (e.g. 45, 97, 16)
  amountCents: number; // CAS03
}

export type Era835DerivedStatus = 'paid' | 'partial' | 'denied' | 'reversed';

export interface Era835Claim {
  controlNumber: string; // CLP01, our patient control number
  statusCode: string; // CLP02, 1 paid, 2/3 secondary/tertiary, 4 denied, 22 reversal
  chargeCents: number; // CLP03
  paidCents: number; // CLP04
  patientResponsibilityCents: number; // CLP05
  payerClaimControlNumber: string | null; // CLP07
  adjustments: Era835Adjustment[];
  derivedStatus: Era835DerivedStatus;
}

export interface Era835 {
  traceNumber: string | null; // TRN02
  totalPaidCents: number; // BPR02
  claims: Era835Claim[];
}

function dollarsToCents(v: string | undefined): number {
  if (v === undefined || v.trim() === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function deriveStatus(statusCode: string, chargeCents: number, paidCents: number): Era835DerivedStatus {
  if (statusCode === '22') return 'reversed';
  if (statusCode === '4') return 'denied';
  if (paidCents <= 0) return 'denied';
  if (paidCents < chargeCents) return 'partial';
  return 'paid';
}

/**
 * Parse 835 EDI text into a structured remittance. Throws if the file contains
 * no CLP (claim payment) segments, i.e. it isn't a recognizable 835.
 */
export function parse835(text: string): Era835 {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (!trimmed) throw new Error('Empty remittance file');

  // Detect separators from the ISA envelope (fixed 106-char segment) when present.
  let elementSep = '*';
  let segTerm = '~';
  if (trimmed.startsWith('ISA') && trimmed.length > 105) {
    elementSep = trimmed[3];
    segTerm = trimmed[105];
  }

  // Split into segments. Tolerate the segment terminator OR a bare newline so
  // human-prettified files (one segment per line) still parse.
  const rawSegments = trimmed
    .split(segTerm)
    .flatMap((s) => (segTerm === '\n' ? [s] : s.split(/\r?\n/)))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const claims: Era835Claim[] = [];
  let traceNumber: string | null = null;
  let totalPaidCents = 0;
  let current: Era835Claim | null = null;

  for (const seg of rawSegments) {
    const el = seg.split(elementSep).map((e) => e.trim());
    const tag = el[0];

    if (tag === 'BPR') {
      totalPaidCents = dollarsToCents(el[2]);
    } else if (tag === 'TRN') {
      traceNumber = el[2] ? el[2] : traceNumber;
    } else if (tag === 'CLP') {
      const chargeCents = dollarsToCents(el[3]);
      const paidCents = dollarsToCents(el[4]);
      current = {
        controlNumber: el[1] ?? '',
        statusCode: el[2] ?? '',
        chargeCents,
        paidCents,
        patientResponsibilityCents: dollarsToCents(el[5]),
        payerClaimControlNumber: el[7] ? el[7] : null,
        adjustments: [],
        derivedStatus: deriveStatus(el[2] ?? '', chargeCents, paidCents),
      };
      claims.push(current);
    } else if (tag === 'CAS' && current) {
      // CAS = group, then repeating (reasonCode, amount, quantity) triplets.
      const group = el[1] ?? '';
      for (let i = 2; i + 1 < el.length; i += 3) {
        const reasonCode = el[i];
        const amount = el[i + 1];
        if (!reasonCode) continue;
        current.adjustments.push({
          group,
          reasonCode,
          amountCents: dollarsToCents(amount),
        });
      }
    }
  }

  if (claims.length === 0) {
    throw new Error('No claim payment (CLP) segments found, not a recognizable 835 file');
  }

  return { traceNumber, totalPaidCents, claims };
}

/** Map an 835 derived status to a claim row status. */
export function eraStatusToClaimStatus(s: Era835DerivedStatus): 'paid' | 'denied' | 'rejected' {
  if (s === 'denied') return 'denied';
  if (s === 'reversed') return 'rejected';
  return 'paid'; // paid or partial
}

/** Human-readable reason string built from CAS adjustments (for status_reason). */
export function summarizeAdjustments(adjustments: Era835Adjustment[]): string | null {
  if (adjustments.length === 0) return null;
  return adjustments
    .map((a) => `${a.group}/${a.reasonCode}: $${(a.amountCents / 100).toFixed(2)}`)
    .join('; ');
}
