import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaUsers,
  FaChalkboardTeacher,
  FaBook,
  FaShieldAlt,
  FaClipboardCheck,
  FaChartBar,
  FaGraduationCap,
  FaBell,
  FaDatabase,
  FaTrash,
  FaArrowRight,
  FaEdit,
  FaCalendarAlt,
} from 'react-icons/fa';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Filter,
  GraduationCap,
  Landmark,
  Pencil,
  Plus,
  Search,
  Sprout,
  Trash2,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminData } from '../data/adminOptions';
import StudentsSection from '../components/admin/StudentsSection';
import InstructorsSection from '../components/admin/InstructorsSection';
import { LanguageContext } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { departmentApi, registrationApi, evaluationApi, courseAssignmentApi, DASHBOARD_DATA_UPDATED_EVENT } from '../services/api';
import DispatchEvaluationModal from '../components/DispatchEvaluationModal';
import EvaluationTemplateBuilder from '../components/EvaluationTemplateBuilder';
import InstructorEvaluationCriteriaModal from '../components/InstructorEvaluationCriteriaModal';
import EvaluationBreakdownModal from '../components/EvaluationBreakdownModal';
import PeerEvaluationModal, { standardPeerEvaluationSections } from '../components/PeerEvaluationModal';
import CourseAssignmentModal from '../components/CourseAssignmentModal';
import DeptHeadPerformanceDashboard from '../components/DeptHeadPerformanceDashboard';
import PublishEvaluation from './PublishEvaluation';
import ResultCertificateActions from '../components/ResultCertificateActions';
import { SUBMISSIONS_UPDATED_EVENT } from '../services/formSubmissions';
import EvaluationDeadlineBadge from '../components/EvaluationDeadlineBadge';
import { DashboardSidebarContext } from '../context/DashboardSidebarContext';
import CourseRegistration from './CourseRegistration';
import { useConfirmation } from '../components/ConfirmationDialog';
import { useUiText } from '../hooks/useUiText';

const isLabAssistantRole = (role) => ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(String(role || '').trim().toLowerCase());
const isLabCourse = (value) => value === true || value === 1 || ['true', '1'].includes(String(value || '').trim().toLowerCase());
const MAX_CREDIT_LOAD = 12;
const isDepartmentHeadEvaluationTargetRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  return ['instructor', 'lab_assistant', 'ara'].includes(normalizedRole);
};

