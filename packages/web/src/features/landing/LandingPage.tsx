import React from 'react';
import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={{ padding: '1.5rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          RayHealth <span style={{ backgroundColor: 'var(--color-accent)', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 800 }}>EVV</span>
        </div>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="#features" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontWeight: 600 }}>Features</a>
          <a href="#compliance" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', fontWeight: 600 }}>Compliance</a>
          <Link to="/login" style={{ backgroundColor: 'var(--color-primary-light)', color: 'white', textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700 }}>Log In</Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ color: 'var(--color-accent)', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', fontSize: '0.875rem' }}>
            Pennsylvania Home Care Platform
          </div>
          <h1 style={{ fontSize: '3.5rem', lineHeight: 1.1, color: 'var(--color-primary-dark)', margin: 0 }}>
            Care You Can Trust. <br/> <span style={{ color: 'var(--color-primary-light)' }}>Verified & Delivered.</span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', maxWidth: '600px', lineHeight: 1.6 }}>
            The premier Electronic Visit Verification platform designed specifically for Pennsylvania's personal assistance and home health agencies.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <Link to="/login" style={{ backgroundColor: 'var(--color-accent)', color: 'white', textDecoration: 'none', padding: '1rem 2rem', borderRadius: '8px', fontWeight: 700, fontSize: '1.1rem', boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)' }}>
              Access Admin Portal
            </Link>
            <a href="#demo" style={{ backgroundColor: 'white', color: 'var(--color-primary-dark)', border: '2px solid #c9d8e8', textDecoration: 'none', padding: '1rem 2rem', borderRadius: '8px', fontWeight: 700, fontSize: '1.1rem' }}>
              Request Demo
            </a>
          </div>
        </div>

        {/* Feature Highlights */}
        <div id="features" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '1000px', width: '100%', marginTop: '6rem' }}>
          <div className="card" style={{ padding: '2rem', textAlign: 'left' }}>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Fully Compliant</h3>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>Built from the ground up to meet Pennsylvania state requirements, HIPAA standards, and 21st Century Cures Act mandates.</p>
          </div>
          <div className="card" style={{ padding: '2rem', textAlign: 'left' }}>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Seamless Scheduling</h3>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>Create visit templates based on authorized care plans and assign eligible, credentialed caregivers with ease.</p>
          </div>
          <div className="card" style={{ padding: '2rem', textAlign: 'left' }}>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem' }}>Real-time Verification</h3>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>Ensure accurate service delivery with GPS-backed check-ins and task-level documentation at the point of care.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--color-primary-dark)', color: '#9bb0c8', fontSize: '0.875rem' }}>
        <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} RayHealth EVV™. All rights reserved.</p>
      </footer>
    </div>
  );
}