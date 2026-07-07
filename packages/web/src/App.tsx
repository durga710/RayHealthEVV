import type React from 'react';
import { lazy, Suspense, useState } from 'react';
import { NavLink, Link, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.js';

// Eager: public LCP route (must paint instantly + keep App.test.tsx green),
// shared layout wrappers, and the floating assistant utility used inside the
// admin layout. Everything else is route-level code-split below.
import { LandingPage } from './features/landing/LandingPage.js';
import { CaregiverLayout } from './features/caregiver/CaregiverLayout.js';
import { AdminAssistant } from './features/support/AdminAssistant.js';
import { RouteErrorBoundary } from './components/RouteErrorBoundary.js';

// Lazy-loaded route leaves, each becomes its own chunk. The page components are
// NAMED exports, so map the named export onto `default` for React.lazy.
const AgencySetupPage = lazy(() => import('./features/agency/AgencySetupPage.js').then((m) => ({ default: m.AgencySetupPage })));
const GoLiveReadinessPage = lazy(() => import('./features/agency/GoLiveReadinessPage.js').then((m) => ({ default: m.GoLiveReadinessPage })));
const StaffPage = lazy(() => import('./features/staff/StaffPage.js').then((m) => ({ default: m.StaffPage })));
const CaregiverActivityPage = lazy(() => import('./features/staff/CaregiverActivityPage.js').then((m) => ({ default: m.CaregiverActivityPage })));
const ClientsPage = lazy(() => import('./features/clients/ClientsPage.js').then((m) => ({ default: m.ClientsPage })));
const AuthorizationsPage = lazy(() => import('./features/authorizations/AuthorizationsPage.js').then((m) => ({ default: m.AuthorizationsPage })));
const ImportPage = lazy(() => import('./features/import/ImportPage.js').then((m) => ({ default: m.ImportPage })));
const TemplatesPage = lazy(() => import('./features/scheduling/TemplatesPage.js').then((m) => ({ default: m.TemplatesPage })));
const AssignmentsPage = lazy(() => import('./features/scheduling/AssignmentsPage.js').then((m) => ({ default: m.AssignmentsPage })));
const RecurringSchedulesPage = lazy(() => import('./features/scheduling/RecurringSchedulesPage.js').then((m) => ({ default: m.RecurringSchedulesPage })));
const SuperAdminPage = lazy(() => import('./features/superadmin/SuperAdminPage.js').then((m) => ({ default: m.SuperAdminPage })));
const LoginPage = lazy(() => import('./features/auth/LoginPage.js').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./features/auth/SignupPage.js').then((m) => ({ default: m.SignupPage })));
const AcceptInvitePage = lazy(() => import('./features/auth/AcceptInvitePage.js').then((m) => ({ default: m.AcceptInvitePage })));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage.js').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage.js').then((m) => ({ default: m.ResetPasswordPage })));
const CaregiverDashboard = lazy(() => import('./features/caregiver/CaregiverDashboard.js').then((m) => ({ default: m.CaregiverDashboard })));
const CaregiverSchedulePage = lazy(() => import('./features/caregiver/CaregiverSchedulePage.js').then((m) => ({ default: m.CaregiverSchedulePage })));
const CaregiverVisitsPage = lazy(() => import('./features/caregiver/CaregiverVisitsPage.js').then((m) => ({ default: m.CaregiverVisitsPage })));
const CaregiverLearningHubPage = lazy(() => import('./features/caregiver/CaregiverLearningHubPage.js').then((m) => ({ default: m.CaregiverLearningHubPage })));
const CaregiverTrainingPage = lazy(() => import('./features/caregiver/CaregiverTrainingPage.js').then((m) => ({ default: m.CaregiverTrainingPage })));
const CourseDetailPage = lazy(() => import('./features/caregiver/CourseDetailPage.js').then((m) => ({ default: m.CourseDetailPage })));
const VisitReviewPage = lazy(() => import('./features/evv/VisitReviewPage.js').then((m) => ({ default: m.VisitReviewPage })));
const PricingPage = lazy(() => import('./features/marketing/site/PricingPage.js').then((m) => ({ default: m.PricingPage })));
const ContactPage = lazy(() => import('./features/marketing/site/ContactPage.js').then((m) => ({ default: m.ContactPage })));
const DemoPage = lazy(() => import('./features/marketing/site/DemoPage.js').then((m) => ({ default: m.DemoPage })));
const LaunchPage = lazy(() => import('./features/marketing/site/LaunchPage.js').then((m) => ({ default: m.LaunchPage })));
const AdsPage = lazy(() => import('./features/marketing/site/AdsPage.js').then((m) => ({ default: m.AdsPage })));
const StatusPage = lazy(() => import('./features/marketing/site/StatusPage.js').then((m) => ({ default: m.StatusPage })));
const PrivacyPage = lazy(() => import('./features/marketing/site/PrivacyPage.js').then((m) => ({ default: m.PrivacyPage })));
const TrustCenterPage = lazy(() => import('./features/marketing/site/TrustCenterPage.js').then((m) => ({ default: m.TrustCenterPage })));
const TermsPage = lazy(() => import('./features/marketing/site/TermsPage.js').then((m) => ({ default: m.TermsPage })));
const SchedulingPage = lazy(() => import('./features/marketing/site/SchedulingPage.js').then((m) => ({ default: m.SchedulingPage })));
const EvvSolutionPage = lazy(() => import('./features/marketing/site/EvvSolutionPage.js').then((m) => ({ default: m.EvvSolutionPage })));
const RayVerifyPage = lazy(() => import('./features/marketing/site/RayVerifyPage.js').then((m) => ({ default: m.RayVerifyPage })));
const BillingPayrollPage = lazy(() => import('./features/marketing/site/BillingPayrollPage.js').then((m) => ({ default: m.BillingPayrollPage })));
const WorkforceTrainingPage = lazy(() => import('./features/marketing/site/WorkforceTrainingPage.js').then((m) => ({ default: m.WorkforceTrainingPage })));
const AiAutomationPage = lazy(() => import('./features/marketing/site/AiAutomationPage.js').then((m) => ({ default: m.AiAutomationPage })));
const CompliancePlatformPage = lazy(() => import('./features/marketing/site/CompliancePlatformPage.js').then((m) => ({ default: m.CompliancePlatformPage })));
const EvvGuidePage = lazy(() => import('./features/marketing/site/EvvGuidePage.js').then((m) => ({ default: m.EvvGuidePage })));
const TaskCodesPage = lazy(() => import('./features/marketing/site/TaskCodesPage.js').then((m) => ({ default: m.TaskCodesPage })));
const AuditChecklistPage = lazy(() => import('./features/marketing/site/AuditChecklistPage.js').then((m) => ({ default: m.AuditChecklistPage })));
const HipaaCompliancePage = lazy(() => import('./features/marketing/site/HipaaCompliancePage.js').then((m) => ({ default: m.HipaaCompliancePage })));
const AuditRetentionPage = lazy(() => import('./features/audit/AuditRetentionPage.js').then((m) => ({ default: m.AuditRetentionPage })));
const DashboardPage = lazy(() => import('./features/admin/DashboardPage.js').then((m) => ({ default: m.DashboardPage })));
const CommandCenterPage = lazy(() => import('./features/admin/CommandCenterPage.js').then((m) => ({ default: m.CommandCenterPage })));
const TodayBoardPage = lazy(() => import('./features/admin/TodayBoardPage.js').then((m) => ({ default: m.TodayBoardPage })));
const AuditEventsPage = lazy(() => import('./features/audit/AuditEventsPage.js').then((m) => ({ default: m.AuditEventsPage })));
const AuditPacketPage = lazy(() => import('./features/compliance-engine/AuditPacketPage.js').then((m) => ({ default: m.AuditPacketPage })));
const LearningHubPage = lazy(() => import('./features/learning/LearningHubPage.js').then((m) => ({ default: m.LearningHubPage })));
const LearningPortalPage = lazy(() => import('./features/learning/LearningPortalPage.js').then((m) => ({ default: m.LearningPortalPage })));
const CourseEditorPage = lazy(() => import('./features/learning/CourseEditorPage.js').then((m) => ({ default: m.CourseEditorPage })));
const CertificatePage = lazy(() => import('./features/learning/CertificatePage.js').then((m) => ({ default: m.CertificatePage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage.js').then((m) => ({ default: m.SettingsPage })));
const ApplyPage = lazy(() => import('./features/onboarding/ApplyPage.js').then((m) => ({ default: m.ApplyPage })));
const InterviewPage = lazy(() => import('./features/onboarding/InterviewPage.js').then((m) => ({ default: m.InterviewPage })));
const OnboardingHubPage = lazy(() => import('./features/onboarding/OnboardingHubPage.js').then((m) => ({ default: m.OnboardingHubPage })));
const ApplicantDetailPage = lazy(() => import('./features/onboarding/ApplicantDetailPage.js').then((m) => ({ default: m.ApplicantDetailPage })));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage.js').then((m) => ({ default: m.ProfilePage })));
const ComplianceOverviewPage = lazy(() => import('./features/compliance-engine/ComplianceOverviewPage.js').then((m) => ({ default: m.ComplianceOverviewPage })));
const AuditDefensePage = lazy(() => import('./features/compliance-engine/AuditDefensePage.js').then((m) => ({ default: m.AuditDefensePage })));
const ExceptionResolutionPage = lazy(() => import('./features/compliance-engine/ExceptionResolutionPage.js').then((m) => ({ default: m.ExceptionResolutionPage })));
const AuthorizationOversightPage = lazy(() => import('./features/compliance-engine/AuthorizationOversightPage.js').then((m) => ({ default: m.AuthorizationOversightPage })));
const MedicaidWorkflowPage = lazy(() => import('./features/compliance-engine/MedicaidWorkflowPage.js').then((m) => ({ default: m.MedicaidWorkflowPage })));
const PayrollReconciliationPage = lazy(() => import('./features/compliance-engine/PayrollReconciliationPage.js').then((m) => ({ default: m.PayrollReconciliationPage })));
const ClaimMatchingPage = lazy(() => import('./features/compliance-engine/ClaimMatchingPage.js').then((m) => ({ default: m.ClaimMatchingPage })));
const RemittancePage = lazy(() => import('./features/compliance-engine/RemittancePage.js').then((m) => ({ default: m.RemittancePage })));
const EvvSubmissionPage = lazy(() => import('./features/compliance-engine/EvvSubmissionPage.js').then((m) => ({ default: m.EvvSubmissionPage })));
const HhaexchangeSubmissionPage = lazy(() => import('./features/compliance-engine/HhaexchangeSubmissionPage.js').then((m) => ({ default: m.HhaexchangeSubmissionPage })));
const ClearinghouseConfigPage = lazy(() => import('./features/compliance-engine/ClearinghouseConfigPage.js').then((m) => ({ default: m.ClearinghouseConfigPage })));
const CredentialsPage = lazy(() => import('./features/compliance-engine/CredentialsPage.js').then((m) => ({ default: m.CredentialsPage })));

const ADMIN_ROLES = new Set(['admin', 'coordinator']);

/**
 * Branded loading state shown while a lazily-loaded route chunk is fetched.
 * Centered, fixed min-height to avoid layout shift, small teal spinner using the
 * RayHealth brand color. Respects prefers-reduced-motion (no spin when reduced).
 */
function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        width: '100%',
      }}
    >
      <style>{`
        @keyframes rh-route-spin { to { transform: rotate(360deg); } }
        .rh-route-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(16, 116, 128, 0.18);
          border-top-color: #107480;
          border-radius: 50%;
          animation: rh-route-spin 0.7s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .rh-route-spinner { animation: none; }
        }
      `}</style>
      <span className="rh-route-spinner" aria-hidden="true" />
    </div>
  );
}

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
 * Caregivers and family users are redirected to /portal, they must
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

