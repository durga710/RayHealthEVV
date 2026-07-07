import { describe, it, expect } from 'vitest';
import { isWallOfText, parseLessonContent, sectionIcon, type LessonBlock } from './lesson-format';

// Fixtures lifted from real course content in the catalog. These are the
// exact walls of text the formatter exists to break up.
const HAND_HYGIENE =
  'Handwashing prevents more infections than any other single action. Wash with soap and water for at least 20 seconds: (1) Wet hands, apply soap. (2) Rub palms together. (3) Rub back of each hand. (4) Interlace fingers. (5) Rub thumbs. (6) Rub fingertips in palm. (7) Rinse and dry with clean towel. Use alcohol-based hand rub (at least 60% alcohol) when hands are not visibly soiled.';

const PPE =
  'Gloves: wear when touching blood, body fluids, mucous membranes, non-intact skin, or contaminated items. Remove by peeling one glove inside-out, then sliding fingers under the remaining glove. Masks: wear when a client has respiratory symptoms (cough, sneezing) or when performing tasks that may generate splatter. Gowns: wear when clothing may contact blood or body fluids. Goggles/face shield: wear when splashing is possible (wound care, oral suctioning).';

const BLOODBORNE =
  'If you are stuck by a needle, splashed with blood, or have a cut exposed to body fluids: (1) Immediately wash the area with soap and water for 15 minutes (flush eyes with water for 15 minutes). (2) Report to your supervisor immediately. (3) Seek medical evaluation within 2 hours. (4) Document the incident. Bloodborne pathogens include HIV, Hepatitis B, and Hepatitis C. Prompt treatment dramatically reduces transmission risk.';

const STANDARD_PRECAUTIONS =
  'Standard Precautions treat all blood and body fluids as potentially infectious, regardless of diagnosis. Apply with every client on every visit. This includes: hand hygiene, appropriate PPE, safe sharps handling (never recap needles; use sharps containers), proper disposal of contaminated materials in red bags or sealed bags, and cleaning/disinfecting shared equipment. Standard Precautions protect you and your client from all known and unknown pathogens.';

const RESPIRATORY =
  'If a client has an active respiratory illness (flu, COVID-19, RSV, tuberculosis): wear a surgical mask or N95 respirator, perform hand hygiene more frequently, increase ventilation (open windows if possible), and minimize time in enclosed spaces. If a client is on Contact Precautions (MRSA, C. diff, VRE): wear gloves and gown for all client contact, use dedicated equipment (stethoscope, blood pressure cuff), and perform thorough hand washing.';

const PROTECTING_PHI =
  'Keep your device locked with a passcode. Don’t leave paperwork visible in your car or home. Never text client details over personal apps. Use only the agency’s approved app for visit data. If you lose a device or paperwork, report it to the agency immediately.';

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
  });

  it('keeps parentheses inside a step intact and demotes trailing facts', () => {
    const blocks = parseLessonContent(BLOODBORNE);
    const steps = blocks.find((b) => b.kind === 'steps') as Extract<LessonBlock, { kind: 'steps' }>;
    expect(steps.items).toHaveLength(4);
    expect(steps.items[0]).toContain('(flush eyes with water for 15 minutes)');
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
    expect(terms.items[0].text).toContain('Remove by peeling one glove inside-out');
  });
});

describe('parseLessonContent — colon lists become bullets', () => {
  it('turns "This includes: a, b, c" into a lead paragraph plus bullets', () => {
    const blocks = parseLessonContent(STANDARD_PRECAUTIONS);
    const bulletsIdx = blocks.findIndex((b) => b.kind === 'bullets');
    expect(bulletsIdx).toBeGreaterThan(0);
    expect((blocks[bulletsIdx - 1] as { text: string }).text).toMatch(/This includes:$/);
    const bullets = blocks[bulletsIdx] as Extract<LessonBlock, { kind: 'bullets' }>;
    expect(bullets.items).toHaveLength(5);
    // Paren-aware: the semicolon list inside parens stays glued to its item.
    expect(bullets.items[2]).toBe('safe sharps handling (never recap needles; use sharps containers)');
    // Leading "and" is stripped from the final item.
    expect(bullets.items[4]).toBe('cleaning/disinfecting shared equipment');
  });

  it('does not fire on short colon remainders', () => {
    const blocks = parseLessonContent('Remember this: stay calm.');
    expect(kinds(blocks)).toEqual(['paragraph']);
  });
});

