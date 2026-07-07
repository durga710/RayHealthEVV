/**
 * Single source of truth for the current Terms of Service version. Bump this
 * date string whenever the legal copy in the web TermsPage materially changes,
 * and keep the two in sync, the web page renders the same string so users can
 * see exactly which version they are agreeing to.
 *
 * The version is recorded against each principal that accepts the Terms (agency
 * admins at signup, applicants at job application) so we can prove, per row,
 * which version was in force at the moment of acceptance.
 */
export const CURRENT_TERMS_VERSION = '2026-06-28';
