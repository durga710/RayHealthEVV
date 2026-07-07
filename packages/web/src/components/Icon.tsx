import type { ReactNode, SVGProps } from 'react';

/**
 * Shared line-icon set. Lucide-style geometry, 24×24 viewBox, 1.5 stroke,
 * `currentColor` so every icon inherits the surrounding text/tone color.
 *
 * These replace the pictographic emojis that used to stand in for iconography
 * on public marketing surfaces. Emojis render inconsistently across platforms
 * and read as playful; a stroke icon set reads as a calm, premium B2B product.
 * Add a glyph here rather than inlining raw <svg> at the call site so the whole
 * app shares one visual language.
 */

export type IconName =
  | 'lock'
  | 'shield-check'
  | 'calendar'
  | 'file-text'
  | 'smartphone'
  | 'cpu'
  | 'app-window'
  | 'key'
  | 'gauge'
  | 'sparkles'
  | 'mail'
  | 'phone'
  | 'alert-triangle';

// Each entry is the inner geometry of a 24×24 stroke icon.
const PATHS: Record<IconName, ReactNode> = {
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </>
  ),
  smartphone: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </>
  ),
  cpu: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
    </>
  ),
  'app-window': (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M10 4v4M2 8h20" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
    </>
  ),
  gauge: (
    <>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </>
  ),
  sparkles: (
    <>
      <path d="M9.94 14.06A2 2 0 0 0 8.5 12.62l-4.14-1.07a.5.5 0 0 1 0-.96L8.5 9.5a2 2 0 0 0 1.44-1.44l1.06-4.13a.5.5 0 0 1 .96 0l1.07 4.13A2 2 0 0 0 15.5 9.5l4.13 1.06a.5.5 0 0 1 0 .96L15.5 12.62a2 2 0 0 0-1.44 1.44l-1.07 4.13a.5.5 0 0 1-.96 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  phone: (
    <path d="M13.83 19.53a16 16 0 0 1-7.36-7.36 1 1 0 0 1 .27-1.16l1.92-1.57a1 1 0 0 0 .29-1.06L8.1 4.66A1 1 0 0 0 7.05 4H4a2 2 0 0 0-2 2.06 16 16 0 0 0 14 14A2 2 0 0 0 20 18v-3.05a1 1 0 0 0-.66-1.05l-3.72-1.16a1 1 0 0 0-1.06.29l-1.57 1.92a1 1 0 0 1-1.16.27" />
  ),
  'alert-triangle': (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Pixel size for width and height. Defaults to 20. */
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
