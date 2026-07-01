import { Link } from 'react-router-dom';
import { SiteLayout, mkic, MK_CHECK } from './SiteLayout.js';

/**
 * Pricing — rebuilt on the shared SiteLayout (teal/orange brand) so it
 * matches the rest of the marketing site. Replaces the old MarketingShell
 * version that dropped users onto a different, off-brand page.
 */

interface Tier {
  name: string;
  price: string;
  period: string;
  summary: string;
  features: readonly string[];
  cta: string;
  to: string;
  featured: boolean;
}

const tiers: readonly Tier[] = [
  {
    name: 'Starter',
    price: '$249',
    period: '/ month',
    summary: 'For new and single-branch agencies under 25 active clients.',
    features: [
      'Up to 25 active clients',
      'Unlimited caregivers',
      'GPS EVV with 30-second clock-in',
      'Audit trail · scheduling bundled',
      'PA DHS / PROMISe ready',
      'Email support',
    ],
    cta: 'Talk to sales',
    to: '/contact',
    featured: false,
  },
  {
    name: 'Standard',
    price: '$649',
    period: '/ month',
    summary: 'For multi-coordinator agencies with 25–200 active clients.',
    features: [
      'Up to 200 active clients',
      'Everything in Starter',
      'Sandata / HHAeXchange aggregator export',
      'Visit Review queue + exception workflow',
      'Audit-grade trail, 7-year retention',
      'Phone + Slack support',
    ],
    cta: 'Book a demo',
    to: '/demo',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'annual contract',
    summary: 'For multi-branch and value-based-care contracts at scale.',
    features: [
      '200+ active clients',
      'Multi-branch agency hierarchy',
      'Custom Cures-Act submission profile',
      'Dedicated environment + SLAs',
      'BAA included; engineered to HIPAA Security Rule controls',
      'Named CSM, 30-min P1 response',
    ],
    cta: 'Contact sales',
    to: '/contact',
    featured: false,
  },
];

const faqs: readonly { q: string; a: string }[] = [
  {
    q: 'Are there per-visit or per-transaction fees?',
    a: 'No. Pricing is a predictable monthly subscription by client volume — no per-visit nickel-and-diming on EVV captures or claim transactions.',
  },
  {
    q: 'Do all plans include the full EVV engine?',
    a: 'Yes. Every plan runs the same EVV engine — the same six federal Cures-Act elements, the same PA DHS alignment, and the same tamper-evident audit trail. Tiers differ only in client volume and support.',
  },
  {
    q: 'What counts as an "active client"?',
    a: 'A client with at least one authorized service and scheduled visit in the billing month. Inactive or discharged clients do not count toward your tier.',
  },
  {
    q: 'Is billing & payroll included?',
    a: 'Scheduling, EVV, and the audit trail are live today. Billing reconciliation and payroll exports are on the roadmap — ask sales about early access for your agency.',
  },
];

export function PricingPage() {
  return (
    <SiteLayout>
      <header className="mk-hero">
        <div className="mk-hero-grid" aria-hidden />
        <div className="mk-heroin">
          <span className="mk-eyebrow">Pricing</span>
          <h1 className="mk-h1">Predictable per-month pricing.</h1>
          <p className="mk-lead">
            No per-visit fees, no surprise transaction charges. One monthly plan by client
            volume — the full EVV engine and audit trail on every tier.
          </p>
        </div>
      </header>

      <section className="mk-sec">
        <div className="mk-wrap">
          <div className="mk-grid">
            {tiers.map((t) => (
              <div
                key={t.name}
                className="mk-card"
                style={
                  t.featured
                    ? { borderColor: 'var(--accent)', boxShadow: '0 24px 60px -32px rgba(16,116,128,.45)', position: 'relative' }
                    : undefined
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>
                    {t.name}
                  </span>
                  {t.featured && <span className="mk-pill">Most popular</span>}
                </div>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: '.5rem' }}>
                  <span style={{ fontSize: '2.6rem', fontWeight: 600, letterSpacing: '-.03em', color: 'var(--ink)' }}>{t.price}</span>
                  <span style={{ fontSize: '.9rem', color: 'var(--mut)', fontWeight: 500 }}>{t.period}</span>
                </div>
                <p style={{ marginTop: 10, fontSize: '.93rem', lineHeight: 1.6, color: 'var(--body)' }}>{t.summary}</p>
                <ul className="mk-checks">
                  {t.features.map((f) => (
                    <li key={f}>
                      <span className="mk-ck">{mkic(MK_CHECK)}</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={t.to}
                  className={`mk-btn ${t.featured ? 'mk-pri' : 'mk-ghost'}`}
                  style={{ marginTop: 24, width: '100%' }}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>

          <p style={{ maxWidth: '62ch', margin: '40px auto 0', textAlign: 'center', color: 'var(--body)', lineHeight: 1.6 }}>
            All plans include the same EVV engine — the same federal Cures-Act elements, the same
            PA DHS alignment, and the same tamper-evident audit trail. Tiers differ only in client
            volume and support.
          </p>
        </div>
      </section>

      <section className="mk-sec tight mk-alt">
        <div className="mk-wrap">
          <div className="mk-center">
            <p className="mk-eylabel">Questions</p>
            <h2 className="mk-h2">Pricing, answered.</h2>
          </div>
          <div className="mk-faqs" style={{ marginTop: 36 }}>
            {faqs.map((f) => (
              <div className="mk-faq" key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-sec tight">
        <div className="mk-wrap">
          <div className="mk-callout">
            <h2>See it on your own caseload.</h2>
            <p>A 30-minute walkthrough with your authorizations, task codes, and a live verified visit.</p>
            <div className="mk-herocta">
              <Link to="/demo" className="mk-btn mk-white">Book a demo</Link>
              <Link to="/contact" className="mk-btn mk-outline">Talk to sales</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