// Inline 16x16 stroke icons, kept tiny so the sidebar reads as text-first.
const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
  hiring: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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
    items: [
      { to: '/admin', label: 'Command Center', end: true, icon: icons.dashboard },
      { to: '/admin/today', label: "Today's Visits", icon: icons.visit },
      { to: '/admin/overview', label: 'Dashboard', end: true, icon: icons.dashboard },
    ],
  },
  {
    label: 'Agency',
    allowedRoles: ['admin'],
    items: [
      { to: '/admin/readiness', label: 'Go-Live Checklist', icon: icons.dashboard },
      { to: '/admin/agency', label: 'Agency Setup', icon: icons.agency },
      { to: '/admin/staff', label: 'Staff', icon: icons.staff },
      { to: '/admin/clients', label: 'Clients', icon: icons.clients },
      { to: '/admin/authorizations', label: 'Authorizations', icon: icons.auth },
      { to: '/admin/import', label: 'Data Import', icon: icons.agency },
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
      { to: '/admin/recurring-schedules', label: 'Recurring', icon: icons.assignments },
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
    label: 'Hiring',
    allowedRoles: ['admin', 'coordinator'],
    items: [
      { to: '/admin/onboarding', label: 'Onboarding', icon: icons.hiring },
    ],
  },
  {
    label: 'Compliance Engine',
    allowedRoles: ['admin'],
    items: [
      { to: '/admin/compliance-engine', end: true, label: 'Overview', icon: icons.dashboard },
      { to: '/admin/compliance-engine/audit-defense', label: 'Audit Defense', icon: icons.audit },
      { to: '/admin/compliance-engine/exceptions', label: 'Exceptions', icon: icons.visit },
      { to: '/admin/compliance-engine/authorizations', label: 'Authorizations', icon: icons.auth },
      { to: '/admin/compliance-engine/medicaid', label: 'Medicaid', icon: icons.clients },
      { to: '/admin/compliance-engine/payroll', label: 'Payroll', icon: icons.archive },
      { to: '/admin/compliance-engine/claims', label: 'Claims', icon: icons.templates },
      { to: '/admin/compliance-engine/remittances', label: 'Remittance (ERA)', icon: icons.archive },
      { to: '/admin/compliance-engine/evv-submission', label: 'EVV Submission', icon: icons.visit },
      { to: '/admin/compliance-engine/hhaexchange-submission', label: 'EVV. HHAeXchange', icon: icons.visit },
      { to: '/admin/compliance-engine/clearinghouse', label: 'Clearinghouse', icon: icons.templates },
      { to: '/admin/compliance-engine/credentials', label: 'Credentials', icon: icons.staff },
    ],
  },
  {
    label: 'Audit',
    allowedRoles: ['admin'],
    items: [
      { to: '/admin/audit-events', label: 'Audit Events', icon: icons.audit },
      { to: '/admin/audit-packet', label: 'Audit Packet', icon: icons.audit },
      { to: '/admin/audit-retention', label: 'Audit Retention', icon: icons.archive },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/admin/profile', label: 'My Profile', icon: icons.profile },
      { to: '/admin/settings', label: 'Settings', icon: icons.settings },
    ],
  },
];

