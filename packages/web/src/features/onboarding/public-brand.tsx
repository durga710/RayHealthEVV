import React, { useEffect } from 'react';

/* ─────────────────────────────────────────────────────────────
   Shared brand shell for the PUBLIC hiring surface: the agency
   homepage (/:slug), application (/:slug/apply), applicant portal
   and interview. These pages carry the AGENCY's identity, not
   RayHealth's admin chrome — warm editorial palette, a serif
   display face (Fraunces), and a red monoline mark that echoes
   the home-care agency world (Cyanjel's own logo is a red
   monoline home). Everything is scoped under .pub-* so nothing
   leaks into the admin app, and these routes are lazy-loaded so
   the font/css cost is paid only here.
   ───────────────────────────────────────────────────────────── */

const FRAUNCES_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap';

/** Injects the display font once per document; safe across the public pages. */
export function usePublicFonts(): void {
  useEffect(() => {
    if (document.querySelector(`link[href="${FRAUNCES_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FRAUNCES_HREF;
    document.head.appendChild(link);
  }, []);
}

/**
 * Red monoline "home + heart" mark used as the default agency logomark on
 * every public hiring page. Single continuous stroke, matching the monoline
 * logo style common to home-care brands.
 */
export function AgencyMark({ size = 40, stroke = 'var(--pub-brand)' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M8 22 24 8l16 14v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V22Z"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 34.5c-4.4-2.9-6.6-5.4-6.6-8.1 0-2 1.5-3.4 3.3-3.4 1.3 0 2.5.7 3.3 2 .8-1.3 2-2 3.3-2 1.8 0 3.3 1.4 3.3 3.4 0 2.7-2.2 5.2-6.6 8.1Z"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ServiceIconName = 'personal' | 'companionship' | 'medication' | 'meals' | 'respite' | 'home';

const SERVICE_ICON_PATHS: Record<ServiceIconName, React.ReactNode> = {
  personal: (
    // hand holding heart
    <>
      <path d="M7 27v-9c0-1.7 1.3-3 3-3s3 1.3 3 3v5" />
      <path d="M13 23l6.2-2.1c1.6-.5 3.2.4 3.7 2 .4 1.5-.4 3-1.9 3.6L14 29.6 7 27" />
      <path d="M18 6.5c1-1.6 3.1-1.9 4.4-.7 1.4 1.2 1.5 3.3.2 4.6L18 15l-4.6-4.6c-1.3-1.3-1.2-3.4.2-4.6 1.3-1.2 3.4-.9 4.4.7Z" />
    </>
  ),
  companionship: (
    // two figures
    <>
      <circle cx="11.5" cy="10.5" r="3.5" />
      <circle cx="22" cy="12.5" r="2.8" />
      <path d="M5 27v-3.5C5 20 7.9 17 11.5 17s6.5 3 6.5 6.5V27" />
      <path d="M20 27v-2.6c0-2.9 2.2-5.2 5-5.2 1 0 1.9.3 2.7.8" />
    </>
  ),
  medication: (
    // clock + pill
    <>
      <circle cx="13" cy="13" r="8" />
      <path d="M13 8.5V13l3 2" />
      <rect x="18.5" y="19.5" width="11" height="6.4" rx="3.2" transform="rotate(-35 18.5 19.5)" />
    </>
  ),
  meals: (
    // bowl with steam
    <>
      <path d="M5.5 17h21c0 5-4 9.5-10.5 9.5S5.5 22 5.5 17Z" />
      <path d="M12 12.5c0-1.5 1.5-1.5 1.5-3S12 8 12 6.5M18 12.5c0-1.5 1.5-1.5 1.5-3S18 8 18 6.5" />
    </>
  ),
  respite: (
    // sun over horizon
    <>
      <path d="M8.5 20a7.5 7.5 0 0 1 15 0" />
      <path d="M16 6v3M6 20H3.5M28.5 20H26M8.9 11.9 7 10M23.1 11.9 25 10" />
      <path d="M4 25h24" />
    </>
  ),
  home: (
    // house with door
    <>
      <path d="M5.5 14.5 16 5.5l10.5 9v11a1.6 1.6 0 0 1-1.6 1.6H7.1a1.6 1.6 0 0 1-1.6-1.6v-11Z" />
      <path d="M13 27v-7.5h6V27" />
    </>
  ),
};

/** Warm monoline icon for a service card, picked by keyword from the name. */
export function ServiceIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const key: ServiceIconName = n.includes('companion')
    ? 'companionship'
    : n.includes('medic')
      ? 'medication'
      : n.includes('meal') || n.includes('nutrition')
        ? 'meals'
        : n.includes('respite')
          ? 'respite'
          : n.includes('home') || n.includes('visit')
            ? 'home'
            : 'personal';
  return (
    <span className="pub-service-icon" aria-hidden>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {SERVICE_ICON_PATHS[key]}
      </svg>
    </span>
  );
}

/**
 * The public-surface stylesheet. Scoped: every selector starts with .pub-.
 * Color system lives in CSS vars on .pub-root so a future per-agency accent
 * only has to override --pub-brand/--pub-brand-deep in one place.
 */
export function PublicBrandStyles() {
  usePublicFonts();
  return <style>{PUBLIC_CSS}</style>;
}

const PUBLIC_CSS = `
.pub-root {
  --pub-brand: #96222E;
  --pub-brand-deep: #701A24;
  --pub-brand-soft: #F8ECE8;
  --pub-blush: #F3DCD3;
  --pub-ink: #241B18;
  --pub-body-c: #5B4F4A;
  --pub-faint: #8A7B74;
  --pub-cream: #FAF5EE;
  --pub-paper: #FFFFFF;
  --pub-line: #EADFD2;
  --pub-gold: #B98444;
  --pub-dark: #221816;
  --pub-serif: 'Fraunces', Georgia, 'Times New Roman', serif;
  --pub-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  font-family: var(--pub-sans);
  background: var(--pub-cream);
  color: var(--pub-ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

.pub-root ::selection { background: var(--pub-blush); }

/* ── type ── */
.pub-display {
  font-family: var(--pub-serif);
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.08;
  margin: 0;
  color: var(--pub-ink);
}
.pub-eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--pub-brand);
  margin: 0 0 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.pub-eyebrow::before {
  content: '';
  width: 26px; height: 1.5px;
  background: var(--pub-brand);
  opacity: 0.55;
}
.pub-lede { font-size: 1.08rem; line-height: 1.75; color: var(--pub-body-c); margin: 0; }

/* ── nav ── */
.pub-nav {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.85rem clamp(1.25rem, 4vw, 3rem);
  background: rgba(250, 245, 238, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--pub-line);
}
.pub-nav-name {
  display: flex; align-items: center; gap: 0.65rem;
  font-family: var(--pub-serif); font-weight: 600; font-size: 1.15rem;
  color: var(--pub-ink); text-decoration: none; letter-spacing: -0.01em;
  min-width: 0;
}
.pub-nav-name span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pub-nav-links { display: flex; align-items: center; gap: 1.4rem; }
.pub-nav-link {
  font-size: 0.88rem; font-weight: 600; color: var(--pub-body-c);
  text-decoration: none; transition: color 0.15s ease;
}
.pub-nav-link:hover { color: var(--pub-brand); }

/* ── buttons ── */
.pub-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  font-family: var(--pub-sans); font-weight: 700; font-size: 0.93rem;
  border-radius: 999px; padding: 0.78rem 1.65rem;
  text-decoration: none; cursor: pointer; border: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.pub-btn-primary {
  background: var(--pub-brand); color: #fff;
  box-shadow: 0 10px 24px -10px rgba(150, 34, 46, 0.55);
}
.pub-btn-primary:hover { background: var(--pub-brand-deep); transform: translateY(-1px); }
.pub-btn-ghost {
  color: var(--pub-ink);
  border: 1.5px solid var(--pub-line); background: var(--pub-paper);
}
.pub-btn-ghost:hover { border-color: var(--pub-brand); color: var(--pub-brand); }
.pub-btn-light { background: #fff; color: var(--pub-brand-deep); }
.pub-btn-light:hover { transform: translateY(-1px); box-shadow: 0 12px 28px -12px rgba(0,0,0,0.4); }

/* ── hero ── */
.pub-hero {
  display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: clamp(2rem, 5vw, 4.5rem); align-items: center;
  max-width: 1160px; margin: 0 auto;
  padding: clamp(3rem, 7vw, 5.5rem) clamp(1.25rem, 4vw, 3rem) clamp(2.5rem, 5vw, 4rem);
}
.pub-hero h1 { font-size: clamp(2.4rem, 5.4vw, 3.9rem); }
.pub-hero h1 em {
  font-style: italic; font-weight: 500; color: var(--pub-brand);
}
.pub-hero-copy { max-width: 34rem; margin-top: 1.35rem; }
.pub-hero-ctas { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 2rem; }
.pub-trust-row {
  display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 2.1rem; padding: 0; list-style: none;
}
.pub-trust-chip {
  font-size: 0.78rem; font-weight: 600; color: var(--pub-body-c);
  background: var(--pub-paper); border: 1px solid var(--pub-line);
  border-radius: 999px; padding: 0.4rem 0.85rem;
  display: inline-flex; align-items: center; gap: 0.42rem;
}
.pub-trust-chip svg { color: var(--pub-brand); flex-shrink: 0; }

/* hero visual: layered arches + mark, echoing the monoline brand */
.pub-hero-visual { position: relative; min-height: 380px; }
.pub-arch {
  position: absolute; inset: 0;
  border-radius: 200px 200px 24px 24px;
  background: linear-gradient(168deg, var(--pub-blush) 0%, var(--pub-brand-soft) 58%, #fff 100%);
  border: 1px solid var(--pub-line);
  overflow: hidden;
}
.pub-arch::after {
  content: '';
  position: absolute; inset: 14px;
  border-radius: 186px 186px 16px 16px;
  border: 1.5px dashed rgba(150, 34, 46, 0.28);
}
.pub-arch-mark {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -58%);
  display: grid; place-items: center;
  width: 132px; height: 132px; border-radius: 50%;
  background: #fff; border: 1px solid var(--pub-line);
  box-shadow: 0 24px 48px -20px rgba(112, 26, 36, 0.35);
}
.pub-float {
  position: absolute; display: flex; align-items: center; gap: 0.65rem;
  background: #fff; border: 1px solid var(--pub-line); border-radius: 14px;
  padding: 0.7rem 1rem; box-shadow: 0 18px 40px -18px rgba(36, 27, 24, 0.28);
  font-size: 0.8rem; line-height: 1.35;
}
.pub-float b { display: block; font-size: 0.86rem; color: var(--pub-ink); }
.pub-float span { color: var(--pub-faint); }
.pub-float-icon {
  display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px;
  background: var(--pub-brand-soft); color: var(--pub-brand); flex-shrink: 0;
}

/* ── shared section scaffolding ── */
.pub-section { max-width: 1160px; margin: 0 auto; padding: clamp(2.5rem, 6vw, 4.5rem) clamp(1.25rem, 4vw, 3rem); }
.pub-section-head { max-width: 40rem; margin-bottom: 2.2rem; }
.pub-section-head h2 { font-size: clamp(1.7rem, 3.2vw, 2.4rem); }

/* about */
.pub-about {
  display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: clamp(2rem, 5vw, 4rem); align-items: start;
}
.pub-about-body { font-size: 1.02rem; line-height: 1.85; color: var(--pub-body-c); white-space: pre-wrap; margin: 0; }
.pub-about-aside { display: flex; flex-direction: column; gap: 0.9rem; }
.pub-fact {
  background: var(--pub-paper); border: 1px solid var(--pub-line); border-radius: 16px;
  padding: 1.1rem 1.3rem;
}
.pub-fact b { font-family: var(--pub-serif); font-size: 1.12rem; font-weight: 600; display: block; margin-bottom: 0.2rem; }
.pub-fact span { font-size: 0.85rem; color: var(--pub-faint); line-height: 1.5; }

/* services */
.pub-services { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.pub-service-card {
  background: var(--pub-paper); border: 1px solid var(--pub-line); border-radius: 18px;
  padding: 1.6rem 1.5rem; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.pub-service-card:hover {
  transform: translateY(-3px);
  border-color: rgba(150, 34, 46, 0.35);
  box-shadow: 0 22px 44px -24px rgba(112, 26, 36, 0.3);
}
.pub-service-icon {
  display: grid; place-items: center; width: 52px; height: 52px; border-radius: 15px;
  background: var(--pub-brand-soft); color: var(--pub-brand); margin-bottom: 1.05rem;
}
.pub-service-card h3 { font-family: var(--pub-serif); font-weight: 600; font-size: 1.18rem; margin: 0 0 0.45rem; }
.pub-service-card p { margin: 0; font-size: 0.9rem; line-height: 1.65; color: var(--pub-body-c); }

/* careers band */
.pub-careers {
  background: var(--pub-dark); color: #fff; border-radius: 26px;
  padding: clamp(2.2rem, 5vw, 3.5rem);
  position: relative; overflow: hidden;
}
.pub-careers::before {
  content: '';
  position: absolute; top: -40%; right: -12%; width: 55%; aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(150, 34, 46, 0.5) 0%, transparent 68%);
  pointer-events: none;
}
.pub-careers .pub-eyebrow { color: #E7A9A0; }
.pub-careers .pub-eyebrow::before { background: #E7A9A0; }
.pub-careers h2 { color: #fff; font-size: clamp(1.7rem, 3.2vw, 2.3rem); max-width: 30rem; }
.pub-careers-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.9rem 2.4rem; margin-top: 2.2rem; position: relative;
}
.pub-careers-item { display: flex; gap: 1rem; align-items: flex-start; }
.pub-careers-num {
  font-family: var(--pub-serif); font-style: italic; font-weight: 500;
  color: #E7A9A0; font-size: 1.3rem; line-height: 1.2; flex-shrink: 0; min-width: 2rem;
}
.pub-careers-item b { display: block; font-size: 1rem; margin-bottom: 0.3rem; }
.pub-careers-item p { margin: 0; font-size: 0.88rem; line-height: 1.65; color: #C9BBB6; }

/* contact */
.pub-contact-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
.pub-contact-card {
  background: var(--pub-paper); border: 1px solid var(--pub-line); border-radius: 16px;
  padding: 1.3rem 1.4rem; font-size: 0.92rem; line-height: 1.55; color: var(--pub-body-c);
}
.pub-contact-card b {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--pub-faint); margin-bottom: 0.55rem;
}
.pub-contact-card b svg { color: var(--pub-brand); }
.pub-contact-card a { color: var(--pub-brand); font-weight: 700; text-decoration: none; }
.pub-contact-card a:hover { text-decoration: underline; }

/* footer */
.pub-footer {
  border-top: 1px solid var(--pub-line);
  padding: 2rem clamp(1.25rem, 4vw, 3rem) 2.5rem;
  max-width: 1160px; margin: 0 auto;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;
}
.pub-footer-name { display: flex; align-items: center; gap: 0.55rem; font-family: var(--pub-serif); font-weight: 600; }
.pub-footer small { color: var(--pub-faint); font-size: 0.78rem; }
.pub-footer small a { color: inherit; }

/* ── forms (apply / portal) ── */
.pub-panel {
  background: var(--pub-paper); border: 1px solid var(--pub-line); border-radius: 20px;
  padding: clamp(1.5rem, 3.5vw, 2.25rem);
}
.pub-label {
  font-size: 0.8rem; font-weight: 700; color: var(--pub-ink); letter-spacing: 0.02em;
}
.pub-label small { color: var(--pub-faint); font-weight: 500; }
.pub-input, .pub-textarea {
  width: 100%; box-sizing: border-box;
  border: 1.5px solid var(--pub-line); border-radius: 12px;
  background: #fff; color: var(--pub-ink);
  font-family: var(--pub-sans); font-size: 0.95rem; line-height: 1.5;
  padding: 0.7rem 0.9rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.pub-input:focus, .pub-textarea:focus {
  outline: none; border-color: var(--pub-brand);
  box-shadow: 0 0 0 3px rgba(150, 34, 46, 0.14);
}
.pub-alert {
  display: flex; gap: 0.6rem; align-items: flex-start;
  background: #FDF0EF; border: 1px solid #F2CFC9; color: var(--pub-brand-deep);
  border-radius: 12px; padding: 0.8rem 1rem; font-size: 0.88rem; line-height: 1.5;
}

/* status pills on the portal */
.pub-pill {
  font-size: 0.74rem; font-weight: 700; border-radius: 999px; padding: 0.28rem 0.75rem;
  display: inline-flex; align-items: center; gap: 0.35rem;
}

/* ── responsive ── */
@media (max-width: 960px) {
  .pub-hero { grid-template-columns: 1fr; }
  .pub-hero-visual { min-height: 300px; max-width: 430px; width: 100%; margin: 0 auto; }
  .pub-about { grid-template-columns: 1fr; }
  .pub-services { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pub-contact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .pub-nav-links .pub-nav-link { display: none; }
  .pub-services { grid-template-columns: 1fr; }
  .pub-careers-grid { grid-template-columns: 1fr; }
  .pub-contact-grid { grid-template-columns: 1fr; }
  .pub-float { display: none; }
}
`;
