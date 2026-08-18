/**
 * Translucent variants of a CSS color that may be a `var(--token)` reference
 * rather than a literal hex.
 *
 * The obvious-looking `` `${color}18` `` , append a hex alpha byte , only works
 * when `color` is a 6-digit hex literal. Every color in this app is a
 * `var(--color-*)` token, so that idiom produced the literal string
 * `"var(--color-accent)18"`: an invalid declaration the browser drops on the
 * floor. The affected chips lost their background entirely and their
 * brand-colored text landed on whatever surface was underneath, which on a
 * `<button>` was the brand gradient , brand-on-brand, unreadable.
 *
 * `color-mix` composes correctly against a custom property, so it is the only
 * safe way to tint a token. scripts/css-contract-scan.ts bans the old idiom.
 */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
