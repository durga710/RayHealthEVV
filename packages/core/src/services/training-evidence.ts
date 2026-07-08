/**
 * Point-in-time training evidence for audit packets.
 *
 * A Medicaid auditor asks "was this caregiver trained and current when this
 * visit happened?", which is a question about the completion LOG, not the
 * enrollment's current status. A course completed after the visit does not
 * cover the visit; a completion that had already expired by the visit date
 * does not cover it either. This module evaluates the append-only
 * course_completions history against one instant in time.
 */

export interface TrainingCompletionRecord {
  /** ISO timestamp the completion was recorded. */
  completedAt: string;
  /** 0-100 quiz score, null for courses without a knowledge check. */
  score: number | null;
}

/** One enrolled course with its full completion history (newest first). */
export interface CaregiverTrainingRecord {
  courseId: string;
  code: string;
  title: string;
  required: boolean;
  cadence: string;
  /** Days a completion stays valid, null = never expires. */
  expiresAfterDays: number | null;
  dueAt: string | null;
  completions: TrainingCompletionRecord[];
}

export interface EvaluatedTrainingRecord {
  courseId: string;
  code: string;
  title: string;
  required: boolean;
  cadence: string;
  /** Was the course completed and unexpired at the evaluation instant? */
  coveredAtTime: boolean;
  /** The completion that covered the instant, if any. */
  coveringCompletedAt: string | null;
  /** When that covering completion expires, null = never. */
  coveringExpiresAt: string | null;
  /** Score of the covering completion (or the latest one when uncovered). */
  score: number | null;
}

export interface TrainingEvidence {
  /** Every REQUIRED course was covered at the instant. */
  compliantAtTime: boolean;
  records: EvaluatedTrainingRecord[];
}

function expiryOf(completedAt: string, expiresAfterDays: number | null): string | null {
  if (expiresAfterDays == null) return null;
  return new Date(new Date(completedAt).getTime() + expiresAfterDays * 86_400_000).toISOString();
}

/**
 * Evaluate a caregiver's training records against one instant (usually the
 * visit clock-in). A completion covers the instant when it happened at or
 * before it and had not expired by it.
 */
export function evaluateTrainingAtTime(
  records: CaregiverTrainingRecord[],
  atIso: string,
): TrainingEvidence {
  const at = new Date(atIso).getTime();
  let compliantAtTime = true;

  const evaluated = records.map((record): EvaluatedTrainingRecord => {
    // Newest-first history: the first completion at-or-before the instant is
    // the most recent one that could cover it.
    const covering = record.completions.find((c) => {
      const completed = new Date(c.completedAt).getTime();
      if (completed > at) return false;
      const expiry = expiryOf(c.completedAt, record.expiresAfterDays);
      return expiry == null || new Date(expiry).getTime() > at;
    });

    if (!covering && record.required) compliantAtTime = false;

    return {
      courseId: record.courseId,
      code: record.code,
      title: record.title,
      required: record.required,
      cadence: record.cadence,
      coveredAtTime: Boolean(covering),
      coveringCompletedAt: covering?.completedAt ?? null,
      coveringExpiresAt: covering ? expiryOf(covering.completedAt, record.expiresAfterDays) : null,
      score: covering?.score ?? record.completions[0]?.score ?? null,
    };
  });

  return { compliantAtTime, records: evaluated };
}
