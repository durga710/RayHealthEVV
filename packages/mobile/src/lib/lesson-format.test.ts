import { describe, it, expect } from 'vitest';
import { parseLessonContent, sectionIcon, type LessonBlock } from './lesson-format';

// Fixtures lifted from the real Infection Control course content that renders
// as walls of text today — the exact cases the formatter exists to fix.
const HAND_HYGIENE =
  'Handwashing prevents more infections than any other single action. Wash with soap and water for at least 20 seconds: (1) Wet hands, apply soap. (2) Rub palms together. (3) Rub back of each hand. (4) Interlace fingers. (5) Rub thumbs. (6) Rub fingertips in palm. (7) Rinse and dry with clean towel. Use alcohol-based hand rub (at least 60% alcohol) when hands are not visibly soiled.';

const PPE =
  'Gloves: wear when touching blood, body fluids, mucous membranes, non-intact skin, or contaminated items. Remove by peeling one glove inside-out, then sliding fingers under the remaining glove — never touch the outside. Masks: wear when a client has respiratory symptoms (cough, sneezing) or when performing tasks that may generate splatter. Gowns: wear when clothing may contact blood or body fluids. Goggles/face shield: wear when splashing is possible (wound care, oral suctioning). Never reuse single-use PPE.';

const BLOODBORNE =
  'If you are stuck by a needle, splashed with blood, or have a cut exposed to body fluids: (1) Immediately wash the area with soap and water for 15 minutes (flush eyes with water for 15 minutes). (2) Report to your supervisor immediately. (3) Seek medical evaluation within 2 hours — some post-exposure treatments must start quickly. (4) Document the incident. Bloodborne pathogens include HIV, Hepatitis B, and Hepatitis C. Prompt treatment dramatically reduces transmission risk.';

const STANDARD_PRECAUTIONS =
  'Standard Precautions treat all blood and body fluids as potentially infectious — regardless of diagnosis. Apply with every client on every visit. This includes: hand hygiene, appropriate PPE, safe sharps handling (never recap needles; use sharps containers), proper disposal of contaminated materials in red bags or sealed bags, and cleaning/disinfecting shared equipment. Standard Precautions protect you and your client from all known and unknown pathogens.';

function kinds(blocks: LessonBlock[]): string[] {
  return blocks.map((b) => b.kind);
}

describe('parseLessonContent — inline numbered steps', () => {
  it('extracts the 7 handwashing steps with lead-in and trailing prose', () => {
    const blocks = parseLessonContent(HAND_HYGIENE);
    expect(kinds(blocks)).toEqual(['paragraph', 'steps', 'paragraph']);
    const steps = blocks[1] as Extract<LessonBlock, { kind: 'steps' }>;
    expect(steps.items).toHaveLength(7);
    expect(steps.items[0]).toBe('Wet hands, apply soap.');
    expect(steps.items[6]).toBe('Rinse and dry with clean towel.');
    expect((blocks[0] as { text: string }).text).toContain('at least 20 seconds:');
    expect((blocks[2] as { text: string }).text).toContain('alcohol-based hand rub');
  });

  it('keeps parentheses inside a step intact and demotes trailing facts', () => {
    const blocks = parseLessonContent(BLOODBORNE);
    const steps = blocks.find((b) => b.kind === 'steps') as Extract<LessonBlock, { kind: 'steps' }>;
    expect(steps.items).toHaveLength(4);
    expect(steps.items[0]).toContain('(flush eyes with water for 15 minutes)');
    expect(steps.items[3]).toBe('Document the incident.');
    const trailing = blocks[blocks.length - 1] as { kind: string; text: string };
    expect(trailing.kind).toBe('paragraph');
    expect(trailing.text).toContain('Bloodborne pathogens include HIV');
  });

  it('does not fire on a single parenthesized number', () => {
    const blocks = parseLessonContent('Only one item here (1) so this is not a list.');
    expect(kinds(blocks)).toEqual(['paragraph']);
  });
});

describe('parseLessonContent — term definitions', () => {
  it('extracts Gloves/Masks/Gowns/Goggles as terms', () => {
    const blocks = parseLessonContent(PPE);
    const terms = blocks.find((b) => b.kind === 'terms') as Extract<LessonBlock, { kind: 'terms' }>;
    expect(terms.items.map((t) => t.term)).toEqual(['Gloves', 'Masks', 'Gowns', 'Goggles/face shield']);
    // The two-sentence Gloves definition stays together.
    expect(terms.items[0].text).toContain('never touch the outside');
  });

  it('does not treat a mid-sentence colon list as terms', () => {
    const blocks = parseLessonContent(STANDARD_PRECAUTIONS);
    expect(blocks.every((b) => b.kind === 'paragraph')).toBe(true);
  });
});

describe('parseLessonContent — long paragraphs and structure', () => {
  it('splits an unstructured wall of text into readable chunks', () => {
    const blocks = parseLessonContent(STANDARD_PRECAUTIONS);
    expect(blocks.length).toBeGreaterThan(1);
    for (const b of blocks) {
      expect((b as { text: string }).text.length).toBeLessThan(STANDARD_PRECAUTIONS.length);
    }
  });

  it('leaves short paragraphs untouched', () => {
    const blocks = parseLessonContent('Short and sweet.');
    expect(blocks).toEqual([{ kind: 'paragraph', text: 'Short and sweet.' }]);
  });

  it('respects explicit double-newline paragraphs', () => {
    const blocks = parseLessonContent('First paragraph.\n\nSecond paragraph.');
    expect(kinds(blocks)).toEqual(['paragraph', 'paragraph']);
  });

  it('does not split on abbreviations followed by lowercase (C. diff)', () => {
    const text = 'Alcohol hand rub is NOT effective against C. diff spores.';
    expect(parseLessonContent(text)).toEqual([{ kind: 'paragraph', text }]);
  });

  it('parses explicit dash bullets', () => {
    const blocks = parseLessonContent('- First point\n- Second point\n- Third point');
    expect(blocks).toEqual([{ kind: 'bullets', items: ['First point', 'Second point', 'Third point'] }]);
  });
});

describe('sectionIcon', () => {
  it('maps common section themes to icons', () => {
    expect(sectionIcon('Hand Hygiene: Your Most Important Tool')).toBe('water');
    expect(sectionIcon('Personal Protective Equipment (PPE)')).toBe('shirt');
    expect(sectionIcon('Bloodborne Pathogen Exposure')).toBe('medkit');
    expect(sectionIcon('Respiratory & Isolation Precautions')).toBe('medical');
    expect(sectionIcon('Standard Precautions')).toBe('shield-checkmark');
    expect(sectionIcon('Something Unrelated')).toBe('book');
  });
});
