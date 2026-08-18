import { z } from 'zod';
import { parseCssColor } from './theme-resolver.js';

/**
 * Agency-supplied colors are stored in a jsonb column and end up in
 * `document.documentElement.style.setProperty`, so they are validated at the
 * boundary rather than trusted. `parseCssColor` accepts only hex and rgb(),
 * which also means nothing string-shaped can ride into the stylesheet.
 */
const cssColorSchema = z
  .string()
  .trim()
  .max(32)
  .refine((value) => parseCssColor(value) !== null, {
    message: 'must be a hex (#RGB / #RRGGBB) or rgb() color',
  });

export const agencyThemeSchema = z.object({
  primaryColor: cssColorSchema.optional(),
  primaryDark: cssColorSchema.optional(),
  accentColor: cssColorSchema.optional(),
  // Rendered into the sidebar brand slot, so it is length-capped: the same
  // unvalidated blob would otherwise be a layout-break vector.
  logoText: z.string().trim().max(40).optional(),
  tagline: z.string().trim().max(120).optional(),
});

export type AgencyTheme = z.infer<typeof agencyThemeSchema>;

export const agencySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  state: z.string().refine((val) => val === 'PA', {
    message: 'Agency must be located in Pennsylvania'
  }),
  operatingTracks: z.array(z.enum(['personal-assistance', 'home-health'])).min(1),
  medicaidProviderNumber: z.string().min(6).optional()
});

export type Agency = z.infer<typeof agencySchema>;

// ── Public hiring page ──────────────────────────────────────────────────────

/**
 * Path segments the public agency page must never claim: every top-level SPA
 * route and API prefix. A slug colliding with one of these would shadow the
 * real page (rayhealthevv.com/<slug> is a catch-all route).
 */
export const RESERVED_PUBLIC_SLUGS = new Set([
  'api', 'admin', 'apply', 'applicant', 'interview', 'portal', 'login', 'signup', 'logout',
  'accept-invite', 'forgot-password', 'reset-password',
  'app', 'assets', 'static', 'settings', 'superadmin', 'support', 'terms',
  'privacy', 'about', 'pricing', 'product', 'platform', 'caregiver', 'evv',
  'scheduling', 'billing', 'compliance', 'learning', 'contact', 'blog', 'docs',
  // Live top-level marketing/product routes in App.tsx. Review finding: a
  // slug matching one of these saves fine but never renders (React Router
  // ranks static routes above /:slug), silently breaking the agency's page.
  // Keep this in sync when adding top-level routes.
  'demo', 'launch', 'ads', 'status', 'trust', 'rayverify',
  // First segments of multi-segment marketing routes: /solutions/* etc. have
  // no bare-segment static route, so /:slug would otherwise claim them.
  'solutions', 'resources',
]);

/** Lowercase letters, digits, hyphens; 3-60 chars; no leading/trailing hyphen. */
export const publicSlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Slug may use lowercase letters, digits, and hyphens')
  .refine((s) => !RESERVED_PUBLIC_SLUGS.has(s), { message: 'This slug is reserved' });

/** Normalize user input ('CyanjelCareLLC' → 'cyanjelcarellc') before validation. */
export function normalizePublicSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Everything the public hiring page shows beyond the slug + about text. All
 * optional , the page renders sensible fallbacks , and every string is
 * length-capped because this is agency-editable content served to the public.
 */
export const publicProfileSchema = z.object({
  /** Brand name when it differs from the registered name ('Cyanjel Home Care'). */
  displayName: z.string().max(120).optional(),
  /** One-line promise ('Because Home Is Where Care Feels Best'). */
  tagline: z.string().max(160).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional(),
  addressLine: z.string().max(200).optional(),
  /** Office hours line ('Mon–Fri 10am–5pm'). */
  hours: z.string().max(120).optional(),
  services: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        blurb: z.string().max(300).optional(),
      }),
    )
    .max(12)
    .optional(),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;
