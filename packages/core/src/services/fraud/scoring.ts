import type { DetectionResult, FraudSignalType, FraudStatus, RiskLevel } from './types.js';

/**
 * Relative trust/impact weight per signal. Higher = a triggered signal of this
 * type pushes the composite score harder. Agency-overridable later.
 */
const WEIGHTS: Record<FraudSignalType, number> = {
  impossible_travel: 1.0,
  duplicate_visit: 0.9,
  gps_anomaly: 0.85,
  abnormal_duration: 0.6,
};

export interface ScoreFactor {
  type: FraudSignalType;
  severity: number;
  weight: number;
  /** Share of the final score attributed to this signal, 0–1. */
  contribution: number;
  explanation: string;
}

export interface CompositeScore {
  /** 0–100 fused fraud score. */
  score: number;
  riskLevel: RiskLevel;
  status: FraudStatus;
  factors: ScoreFactor[];
  triggeredCount: number;
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/** The reviewer-facing verdict. REVIEW opens at 30 so a single strong signal lands there. */
export function scoreToStatus(score: number): FraudStatus {
  if (score >= 70) return 'rejected';
  if (score >= 30) return 'review';
  return 'verified';
}

/**
 * Fuse individual detector outputs into one explainable 0–100 score using a
 * weighted noisy-OR: each triggered signal contributes p_i = (severity/100)·w_i,
 * combined as 1 − Π(1 − p_i). This caps naturally at 100 (no arbitrary clipping),
 * lets a single strong signal score high, rewards multiple independent signals
 * (collusion is rarely one red flag), and yields per-signal contributions for
 * the explainability requirement.
 */
export function fuse(results: DetectionResult[]): CompositeScore {
  const triggered = results.filter((r) => r.triggered && r.severity > 0);

  if (triggered.length === 0) {
    return { score: 0, riskLevel: 'low', status: 'verified', factors: [], triggeredCount: 0 };
  }

  let complement = 1;
  const weighted = triggered.map((r) => {
    const weight = WEIGHTS[r.type] ?? 0.7;
    const p = Math.min(1, (r.severity / 100) * weight);
    complement *= 1 - p;
    return { r, weight, p };
  });

  const score = Math.round((1 - complement) * 100);

  const pSum = weighted.reduce((acc, w) => acc + w.p, 0) || 1;
  const factors: ScoreFactor[] = weighted
    .map(({ r, weight, p }) => ({
      type: r.type,
      severity: r.severity,
      weight,
      contribution: +(p / pSum).toFixed(4),
      explanation: r.explanation,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  return {
    score,
    riskLevel: scoreToRiskLevel(score),
    status: scoreToStatus(score),
    factors,
    triggeredCount: triggered.length,
  };
}
