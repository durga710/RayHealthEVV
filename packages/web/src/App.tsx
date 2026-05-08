import { Link, Routes, Route } from 'react-router-dom';
import { AgencySetupPage } from './features/agency/AgencySetupPage.js';
import { StaffPage } from './features/staff/StaffPage.js';
import { ClientsPage } from './features/clients/ClientsPage.js';
import { AuthorizationsPage } from './features/authorizations/AuthorizationsPage.js';
import { TemplatesPage } from './features/scheduling/TemplatesPage.js';
import { AssignmentsPage } from './features/scheduling/AssignmentsPage.js';
import { LoginPage } from './features/auth/LoginPage.js';

export function App() {
  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <Link to="/" className="brand">
          RayHealth <span className="evv-badge">EVV</span>
        </Link>
        <Link to="/agency" className="nav-link">Agency Setup</Link>
        <Link to="/staff" className="nav-link">Staff</Link>
        <Link to="/clients" className="nav-link">Clients</Link>
        <Link to="/authorizations" className="nav-link">Authorizations</Link>
        <Link to="/templates" className="nav-link">Templates</Link>
        <Link to="/assignments" className="nav-link">Assignments</Link>
      </nav>
      <main>
        <div className="card">
          <Routes>
            <Route path="/agency" element={<AgencySetupPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/authorizations" element={<AuthorizationsPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/assignments" element={<AssignmentsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <div>
                <h1>Welcome to PA Admin</h1>
                <p>Electronic Visit Verification · Care You Can Trust</p>
              </div>
            } />
          </Routes>
        </div>
      </main>
    </div>
  );
}
