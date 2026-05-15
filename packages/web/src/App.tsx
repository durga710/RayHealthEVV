import { Link, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.js';
import { AgencySetupPage } from './features/agency/AgencySetupPage.js';
import { StaffPage } from './features/staff/StaffPage.js';
import { ClientsPage } from './features/clients/ClientsPage.js';
import { AuthorizationsPage } from './features/authorizations/AuthorizationsPage.js';
import { TemplatesPage } from './features/scheduling/TemplatesPage.js';
import { AssignmentsPage } from './features/scheduling/AssignmentsPage.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { LandingPage } from './features/landing/LandingPage.js';
import { VisitReviewPage } from './features/evv/VisitReviewPage.js';
import { PricingPage } from './features/marketing/PricingPage.js';
import { ContactPage } from './features/marketing/ContactPage.js';
import { DemoPage } from './features/marketing/DemoPage.js';
import { LaunchPage } from './features/marketing/LaunchPage.js';
import { StatusPage } from './features/marketing/StatusPage.js';
import { PrivacyPage } from './features/marketing/PrivacyPage.js';
import { AdminAssistant } from './features/support/AdminAssistant.js';
import { AuditRetentionPage } from './features/audit/AuditRetentionPage.js';
import { DashboardPage } from './features/admin/DashboardPage.js';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function AdminLayout() {
  const { logout, user } = useAuth();

  const initial = (user?.userId ?? '?').slice(0, 1).toUpperCase();

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <Link to="/" className="brand">
          RayHealth <span className="evv-badge">EVV</span>
        </Link>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to="/admin" className="nav-link">Dashboard</Link>
          <Link to="/admin/agency" className="nav-link">Agency Setup</Link>
          <Link to="/admin/staff" className="nav-link">Staff</Link>
          <Link to="/admin/clients" className="nav-link">Clients</Link>
          <Link to="/admin/authorizations" className="nav-link">Authorizations</Link>
          <Link to="/admin/templates" className="nav-link">Templates</Link>
          <Link to="/admin/assignments" className="nav-link">Assignments</Link>
          <Link to="/admin/review" className="nav-link">Visit Review</Link>
          <Link to="/admin/audit-retention" className="nav-link">Audit Retention</Link>
        </div>
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              aria-hidden
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '999px',
                backgroundColor: 'var(--color-accent)',
                color: 'white',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: '0.95rem',
              }}
            >
              {initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.role ?? 'Signed in'}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={user?.userId}
              >
                {user?.userId ? `${user.userId.slice(0, 8)}…` : '—'}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'rgba(34,197,94,0.16)',
              color: '#86efac',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              padding: '0.25rem 0.55rem',
              borderRadius: '999px',
              alignSelf: 'flex-start',
            }}
          >
            <span
              aria-hidden
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '999px',
                backgroundColor: '#16a34a',
                boxShadow: '0 0 0 3px rgba(22,163,74,0.25)',
              }}
            />
            Cookie session
          </div>

          <button
            onClick={logout}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '0.5rem',
              width: '100%',
              textAlign: 'center',
              borderRadius: '6px',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>
      <main>
        <div className="card">
          <Outlet />
        </div>
      </main>
      {/* Floating admin assistant — only inside /admin/*, authenticated. */}
      <AdminAssistant />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/launch" element={<LaunchPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/admin" element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="agency" element={<AgencySetupPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="authorizations" element={<AuthorizationsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="review" element={<VisitReviewPage />} />
          <Route path="audit-retention" element={<AuditRetentionPage />} />
          <Route index element={<DashboardPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
