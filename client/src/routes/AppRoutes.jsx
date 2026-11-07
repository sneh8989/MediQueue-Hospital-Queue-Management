import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from './ProtectedRoute';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ROLES } from '../constants/roles';

// Every page is lazy-loaded (Phase 17 code-splitting): each role's
// initial bundle only includes the login page + shell, not every
// other role's pages. This matters most for AdminDashboardPage, which
// pulls in Recharts (~380kB) - previously that shipped in EVERY
// role's bundle even though only admins ever visit that route. See
// docs/ARCHITECTURE.md "Code-splitting" for the before/after numbers.
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const PatientListPage = lazy(() => import('../pages/patients/PatientListPage'));
const PatientProfilePage = lazy(() => import('../pages/patients/PatientProfilePage'));
const DepartmentsPage = lazy(() => import('../pages/admin/DepartmentsPage'));
const DoctorsPage = lazy(() => import('../pages/admin/DoctorsPage'));
const RoomsPage = lazy(() => import('../pages/admin/RoomsPage'));
const AppointmentsPage = lazy(() => import('../pages/appointments/AppointmentsPage'));
const QueueBoardPage = lazy(() => import('../pages/queue/QueueBoardPage'));
const DisplayScreenPage = lazy(() => import('../pages/display/DisplayScreenPage'));
const TrackPage = lazy(() => import('../pages/track/TrackPage'));
const DoctorDashboardPage = lazy(() => import('../pages/doctor/DoctorDashboardPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const ReportsPage = lazy(() => import('../pages/admin/ReportsPage'));
const AuditLogPage = lazy(() => import('../pages/admin/AuditLogPage'));
const UsersPage = lazy(() => import('../pages/admin/UsersPage'));
const SettingsPage = lazy(() => import('../pages/admin/SettingsPage'));
const ReceptionDashboardPage = lazy(() => import('../pages/receptionist/ReceptionDashboardPage'));
const NurseDashboardPage = lazy(() => import('../pages/nurse/NurseDashboardPage'));
const TrackEntryPage = lazy(() => import('../pages/track/TrackEntryPage'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('../pages/errors/UnauthorizedPage'));

// A page-sized fallback (not full-screen) so switching between already-
// loaded routes doesn't flash a full loading screen - DashboardLayout's
// chrome (sidebar/navbar) stays mounted, only the route content suspends.
function PageFallback() {
  return <LoadingSpinner label="Loading..." />;
}

// DisplayScreenPage is dark and full-screen (an unattended TV view) - the
// default light PageFallback would flash awkwardly while its JS chunk
// loads, so it gets a fallback matching its own background instead.
function DarkPageFallback() {
  return <div className="h-screen w-screen bg-slate-900" />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Public */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route path="/track/:queueEntryId" element={<TrackPage />} />
      <Route path="/track" element={<TrackEntryPage />} />
      <Route
        path="/display/:departmentId"
        element={
          <Suspense fallback={<DarkPageFallback />}>
            <DisplayScreenPage />
          </Suspense>
        }
      />

      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Admin */}
      <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/patients" element={<PatientListPage basePath="/admin/patients" />} />
          <Route path="/admin/patients/:id" element={<PatientProfilePage basePath="/admin/patients" />} />
          <Route path="/admin/appointments" element={<AppointmentsPage />} />
          <Route path="/admin/queues" element={<QueueBoardPage />} />
          <Route path="/admin/departments" element={<DepartmentsPage />} />
          <Route path="/admin/doctors" element={<DoctorsPage />} />
          <Route path="/admin/rooms" element={<RoomsPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/reports" element={<ReportsPage />} />
          <Route path="/admin/audit-log" element={<AuditLogPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Receptionist */}
      <Route element={<ProtectedRoute roles={[ROLES.RECEPTIONIST, ROLES.ADMIN]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/reception/dashboard" element={<ReceptionDashboardPage />} />
          <Route path="/reception/patients" element={<PatientListPage basePath="/reception/patients" />} />
          <Route path="/reception/patients/:id" element={<PatientProfilePage basePath="/reception/patients" />} />
          <Route path="/reception/appointments" element={<AppointmentsPage />} />
          <Route path="/reception/queue" element={<QueueBoardPage />} />
        </Route>
      </Route>

      {/* Doctor */}
      <Route element={<ProtectedRoute roles={[ROLES.DOCTOR]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/doctor/dashboard" element={<DoctorDashboardPage />} />
          <Route path="/doctor/queue" element={<QueueBoardPage />} />
          <Route path="/doctor/patients" element={<PatientListPage basePath="/doctor/patients" />} />
          <Route path="/doctor/patients/:id" element={<PatientProfilePage basePath="/doctor/patients" />} />
        </Route>
      </Route>

      {/* Nurse */}
      <Route element={<ProtectedRoute roles={[ROLES.NURSE]} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/nurse/dashboard" element={<NurseDashboardPage />} />
          <Route path="/nurse/queue" element={<QueueBoardPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
