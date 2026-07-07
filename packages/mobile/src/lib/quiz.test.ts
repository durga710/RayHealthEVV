import { describe, it, expect } from 'vitest';
import { allAnswered, emptyAnswers, gradeQuiz, PASS_THRESHOLD } from './quiz';
import type { QuizQuestion } from './course-player';

function makeQuiz(count: number): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    question: `Q${i + 1}?`,
    options: ['Option A', 'Option B', 'Option C'],
    correct: i % 3,
  }));
}

describe('gradeQuiz', () => {
  it('passes exactly at the 80% boundary (4/5)', () => {
    const quiz = makeQuiz(5);
    const answers = quiz.map((q) => q.correct);
    answers[4] = (quiz[4].correct + 1) % 3; // one wrong
    const grade = gradeQuiz(quiz, answers);
    expect(grade.correctCount).toBe(4);
    expect(grade.score).toBe(0.8);
    expect(grade.scorePercent).toBe(80);
    expect(grade.passed).toBe(true);
  });

  it('fails below the boundary (3/4 = 75%)', () => {
    const quiz = makeQuiz(4);
    const answers = quiz.map((q) => q.correct);
    answers[0] = (quiz[0].correct + 1) % 3;
    const grade = gradeQuiz(quiz, answers);
    expect(grade.score).toBe(0.75);
    expect(grade.scorePercent).toBe(75);
    expect(grade.passed).toBe(false);
  });

  it('a perfect score passes with no wrong answers', () => {
    const quiz = makeQuiz(3);
    const grade = gradeQuiz(quiz, quiz.map((q) => q.correct));
    expect(grade).toMatchObject({ correctCount: 3, scorePercent: 100, passed: true, wrong: [] });
  });

  it('reports each wrong answer with the correction', () => {
    const quiz = makeQuiz(2); // correct: [0, 1]
    const grade = gradeQuiz(quiz, [1, 1]);
    expect(grade.wrong).toEqual([
      { questionIndex: 0, selected: 1, correctIndex: 0, correctText: 'Option A' },
    ]);
  });

  it('treats an unanswered question as wrong with selected -1', () => {
    const quiz = makeQuiz(2);
    const grade = gradeQuiz(quiz, [quiz[0].correct, null]);
    expect(grade.wrong).toEqual([
      { questionIndex: 1, selected: -1, correctIndex: 1, correctText: 'Option B' },
    ]);
  });

  it('rounds scorePercent to an integer', () => {
    const quiz = makeQuiz(3);
    const answers = quiz.map((q) => q.correct);
    answers[0] = (quiz[0].correct + 1) % 3; // 2/3 = 66.66…
    expect(gradeQuiz(quiz, answers).scorePercent).toBe(67);
  });

  it('threshold matches the web player', () => {
    expect(PASS_THRESHOLD).toBe(0.8);
  });
});

describe('allAnswered / emptyAnswers', () => {
  it('emptyAnswers builds a null-filled array', () => {
    expect(emptyAnswers(3)).toEqual([null, null, null]);
    expect(emptyAnswers(0)).toEqual([]);
  });

  it('allAnswered is false with any null hole and true when full', () => {
    expect(allAnswered([0, null, 2])).toBe(false);
    expect(allAnswered([0, 1, 2])).toBe(true);
    expect(allAnswered([])).toBe(true);
  });

  it('answer index 0 counts as answered', () => {
    expect(allAnswered([0])).toBe(true);
  });
});