describe('parseLessonContent — conditional callouts', () => {
  it('turns "If X: a, b, c" sentences into callout blocks with items', () => {
    const blocks = parseLessonContent(RESPIRATORY);
    const callouts = blocks.filter((b) => b.kind === 'callout') as Extract<LessonBlock, { kind: 'callout' }>[];
    expect(callouts).toHaveLength(2);
    expect(callouts[0].title).toBe('If a client has an active respiratory illness (flu, COVID-19, RSV, tuberculosis)');
    expect(callouts[0].items).toHaveLength(4);
    expect(callouts[0].items[0]).toBe('wear a surgical mask or N95 respirator');
    expect(callouts[1].title).toContain('Contact Precautions (MRSA, C. diff, VRE)');
  });

  it('keeps a callout with a single instruction as text', () => {
    const blocks = parseLessonContent('If the client refuses care: document the refusal right away.');
    const callout = blocks[0] as Extract<LessonBlock, { kind: 'callout' }>;
    expect(callout.kind).toBe('callout');
    expect(callout.items).toEqual([]);
    expect(callout.text).toBe('document the refusal right away.');
  });
});

describe('parseLessonContent — checklists and key points', () => {
  it('turns a run of short rules into a checklist with a Never key point', () => {
    const blocks = parseLessonContent(PROTECTING_PHI);
    expect(blocks.some((b) => b.kind === 'keypoint')).toBe(true);
    const keypoint = blocks.find((b) => b.kind === 'keypoint') as Extract<LessonBlock, { kind: 'keypoint' }>;
    expect(keypoint.text).toContain('Never text client details');
    const bullets = blocks.find((b) => b.kind === 'bullets') as Extract<LessonBlock, { kind: 'bullets' }>;
    expect(bullets.items.length).toBeGreaterThanOrEqual(4);
  });

  it('caps key points at two per section', () => {
    const text =
      'Never do thing one because it is dangerous for everyone involved. Never do thing two because it is also dangerous. Never do thing three because it is dangerous as well. This closing sentence is here as plain prose content.';
    const blocks = parseLessonContent(text);
    expect(blocks.filter((b) => b.kind === 'keypoint')).toHaveLength(2);
  });

  it('highlights "is NOT effective" safety facts', () => {
    const text = 'Alcohol hand rub is NOT effective against C. diff spores.';
    expect(parseLessonContent(text)).toEqual([{ kind: 'keypoint', text }]);
  });
});

describe('parseLessonContent — plain prose behavior', () => {
  it('leaves short paragraphs untouched', () => {
    expect(parseLessonContent('Short and sweet.')).toEqual([{ kind: 'paragraph', text: 'Short and sweet.' }]);
  });

  it('respects explicit double-newline paragraphs', () => {
    expect(kinds(parseLessonContent('First paragraph.\n\nSecond paragraph.'))).toEqual(['paragraph', 'paragraph']);
  });

  it('parses explicit dash bullets', () => {
    expect(parseLessonContent('- First point\n- Second point\n- Third point')).toEqual([
      { kind: 'bullets', items: ['First point', 'Second point', 'Third point'] },
    ]);
  });
});

describe('isWallOfText', () => {
  it('flags a long stack of plain paragraphs', () => {
    const long =
      'A deliberately much longer sentence that is repeated several times to build length and mimic unstructured prose that would overwhelm a reader on a small phone screen. ';
    const blocks = parseLessonContent((long + long + long + long + long + long).trim());
    // Whatever chunking produced, everything is paragraphs, so it is a wall.
    expect(blocks.every((b) => b.kind === 'paragraph')).toBe(true);
    expect(isWallOfText(blocks)).toBe(true);
  });

  it('does not flag sections with any visual structure', () => {
    expect(isWallOfText(parseLessonContent(STANDARD_PRECAUTIONS))).toBe(false);
    expect(isWallOfText(parseLessonContent(RESPIRATORY))).toBe(false);
    expect(isWallOfText(parseLessonContent(PROTECTING_PHI))).toBe(false);
    expect(isWallOfText(parseLessonContent(HAND_HYGIENE))).toBe(false);
  });

  it('does not flag a short intro paragraph', () => {
    expect(isWallOfText(parseLessonContent('One short intro line.'))).toBe(false);
  });
});

describe('sectionIcon', () => {
  it('maps common section themes to icons', () => {
    expect(sectionIcon('Hand Hygiene: Your Most Important Tool')).toBe('water');
    expect(sectionIcon('Personal Protective Equipment (PPE)')).toBe('shirt');
    expect(sectionIcon('Bloodborne Pathogen Exposure')).toBe('medkit');
    expect(sectionIcon('Standard Precautions')).toBe('shield-checkmark');
    expect(sectionIcon('Hands-Only CPR')).toBe('heart');
    expect(sectionIcon('Something Unrelated')).toBe('book');
  });
});