const DeptHeadDashboard = () => {
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const { strings } = useContext(LanguageContext);
  const t = useUiText();
  const { sidebarOpen: isSidebarOpen, setSidebarOpen: setIsSidebarOpen } = useContext(DashboardSidebarContext);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = user || null;
  const departmentId = currentUser?.department_id || currentUser?.departmentId || currentUser?.department || null;
  const userFullName = currentUser?.name
    || currentUser?.full_name
    || currentUser?.fullName
    || [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ')
    || currentUser?.username
    || t('Department Head');
  const userDepartmentName = currentUser?.department_name
    || currentUser?.departmentName
    || currentUser?.department
    || t('Department');
  const today = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState('overview');
  const [viewDataTab, setViewDataTab] = useState('instructors');
  const [viewDataRows, setViewDataRows] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignmentInstructors, setAssignmentInstructors] = useState([]);
  const [trackingInstructors, setTrackingInstructors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [overviewStats, setOverviewStats] = useState({ totalInstructors: 0, totalStudents: 0, totalCourses: 0, activeAssignments: 0, openEvaluations: 0, averageScore: 0, pendingReviewItems: 0 });
  const [overviewTrends, setOverviewTrends] = useState({});
  const [overviewStatsLoading, setOverviewStatsLoading] = useState(true);
  const [departmentCoursesLoading, setDepartmentCoursesLoading] = useState(false);
  const [formNotification, setFormNotification] = useState('');
  const [trackingView, setTrackingView] = useState('student');
  const [trackingStatusFilter, setTrackingStatusFilter] = useState('all');
  const [assignmentViewFilter, setAssignmentViewFilter] = useState('all');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentCourseFilter, setAssignmentCourseFilter] = useState('all');
  const [assignmentAcademicYear, setAssignmentAcademicYear] = useState('all');
  const [trackingFilters, setTrackingFilters] = useState({ year_level: 'All Years', section: 'All Sections', program_type: 'All Programs', instructor_id: '' });
  const [studentTrackingRows, setStudentTrackingRows] = useState([]);
  const [peerTrackingInstructor, setPeerTrackingInstructor] = useState('');
  const [peerTrackingRows, setPeerTrackingRows] = useState([]);
  const [deptTrackingInstructor, setDeptTrackingInstructor] = useState('');
  const [deptTrackingRows, setDeptTrackingRows] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState('');
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderTarget, setReminderTarget] = useState('');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const [studentEvalForm, setStudentEvalForm] = useState({
    academicYear: adminData.academicYears[4]?.name || '2024/2025',
    semester: adminData.semesters[0]?.name || 'Semester I',
    yearLevel: adminData.yearLevels[2]?.name || 'Year III',
    collegeId: '',
    departmentId: '',
    courseId: '',
    studentGroup: '',
    studentId: '',
  });
  const [studentEvalTemplate, setStudentEvalTemplate] = useState('');
  const [studentEvalTemplateId, setStudentEvalTemplateId] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [instructorEvalForm, setInstructorEvalForm] = useState({ evaluatorId: '', targetInstructorId: '', criteria: '', semester: 'Semester I' });
  const [loadingData, setLoadingData] = useState(true);
  const [deptInstructorsList, setDeptInstructorsList] = useState([]);
  const [deptEvalLoading, setDeptEvalLoading] = useState(false);
  const [selectedDeptInstructor, setSelectedDeptInstructor] = useState(null);
  const [showDeptEvalModal, setShowDeptEvalModal] = useState(false);
  const [deptEvalCriteriaScores, setDeptEvalCriteriaScores] = useState({});
  const [deptEvalSubmitting, setDeptEvalSubmitting] = useState(false);
  const [showEvaluationBreakdown, setShowEvaluationBreakdown] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [peerTargets, setPeerTargets] = useState([]);
  const [peerTargetsLoading, setPeerTargetsLoading] = useState(false);
  const [peerTargetsError, setPeerTargetsError] = useState('');
  const [selectedPeerTarget, setSelectedPeerTarget] = useState(null);
  const [showPeerEvaluationModal, setShowPeerEvaluationModal] = useState(false);
  const [peerEvaluationMode, setPeerEvaluationMode] = useState('create');
  const [peerEvaluationSubmitting, setPeerEvaluationSubmitting] = useState(false);
  const [peerEvaluationError, setPeerEvaluationError] = useState('');
  const [courseForm, setCourseForm] = useState({ name: '', code: '', yearLevel: '', semester: '', section: '', creditHours: '', isLab: false });
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseCsvFile, setCourseCsvFile] = useState(null);
  const [courseCsvUploading, setCourseCsvUploading] = useState(false);

  useEffect(() => {
    if (location.pathname !== '/dept-head/dashboard') return;
    const requestedTab = location.hash.replace('#', '');
    const availableTabs = [
      'overview',
      'courses',
      'viewData',
      'assignments',
      'publishEvaluation',
      'evaluateInstructor',
      'tracking',
      'performanceDashboard',
      'reports',
    ];
    if (availableTabs.includes(requestedTab)) setActiveTab(requestedTab);
  }, [location.hash, location.pathname]);

  const normalizeUserRecord = useCallback((userRecord) => ({
    id: userRecord.id,
    fullName: userRecord.full_name || userRecord.fullName || `${userRecord.firstName || ''} ${userRecord.lastName || ''}`.trim(),
    email: userRecord.email || '',
    username: userRecord.username,
    password: userRecord.password || '',
    studentId: userRecord.studentId || userRecord.student_id || userRecord.studentid || '',
    phoneNumber: userRecord.phoneNumber || userRecord.phone_number || '',
    departmentId: userRecord.department_id || userRecord.departmentId || userRecord.departmentid || '',
    courseId: userRecord.course_id || userRecord.courseId || userRecord.courseid || '',
    departmentName: userRecord.departmentName || userRecord.department_name || '',
    courseName: userRecord.courseName || userRecord.course_name || '',
    specialization: userRecord.specialization || '',
    learningLevel: userRecord.learningLevel || userRecord.learning_level || '',
    registrationDate: userRecord.registrationDate || userRecord.registration_date || today,
    activityDate: userRecord.created_at || userRecord.createdAt || userRecord.registrationDate || userRecord.registration_date || null,
    role: String(userRecord.role).toLowerCase() === 'student' ? 'Student' : String(userRecord.role).toLowerCase() === 'instructor' ? 'Instructor' : userRecord.role,
  }), [today]);

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (!departmentId) {
        setLoadingData(false);
        return;
      }

      const [usersResult, coursesResult, assignmentsResult] = await Promise.allSettled([
        registrationApi.getUsers(),
        departmentApi.getDepartmentCourses(departmentId),
        courseAssignmentApi.getAll(),
      ]);

      if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) {
        setUsers(usersResult.value.map(normalizeUserRecord));
      } else if (usersResult.status === 'rejected' && usersResult.reason?.status !== 403) {
        console.warn('Unable to load department users:', usersResult.reason);
      }
      if (coursesResult.status === 'fulfilled' && Array.isArray(coursesResult.value)) {
        setCourses(coursesResult.value);
      } else if (coursesResult.status === 'fulfilled' && Array.isArray(coursesResult.value?.courses)) {
        setCourses(coursesResult.value.courses.map((course) => ({
          ...course,
          id: course.id,
          code: course.code || course.course_code || '',
          name: course.name || course.course_name || '',
          creditHours: course.credits ?? course.credit_hours ?? course.creditHours ?? '0',
          departmentId: course.department_id || departmentId,
        })));
      } else if (coursesResult.status === 'rejected' && coursesResult.reason?.status !== 403) {
        console.warn('Unable to load department courses:', coursesResult.reason);
      }
      if (assignmentsResult.status === 'fulfilled' && Array.isArray(assignmentsResult.value)) {
        setAssignments(assignmentsResult.value);
      }
    } catch (error) {
      console.error('Unable to sync dashboard data', error);
    } finally {
      setLoadingData(false);
    }
  }, [departmentId, normalizeUserRecord]);

  const loadStudentTemplate = useCallback(async () => {
    try {
      const response = await evaluationApi.getLatestTemplate();
      let templateContent = '';
      if (response.template_data) {
        const templateData = typeof response.template_data === 'string' ? JSON.parse(response.template_data) : response.template_data;
        templateContent = templateData?.content ? String(templateData.content) : JSON.stringify(templateData, null, 2);
      }
      setStudentEvalTemplate(templateContent || 'Enter evaluation template details here.');
      setStudentEvalTemplateId(response.id);
    } catch (error) {
      console.warn('Unable to load evaluation template from backend:', error.message || error);
      setStudentEvalTemplate('Enter evaluation template details here.');
    }
  }, []);

  const loadDepartmentCourses = useCallback(async () => {
    setDepartmentCoursesLoading(true);
    try {
      const result = await departmentApi.getDepartmentCourses(departmentId);
      setCourses((Array.isArray(result?.courses) ? result.courses : []).map((course) => ({
        ...course,
        code: course.code || course.course_code || '',
        name: course.name || course.course_name || '',
        creditHours: course.credits ?? course.credit_hours ?? course.creditHours ?? '0',
        departmentId: course.department_id || departmentId,
      })));
    } catch (error) {
      console.error('Unable to load department courses:', error);
      setCourses([]);
    } finally {
      setDepartmentCoursesLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (activeTab !== 'peerEvaluation') return undefined;
    let cancelled = false;
    const loadPeerTargets = async () => {
      setPeerTargetsLoading(true);
      setPeerTargetsError('');
      try {
        const targets = await courseAssignmentApi.getPeerTargets();
        if (!cancelled) setPeerTargets(Array.isArray(targets) ? targets.filter((target) => !isLabAssistantRole(target.target_role)) : []);
      } catch (error) {
        if (!cancelled) {
          setPeerTargets([]);
          setPeerTargetsError(error?.message || 'Unable to load department peer evaluations.');
        }
      } finally {
        if (!cancelled) setPeerTargetsLoading(false);
      }
    };
    void loadPeerTargets();
    return () => { cancelled = true; };
  }, [activeTab]);

  const loadOverviewStats = useCallback(async (showLoading = false) => {
    if (!departmentId) return;
    if (showLoading) setOverviewStatsLoading(true);
    try {
      const stats = await departmentApi.getOverview(departmentId);
      setOverviewStats({
        totalInstructors: Number(stats?.totalInstructors || 0),
        totalStudents: Number(stats?.totalStudents || 0),
        totalCourses: Number(stats?.totalCourses || 0),
        activeAssignments: Number(stats?.activeAssignments || 0),
        openEvaluations: Number(stats?.openEvaluations || 0),
        averageScore: Number(stats?.averageScore || 0),
        pendingReviewItems: Number(stats?.pendingReviewItems || 0),
      });
      setOverviewTrends(stats?.trends || {});
    } catch (error) {
      if (error?.status !== 403) console.warn('Unable to load overview stats:', error);
    } finally {
      if (showLoading) setOverviewStatsLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadOverviewStats();
    };
    void loadOverviewStats(true);
    const intervalId = window.setInterval(loadOverviewStats, 30000);
    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, loadOverviewStats);
    window.addEventListener(SUBMISSIONS_UPDATED_EVENT, loadOverviewStats);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, loadOverviewStats);
      window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, loadOverviewStats);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [departmentId, loadOverviewStats]);

  useEffect(() => {
    void loadDashboardData();
    void loadStudentTemplate();
  }, [loadDashboardData, loadStudentTemplate]);

  useEffect(() => {
    if (activeTab !== 'viewData' || !departmentId) return;
    let cancelled = false;
    const loadViewData = async () => {
      try {
        const result = viewDataTab === 'students'
          ? await departmentApi.getDepartmentStudents(departmentId)
          : await departmentApi.getDepartmentData(viewDataTab, departmentId);
        if (cancelled) return;
        setViewDataRows(Array.isArray(result) ? result : []);
        if (viewDataTab === 'instructors') setAssignmentInstructors(Array.isArray(result) ? result : []);
        if (viewDataTab === 'courses') setCourses(Array.isArray(result) ? result : []);
      } catch (error) {
        if (!cancelled && error?.status !== 403) console.warn(`Unable to load ${viewDataTab}:`, error);
        if (!cancelled) setViewDataRows([]);
      }
    };
    void loadViewData();
    return () => { cancelled = true; };
  }, [activeTab, viewDataTab, departmentId]);

  const sidebarItems = [
    { key: 'overview', label: strings.deptHeadDashboard.overview, icon: FaShieldAlt },
    { key: 'courses', label: strings.deptHeadDashboard.courseRegistration, icon: FaBook },
    { key: 'viewData', label: strings.deptHeadDashboard.viewData, icon: FaDatabase },
    { key: 'assignments', label: strings.deptHeadDashboard.courseAssignments, icon: FaClipboardCheck },
    { key: 'publishEvaluation', label: strings.deptHeadDashboard.publishEvaluation, icon: FaBell },
    { key: 'evaluateInstructor', label: strings.deptHeadDashboard.evaluateInstructor, icon: FaGraduationCap },
    { key: 'tracking', label: strings.deptHeadDashboard.evaluationTracking, icon: FaChartBar },
    { key: 'evaluationSchedule', label: 'Evaluation Schedule', icon: FaCalendarAlt },
    { key: 'performanceDashboard', label: strings.deptHeadDashboard.performanceFeedback, icon: FaChartBar },
    { key: 'reports', label: strings.deptHeadDashboard.departmentCertificates, icon: FaChartBar },
  ];

  const normalizeCourseRecord = (course) => ({
    id: course.id,
    code: course.code || course.course_code || '',
    name: course.name || course.course_name || '',
    collegeId: course.collegeId || course.college_id || course.college || '',
    departmentId: course.departmentId || course.department_id || course.department || '',
    creditHours: course.creditHours || course.credit_hours || '3',
    semester: course.semester || '',
    registrationDate: course.registrationDate || course.registration_date || '',
    ...course,
    is_lab: isLabCourse(course.is_lab),
  });

  const instructors = useMemo(() => (users || []).filter((user) => String(user.role).toLowerCase() === 'instructor'), [users]);
  const departmentStaff = useMemo(() => (users || []).filter((user) => (
    isDepartmentHeadEvaluationTargetRole(user.role)
      && String(user.departmentId || user.department_id || user.department || '') === String(departmentId)
  )), [users, departmentId]);

  const handleTrackingFilterChange = (field) => (value) => {
    setTrackingFilters((current) => ({ ...current, [field]: value }));
    if (field !== 'instructor_id') setTrackingFilters((current) => ({ ...current, instructor_id: '' }));
  };

  useEffect(() => {
    if (activeTab !== 'tracking' || !departmentId) return undefined;
    let cancelled = false;
    const loadTrackingInstructors = async () => {
      try {
        const rows = await evaluationApi.getDeptHeadTrackingInstructors({
          year_level: trackingFilters.year_level,
          section: trackingFilters.section,
          program_type: trackingFilters.program_type,
        });
        if (!cancelled) setTrackingInstructors(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (!cancelled) {
          setTrackingInstructors([]);
          if (error?.status !== 403) console.warn('Unable to load filtered tracking instructors:', error);
        }
      }
    };
    void loadTrackingInstructors();
    return () => { cancelled = true; };
  }, [activeTab, departmentId, trackingFilters.year_level, trackingFilters.section, trackingFilters.program_type]);

  const fetchStudentTracking = async () => {
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const rows = await evaluationApi.getDeptHeadStudentTracking({
        year_level: trackingFilters.year_level,
        section: trackingFilters.section,
        program_type: trackingFilters.program_type,
        instructor_id: trackingFilters.instructor_id || undefined,
      });
      setStudentTrackingRows(Array.isArray(rows) ? rows : []);
      if (!rows || rows.length === 0) {
        setTrackingMessage(t('No student evaluation rows matched the selected filters.'));
      }
    } catch (error) {
      console.error('Student tracking fetch failed:', error);
      setTrackingMessage(error.message || 'Unable to load student tracking data.');
      setStudentTrackingRows([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchPeerTracking = async () => {
    if (!peerTrackingInstructor) {
      setTrackingMessage('Please select an instructor first.');
      return;
    }
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const rows = await evaluationApi.getDeptHeadPeerTracking({ target_instructor_id: peerTrackingInstructor });
      setPeerTrackingRows(Array.isArray(rows) ? rows : []);
      if (!rows || rows.length === 0) {
        setTrackingMessage(t('No peer evaluation rows found for this instructor.'));
      }
    } catch (error) {
      console.error('Peer tracking fetch failed:', error);
      setTrackingMessage(error.message || 'Unable to load peer tracking data.');
      setPeerTrackingRows([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchDeptHeadTracking = async () => {
    if (!deptTrackingInstructor) {
      setTrackingMessage('Please select an instructor first.');
      return;
    }
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const rows = await evaluationApi.getDeptHeadDeptHeadTracking({ instructor_id: deptTrackingInstructor });
      setDeptTrackingRows(Array.isArray(rows) ? rows : []);
      if (!rows || rows.length === 0) {
        setTrackingMessage(t('No department head evaluation rows found for this instructor.'));
      }
    } catch (error) {
      console.error('Dept head tracking fetch failed:', error);
      setTrackingMessage(error.message || 'Unable to load department head tracking data.');
      setDeptTrackingRows([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  const sendEvaluationReminder = async (evaluatorId = null, evaluationType = null, name = null) => {
    setReminderSending(true);
    setReminderTarget(evaluatorId ? String(evaluatorId) : 'all');
    try {
      const result = await evaluationApi.sendReminder(evaluatorId
        ? { evaluator_id: evaluatorId, evaluation_type: evaluationType, department_id: departmentId }
        : { send_to_all_pending: true, department_id: departmentId });
      toast.success(evaluatorId ? `${t('Reminder sent successfully to')} ${name || t('the pending evaluator')}.` : t('Reminders sent to pending evaluators'));
      if (!evaluatorId && result?.telegram?.configured && !result.telegram.sent) {
        toast.error(`${t('Telegram delivery failed')}: ${result.telegram.error || t('check bot configuration and group access.')}`);
      }
    } catch (error) {
      toast.error(error?.message || t('Unable to send evaluation reminder.'));
    } finally {
      setReminderSending(false);
      setReminderTarget('');
    }
  };

  const loadDeptHeadInstructors = useCallback(async () => {
    if (!departmentId) return;
    setDeptEvalLoading(true);
    try {
      const data = await evaluationApi.getDeptHeadInstructors({ department_id: departmentId });
      // API returns an array of instructors
      setDeptInstructorsList(Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : data || []));
    } catch (error) {
      if (error?.status !== 403) console.error('Unable to load dept head instructors:', error);
      setDeptInstructorsList([]);
      if (error?.status !== 403) toast.error(error?.message || t('Unable to load instructors.'));
    } finally {
      setDeptEvalLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (activeTab === 'evaluateInstructor') {
      void loadDeptHeadInstructors();
    }
  }, [activeTab, loadDeptHeadInstructors]);

  const publishFinalResults = async () => {
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const result = await evaluationApi.calculatePublishFinalResults();
      setTrackingMessage('Final results have been calculated and published successfully.');
      console.log('Publish result', result);
    } catch (error) {
      console.error('Calculate publish failed:', error);
      setTrackingMessage(error.message || 'Unable to calculate and publish final results.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const statusBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    const isSubmitted = normalized === 'submitted' || normalized === 'completed';
    return (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {isSubmitted ? 'Submitted' : status || 'Pending'}
      </span>
    );
  };

  const handleOpenEvaluationModal = (inst) => {
    setSelectedDeptInstructor(inst);
    // Initialize criteria scores from existing data if available
    const existingScores = inst?.criteria_scores || {};
    setDeptEvalCriteriaScores(existingScores);
    setShowDeptEvalModal(true);
  };

  const handleSubmitDeptEval = async (criteriaScores, totalScore, strengths, improvements, generalComments) => {
    if (!selectedDeptInstructor) return;
    
    setDeptEvalSubmitting(true);
    try {
      const payload = {
        evaluator_id: user?.id || user?.user_id,
        instructor_id: selectedDeptInstructor.instructor_id || selectedDeptInstructor.id,
        department_id: departmentId,
        criteria_scores: criteriaScores,
        total_score: totalScore,
        strengths,
        weaknesses: improvements,
        general_comments: generalComments,
      };
      await evaluationApi.submitDeptHeadEvaluation(payload);
      toast.success(t('Evaluation submitted successfully.'));
      // update local list
      setDeptInstructorsList((current) => current.map((item) => (String(item.instructor_id) === String(selectedDeptInstructor.instructor_id) ? { ...item, evaluation_status: 'Submitted', total_score: totalScore, criteria_scores: criteriaScores } : item)));
      setShowDeptEvalModal(false);
      setDeptEvalCriteriaScores({});
    } catch (error) {
      console.error('Submit dept eval failed:', error);
      toast.error(error?.message || t('Unable to submit Department Head evaluation.'));
    } finally {
      setDeptEvalSubmitting(false);
    }
  };

  const handleViewEvaluation = (instructor) => {
    // Parse criteria_scores if it's a JSON string
    let criteriaScores = instructor.criteria_scores;
    if (typeof criteriaScores === 'string') {
      try {
        criteriaScores = JSON.parse(criteriaScores);
      } catch {
        criteriaScores = {};
      }
    }
    
    setSelectedEvaluation({
      ...instructor,
      criteria_scores: criteriaScores || {}
    });
    setShowEvaluationBreakdown(true);
  };

  const handleEditEvaluation = () => {
    // Switch to edit mode in the criteria modal
    setShowEvaluationBreakdown(false);
    setSelectedDeptInstructor(selectedEvaluation);
    setDeptEvalCriteriaScores(selectedEvaluation.criteria_scores || {});
    setShowDeptEvalModal(true);
  };

  const openOverviewMetric = (metric) => {
    if (['instructors', 'students', 'courses'].includes(metric)) {
      setViewDataTab(metric);
      setActiveTab('viewData');
      return;
    }
    if (metric === 'assignments') {
      setAssignmentViewFilter('active');
      setActiveTab('assignments');
      void courseAssignmentApi.getAll()
        .then((rows) => setAssignments(Array.isArray(rows) ? rows : []))
        .catch((error) => console.warn('Unable to refresh department assignments:', error));
      return;
    }
    setTrackingView('student');
    setTrackingStatusFilter(metric === 'evaluations' || metric === 'reviews' ? 'Pending' : 'all');
    setActiveTab('tracking');
    void fetchStudentTracking();
  };

  const departmentCourses = useMemo(
    () => (courses || []).filter((course) => String(course.departmentId || course.department_id) === String(departmentId)),
    [courses, departmentId]
  );

  const departmentAssignments = useMemo(
    () => (assignments || []).filter((assignment) => String(assignment.department_id || assignment.departmentId || departmentId) === String(departmentId)),
    [assignments, departmentId]
  );

  const activeDepartmentAssignments = useMemo(
    () => departmentAssignments.filter((assignment) => [1, '1', true].includes(assignment.is_published) || [1, '1', true].includes(assignment.is_student_published) || [1, '1', true].includes(assignment.is_peer_published)),
    [departmentAssignments]
  );
  const recentActivity = useMemo(() => {
    const activities = [
      ...departmentCourses.map((course, index) => ({
        id: `course-${course.id || course.code || course.course_code || index}`,
        title: 'Course Registered',
        description: `${course.code || course.course_code || 'Course'}${course.name || course.course_name ? ` · ${course.name || course.course_name}` : ''}`,
        date: course.created_at || course.createdAt || course.registration_date || course.registrationDate,
        icon: FaBook,
        color: 'bg-blue-100 text-blue-700',
      })),
      ...users
        .filter((record) => String(record.role || '').toLowerCase() === 'instructor'
          && String(record.departmentId || record.department_id || record.department || '') === String(departmentId))
        .map((instructor, instructorIndex) => ({
          id: `instructor-${instructor.id || instructor.username || instructorIndex}`,
          title: 'Instructor Added',
          description: instructor.fullName || instructor.username || 'Instructor added to the department',
          date: instructor.activityDate,
          icon: FaUsers,
          color: 'bg-violet-100 text-violet-700',
        })),
      ...departmentAssignments.map((assignment, index) => ({
        id: `assignment-${assignment.id || assignment.assignment_id || index}`,
        title: 'Course Assignment Updated',
        description: assignment.course_name || assignment.course_code || assignment.title || 'Department course assignment',
        date: assignment.updated_at || assignment.updatedAt || assignment.created_at || assignment.createdAt || assignment.published_at,
        icon: FaClipboardCheck,
        color: 'bg-emerald-100 text-emerald-700',
      })),
    ];

    return activities
      .map((activity) => ({ ...activity, timestamp: activity.date ? new Date(activity.date) : null }))
      .filter((activity) => activity.timestamp && !Number.isNaN(activity.timestamp.getTime()))
      .sort((first, second) => second.timestamp.getTime() - first.timestamp.getTime())
      .slice(0, 4);
  }, [departmentAssignments, departmentCourses, departmentId, users]);
  const displayedAssignments = assignmentViewFilter === 'active' ? activeDepartmentAssignments : departmentAssignments;
  const assignmentAcademicYears = useMemo(() => {
    const years = new Set([
      ...adminData.academicYears.map(({ name }) => name),
      ...departmentAssignments
        .map((assignment) => assignment.academic_year || assignment.academicYear)
        .filter(Boolean)
        .map(String),
    ]);
    return [...years].sort((first, second) => second.localeCompare(first));
  }, [departmentAssignments]);
  const filteredAssignments = useMemo(() => displayedAssignments.filter((assignment) => {
    const course = courses.find((item) => String(item.id) === String(assignment.course_id));
    const courseCode = course?.code || course?.course_code || assignment.course_code || '';
    const courseName = course?.name || course?.course_name || assignment.course_name || '';
    const instructor = users.find((item) => String(item.id) === String(assignment.instructor_id));
    const instructorName = instructor?.fullName || assignment.instructor_name || assignment.instructor_id || '';
    const academicYear = String(assignment.academic_year || assignment.academicYear || '');
    const searchValue = `${courseCode} ${courseName} ${instructorName} ${assignment.section || ''}`.toLowerCase();
    return (assignmentAcademicYear === 'all' || academicYear === assignmentAcademicYear)
      && (assignmentCourseFilter === 'all' || String(assignment.course_id) === assignmentCourseFilter)
      && searchValue.includes(assignmentSearch.trim().toLowerCase());
  }), [assignmentAcademicYear, assignmentCourseFilter, assignmentSearch, courses, displayedAssignments, users]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [savingAssignmentEdit, setSavingAssignmentEdit] = useState(false);
  const [assignmentEditDraft, setAssignmentEditDraft] = useState({
    course_id: '',
    instructor_id: '',
    program_type: '',
    year_level: '',
    semester: '',
    section: '',
  });
  const [assignmentStep, setAssignmentStep] = useState(1);
  const programTypeOptions = ['Regular', 'Extension'];
  const yearLevelOptions = ['1st Year (Freshman)', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'];
  const [assignmentDraft, setAssignmentDraft] = useState({ courseId: '', instructorId: '', section: '', semester: '', programType: '', yearLevel: '' });
  const [publishTarget, setPublishTarget] = useState('both');

  useEffect(() => {
    const shouldLoad = showAssignModal || Boolean(editingAssignment) || (activeTab === 'viewData' && viewDataTab === 'instructors');
    if (!shouldLoad || !departmentId) return;
    let cancelled = false;
    const loadAssignmentInstructors = async () => {
      try {
        const result = await courseAssignmentApi.getDepartmentInstructors(departmentId);
        if (!cancelled) setAssignmentInstructors(Array.isArray(result) ? result : []);
      } catch (error) {
        if (!cancelled && error?.status !== 403) console.warn('Unable to load assignment instructors:', error);
        if (!cancelled) setAssignmentInstructors([]);
      }
    };
    void loadAssignmentInstructors();
    return () => { cancelled = true; };
  }, [showAssignModal, editingAssignment, activeTab, viewDataTab, departmentId]);

  const handleSendStudentEvaluation = async () => {
    const selectedCourseData = courses.find((course) => String(course.id) === String(studentEvalForm.courseId));
    const studentIdentifierText = studentEvalForm.studentId || studentEvalForm.studentGroup || '';

    if (!studentEvalForm.academicYear || !studentEvalForm.semester || !studentEvalForm.yearLevel || !studentEvalForm.courseId) {
      toast.error(t('Please fill all required student evaluation dispatch fields.'));
      return;
    }

    const payload = {
      template_id: studentEvalTemplateId,
      student_id: null,
      student_identifier: studentEvalForm.studentId || null,
      student_group: studentEvalForm.studentGroup || null,
      course_code: selectedCourseData?.code || '',
      course_name: selectedCourseData?.name || '',
      academic_year: studentEvalForm.academicYear,
      semester: studentEvalForm.semester,
      year_level: studentEvalForm.yearLevel,
      student_identifier_text: studentIdentifierText,
      payload: studentEvalForm,
    };

    try {
      const dispatchResponse = await evaluationApi.dispatchStudentEvaluation(payload);
      setFormNotification(`Student evaluation dispatched (${dispatchResponse.id})`);
      setShowStudentModal(false);
      setTimeout(() => setFormNotification(''), 5000);
    } catch (error) {
      console.error('Unable to dispatch student evaluation:', error);
      toast.error(error.message || t('Unable to send student evaluation.'));
    }
  };

  const handleSendInstructorEvaluation = async () => {
    try {
      const payload = {
        template_id: null,
        student_id: null,
        student_identifier: null,
        course_id: null,
        course_name: '',
        academic_year: instructorEvalForm.academicYear || '',
        semester: instructorEvalForm.semester || '',
        year_level: '',
        student_group: 'instructor',
        created_by: currentUser?.id || null,
        payload: instructorEvalForm,
      };
      const dispatchResponse = await evaluationApi.dispatchStudentEvaluation(payload);
      setFormNotification(`Peer review dispatched (${dispatchResponse.id})`);
      setShowInstructorModal(false);
      setTimeout(() => setFormNotification(''), 5000);
    } catch (error) {
      console.error('Unable to dispatch peer review:', error);
      toast.error(error.message || t('Unable to dispatch peer review.'));
    }
  };

  // Assignment helper functions
  const getInstructorAssignedCredits = (instructorId) => {
    return assignments.reduce((sum, a) => (String(a.instructor_id) === String(instructorId) ? sum + Number(a.creditHours || 0) : sum), 0);
  };

  const checkQualification = (instructorId, courseId) => {
    const ins = users.find((u) => String(u.id) === String(instructorId));
    const c = courses.find((x) => String(x.id) === String(courseId));
    if (!ins || !c) return false;
    const spec = (ins.specialization || '').toLowerCase();
    const courseName = (c.name || '').toLowerCase();
    const deptMatch = String(ins.departmentId || '') === String(c.departmentId || '');
    const specMatch = spec && courseName ? spec.includes(courseName.split(' ')[0]) : false;
    return deptMatch || specMatch;
  };

  const canSubmitAssignment = () => {
    const { courseId, instructorId, section, semester, programType, yearLevel } = assignmentDraft;
    return Boolean(courseId && instructorId && programType && yearLevel && semester && section);
  };

  const handleConfirmAssignment = () => {
    if (!canSubmitAssignment()) {
      toast.error(t('Please complete all assignment fields before confirming.'));
      return;
    }

    setShowPublishModal(true);
  };

  const handleFinalPublishSubmit = async () => {
    const { courseId, instructorId, section, semester, programType, yearLevel } = assignmentDraft;
    if (!courseId || !instructorId || !semester || !section) {
      toast.error(t('Please select course, instructor, semester, and section.'));
      return;
    }

    const course = courses.find((c) => String(c.id) === String(courseId));
    const creditHours = Number(course?.creditHours || 0);
    const currentLoad = getInstructorAssignedCredits(instructorId);
    const willExceed = currentLoad + creditHours > MAX_CREDIT_LOAD;

    if (willExceed) {
      toast.error(t('Assignment failed validation. Fix the warning before publishing.'));
      return;
    }

    try {
      const created = await courseAssignmentApi.createDeptHeadAssignment({
        department_id: Number(departmentId) || undefined,
        course_id: Number(courseId),
        instructor_id: Number(instructorId),
        program_type: programType,
        year_level: yearLevel,
        semester,
        section,
        publish_target: publishTarget,
        is_published: true,
      });

      const newAssignment = {
        id: created.id,
        course_id: courseId,
        course_name: course?.name || '',
        instructor_id: instructorId,
        instructor_name: users.find((u) => String(u.id) === String(instructorId))?.fullName || '',
        section,
        semester,
        creditHours,
        program_type: programType,
        year_level: yearLevel,
        publish_target: publishTarget,
        status: 'Assigned',
      };

      setAssignments((s) => [newAssignment, ...s]);
      setShowAssignModal(false);
      setShowPublishModal(false);
      setAssignmentDraft({ courseId: '', instructorId: '', section: '', semester: '', programType: '', yearLevel: '' });
      setPublishTarget('both');
      toast.success(t('Course assignment published successfully.'));
    } catch (error) {
      console.error('Unable to submit assignment:', error);
      toast.error(error.message || t('Unable to persist course assignment.'));
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!await requestConfirmation({
      title: 'Delete Course Assignment',
      description: 'Are you sure you want to delete this course assignment?',
      confirmLabel: 'Delete Assignment',
      variant: 'danger',
    })) return;
    try {
      await courseAssignmentApi.deleteAssignment(assignmentId);
      setAssignments((current) => current.filter((assignment) => String(assignment.id) !== String(assignmentId)));
      toast.success(t('Course assignment deleted successfully.'));
    } catch (error) {
      toast.error(error?.message || t('Unable to delete course assignment.'));
    }
  };

  const openAssignmentEditor = (assignment) => {
    setAssignmentEditDraft({
      course_id: String(assignment.course_id || ''),
      instructor_id: String(assignment.instructor_id || ''),
      program_type: assignment.program_type || 'Regular',
      year_level: assignment.year_level || '',
      semester: assignment.semester || '',
      section: assignment.section || '',
    });
    setEditingAssignment(assignment);
  };

  const handleUpdateAssignment = async (event) => {
    event.preventDefault();
    if (!editingAssignment || Object.values(assignmentEditDraft).some((value) => !String(value).trim())) {
      toast.error(t('Complete all assignment fields before saving.'));
      return;
    }

    setSavingAssignmentEdit(true);
    try {
      await courseAssignmentApi.updateAssignment(editingAssignment.id, {
        ...assignmentEditDraft,
        course_id: Number(assignmentEditDraft.course_id),
        instructor_id: Number(assignmentEditDraft.instructor_id),
      });
      const selectedInstructor = assignmentInstructors.find(
        (instructor) => String(instructor.instructor_id || instructor.id) === assignmentEditDraft.instructor_id,
      );
      const selectedCourse = courses.find(
        (course) => String(course.id) === assignmentEditDraft.course_id,
      );
      setAssignments((current) => current.map((assignment) => (
        String(assignment.id) === String(editingAssignment.id)
          ? {
              ...assignment,
              ...assignmentEditDraft,
              course_id: Number(assignmentEditDraft.course_id),
              instructor_id: Number(assignmentEditDraft.instructor_id),
              course_name: selectedCourse?.name || assignment.course_name,
              course_code: selectedCourse?.code || assignment.course_code,
              instructor_name: selectedInstructor?.full_name || assignment.instructor_name,
            }
          : assignment
      )));
      setEditingAssignment(null);
      toast.success(t('Course assignment updated successfully.'));
    } catch (error) {
      toast.error(error?.message || t('Unable to update course assignment.'));
    } finally {
      setSavingAssignmentEdit(false);
    }
  };



  const handleEditUser = (user) => {
    if (user.role === 'Instructor') {
      toast('Instructor editing is not available in this dashboard.');
      setActiveTab('viewData');
      setViewDataTab('instructors');
    } else {
      toast('Student editing is not available in this dashboard.');
      setActiveTab('viewData');
      setViewDataTab('students');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await registrationApi.deleteUser(userId);
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
      toast.success(t('User deleted successfully.'));
    } catch (error) {
      console.error('Delete failed', error);
      toast.error(t('Unable to delete the user.'));
    }
  };

  const handleCourseSubmit = async (event) => {
    event.preventDefault();
    const name = courseForm.name.trim();
    const code = courseForm.code.trim();
    if (!name || (!courseForm.isLab && !code)) {
      toast.error(courseForm.isLab ? t('Please enter the Lab Class name.') : t('Please enter the course name and course code.'));
      return;
    }
    const duplicate = courses.some((course) => (
      !courseForm.isLab
      && String(course.id) !== String(editingCourseId)
      && String(course.code || course.course_code || '').toLowerCase() === code.toLowerCase()
    ));
    if (duplicate) {
      toast.error(t('This course code is already registered.'));
      return;
    }
    const payload = {
      ...(code ? { course_code: code } : {}),
      course_name: name,
      department_id: departmentId,
      year_level: courseForm.yearLevel,
      semester: courseForm.semester,
      ...(!courseForm.isLab ? { credit_hours: Number(courseForm.creditHours) } : {}),
      is_lab: courseForm.isLab,
      section: courseForm.isLab ? courseForm.section : null,
    };
    if (courseForm.isLab && !courseForm.section) {
      toast.error(t('Please select a section for this Lab Class.'));
      return;
    }
    try {
      setCourseSaving(true);
      if (editingCourseId !== null) {
        const result = await registrationApi.updateCourse(editingCourseId, payload);
        const updatedCourse = normalizeCourseRecord({ ...payload, ...result, id: editingCourseId });
        setCourses((current) => current.map((course) => (
          String(course.id) === String(editingCourseId) ? updatedCourse : course
        )));
        toast.success(t('Course updated successfully.'));
      } else {
        const result = await registrationApi.createCourse(payload);
        setCourses((current) => [normalizeCourseRecord({ ...payload, ...result, id: result.id }), ...current]);
        toast.success(t('Course registered successfully.'));
      }
      setEditingCourseId(null);
      setCourseForm({ name: '', code: '', yearLevel: '', semester: '', section: '', creditHours: '', isLab: false });
    } catch (error) {
      console.error('Unable to save course:', error);
      toast.error(error?.message || (editingCourseId !== null ? t('Unable to update course.') : t('Unable to register course.')));
    } finally {
      setCourseSaving(false);
    }
  };

  const editCourse = (course) => {
    const normalized = normalizeCourseRecord(course);
    setEditingCourseId(normalized.id);
    setCourseForm({
      name: normalized.name,
      code: normalized.code,
      yearLevel: normalized.year_level || '',
      semester: normalized.semester || '',
      section: normalized.section || '',
      creditHours: String(normalized.creditHours || normalized.credit_hours || 3),
      isLab: isLabCourse(normalized.is_lab),
    });
    setActiveTab('courses');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelCourseEdit = () => {
    setEditingCourseId(null);
    setCourseForm({ name: '', code: '', yearLevel: '', semester: '', section: '', creditHours: '', isLab: false });
  };

  const addLabClass = () => {
    setEditingCourseId(null);
    setCourseForm({ name: '', code: '', yearLevel: '', semester: '', section: '', creditHours: '', isLab: true });
    setActiveTab('courses');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteLabClass = async (course) => {
    if (!await requestConfirmation({
      title: 'Delete Lab Class',
      description: `Are you sure you want to delete Lab Class "${course.name || course.course_name}"?`,
      confirmLabel: 'Delete Lab Class',
      variant: 'danger',
    })) return;
    try {
      await registrationApi.deleteCourse(course.id);
      setCourses((current) => current.filter((item) => String(item.id) !== String(course.id)));
      toast.success(t('Lab Class deleted successfully.'));
    } catch (error) {
      console.error('Unable to delete Lab Class:', error);
      toast.error(error?.message || t('Unable to delete Lab Class.'));
    }
  };

  const handleCourseCsvUpload = async () => {
    if (!courseCsvFile) {
      toast.error(t('Please choose a CSV file before uploading.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', courseCsvFile);
    formData.append('department_id', departmentId);
    setCourseCsvUploading(true);
    try {
      const result = await registrationApi.bulkUploadCourses(formData);
      const createdCourses = Array.isArray(result?.courses) ? result.courses : [];
      setCourses((current) => [...createdCourses.map(normalizeCourseRecord), ...current]);
      setCourseCsvFile(null);
      toast.success(`${t('Course upload complete. Created')} ${result?.created || createdCourses.length} ${t('course(s).')}`);
    } catch (error) {
      toast.error(error?.message || t('Unable to upload courses.'));
    } finally {
      setCourseCsvUploading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'performanceDashboard':
        return <DeptHeadPerformanceDashboard />;
      case 'labClasses': {
        const labClasses = departmentCourses.filter((course) => isLabCourse(course.is_lab));
        return (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t('Lab Classes')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('Add, edit, and remove Lab Classes and their assigned sections.')}</p>
              </div>
              <button type="button" onClick={addLabClass} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">{t('Add Lab Class')}</button>
            </header>
            {departmentCoursesLoading ? (
              <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">{t('Loading Lab Classes...')}</p>
            ) : labClasses.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{t('No Lab Classes have been registered yet.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t('Lab Class')}</th>
                      <th className="px-4 py-3">{t('Year')}</th>
                      <th className="px-4 py-3">{t('Semester')}</th>
                      <th className="px-4 py-3">{t('Section')}</th>
                      <th className="px-4 py-3 text-right">{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {labClasses.map((course) => (
                      <tr key={course.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{course.name || course.course_name}</td>
                        <td className="px-4 py-3 text-slate-600">{course.year_level || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{course.semester || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{course.section ? `${t('Section')} ${String(course.section).replace(/^section\\s+/i, '')}` : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => editCourse(course)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-100"><FaEdit aria-hidden="true" />{t('Edit')}</button>
                            <button type="button" onClick={() => void deleteLabClass(course)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100"><FaTrash aria-hidden="true" />{t('Delete')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      }
      case 'courses':
        return <CourseRegistration />;
        return (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 md:flex-row">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">{t('Bulk Upload Courses (CSV)')}</h4>
                <p className="text-xs text-gray-500">{t('Upload CSV with headers: course_name, course_code, credit_hours, year_level, semester; optional: is_lab and section (section is required for Lab Classes).')}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="file" accept=".csv" onChange={(event) => setCourseCsvFile(event.target.files?.[0] || null)} className="text-xs text-gray-500 file:mr-2 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-blue-700" />
                <button type="button" onClick={handleCourseCsvUpload} disabled={courseCsvUploading || !courseCsvFile} className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60">
                  {courseCsvUploading ? t('Uploading...') : t('Upload CSV')}
                </button>
              </div>
            </div>
            <form onSubmit={handleCourseSubmit} className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex flex-col items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-5 text-center sm:flex-row sm:text-left">
                <div className="flex-1 sm:text-center">
                  <h3 className="text-xl font-bold text-slate-900">{editingCourseId !== null ? t('Edit Course') : t('Course Registration')}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t('Register and maintain courses for')} {currentUser?.department_name || currentUser?.department || t('your department')}.</p>
                </div>
                <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label={t('Course type')}>
                  <button type="button" aria-pressed={!courseForm.isLab} onClick={() => setCourseForm((current) => ({ ...current, isLab: false, section: '' }))} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${!courseForm.isLab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{t('Lecture Course')}</button>
                  <button type="button" aria-pressed={courseForm.isLab} onClick={() => setCourseForm((current) => ({ ...current, isLab: true }))} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${courseForm.isLab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{t('Lab Class')}</button>
                </div>
              </header>
              <fieldset className="min-w-0 px-6 py-5">
                <legend className="mx-auto px-2 text-center text-base font-semibold text-slate-900">{t('Course Details')}</legend>
                <p className="mb-4 text-center text-sm text-slate-500">{courseForm.isLab ? t('Enter the Lab Class name.') : t('Enter the course name, code, and credit value.')}</p>
                <div className={`grid grid-cols-1 gap-4 ${courseForm.isLab ? '' : 'md:grid-cols-3'}`}>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">{t('Course Name')} <span className="text-red-600">*</span></span>
                    <input value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" placeholder={t(courseForm.isLab ? 'e.g. IT 3rd Year Lab or Biology Lab' : 'Enter course name')} required />
                  </label>
                  {!courseForm.isLab && <label className="block">
                    <span className="text-sm font-medium text-slate-700">{t('Course Code')} <span className="text-red-600">*</span></span>
                    <input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" placeholder={t('Enter course code')} required />
                  </label>}
                  {!courseForm.isLab && <label className="block">
                    <span className="text-sm font-medium text-slate-700">{t('Credit Hours / ECTS')} <span className="text-red-600">*</span></span>
                    <input type="number" min="1" step="1" value={courseForm.creditHours} onChange={(event) => setCourseForm({ ...courseForm, creditHours: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" placeholder="3" required />
                  </label>}
                </div>
              </fieldset>
              <fieldset className="min-w-0 border-t border-slate-200 px-6 py-5">
                <legend className="mx-auto px-2 text-center text-base font-semibold text-slate-900">{t('Offering')}</legend>
                <p className="mb-4 text-center text-sm text-slate-500">{t('Choose the academic year level and semester.')}</p>
                <div className={`grid grid-cols-1 gap-4 ${courseForm.isLab ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">{t('Year Level')} <span className="text-red-600">*</span></span>
                    <select value={courseForm.yearLevel} onChange={(event) => setCourseForm({ ...courseForm, yearLevel: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" required>
                      <option value="">{t('Select year level')}</option>
                      {[1, 2, 3, 4, 5, 6, 7].map((year) => <option key={year} value={`Year ${year}`}>{t(`Year ${year}`)}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">{t('Semester')} <span className="text-red-600">*</span></span>
                    <select value={courseForm.semester} onChange={(event) => setCourseForm({ ...courseForm, semester: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" required>
                      <option value="">{t('Select semester')}</option>
                      <option value="Semester I">{t('Semester I')}</option>
                      <option value="Semester II">{t('Semester II')}</option>
                    </select>
                  </label>
                  {courseForm.isLab && (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">{t('Section')} <span className="text-red-600">*</span></span>
                      <select value={courseForm.section} onChange={(event) => setCourseForm({ ...courseForm, section: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" required>
                        <option value="">{t('Select section')}</option>
                        {'A B C D E F G H I J K L'.split(' ').map((section) => <option key={section} value={section}>{t('Section')} {section}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              </fieldset>
              <footer className="flex justify-center border-t border-slate-200 bg-slate-50/70 px-6 py-4">
                <div className="flex gap-3">
                  {editingCourseId !== null && <button type="button" onClick={cancelCourseEdit} className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{t('Cancel')}</button>}
                  <button type="submit" disabled={courseSaving} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">{courseSaving ? t('Saving...') : editingCourseId !== null ? t('Save Changes') : t('Register Course')}</button>
                </div>
              </footer>
            </form>
          </div>
        );
      case 'peerEvaluation':
        return (
          <section className="space-y-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{t('Peer Evaluation')}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {t('Evaluate instructors, lab assistants, the College Dean, and Academic Directorate colleagues in your department. This contributes to the 20% peer evaluation score.')}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Colleague')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Role')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Deadline')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {peerTargetsLoading ? (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">{t('Loading department peers...')}</td></tr>
                  ) : peerTargetsError ? (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-red-600">{peerTargetsError}</td></tr>
                  ) : peerTargets.length ? (
                    peerTargets.map((target) => (
                      <tr key={target.target_user_id}>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">{target.instructor_name || target.username || 'Colleague'}</td>
                        <td className="px-4 py-4 text-sm capitalize text-gray-600">{String(target.target_role || '').replace(/[_-]/g, ' ')}</td>
                        <td className="px-4 py-4 text-sm"><EvaluationDeadlineBadge value={target} /></td>
                        <td className="px-4 py-4 text-sm">
                          {target.is_evaluated ? (
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-emerald-600">✓ {t('Evaluated')} ({target.total_score}/100)</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPeerTarget(target);
                                  setPeerEvaluationMode('edit');
                                  setPeerEvaluationError('');
                                  setShowPeerEvaluationModal(true);
                                }}
                                className="font-semibold text-blue-700 underline hover:text-blue-900"
                              >
                                {t('Edit')}
                              </button>
                            </div>
                          ) : target.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPeerTarget(target);
                                setPeerEvaluationMode('create');
                                setPeerEvaluationError('');
                                setShowPeerEvaluationModal(true);
                              }}
                              className="font-semibold text-indigo-700 hover:text-indigo-900"
                            >
                              ★ {t('Evaluate')}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">{t('Not published yet')}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">{t('No eligible colleagues found in your department.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      case 'overview': {
        const cards = [
          { key: 'totalInstructors', metric: 'instructors', label: strings.deptHeadDashboard.totalInstructors, trendLabel: 'New instructor activity', value: overviewStats.totalInstructors, icon: FaUsers, theme: 'border-sky-100 bg-sky-50/70 text-sky-600', iconTheme: 'bg-blue-500' },
          { key: 'totalStudents', metric: 'students', label: strings.deptHeadDashboard.totalStudents, trendLabel: 'New student activity', value: overviewStats.totalStudents, icon: FaGraduationCap, theme: 'border-emerald-100 bg-emerald-50/70 text-emerald-600', iconTheme: 'bg-emerald-500' },
          { key: 'totalCourses', metric: 'courses', label: strings.deptHeadDashboard.totalCourses, trendLabel: 'New course activity', value: overviewStats.totalCourses, icon: FaBook, theme: 'border-violet-100 bg-violet-50/70 text-violet-600', iconTheme: 'bg-violet-500' },
          { key: 'activeAssignments', metric: 'assignments', label: strings.deptHeadDashboard.activeAssignments, trendLabel: 'Published assignment activity', value: overviewStats.activeAssignments, icon: FaClipboardCheck, theme: 'border-amber-100 bg-amber-50/70 text-amber-600', iconTheme: 'bg-amber-500' },
          { key: 'openEvaluations', metric: 'evaluations', label: strings.deptHeadDashboard.openEvaluations, trendLabel: 'New pending evaluations', value: overviewStats.openEvaluations, icon: FaBell, theme: 'border-cyan-100 bg-cyan-50/70 text-cyan-600', iconTheme: 'bg-cyan-500' },
          { key: 'averageScore', metric: 'score', label: strings.deptHeadDashboard.averageScore, trendLabel: 'Average score', value: overviewStats.averageScore.toFixed(1), icon: FaChartBar, theme: 'border-pink-100 bg-pink-50/70 text-pink-600', iconTheme: 'bg-pink-500' },
        ];
        const quickActions = [
          { label: 'Register Courses', description: 'Assign courses to instructors', icon: FaBook, theme: 'bg-blue-50 text-blue-600', tab: 'courses' },
          { label: 'View Data', description: 'Browse department data', icon: FaDatabase, theme: 'bg-violet-50 text-violet-600', tab: 'viewData' },
          { label: 'Create Evaluation Form', description: 'Publish evaluation form', icon: FaClipboardCheck, theme: 'bg-emerald-50 text-emerald-600', tab: 'publishEvaluation' },
          { label: 'Track Evaluations', description: 'Monitor evaluation progress', icon: FaChartBar, theme: 'bg-amber-50 text-amber-600', tab: 'tracking' },
          { label: 'View Feedback', description: 'Read evaluation feedback', icon: FaBell, theme: 'bg-pink-50 text-pink-600', tab: 'performanceDashboard' },
          { label: 'Department Results', description: 'View certificates and results', icon: FaGraduationCap, theme: 'bg-violet-50 text-violet-600', tab: 'reports' },
        ];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map(({ key, metric, label, trendLabel, value, icon: Icon, theme, iconTheme }) => {
                const trend = overviewTrends[key];
                const trendColor = trend === null || trend === undefined ? 'text-slate-500' : trend >= 0 ? 'text-emerald-700' : 'text-rose-700';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openOverviewMetric(metric)}
                    aria-label={`${t(label)}: ${value}. ${t('Open related records')}`}
                    className={`group flex min-h-[92px] items-center gap-4 rounded-xl border px-4 py-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ieps-blue-500 focus-visible:ring-offset-2 ${theme}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-white shadow-sm ${iconTheme}`}><Icon aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-600">{t(label)}</span>
                      <span className="mt-0.5 block text-xl font-bold tabular-nums text-slate-900" aria-live="polite">{overviewStatsLoading ? '...' : value}</span>
                      <span className={`mt-0.5 block truncate text-[10px] ${trendColor}`}>
                        {overviewStatsLoading ? t('Updating') : trend === null || trend === undefined ? `→ ${t('No prior period baseline')}` : `${t(trendLabel)}: ${trend > 0 ? '+' : ''}${trend}% ${t('vs prior 30 days')}`}
                      </span>
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm shadow-sm transition group-hover:translate-x-0.5" aria-hidden="true"><FaArrowRight /></span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Zap size={17} aria-hidden="true" /></span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{t('Quick Actions')}</h2>
                    <p className="text-xs text-slate-500">{t('Common tasks and shortcuts')}</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {quickActions.map(({ label, description, icon: Icon, theme, tab }) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === 'tracking') void fetchStudentTracking();
                      }}
                      className="group flex min-h-[62px] min-w-0 items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-left transition hover:border-blue-200 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme}`}><Icon aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-slate-800">{t(label)}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{t(description)}</span>
                      </span>
                      <FaArrowRight className="shrink-0 text-[10px] text-slate-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Clock3 size={18} aria-hidden="true" /></span>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{t('Recent Activity')}</h2>
                      <p className="text-xs text-slate-500">{t('Latest department updates')}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => openOverviewMetric('evaluations')} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">
                    {t('View All')} <FaArrowRight aria-hidden="true" />
                  </button>
                </div>
                {recentActivity.length ? (
                  <ol className="divide-y divide-slate-100">
                    {recentActivity.map(({ id, title, description, timestamp, icon: Icon, color }) => (
                      <li key={id} className="flex items-center gap-2.5 py-2 first:pt-1 last:pb-0">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color}`}><Icon aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-slate-800">{title}</span>
                          <span className="block truncate text-[10px] text-slate-500">{description}</span>
                        </span>
                        <time className="shrink-0 text-right text-[9px] leading-3 text-slate-500" dateTime={timestamp.toISOString()}>
                          {timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}<br />
                          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="flex min-h-24 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-xs text-slate-500">
                    {t('No recent activity recorded for this department.')}
                  </div>
                )}
              </section>
            </div>
          </div>
        );
      }
      case 'viewData':
        return (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                aria-pressed={viewDataTab === 'instructors'}
                onClick={() => setViewDataTab('instructors')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  viewDataTab === 'instructors'
                    ? 'border border-ieps-blue-600 bg-ieps-blue-600 text-white shadow-md hover:bg-ieps-blue-700'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                }`}
              >
                <FaChalkboardTeacher />
                {t('Instructors')}
              </button>
              <button
                type="button"
                aria-pressed={viewDataTab === 'students'}
                onClick={() => setViewDataTab('students')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  viewDataTab === 'students'
                    ? 'border border-ieps-blue-600 bg-ieps-blue-600 text-white shadow-md hover:bg-ieps-blue-700'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                }`}
              >
                <FaUsers />
                {t('Students')}
              </button>
              <button
                type="button"
                aria-pressed={viewDataTab === 'courses'}
                onClick={() => setViewDataTab('courses')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  viewDataTab === 'courses'
                    ? 'border border-ieps-blue-600 bg-ieps-blue-600 text-white shadow-md hover:bg-ieps-blue-700'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                }`}
              >
                <FaBook />
                {t('Courses')}
              </button>
            </div>

            {/* Tab Content */}
            {viewDataTab === 'instructors' && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900">{t('Department Instructors')}</h3>
                  <p className="text-sm text-gray-500">{t('Instructors loaded from the department database.')}</p>
                </div>
                {viewDataRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">{t('No instructors registered for your department yet.')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600"><tr><th className="px-4 py-3 font-semibold">{t('ID')}</th><th className="px-4 py-3 font-semibold">{t('Name')}</th><th className="px-4 py-3 font-semibold">{t('Phone Number')}</th><th className="px-4 py-3 font-semibold">{t('Status')}</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewDataRows.map((instructor) => (
                          <tr key={instructor.id || instructor.instructor_id} className="hover:bg-gray-50"><td className="px-4 py-3">{instructor.id || instructor.instructor_id}</td><td className="px-4 py-3 font-medium text-gray-800">{instructor.instructor_name || instructor.name || instructor.fullName || instructor.username || instructor.email}</td><td className="px-4 py-3">{instructor.phone_number || instructor.phoneNumber || '-'}</td><td className="px-4 py-3">{t('Active')}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {viewDataTab === 'students' && (
              <div>
                <StudentsSection departmentId={departmentId} initialStudents={viewDataRows} />
              </div>
            )}

            {viewDataTab === 'courses' && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{t('Department Courses')}</h3>
                    <p className="text-sm text-gray-500">{t('All courses assigned to your department.')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadDepartmentCourses()}
                    className="inline-flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    {t('Refresh courses')}
                  </button>
                </div>

                {departmentCoursesLoading ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
                    {t('Loading department courses…')}
                  </div>
                ) : departmentCourses.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
                    {t('No courses registered for your department yet.')}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">{t('Course Code')}</th>
                          <th className="px-4 py-3 font-semibold">{t('Course Name')}</th>
                          <th className="px-4 py-3 font-semibold">{t('Action')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {departmentCourses.map((course, index) => {
                          const normalized = normalizeCourseRecord(course);
                          return (
                            <tr key={course.id || `${course.course_code}-${index}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-700">{index + 1}</td>
                              <td className="px-4 py-3 text-gray-700">{normalized.code}</td>
                              <td className="px-4 py-3 text-gray-700">{normalized.name}{isLabCourse(normalized.is_lab) ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{t('Lab Class')}{normalized.section ? ` · ${t('Section')} ${normalized.section}` : ''}</span> : null}</td>
                              <td className="px-4 py-3"><button type="button" onClick={() => editCourse(course)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"><FaEdit aria-hidden="true" />{t('Edit')}</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'assignments':
        return (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-700"><BookOpen size={14} aria-hidden="true" /></span>
                  {t('Department Head')} <ArrowRight size={12} aria-hidden="true" /> {t('Course Assignment Center')}
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('Course Assignment Center')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('Assign instructors to courses and track conflicts from one place.')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
                  <CalendarDays size={15} className="text-blue-600" aria-hidden="true" />
                  <span className="sr-only">{t('Academic year')}</span>
                  <select value={assignmentAcademicYear} onChange={(event) => setAssignmentAcademicYear(event.target.value)} className="max-w-36 bg-transparent font-semibold text-slate-700 outline-none">
                    <option value="all">{t('All Academic Years')}</option>
                    {assignmentAcademicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t('Filter assignments by status')}>
                  {['all', 'active'].map((filter) => <button key={filter} type="button" aria-pressed={assignmentViewFilter === filter} onClick={() => setAssignmentViewFilter(filter)} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${assignmentViewFilter === filter ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>{t(filter)}</button>)}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <Plus size={17} strokeWidth={2.75} aria-hidden="true" />
                  {t('Assign a Course')}
                </button>
              </div>
            </div>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BookOpen size={19} aria-hidden="true" /></span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{t('Assigned Course Log')}</h3>
                    <p className="text-xs text-slate-500">{t('View and manage all course assignments in the department.')}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative min-w-0 sm:w-64">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <span className="sr-only">{t('Search courses, instructors, and sections')}</span>
                    <input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder={t('Search courses, instructors, sections...')} className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    <Filter size={14} className="text-slate-400" aria-hidden="true" />
                    <span className="sr-only">{t('Filter by course')}</span>
                    <select value={assignmentCourseFilter} onChange={(event) => setAssignmentCourseFilter(event.target.value)} className="max-w-36 bg-transparent font-semibold text-slate-700 outline-none">
                      <option value="all">{t('All Courses')}</option>
                      {courses.map((course) => <option key={course.id} value={String(course.id)}>{course.code || course.course_code || course.name || course.course_name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-12 px-4 py-3">#</th>
                      <th className="px-4 py-3">{t('Course')}</th>
                      <th className="px-4 py-3">{t('Instructor')}</th>
                      <th className="px-4 py-3">{t('Section')}</th>
                      <th className="px-4 py-3">{t('Semester')}</th>
                      <th className="px-4 py-3">{t('Status')}</th>
                      <th className="px-4 py-3">{t('Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAssignments.length ? filteredAssignments.map((assignment, index) => {
                      const course = courses.find((item) => String(item.id) === String(assignment.course_id));
                      const instructor = users.find((item) => String(item.id) === String(assignment.instructor_id));
                      const courseCode = course?.code || course?.course_code || assignment.course_code || t('Course');
                      const courseName = course?.name || course?.course_name || assignment.course_name || t('Course details');
                      const instructorName = instructor?.fullName || assignment.instructor_name || `${t('Instructor')} ${assignment.instructor_id || ''}`;
                      const initials = instructorName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'I';
                      const badgeThemes = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-cyan-100 text-cyan-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700'];
                      const badgeTheme = badgeThemes[index % badgeThemes.length];
                      return (
                        <tr key={assignment.id} className="transition hover:bg-blue-50/40">
                          <td className="px-4 py-3 font-semibold text-slate-500">{index + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[9px] font-bold ${badgeTheme}`}>{courseCode}</span>
                              <span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{courseName}</span><span className="block text-[10px] text-slate-400">{assignment.program_type || t('Department course')}</span></span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">{initials || <UserRound size={14} aria-hidden="true" />}</span>
                              <span className="min-w-0"><span className="block truncate font-semibold text-slate-700">{instructorName}</span><span className="block text-[10px] text-slate-400">{t('Instructor')}</span></span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">{assignment.section || '—'}</td>
                          <td className="px-4 py-3 font-medium text-slate-600">{assignment.semester || '—'}</td>
                          <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('Assigned')}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => openAssignmentEditor(assignment)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil size={12} aria-hidden="true" />{t('Edit')}</button>
                              <button type="button" onClick={() => handleDeleteAssignment(assignment.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><Trash2 size={12} aria-hidden="true" />{t('Delete')}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">{displayedAssignments.length ? t('No assignments match the selected filters.') : t('No course assignments have been created for this department yet.')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>{t('Showing')} {filteredAssignments.length ? 1 : 0}–{filteredAssignments.length} {t('of')} {filteredAssignments.length} {t('results')}</span>
                <span>{assignmentAcademicYear === 'all' ? t('All academic years') : `${t('Academic year')} ${assignmentAcademicYear}`}</span>
              </div>
            </section>
          </div>
        );
      case 'publishEvaluation':
        return <PublishEvaluation departmentId={departmentId} />;
      case 'evaluateInstructor':
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('INSTRUCTOR')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('DEADLINE')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('ACTION')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {deptEvalLoading ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-sm text-gray-500">{t('Loading instructors…')}</td>
                    </tr>
                  ) : deptInstructorsList.length ? (
                    deptInstructorsList.map((inst) => (
                      <tr key={inst.instructor_id}>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900"><span className="block">{inst.instructor_name || inst.fullName || inst.username}</span>{isLabAssistantRole(inst.role) && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{t('Lab Assistant (ARA)')}</span>}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><EvaluationDeadlineBadge value={inst} /></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {String((inst.evaluation_status || '').toLowerCase()) === 'submitted' ? (
                            <div className="flex items-center gap-3">
                              <span className="text-green-600 font-medium">✓ {t('Evaluated')} ({inst.total_score}/100)</span>
                              <button
                                type="button"
                                onClick={() => handleViewEvaluation(inst)}
                                className="text-ieps-blue-600 hover:text-ieps-blue-900 font-semibold text-sm underline"
                              >
                                {t('View Details')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEvaluationModal(inst)}
                              className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 font-semibold"
                            >
                              ★ {t('Evaluate')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-sm text-gray-500">{t('No instructors found for your department.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {showDeptEvalModal && selectedDeptInstructor ? (
              <InstructorEvaluationCriteriaModal
                open={showDeptEvalModal}
                onClose={() => {
                  setShowDeptEvalModal(false);
                  setDeptEvalCriteriaScores({});
                }}
                instructorName={selectedDeptInstructor.instructor_name}
                evaluation={selectedDeptInstructor}
                targetRole={selectedDeptInstructor.role}
                criteriaScores={deptEvalCriteriaScores}
                setCriteriaScores={setDeptEvalCriteriaScores}
                onSubmit={handleSubmitDeptEval}
                isSubmitting={deptEvalSubmitting}
                mode="edit"
                evaluatorType={isLabAssistantRole(selectedDeptInstructor.role) ? 'ara_dept_head' : 'dept_head'}
              />
            ) : null}

            {showEvaluationBreakdown && selectedEvaluation ? (
              <EvaluationBreakdownModal
                open={showEvaluationBreakdown}
                onClose={() => {
                  setShowEvaluationBreakdown(false);
                  setSelectedEvaluation(null);
                }}
                instructorName={selectedEvaluation.instructor_name}
                criteriaScores={selectedEvaluation.criteria_scores || {}}
                totalScore={selectedEvaluation.total_score || 0}
                onEdit={handleEditEvaluation}
                submittedDate={selectedEvaluation.created_at || selectedEvaluation.updated_at}
              />
            ) : null}
          </div>
        );
      case 'tracking':
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{t('Evaluation Tracking')}</h2>
                <p className="mt-1 text-sm text-gray-500">{t('Monitor pending and completed evaluation forms.')}</p>
              </div>
              <button type="button" onClick={() => sendEvaluationReminder()} disabled={reminderSending} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {reminderSending && reminderTarget === 'all' ? t('Sending…') : `🔔 ${t('Send Reminder to All Pending')}`}
              </button>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-3">
                {['student', 'peer', 'dept_head'].map((view) => {
                  const label = t(view === 'student' ? 'Student' : view === 'peer' ? 'Peer' : 'Dept Head');
                  const isSelected = trackingView === view;
                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() => { setTrackingView(view); setTrackingMessage(''); }}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${isSelected ? 'bg-ieps-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              {trackingView === 'student' && (
                <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label={t('Filter student evaluations')}>
                  {[{ value: 'all', label: 'All students' }, { value: 'Pending', label: 'Pending only' }].map(({ value, label }) => <button key={value} type="button" aria-pressed={trackingStatusFilter === value} onClick={() => setTrackingStatusFilter(value)} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${trackingStatusFilter === value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t(label)}</button>)}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                {trackingView === 'student' && (
                  <>
                    <label className="space-y-2 text-sm text-gray-700">
                      <span className="font-semibold">{t('Year Level')}</span>
                      <select value={trackingFilters.year_level} onChange={(e) => handleTrackingFilterChange('year_level')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        {['All Years', '1st Year (Freshman)', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'].map((option) => <option key={option} value={option}>{t(option)}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-700">
                      <span className="font-semibold">{t('Section')}</span>
                      <select value={trackingFilters.section} onChange={(e) => handleTrackingFilterChange('section')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        {['All Sections', 'Section A', 'Section B', 'Section C', 'Section D', 'Section E', 'Section F', 'Section G', 'Section H', 'Section I', 'Section J', 'Section K', 'Section L'].map((option) => <option key={option} value={option}>{t(option)}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-700">
                      <span className="font-semibold">{t('Program Type')}</span>
                      <select value={trackingFilters.program_type} onChange={(e) => handleTrackingFilterChange('program_type')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        {['All Programs', 'Regular', 'Extension', 'Summer'].map((option) => <option key={option} value={option}>{t(option)}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                      <span className="font-semibold">{t('Target Instructor')}</span>
                      <select value={trackingFilters.instructor_id} onChange={(e) => handleTrackingFilterChange('instructor_id')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        <option value="">{t('Select Instructor')}</option>
                        {trackingInstructors.map((ins) => <option key={ins.instructor_id || ins.id} value={ins.instructor_id || ins.id}>{ins.instructor_name || ins.full_name || ins.username}</option>)}
                      </select>
                    </label>
                  </>
                )}

                {trackingView === 'peer' && (
                  <>
                    <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                      <span className="font-semibold">{t('Target Instructor')}</span>
                      <select value={peerTrackingInstructor} onChange={(e) => setPeerTrackingInstructor(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        <option value="">{t('Select Instructor')}</option>
                        {departmentStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName || staff.full_name || `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.username}</option>)}
                      </select>
                    </label>
                    <div className="md:col-span-1" />
                  </>
                )}

                {trackingView === 'dept_head' && (
                  <>
                    <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                      <span className="font-semibold">{t('Instructor')}</span>
                      <select value={deptTrackingInstructor} onChange={(e) => setDeptTrackingInstructor(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        <option value="">{t('Select Instructor')}</option>
                        {instructors.map((ins) => <option key={ins.id} value={ins.id}>{ins.fullName}</option>)}
                      </select>
                    </label>
                    <div className="md:col-span-1" />
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-500">{trackingMessage || t('Use filters and click Fetch Data to display evaluation tracking rows.')}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (trackingView === 'student') fetchStudentTracking();
                    if (trackingView === 'peer') fetchPeerTracking();
                    if (trackingView === 'dept_head') fetchDeptHeadTracking();
                  }}
                  className="inline-flex items-center justify-center rounded-2xl bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ieps-blue-700"
                >
                  {trackingLoading ? t('Fetching…') : t('Fetch Data')}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm overflow-x-auto">
              {trackingView === 'student' && (
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">{t('Student')}</th>
                      <th className="px-4 py-3 font-semibold">{t('Status')}</th>
                      <th className="px-4 py-3 font-semibold">{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentTrackingRows.filter((row) => trackingStatusFilter === 'all' || row.status === trackingStatusFilter).length ? studentTrackingRows.filter((row) => trackingStatusFilter === 'all' || row.status === trackingStatusFilter).map((row, index) => (
                      <tr key={`${row.student_db_id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-700">{index + 1}</td>
                        <td className="px-4 py-4 text-gray-700">{row.student_name}</td>
                        <td className="px-4 py-4 font-medium">
                          <span className={row.status === 'Submitted' ? 'text-green-600' : 'text-red-600'}>
                            {row.status === 'Submitted' ? `🟢 ${t('Submitted')}` : `🔴 ${t('Pending')}`}
                          </span>
                        </td>
                        <td className="px-4 py-4">{row.status === 'Submitted' ? <span className="text-xs font-semibold text-gray-400">{t('Done')}</span> : <button type="button" onClick={() => sendEvaluationReminder(row.evaluator_id, 'student', row.student_name)} disabled={reminderSending} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{reminderSending && reminderTarget === String(row.evaluator_id) ? t('Sending…') : `🔔 ${t('Remind')}`}</button>}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-500">{t('No student evaluation tracking results available.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {trackingView === 'peer' && (
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">{t('Peer Instructor')}</th>
                      <th className="px-4 py-3 font-semibold">{t('Status')}</th>
                      <th className="px-4 py-3 font-semibold">{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {peerTrackingRows.length ? peerTrackingRows.map((row, index) => (
                      <tr key={`${row.evaluator_name}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-700">{index + 1}</td>
                        <td className="px-4 py-4 text-gray-700">{row.peer_instructor}</td>
                        <td className="px-4 py-4 font-medium">
                          <span className={row.status === 'Submitted' ? 'text-green-600' : 'text-red-600'}>
                            {row.status === 'Submitted' ? `🟢 ${t('Submitted')}` : `🔴 ${t('Pending')}`}
                          </span>
                        </td>
                        <td className="px-4 py-4">{row.status === 'Submitted' ? <span className="text-xs font-semibold text-gray-400">{t('Done')}</span> : <button type="button" onClick={() => sendEvaluationReminder(row.evaluator_id, 'peer', row.peer_instructor)} disabled={reminderSending} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{reminderSending && reminderTarget === String(row.evaluator_id) ? t('Sending…') : `🔔 ${t('Remind')}`}</button>}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-500">{t('No peer evaluation tracking results available.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {trackingView === 'dept_head' && (
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('Instructor Name')}</th>
                      <th className="px-4 py-3 font-semibold">{t('Department Head Score')}</th>
                      <th className="px-4 py-3 font-semibold">{t('Evaluation Status')}</th>
                      <th className="px-4 py-3 font-semibold">{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deptTrackingRows.length ? deptTrackingRows.map((row, index) => (
                      <tr key={`${row.instructor_id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-700">{row.instructor_name}</td>
                        <td className="px-4 py-4 text-gray-700">{row.score ?? 0} / 100</td>
                        <td className="px-4 py-4">{statusBadge(row.status)}</td>
                        <td className="px-4 py-4">{String(row.status).toLowerCase() === 'submitted' ? <span className="text-xs font-semibold text-gray-400">{t('Done')}</span> : <button type="button" onClick={() => sendEvaluationReminder(row.user_id, 'dept_head', row.instructor_name)} disabled={reminderSending} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{reminderSending ? t('Sending…') : `🔔 ${t('Remind')}`}</button>}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-500">{t('No department head evaluation tracking results available.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        );
      case 'reports':
        return (
          <div id="department-reports" className="space-y-6 print:space-y-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between print:hidden">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t('Department Final Results')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('Calculate and publish the final results for department instructors.')}</p>
              </div>
              <button type="button" onClick={publishFinalResults} disabled={trackingLoading} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {trackingLoading ? t('Publishing…') : t('Calculate & Publish Final Results')}
              </button>
            </div>
            {trackingMessage ? <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 print:hidden">{trackingMessage}</div> : null}
            <ResultCertificateActions title={t('Department Result Certificates')} />
          </div>
        );
      default:
        return <InstructorsSection users={instructors} handleEditUser={handleEditUser} handleDeleteUser={handleDeleteUser} />;
    }
  };

  if (!currentUser || !currentUser.username) {
    return <div className="p-8 text-center text-gray-500">{t('Loading department head profile...')}</div>;
  }

  return (
    <>
    <div className="dept-head-dashboard-container h-full w-full min-w-0 overflow-x-hidden">
      <style>{`
        .dept-head-dashboard-container { width: 100%; height: 100%; min-height: 0; box-sizing: border-box; }
        .dept-head-dashboard-shell { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; gap: 0; }
        .dept-head-sidebar { flex: 0 0 232px; width: 232px; height: 100%; min-width: 0; min-height: 0; overflow-y: auto; transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .dept-head-dashboard-container .main-content { flex: 1; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow-y: auto; box-sizing: border-box; padding: 1.5rem; }
        .overview-card,
        .stats-grid { width: 100%; box-sizing: border-box; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
        .dept-head-dashboard-container .dept-head-sidebar { border: 0; border-radius: 0; background: #38A0DC; box-shadow: none; padding: 0.75rem; color: white; }
        .dept-head-dashboard-container .dept-head-sidebar-header { min-height: 58px; margin: -0.75rem -0.75rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,.15); background: transparent; padding: 0.75rem; color: white; }
        .dept-head-dashboard-container .dept-head-sidebar-link { min-height: 42px; align-items: center; border-radius: 0.5rem; padding: 0.625rem 0.5rem; font-size: 0.875rem; font-weight: 500; line-height: 1.25rem; }
        .dept-head-dashboard-container .dept-head-sidebar-link svg { flex: 0 0 18px; }
        .dept-head-dashboard-container .dept-head-sidebar-link span { min-width: 0; overflow-wrap: normal; word-break: normal; hyphens: none; }
        .dept-head-dashboard-container .dept-head-sidebar-link.is-active { border-color: transparent; background: #2B87BD; color: #ffffff; box-shadow: none; }
        .dept-head-dashboard-container .dept-head-sidebar-link:not(.is-active) { color: #ffffff; }
        .dept-head-dashboard-container .dept-head-sidebar-link:not(.is-active):hover { border-color: transparent; background: rgb(255 255 255 / .1); color: white; }
        .dept-head-dashboard-container .overview-card,
        .dept-head-dashboard-container .main-content [class*="rounded-3xl"] { min-width: 0; border-color: #e2e8f0 !important; border-radius: 1rem !important; background-color: #ffffff; padding: 1.25rem !important; box-shadow: 0 1px 2px rgb(15 23 42 / 0.05) !important; }
        .dept-head-welcome-banner { position: relative; display: flex; min-height: 118px; align-items: center; justify-content: space-between; overflow: hidden; border: 1px solid #dbeafe; border-radius: 1rem; background: linear-gradient(105deg, #e0f2fe 0%, #eaf5ff 57%, #f1f8ff 100%); padding: 1rem 1.5rem; }
        .dept-head-welcome-graphic { width: 38%; min-width: 280px; align-self: stretch; }
        .dept-head-dashboard-container .main-content table { border-collapse: collapse; }
        .dept-head-dashboard-container .main-content th,
        .dept-head-dashboard-container .main-content td { padding: 0.75rem 1rem; }
        .dept-head-dashboard-container .main-content th { border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600; }
        .dept-head-sidebar-backdrop { display: none; }

        @media (max-width: 640px) {
          .dept-head-welcome-banner { min-height: 0; padding: 1.25rem; }
          .dept-head-welcome-graphic { display: none; }
        }

        @media (max-width: 1023px) {
          .dept-head-dashboard-shell { display: block; }
          .dept-head-sidebar { flex-basis: auto; }
          .dept-head-sidebar {
            position: fixed;
            left: 0;
            top: 4rem;
            bottom: 0;
            z-index: 60;
            width: min(280px, 82vw);
            height: auto;
            transform: translateX(-120%);
            border-radius: 0;
            box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18);
            overflow-y: auto;
            min-height: 0;
          }
          .dept-head-sidebar.is-open { transform: translateX(0); }
          .dept-head-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 50;
            border: 0;
            background: rgba(15, 23, 42, 0.35);
            backdrop-filter: blur(2px);
          }
        }
      `}</style>

      {isSidebarOpen && <button type="button" aria-label={t('Close sidebar')} className="dept-head-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      <div className="dept-head-dashboard-shell">
        <aside className={`dept-head-sidebar h-full flex-shrink-0 print:hidden lg:sticky lg:top-0 lg:self-start ${isSidebarOpen ? 'is-open' : ''}`}>
          <div className="dept-head-sidebar-header flex items-center gap-2 rounded-lg">
            <FaShieldAlt className="shrink-0" />
            <h3 className="min-w-0 text-sm font-semibold">{t('Department Head')}</h3>
          </div>
          <div className="space-y-2">
            {sidebarItems.map(({ key, label, icon: Icon }) => {
              const isActive = key === activeTab;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    if (key === 'evaluationSchedule') {
                      navigate('/dept-head/evaluation-schedule');
                      return;
                    }
                    setActiveTab(key);
                  }}
                  className={`dept-head-sidebar-link flex w-full items-center gap-3 border text-left transition ${isActive ? 'is-active' : 'border-transparent'}`}
                >
                  <Icon />
                  <span className="min-w-0 flex-1">{label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="main-content space-y-6">
          {activeTab !== 'overview' && activeTab !== 'publishEvaluation' && (
            <div className="flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
              <h1 className="text-3xl font-bold text-ieps-blue-600">{strings.deptHeadDashboard.title || 'Department Head Dashboard'}</h1>
            </div>
          )}
          {activeTab === 'overview' && (
            <section className="dept-head-welcome-banner mb-5 print:hidden" aria-label={t('Department overview welcome')}>
              <div className="relative z-10 min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-slate-600">{t('Good morning,')}</p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t('Welcome')}, {userFullName}</h1>
                <p className="mt-1 text-xs text-slate-600">{t('Department Head')} <span className="px-1">•</span> {userDepartmentName}</p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-700 px-3 py-1 text-[10px] font-medium text-white shadow-sm">
                  <FaCalendarAlt aria-hidden="true" /> Apr 10, 2026&nbsp;&nbsp; 10:42 AM
                </span>
              </div>
              <div className="dept-head-welcome-graphic relative hidden items-center justify-end gap-3 sm:flex">
                <div className="absolute bottom-0 left-0 text-teal-500/70"><Sprout size={62} strokeWidth={1.6} aria-hidden="true" /></div>
                <div className="relative flex h-20 w-28 items-center justify-center rounded-t-3xl bg-blue-100/70 text-blue-600">
                  <Landmark size={66} strokeWidth={1.35} aria-hidden="true" />
                  <span className="absolute -bottom-1 left-1/2 h-5 w-16 -translate-x-1/2 rounded-t-lg bg-blue-600/90" />
                </div>
                <p className="max-w-28 text-center text-[11px] font-medium leading-4 text-blue-700">
                  {t('Better Evaluation')}
                  <span className="block font-bold">{t('for a Brighter Future')}</span>
                  <span className="mx-auto mt-2 block h-px w-8 bg-blue-300" />
                </p>
              </div>
            </section>
          )}

          {activeTab !== 'reports' ? <>
            {formNotification ? <div className="mt-4 rounded-3xl border border-green-100 bg-green-50 p-4 text-sm text-green-700">{formNotification}</div> : null}

            <DispatchEvaluationModal
              open={showStudentModal}
              onClose={() => setShowStudentModal(false)}
              form={studentEvalForm}
              setForm={setStudentEvalForm}
              colleges={adminData.colleges}
              departments={adminData.departments}
              courses={courses}
              onSaveTemplate={() => { setShowTemplateEditor(true); }}
              onEditTemplate={() => { setShowTemplateEditor(true); }}
              onSend={handleSendStudentEvaluation}
            />

            {showTemplateEditor && (
              <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
                <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowTemplateEditor(false)} />
                <div className="relative w-full max-w-3xl">
                  <EvaluationTemplateBuilder
                    templateId={studentEvalTemplateId}
                    initial={(() => {
                      try {
                        return studentEvalTemplate && studentEvalTemplate.trim() && studentEvalTemplate.trim().startsWith('{') ? JSON.parse(studentEvalTemplate) : null;
                      } catch {
                        return null;
                      }
                    })()}
                    onClose={() => setShowTemplateEditor(false)}
                    onSaved={(newState) => {
                      try {
                        const text = typeof newState === 'string' ? newState : JSON.stringify(newState, null, 2);
                        setStudentEvalTemplate(text);
                      } catch {
                        console.warn('Unable to save template state');
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {showInstructorModal && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{t('Dispatch Peer-to-Peer Evaluation')}</h3>
                    <button type="button" onClick={() => setShowInstructorModal(false)} className="text-gray-500">✕</button>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-gray-600"><span className="mb-1 block font-medium">{t('Evaluating Instructor')}</span>
                      <select value={instructorEvalForm.evaluatorId} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, evaluatorId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <option value="">{t('Select evaluator')}</option>
                        {instructors.map((ins) => <option key={ins.id} value={ins.id}>{ins.fullName}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-gray-600"><span className="mb-1 block font-medium">{t('Target Instructor')}</span>
                      <select value={instructorEvalForm.targetInstructorId} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, targetInstructorId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <option value="">{t('Select target')}</option>
                        {instructors.map((ins) => <option key={ins.id} value={ins.id}>{ins.fullName}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-gray-600 md:col-span-2"><span className="mb-1 block font-medium">{t('Evaluation criteria / notes')}</span>
                      <input value={instructorEvalForm.criteria} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, criteria: e.target.value })} placeholder={t('e.g., teaching quality, feedback, etc.')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-gray-600"><span className="mb-1 block font-medium">Semester</span>
                      <select value={instructorEvalForm.semester} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, semester: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <option value="Semester I">{t('Semester I')}</option>
                        <option value="Semester II">{t('Semester II')}</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowInstructorModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">{t('Cancel')}</button>
                    <button type="button" onClick={handleSendInstructorEvaluation} className="rounded-xl bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white">{t('Send Evaluation')}</button>
                  </div>
                </div>
              </div>
            )}

            {showAssignModal && (
              <CourseAssignmentModal
                courses={courses}
                instructors={assignmentInstructors}
                departmentId={departmentId}
                onClose={() => setShowAssignModal(false)}
                onAssigned={() => {
                  setShowAssignModal(false);
                  void loadDashboardData();
                }}
              />
            )}

            {editingAssignment && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
                <form onSubmit={handleUpdateAssignment} className="w-full max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{t('Edit course assignment')}</h3>
                    <p className="mt-1 text-sm text-slate-500">{t('Update the course, instructor, or student group for this assignment.')}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700">
                      {t('Course')}
                      <select value={assignmentEditDraft.course_id} onChange={(event) => setAssignmentEditDraft((current) => ({ ...current, course_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <option value="">{t('Select course')}</option>
                        {courses.map((course) => <option key={course.id} value={course.id}>{course.code || course.course_code} · {course.name || course.course_name}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      {t('Instructor')}
                      <select value={assignmentEditDraft.instructor_id} onChange={(event) => setAssignmentEditDraft((current) => ({ ...current, instructor_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <option value="">{t('Select instructor')}</option>
                        {assignmentInstructors.map((instructor) => {
                          const instructorId = instructor.instructor_id || instructor.id;
                          return <option key={instructorId} value={instructorId}>{instructor.full_name || instructor.instructor_name || instructor.name || instructor.username}</option>;
                        })}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      {t('Program type')}
                      <select value={assignmentEditDraft.program_type} onChange={(event) => setAssignmentEditDraft((current) => ({ ...current, program_type: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        {programTypeOptions.map((programType) => <option key={programType} value={programType}>{programType}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      {t('Year level')}
                      <select value={assignmentEditDraft.year_level} onChange={(event) => setAssignmentEditDraft((current) => ({ ...current, year_level: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <option value="">{t('Select year level')}</option>
                        {yearLevelOptions.map((yearLevel) => <option key={yearLevel} value={yearLevel}>{yearLevel}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      {t('Semester')}
                      <select value={assignmentEditDraft.semester} onChange={(event) => setAssignmentEditDraft((current) => ({ ...current, semester: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <option value="">{t('Select semester')}</option>
                        <option value="I">I</option>
                        <option value="II">II</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      {t('Section')}
                      <select value={assignmentEditDraft.section} onChange={(event) => setAssignmentEditDraft((current) => ({ ...current, section: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <option value="">{t('Select section')}</option>
                        {'A B C D E F G H I J K L'.split(' ').map((section) => <option key={section} value={section}>{section}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setEditingAssignment(null)} disabled={savingAssignmentEdit} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{t('Cancel')}</button>
                    <button type="submit" disabled={savingAssignmentEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingAssignmentEdit ? t('Saving…') : t('Save changes')}</button>
                  </div>
                </form>
              </div>
            )}

            {false && showAssignModal && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{t('Course Assignment')}</h3>
                      <p className="text-sm text-gray-500">{t('Step')} {assignmentStep} {t('of')} 2</p>
                    </div>
                    <button type="button" onClick={() => { setShowAssignModal(false); setAssignmentStep(1); }} className="text-gray-500">✕</button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {assignmentStep === 1 ? (
                      <>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">{t('Course')}</span>
                          <select value={assignmentDraft.courseId} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, courseId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">{t('Select course')}</option>
                            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} · {c.creditHours}cr</option>)}
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">{t('Instructor')}</span>
                          <select value={assignmentDraft.instructorId} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, instructorId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">{t('Select instructor')}</option>
                            {assignmentInstructors.map((ins) => <option key={ins.id || ins.instructor_id} value={ins.id || ins.instructor_id}>{ins.instructor_name || ins.fullName || ins.name || ins.username || ins.email}</option>)}
                          </select>
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">{t('Program type')}</span>
                          <select value={assignmentDraft.programType} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, programType: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">{t('Select Program Type')}</option>
                            {programTypeOptions.map((type) => <option key={type} value={type}>{t(type)}</option>)}
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">{t('Year level')}</span>
                          <select value={assignmentDraft.yearLevel} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, yearLevel: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">{t('Select Year Level')}</option>
                            {yearLevelOptions.map((level) => <option key={level} value={level}>{t(level)}</option>)}
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">{t('Semester')}</span>
                          <select value={assignmentDraft.semester} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, semester: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">{t('Select semester')}</option>
                            <option value="I">I</option>
                            <option value="II">II</option>
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">{t('Section')}</span>
                          <select value={assignmentDraft.section} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, section: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">{t('Select Section')}</option>
                            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((sec) => (
                              <option key={sec} value={sec}>{sec}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>

                  <div className="mt-5 flex justify-between gap-3">
                    {assignmentStep === 2 ? (
                      <button type="button" onClick={() => setAssignmentStep(1)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">{t('Back')}</button>
                    ) : <div />}
                    {assignmentStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => setAssignmentStep(2)}
                        disabled={!assignmentDraft.courseId || !assignmentDraft.instructorId}
                        className="rounded-xl bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t('Continue')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmAssignment}
                        disabled={!canSubmitAssignment()}
                        className="rounded-xl bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t('Confirm Assignment')}
                      </button>
                    )}
                  </div>

                  <div className="mt-5 text-sm">
                    <p className="font-semibold">{t('Checks')}</p>
                    <div className="mt-2 space-y-1">
                      <div>
                        {assignmentDraft.instructorId && assignmentDraft.courseId ? (
                          (() => {
                            const course = courses.find((c) => String(c.id) === String(assignmentDraft.courseId));
                            const credit = Number(course?.creditHours || 0);
                            const load = getInstructorAssignedCredits(assignmentDraft.instructorId);
                            const ok = load + credit <= MAX_CREDIT_LOAD;
                            return (<div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{ok ? `✅ ${t('Load available')}` : `❌ ${t('Exceeds Max Credit Load Limit')}`}</div>);
                          })()
                        ) : <div className="text-gray-500">{t('Select course & instructor to run checks')}</div>}
                      </div>
                      <div>
                        {assignmentDraft.instructorId && assignmentDraft.courseId ? (
                          (() => checkQualification(assignmentDraft.instructorId, assignmentDraft.courseId) ? <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm bg-amber-50 text-amber-700">⚠️ {t('Qualification warning only')}</div> : <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm bg-red-50 text-red-700">❌ {t('Qualification / Field mismatch')}</div>)()
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAssignModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">{t('Cancel')}</button>
                  </div>
                </div>
              </div>
            )}

            {showPublishModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                  <h3 className="border-b border-gray-200 pb-2 text-lg font-bold text-gray-900">{t('Confirm & Publish')}</h3>
                  <p className="mt-3 text-xs text-gray-500">{t('Select who should receive notification and visibility for this course assignment.')}</p>
                  <div className="mt-5 space-y-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:bg-sky-50/50">
                      <input type="radio" name="publishTarget" value="both" checked={publishTarget === 'both'} onChange={(e) => setPublishTarget(e.target.value)} className="text-sky-600 focus:ring-sky-500" />
                      <span className="text-sm font-semibold text-gray-800">{t('Publish to Both (Student & Instructor)')}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:bg-sky-50/50">
                      <input type="radio" name="publishTarget" value="student" checked={publishTarget === 'student'} onChange={(e) => setPublishTarget(e.target.value)} className="text-sky-600 focus:ring-sky-500" />
                      <span className="text-sm font-semibold text-gray-800">{t('Publish to Student Only')}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:bg-sky-50/50">
                      <input type="radio" name="publishTarget" value="instructor" checked={publishTarget === 'instructor'} onChange={(e) => setPublishTarget(e.target.value)} className="text-sky-600 focus:ring-sky-500" />
                      <span className="text-sm font-semibold text-gray-800">{t('Publish to Instructor Only')}</span>
                    </label>
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3 pt-2">
                    <button type="button" onClick={() => setShowPublishModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">{t('Back')}</button>
                    <button type="button" onClick={handleFinalPublishSubmit} className="rounded-xl bg-sky-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-sky-950">{t('Confirm')}</button>
                  </div>
                </div>
              </div>
            )}
          </> : null}

          {loadingData ? <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">{t('Syncing dashboard data from the API…')}</div> : renderContent()}
          <PeerEvaluationModal
            open={showPeerEvaluationModal}
            onClose={() => {
              setShowPeerEvaluationModal(false);
              setSelectedPeerTarget(null);
              setPeerEvaluationMode('create');
            }}
            evaluation={selectedPeerTarget || {}}
            sections={standardPeerEvaluationSections}
            mode={peerEvaluationMode}
            evaluationRecord={peerEvaluationMode === 'edit' ? selectedPeerTarget : null}
            onSubmit={async (payload) => {
              setPeerEvaluationSubmitting(true);
              setPeerEvaluationError('');
              try {
                await evaluationApi.submitPeerEvaluationForm(payload);
                setPeerTargets((current) => current.map((target) => (
                  target.id === payload.peer_evaluation_id
                    ? { ...target, status: 'completed', is_evaluated: true, total_score: Number(payload.score) || 0 }
                    : target
                )));
                setShowPeerEvaluationModal(false);
                setSelectedPeerTarget(null);
                setPeerEvaluationMode('create');
                window.dispatchEvent(new CustomEvent(SUBMISSIONS_UPDATED_EVENT, { detail: { type: 'peer-submission' } }));
              } catch (error) {
                setPeerEvaluationError(error?.message || 'Unable to submit peer evaluation.');
                throw error;
              } finally {
                setPeerEvaluationSubmitting(false);
              }
            }}
            isSubmitting={peerEvaluationSubmitting}
            errorMessage={peerEvaluationError}
          />
        </main>
      </div>
    </div>
    {confirmationDialog}
    </>
  );
};

export default DeptHeadDashboard;
