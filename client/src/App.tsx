import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { LearningAdminDashboard } from './pages/learning-admin/LearningAdminDashboard';
import { LearningPathManagement } from './pages/learning-admin/LearningPathManagement';
import { SupervisorDashboard } from './pages/supervisor/SupervisorDashboard';
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { MyLearningPaths } from './pages/employee/MyLearningPaths';
// Protected Route Component
function ProtectedRoute({
  children,
  allowedRoles



}: {children: React.ReactNode;allowedRoles?: string[];}) {
  const {
    user,
    isAuthenticated
  } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
export function App() {
  return <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/login" replace />} />

            {/* Super Admin Routes */}
            <Route path="admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>} />

            {/* Learning Admin Routes */}
            <Route path="learning-admin" element={<ProtectedRoute allowedRoles={['LEARNING_ADMIN']}>
                  <LearningAdminDashboard />
                </ProtectedRoute>} />
            <Route path="learning-admin/paths" element={<ProtectedRoute allowedRoles={['LEARNING_ADMIN']}>
                  <LearningPathManagement />
                </ProtectedRoute>} />

            {/* Supervisor Routes */}
            <Route path="supervisor" element={<ProtectedRoute allowedRoles={['SUPERVISOR']}>
                  <SupervisorDashboard />
                </ProtectedRoute>} />

            {/* Employee Routes */}
            <Route path="employee" element={<ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <EmployeeDashboard />
                </ProtectedRoute>} />
            <Route path="employee/my-paths" element={<ProtectedRoute allowedRoles={['EMPLOYEE']}>
                  <MyLearningPaths />
                </ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>;
}