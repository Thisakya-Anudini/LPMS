import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLearnersPage } from './pages/admin/AdminLearnersPage';
import { AdminLearningPathsPage } from './pages/admin/AdminLearningPathsPage';
import { LearningAdminDashboard } from './pages/learning-admin/LearningAdminDashboard';
import { LearningPathManagement } from './pages/learning-admin/LearningPathManagement';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { Role } from './types';
import { getDefaultRouteForRole } from './utils/navigation';
import { NotificationsPage } from './pages/NotificationsPage';
import { SupervisorDashboard } from './pages/supervisor/SupervisorDashboard';
import { LearnerMyProgressPage } from './pages/learner/LearnerMyProgressPage';
import { LearnerPublicPathsPage } from './pages/learner/LearnerPublicPathsPage';
import { LearnerCertificatesPage } from './pages/learner/LearnerCertificatesPage';

function ProtectedRoute({
  children,
  allowedRoles
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Loading session...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (!user.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { user, isBootstrapping } = useAuth();
  if (isBootstrapping) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
}

function SupervisorOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== 'EMPLOYEE' || !user.isSupervisor) {
    return <Navigate to="/learner" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<RootRedirect />} />

            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <Navigate to="/admin/learners" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/learners"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminLearnersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/accounts"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/learning-paths"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminLearningPathsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="learning-admin"
              element={
                <ProtectedRoute allowedRoles={['LEARNING_ADMIN']}>
                  <LearningAdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="learning-admin/paths"
              element={
                <ProtectedRoute allowedRoles={['LEARNING_ADMIN']}>
                  <LearningPathManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="learner"
              element={
                <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <Navigate to="/learner/my-progress" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="learner/my-progress"
              element={
                <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <LearnerMyProgressPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="learner/public-paths"
              element={
                <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <LearnerPublicPathsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="learner/certificates"
              element={
                <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <LearnerCertificatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="employee"
              element={
                <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <Navigate to="/learner/my-progress" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="supervisor"
              element={
                <ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <SupervisorOnlyRoute>
                    <SupervisorDashboard />
                  </SupervisorOnlyRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="notifications"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEARNING_ADMIN', 'EMPLOYEE', 'SUPERVISOR']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}
