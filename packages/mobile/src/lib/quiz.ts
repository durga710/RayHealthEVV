/**
 * Pure quiz grading for the course player. Mirrors the web player's semantics
 * (packages/web/src/features/caregiver/CourseDetailPage.tsx): score is the
 * fraction of correct answers and 80% passes. Unlike web, the graded
 * `scorePercent` is sent with the completion so it lands in the
 * course_completions audit log.
 */

import type { QuizQuestion } from './course-player';

export const PASS_THRESHOLD = 0.8;

export interface WrongAnswer {
  questionIndex: number;
  /** The option index the caregiver picked. */
  selected: number;
  correctIndex: number;
  correctText: string;
}

export interface QuizGrade {
  correctCount: number;
  total: number;
  /** 0..1 fraction. */
  score: number;
  /** Rounded 0..100 integer — what we POST as the completion score. */
  scorePercent: number;
  passed: boolean;
  wrong: WrongAnswer[];
}

export function gradeQuiz(questions: QuizQuestion[], answers: Array<number | null>): QuizGrade {
  const wrong: WrongAnswer[] = [];
  let correctCount = 0;
  questions.forEach((q, questionIndex) => {
    const selected = answers[questionIndex];
    if (selected === q.correct) {
      correctCount += 1;
    } else {
      wrong.push({
        questionIndex,
        selected: selected ?? -1,
        correctIndex: q.correct,
        correctText: q.options[q.correct] ?? '',
      });
    }
  });
  const total = questions.length;
  const score = total > 0 ? correctCount / total : 0;
  return {
    correctCount,
    total,
    score,
    scorePercent: Math.round(score * 100),
    passed: score >= PASS_THRESHOLD,
    wrong,
  };
}

export function allAnswered(answers: Array<number | null>): boolean {
  return answers.every((a) => a != null);
}

export function emptyAnswers(count: number): Array<number | null> {
  return Array.from({ length: count }, () => null);
}
