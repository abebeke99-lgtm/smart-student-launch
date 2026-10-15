import { useContext, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { LanguageContext } from '../context/LanguageContext';
import { DashboardSidebarContext } from '../context/DashboardSidebarContext';
import { useAuth } from '../context/AuthContext';
import DashboardBanner from './DashboardBanner';

const DashboardLayout = ({
  role = 'depthead',
  sidebar = null,
  showSidebar = false,
  children,
}) => {
  const { strings } = useContext(LanguageContext);
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasSharedSidebar = Boolean(sidebar) || showSidebar || ['lab_assistant', 'college_dean', 'dean', 'academic_directorate', 'academic_director', 'directorate', 'vice_president'].includes(role);
  const hasDashboardOwnedSidebar = !showSidebar && !sidebar && ['systemadmin', 'depthead', 'student', 'instructor'].includes(role);
  const userRole = String(user?.role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const isAdminUser = ['admin', 'system_admin', 'systemadmin'].includes(userRole);
  const activeTab = location.hash.replace('#', '') || 'overview';
  const isOverviewRoute = activeTab === 'overview' || (location.pathname === '/admin/dashboard' && !location.hash);
  const shouldRenderBanner = isAdminUser && isOverviewRoute && role !== 'systemadmin';
  const sidebarContext = { sidebarOpen, setSidebarOpen };

  return (
    <DashboardSidebarContext.Provider value={sidebarContext}>
      <div className={`dashboard-shell h-screen w-screen overflow-hidden${hasDashboardOwnedSidebar ? ' dashboard-shell--owned-sidebar' : ''}${role === 'systemadmin' ? ' dashboard-shell--mobile-scroll' : ''}`}>
        <Header onMenuToggle={() => setSidebarOpen((open) => !open)} sidebarOpen={sidebarOpen} />

        <div className="dashboard-body flex min-w-0 flex-1 items-stretch overflow-hidden">
          {hasSharedSidebar && sidebarOpen ? <button type="button" aria-label={strings.common.closeSidebar} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}
          {hasSharedSidebar ? (sidebar ?? <Sidebar role={role} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />) : null}

          <main className="dashboard-main main-content min-w-0">
            <div className="dashboard-content min-w-0">
              <div className="dashboard-page-content">
                {shouldRenderBanner ? <DashboardBanner role={role} pageKey={activeTab} /> : null}
                {children || <Outlet />}
              </div>
            </div>
          </main>
        </div>
      </div>
    </DashboardSidebarContext.Provider>
  );
};

export default DashboardLayout;
