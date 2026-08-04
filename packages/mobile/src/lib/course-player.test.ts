import { describe, it, expect } from 'vitest';
import {
  buildSteps,
  canAdvance,
  clampStep,
  firstQuizIndex,
  progressFraction,
  resumePosition,
  shouldPersistStep,
  stepMeta,
  type CourseModules,
  type QuizQuestion,
} from './course-player';

const fullModules: CourseModules = {
  objectives: ['Know the basics', 'Stay safe'],
  sections: [
    { title: 'Basics', content: 'Content A' },
    { title: 'Hygiene', content: 'Content B' },
    { title: 'PPE', content: 'Content C' },
  ],
  videoUrl: 'https://www.youtube.com/watch?v=abc123',
  quiz: [
    { question: 'Q1?', options: ['a', 'b'], correct: 0 },
    { question: 'Q2?', options: ['a', 'b'], correct: 1 },
  ],
};

describe('buildSteps', () => {
  it('orders overview → sections → video → quiz questions → quiz result → done', () => {
    expect(buildSteps(fullModules).map((s) => s.kind)).toEqual([
      'overview',
      'section',
      'section',
      'section',
      'video',
      'quiz-question',
      'quiz-question',
      'quiz-result',
      'done',
    ]);
  });

  it('indexes sections and questions in order', () => {
    const steps = buildSteps(fullModules);
    expect(steps[1]).toEqual({ kind: 'section', sectionIndex: 0 });
    expect(steps[3]).toEqual({ kind: 'section', sectionIndex: 2 });
    expect(steps[5]).toEqual({ kind: 'quiz-question', questionIndex: 0 });
  });

  it('drops the video step when there is no videoUrl', () => {
    const kinds = buildSteps({ ...fullModules, videoUrl: null }).map((s) => s.kind);
    expect(kinds).not.toContain('video');
  });

  it('drops quiz steps entirely for quizless courses (null and empty)', () => {
    for (const quiz of [null, [] as QuizQuestion[]]) {
      const kinds = buildSteps({ ...fullModules, quiz }).map((s) => s.kind);
      expect(kinds).not.toContain('quiz-question');
      expect(kinds).not.toContain('quiz-result');
      expect(kinds[kinds.length - 1]).toBe('done');
    }
  });

  it('handles a minimal course: overview then done', () => {
    expect(
      buildSteps({ objectives: [], sections: [], quiz: null }).map((s) => s.kind),
    ).toEqual(['overview', 'done']);
  });
});

describe('stepMeta', () => {
  it('labels sections and questions with position', () => {
    expect(stepMeta({ kind: 'section', sectionIndex: 1 }, fullModules)).toBe('Section 2 of 3');
    expect(stepMeta({ kind: 'quiz-question', questionIndex: 0 }, fullModules)).toBe(
      'Question 1 of 2',
    );
  });

  it('labels the fixed steps', () => {
    expect(stepMeta({ kind: 'overview' }, fullModules)).toBe('Overview');
    expect(stepMeta({ kind: 'video' }, fullModules)).toBe('Training video');
    expect(stepMeta({ kind: 'quiz-result' }, fullModules)).toBe('Knowledge check');
    expect(stepMeta({ kind: 'done' }, fullModules)).toBeNull();
  });
});

describe('progressFraction', () => {
  it('grows monotonically and completes at the last step', () => {
    const steps = buildSteps(fullModules);
    let prev = 0;
    steps.forEach((_, i) => {
      const f = progressFraction(i, steps);
      expect(f).toBeGreaterThan(prev);
      prev = f;
    });
    expect(progressFraction(steps.length - 1, steps)).toBe(1);
  });
});

describe('canAdvance', () => {
  it('gates quiz questions on an answer', () => {
    expect(canAdvance({ kind: 'quiz-question', questionIndex: 0 }, [null, null])).toBe(false);
    expect(canAdvance({ kind: 'quiz-question', questionIndex: 0 }, [1, null])).toBe(true);
    expect(canAdvance({ kind: 'quiz-question', questionIndex: 0 }, [0, null])).toBe(true); // answer 0 is truthy-safe
  });

  it('never gates non-quiz steps', () => {
    expect(canAdvance({ kind: 'overview' }, [])).toBe(true);
    expect(canAdvance({ kind: 'section', sectionIndex: 0 }, [null])).toBe(true);
    expect(canAdvance({ kind: 'video' }, [null])).toBe(true);
  });
});

describe('firstQuizIndex', () => {
  it('finds the retry jump target', () => {
    const steps = buildSteps(fullModules);
    expect(steps[firstQuizIndex(steps)]).toEqual({ kind: 'quiz-question', questionIndex: 0 });
  });

  it('is -1 for quizless courses', () => {
    expect(firstQuizIndex(buildSteps({ ...fullModules, quiz: null }))).toBe(-1);
  });
});

describe('clampStep', () => {
  it('clamps both bounds', () => {
    const steps = buildSteps(fullModules);
    expect(clampStep(-3, steps)).toBe(0);
    expect(clampStep(steps.length + 5, steps)).toBe(steps.length - 1);
    expect(clampStep(2, steps)).toBe(2);
  });
});

describe('resumePosition', () => {
  const steps = buildSteps(fullModules);

  it('starts at the beginning with no saved snapshot', () => {
    expect(resumePosition(null, steps, 2)).toEqual({ stepIndex: 0, answers: [null, null] });
    expect(resumePosition(undefined, steps, 2).stepIndex).toBe(0);
  });

  it('restores the saved step and answers', () => {
    expect(resumePosition({ stepIndex: 3, answers: [1, null] }, steps, 2)).toEqual({
      stepIndex: 3,
      answers: [1, null],
    });
  });

  it('clamps a step index that outlived the course content', () => {
    // Course edited down to fewer sections since the snapshot was written.
    const shorter = buildSteps({ ...fullModules, sections: [fullModules.sections[0]] });
    const resumed = resumePosition({ stepIndex: 99, answers: [] }, shorter, 2);
    expect(resumed.stepIndex).toBeLessThan(shorter.length);
  });

  it('restarts rather than resuming onto the terminal done step', () => {
    const resumed = resumePosition({ stepIndex: steps.length - 1, answers: [0, 1] }, steps, 2);
    expect(resumed.stepIndex).toBe(0);
  });

  it('resizes the answer array to the live quiz length', () => {
    // Quiz shrank from 3 questions to 2.
    expect(resumePosition({ stepIndex: 2, answers: [0, 1, 1] }, steps, 2).answers).toEqual([0, 1]);
    // Quiz grew from 1 question to 2.
    expect(resumePosition({ stepIndex: 2, answers: [0] }, steps, 2).answers).toEqual([0, null]);
  });

  it('starts at the beginning when the course has no steps at all', () => {
    expect(resumePosition({ stepIndex: 4, answers: [] }, [], 0)).toEqual({ stepIndex: 0, answers: [] });
  });
});

describe('shouldPersistStep', () => {
  it('does not persist the overview, which is where an unopened course sits', () => {
    expect(shouldPersistStep({ kind: 'overview' })).toBe(false);
  });

  it('does not persist the terminal step', () => {
    expect(shouldPersistStep({ kind: 'done' })).toBe(false);
  });

  it('persists real progress', () => {
    expect(shouldPersistStep({ kind: 'section', sectionIndex: 1 })).toBe(true);
    expect(shouldPersistStep({ kind: 'video' })).toBe(true);
    expect(shouldPersistStep({ kind: 'quiz-question', questionIndex: 0 })).toBe(true);
  });

  it('handles a missing step', () => {
    expect(shouldPersistStep(undefined)).toBe(false);
  });
});
