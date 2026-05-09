import React from 'react';
import { Link } from 'react-router-dom';
import { SupportChat } from '../support/SupportChat.js';

/**
 * Shared header / hero / footer chrome for marketing routes
 * (/pricing, /contact, /demo). Mirrors LandingPage styling.
 */

const navLink: React.CSSProperties = {
  textDecoration: 'none',
  color: 'var(--color-text-muted)',
  fontWeight: 600
};

export function MarketingShell({
  title,
  eyebrow,
  children
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
      <header
        style={{
          padding: '1.5rem 3rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'white',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-primary-dark)' }}>
            RayHealth
          </span>
          <span style={{ backgroundColor: 'var(--color-accent)', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 800 }}>
            EVV
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/" style={navLink}>Home</Link>
          <Link to="/pricing" style={navLink}>Pricing</Link>
          <Link to="/demo" style={navLink}>Demo</Link>
          <Link to="/contact" style={navLink}>Contact</Link>
          <Link
            to="/login"
            style={{
              backgroundColor: 'var(--color-primary-light)',
              color: 'white',
              textDecoration: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              fontWeight: 700
            }}
          >
            Log In
          </Link>
        </nav>
      </header>

      <section style={{ padding: '4rem 2rem 1.5rem', textAlign: 'center' }}>
        <p
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
            margin: 0
          }}
        >
          {eyebrow}
        </p>
        <h1
          style={{
            fontSize: '3rem',
            lineHeight: 1.1,
            color: 'var(--color-primary-dark)',
            margin: '0.75rem auto 0',
            maxWidth: '820px'
          }}
        >
          {title}
        </h1>
      </section>

      <main style={{ flex: 1, padding: '0 2rem 5rem' }}>{children}</main>

      <footer
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.875rem',
          borderTop: '1px solid #e3eaf2',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          alignItems: 'center'
        }}
      >
        <div>© {new Date().getFullYear()} RayHealthEVV™. Pennsylvania-built EVV.</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/launch" style={{ color: 'var(--color-text-muted)' }}>What's new</Link>
          <Link to="/status" style={{ color: 'var(--color-text-muted)' }}>Status</Link>
          <Link to="/contact" style={{ color: 'var(--color-text-muted)' }}>Contact</Link>
          <Link to="/privacy" style={{ color: 'var(--color-text-muted)' }}>Privacy</Link>
        </div>
      </footer>

      {/* Floating support chat — visible on every marketing page. */}
      <SupportChat />
    </div>
  );
}