function AdminLayout() {
  const { logout, user } = useAuth();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  const roleLabel = user?.role ?? 'signed in';
  const brandName = user?.agencyTheme?.logoText ?? 'RayHealth';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || roleLabel;
  const initial = displayName.slice(0, 1).toUpperCase() || '?';

  const visibleGroups = navGroupDefs.filter(
    (g) => !g.allowedRoles || (user?.role && g.allowedRoles.includes(user.role))
  );

  return (
    <div className="admin-shell">
      {/* Mobile-only top bar; the sidebar is an off-canvas drawer below 900px. */}
      <div className="admin-mobilebar">
        <button
          type="button"
          className="admin-hamburger"
          aria-label="Open navigation menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Link to="/admin" className="admin-sidebar__brand" style={{ margin: 0 }} onClick={closeNav}>
          <span className="admin-sidebar__brand-mark">R</span>
          {brandName}
          <span className="admin-sidebar__evv-badge">EVV</span>
        </Link>
      </div>

      {navOpen && <div className="admin-scrim" onClick={closeNav} aria-hidden />}

      <aside className={`admin-sidebar${navOpen ? ' is-open' : ''}`} aria-label="Primary">
        <Link to="/admin" className="admin-sidebar__brand" onClick={closeNav}>
          <span className="admin-sidebar__brand-mark">R</span>
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
                  onClick={closeNav}
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
            <div
              aria-hidden
              className="admin-sidebar__avatar"
              style={user?.avatarUrl ? { padding: 0, overflow: 'hidden' } : undefined}
            >
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#F1F5F9',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textTransform: 'capitalize',
                }}
              >
                {roleLabel}
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
          {/* One broken page degrades to a localized message instead of
              blanking the whole admin shell. Keyed by pathname so navigating
              away from a crashed page clears the error. */}
          <RouteErrorBoundary key={pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>

      {/* Floating admin assistant, only inside /admin/*, authenticated. */}
      <AdminAssistant />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/launch" element={<LaunchPage />} />
      <Route path="/ads" element={<AdsPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/trust" element={<TrustCenterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      {/* Marketing site. Platform / Solutions / Resources content pages */}
      <Route path="/rayverify" element={<RayVerifyPage />} />
      <Route path="/platform/ai-automation" element={<AiAutomationPage />} />
      <Route path="/platform/compliance" element={<CompliancePlatformPage />} />
      <Route path="/solutions/scheduling" element={<SchedulingPage />} />
      <Route path="/solutions/electronic-visit-verification" element={<EvvSolutionPage />} />
      <Route path="/solutions/billing-payroll" element={<BillingPayrollPage />} />
      <Route path="/solutions/workforce-training" element={<WorkforceTrainingPage />} />
      <Route path="/resources/evv-guide" element={<EvvGuidePage />} />
      <Route path="/resources/task-codes" element={<TaskCodesPage />} />
      <Route path="/resources/audit-checklist" element={<AuditChecklistPage />} />
      <Route path="/compliance/hipaa" element={<HipaaCompliancePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      {/* Hidden platform super-admin console, intentionally not in any nav. */}
      <Route path="/superadmin" element={<SuperAdminPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/apply/:agencyId" element={<ApplyPage />} />
      <Route path="/interview/:token" element={<InterviewPage />} />

      {/* Caregiver/family portal, full self-service shell. Admins redirected to /admin by CaregiverLayout. */}
      <Route path="/portal" element={<ProtectedRoute />}>
        <Route element={<CaregiverLayout />}>
          <Route index element={<CaregiverDashboard />} />
          <Route path="schedule" element={<CaregiverSchedulePage />} />
          <Route path="visits" element={<CaregiverVisitsPage />} />
          <Route path="learning" element={<CaregiverLearningHubPage />} />
          <Route path="training" element={<CaregiverTrainingPage />} />
          <Route path="training/:courseId" element={<CourseDetailPage />} />
          <Route path="training/:courseId/certificate" element={<CertificatePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Admin portal, admin and coordinator roles only. */}
      <Route path="/admin" element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="agency" element={<AgencySetupPage />} />
          <Route path="readiness" element={<GoLiveReadinessPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="staff/:caregiverId" element={<CaregiverActivityPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="authorizations" element={<AuthorizationsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="recurring-schedules" element={<RecurringSchedulesPage />} />
          <Route path="review" element={<VisitReviewPage />} />
          <Route path="audit-events" element={<AuditEventsPage />} />
          <Route path="audit-packet" element={<AuditPacketPage />} />
          <Route path="audit-packet/:visitId" element={<AuditPacketPage />} />
          <Route path="audit-retention" element={<AuditRetentionPage />} />
          <Route path="learning" element={<LearningHubPage />} />
          <Route path="learning/courses/new" element={<CourseEditorPage />} />
          <Route path="learning/courses/:id/edit" element={<CourseEditorPage />} />
          <Route path="learning/portal" element={<LearningPortalPage />} />
          <Route path="onboarding" element={<OnboardingHubPage />} />
          <Route path="onboarding/:id" element={<ApplicantDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="compliance-engine" element={<ComplianceOverviewPage />} />
          <Route path="compliance-engine/audit-defense" element={<AuditDefensePage />} />
          <Route path="compliance-engine/exceptions" element={<ExceptionResolutionPage />} />
          <Route path="compliance-engine/authorizations" element={<AuthorizationOversightPage />} />
          <Route path="compliance-engine/medicaid" element={<MedicaidWorkflowPage />} />
          <Route path="compliance-engine/payroll" element={<PayrollReconciliationPage />} />
          <Route path="compliance-engine/claims" element={<ClaimMatchingPage />} />
          <Route path="compliance-engine/remittances" element={<RemittancePage />} />
          <Route path="compliance-engine/evv-submission" element={<EvvSubmissionPage />} />
          <Route path="compliance-engine/hhaexchange-submission" element={<HhaexchangeSubmissionPage />} />
          <Route path="compliance-engine/clearinghouse" element={<ClearinghouseConfigPage />} />
          <Route path="compliance-engine/credentials" element={<CredentialsPage />} />
          <Route index element={<CommandCenterPage />} />
          <Route path="today" element={<TodayBoardPage />} />
          <Route path="overview" element={<DashboardPage />} />
        </Route>
      </Route>
      
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
