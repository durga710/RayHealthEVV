/**
 * Dev-only runtime contrast auditor.
 *
 * Static analysis cannot see composed color. The bug that motivated this file
 * was a `<button class="btn-ghost">` whose own rule said
 * `background-color: transparent; color: var(--color-primary)` , which reads as
 * perfectly fine , while a lower-specificity `button` rule painted a brand
 * gradient underneath that the longhand could not clear. The element rendered
 * brand-on-brand and was invisible, and no linter, type checker, or unit test
 * could tell.
 *
 * This walks the live DOM instead. It resolves each text node's EFFECTIVE
 * background by climbing ancestors through transparent fills, and , the part
 * that matters , when it meets a `background-image` it parses the gradient's
 * color stops and scores against every one of them, reporting the worst. That
 * is precisely the case `getComputedStyle` cannot answer on its own.
 *
 * Usage (dev server only):
 *   window.__contrastAudit()            // -> Offender[], also console.table'd
 *   http://localhost:5173/admin?contrast=1   // outlines offenders in the page
 */
import { contrastRatio, parseCssColor, type Rgb } from '@rayhealth/core/domain/theme-resolver.js';

export interface Offender {
  ratio: number;
  required: number;
  text: string;
  color: string;
  background: string;
  /** Set when the background is a gradient/image, naming the worst stop. */
  via?: string;
  selector: string;
  element: Element;
}

const OPAQUE_WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** `rgba(r, g, b, a)` -> alpha, or 1 when the value is opaque. */
function alphaOf(color: string): number {
  const match = /rgba?\([^)]*[,/]\s*([\d.]+)\s*\)/.exec(color);
  return match ? Number(match[1]) : 1;
}

function blend(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return {
    r: Math.round((fg.r * alpha) + (bg.r * (1 - alpha))),
    g: Math.round((fg.g * alpha) + (bg.g * (1 - alpha))),
    b: Math.round((fg.b * alpha) + (bg.b * (1 - alpha))),
  };
}

/** Every color stop in a gradient string, in source order. */
function gradientStops(image: string): Rgb[] {
  const stops: Rgb[] = [];
  for (const match of image.matchAll(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g)) {
    const parsed = parseCssColor(match[0]);
    if (parsed && alphaOf(match[0]) > 0.15) stops.push(parsed);
  }
  return stops;
}

interface Backdrop {
  colors: Rgb[];
  description: string;
}

/**
 * The colors actually painted behind `element`, climbing through transparent
 * ancestors. Returns every candidate: a gradient contributes one entry per
 * stop, so the caller can score the worst case rather than an average.
 */
function effectiveBackdrop(element: Element): Backdrop {
  let node: Element | null = element;
  let accumulated: { color: Rgb; alpha: number }[] = [];

  while (node) {
    const style = getComputedStyle(node);
    const image = style.backgroundImage;

    if (image && image !== 'none') {
      const stops = gradientStops(image);
      if (stops.length > 0) {
        return {
          colors: stops.map((stop) => accumulated.reduceRight((bg, layer) => blend(layer.color, layer.alpha, bg), stop)),
          description: `${image.slice(0, 60)}${image.length > 60 ? '...' : ''}`,
        };
      }
      // A bitmap or data-URI background: colors are unknowable from here.
      return { colors: [], description: `image: ${image.slice(0, 40)}` };
    }

    const parsed = parseCssColor(style.backgroundColor);
    const alpha = alphaOf(style.backgroundColor);
    if (parsed && alpha > 0) {
      if (alpha >= 0.999) {
        return {
          colors: [accumulated.reduceRight((bg, layer) => blend(layer.color, layer.alpha, bg), parsed)],
          description: style.backgroundColor,
        };
      }
      accumulated = [...accumulated, { color: parsed, alpha }];
    }

    node = node.parentElement;
  }

  // Ran off the top of the tree: the canvas is white.
  return {
    colors: [accumulated.reduceRight((bg, layer) => blend(layer.color, layer.alpha, bg), OPAQUE_WHITE)],
    description: 'page canvas',
  };
}

/** WCAG: 3:1 for large text (>=18.66px, or >=14px bold), 4.5:1 otherwise. */
function requiredRatio(style: CSSStyleDeclaration): number {
  const size = parseFloat(style.fontSize);
  const weight = Number(style.fontWeight) || (style.fontWeight === 'bold' ? 700 : 400);
  const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
  return isLarge ? 3 : 4.5;
}

function describe(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = typeof element.className === 'string' && element.className
    ? `.${element.className.trim().split(/\s+/).join('.')}`
    : '';
  return `${tag}${id}${classes}`;
}

/** Text this element renders itself, ignoring text owned by its children. */
function ownText(element: Element): string {
  return [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
}

export function auditContrast(root: ParentNode = document.body): Offender[] {
  const offenders: Offender[] = [];

  for (const element of root.querySelectorAll('*')) {
    const text = ownText(element);
    if (text.length === 0) continue;

    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const foreground = parseCssColor(style.color);
    if (!foreground) continue;

    const backdrop = effectiveBackdrop(element);
    if (backdrop.colors.length === 0) continue; // unknowable background, needs a human

    const required = requiredRatio(style);
    let worst = Number.POSITIVE_INFINITY;
    let worstColor: Rgb | null = null;
    for (const candidate of backdrop.colors) {
      const ratio = contrastRatio(foreground, candidate);
      if (ratio < worst) {
        worst = ratio;
        worstColor = candidate;
      }
    }

    if (worst < required) {
      offenders.push({
        ratio: Number(worst.toFixed(2)),
        required,
        text: text.length > 48 ? `${text.slice(0, 48)}...` : text,
        color: style.color,
        background: worstColor
          ? `rgb(${worstColor.r}, ${worstColor.g}, ${worstColor.b})`
          : backdrop.description,
        via: backdrop.colors.length > 1 ? backdrop.description : undefined,
        selector: describe(element),
        element,
      });
    }
  }

  return offenders.sort((a, b) => a.ratio - b.ratio);
}

/** Draw an outline on every offender so they can be found on the page. */
export function highlightOffenders(offenders: Offender[]): void {
  for (const offender of offenders) {
    (offender.element as HTMLElement).style.outline = '2px dashed #FF00FF';
    (offender.element as HTMLElement).style.outlineOffset = '2px';
  }
}

/**
 * Wire the auditor onto `window` for the dev server. Never called in a
 * production build , main.tsx guards on import.meta.env.DEV, so this module is
 * tree-shaken out entirely.
 */
export function installContrastAudit(): void {
  const run = (): Offender[] => {
    const offenders = auditContrast();
    if (offenders.length === 0) {
      console.info('[contrast] no failures on this route');
    } else {
      console.warn(`[contrast] ${offenders.length} failing element(s) on ${window.location.pathname}`);
      console.table(offenders.map(({ element, ...row }) => row));
    }
    return offenders;
  };

  (window as unknown as { __contrastAudit: typeof run }).__contrastAudit = run;

  if (new URLSearchParams(window.location.search).has('contrast')) {
    // Let the route settle (data fetches, transitions) before measuring.
    window.setTimeout(() => highlightOffenders(run()), 1200);
  }
}
