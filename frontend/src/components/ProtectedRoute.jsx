import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, isAuthLoading, user, role } = useAuth();
  const location = useLocation();
  let storedUser = {};
  if (typeof window !== 'undefined') {
    try {
      storedUser = JSON.parse(window.localStorage.getItem('user') || '{}');
    } catch {
      storedUser = {};
    }
  }

  const normalizeRole = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const aliases = {
      dept_head: 'dept_head',
      depthead: 'dept_head',
      department_head: 'dept_head',
      system_admin: 'systemadmin',
      systemadmin: 'systemadmin',
      admin: 'systemadmin',
      college_dean: 'college_dean',
      dean: 'college_dean',
      academic_directorate: 'academic_directorate',
      academic_director: 'academic_directorate',
      directorate: 'academic_directorate',
      vice_president: 'vice_president',
      lab_assistant: 'lab_assistant',
      ara: 'lab_assistant',
      instructor: 'instructor',
      student: 'student',
    };

    return aliases[normalized] || normalized;
  };

  const normalizedRole = normalizeRole(user?.role || role || storedUser?.role);
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

  if (isAuthLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading your dashboard...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (normalizedAllowedRoles.length && !normalizedAllowedRoles.includes(normalizedRole)) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  const firstLoginValue = user?.isFirstLogin ?? user?.is_first_login ?? storedUser?.isFirstLogin ?? storedUser?.is_first_login;
  const isFirstLogin = firstLoginValue === true || Number(firstLoginValue) === 1;
  const isChangePasswordRoute = location.pathname === '/change-password';

  // Force first-time users to change password before accessing other pages
  if (isFirstLogin && !isChangePasswordRoute) {
    return <Navigate to="/change-password" replace state={{ from: location }} />;
  }

  // Allow all authenticated users (first login or not) to access the change password page
  // Only non-first-login users can view the form; first-login users must go there

  return children;
};

export default ProtectedRoute;
