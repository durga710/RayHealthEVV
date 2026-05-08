import { Link, Routes, Route } from 'react-router-dom';
import { AgencySetupPage } from './features/agency/AgencySetupPage.js';
import { StaffPage } from './features/staff/StaffPage.js';
import { ClientsPage } from './features/clients/ClientsPage.js';
import { AuthorizationsPage } from './features/authorizations/AuthorizationsPage.js';
import { TemplatesPage } from './features/scheduling/TemplatesPage.js';
import { AssignmentsPage } from './features/scheduling/AssignmentsPage.js';
import { LoginPage } from './features/auth/LoginPage.js';

export function App(): JSX.Element {
  return (
    <div className="admin-shell">
      <nav>
        <Link to="/agency">Agency Setup</Link>
        <Link to="/staff">Staff</Link>
        <Link to="/clients">Clients</Link>
        <Link to="/authorizations">Authorizations</Link>
        <Link to="/templates">Templates</Link>
        <Link to="/assignments">Assignments</Link>
      </nav>
      <main>
        <Routes>
          <Route path="/agency" element={<AgencySetupPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/authorizations" element={<AuthorizationsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Welcome to PA Admin</div>} />
        </Routes>
      </main>
    </div>
  );
}
