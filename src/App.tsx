import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { PermissionKey } from '@/types/api';
import { AppLayout, FullPageLoader, NotFoundPage } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { EmptyState } from '@/components/ui';

/**
 * Screens are loaded on demand. The first paint then carries only the shell,
 * and heavy corners (reports with their charting library, the settings
 * builders, the whole client portal) arrive when someone actually opens them.
 */
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/PasswordPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/PasswordPages').then((m) => ({ default: m.ResetPasswordPage })));
const AcceptInvitePage = lazy(() => import('@/pages/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TasksPage = lazy(() => import('@/pages/TasksPage').then((m) => ({ default: m.TasksPage })));
const TaskDetailPage = lazy(() => import('@/pages/TaskDetailPage').then((m) => ({ default: m.TaskDetailPage })));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const WorkflowsPage = lazy(() => import('@/pages/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })));
const RetainersPage = lazy(() => import('@/pages/RetainersPage').then((m) => ({ default: m.RetainersPage })));
const RetainerDetailPage = lazy(() => import('@/pages/RetainerDetailPage').then((m) => ({ default: m.RetainerDetailPage })));
const DeliverablesPage = lazy(() => import('@/pages/DeliverablesPage').then((m) => ({ default: m.DeliverablesPage })));
const ClientsPage = lazy(() => import('@/pages/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('@/pages/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })));
const LeadsPage = lazy(() => import('@/pages/LeadsPage').then((m) => ({ default: m.LeadsPage })));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const EmployeeDetailPage = lazy(() => import('@/pages/EmployeeDetailPage').then((m) => ({ default: m.EmployeeDetailPage })));
const TimesheetsPage = lazy(() => import('@/pages/TimesheetsPage').then((m) => ({ default: m.TimesheetsPage })));
const AttendancePage = lazy(() => import('@/pages/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const LeavePage = lazy(() => import('@/pages/LeavePage').then((m) => ({ default: m.LeavePage })));
const PerformancePage = lazy(() => import('@/pages/PerformancePage').then((m) => ({ default: m.PerformancePage })));
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ActivityLogPage = lazy(() => import('@/pages/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const PortalOverviewPage = lazy(() => import('@/pages/portal/PortalOverviewPage').then((m) => ({ default: m.PortalOverviewPage })));
const PortalProjectPage = lazy(() => import('@/pages/portal/PortalProjectPage').then((m) => ({ default: m.PortalProjectPage })));
const PortalApprovalsPage = lazy(() => import('@/pages/portal/PortalApprovalsPage').then((m) => ({ default: m.PortalApprovalsPage })));
const PortalFilesPage = lazy(() => import('@/pages/portal/PortalFilesPage').then((m) => ({ default: m.PortalFilesPage })));
const PortalTeamPage = lazy(() => import('@/pages/portal/PortalTeamPage').then((m) => ({ default: m.PortalTeamPage })));

/** Anything inside this needs a session; where there is none, go to sign-in. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Staff area. A client-portal account that lands here is sent to its own app. */
function RequireStaff({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.kind === 'CLIENT') return <Navigate to="/portal" replace />;
  // An outstanding forced password change blocks everything but the profile.
  if (user?.mustChangePassword) return <Navigate to="/profile?tab=security&forced=1" replace />;
  return <>{children}</>;
}

function RequireClient({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.kind !== 'CLIENT') return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Route-level permission gate. This hides screens rather than securing them -
 * the API is the real boundary - so it only needs to be kind, not exhaustive.
 */
function RequirePermission({
  permissions,
  children,
}: {
  permissions: PermissionKey[];
  children: ReactNode;
}) {
  const can = useAuth((state) => state.can);
  if (!can(...permissions)) {
    return (
      <EmptyState
        title="You do not have access to this page"
        description="If you think you should, ask an administrator to adjust your role."
      />
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { status, bootstrap, user } = useAuth();

  // Restores the session from the refresh cookie on first load.
  useEffect(() => {
    if (status === 'loading') void bootstrap();
  }, [status, bootstrap]);

  if (status === 'loading') return <FullPageLoader />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
      {/* ---- public ---- */}
      <Route
        path="/login"
        element={user ? <Navigate to={user.kind === 'CLIENT' ? '/portal' : '/'} replace /> : <LoginPage />}
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/portal/accept-invite" element={<AcceptInvitePage portal />} />

      {/* ---- client portal ---- */}
      <Route
        path="/portal"
        element={
          <RequireAuth>
            <RequireClient>
              <PortalLayout />
            </RequireClient>
          </RequireAuth>
        }
      >
        <Route index element={<PortalOverviewPage />} />
        <Route path="projects/:id" element={<PortalProjectPage />} />
        <Route path="approvals" element={<PortalApprovalsPage />} />
        <Route path="approvals/:id" element={<PortalApprovalsPage />} />
        <Route path="files" element={<PortalFilesPage />} />
        <Route path="team" element={<PortalTeamPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* ---- staff application ---- */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <RequireStaff>
              <AppLayout />
            </RequireStaff>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route
          path="tasks"
          element={
            <RequirePermission permissions={['tasks.view.assigned', 'tasks.view.all']}>
              <TasksPage />
            </RequirePermission>
          }
        />
        <Route path="tasks/:id" element={<TaskDetailPage />} />

        <Route
          path="projects"
          element={
            <RequirePermission permissions={['projects.view.all', 'projects.view.assigned']}>
              <ProjectsPage />
            </RequirePermission>
          }
        />
        <Route path="projects/:id" element={<ProjectDetailPage />} />

        <Route
          path="workflows"
          element={
            <RequirePermission permissions={['settings.workflows.manage']}>
              <WorkflowsPage />
            </RequirePermission>
          }
        />

        <Route
          path="retainers"
          element={
            <RequirePermission permissions={['retainers.view.all', 'retainers.view.assigned']}>
              <RetainersPage />
            </RequirePermission>
          }
        />
        <Route path="retainers/:id" element={<RetainerDetailPage />} />

        <Route
          path="deliverables"
          element={
            <RequirePermission permissions={['deliverables.view']}>
              <DeliverablesPage />
            </RequirePermission>
          }
        />
        <Route path="deliverables/:id" element={<DeliverablesPage />} />

        <Route
          path="clients"
          element={
            <RequirePermission permissions={['clients.view.all', 'clients.view.assigned']}>
              <ClientsPage />
            </RequirePermission>
          }
        />
        <Route path="clients/:id" element={<ClientDetailPage />} />

        <Route
          path="leads"
          element={
            <RequirePermission permissions={['leads.view.all', 'leads.view.own']}>
              <LeadsPage />
            </RequirePermission>
          }
        />
        <Route path="leads/:id" element={<LeadsPage />} />

        <Route
          path="employees"
          element={
            <RequirePermission permissions={['employees.view.all', 'employees.view.team']}>
              <EmployeesPage />
            </RequirePermission>
          }
        />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />

        <Route
          path="timesheets"
          element={
            <RequirePermission
              permissions={['timesheets.log.own', 'timesheets.view.all', 'timesheets.view.team']}
            >
              <TimesheetsPage />
            </RequirePermission>
          }
        />
        <Route
          path="attendance"
          element={
            <RequirePermission
              permissions={['attendance.mark.own', 'attendance.view.all', 'attendance.view.team']}
            >
              <AttendancePage />
            </RequirePermission>
          }
        />
        <Route
          path="leave"
          element={
            <RequirePermission
              permissions={['leave.request.own', 'leave.view.all', 'leave.view.team']}
            >
              <LeavePage />
            </RequirePermission>
          }
        />
        <Route
          path="performance"
          element={
            <RequirePermission
              permissions={[
                'performance.view.own',
                'performance.view.team',
                'performance.view.all',
              ]}
            >
              <PerformancePage />
            </RequirePermission>
          }
        />
        <Route
          path="calendar"
          element={
            <RequirePermission permissions={['calendar.view.own', 'calendar.view.all']}>
              <CalendarPage />
            </RequirePermission>
          }
        />
        <Route
          path="reports"
          element={
            <RequirePermission permissions={['reports.view']}>
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="logs"
          element={
            <RequirePermission permissions={['logs.view']}>
              <ActivityLogPage />
            </RequirePermission>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="settings/*"
          element={
            <RequirePermission
              permissions={[
                'settings.org.manage',
                'settings.roles.manage',
                'settings.users.manage',
                'settings.workflows.manage',
                'settings.masters.manage',
              ]}
            >
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
