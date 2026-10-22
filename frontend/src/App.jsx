import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import DeptHeadLayout from './components/DeptHeadLayout';
import PublicLayout from './layouts/PublicLayout';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useUiText } from './hooks/useUiText';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard'));
const LabAssistantDashboard = lazy(() => import('./pages/LabAssistantDashboard'));
const DeptHeadDashboard = lazy(() => import('./pages/DeptHeadDashboard'));
const DeptEvaluationSchedule = lazy(() => import('./pages/DeptEvaluationSchedule'));
const LabClasses = lazy(() => import('./pages/LabClasses'));
const SystemAdminDashboard = lazy(() => import('./pages/SystemAdminDashboard'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CollegeDeanDashboard = lazy(() => import('./pages/CollegeDeanDashboard'));
const DirectorateDashboard = lazy(() => import('./pages/DirectorateDashboard'));
const VicePresidentDashboard = lazy(() => import('./pages/VicePresidentDashboard'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

const LoadingFallback = () => {
  const t = useUiText();
  return <div className="flex min-h-[40vh] items-center justify-center" role="status">{t('Loading page...')}</div>;
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col bg-white dark:bg-black text-black dark:text-white">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <main className="flex-grow">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
            </Route>
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/student-dashboard" element={<ProtectedRoute allowedRoles={['student']}><DashboardLayout role="student"><StudentDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/instructor-dashboard" element={<ProtectedRoute allowedRoles={['instructor']}><DashboardLayout role="instructor"><InstructorDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/lab-assistant/dashboard" element={<ProtectedRoute allowedRoles={['lab_assistant', 'ara', 'lab assistant', 'lab-assistant']}><DashboardLayout role="lab_assistant"><LabAssistantDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/lab-assistant" element={<ProtectedRoute allowedRoles={['lab_assistant', 'ara', 'lab assistant', 'lab-assistant']}><DashboardLayout role="lab_assistant"><LabAssistantDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['systemadmin']}><DashboardLayout role="systemadmin"><SystemAdminDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={['systemadmin']}><DashboardLayout role="systemadmin"><SystemAdminDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dept-head/dashboard" element={<ProtectedRoute allowedRoles={['depthead']}><DashboardLayout role="depthead"><DeptHeadDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dept-head/evaluation-schedule" element={<ProtectedRoute allowedRoles={['depthead']}><DeptHeadLayout><DeptEvaluationSchedule /></DeptHeadLayout></ProtectedRoute>} />
            <Route path="/depthead-dashboard" element={<ProtectedRoute allowedRoles={['depthead']}><DashboardLayout role="depthead"><DeptHeadDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dept-head-dashboard" element={<ProtectedRoute allowedRoles={['depthead']}><DashboardLayout role="depthead"><DeptHeadDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/dept-head-dashboard/lab-classes" element={<ProtectedRoute allowedRoles={['depthead']}><DashboardLayout role="depthead"><LabClasses /></DashboardLayout></ProtectedRoute>} />
            <Route path="/system-admin-dashboard" element={<ProtectedRoute allowedRoles={['systemadmin']}><DashboardLayout role="systemadmin"><SystemAdminDashboard /></DashboardLayout></ProtectedRoute>} />
            <Route element={<ProtectedRoute allowedRoles={['college_dean', 'dean']}><DashboardLayout role="college_dean" /></ProtectedRoute>}>
              <Route path="/dean/dashboard" element={<CollegeDeanDashboard />} />
              <Route path="/dean-dashboard" element={<CollegeDeanDashboard />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['academic_directorate', 'academic_director', 'directorate']}><DashboardLayout role="academic_directorate" /></ProtectedRoute>}>
              <Route path="/directorate/dashboard" element={<DirectorateDashboard />} />
              <Route path="/directorate-dashboard" element={<DirectorateDashboard />} />
            </Route>
            <Route path="/vice-president/dashboard" element={<ProtectedRoute allowedRoles={['vice_president']}><DashboardLayout role="vice_president"><VicePresidentDashboard /></DashboardLayout></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </main>
    </div>
        </ThemeProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;