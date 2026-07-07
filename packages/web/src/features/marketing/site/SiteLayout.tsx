import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SupportChat } from '../../support/SupportChat.js';
import { BrandLogo } from '../../../components/brand/BrandLogo.js';

/**
 * Shared chrome + design system for the RayHealth marketing site,
 * matching the emerald editorial LandingPage. Self-contained (no Tailwind).
 * Marketing content pages render <SiteLayout> and use the `mk-*` classes
 * documented in SITE_CSS below.
 */

export const NAV = {
  platform: [
    { label: 'Overview', to: '/' },
    { label: 'RayVerify', to: '/rayverify' },
    { label: 'AI automation', to: '/platform/ai-automation' },
    { label: 'Compliance', to: '/platform/compliance' },
    { label: 'Pricing', to: '/pricing' },
  ],
  solutions: [
    { label: 'Scheduling', to: '/solutions/scheduling' },
    { label: 'Electronic visit verification', to: '/solutions/electronic-visit-verification' },
    { label: 'Billing & payroll', to: '/solutions/billing-payroll' },
    { label: 'Workforce & training', to: '/solutions/workforce-training' },
  ],
  resources: [
    { label: 'EVV guide', to: '/resources/evv-guide' },
    { label: 'Task code reference', to: '/resources/task-codes' },
    { label: 'Audit checklist', to: '/resources/audit-checklist' },
    { label: 'What’s new', to: '/launch' },
  ],
  company: [
    { label: 'Contact', to: '/contact' },
    { label: 'Request a demo', to: '/demo' },
    { label: 'Sign in', to: '/login' },
    { label: 'Trust Center', to: '/trust' },
    { label: 'HIPAA', to: '/compliance/hipaa' },
    { label: 'Privacy', to: '/privacy' },
    { label: 'Terms', to: '/terms' },
  ],
};

