/**
 * ERA / 835 remittance parser.
 *
 * The back half of the billing loop. After we send an 837P claim, the payer
 * returns an 835 Electronic Remittance Advice telling us, per claim, what was
 * charged / paid / adjusted / denied. This module parses the 835 EDI text into
 * structured per-claim records that the posting path matches back onto our
 * claims (by the patient control number we put in CLM01 → echoed in CLP01).
 *
 * Scope: BPR (total paid), TRN (check/EFT trace), CLP (claim payment), CAS
 * (adjustments , claim-level before any SVC, line-level after), SVC (service
 * line payment), DTM*472 (line service date), LQ (RARC remark codes), and MOA
 * (claim-level outpatient remark codes). Separators are auto-detected from the
 * ISA envelope when present, and otherwise default to '*' (element) and '~'
 * (segment); newlines are tolerated.
 */

import { describeCarc } from './carc-rarc.js';

export interface Era835Adjustment {
  group: string; // CAS01. CO (contractual), PR (patient resp), OA, PI, CR
  reasonCode: string; // CAS02. CARC code (e.g. 45, 97, 16)
  amountCents: number; // CAS03
}

export interface Era835ServiceLine {
  /** SVC01-2, the HCPCS/procedure code ('HC:T1019' → 'T1019'). */
  procedureCode: string;
  /** SVC01-3.., modifiers when present. */
  modifiers: string[];
  chargeCents: number; // SVC02
  paidCents: number; // SVC03
  units: number; // SVC05 (defaults to 1 when absent, per spec)
  /** DTM*472 service date, YYYY-MM-DD. */
  serviceDate: string | null;
  adjustments: Era835Adjustment[];
  /** LQ*HE remark codes (RARCs) attached to this line. */
  remarkCodes: string[];
}

export type Era835DerivedStatus = 'paid' | 'partial' | 'denied' | 'reversed';

export interface Era835Claim {
  controlNumber: string; // CLP01, our patient control number
  statusCode: string; // CLP02, 1 paid, 2/3 secondary/tertiary, 4 denied, 22 reversal
  chargeCents: number; // CLP03
  paidCents: number; // CLP04
  patientResponsibilityCents: number; // CLP05
  payerClaimControlNumber: string | null; // CLP07
  /** Claim-level adjustments (CAS segments before any SVC). */
  adjustments: Era835Adjustment[];
  /** Claim-level RARCs (MOA03-07 + LQ before any SVC). */
  remarkCodes: string[];
  /** Per-service-line payment detail (SVC loops), empty when the payer
   *  remits at claim level only. */
  lines: Era835ServiceLine[];
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
  // The active SVC loop: CAS/LQ/DTM segments after an SVC belong to that line
  // until the next SVC or CLP starts. Null while in the claim-level header.
  let currentLine: Era835ServiceLine | null = null;

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
        remarkCodes: [],
        lines: [],
        derivedStatus: deriveStatus(el[2] ?? '', chargeCents, paidCents),
      };
      currentLine = null;
      claims.push(current);
    } else if (tag === 'SVC' && current) {
      // SVC01 is a composite: qualifier:procedure[:modifiers...]. The composite
      // separator is ':' in practice; tolerate a bare code too.
      const parts = (el[1] ?? '').split(':');
      const procedureCode = parts.length > 1 ? parts[1] : parts[0];
      currentLine = {
        procedureCode,
        modifiers: parts.slice(2).filter(Boolean),
        chargeCents: dollarsToCents(el[2]),
        paidCents: dollarsToCents(el[3]),
        units: el[5] && Number.isFinite(Number(el[5])) ? Number(el[5]) : 1,
        serviceDate: null,
        adjustments: [],
        remarkCodes: [],
      };
      current.lines.push(currentLine);
    } else if (tag === 'DTM' && el[1] === '472' && currentLine) {
      // Service date, CCYYMMDD → YYYY-MM-DD.
      const d = el[2] ?? '';
      currentLine.serviceDate = /^\d{8}$/.test(d)
        ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
        : null;
    } else if (tag === 'LQ' && current) {
      // LQ*HE*<RARC>: payer remark code, line-level inside an SVC loop,
      // claim-level before any SVC.
      const code = el[2];
      if (code && el[1] === 'HE') {
        (currentLine ?? current).remarkCodes.push(code);
      }
    } else if (tag === 'MOA' && current) {
      // MOA03-07 carry claim-level RARCs.
      for (let i = 3; i <= 7; i++) {
        if (el[i]) current.remarkCodes.push(el[i]);
      }
    } else if (tag === 'CAS' && current) {
      // CAS = group, then repeating (reasonCode, amount, quantity) triplets.
      // Belongs to the open SVC line when one is active, else to the claim.
      const target = currentLine ?? current;
      const group = el[1] ?? '';
      for (let i = 2; i + 1 < el.length; i += 3) {
        const reasonCode = el[i];
        const amount = el[i + 1];
        if (!reasonCode) continue;
        target.adjustments.push({
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

/**
 * Every adjustment on a claim: claim-level CAS plus all service-line CAS.
 * Line-level detail moved onto `lines` when SVC parsing landed; callers that
 * want "why was money removed from this claim" (status_reason, denial scoring)
 * still need the full roll-up.
 */
export function allAdjustments(claim: Era835Claim): Era835Adjustment[] {
  return [...claim.adjustments, ...claim.lines.flatMap((l) => l.adjustments)];
}

/**
 * Human-readable reason string built from CAS adjustments (for status_reason).
 * Includes the CARC's plain-English description when the dictionary knows it:
 * "CO/45 (Charge exceeds fee schedule / maximum allowable amount): $12.00".
 */
export function summarizeAdjustments(adjustments: Era835Adjustment[]): string | null {
  if (adjustments.length === 0) return null;
  return adjustments
    .map((a) => {
      const desc = describeCarc(a.reasonCode);
      const code = desc ? `${a.group}/${a.reasonCode} (${desc})` : `${a.group}/${a.reasonCode}`;
      return `${code}: $${(a.amountCents / 100).toFixed(2)}`;
    })
    .join('; ');
}
