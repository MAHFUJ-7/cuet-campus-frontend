// Application root — providers + route table (port of app_router.dart).
//
// Every feature screen is lazily imported: the shell starts fast and each
// route streams in its own chunk (Leaflet is only fetched by the Campus Map).
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AppLayout, CoordinatorLayout } from './components/layout/ShellLayout.jsx';
import { FullScreenLoader, PublicOnly, RequireAuth, RequireRole } from './router/guards.jsx';
import { EmptyState, Icon, PageShell } from './components/ui/index.jsx';
import ReminderHost from './features/reminders/ReminderHost.jsx';

const SplashPage = lazy(() => import('./features/splash/SplashPage.jsx'));
const LoginPage = lazy(() => import('./features/auth/LoginPage.jsx'));
const OnboardingPage = lazy(() => import('./features/auth/OnboardingPage.jsx'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage.jsx'));
const SetupPage = lazy(() => import('./features/auth/SetupPage.jsx'));
const SetPasswordPage = lazy(() => import('./features/auth/SetPasswordPage.jsx'));
const ProfileCompletionPage = lazy(() => import('./features/auth/ProfileCompletionPage.jsx'));
const HomePage = lazy(() => import('./features/home/HomePage.jsx'));
const RoutinePage = lazy(() => import('./features/routine/RoutinePage.jsx'));
const RoutineConflictsPage = lazy(
  () => import('./features/routine/RoutineConflictsPage.jsx')
);
const UpdatesPage = lazy(() => import('./features/updates/UpdatesPage.jsx'));
const AiChatPage = lazy(() => import('./features/ai/AiChatPage.jsx'));
const AiSettingsPage = lazy(() => import('./features/ai/AiSettingsPage.jsx'));
const AiRecommendationsPage = lazy(() => import('./features/ai/AiRecommendationsPage.jsx'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage.jsx'));
const ProfileEditPage = lazy(() => import('./features/profile/ProfileEditPage.jsx'));
const SecurityPage = lazy(() => import('./features/profile/SecurityPage.jsx'));
const NotificationPreferencesPage = lazy(
  () => import('./features/profile/NotificationPreferencesPage.jsx')
);
const FeedbackPage = lazy(() => import('./features/profile/FeedbackPage.jsx'));
const DevDebugPage = lazy(() => import('./features/profile/DevDebugPage.jsx'));
const CrDashboardPage = lazy(() => import('./features/cr/CrDashboardPage.jsx'));
const ComposeUpdatePage = lazy(() => import('./features/cr/ComposeUpdatePage.jsx'));
const CoordinatorHomePage = lazy(() => import('./features/coordinator/CoordinatorHomePage.jsx'));
const CoordinatorProfilePage = lazy(
  () => import('./features/coordinator/CoordinatorProfilePage.jsx')
);
const CoordinatorAcademicsPage = lazy(
  () => import('./features/coordinator/CoordinatorAcademicsPage.jsx')
);
const CoordinatorNoticesPage = lazy(
  () => import('./features/coordinator/CoordinatorNoticesPage.jsx')
);
const CoordinatorStudentsPage = lazy(
  () => import('./features/coordinator/CoordinatorStudentsPage.jsx')
);
const CoordinatorExamsPage = lazy(() => import('./features/coordinator/CoordinatorExamsPage.jsx'));
const CoordinatorQualityPage = lazy(
  () => import('./features/coordinator/CoordinatorQualityPage.jsx')
);
const CoordinatorAuditPage = lazy(() => import('./features/coordinator/CoordinatorAuditPage.jsx'));
const CoordinatorRoutinePdfPage = lazy(
  () => import('./features/coordinator/CoordinatorRoutinePdfPage.jsx')
);
const CoordinatorRoutineReviewPage = lazy(
  () => import('./features/coordinator/CoordinatorRoutineReviewPage.jsx')
);
const SectionManagementPage = lazy(
  () => import('./features/coordinator/SectionManagementPage.jsx')
);
const ScheduleSuggestionsPage = lazy(
  () => import('./features/coordinator/ScheduleSuggestionsPage.jsx')
);
const AdminPage = lazy(() => import('./features/admin/AdminPage.jsx'));
const AssignmentsPage = lazy(() => import('./features/assignments/AssignmentsPage.jsx'));
const ExamsPage = lazy(() => import('./features/exams/ExamsPage.jsx'));
const AttendancePage = lazy(() => import('./features/attendance/AttendancePage.jsx'));
const DirectoryPage = lazy(() => import('./features/directory/DirectoryPage.jsx'));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage.jsx'));
const EventsPage = lazy(() => import('./features/events/EventsPage.jsx'));
const StudyMaterialsPage = lazy(() => import('./features/study/StudyMaterialsPage.jsx'));
const CampusMapPage = lazy(() => import('./features/map/CampusMapPage.jsx'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <PageShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon="explore_off"
          title="Page not found"
          message="The page you were looking for doesn't exist."
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-label-lg font-medium text-white hover:bg-primary-light"
            >
              <Icon name="home" size={18} /> Back to start
            </Link>
          }
        />
      </div>
    </PageShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <ReminderHost />
            <Suspense fallback={<FullScreenLoader />}>
              <Routes>
                {/* ---------- Public / pre-auth ---------- */}
                <Route path="/" element={<SplashPage />} />
                <Route
                  path="/onboarding"
                  element={
                    <PublicOnly>
                      <OnboardingPage />
                    </PublicOnly>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <PublicOnly>
                      <LoginPage />
                    </PublicOnly>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicOnly>
                      <RegisterPage />
                    </PublicOnly>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <PublicOnly>
                      <ForgotPasswordPage />
                    </PublicOnly>
                  }
                />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/set-password" element={<SetPasswordPage />} />

                {/* ---------- Authenticated ---------- */}
                <Route element={<RequireAuth />}>
                  <Route path="/setup" element={<SetupPage />} />
                  <Route path="/profile-completion" element={<ProfileCompletionPage />} />

                  {/* Main 5-tab shell */}
                  <Route element={<AppLayout />}>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/routine" element={<RoutinePage />} />
                    <Route path="/routine/conflicts" element={<RoutineConflictsPage />} />
                    <Route path="/ai-chat" element={<AiChatPage />} />
                    <Route path="/updates" element={<UpdatesPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/edit" element={<ProfileEditPage />} />

                    {/* CR area — keeps the app shell/sidebar visible */}
                    <Route element={<RequireRole roles={['cr', 'coordinator', 'admin']} />}>
                      <Route path="/cr-dashboard" element={<CrDashboardPage />} />
                      <Route path="/cr/compose" element={<ComposeUpdatePage />} />
                    </Route>
                  </Route>

                  {/* Student detail screens */}
                  <Route path="/assignments" element={<AssignmentsPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/exams" element={<ExamsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/events" element={<EventsPage />} />
                  <Route path="/study-materials" element={<StudyMaterialsPage />} />
                  <Route path="/directory" element={<DirectoryPage />} />
                  <Route path="/campus-map" element={<CampusMapPage />} />
                  <Route path="/ai-recommendations" element={<AiRecommendationsPage />} />
                  <Route path="/ai-settings" element={<AiSettingsPage />} />
                  <Route path="/security" element={<SecurityPage />} />
                  <Route path="/notification-preferences" element={<NotificationPreferencesPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route path="/dev-debug" element={<DevDebugPage />} />

                  {/* Coordinator area */}
                  <Route element={<RequireRole roles={['coordinator', 'admin']} />}>
                    <Route element={<CoordinatorLayout />}>
                      <Route path="/coordinator" element={<CoordinatorHomePage />} />
                      <Route path="/coordinator/academics" element={<CoordinatorAcademicsPage />} />
                      <Route path="/coordinator/notices" element={<CoordinatorNoticesPage />} />
                      <Route path="/coordinator/profile" element={<CoordinatorProfilePage />} />
                    </Route>
                    <Route path="/coordinator/students" element={<CoordinatorStudentsPage />} />
                    <Route path="/coordinator/exams" element={<CoordinatorExamsPage />} />
                    <Route path="/coordinator/quality" element={<CoordinatorQualityPage />} />
                    <Route path="/coordinator/audit" element={<CoordinatorAuditPage />} />
                    <Route path="/coordinator/routine-pdf" element={<CoordinatorRoutinePdfPage />} />
                    <Route
                      path="/coordinator/routine-review/:id"
                      element={<CoordinatorRoutineReviewPage />}
                    />
                    <Route path="/coordinator/ai" element={<AiChatPage />} />
                    <Route path="/coordinator/section/:id" element={<SectionManagementPage />} />
                    <Route
                      path="/coordinator/schedule-suggestions"
                      element={<ScheduleSuggestionsPage />}
                    />
                  </Route>

                  {/* Admin */}
                  <Route element={<RequireRole roles={['admin']} />}>
                    <Route path="/admin" element={<AdminPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
