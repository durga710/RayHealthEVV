import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.js';
import { AppShell } from './components/layout/AppShell.js';
import { AgencySetupPage } from './features/agency/AgencySetupPage.js';
import { AgencySettingsPage } from './features/agency/AgencySettingsPage.js';
import { StaffPage } from './features/staff/StaffPage.js';
import { ClientsPage } from './features/clients/ClientsPage.js';
import { AuthorizationsPage } from './features/authorizations/AuthorizationsPage.js';
import { TemplatesPage } from './features/scheduling/TemplatesPage.js';
import { AssignmentsPage } from './features/scheduling/AssignmentsPage.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage.js';
import { LandingPage } from './features/landing/LandingPage.js';
import { VisitReviewPage } from './features/evv/VisitReviewPage.js';
import { VisitCorrectionsQueuePage } from './features/evv/VisitCorrectionsQueuePage.js';
import { VisitCorrectionsTrackingPage } from './features/evv/VisitCorrectionsTrackingPage.js';
import { LearningDashboardPage } from './features/learning/LearningDashboardPage.js';
import { CourseCatalogPage } from './features/learning/CourseCatalogPage.js';
import { CaregiverLearningPage } from './features/learning/CaregiverLearningPage.js';
import { LearningAnalyticsPage } from './features/learning/LearningAnalyticsPage.js';
import { CourseDetailPage } from './features/learning/CourseDetailPage.js';
import { CopilotChatPage } from './features/learning/CopilotChatPage.js';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept/:token" element={<AcceptInvitePage />} />
      
      <Route path="/admin" element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="agency" element={<AgencySetupPage />} />
          <Route path="settings" element={<AgencySettingsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="authorizations" element={<AuthorizationsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="review" element={<VisitReviewPage />} />
          <Route path="corrections" element={<VisitCorrectionsQueuePage />} />
          <Route path="corrections/tracking" element={<VisitCorrectionsTrackingPage />} />
          <Route path="learning" element={<LearningDashboardPage />} />
          <Route path="learning/courses" element={<CourseCatalogPage />} />
          <Route path="learning/caregivers/:id" element={<CaregiverLearningPage />} />
          <Route path="learning/analytics" element={<LearningAnalyticsPage />} />
          <Route path="learning/courses/:id" element={<CourseDetailPage />} />
          <Route path="learning/copilot" element={<CopilotChatPage />} />
          <Route index element={<Navigate to="/admin/agency" replace />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
