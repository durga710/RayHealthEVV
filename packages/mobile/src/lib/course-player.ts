/**
 * Pure step model for the in-app course player. No React Native imports, so it
 * is unit-testable and is the single source of truth for how a course's
 * `modules` payload becomes a guided one-thing-per-screen flow:
 *
 *   overview → each lesson section → video (if any) → each quiz question →
 *   quiz result → done
 *
 * The shapes mirror the server's CourseModules (packages/core/src/domain/
 * learning.ts), declared locally per the mobile convention of not importing
 * @rayhealth/core.
 */

export interface CourseSection {
  title: string;
  content: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  /** 0-based index into options. */
  correct: number;
}

export interface CourseModules {
  objectives: string[];
  sections: CourseSection[];
  note?: string | null;
  videoSearchQuery?: string | null;
  videoUrl?: string | null;
  quiz?: QuizQuestion[] | null;
}

export type PlayerStep =
  | { kind: 'overview' }
  | { kind: 'section'; sectionIndex: number }
  | { kind: 'video' }
  | { kind: 'quiz-question'; questionIndex: number }
  | { kind: 'quiz-result' }
  | { kind: 'done' };

/** Derive the ordered step list for a course. Missing video/quiz/sections just drop out. */
export function buildSteps(modules: CourseModules): PlayerStep[] {
  const steps: PlayerStep[] = [{ kind: 'overview' }];
  modules.sections.forEach((_, sectionIndex) => steps.push({ kind: 'section', sectionIndex }));
  if (modules.videoUrl) steps.push({ kind: 'video' });
  const quiz = modules.quiz ?? [];
  quiz.forEach((_, questionIndex) => steps.push({ kind: 'quiz-question', questionIndex }));
  if (quiz.length > 0) steps.push({ kind: 'quiz-result' });
  steps.push({ kind: 'done' });
  return steps;
}

/** Header meta line for a step, e.g. "Section 2 of 5" — null renders nothing. */
export function stepMeta(step: PlayerStep, modules: CourseModules): string | null {
  switch (step.kind) {
    case 'overview':
      return 'Overview';
    case 'section':
      return `Section ${step.sectionIndex + 1} of ${modules.sections.length}`;
    case 'video':
      return 'Training video';
    case 'quiz-question':
      return `Question ${step.questionIndex + 1} of ${(modules.quiz ?? []).length}`;
    case 'quiz-result':
      return 'Knowledge check';
    case 'done':
      return null;
  }
}

/** Header progress fill, 0..1. The final step always reads as complete. */
export function progressFraction(stepIndex: number, steps: PlayerStep[]): number {
  if (steps.length === 0) return 0;
  return Math.min(1, (stepIndex + 1) / steps.length);
}

/** Quiz questions gate Next until answered; every other step can always advance. */
export function canAdvance(step: PlayerStep, answers: Array<number | null>): boolean {
  if (step.kind !== 'quiz-question') return true;
  return answers[step.questionIndex] != null;
}

/** Index of the first quiz question — the "Try again" jump target. -1 when quizless. */
export function firstQuizIndex(steps: PlayerStep[]): number {
  return steps.findIndex((s) => s.kind === 'quiz-question');
}

/** Clamp a step index into the valid range. */
export function clampStep(index: number, steps: PlayerStep[]): number {
  return Math.max(0, Math.min(steps.length - 1, index));
}
