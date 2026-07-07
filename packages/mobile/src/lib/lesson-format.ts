/**
 * Pure lesson-content formatter for the course player. Course section content
 * is stored as free text, and much of it has structure trapped inline:
 * numbered steps "(1) Wet hands. (2) Rub palms.", term definitions
 * "Gloves: wear when… Masks: wear when…", colon-introduced lists
 * "This includes: hand hygiene, PPE, and safe sharps handling.", conditional
 * instructions "If a client has a respiratory illness: wear a mask, …", and
 * runs of short imperative rules.
 *
 * parseLessonContent() turns a content string into typed blocks the screen
 * renders richly, WITHOUT any change to the stored course data. The goal is
 * that no real section renders as a plain stack of paragraphs. No React
 * Native imports, so it is unit-testable under the node-only vitest setup.
 */

export type LessonBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'terms'; items: { term: string; text: string }[] }
  | { kind: 'callout'; title: string; items: string[]; text: string | null }
  | { kind: 'keypoint'; text: string };

/** Sentence boundary: period/!/? followed by whitespace and a capital start. */
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z(])/;

/** A short "Label:" lead, no periods/colons inside, capped length. */
const TERM_LEAD = /^[A-Z][^.:!?]{0,34}:\s/;

/** Sentences worth highlighting as a key point. */
const KEYPOINT = /\b(never|call 911|911 first|do not wait|fraud|criminal|cannot be fired|is not effective|failure to report)\b/i;

const MAX_KEYPOINTS_PER_SECTION = 2;
const CHECKLIST_MIN_ITEMS = 4;
const CHECKLIST_ITEM_MAX_CHARS = 120;
const CHUNK_MAX_CHARS = 260;

/** Split into sentences, conservative about abbreviations like "C. diff". */
function sentences(text: string): string[] {
  return text.split(SENTENCE_BREAK).filter((s) => s.trim().length > 0);
}

/** Split on a separator at parenthesis depth 0 only. */
function topLevelSplit(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Index of the first ": " at parenthesis depth 0, or -1. */
function topLevelColonIndex(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ':' && depth === 0 && text[i + 1] === ' ') return i;
  }
  return -1;
}

/** Strip a leading "and " / "or " from a list item and terminal period noise. */
function cleanItem(item: string): string {
  return item.replace(/^(and|or)\s+/i, '').replace(/\.$/, '').trim();
}

/** Parse "(1) … (2) …" enumerations embedded in one paragraph. */
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

  // Trailing prose often rides along after the last step: keep only the first
  // sentence as the step and process the rest as regular content.
  const last = items[items.length - 1];
  const lastSentences = sentences(last);
  if (lastSentences.length > 1) {
    items[items.length - 1] = lastSentences[0].trim();
    blocks.push({ kind: 'steps', items });
    blocks.push(...parseSentenceRun(lastSentences.slice(1), MAX_KEYPOINTS_PER_SECTION));
    return blocks;
  }

  blocks.push({ kind: 'steps', items });
  return blocks;
}

/** Parse "Gloves: … Masks: … Gowns: …" definition runs (needs ≥2 terms). */
function tryParseTerms(paragraph: string): LessonBlock[] | null {
  const parts = sentences(paragraph);
  if (parts.length < 2) return null;

  const items: { term: string; text: string }[] = [];
  let before = '';
  for (const s of parts) {
    const m = s.match(TERM_LEAD);
    if (m) {
      const term = m[0].slice(0, -2).trim();
      items.push({ term, text: s.slice(m[0].length).trim() });
    } else if (items.length === 0) {
      before += (before ? ' ' : '') + s;
    } else {
      items[items.length - 1].text += ' ' + s;
    }
  }
  if (items.length < 2) return null;

  const blocks: LessonBlock[] = [];
  if (before) blocks.push({ kind: 'paragraph', text: before });
  blocks.push({ kind: 'terms', items });
  return blocks;
}

/**
 * Process a run of sentences into blocks: conditional callouts, colon lists,
 * key points, checklists of short rules, and short readable paragraphs.
 */
