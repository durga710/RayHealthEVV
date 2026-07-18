import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

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

/**
 * Public per-agency homepage at rayhealthevv.com/<slug>: the page an agency
 * shares on job boards and with families. Renders the agency's profile
 * (display name, tagline, services, contact) with graceful fallbacks, and
 * routes caregivers into the application flow. Unknown slugs bounce home.
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

  if (loading || !info) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#64748B' }}>
        Loading…
      </div>
    );
  }

  const p = info.profile ?? {};
  const displayName = p.displayName?.trim() || info.name;
  const tagline = p.tagline?.trim() || 'Compassionate home care, delivered where it matters most.';
  const services = p.services && p.services.length > 0 ? p.services : DEFAULT_SERVICES;
  const hasContact = Boolean(p.phone || p.email || p.addressLine || p.hours);
  const applyPath = `/${slug}/apply`;

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF9', color: '#1C1917' }}>
      {/* Hero */}
      <header style={{ background: '#7F1D1D', color: '#fff', padding: '4rem 1.5rem 3.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.10) 0%, transparent 55%)', pointerEvents: 'none' }} />
        <p style={{ margin: 0, fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#FCA5A5', fontWeight: 700 }}>
          Home care agency · {info.state}
        </p>
        <h1 style={{ margin: '0.6rem auto 0', fontSize: 'clamp(2rem, 5vw, 2.9rem)', fontWeight: 900, maxWidth: 760, lineHeight: 1.15 }}>
          {displayName}
        </h1>
        <p style={{ margin: '0.9rem auto 0', maxWidth: 560, fontSize: '1.05rem', color: '#FEE2E2', lineHeight: 1.6 }}>
          {tagline}
        </p>
        <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to={applyPath}
            style={{ background: '#fff', color: '#7F1D1D', fontWeight: 800, borderRadius: 10, padding: '0.85rem 1.7rem', textDecoration: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
          >
            Join our care team
          </Link>
          {p.phone && (
            <a
              href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`}
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, borderRadius: 10, padding: '0.85rem 1.5rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.35)' }}
            >
              Call {p.phone}
            </a>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '2.75rem 1.5rem 3rem' }}>
        {/* About */}
        <section style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 16, padding: '2rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem', fontWeight: 800 }}>About {displayName}</h2>
          <p style={{ margin: 0, lineHeight: 1.75, color: '#44403C', whiteSpace: 'pre-wrap' }}>
            {info.about?.trim() ||
              `${displayName} provides Medicaid home care services in Pennsylvania, helping clients live safely and independently in the comfort of their own homes.`}
          </p>
        </section>

        {/* Services */}
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 800 }}>Our services</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.9rem' }}>
            {services.map((s) => (
              <div key={s.name} style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 14, padding: '1.15rem 1.25rem' }}>
                <div style={{ fontWeight: 800, marginBottom: '0.35rem', color: '#7F1D1D' }}>{s.name}</div>
                {s.blurb && <div style={{ fontSize: '0.875rem', color: '#57534E', lineHeight: 1.6 }}>{s.blurb}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Why join */}
        <section style={{ marginTop: '2rem', background: '#1C1917', borderRadius: 18, padding: '2rem', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#FCA5A5', fontWeight: 700 }}>
            Careers
          </p>
          <h2 style={{ margin: '0.4rem 0 1.25rem', fontSize: '1.35rem', fontWeight: 800 }}>
            Why caregivers choose {displayName}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {WHY_JOIN.map((w) => (
              <div key={w.title}>
                <div style={{ fontWeight: 800, marginBottom: '0.3rem' }}>{w.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#D6D3D1', lineHeight: 1.6 }}>{w.body}</div>
              </div>
            ))}
          </div>
          <Link
            to={applyPath}
            style={{ display: 'inline-block', marginTop: '1.5rem', background: '#fff', color: '#1C1917', fontWeight: 800, borderRadius: 10, padding: '0.7rem 1.4rem', textDecoration: 'none' }}
          >
            Start your application →
          </Link>
        </section>

        {/* Contact */}
        {hasContact && (
          <section style={{ marginTop: '1.5rem', background: '#fff', border: '1px solid #E7E5E4', borderRadius: 16, padding: '2rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', fontWeight: 800 }}>Get in touch</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.9rem', fontSize: '0.925rem', color: '#44403C' }}>
              {p.phone && (
                <div>
                  <div style={{ fontWeight: 700, color: '#1C1917' }}>Phone</div>
                  <a href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`} style={{ color: '#7F1D1D', fontWeight: 700 }}>{p.phone}</a>
                </div>
              )}
              {p.email && (
                <div>
                  <div style={{ fontWeight: 700, color: '#1C1917' }}>Email</div>
                  <a href={`mailto:${p.email}`} style={{ color: '#7F1D1D', fontWeight: 700 }}>{p.email}</a>
                </div>
              )}
              {p.addressLine && (
                <div>
                  <div style={{ fontWeight: 700, color: '#1C1917' }}>Office</div>
                  <div>{p.addressLine}</div>
                </div>
              )}
              {p.hours && (
                <div>
                  <div style={{ fontWeight: 700, color: '#1C1917' }}>Hours</div>
                  <div>{p.hours}</div>
                </div>
              )}
            </div>
          </section>
        )}

        <p style={{ textAlign: 'center', marginTop: '2.25rem', fontSize: '0.75rem', color: '#A8A29E' }}>
          Hiring powered by RayHealth EVV
        </p>
      </main>
    </div>
  );
}
