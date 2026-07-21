import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AgencyMark, PublicBrandStyles, ServiceIcon } from './public-brand.js';

interface PublicService {
  name: string;
  blurb?: string;
}

interface PublicProfile {
  displayName?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  hours?: string;
  services?: PublicService[];
}

interface AgencyPublicInfo {
  agencyId: string;
  name: string;
  state: string;
  about: string | null;
  profile: PublicProfile | null;
}

/** Fallback service set for agencies that haven't filled their profile yet. */
const DEFAULT_SERVICES: PublicService[] = [
  { name: 'Personal Care', blurb: 'Help with bathing, grooming, dressing, and mobility — delivered with dignity.' },
  { name: 'Companionship', blurb: 'Friendly support and meaningful interaction to brighten every day.' },
  { name: 'Medication Reminders', blurb: 'Gentle, reliable reminders so medications are taken correctly and on time.' },
  { name: 'Meal Preparation', blurb: 'Planning and preparing nutritious meals that fit each client’s needs.' },
  { name: 'Respite Care', blurb: 'Temporary support that gives family caregivers time to rest and recharge.' },
  { name: 'Home Visit Care', blurb: 'One-on-one support brought directly to the comfort of home.' },
];

const WHY_JOIN = [
  { title: 'Apply in minutes', body: 'A two-minute application and a short guided interview — no account, no paperwork run-around.' },
  { title: 'Paperwork made simple', body: 'Upload your ID and certifications from your phone. Track exactly what’s verified and what’s pending.' },
  { title: 'Modern tools', body: 'GPS clock-in from the app, schedules on your phone, and training built in — no fax machines, ever.' },
  { title: 'Real growth', body: 'Certification tracking and a training academy help you build a career, not just a job.' },
];

const checkIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const contactIcon = (d: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

/**
 * Public per-agency homepage at rayhealthevv.com/<slug>: the page an agency
 * shares on job boards and with families. Carries the agency's own warm
 * editorial identity (see public-brand.tsx) rather than RayHealth's admin
 * chrome, renders the profile with graceful fallbacks, and routes caregivers
 * into the application flow. Unknown slugs bounce home.
 */
export function AgencyPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<AgencyPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/agency-page/${encodeURIComponent(slug ?? '')}`);
        if (!res.ok) {
          if (!cancelled) void navigate('/', { replace: true });
          return;
        }
        const data = (await res.json()) as AgencyPublicInfo;
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled) void navigate('/', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  // The public page should read as the agency's own site, tab title included.
  useEffect(() => {
    if (!info) return;
    const prev = document.title;
    document.title = `${info.profile?.displayName?.trim() || info.name} · Home Care`;
    return () => {
      document.title = prev;
    };
  }, [info]);

  if (loading || !info) {
    return (
      <div className="pub-root" style={{ display: 'grid', placeItems: 'center' }}>
        <PublicBrandStyles />
        <span style={{ color: 'var(--pub-faint, #8A7B74)' }}>Loading…</span>
      </div>
    );
  }

  const p = info.profile ?? {};
  const displayName = p.displayName?.trim() || info.name;
  const tagline = p.tagline?.trim() || 'Because home is where care feels best.';
  const services = p.services && p.services.length > 0 ? p.services : DEFAULT_SERVICES;
  const hasContact = Boolean(p.phone || p.email || p.addressLine || p.hours);
  const applyPath = `/${slug}/apply`;
  const telHref = p.phone ? `tel:${p.phone.replace(/[^0-9+]/g, '')}` : null;
  const about =
    info.about?.trim() ||
    `${displayName} provides Medicaid home care services in Pennsylvania, helping clients live safely and independently in the comfort of their own homes.`;

  // Split the tagline so its last word sets italic in the brand red — the
  // small typographic move that makes the serif headline read designed
  // rather than typed.
  const taglineWords = tagline.replace(/\.$/, '').split(' ');
  const taglineLead = taglineWords.slice(0, -1).join(' ');
  const taglineLast = taglineWords[taglineWords.length - 1];

  return (
    <div className="pub-root">
      <PublicBrandStyles />

      {/* Sticky nav */}
      <nav className="pub-nav" aria-label="Main">
        <a href="#top" className="pub-nav-name">
          <AgencyMark size={30} />
          <span>{displayName}</span>
        </a>
        <div className="pub-nav-links">
          <a href="#services" className="pub-nav-link">Services</a>
          <a href="#about" className="pub-nav-link">About</a>
          {hasContact && <a href="#contact" className="pub-nav-link">Contact</a>}
          {telHref && (
            <a href={telHref} className="pub-nav-link" style={{ color: 'var(--pub-brand)' }}>
              {p.phone}
            </a>
          )}
          <Link to={applyPath} className="pub-btn pub-btn-primary" style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem' }}>
            Join our team
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="pub-hero" id="top">
        <div>
          <p className="pub-eyebrow">Home care agency · {info.state}</p>
          <h1 className="pub-display">
            {taglineLead} <em>{taglineLast}</em>.
          </h1>
          <p className="pub-lede pub-hero-copy">
            {displayName} brings compassionate, professional caregivers into the homes of the
            people who need them — with the dignity, patience, and warmth your family deserves.
          </p>
          <div className="pub-hero-ctas">
            <Link to={applyPath} className="pub-btn pub-btn-primary">Join our care team</Link>
            {telHref && (
              <a href={telHref} className="pub-btn pub-btn-ghost">Call {p.phone}</a>
            )}
          </div>
          <ul className="pub-trust-row">
            {['Pennsylvania home care', 'Medicaid participants welcome', 'Care delivered at home'].map((t) => (
              <li key={t} className="pub-trust-chip">
                {checkIcon}
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="pub-hero-visual" aria-hidden>
          <div className="pub-arch" />
          <div className="pub-arch-mark">
            <AgencyMark size={72} />
          </div>
          {p.hours && (
            <div className="pub-float" style={{ top: '12%', right: '-4%' }}>
              <span className="pub-float-icon">
                {contactIcon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)}
              </span>
              <div>
                <b>Office hours</b>
                <span>{p.hours}</span>
              </div>
            </div>
          )}
          {p.addressLine && (
            <div className="pub-float" style={{ bottom: '8%', left: '-6%' }}>
              <span className="pub-float-icon">
                {contactIcon(<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>)}
              </span>
              <div>
                <b>{info.state === 'PA' ? 'Pennsylvania' : info.state}</b>
                <span>{p.addressLine}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        {/* Services */}
        <section className="pub-section" id="services" style={{ paddingTop: '1rem' }}>
          <div className="pub-section-head">
            <p className="pub-eyebrow">What we do</p>
            <h2 className="pub-display">Care shaped around your family</h2>
          </div>
          <div className="pub-services">
            {services.map((s) => (
              <div key={s.name} className="pub-service-card">
                <ServiceIcon name={s.name} />
                <h3>{s.name}</h3>
                {s.blurb && <p>{s.blurb}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="pub-section" id="about" style={{ paddingTop: '0.5rem' }}>
          <div className="pub-about">
            <div>
              <p className="pub-eyebrow">About us</p>
              <h2 className="pub-display" style={{ fontSize: 'clamp(1.7rem, 3.2vw, 2.4rem)', marginBottom: '1.2rem' }}>
                About {displayName}
              </h2>
              <p className="pub-about-body">{about}</p>
            </div>
            <div className="pub-about-aside">
              <div className="pub-fact">
                <b>Care at home</b>
                <span>One-on-one support delivered where comfort and independence live — at home.</span>
              </div>
              <div className="pub-fact">
                <b>Verified visits</b>
                <span>Every visit is GPS-verified through our electronic visit verification platform.</span>
              </div>
              {p.hours && (
                <div className="pub-fact">
                  <b>Office hours</b>
                  <span>{p.hours}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Careers band */}
        <section className="pub-section" style={{ paddingTop: '0.5rem' }}>
          <div className="pub-careers">
            <p className="pub-eyebrow">Careers</p>
            <h2 className="pub-display">Why caregivers choose {displayName}</h2>
            <div className="pub-careers-grid">
              {WHY_JOIN.map((w, i) => (
                <div key={w.title} className="pub-careers-item">
                  <span className="pub-careers-num">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <b>{w.title}</b>
                    <p>{w.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to={applyPath} className="pub-btn pub-btn-light" style={{ marginTop: '2.2rem', position: 'relative' }}>
              Start your application →
            </Link>
          </div>
        </section>

        {/* Contact */}
        {hasContact && (
          <section className="pub-section" id="contact" style={{ paddingTop: '0.5rem' }}>
            <div className="pub-section-head">
              <p className="pub-eyebrow">Contact</p>
              <h2 className="pub-display">Get in touch</h2>
            </div>
            <div className="pub-contact-grid">
              {p.phone && (
                <div className="pub-contact-card">
                  <b>{contactIcon(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.5 2.8.7a2 2 0 0 1 1.7 2Z" />)}Phone</b>
                  <a href={telHref ?? undefined}>{p.phone}</a>
                </div>
              )}
              {p.email && (
                <div className="pub-contact-card">
                  <b>{contactIcon(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>)}Email</b>
                  <a href={`mailto:${p.email}`}>{p.email}</a>
                </div>
              )}
              {p.addressLine && (
                <div className="pub-contact-card">
                  <b>{contactIcon(<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>)}Office</b>
                  {p.addressLine}
                </div>
              )}
              {p.hours && (
                <div className="pub-contact-card">
                  <b>{contactIcon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)}Hours</b>
                  {p.hours}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="pub-footer">
        <div className="pub-footer-name">
          <AgencyMark size={24} />
          {displayName}
        </div>
        <small>
          © {new Date().getFullYear()} {displayName} · Hiring powered by{' '}
          <Link to="/">RayHealthEVV</Link>
        </small>
      </footer>
    </div>
  );
}
