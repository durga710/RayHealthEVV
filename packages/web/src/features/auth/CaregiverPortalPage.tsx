import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext.js';

const ADMIN_ROLES = new Set(['admin', 'coordinator']);

export function CaregiverPortalPage() {
  const { user, logout } = useAuth();

  // Admins/coordinators who land here directly (e.g. typed /portal in the URL)
  // get sent straight to the admin portal.
  if (user && ADMIN_ROLES.has(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  const role = user?.role ?? 'user';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '2rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>RayHealth</span>
        <span style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: 'white', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '4px' }}>EVV</span>
      </div>

      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          maxWidth: '420px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(124, 58, 237,0.15)',
            border: '1px solid rgba(124, 58, 237,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h1 style={{ color: 'white', fontSize: '1.375rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            {roleLabel} account active
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
            {role === 'family'
              ? "Your family member's care plan and visit history are available in the RayHealth mobile app."
              : 'Use the RayHealth EVV mobile app to clock in, document tasks, and clock out.'}
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(124, 58, 237,0.08)',
            border: '1px solid rgba(124, 58, 237,0.15)',
            borderRadius: '10px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#7c3aed', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Signed in as</span>
          <span style={{ color: '#E2E8F0', fontSize: '0.875rem', fontWeight: 500, textTransform: 'capitalize' }}>{user?.role ?? '—'}</span>
          <span style={{ color: '#475569', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{user?.userId?.slice(0, 12)}…</span>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94A3B8',
            borderRadius: '9px',
            padding: '0.6875rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      <p style={{ color: '#1E293B', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
        Pennsylvania-only &middot; HIPAA-aware
      </p>
    </div>
  );
}
