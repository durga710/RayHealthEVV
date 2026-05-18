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
import { LearningHubPage } from './features/learning/LearningHubPage.js';
import { LearningPortalPage } from './features/learning/LearningPortalPage.js';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <Link to="/" className="brand">
          RayHealth <span className="evv-badge">EVV</span>
        </Link>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to="/admin/agency" className="nav-link">Agency Setup</Link>
          <Link to="/admin/staff" className="nav-link">Staff</Link>
          <Link to="/admin/clients" className="nav-link">Clients</Link>
          <Link to="/admin/authorizations" className="nav-link">Authorizations</Link>
          <Link to="/admin/templates" className="nav-link">Templates</Link>
          <Link to="/admin/assignments" className="nav-link">Assignments</Link>
          <Link to="/admin/review" className="nav-link">Visit Review</Link>
          <Link to="/admin/learning" className="nav-link">Learning Hub</Link>
          <Link to="/admin/learning/portal" className="nav-link">My Training</Link>
        </div>
        <button 
          onClick={logout} 
          style={{ backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem', width: '100%', marginTop: 'auto', textAlign: 'center' }}
        >
          Sign Out
        </button>
      </nav>
      <main>
        <div className="card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
          <Route path="learning" element={<LearningHubPage />} />
          <Route path="learning/portal" element={<LearningPortalPage />} />
          <Route index element={<Navigate to="/admin/agency" replace />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