function parseSentenceRun(run: string[], keypointBudget: number): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  // Key points are collected and emitted after the run so extracting one does
  // not break up a checklist of surrounding short rules.
  const keypoints: string[] = [];
  let buffer: string[] = [];
  let budget = keypointBudget;

  const flush = () => {
    if (buffer.length === 0) return;
    if (buffer.length >= CHECKLIST_MIN_ITEMS && buffer.every((s) => s.length <= CHECKLIST_ITEM_MAX_CHARS)) {
      blocks.push({ kind: 'bullets', items: buffer.map((s) => s.trim()) });
    } else {
      // Short readable paragraphs: at most two sentences per chunk once the
      // combined text stops fitting comfortably on a phone screen.
      const joined = buffer.join(' ');
      if (joined.length <= CHUNK_MAX_CHARS) {
        blocks.push({ kind: 'paragraph', text: joined });
      } else {
        for (let i = 0; i < buffer.length; i += 2) {
          blocks.push({ kind: 'paragraph', text: buffer.slice(i, i + 2).join(' ').trim() });
        }
      }
    }
    buffer = [];
  };

  for (const s of run) {
    const colonIdx = topLevelColonIndex(s);
    const rest = colonIdx >= 0 ? s.slice(colonIdx + 1).trim() : '';
    const restItems = colonIdx >= 0 ? topLevelSplit(rest, ',') : [];

    // Conditional instruction: "If a client has X: do a, do b, and do c."
    if (/^(If|When)\s/.test(s) && colonIdx > 0) {
      flush();
      blocks.push({
        kind: 'callout',
        title: s.slice(0, colonIdx).trim(),
        items: restItems.length >= 2 ? restItems.map(cleanItem) : [],
        text: restItems.length >= 2 ? null : rest,
      });
      continue;
    }

    // Colon-introduced list: "This includes: a, b, c, and d."
    if (colonIdx > 0 && restItems.length >= 3 && rest.length >= 40) {
      flush();
      blocks.push({ kind: 'paragraph', text: s.slice(0, colonIdx + 1).trim() });
      blocks.push({ kind: 'bullets', items: restItems.map(cleanItem) });
      continue;
    }

    // Critical warnings become highlighted key points.
    if (budget > 0 && s.length <= 180 && KEYPOINT.test(s)) {
      keypoints.push(s.trim());
      budget -= 1;
      continue;
    }

    buffer.push(s.trim());
  }
  flush();
  blocks.push(...keypoints.map((text): LessonBlock => ({ kind: 'keypoint', text })));
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
    blocks.push(...parseSentenceRun(sentences(paragraph), MAX_KEYPOINTS_PER_SECTION));
  }

  return blocks;
}

/** True when a parsed section is still an unbroken stack of prose. */
export function isWallOfText(blocks: LessonBlock[]): boolean {
  if (!blocks.every((b) => b.kind === 'paragraph')) return false;
  const total = blocks.reduce((n, b) => n + (b as { text: string }).text.length, 0);
  return blocks.length >= 3 || total > 400;
}

/** Ionicon name for a section, keyed off title keywords. */
export function sectionIcon(title: string): string {
  const t = title.toLowerCase();
  if (/(cpr|aed|cardiac|first aid)/.test(t)) return 'heart';
  if (/(hand|hygiene|wash)/.test(t)) return 'water';
  if (/(ppe|protective|glove|mask|gown)/.test(t)) return 'shirt';
  if (/(bloodborne|exposure|needle|sharps)/.test(t)) return 'medkit';
  if (/(respiratory|isolation|infection)/.test(t)) return 'medical';
  if (/(precaution|safety|standard)/.test(t)) return 'shield-checkmark';
  if (/(privacy|hipaa|phi|confidential|protect)/.test(t)) return 'lock-closed';
  if (/(abuse|neglect|exploit|report)/.test(t)) return 'alert-circle';
  if (/(evv|clock|visit|verification)/.test(t)) return 'time';
  if (/(emergency|communication|call|911)/.test(t)) return 'call';
  if (/(dementia|memory|behavior)/.test(t)) return 'sparkles';
  if (/(document|record)/.test(t)) return 'create';
  if (/(right|dignity|client)/.test(t)) return 'people';
  if (/(role|responsibilit)/.test(t)) return 'person';
  if (/(video|watch)/.test(t)) return 'play-circle';
  if (/(certification|certificate)/.test(t)) return 'ribbon';
  if (/(regulation|law|chapter|act)/.test(t)) return 'library';
  return 'book';
}
