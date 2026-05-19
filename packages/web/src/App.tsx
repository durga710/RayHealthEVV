import type React from 'react';
import { NavLink, Link, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.js';
import { AgencySetupPage } from './features/agency/AgencySetupPage.js';
import { StaffPage } from './features/staff/StaffPage.js';
import { ClientsPage } from './features/clients/ClientsPage.js';
import { AuthorizationsPage } from './features/authorizations/AuthorizationsPage.js';
import { TemplatesPage } from './features/scheduling/TemplatesPage.js';
import { AssignmentsPage } from './features/scheduling/AssignmentsPage.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage.js';
import { CaregiverPortalPage } from './features/auth/CaregiverPortalPage.js';
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
import { AuditEventsPage } from './features/audit/AuditEventsPage.js';
import { HipaaCompliancePage } from './features/compliance/HipaaCompliancePage.js';
import { LearningHubPage } from './features/learning/LearningHubPage.js';
import { LearningPortalPage } from './features/learning/LearningPortalPage.js';

const ADMIN_ROLES = new Set(['admin', 'coordinator']);

/** Redirects unauthenticated users to /login. */
function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <Outlet />;
}

/**
 * Allows only admin and coordinator roles into the admin portal.
 * Caregivers and family users are redirected to /portal — they must
 * use the mobile app and have no business in the admin shell.
 */
function AdminRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (!user || !ADMIN_ROLES.has(user.role)) {
    return <Navigate to="/portal" replace />;
  }

  return <Outlet />;
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: React.ReactElement;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Inline 16x16 stroke icons — kept tiny so the sidebar reads as text-first.
const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  agency: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M10 12h4M10 16h4" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  clients: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  auth: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  templates: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  assignments: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  visit: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  learning: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  training: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  archive: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  ),
};

interface NavGroupDef extends NavGroup {
  /** Roles that can see this group. Omit = all admin roles. */
  allowedRoles?: string[];
}

const navGroupDefs: NavGroupDef[] = [
  {
    label: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', end: true, icon: icons.dashboard }],
  },
  {
    label: 'Agency',
    allowedRoles: ['admin'],
    items: [
      { to: '/admin/agency', label: 'Agency Setup', icon: icons.agency },
      { to: '/admin/staff', label: 'Staff', icon: icons.staff },
      { to: '/admin/clients', label: 'Clients', icon: icons.clients },
      { to: '/admin/authorizations', label: 'Authorizations', icon: icons.auth },
    ],
  },
  {
    label: 'Agency',
    allowedRoles: ['coordinator'],
    items: [
      { to: '/admin/clients', label: 'Clients', icon: icons.clients },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { to: '/admin/templates', label: 'Templates', icon: icons.templates },
      { to: '/admin/assignments', label: 'Assignments', icon: icons.assignments },
    ],
  },
  {
    label: 'Visits',
    items: [{ to: '/admin/review', label: 'Visit Review', icon: icons.visit }],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/admin/learning', end: true, label: 'Learning Hub', icon: icons.learning },
      { to: '/admin/learning/portal', label: 'My Training', icon: icons.training },
    ],
  },
  {
    label: 'Audit',
    allowedRoles: ['admin'],
    items: [
      { to: '/admin/audit-events', label: 'Audit Events', icon: icons.audit },
      { to: '/admin/audit-retention', label: 'Audit Retention', icon: icons.archive },
    ],
  },
];

function AdminLayout() {
  const { logout, user } = useAuth();

  const initial = (user?.userId ?? '?').slice(0, 1).toUpperCase();
  const roleLabel = user?.role ?? 'signed in';
  const userIdShort = user?.userId ? `${user.userId.slice(0, 8)}…` : '—';
  const brandName = user?.agencyTheme?.logoText ?? 'RayHealth';

  // Only show nav groups relevant to this user's role.
  const visibleGroups = navGroupDefs.filter(
    (g) => !g.allowedRoles || (user?.role && g.allowedRoles.includes(user.role))
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Primary">
        <Link to="/" className="admin-sidebar__brand">
          {brandName}
          <span className="admin-sidebar__evv-badge">EVV</span>
        </Link>

        <nav className="admin-sidebar__nav">
          {visibleGroups.map((group) => (
            <div key={group.label} className="admin-sidebar__group">
              <div className="admin-sidebar__group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `admin-sidebar__nav-link${isActive ? ' active' : ''}`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__user-card">
          <div className="admin-sidebar__user-row">
            <div aria-hidden className="admin-sidebar__avatar">{initial}</div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#F1F5F9',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textTransform: 'capitalize',
                }}
              >
                {roleLabel}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: 'var(--font-mono)',
                }}
                title={user?.userId}
              >
                {userIdShort}
              </span>
            </div>
          </div>

          <span className="admin-sidebar__role-badge">{roleLabel}</span>

          <button
            type="button"
            onClick={logout}
            className="admin-sidebar__signout"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-main__inner">
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
      <Route path="/compliance/hipaa" element={<HipaaCompliancePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      {/* Caregiver/family accounts land here — no admin portal access. */}
      <Route path="/portal" element={<ProtectedRoute />}>
        <Route index element={<CaregiverPortalPage />} />
      </Route>

      {/* Admin portal — admin and coordinator roles only. */}
      <Route path="/admin" element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="agency" element={<AgencySetupPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="authorizations" element={<AuthorizationsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="review" element={<VisitReviewPage />} />
          <Route path="audit-events" element={<AuditEventsPage />} />
          <Route path="audit-retention" element={<AuditRetentionPage />} />
          <Route path="learning" element={<LearningHubPage />} />
          <Route path="learning/portal" element={<LearningPortalPage />} />
          <Route index element={<DashboardPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