export const mkic = (d: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
export const MK_CHECK = <path d="M20 6 9 17l-5-5" />;


export const SITE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
.mk{--ink:#0a0f0d;--ink-soft:#39433e;--body:#525c57;--mut:#8a948e;--paper:#fff;--warm:#fbfbf8;--surface:#f5f6f3;--line:#e8eae4;--line-2:#dde0d9;--accent:#107480;--accent-deep:#0c5d66;--accent-tint:#e7f3f4;--accent2:#ee6c2c;--accent2-deep:#d8551b;--accent2-tint:#fdeee4;--ink-bg:#0a0f0d;--dark-line:rgba(255,255,255,.10);--maxw:1120px;
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--body);background:var(--paper);-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column;}
.mk *{box-sizing:border-box;}
.mk h1,.mk h2,.mk h3,.mk h4{color:var(--ink);margin:0;font-weight:600;letter-spacing:-.02em;}
.mk p{margin:0;} .mk :where(a){text-decoration:none;color:inherit;}
.mk-wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px;width:100%;}
.mk-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;height:44px;padding:0 1.25rem;border-radius:10px;font-size:.9375rem;font-weight:550;transition:background .16s,box-shadow .16s,transform .16s,border-color .16s;}
.mk-pri{background:var(--accent);color:#fff;box-shadow:0 8px 24px -12px rgba(16,116,128,.6);}
.mk-pri:hover{background:var(--accent-deep);transform:translateY(-1px);}
.mk-ghost{color:var(--ink);border:1px solid var(--line-2);background:var(--paper);}
.mk-ghost:hover{border-color:var(--ink);}
.mk-line{color:var(--accent-deep);font-weight:600;font-size:.9375rem;display:inline-flex;align-items:center;gap:.35rem;}
/* nav */
.mk-nav{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.72);backdrop-filter:blur(16px) saturate(160%);border-bottom:1px solid var(--line);}
.mk-navin{max-width:var(--maxw);margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;}
.mk-logo{display:inline-flex;align-items:center;gap:.55rem;font-weight:650;font-size:1.0625rem;color:var(--ink);}
.mk-navmid{display:flex;gap:4px;}
.mk-navmid a{padding:.5rem .8rem;border-radius:8px;font-size:.9rem;font-weight:500;color:var(--ink-soft);transition:color .15s,background .15s;}
.mk-navmid a:hover{color:var(--ink);background:var(--surface);}
.mk-navend{display:flex;align-items:center;gap:.6rem;}
.mk-navend .si{font-size:.9rem;font-weight:550;color:var(--ink);padding:.5rem .4rem;}
.mk-burger{display:none;width:42px;height:42px;align-items:center;justify-content:center;border:1px solid var(--line-2);border-radius:10px;background:var(--paper);color:var(--ink);cursor:pointer;padding:0;transition:border-color .15s,background .15s;}
.mk-burger:hover{border-color:var(--ink);background:var(--surface);}
.mk-mobile{display:none;border-top:1px solid var(--line);background:var(--paper);}
.mk-mobile-in{max-width:var(--maxw);margin:0 auto;padding:6px 24px 18px;display:flex;flex-direction:column;}
.mk-mobile a{padding:14px 4px;font-size:1rem;font-weight:500;color:var(--ink);border-bottom:1px solid var(--line);}
.mk-mobile a:hover{color:var(--accent-deep);}
.mk-mobile .mk-btn{margin-top:16px;width:100%;border-bottom:none;color:#fff;}
@media(max-width:860px){.mk-navmid{display:none;}.mk-navend .si{display:none;}.mk-burger{display:inline-flex;}.mk-mobile.open{display:block;}}
@media(max-width:420px){.mk-navend .mk-pri{display:none;}}
/* hero */
.mk-hero{position:relative;overflow:hidden;background:var(--warm);border-bottom:1px solid var(--line);}
.mk-hero-grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:64px 64px;opacity:.45;-webkit-mask-image:radial-gradient(ellipse 80% 70% at 30% 6%,#000 6%,transparent 64%);mask-image:radial-gradient(ellipse 80% 70% at 30% 6%,#000 6%,transparent 64%);}
.mk-heroin{position:relative;max-width:var(--maxw);margin:0 auto;padding:80px 24px 72px;}
.mk-eyebrow{display:inline-flex;align-items:center;gap:.5rem;padding:.35rem .8rem;border-radius:999px;background:var(--paper);border:1px solid var(--line-2);font-size:.76rem;font-weight:600;color:var(--accent-deep);}
.mk-h1{font-size:clamp(2.2rem,4.4vw,3.2rem);line-height:1.08;letter-spacing:-.035em;font-weight:600;color:var(--ink);margin-top:18px;max-width:18ch;text-wrap:balance;}
.mk-lead{margin-top:18px;font-size:1.1875rem;line-height:1.6;color:var(--body);max-width:60ch;}
.mk-herocta{margin-top:28px;display:flex;gap:.75rem;flex-wrap:wrap;}
/* sections */
.mk-sec{padding:88px 0;}
.mk-sec.tight{padding:64px 0;}
.mk-alt{background:var(--warm);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.mk-dark{background:var(--ink-bg);color:#cfd6d2;}
.mk-dark h1,.mk-dark h2,.mk-dark h3{color:#fff;}
.mk-eylabel{font-size:.78rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-deep);}
.mk-dark .mk-eylabel{color:#5fd0d6;}
.mk-h2{font-size:clamp(1.7rem,3.2vw,2.4rem);line-height:1.12;letter-spacing:-.03em;margin-top:12px;}
.mk-deck{margin-top:14px;font-size:1.0625rem;line-height:1.6;color:var(--body);max-width:58ch;}
.mk-dark .mk-deck{color:#9fa8a3;}
.mk-center{text-align:center;}.mk-center .mk-deck{margin-left:auto;margin-right:auto;}
/* card grid */
.mk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px;}
.mk-grid.cols2{grid-template-columns:repeat(2,1fr);}
.mk-grid.cols4{grid-template-columns:repeat(4,1fr);}
@media(max-width:880px){.mk-grid,.mk-grid.cols4{grid-template-columns:1fr 1fr;}}
@media(max-width:560px){.mk-grid,.mk-grid.cols2,.mk-grid.cols4{grid-template-columns:1fr;}}
.mk-card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:28px;transition:transform .2s,box-shadow .2s,border-color .2s;}
.mk-card:hover{transform:translateY(-3px);box-shadow:0 18px 44px -28px rgba(10,30,20,.4);border-color:var(--line-2);}
.mk-ficon{width:44px;height:44px;border-radius:11px;display:grid;place-items:center;background:var(--accent-tint);color:var(--accent-deep);margin-bottom:16px;}
.mk-card h3{font-size:1.0625rem;letter-spacing:-.01em;}
.mk-card p{margin-top:8px;font-size:.93rem;line-height:1.6;color:var(--body);}
/* feature alternating rows */
.mk-feat{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;padding:48px 0;}
.mk-feat + .mk-feat{border-top:1px solid var(--line);}
.mk-feat.rev .mk-feattext{order:2;}
.mk-feattext h3{font-size:clamp(1.35rem,2.2vw,1.8rem);letter-spacing:-.025em;margin-top:12px;line-height:1.15;}
.mk-feattext p{margin-top:12px;font-size:1.0625rem;line-height:1.6;color:var(--body);}
.mk-visual{border:1px solid var(--line);border-radius:18px;background:var(--surface);padding:18px;box-shadow:0 34px 70px -44px rgba(10,30,20,.4);min-height:260px;}
@media(max-width:880px){.mk-feat{grid-template-columns:1fr;gap:24px;padding:32px 0;}.mk-feat.rev .mk-feattext{order:-1;}}
/* checklist */
.mk-checks{margin:18px 0 0;padding:0;display:flex;flex-direction:column;gap:11px;}
.mk-checks li{list-style:none;display:flex;gap:.6rem;align-items:flex-start;font-size:.97rem;color:var(--ink-soft);}
.mk-ck{width:20px;height:20px;border-radius:6px;background:var(--accent-tint);color:var(--accent-deep);display:grid;place-items:center;flex-shrink:0;margin-top:1px;}
.mk-ck svg{width:13px;height:13px;}
/* stat band */
.mk-stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-top:40px;background:var(--paper);}
.mk-stat{padding:32px 24px;border-right:1px solid var(--line);}
.mk-stat:last-child{border-right:none;}
.mk-stat .v{font-size:2.2rem;font-weight:600;color:var(--ink);letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.mk-stat .l{margin-top:8px;font-size:.875rem;color:var(--mut);line-height:1.4;}
@media(max-width:760px){.mk-stats{grid-template-columns:1fr 1fr;}.mk-stat:nth-child(2){border-right:none;}.mk-stat:nth-child(-n+2){border-bottom:1px solid var(--line);}}
/* steps */
.mk-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:40px;}
.mk-step{border-top:2px solid var(--accent);padding-top:16px;}
.mk-step .sn{font-size:.8rem;font-weight:650;color:var(--accent-deep);font-variant-numeric:tabular-nums;}
.mk-step h3{margin-top:8px;font-size:1.02rem;letter-spacing:-.01em;}
.mk-step p{margin-top:6px;font-size:.9rem;line-height:1.55;color:var(--body);}
@media(max-width:880px){.mk-steps{grid-template-columns:1fr 1fr;}}
@media(max-width:520px){.mk-steps{grid-template-columns:1fr;}}
/* table */
.mk-table{margin-top:36px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--paper);}
.mk-trow{display:grid;border-top:1px solid var(--line);}
.mk-trow:first-child{border-top:none;background:var(--surface);}
.mk-trow>div{padding:14px 20px;font-size:.92rem;color:var(--ink-soft);border-right:1px solid var(--line);}
.mk-trow>div:last-child{border-right:none;}
.mk-trow:first-child>div{font-weight:600;color:var(--ink);font-size:.82rem;letter-spacing:.02em;text-transform:uppercase;}
.mk-trow .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent-deep);font-weight:600;}
/* semantic table, same look as mk-table, real <table>/<th>/<td> for a11y */
.mk-tbl{width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:.92rem;}
.mk-tbl thead th{text-align:left;background:var(--surface);color:var(--ink);font-weight:600;font-size:.78rem;letter-spacing:.02em;text-transform:uppercase;padding:14px 20px;border-bottom:1px solid var(--line);}
.mk-tbl td{padding:14px 20px;border-top:1px solid var(--line);color:var(--ink-soft);vertical-align:top;}
.mk-tbl tbody tr:first-child td{border-top:none;}
.mk-tbl td:first-child{color:var(--ink);font-weight:550;}
.mk-tbl .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent-deep);font-weight:600;}
/* callout / cta */
.mk-callout{position:relative;overflow:hidden;background:var(--ink-bg);border-radius:24px;padding:64px 40px;text-align:center;color:#fff;}
.mk-callout::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 100% at 50% 0%,rgba(16,116,128,.22),transparent 70%);}
.mk-callout h2{position:relative;color:#fff;font-size:clamp(1.7rem,3.2vw,2.4rem);letter-spacing:-.03em;}
.mk-callout p{position:relative;color:#9fa8a3;font-size:1.05rem;line-height:1.6;max-width:48ch;margin:14px auto 0;}
.mk-callout .mk-herocta{position:relative;justify-content:center;margin-top:26px;}
.mk-white{background:#fff;color:var(--ink);} .mk-white:hover{background:#f1f3f7;}
.mk-outline{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3);} .mk-outline:hover{background:rgba(255,255,255,.12);}
/* faq */
.mk-faqs{max-width:820px;margin:32px auto 0;}
.mk-faq{border-bottom:1px solid var(--line);padding:22px 2px;}
.mk-faq h3{font-size:1.0625rem;letter-spacing:-.01em;}
.mk-faq p{margin-top:8px;font-size:.95rem;line-height:1.6;color:var(--body);}
/* prose (guides) */
.mk-prose{max-width:760px;margin:0 auto;}
.mk-prose h2{font-size:1.5rem;margin-top:44px;letter-spacing:-.02em;}
.mk-prose h3{font-size:1.15rem;margin-top:28px;}
.mk-prose p{margin-top:14px;font-size:1.0625rem;line-height:1.7;color:var(--body);}
.mk-prose ul{margin-top:14px;padding-left:0;}
.mk-prose li{list-style:none;display:flex;gap:.6rem;align-items:flex-start;font-size:1.0625rem;line-height:1.6;color:var(--body);margin-top:10px;}
.mk-prose .lead{font-size:1.25rem;line-height:1.6;color:var(--ink-soft);}
.mk-pill{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;font-weight:650;letter-spacing:.04em;padding:.25rem .6rem;border-radius:999px;background:var(--accent2-tint);color:var(--accent2-deep);}
/* footer */
.mk-foot{margin-top:auto;border-top:1px solid var(--line);background:var(--warm);padding:64px 0 40px;}
.mk-footgrid{max-width:var(--maxw);margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;gap:32px;}
.mk-foot .blurb{margin-top:16px;font-size:.9rem;line-height:1.6;color:var(--mut);max-width:30ch;}
.mk-footcol h4{font-size:.78rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin-bottom:14px;}
.mk-footcol a{display:block;padding:.3rem 0;font-size:.9rem;color:var(--ink-soft);}
.mk-footcol a:hover{color:var(--ink);}
.mk-footbar{max-width:var(--maxw);margin:48px auto 0;padding:24px 24px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:.82rem;color:var(--mut);}
@media(max-width:760px){.mk-footgrid{grid-template-columns:1fr 1fr;}}
`;

const MOBILE_LINKS: readonly { label: string; to: string }[] = [
  { label: 'Scheduling', to: '/solutions/scheduling' },
  { label: 'Electronic visit verification', to: '/solutions/electronic-visit-verification' },
  { label: 'RayVerify', to: '/rayverify' },
  { label: 'Billing & payroll', to: '/solutions/billing-payroll' },
  { label: 'Workforce & training', to: '/solutions/workforce-training' },
  { label: 'AI automation', to: '/platform/ai-automation' },
  { label: 'Compliance', to: '/platform/compliance' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Sign in', to: '/login' },
];

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  // Close the mobile menu on route change.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  return (
    <div className="mk">
      <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />
      <nav className="mk-nav">
        <div className="mk-navin">
          <Link to="/" aria-label="RayHealthEVV home"><BrandLogo height={34} /></Link>
          <div className="mk-navmid">
            <Link to="/solutions/scheduling">Scheduling</Link>
            <Link to="/solutions/electronic-visit-verification">EVV</Link>
            <Link to="/rayverify">RayVerify</Link>
            <Link to="/solutions/workforce-training">Workforce</Link>
            <Link to="/platform/ai-automation">AI automation</Link>
            <Link to="/pricing">Pricing</Link>
          </div>
          <div className="mk-navend">
            <Link to="/login" className="si">Sign in</Link>
            <Link to="/demo" className="mk-btn mk-pri">Book a demo</Link>
            <button
              type="button"
              className="mk-burger"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mk-mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen
                ? mkic(<path d="M18 6 6 18M6 6l12 12" />)
                : mkic(<><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>)}
            </button>
          </div>
        </div>
        <div id="mk-mobile-menu" className={`mk-mobile${menuOpen ? ' open' : ''}`} hidden={!menuOpen}>
          <div className="mk-mobile-in">
            {MOBILE_LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}>{l.label}</Link>
            ))}
            <Link to="/demo" className="mk-btn mk-pri" onClick={() => setMenuOpen(false)}>Book a demo</Link>
          </div>
        </div>
      </nav>

      {children}

      <footer className="mk-foot">
        <div className="mk-footgrid">
          <div>
            <BrandLogo height={40} />
            <p className="blurb">The operating system for Pennsylvania home-care agencies. Verified visits, defensible claims, one operational core.</p>
          </div>
          <div className="mk-footcol"><h4>Platform</h4>{NAV.platform.map((l) => <Link key={l.label} to={l.to}>{l.label}</Link>)}</div>
          <div className="mk-footcol"><h4>Solutions</h4>{NAV.solutions.map((l) => <Link key={l.label} to={l.to}>{l.label}</Link>)}</div>
          <div className="mk-footcol"><h4>Resources</h4>{NAV.resources.map((l) => <Link key={l.label} to={l.to}>{l.label}</Link>)}</div>
          <div className="mk-footcol"><h4>Company</h4>{NAV.company.map((l) => <Link key={l.label} to={l.to}>{l.label}</Link>)}</div>
        </div>
        <div className="mk-footbar">
          <span>© {new Date().getFullYear()} RayHealthEVV™ · Built in Pennsylvania</span>
          <span>HIPAA-aware infrastructure · 21st Century Cures Act aligned</span>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
}
