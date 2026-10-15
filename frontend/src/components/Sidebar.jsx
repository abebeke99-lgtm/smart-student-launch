import { Award, Bell, BookOpen, CalendarDays, ClipboardCheck, Database, FileText, GraduationCap, LayoutDashboard, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';

const menuConfig = {
  academic_directorate: {
    titleKey: 'academicDirectorateMenu',
    basePath: '/directorate/dashboard',
    items: [
      { key: 'overview', labelKey: 'overview', icon: LayoutDashboard },
      { key: 'evaluate-deans', labelKey: 'evaluateCollegeDeans', icon: ClipboardCheck },
      { key: 'peer-evaluation', labelKey: 'peerEvaluation', icon: Users },
      { key: 'reports', labelKey: 'collegeDeanReports', icon: FileText },
      { key: 'my-performance', labelKey: 'myEvaluationFeedback', icon: Award },
    ],
  },
  vice_president: {
    titleKey: 'vicePresidentMenu',
    basePath: '/vice-president/dashboard',
    items: [
      { key: 'overview', labelKey: 'overview', icon: LayoutDashboard },
      { key: 'evaluate-academic-directorate', labelKey: 'evaluateAcademicDirectorate', icon: ClipboardCheck },
      { key: 'reports', labelKey: 'vicePresidentReports', icon: FileText },
    ],
  },
  college_dean: {
    titleKey: 'collegeDeanMenu',
    basePath: '/dean/dashboard',
    items: [
      { key: 'overview', labelKey: 'overview', icon: LayoutDashboard },
      { key: 'evaluate-heads', labelKey: 'evaluateDeptHeads', icon: ClipboardCheck },
      { key: 'peer-evaluation', labelKey: 'peerEvaluation', icon: Users },
      { key: 'reports', labelKey: 'departmentHeadReports', icon: FileText },
      { key: 'my-performance', labelKey: 'myEvaluationFeedback', icon: Award },
    ],
  },
  lab_assistant: {
    titleKey: 'labAssistantMenu',
    basePath: '/lab-assistant/dashboard',
    items: [
      { key: 'overview', labelKey: 'overview', icon: LayoutDashboard },
      { key: 'peer-evaluation', labelKey: 'peerEvaluation', icon: Users },
      { key: 'feedback', labelKey: 'myEvaluationFeedback', icon: Award },
    ],
  },
  depthead: {
    titleKey: 'departmentHeadMenu',
    basePath: '/dept-head/dashboard',
    items: [
      { key: 'overview', labelKey: 'overview', icon: LayoutDashboard },
      { key: 'courses', labelKey: 'courseRegistration', icon: BookOpen },
      { key: 'viewData', labelKey: 'viewData', icon: Database },
      { key: 'assignments', labelKey: 'courseAssignments', icon: ClipboardCheck },
      { key: 'publishEvaluation', labelKey: 'publishEvaluation', icon: Bell },
      { key: 'evaluateInstructor', labelKey: 'evaluateInstructor', icon: GraduationCap },
      { key: 'tracking', labelKey: 'evaluationTracking', icon: ClipboardCheck },
      { key: 'evaluationSchedule', labelKey: 'evaluationSchedule', icon: CalendarDays, to: '/dept-head/evaluation-schedule' },
      { key: 'performanceDashboard', labelKey: 'performanceFeedback', icon: Award },
      { key: 'reports', labelKey: 'departmentCertificates', icon: FileText },
    ],
  },
};

menuConfig.academic_director = menuConfig.academic_directorate;
menuConfig.directorate = menuConfig.academic_directorate;
menuConfig.dean = menuConfig.college_dean;

const Sidebar = ({ role: roleProp, isOpen = false, onClose = () => {} }) => {
  const { role: authRole, user } = useAuth();
  const { strings } = useContext(LanguageContext);
  const location = useLocation();
  const role = roleProp || user?.role || authRole;
  const config = menuConfig[role];
  if (!config) return null;

  const isDepartmentHead = ['depthead', 'dept_head'].includes(String(role).trim().toLowerCase().replace(/[-\s]+/g, '_'));
  const title = isDepartmentHead
    ? strings.deptHeadDashboard.menu
    : strings.navigation[config.titleKey];
  return (
    <aside className={`dashboard-sidebar fixed bottom-0 left-0 top-16 z-50 h-auto w-64 shrink-0 flex-shrink-0 border-r border-white/15 bg-[#38A0DC] px-3 py-6 text-white shadow-xl transition-transform duration-300 lg:sticky lg:inset-y-auto lg:top-0 lg:z-auto lg:block lg:h-full lg:w-[232px] lg:overflow-y-auto lg:translate-x-0 lg:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-label={`${title} navigation`}>
      <nav className="space-y-1.5">
        {config.items.map(({ key, labelKey, label, icon: Icon, to }) => {
          const target = to || `${config.basePath}#${key}`;
          const active = to
            ? location.pathname === to
            : (location.hash.replace('#', '') || 'overview') === key && location.pathname === config.basePath;
          const itemLabel = label || (isDepartmentHead
            ? strings.deptHeadDashboard[labelKey]
            : strings.navigation[labelKey]);
          return (
            <NavLink
              key={key}
              to={target}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium leading-5 transition ${active ? 'bg-[#2B87BD] text-white shadow-none' : 'text-white hover:bg-white/15 hover:text-white'}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
              <span className="min-w-0 flex-1 truncate [overflow-wrap:normal]" title={itemLabel}>{itemLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;