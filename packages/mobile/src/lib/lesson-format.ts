/**
 * Pure lesson-content formatter for the course player. Course section content
 * is stored as free text, and much of it has structure trapped inline —
 * numbered steps "(1) Wet hands. (2) Rub palms.", term definitions
 * "Gloves: wear when… Masks: wear when…", and multi-sentence walls of text.
 *
 * parseLessonContent() turns a content string into typed blocks the screen can
 * render richly (step lists with number badges, bolded terms, digestible
 * paragraphs) WITHOUT any change to the stored course data. No React Native
 * imports, so it is unit-testable under the node-only vitest setup.
 */

export type LessonBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'terms'; items: { term: string; text: string }[] };

/** Sentence boundary: period/!/? followed by whitespace and a capital start. */
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z(])/;

/** A short "Label:" lead — no periods/colons inside, capped length. */
const TERM_LEAD = /^[A-Z][^.:!?]{0,34}:\s/;

/** Split into sentences, conservative about abbreviations like "C. diff". */
function sentences(text: string): string[] {
  return text.split(SENTENCE_BREAK).filter((s) => s.trim().length > 0);
}

/** Parse "(1) … (2) …" or "1. …" enumerations embedded in one paragraph. */
function tryParseInlineSteps(paragraph: string): LessonBlock[] | null {
  const marker = /\((\d{1,2})\)\s+/g;
  const matches = [...paragraph.matchAll(marker)];
  if (matches.length < 2) return null;

  const blocks: LessonBlock[] = [];
  const leadIn = paragraph.slice(0, matches[0].index).trim();
  if (leadIn) blocks.push({ kind: 'paragraph', text: leadIn });

  const items: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : paragraph.length;
    items.push(paragraph.slice(start, end).trim());
  }

  // Trailing prose often rides along after the last step ("(7) Rinse and dry
  // with clean towel. Use alcohol-based hand rub …"): keep only the first
  // sentence as the step and demote the rest to a paragraph.
  const last = items[items.length - 1];
  const lastSentences = sentences(last);
  if (lastSentences.length > 1) {
    items[items.length - 1] = lastSentences[0].trim();
    const rest = lastSentences.slice(1).join(' ').trim();
    blocks.push({ kind: 'steps', items });
    blocks.push(...parseParagraph(rest));
    return blocks;
  }

  blocks.push({ kind: 'steps', items });
  return blocks;
}

/** Parse "Gloves: … Masks: … Gowns: …" definition runs (needs ≥2 terms). */
function tryParseTerms(paragraph: string): LessonBlock[] | null {
  const parts = sentences(paragraph);
  if (parts.length < 2) return null;

  // Group sentences under the most recent "Label:" lead.
  const items: { term: string; text: string }[] = [];
  let before = '';
  for (const s of parts) {
    const m = s.match(TERM_LEAD);
    if (m) {
      const term = m[0].slice(0, -2).trim(); // drop ": "
      items.push({ term, text: s.slice(m[0].length).trim() });
    } else if (items.length === 0) {
      before += (before ? ' ' : '') + s;
    } else {
      // A sentence with no label continues the current term's definition.
      items[items.length - 1].text += ' ' + s;
    }
  }
  if (items.length < 2) return null;

  const blocks: LessonBlock[] = [];
  if (before) blocks.push({ kind: 'paragraph', text: before });
  blocks.push({ kind: 'terms', items });
  return blocks;
}

/** Break an unstructured long paragraph into ≤2-sentence readable chunks. */
function parseParagraph(paragraph: string): LessonBlock[] {
  const text = paragraph.trim();
  if (!text) return [];
  if (text.length <= 260) return [{ kind: 'paragraph', text }];
  const parts = sentences(text);
  if (parts.length < 3) return [{ kind: 'paragraph', text }];
  const blocks: LessonBlock[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    blocks.push({ kind: 'paragraph', text: parts.slice(i, i + 2).join(' ').trim() });
  }
  return blocks;
}

export function parseLessonContent(content: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  for (const rawParagraph of paragraphs) {
    // Explicit "- " / "• " bullet lines within a paragraph block.
    const lines = rawParagraph.split('\n').map((l) => l.trim()).filter(Boolean);
    const bulletLines = lines.filter((l) => /^[-•]\s+/.test(l));
    if (bulletLines.length >= 2 && bulletLines.length === lines.length) {
      blocks.push({ kind: 'bullets', items: bulletLines.map((l) => l.replace(/^[-•]\s+/, '')) });
      continue;
    }

    const paragraph = lines.join(' ');
    const steps = tryParseInlineSteps(paragraph);
    if (steps) {
      blocks.push(...steps);
      continue;
    }
    const terms = tryParseTerms(paragraph);
    if (terms) {
      blocks.push(...terms);
      continue;
    }
    blocks.push(...parseParagraph(paragraph));
  }

  return blocks;
}

/** Ionicon name for a section, keyed off title keywords. */
export function sectionIcon(title: string): string {
  const t = title.toLowerCase();
  if (/(hand|hygiene|wash)/.test(t)) return 'water';
  if (/(ppe|protective|glove|mask|gown)/.test(t)) return 'shirt';
  if (/(bloodborne|exposure|needle|sharps)/.test(t)) return 'medkit';
  if (/(respiratory|isolation|infection)/.test(t)) return 'medical';
  if (/(precaution|safety|standard)/.test(t)) return 'shield-checkmark';
  if (/(privacy|hipaa|phi|confidential|protect)/.test(t)) return 'lock-closed';
  if (/(abuse|neglect|exploit|report)/.test(t)) return 'alert-circle';
  if (/(evv|clock|visit|verification)/.test(t)) return 'time';
  if (/(emergency|communication|call)/.test(t)) return 'call';
  if (/(right|dignity|client)/.test(t)) return 'people';
  if (/(role|responsibilit)/.test(t)) return 'person';
  if (/(video|watch)/.test(t)) return 'play-circle';
  if (/(certification|certificate|cpr|first aid)/.test(t)) return 'ribbon';
  return 'book';
}
