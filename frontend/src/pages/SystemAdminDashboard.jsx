import { useState, useContext, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  ClipboardList,
  RefreshCw,
  Activity,
  Megaphone,
  Database,
  Search,
  UserPlus,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  CalendarDays,
  ShieldAlert,
  Building2,
  Users,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  FlaskConical,
  Landmark,
  Network,
  Clock3,
  LockKeyhole,
  LogIn,
  Settings2,
  UserRoundPlus,
  FileSpreadsheet,
  Upload,
  RotateCcw,
  Tag,
  CircleCheck,
} from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { adminApi, authApi, criteriaApi, departmentApi, registrationApi, studentApi, DASHBOARD_DATA_UPDATED_EVENT } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import EvaluationCalendar from '../components/EvaluationCalendar';
import ViewDataView from '../components/ViewDataView';
import ManageRoles from '../components/ManageRoles';
import DepartmentRegistration from '../components/DepartmentRegistration';
import DashboardBanner from '../components/DashboardBanner';
import BroadcastManager from '../components/BroadcastManager';
import { DashboardSidebarContext } from '../context/DashboardSidebarContext';
import { useConfirmation } from '../components/ConfirmationDialog';
import { useUiText } from '../hooks/useUiText';
import { isValidUniversityUsername } from '../utils/inputValidation';

const NAME_PATTERN = /^[\p{L} ]+$/u;
const PHONE_PATTERN = /^(09|07)\d{8}$/;
const PHONE_ERROR = 'Phone number must contain only numbers and be exactly 10 digits starting with 09 or 07.';

const validateRegistrationField = (field, value) => {
  const rawValue = String(value ?? '');
  const normalized = field === 'username' ? rawValue : rawValue.trim();
  if (['firstName', 'lastName'].includes(field)) {
    if (!normalized) return 'This field is required.';
    if (normalized.length < 3 || !NAME_PATTERN.test(normalized)) {
      return 'Name must contain only letters and be at least 3 characters.';
    }
  } else if (field === 'username') {
    if (!normalized) return 'This field is required.';
    if (!isValidUniversityUsername(normalized)) {
      return "Username must start with 'mau' followed by numbers (e.g., mau1600548).";
    }
  } else if (field === 'phoneNumber') {
    if (!normalized) return 'This field is required.';
    if (!PHONE_PATTERN.test(normalized)) {
      return PHONE_ERROR;
    }
  } else if (!normalized) {
    return 'This field is required.';
  }
  return '';
};

const fetchAuditTimelineEntries = async () => {
  const rows = await adminApi.getAuditLogs();
  return (Array.isArray(rows) ? rows : []).map((entry) => {
    const createdAt = entry.created_at ? new Date(entry.created_at) : null;
    return {
      id: entry.id,
      action: entry.action_title || entry.action || 'SYSTEM_EVENT',
      desc: entry.description || entry.action || 'No description provided',
      user: entry.performed_by || (entry.user_id ? `user:${entry.user_id}` : 'System'),
      ip: entry.ip_address || 'N/A',
      userAgent: entry.user_agent || '',
      deviceId: entry.device_id || 'Not available',
      location: entry.location || entry.location_name || entry.geo_location || 'Location unavailable',
      networkInterface: entry.network_interface_name || 'Not available',
      networkMac: entry.network_interface_mac || 'Not available',
      time: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '--',
    };
  });
};

const initialCollegeData = [
  {
    id: 'college-1',
    en: 'College of Science',
    am: 'የሳይንስ ኮሌጅ',
    departments: [
      { id: 'dept-1-1', en: 'Computer Science', am: 'ኮምፒውተር ሳይንስ' },
      { id: 'dept-1-2', en: 'Mathematics', am: 'ሂሳብ' },
      { id: 'dept-1-3', en: 'Physics', am: 'ፊዚክስ' },
    ],
  },
  {
    id: 'college-2',
    en: 'College of Business',
    am: 'የንግድ ኮሌጅ',
    departments: [
      { id: 'dept-2-1', en: 'Accounting', am: 'አካውንቲንግ' },
      { id: 'dept-2-2', en: 'Marketing', am: 'ማርኬቲንግ' },
      { id: 'dept-2-3', en: 'Finance', am: 'ፋይናንስ' },
    ],
  },
];

const departmentHeadDepartmentOptions = [
  { id: 'dept-eng-civil', name: 'Department of Civil Engineering', category: 'Engineering' },
  { id: 'dept-eng-electrical', name: 'Department of Electrical Engineering', category: 'Engineering' },
  { id: 'dept-eng-mechanical', name: 'Department of Mechanical Engineering', category: 'Engineering' },
  { id: 'dept-eng-chemical', name: 'Department of Chemical Engineering', category: 'Engineering' },
  { id: 'dept-eng-software', name: 'Department of Software Engineering', category: 'Engineering' },
  { id: 'dept-eng-computer', name: 'Department of Computer Engineering', category: 'Engineering' },
  { id: 'dept-tech-ict', name: 'Department of Information and Communication Technology', category: 'Technology' },
  { id: 'dept-tech-electronics', name: 'Department of Electronics and Communication Technology', category: 'Technology' },
  { id: 'dept-tech-robotics', name: 'Department of Robotics and Automation', category: 'Technology' },
  { id: 'dept-tech-architecture', name: 'Department of Architecture and Urban Planning', category: 'Technology' },
  { id: 'dept-tech-industrial', name: 'Department of Industrial Technology', category: 'Technology' },
  { id: 'dept-tech-networking', name: 'Department of Computer Networking', category: 'Technology' },
  { id: 'dept-health-medicine', name: 'Department of Medicine', category: 'Health Sciences' },
  { id: 'dept-health-nursing', name: 'Department of Nursing', category: 'Health Sciences' },
  { id: 'dept-health-pharmacy', name: 'Department of Pharmacy', category: 'Health Sciences' },
  { id: 'dept-health-public', name: 'Department of Public Health', category: 'Health Sciences' },
  { id: 'dept-health-radiology', name: 'Department of Radiology', category: 'Health Sciences' },
  { id: 'dept-health-lab', name: 'Department of Medical Laboratory Science', category: 'Health Sciences' },
  { id: 'dept-biz-accounting', name: 'Department of Accounting', category: 'Business' },
  { id: 'dept-biz-finance', name: 'Department of Finance', category: 'Business' },
  { id: 'dept-biz-marketing', name: 'Department of Marketing', category: 'Business' },
  { id: 'dept-biz-management', name: 'Department of Business Management', category: 'Business' },
  { id: 'dept-biz-economics', name: 'Department of Economics', category: 'Business' },
  { id: 'dept-biz-logistics', name: 'Department of Logistics and Supply Chain', category: 'Business' },
  { id: 'dept-humanities-history', name: 'Department of History', category: 'Humanities' },
  { id: 'dept-humanities-linguistics', name: 'Department of Linguistics', category: 'Humanities' },
  { id: 'dept-humanities-literature', name: 'Department of Literature', category: 'Humanities' },
  { id: 'dept-humanities-philosophy', name: 'Department of Philosophy', category: 'Humanities' },
  { id: 'dept-humanities-sociology', name: 'Department of Sociology', category: 'Humanities' },
  { id: 'dept-humanities-psychology', name: 'Department of Psychology', category: 'Humanities' },
  { id: 'dept-humanities-education', name: 'Department of Education', category: 'Humanities' },
  { id: 'dept-humanities-communication', name: 'Department of Communication and Media', category: 'Humanities' },
];

const initialDeptHeads = [
  {
    id: 1,
    role: 'dept_head',
    fullName: 'Dr. Meskerem Alem',
    username: 'meskerem.alem',
    college: 'college-1',
    department: 'dept-1-1',
    year: '2',
    semester: 'i',
    program: 'regular',
    academicYear: '2025',
    academicDate: '2025-05-15',
    status: 'Active',
    accessScore: 92,
  },
  {
    id: 2,
    role: 'dept_head',
    fullName: 'Prof. Dawit Bekele',
    username: 'dawit.bekele',
    college: 'college-2',
    department: 'dept-2-3',
    year: '3',
    semester: 'ii',
    program: 'extension',
    academicYear: '2024',
    academicDate: '2024-11-20',
    status: 'Active',
    accessScore: 88,
  },
];

const initialInstructors = [
  {
    id: 101,
    role: 'instructor',
    fullName: 'Mr. Samuel Tesfaye',
    username: 'samuel.tesfaye',
    phoneNumber: '0910000001',
    department: 'dept-eng-software',
    programType: 'regular',
    academicDate: '2025-06-01',
    status: 'Active',
  },
];

const initialStudents = [
  {
    id: 201,
    role: 'student',
    fullName: 'Bethel Bekele',
    username: 'bethel.bekele',
    studentId: 'STU-1001',
    department: 'dept-eng-software',
    programType: 'regular',
    semester: 'i',
    year: '2nd Year',
    section: 'A',
    academicDate: '2025-06-02',
    status: 'Active',
  },
];

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const SystemAdminDashboard = () => {
  const { sidebarOpen: isSidebarOpen, setSidebarOpen: setIsSidebarOpen } = useContext(DashboardSidebarContext);
  const { language, strings } = useContext(LanguageContext);
  const { role, isAuthenticated, registerUser } = useAuth();
  const navigate = useNavigate();
  const sys = strings.systemAdminDashboard;
  const common = strings.common;
  const ui = useUiText();

  const t = (key, fallbackEn, fallbackAm) => {
    const value = strings.systemAdminDashboard?.[key];
    if (value) return value;
    return language === 'en' ? fallbackEn : fallbackAm;
  };

  const [activeTab, setActiveTab] = useState('overview');
  const [contactInfo, setContactInfo] = useState({
    name: '', email: '', phone: '', location: '', poBox: '', officeDays: '',
    officeHours: '', institution: '', region: '', landmark: '', mapQuery: '',
  });
  const [contactInfoLoading, setContactInfoLoading] = useState(false);
  const [contactInfoSaving, setContactInfoSaving] = useState(false);
  const [dbHealthMetrics, setDbHealthMetrics] = useState({
    status: '--',
    replicationLag: '--',
    connections: '--',
    cacheHitRate: '--',
    diskUsage: '--',
    lastBackup: '--',
    securityScore: '--',
  });
  const [backupRetentionDays, setBackupRetentionDays] = useState(7);
  const [deptHeads, setDeptHeads] = useState(initialDeptHeads);
  const [instructors, setInstructors] = useState(initialInstructors);
  const [viewDataStaff, setViewDataStaff] = useState(initialInstructors);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [viewDataInitialTab, setViewDataInitialTab] = useState('instructors');
  const [viewDataInitialQuery, setViewDataInitialQuery] = useState('');
  const [students, setStudents] = useState(initialStudents);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [apiTokenVisible, setApiTokenVisible] = useState(false);
  const [apiTokenLoading, setApiTokenLoading] = useState(true);
  const [systemActive, setSystemActive] = useState(true);
  const fileInputRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [auditTimelineLogs, setAuditTimelineLogs] = useState([]);
  const [auditTimelineLoading, setAuditTimelineLoading] = useState(true);
  const [auditTimelineRefreshKey, setAuditTimelineRefreshKey] = useState(0);
  const [selectedHead, setSelectedHead] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showForceResetModal, setShowForceResetModal] = useState(false);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null);
  const [registrationMode, setRegistrationMode] = useState(null);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [isExportingRegisteredData, setIsExportingRegisteredData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [deptHeadTransferMode, setDeptHeadTransferMode] = useState(false);
  const [headEditTransferMode, setHeadEditTransferMode] = useState(false);
  const [departmentCourseTab, setDepartmentCourseTab] = useState('college');
  const [collegeNameInput, setCollegeNameInput] = useState('');
  const [collegeCodeInput, setCollegeCodeInput] = useState('');
  const [collegeReloadKey, setCollegeReloadKey] = useState(0);
  const [registeredColleges, setRegisteredColleges] = useState([]);
  const [isCollegesLoading, setIsCollegesLoading] = useState(true);
  const [collegeLastUpdated, setCollegeLastUpdated] = useState(null);
  const [registeredDepartments, setRegisteredDepartments] = useState([]);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(true);
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [dashboardStatsError, setDashboardStatsError] = useState('');
  const [criteriaType, setCriteriaType] = useState('student');
  const [criteriaTargetRole, setCriteriaTargetRole] = useState('instructor');
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [criteriaForm, setCriteriaForm] = useState({ criterion_text: '', criterion_text_am: '', category: 'General', weight: 5 });
  const [editingCriterionId, setEditingCriterionId] = useState(null);
  const [showCriterionForm, setShowCriterionForm] = useState(false);

  const handleSystemMaintenanceToggle = async () => {
    try {
      const nextState = !systemActive;
      const response = await adminApi.setSystemMaintenance(nextState);
      setSystemActive(Boolean(response?.systemActive ?? nextState));
      toast.success(nextState ? ui('System access enabled.') : ui('System access disabled for maintenance.'));
    } catch (error) {
      toast.error(error?.message || ui('Unable to update system access.'));
    }
  };

  const saveContactInfo = async (event) => {
    event.preventDefault();
    setContactInfoSaving(true);
    try {
      const savedContact = await adminApi.updateContactInfo(contactInfo);
      setContactInfo(savedContact);
      window.dispatchEvent(new CustomEvent('ipes-contact-info-updated', { detail: savedContact }));
      toast.success(ui('Contact information updated.'));
    } catch (error) {
      toast.error(error?.message || ui('Unable to update contact information.'));
    } finally {
      setContactInfoSaving(false);
    }
  };

  const normalizeBackendUser = (user) => ({
    id: user.id,
    role: String(user.role || '').toLowerCase(),
    fullName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username,
    phoneNumber: user.phone_number || user.phoneNumber || '',
    gender: user.gender || '',
    studentId: user.student_id || user.studentId || '',
    department: user.department || user.department_id || '',
    departmentId: user.department_id || user.departmentId || user.department || '',
    departmentName: user.department_name || user.departmentName || '',
    programType: user.program_type || user.programType || '',
    semester: user.semester || '',
    year: user.year || user.year_level || '',
    section: user.section || '',
    academicDate: user.registration_date || user.academicDate || '',
    status: user.status || 'Active',
  });

  const departmentSelectionOptions = useMemo(() => {
    const defaultIds = new Set(departmentHeadDepartmentOptions.map((dept) => dept.id));
    return [
      ...departmentHeadDepartmentOptions,
      ...registeredDepartments.filter((dept) => dept.id && !defaultIds.has(dept.id)),
    ];
  }, [registeredDepartments]);

  const groupedDepartmentOptions = useMemo(() => {
    const groups = new Map();
    registeredDepartments.forEach((department) => {
      const groupKey = department.collegeId || department.category || 'uncategorized';
      const groupName = department.collegeName || department.category || 'Other Departments';
      if (!groups.has(groupKey)) groups.set(groupKey, { id: String(groupKey), name: groupName, departments: [] });
      groups.get(groupKey).departments.push(department);
    });
    return Array.from(groups.values());
  }, [registeredDepartments]);

  const getDepartmentName = (departmentId) => departmentSelectionOptions.find((dept) => dept.id === departmentId)?.name
    || initialCollegeData.flatMap((college) => college.departments).find((dept) => dept.id === departmentId)?.en
    || departmentId;

  const [instructorForm, setInstructorForm] = useState(() => ({
    firstName: '',
    lastName: '',
    gender: '',
    username: '',
    role: 'instructor',
    phoneNumber: '',
    department: '',
  }));

  const [studentForm, setStudentForm] = useState(() => ({
    firstName: '',
    lastName: '',
    gender: '',
    username: '',
    phoneNumber: '',
    department: '',
    programType: 'regular',
    academicYear: '2024',
    semester: 'i',
    year: '1st Year (Freshman)',
    section: 'A',
  }));
  const [registrationErrors, setRegistrationErrors] = useState({});

  const getRegistrationErrors = (form, mode) => {
    const requiredFields = mode === 'student'
      ? ['firstName', 'lastName', 'gender', 'username', 'phoneNumber', 'department', 'programType', 'year', 'semester', 'section']
      : ['firstName', 'lastName', 'gender', 'username', 'phoneNumber', 'department'];
    return Object.fromEntries(
      requiredFields
        .map((field) => [field, validateRegistrationField(field, form[field])])
        .filter(([, message]) => message),
    );
  };

  const updateRegistrationField = (setForm, field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'phoneNumber' || Object.hasOwn(registrationErrors, field)) {
      setRegistrationErrors((current) => ({
        ...current,
        [field]: validateRegistrationField(field, value),
      }));
    }
  };

  const registrationInputClass = (field) => `mt-2 w-full rounded-lg border ${
    registrationErrors[field] ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
  } p-3 text-slate-900 outline-none focus:border-blue-500`;

  const renderRegistrationError = (field) => registrationErrors[field] && (
    <span className="mt-1 block text-sm text-red-600" role="alert">{ui(registrationErrors[field])}</span>
  );

  const handleCollegeRegistrationSubmit = async (event) => {
    event.preventDefault();
    const name = collegeNameInput.trim();
    const code = collegeCodeInput.trim();
    if (!name || !code) {
      toast.error(ui('Please enter the college name and college code.'));
      return;
    }

    try {
      await adminApi.createCollege({ name, code });
      setCollegeReloadKey((current) => current + 1);
      setCollegeNameInput('');
      setCollegeCodeInput('');
      toast.success(ui('College registered successfully.'));
    } catch (error) {
      toast.error(error?.message || ui('Unable to register college.'));
    }
  };

  const resetCollegeForm = () => {
    setCollegeNameInput('');
    setCollegeCodeInput('');
  };

  const semesterOptions = [
    { value: 'i', en: 'I', am: 'I' },
    { value: 'ii', en: 'II', am: 'II' },
  ];
  const programOptions = [
    { value: 'regular', en: 'Regular', am: 'ብዙ ነገር' },
    { value: 'extension', en: 'Extension', am: 'እርስ በርስ' },
  ];
  const studentYearOptions = ['1st Year (Freshman)', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'];
  const sectionOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const findCollegeById = (id) => initialCollegeData.find((college) => college.id === id);
  const getDepartmentsForCollege = (collegeId) => findCollegeById(collegeId)?.departments || [];

  useEffect(() => {
    if (!isAuthenticated || (role !== 'admin' && role !== 'systemadmin')) {
      navigate('/login');
    }
  }, [isAuthenticated, role, navigate]);

  useEffect(() => {
    if (activeTab !== 'contact-info') return undefined;
    let isMounted = true;
    setContactInfoLoading(true);
    adminApi.getContactInfo()
      .then((settings) => { if (isMounted) setContactInfo(settings); })
      .catch((error) => { if (isMounted) toast.error(error?.message || ui('Unable to load contact information.')); })
      .finally(() => { if (isMounted) setContactInfoLoading(false); });
    return () => { isMounted = false; };
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardStats = async (showLoading = false) => {
      if (showLoading) setDashboardStatsLoading(true);
      setDashboardStatsError('');
      try {
        const stats = await adminApi.getDashboardStats();
        if (isMounted) setDashboardStats(stats || {});
      } catch (error) {
        console.warn('Unable to load admin dashboard statistics:', error);
        if (isMounted) {
          setDashboardStats(null);
          setDashboardStatsError(error?.message || 'Unable to load live dashboard metrics.');
        }
      } finally {
        if (isMounted && showLoading) setDashboardStatsLoading(false);
      }
    };

    if (isAuthenticated && (role === 'admin' || role === 'systemadmin')) {
      void loadDashboardStats(true);
    }

    const refreshDashboardStats = () => { void loadDashboardStats(); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshDashboardStats();
    };
    const intervalId = window.setInterval(refreshDashboardStats, 30000);
    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshDashboardStats);
    window.addEventListener('focus', refreshDashboardStats);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshDashboardStats);
      window.removeEventListener('focus', refreshDashboardStats);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [isAuthenticated, role]);

  useEffect(() => {
    if (!isAuthenticated || (role !== 'admin' && role !== 'systemadmin')) {
      setAuditTimelineLoading(false);
      return undefined;
    }

    let isMounted = true;
    const loadAuditTimeline = async () => {
      try {
        const entries = await fetchAuditTimelineEntries();
        if (isMounted) setAuditTimelineLogs(entries);
      } catch (error) {
        console.warn('Unable to load audit timeline:', error);
      } finally {
        if (isMounted) setAuditTimelineLoading(false);
      }
    };

    setAuditTimelineLoading(true);
    void loadAuditTimeline();
    const interval = window.setInterval(() => void loadAuditTimeline(), 10000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [isAuthenticated, role, auditTimelineRefreshKey]);

  useEffect(() => {
    let isMounted = true;

    const loadSecurityLogs = async () => {
      try {
        const [result, posture, tokenResult, health] = await Promise.all([
          adminApi.getSecurityLogs(),
          adminApi.getSecurityScore(),
          adminApi.getApiToken(),
          adminApi.getDatabaseHealth(),
        ]);
        if (!isMounted) return;

        const database = result?.database || {};
        setLogs(Array.isArray(result?.logs) ? result.logs : []);
        setSystemActive(Boolean(database.systemActive ?? true));
        setDbHealthMetrics((current) => ({
          ...current,
          status: database.status || current.status || 'Offline',
          connections: database.connections ?? current.connections ?? '--',
          lastBackup: database.lastBackup || current.lastBackup || '--',
          backupRetentionDays: database.backupRetentionDays ?? current.backupRetentionDays ?? 7,
          securityScore: database.securityScore ?? current.securityScore ?? '--',
          apiToken: database.apiToken || current.apiToken || '--',
          replicationLag: health?.replicationLag ?? current.replicationLag ?? 0,
          cacheHitRate: health?.cacheHitRate ?? current.cacheHitRate ?? 0,
          diskUsage: health?.diskUsage ?? current.diskUsage ?? 'Available',
        }));
        setApiToken(tokenResult?.token || '');
        setApiTokenLoading(false);
        setDbHealthMetrics((current) => ({ ...current, securityScore: `${posture?.score ?? database.securityScore ?? 0}/100`, status: health?.status || current.status }));
        if (Number.isFinite(Number(database.backupRetentionDays)) && Number(database.backupRetentionDays) >= 7) {
          setBackupRetentionDays(Number(database.backupRetentionDays));
        }
        if (database.apiToken) setApiToken(database.apiToken);
      } catch (error) {
        console.warn('Unable to load security logs:', error);
        if (isMounted) {
          setLogs([]);
          setSystemActive(true);
          setDbHealthMetrics((current) => ({
            ...current,
            status: 'Offline',
            connections: '--',
            lastBackup: '--',
            securityScore: '--',
            apiToken: '--',
          }));
          setApiTokenLoading(false);
        }
      }
    };

    if (isAuthenticated && (role === 'admin' || role === 'systemadmin')) {
      void loadSecurityLogs();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, role]);

  useEffect(() => {
    let isMounted = true;
    const loadColleges = async () => {
      setIsCollegesLoading(true);
      try {
        const colleges = await adminApi.getColleges();
        if (!isMounted) return;
        setRegisteredColleges(Array.isArray(colleges) ? colleges : []);
        setCollegeLastUpdated(new Date());
      } catch (error) {
        if (isMounted) {
          toast.error(error?.message || ui('Unable to load registered colleges.'));
        }
      } finally {
        if (isMounted) setIsCollegesLoading(false);
      }
    };

    void loadColleges();
    return () => { isMounted = false; };
  }, [collegeReloadKey]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const departments = await departmentApi.getAll();
        let departmentRecords = [];

        if (Array.isArray(departments) && departments.length) {
          departmentRecords = departments.map((department) => ({
            id: department.id,
            name: department.name,
            code: department.code,
            collegeId: department.college_id || department.collegeId || 'uncategorized',
            collegeName: department.college_name || department.collegeName || 'Other Departments',
            registeredAt: new Date().toLocaleString(),
          }));
        } else {
          departmentRecords = [];
        }

        setRegisteredDepartments(departmentRecords);
      } catch (error) {
        console.warn('Unable to load persisted departments.', error);
        setRegisteredDepartments([]);
      } finally {
        setIsDepartmentsLoading(false);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (activeTab !== 'criteria') return;
    criteriaApi.getAll(criteriaType).then(setCriteriaRows).catch((error) => toast.error(error.message || ui('Unable to load criteria.')));
  }, [activeTab, criteriaType]);

  const resetCriterionForm = () => {
    setEditingCriterionId(null);
    setShowCriterionForm(false);
    setCriteriaForm({ criterion_text: '', criterion_text_am: '', category: 'General', weight: 5 });
  };

  const criteriaTargetForType = (type) => String(type || '').startsWith('ara_') ? 'lab_assistant' : 'instructor';
  const filteredCriteriaRows = criteriaRows.filter((criterion) => {
    const targetRole = criterion.target_role || criteriaTargetForType(criterion.evaluator_type);
    return targetRole === criteriaTargetRole && ['student', 'peer', 'dept_head', 'ara_student', 'ara_peer', 'ara_dept_head'].includes(criterion.evaluator_type);
  });
  const evaluatorOptions = criteriaTargetRole === 'lab_assistant'
    ? [['ara_student', 'Student'], ['ara_peer', 'Peer / Instructor'], ['ara_dept_head', 'Department Head']]
    : [['student', 'Student'], ['peer', 'Peer / Instructor'], ['dept_head', 'Department Head']];

  const saveCriterion = async (event) => {
    event.preventDefault();
    try {
      if (editingCriterionId) {
        await criteriaApi.update(editingCriterionId, { ...criteriaForm, target_role: criteriaTargetRole });
      } else {
        await criteriaApi.create({ ...criteriaForm, evaluator_type: criteriaType, target_role: criteriaTargetRole });
      }
      resetCriterionForm();
      setCriteriaRows(await criteriaApi.getAll(criteriaType));
      toast.success(editingCriterionId ? ui('Criterion updated successfully.') : ui('Criterion added successfully.'));
    } catch (error) {
      toast.error(error.message || ui('Unable to save criterion.'));
    }
  };

  const toggleCriterion = async (criterion) => {
    const nextActive = !Boolean(criterion.is_active);
    try {
      if (nextActive) await criteriaApi.update(criterion.id, { is_active: true });
      else await criteriaApi.remove(criterion.id);
      setCriteriaRows((current) => current.map((row) => row.id === criterion.id ? { ...row, is_active: nextActive ? 1 : 0 } : row));
      toast.success(nextActive ? ui('Criterion enabled.') : ui('Criterion disabled.'));
    } catch (error) {
      toast.error(error.message || ui('Unable to disable criterion.'));
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await registrationApi.getUsers();
        const normalizedAccounts = (Array.isArray(allUsers) ? allUsers : []).map(normalizeBackendUser);
        setRegisteredUsers(normalizedAccounts.filter((user) => String(user.status).toLowerCase() === 'active'));
        try {
          const staffUsers = await registrationApi.getInstructorStaff();
          const staffRecords = Array.isArray(staffUsers) ? staffUsers.map(normalizeBackendUser) : [];
          setViewDataStaff(staffRecords.length ? staffRecords : initialInstructors);
        } catch (staffError) {
          console.warn('Unable to load Admin View Data staff list:', staffError);
          setViewDataStaff((Array.isArray(allUsers) ? allUsers : [])
            .map(normalizeBackendUser)
            .filter((user) => ['instructor', 'academic_directorate', 'academic_director', 'directorate', 'college_dean', 'dean', 'dept_head', 'department_head', 'lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(user.role)));
        }
        if (Array.isArray(allUsers) && allUsers.length) {
          const deptHeadRecords = [];
          const instructorRecords = [];
          const studentRecords = [];

          allUsers.forEach((user) => {
            const normalized = normalizeBackendUser(user);
            if (normalized.role === 'dept_head') {
              deptHeadRecords.push({ ...normalized, accessScore: normalized.accessScore || 90 });
            } else if (normalized.role === 'instructor') {
              instructorRecords.push(normalized);
            } else if (normalized.role === 'student') {
              studentRecords.push(normalized);
            }
          });

          if (deptHeadRecords.length) setDeptHeads(deptHeadRecords);
          if (instructorRecords.length) setInstructors(instructorRecords);
          if (studentRecords.length) setStudents(studentRecords);
        }
      } catch (error) {
        console.warn('Unable to load admin user lists:', error);
      }
    };

    void loadUsers();
  }, []);

  const handleUserDeleted = (userId) => {
    const keepOtherUsers = (current) => current.filter((user) => user.id !== userId);
    setRegisteredUsers(keepOtherUsers);
    setViewDataStaff(keepOtherUsers);
    setInstructors(keepOtherUsers);
    setStudents(keepOtherUsers);
    setDeptHeads(keepOtherUsers);
  };

  const handleSaveEdit = async (updatedHead) => {
    if (!updatedHead || !updatedHead.id) {
      toast.error(ui('Invalid user selected.'));
      return;
    }

    const departmentValue = updatedHead.department || departmentSelectionOptions[0]?.id || departmentHeadDepartmentOptions[0].id;
    const existingDepartmentHead = deptHeads.find((head) => head.department === departmentValue && head.id !== updatedHead.id && head.status !== 'Inactive' && head.status !== 'Reassigned');

    if (updatedHead.role === 'dept_head' && existingDepartmentHead && !headEditTransferMode) {
      toast.error(ui('Department Head already exists for this department. Please update or reassign the existing Department Head.'));
      return;
    }

    const payload = {
      full_name: updatedHead.fullName,
      username: updatedHead.username,
      department: departmentValue,
      department_name: getDepartmentName(departmentValue) || updatedHead.departmentName || null,
      registration_date: updatedHead.academicDate || null,
      status: updatedHead.status || 'Active',
    };

    try {
      await registrationApi.updateUser(updatedHead.id, payload);
      const updatedRecord = { ...updatedHead, department: departmentValue, departmentName: payload.department_name };

      setDeptHeads((current) => current.map((head) => (head.id === updatedHead.id ? updatedRecord : head)));
      setInstructors((current) => current.map((instructor) => (instructor.id === updatedHead.id ? updatedRecord : instructor)));
      setStudents((current) => current.map((student) => (student.id === updatedHead.id ? updatedRecord : student)));

      if (existingDepartmentHead && headEditTransferMode) {
        setDeptHeads((current) => current.map((head) => {
          if (head.id === existingDepartmentHead.id) {
            return { ...head, department: '', status: 'Reassigned' };
          }
          return head;
        }));
      }

      setShowEditModal(false);
      setSelectedHead(null);
      setHeadEditTransferMode(false);
      toast.success(ui('User updated successfully.'));
    } catch (error) {
      console.error('Update user failed:', error);
      toast.error(error?.message || ui('Unable to save user changes.'));
    }
  };

  const handleResetPassword = async (user) => {
    if (!user?.id) {
      toast.error(ui('Invalid user selected.'));
      return;
    }
    if (!await requestConfirmation({
      title: 'Reset Password Confirmation',
      description: "Are you sure you want to reset this user's password to the default password? The user will need to choose a new password the next time they sign in.",
      confirmLabel: 'Reset Password',
      variant: 'warning',
    })) return;

    setResettingPasswordUserId(user.id);
    try {
      const result = await adminApi.resetUserPassword(user.id);
      const defaultPassword = result?.defaultPassword || result?.data?.defaultPassword || '12345678';
      toast.success(`${ui('Password successfully reset to default:')} ${defaultPassword}`);
    } catch (error) {
      toast.error(error?.message || ui("Unable to reset this user's password."));
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const selectBulkUploadFile = (file) => {
    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setUploadFile(null);
      setUploadFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.error(ui('Please choose a CSV file.'));
      return;
    }
    setUploadFile(file);
    setUploadFileName(file ? file.name : '');
  };

  const handleFileInputChange = (event) => {
    selectBulkUploadFile(event.target.files?.[0] || null);
  };

  const handleBulkFileDrop = (event) => {
    event.preventDefault();
    setIsFileDragActive(false);
    selectBulkUploadFile(event.dataTransfer.files?.[0] || null);
  };

  const downloadRegisteredData = async () => {
    if (!registrationMode || isExportingRegisteredData) {
      if (!registrationMode) toast.error(ui('Select a registration type before downloading registered data.'));
      return;
    }
    setIsExportingRegisteredData(true);
    try {
      const csvBlob = await adminApi.downloadRegisteredUsers(registrationMode);
      const fileUrl = URL.createObjectURL(csvBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = fileUrl;
      downloadLink.download = `${registrationMode}-registered-data.csv`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
      toast.success(ui('Registered data downloaded.'));
    } catch (error) {
      toast.error(error?.message || ui('Unable to download registered data.'));
    } finally {
      setIsExportingRegisteredData(false);
    }
  };

  const handleInstructorChange = (field) => (event) => {
    const value = event.target.value;
    updateRegistrationField(setInstructorForm, field, value);
    if (field === 'role' && value !== 'dept_head') {
      setDeptHeadTransferMode(false);
    }
  };

  const handleStudentChange = (field) => (event) => {
    const value = event.target.value;
    if (field !== 'college') {
      updateRegistrationField(setStudentForm, field, value);
      return;
    }
    setStudentForm((current) => {
      const nextDepartment = getDepartmentsForCollege(value)[0]?.id || current.department;
      return { ...current, college: value, department: nextDepartment };
    });
  };

  const resetInstructorForm = () => {
    setRegistrationErrors({});
    setInstructorForm({
      firstName: '',
      lastName: '',
      gender: '',
      username: '',
      phoneNumber: '',
      role: 'instructor',
      department: '',
    });
  };

  const resetStudentForm = () => {
    setRegistrationErrors({});
    setStudentForm({
      firstName: '',
      lastName: '',
      gender: '',
      username: '',
      department: '',
      programType: 'regular',
      academicYear: '2024',
      semester: 'i',
      year: '1st Year (Freshman)',
      section: 'A',
    });
  };

  const handleBulkUploadSubmit = async () => {
    if (!uploadFile) {
      toast.error(ui('Please choose a CSV file before uploading.'));
      return;
    }

    if (!registrationMode) {
      toast.error(ui('Please select a registration type before uploading.'));
      return;
    }

    setIsBulkSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const type = registrationMode;
      formData.append('registration_type', type);

      const result = registrationMode === 'student'
        ? await studentApi.bulkUpload(formData)
        : await authApi.bulkRegister(formData);
      const processedCount = result?.createdCount ?? result?.created ?? 0;
      const failedCount = result?.failedCount ?? result?.failed ?? 0;
      const updatedCount = result?.updated || 0;

      if (result?.created_users?.length) {
        setStudents((current) => {
          if (registrationMode !== 'student') return current;
          const newRows = result.created_users.map((row) => ({
            id: Date.now() + Math.random(),
            fullName: row.full_name,
            username: row.username,
            studentId: row.student_id,
            department: row.department,
            programType: row.program_type,
            semester: row.semester || 'i',
            year: row.year || '1st Year (Freshman)',
            section: row.section || 'A',
            academicDate: row.registration_date || getTodayDate(),
            status: 'Active',
          }));
          return [...newRows, ...current];
        });

        setInstructors((current) => {
          if (registrationMode !== 'instructor') return current;
          const newRows = result.created_users.filter((row) => row.role !== 'dept_head').map((row) => ({
            id: Date.now() + Math.random(),
            fullName: row.full_name,
            username: row.username,
            phoneNumber: row.phone_number,
            department: row.department,
            programType: row.program_type,
            academicDate: row.registration_date || getTodayDate(),
            status: 'Active',
          }));
          return [...newRows, ...current];
        });

        setDeptHeads((current) => {
          if (registrationMode !== 'instructor') return current;
          const newRows = result.created_users.filter((row) => row.role === 'dept_head').map((row) => ({
            id: Date.now() + Math.random(),
            fullName: row.full_name,
            username: row.username,
            phoneNumber: row.phone_number,
            department: row.department,
            programType: row.program_type,
            academicDate: row.registration_date || getTodayDate(),
            status: 'Active',
            accessScore: 90,
            role: 'Department Head',
          }));
          return [...newRows, ...current];
        });
      }

      if (registrationMode === 'student') {
        try {
          const allUsers = await registrationApi.getUsers();
          if (Array.isArray(allUsers)) {
            setStudents(allUsers.map(normalizeBackendUser).filter((user) => user.role === 'student'));
          }
        } catch (error) {
          console.warn('Unable to refresh student list after bulk upload:', error);
        }
      }

      setUploadFile(null);
      setUploadFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      const summary = `Bulk upload complete. Processed: ${processedCount}; Updated: ${updatedCount}; Failed: ${failedCount}.`;
      toast.success(summary);
    } catch (error) {
      const responseData = error?.response?.data;
      const baseMessage = responseData?.message?.en || responseData?.message || error.message || 'Bulk upload failed.';
      const failureDetails = Array.isArray(responseData?.failures)
        ? ` ${responseData.failures.slice(0, 3).map((failure) => `Row ${failure.row}: ${failure.message}`).join(' ')}${responseData.failures.length > 3 ? ' More rows failed.' : ''}`
        : '';
      const message = `${baseMessage}${failureDetails}`;
      toast.error(message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleUserRegistrationSubmit = async (event) => {
    event.preventDefault();

    const parseDepartmentId = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const currentForm = registrationMode === 'student' ? studentForm : instructorForm;
    const errors = getRegistrationErrors(currentForm, registrationMode);
    setRegistrationErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSubmitting(true);

    try {
      if (registrationMode === 'instructor' || registrationMode === 'lab_assistant') {
        const username = instructorForm.username.trim();
        const fullName = [instructorForm.firstName, instructorForm.lastName].filter(Boolean).join(' ').trim();
        const roleValue = registrationMode === 'lab_assistant' ? 'lab_assistant' : 'instructor';

        if (roleValue === 'dept_head') {
          const existingDepartmentHead = deptHeads.find((head) => head.department === instructorForm.department && head.status !== 'Inactive' && head.status !== 'Reassigned');
          if (existingDepartmentHead && !deptHeadTransferMode) {
            toast.error(ui('Department Head already exists for this department.'));
            setIsSubmitting(false);
            return;
          }
        }

        const payload = {
          first_name: instructorForm.firstName.trim(),
          last_name: instructorForm.lastName.trim(),
          gender: instructorForm.gender,
          username,
          role: roleValue,
          department_id: parseDepartmentId(instructorForm.department),
          phone_number: instructorForm.phoneNumber.trim(),
          password: instructorForm.password?.trim(),
        };

        await authApi.registerInstructor(payload);
        const addedLocally = registerUser({ ...payload, role: roleValue, username });
        if (!addedLocally) {
          console.warn(`${roleValue === 'dept_head' ? 'Department Head' : 'Instructor'} ${username} already exists in local auth state.`);
        }

        if (roleValue === 'dept_head') {
          const existingDepartmentHead = deptHeads.find((head) => head.department === instructorForm.department && head.status !== 'Inactive' && head.status !== 'Reassigned');
          setDeptHeads((current) => {
            if (existingDepartmentHead && deptHeadTransferMode) {
              return current.map((head) => {
                if (head.id === existingDepartmentHead.id) {
                  return { ...head, ...instructorForm, fullName, username, department: instructorForm.department, status: 'Active', role: 'Department Head' };
                }
                return head;
              });
            }

            return [{ id: Date.now(), ...instructorForm, fullName, username, department: instructorForm.department, status: 'Active', accessScore: 90, role: 'Department Head' }, ...current];
          });
          setInstructors((current) => [{
            id: Date.now(),
            fullName,
            username,
            role: 'Department Head',
            phoneNumber: instructorForm.phoneNumber.trim(),
            department: instructorForm.department,
            status: 'Active',
          }, ...current]);
          setLogs((current) => [
            ...current,
            { id: Date.now(), user: 'SystemAdmin', action: 'Department Head registered', time: new Date().toLocaleString(), desc: `Registered ${fullName}`, ip: '127.0.0.1', browser: navigator.userAgent },
          ]);
          toast.success(ui('Department Head registered successfully.'));
        } else {
          setInstructors((current) => [{
            id: Date.now(),
            fullName,
            username,
            role: 'Instructor',
            phoneNumber: instructorForm.phoneNumber.trim(),
            department: instructorForm.department,
            status: 'Active',
          }, ...current]);
          setLogs((current) => [
            ...current,
            { id: Date.now(), user: 'SystemAdmin', action: 'Instructor registered', time: new Date().toLocaleString(), desc: `Registered ${fullName}`, ip: '127.0.0.1', browser: navigator.userAgent },
          ]);
          toast.success(ui('Instructor registered successfully.'));
        }

        resetInstructorForm();
        setDeptHeadTransferMode(false);
        setIsSubmitting(false);
        return;
      }

      const username = studentForm.username.trim();
      const fullName = [studentForm.firstName, studentForm.lastName].filter(Boolean).join(' ').trim();

      const payload = {
        first_name: studentForm.firstName.trim(),
        last_name: studentForm.lastName.trim(),
        gender: studentForm.gender,
        username,
        phone_number: studentForm.phoneNumber.trim(),
        department_id: parseDepartmentId(studentForm.department),
        semester: studentForm.semester,
        year_level: studentForm.year,
        section: studentForm.section,
        program_type: studentForm.programType,
        password: studentForm.password?.trim(),
      };

      await authApi.registerStudent(payload);
      const addedLocally = registerUser({ ...payload, role: 'student' });
      if (!addedLocally) {
        console.warn(`Student ${username} already exists in local auth state.`);
      }

      setStudents((current) => [{
        id: Date.now(),
        fullName,
        username,
        studentId: username,
        department: studentForm.department,
        programType: studentForm.programType,
        semester: studentForm.semester,
        year: studentForm.year,
        section: studentForm.section,
        status: 'Active',
      }, ...current]);
      setLogs((current) => [
        ...current,
        { id: Date.now(), user: 'SystemAdmin', action: 'Student registered', time: new Date().toLocaleString(), desc: `Registered ${fullName}`, ip: '127.0.0.1', browser: navigator.userAgent },
      ]);
      toast.success(ui('Student registered successfully.'));
      resetStudentForm();
      setIsSubmitting(false);
    } catch (error) {
      setIsSubmitting(false);
      const message = error?.response?.data?.message?.en || error.message || 'Server registration failed.';
      toast.error(message);
    }
  };

  const resetApiToken = async () => {
    try {
      setApiTokenLoading(true);
      const result = await adminApi.rotateApiToken();
      setApiToken(result?.token || '');
      setApiTokenVisible(true);
      toast.success(strings.systemAdminDashboard.successTokenRotated);
    } catch (error) {
      toast.error(error?.message || ui('Unable to rotate API token.'));
    } finally {
      setApiTokenLoading(false);
    }
  };

  const handleForceReset = (id) => {
    setLogs((current) => [
      ...current,
      { id: Date.now(), user: 'SystemAdmin', action: 'Force reset issued', time: new Date().toLocaleString(), desc: `Forced password reset for head ${id}`, ip: '127.0.0.1', browser: navigator.userAgent },
    ]);
    setShowForceResetModal(false);
    setSelectedHead(null);
    toast.success(strings.systemAdminDashboard.successForceResetIssued);
  };

  const roleDistribution = [
    { key: 'student', label: 'Students', icon: GraduationCap, iconColor: 'bg-blue-600', barColor: 'bg-blue-600' },
    { key: 'instructor', label: 'Instructors', icon: Users, iconColor: 'bg-emerald-600', barColor: 'bg-emerald-600' },
    { key: 'lab_assistant', label: 'Lab Assistants', icon: FlaskConical, iconColor: 'bg-purple-600', barColor: 'bg-purple-600' },
    { key: 'dept_head', label: 'Department Heads', icon: Building2, iconColor: 'bg-orange-500', barColor: 'bg-orange-500' },
    { key: 'college_dean', label: 'College Deans', icon: Landmark, iconColor: 'bg-teal-600', barColor: 'bg-teal-600' },
    { key: 'academic_directorate', label: 'Academic Directorate', icon: Network, iconColor: 'bg-pink-600', barColor: 'bg-pink-600' },
    { key: 'admin', label: 'Administrators', icon: ShieldCheck, iconColor: 'bg-slate-900', barColor: 'bg-slate-900' },
  ].map((roleItem) => ({
    ...roleItem,
    count: dashboardStats
      ? Number(dashboardStats.roleCounts?.[roleItem.key] || 0)
      : null,
  }));
  const largestRoleCount = Math.max(1, ...roleDistribution.map((roleItem) => roleItem.count || 0));
  const lastActivity = auditTimelineLogs[0] || null;
  const databaseOnline = String(dbHealthMetrics.status).toLowerCase() === 'online';
  const parsedSecurityScore = Number.parseFloat(String(dbHealthMetrics.securityScore || '').split('/')[0]);
  const securityScore = Number.isFinite(parsedSecurityScore) ? Math.max(0, Math.min(100, parsedSecurityScore)) : 0;

  const getAuditClientDetails = (userAgent) => {
    const agent = String(userAgent || '');
    const browser = /Edg\/([\d.]+)/i.test(agent) ? 'Microsoft Edge'
      : /Firefox\/([\d.]+)/i.test(agent) ? 'Firefox'
        : /Chrome\/([\d.]+)/i.test(agent) ? 'Chrome'
          : /Safari\/([\d.]+)/i.test(agent) ? 'Safari'
            : agent ? 'Unknown browser' : 'Not available';
    const device = /Android/i.test(agent) ? 'Android'
      : /iPhone|iPad|iPod/i.test(agent) ? 'iOS'
        : /Windows/i.test(agent) ? 'Windows'
          : /Mac OS|Macintosh/i.test(agent) ? 'macOS'
            : /Linux/i.test(agent) ? 'Linux'
              : agent ? 'Unknown device' : 'Not available';
    return { browser, device };
  };

  const openOverviewMetric = async (metricId) => {
    if (metricId === 'upcomingEvents') {
      setActiveTab('calendar');
      return;
    }
    if (metricId === 'totalBroadcasts') {
      setActiveTab('broadcast');
      return;
    }
    if (metricId === 'securityPulse') {
      setActiveTab('security');
      return;
    }

    setViewDataInitialTab(metricId === 'registeredUsers' ? 'users' : 'instructors');
    setViewDataInitialQuery(metricId === 'registeredHeads' ? 'Department Head' : '');
    setActiveTab('view-data');
    try {
      const usersResult = await registrationApi.getUsers();
      const accounts = (Array.isArray(usersResult) ? usersResult : []).map(normalizeBackendUser);
      const activeAccounts = accounts.filter((user) => String(user.status).toLowerCase() === 'active');
      const staffRoles = ['instructor', 'academic_directorate', 'academic_director', 'directorate', 'college_dean', 'dean', 'dept_head', 'department_head', 'lab_assistant', 'ara', 'lab assistant', 'lab-assistant'];
      setRegisteredUsers(activeAccounts);
      setViewDataStaff(activeAccounts.filter((user) => staffRoles.includes(user.role)));
      setStudents(activeAccounts.filter((user) => user.role === 'student'));
    } catch (error) {
      toast.error(error?.message || ui('Unable to refresh registered users.'));
    }
  };

  return (
    <div className="admin-dashboard-root h-full min-h-0 text-slate-900">
      <style>{`
        .admin-dashboard-root { height: 100%; min-height: 0; background: #eaf2fb; }
        .admin-dashboard-shell { display: flex; width: 100%; height: 100%; min-height: 0; gap: 0; overflow: hidden; }
        .admin-dashboard-main { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; padding: 1.25rem 1.5rem; }
        .admin-sidebar { position: sticky; top: 0; align-self: stretch; flex: 0 0 232px; width: 232px; height: 100%; min-height: 0; overflow-y: auto; transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .admin-dashboard-root .admin-sidebar { border: 0; border-radius: 0; background: #38A0DC; box-shadow: none; color: white; }
        .admin-dashboard-root .admin-nav-item { min-height: 42px; align-items: center; border-radius: 0.5rem; padding: 0.625rem 0.5rem; font-size: 0.875rem; font-weight: 500; line-height: 1.25rem; }
        .admin-dashboard-root .admin-nav-item svg { flex: 0 0 18px; }
        .admin-dashboard-root .admin-nav-item span { min-width: 0; overflow-wrap: normal; word-break: normal; hyphens: none; }
        .admin-dashboard-root .admin-nav-item.is-active { border-color: transparent; background: #2B87BD; color: #ffffff; box-shadow: none; }
        .admin-dashboard-root .admin-nav-item:not(.is-active) { color: #ffffff; }
        .admin-dashboard-root .admin-nav-item:not(.is-active):hover { border-color: transparent; background: rgb(255 255 255 / .1); color: white; }
        .admin-dashboard-root .admin-dashboard-main > section > * + * { margin-top: 1.5rem !important; }
        .admin-dashboard-root .admin-dashboard-main article,
        .admin-dashboard-root .admin-dashboard-main [class*="rounded-[28px]"],
        .admin-dashboard-root .admin-dashboard-main [class*="rounded-[24px]"],
        .admin-dashboard-root .admin-dashboard-main [class*="rounded-3xl"] {
          border-color: #e2e8f0 !important;
          border-radius: 1rem !important;
          box-shadow: 0 1px 2px rgb(15 23 42 / 0.05) !important;
          padding: 1.25rem !important;
        }
        .admin-dashboard-root .admin-dashboard-main article:not(.admin-table-card) { padding: 1.25rem !important; }
        .admin-dashboard-root .admin-dashboard-main article.admin-table-card { padding: 0 !important; }
        .admin-dashboard-root .admin-dashboard-main [class*="bg-gradient-to"][class*="rounded-"]:not(.admin-overview-metric-card) { background: #ffffff !important; }
        .admin-dashboard-root .admin-dashboard-main table { border-collapse: collapse; }
        .admin-dashboard-root .admin-dashboard-main thead { background-color: #f8fafc; }
        .admin-dashboard-root .admin-dashboard-main th,
        .admin-dashboard-root .admin-dashboard-main td { padding: 0.75rem 1rem; }
        .admin-dashboard-root .admin-dashboard-main th { border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 600; }
        .admin-dashboard-root .admin-dashboard-main tbody tr:hover { background-color: #f8fafc; }
        .admin-sidebar-backdrop { display: none; }

        @media (max-width: 1024px) {
          .admin-dashboard-shell { gap: 0; }
        }

        @media (max-width: 1023px) {
          .admin-dashboard-shell { display: block; }
          .admin-sidebar {
            position: fixed;
            left: 12px;
            top: 4rem;
            bottom: 0;
            z-index: 60;
            width: min(280px, 82vw);
            height: auto;
            transform: translateX(-120%);
            border: 0;
            border-radius: 0;
            box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18);
          }
          .admin-sidebar.is-open {
            transform: translateX(0);
          }
          .admin-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 50;
            background: rgba(15, 23, 42, 0.35);
            backdrop-filter: blur(2px);
          }
        }
      `}</style>

      {isSidebarOpen && <button type="button" aria-label={ui('Close sidebar')} className="admin-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      <div className="admin-dashboard-shell">
        <aside className={`admin-sidebar flex h-full flex-shrink-0 flex-col print:hidden ${isSidebarOpen ? 'is-open' : ''}`}>
          <nav className="space-y-1.5 px-2" aria-label={ui('System administration navigation')}>
          {[
            { id: 'overview', icon: LayoutDashboard, label: t('overview', 'Overview', 'አጠቃላይ') },
            { id: 'department-course', icon: ClipboardList, label: t('collegeDepartmentRegistration', 'College and Department Registration', 'ኮሌጅ እና ዲፓርትመንት ምዝገባ') },
            { id: 'criteria', icon: ClipboardList, label: ui('Evaluation Criteria') },
            { id: 'register-head', icon: UserPlus, label: t('registerHead', 'Register User', 'ምዝገባ') },
            { id: 'manage-roles', icon: ShieldCheck, label: ui('Manage Roles') },
            { id: 'view-data', icon: Database, label: t('viewData', 'View Data', 'ውሂብ ይመልከቱ') },
            { id: 'broadcast', icon: Megaphone, label: t('broadcastManager', 'Broadcast Manager', 'የስርጭት አስተዳደር') },
            { id: 'contact-info', icon: MapPin, label: ui('Contact Us Details') },
            { id: 'security', icon: ShieldCheck, label: t('securityLogs', 'Security & Logs', 'ደህንነት እና መዝገቦች') },
            { id: 'health', icon: Activity, label: t('systemHealth', 'System Health', 'የስርዓት ጤና') },
          ].map((item) => {
            const Icon = item.icon;
            const departmentLabel = item.id === 'department-course' && item.label.endsWith(' Registration')
              ? <>{item.label.slice(0, -' Registration'.length)}<br />{ui('Registration')}</>
              : item.label;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`admin-nav-item flex w-full items-center gap-2.5 border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${activeTab === item.id ? 'is-active' : 'border-transparent'}`}
              >
                <Icon size={18} strokeWidth={2} />
                <span className="min-w-0 flex-1">{departmentLabel}</span>
              </button>
            );
          })}
          </nav>
          <div className="mt-auto px-3 pb-5 pt-8 text-center text-blue-100/80">
            <svg className="mx-auto mb-3 h-20 w-full max-w-[170px]" viewBox="0 0 180 78" fill="none" aria-hidden="true">
              <path d="M8 68h164M22 68V39l68-25 68 25v29M15 39h150M83 20h14v-9H83zM90 11V5h5v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M33 43h17v14H33zM57 43h17v14H57zM106 43h17v14h-17zM130 43h17v14h-17zM81 68V49a9 9 0 0 1 18 0v19" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M7 69h166M17 74h146" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".65" />
              <path d="M22 66V53l-5 5m5-5 5 5m131 8V52l-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".75" />
            </svg>
            <p className="text-[11px] font-medium italic leading-4">{ui('Better Teaching, Better Learning, Brighter Future')}</p>
          </div>
        </aside>

        <main className="admin-dashboard-main min-w-0 space-y-6">
        {activeTab === 'overview' ? <DashboardBanner role="systemadmin" pageKey={activeTab} /> : null}
        {activeTab === 'view-data' && (
          <ViewDataView
            instructors={viewDataStaff}
            students={students}
            users={registeredUsers}
            departments={registeredDepartments}
            initialTab={viewDataInitialTab}
            initialQuery={viewDataInitialQuery}
            onResetPassword={handleResetPassword}
            resettingPasswordUserId={resettingPasswordUserId}
            onUserDeleted={handleUserDeleted}
          />
        )}
        {confirmationDialog}

        {activeTab === 'overview' && (
          <section className="space-y-6">
            {dashboardStatsError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{dashboardStatsError}</p>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { id: 'upcomingEvents', label: t('upcomingEvents', 'Upcoming Events', 'የሚመጡ ክስተቶች'), trendLabel: 'New active windows', value: dashboardStats?.upcomingEvents, note: 'Active evaluation windows', icon: CalendarDays, theme: 'border-blue-200 from-blue-50 to-white text-blue-700' },
                { id: 'totalBroadcasts', label: t('totalBroadcasts', 'Total broadcasts', 'ጠቅላላ ስርጭቶች'), trendLabel: 'New broadcasts', value: dashboardStats?.totalBroadcasts, note: 'Persisted announcements', icon: Megaphone, theme: 'border-emerald-200 from-emerald-50 to-white text-emerald-700' },
                { id: 'securityPulse', label: t('securityPulse', 'Security pulse', 'የደህንነት ሁኔታ'), trendLabel: 'New open signals', value: dashboardStats?.securityPulse, note: 'Open security signals', icon: ShieldAlert, theme: 'border-amber-200 from-amber-50 to-white text-amber-800' },
                { id: 'registeredHeads', label: t('registeredHeads', 'Registered Heads', 'የተመዘገቡ ኃላፊዎች'), trendLabel: 'New head accounts', value: dashboardStats?.registeredHeads, note: 'Active department heads', icon: Building2, theme: 'border-violet-200 from-violet-50 to-white text-violet-800' },
                { id: 'registeredUsers', label: 'Active Users', trendLabel: 'New active accounts', value: dashboardStats?.registeredUsers, note: 'Registered IPES accounts', icon: Users, theme: 'border-teal-200 from-teal-50 to-white text-teal-800' },
              ].map((metric) => {
                const trend = dashboardStats?.trends?.[metric.id];
                const TrendIcon = trend === null || trend === undefined ? ArrowRight : trend >= 0 ? ArrowUp : ArrowDown;
                const trendColor = trend === null || trend === undefined ? 'text-slate-500' : trend >= 0 ? 'text-emerald-700' : 'text-rose-700';
                return (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => void openOverviewMetric(metric.id)}
                    aria-label={`${metric.label}: ${dashboardStatsLoading ? 'updating' : metric.value ?? 'unavailable'}. Open details`}
                    className={`admin-overview-metric-card group min-h-36 rounded-2xl border bg-gradient-to-br p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${metric.theme}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-700">{metric.label}</span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm"><metric.icon size={19} aria-hidden="true" /></span>
                    </span>
                    <span className="mt-3 block text-3xl font-bold tabular-nums text-slate-950" aria-live="polite">{dashboardStatsLoading ? '...' : metric.value ?? '—'}</span>
                    <span className="mt-2 block text-xs text-slate-600">{metric.note}</span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 font-semibold ${trendColor}`}>
                        <TrendIcon size={13} aria-hidden="true" />
                        {dashboardStatsLoading ? 'Updating' : trend === null || trend === undefined ? 'No prior-period baseline' : `${metric.trendLabel}: ${trend > 0 ? '+' : ''}${trend}% vs prior 30 days`}
                      </span>
                      <ArrowRight size={15} className="text-slate-400 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Users size={18} aria-hidden="true" /></span>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{ui('Registered Users')}</h2>
                      <p className="mt-1 text-sm text-slate-500">{ui('Active accounts by role, from the IPES database.')}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-700">{dashboardStatsLoading ? '...' : dashboardStats?.registeredUsers ?? '—'} {ui('total')}</span>
                </div>
                <div className="space-y-3.5" role="img" aria-label={ui('Active registered users by role')}>
                  {roleDistribution.map((roleItem) => {
                    const RoleIcon = roleItem.icon;
                    const barWidth = Math.max(roleItem.count ? 5 : 0, ((roleItem.count || 0) / (largestRoleCount * 1.25)) * 100);
                    return (
                      <div key={roleItem.key} className="grid grid-cols-[minmax(125px,175px)_1fr_2.5rem] items-center gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${roleItem.iconColor}`}><RoleIcon size={14} aria-hidden="true" /></span>
                          <span className="truncate text-xs font-medium text-slate-700 sm:text-sm">{ui(roleItem.label)}</span>
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full transition-[width] duration-500 ${roleItem.barColor}`} style={{ width: `${Math.min(100, barWidth)}%` }} /></span>
                        <span className="text-right text-sm font-semibold tabular-nums text-slate-800">{dashboardStatsLoading ? '...' : roleItem.count ?? '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{ui('Security Overview')}</h2>
                    <p className="mt-1 text-sm text-slate-500">{ui('Current database-backed posture.')}</p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck size={18} aria-hidden="true" /></span>
                </div>
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-4xl font-semibold tabular-nums text-slate-900">{dashboardStatsLoading ? '...' : dashboardStats?.securityScore ?? '—'}</span>
                  <span className="pb-1 text-sm text-slate-500">/ 100</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, Number(dashboardStats?.securityScore || 0)))}%` }} /></div>
                <dl className="mt-5 grid grid-cols-2 gap-3">
                  <div className="flex min-h-16 items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700"><LockKeyhole size={17} aria-hidden="true" /></span>
                    <div><dt className="text-xs text-slate-500">{ui('Open signals')}</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{dashboardStatsLoading ? '...' : dashboardStats?.securityPulse ?? '—'}</dd></div>
                  </div>
                  <div className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 ${databaseOnline ? 'border-emerald-100 bg-emerald-50/70' : 'border-rose-100 bg-rose-50/70'}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ${databaseOnline ? 'text-emerald-700' : 'text-rose-700'}`}><Database size={17} aria-hidden="true" /></span>
                    <div><dt className="text-xs text-slate-500">{ui('Database')}</dt><dd className={`mt-0.5 text-sm font-semibold ${databaseOnline ? 'text-emerald-800' : 'text-rose-800'}`}>{dbHealthMetrics.status === '--' ? ui('Checking…') : dbHealthMetrics.status}</dd></div>
                  </div>
                </dl>
                <div className="mt-4 flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Clock3 size={17} aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block text-sm font-medium text-slate-800">{ui('Last activity')}</span><span className="block truncate text-xs text-slate-500">{lastActivity?.action || ui('No recent activity recorded')}</span></span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-slate-500">{lastActivity?.time || '—'}</span>
                </div>
              </article>
            </div>

          </section>
        )}

        {activeTab === 'criteria' && (
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="text-2xl font-bold text-slate-900">{ui('Evaluation Criteria')}</h3><p className="mt-1 text-slate-600">{ui('Manage the questions used by each evaluation form.')}</p></div>
                <button type="button" onClick={() => { setEditingCriterionId(null); setCriteriaForm({ criterion_text: '', criterion_text_am: '', category: 'General', weight: 5 }); setShowCriterionForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} /> {ui('Add New Criterion')}</button>
              </div>
                <div className="mt-6 grid gap-3 rounded-2xl bg-slate-100 p-3 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">{ui('Target Role')}<select value={criteriaTargetRole} onChange={(event) => { const nextRole = event.target.value; setCriteriaTargetRole(nextRole); setCriteriaType(nextRole === 'lab_assistant' ? 'ara_student' : 'student'); resetCriterionForm(); }} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal"><option value="instructor">{ui('Instructor')}</option><option value="lab_assistant">{ui('Lab Assistant (ARA)')}</option></select></label>
                  <label className="text-sm font-semibold text-slate-700">{ui('Evaluator Type')}<select value={criteriaType} onChange={(event) => { setCriteriaType(event.target.value); resetCriterionForm(); }} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal">{evaluatorOptions.map(([value, label]) => <option key={value} value={value}>{ui(label)}</option>)}</select></label>
              </div>
              {showCriterionForm || editingCriterionId ? (
                <form onSubmit={saveCriterion} className="fixed inset-0 z-50 m-auto grid h-fit w-[min(92vw,760px)] gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-2xl md:grid-cols-[1fr_1fr_180px_100px_auto]">
                  <input value={criteriaForm.criterion_text} onChange={(event) => setCriteriaForm({ ...criteriaForm, criterion_text: event.target.value })} placeholder={ui('Criterion Text (English)')} maxLength={255} required className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input value={criteriaForm.criterion_text_am} onChange={(event) => setCriteriaForm({ ...criteriaForm, criterion_text_am: event.target.value })} placeholder={ui('Criterion Text (Amharic)')} maxLength={255} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input value={criteriaForm.category} onChange={(event) => setCriteriaForm({ ...criteriaForm, category: event.target.value })} placeholder={ui('Category')} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input type="number" min="1" value={criteriaForm.weight} onChange={(event) => setCriteriaForm({ ...criteriaForm, weight: event.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <div className="flex gap-2"><button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{editingCriterionId ? ui('Save') : ui('Add')}</button><button type="button" onClick={resetCriterionForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">{ui('Cancel')}</button></div>
                </form>
              ) : null}
                  <div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3">{ui('Criterion')}</th><th className="px-3 py-3">{ui('Amharic')}</th><th className="px-3 py-3">{ui('Target Role')}</th><th className="px-3 py-3">{ui('Category')}</th><th className="px-3 py-3">{ui('Weight')}</th><th className="px-3 py-3">{ui('Status')}</th><th className="px-3 py-3">{ui('Actions')}</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredCriteriaRows.map((criterion) => <tr key={criterion.id} className={!criterion.is_active ? 'bg-slate-50 text-slate-400' : ''}><td className="px-3 py-3">{criterion.criterion_text}</td><td className="px-3 py-3">{criterion.criterion_text_am || '—'}</td><td className="px-3 py-3">{ui(criterion.target_role === 'lab_assistant' ? 'Lab Assistant (ARA)' : 'Instructor')}</td><td className="px-3 py-3">{criterion.category}</td><td className="px-3 py-3">{criterion.weight}</td><td className="px-3 py-3">{ui(criterion.is_active ? 'Active' : 'Disabled')}</td><td className="px-3 py-3"><div className="flex gap-3"><button type="button" onClick={() => { setEditingCriterionId(criterion.id); setCriteriaType(criterion.evaluator_type); setCriteriaTargetRole(['instructor', 'lab_assistant'].includes(criterion.target_role) ? criterion.target_role : criteriaTargetForType(criterion.evaluator_type)); setCriteriaForm({ criterion_text: criterion.criterion_text, criterion_text_am: criterion.criterion_text_am || '', category: criterion.category, weight: criterion.weight }); setShowCriterionForm(true); }} className="text-blue-600 hover:text-blue-800"><Pencil size={16} /></button><button type="button" onClick={() => toggleCriterion(criterion)} className={criterion.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}><Trash2 size={16} /></button></div></td></tr>)}{!filteredCriteriaRows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">{ui('No criteria for this target role and evaluator type.')}</td></tr>}</tbody></table></div>
            </div>
          </section>
        )}

        {activeTab === 'department-course' && (
          <section className="space-y-5">
            <header className="relative isolate flex min-h-36 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-blue-50 to-cyan-50 px-5 py-5 shadow-sm sm:px-7 lg:min-h-40">
              <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-700">
                  <Building2 size={17} aria-hidden="true" />
                  {ui('ACADEMIC STRUCTURE')}
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{ui('College and Department Registration')}</h1>
                <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">{ui('Create colleges and departments from one place and keep their records updated instantly.')}</p>
              </div>
              <div className="relative hidden w-[42%] max-w-[420px] items-center justify-end gap-3 pr-3 md:flex">
                <svg className="h-28 w-full max-w-[280px]" viewBox="0 0 320 130" role="img" aria-label={ui('Illustration of an academic building')}>
                  <defs>
                    <linearGradient id="college-building-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#ffffff" />
                      <stop offset="1" stopColor="#dbeafe" />
                    </linearGradient>
                  </defs>
                  <ellipse cx="158" cy="119" rx="145" ry="8" fill="#bfdbfe" opacity=".55" />
                  <path d="M33 111h250M53 111V64l103-37 105 37v47" fill="url(#college-building-fill)" stroke="#5b9bd5" strokeWidth="2" />
                  <path d="m42 64 114-43 116 43H42Z" fill="#1d69ae" />
                  <path d="M143 24h26V8h-26z" fill="#ffffff" stroke="#5b9bd5" strokeWidth="2" />
                  <path d="M153 8V1h7v7" fill="none" stroke="#5b9bd5" strokeWidth="2" />
                  <path d="M79 67h17v18H79zM111 67h17v18h-17zM174 67h17v18h-17zM206 67h17v18h-17z" fill="#8bd1ee" stroke="#4d91c7" strokeWidth="2" />
                  <path d="M143 111V76a15 15 0 0 1 30 0v35" fill="#4f91c8" />
                  <path d="M67 110V92m-8 4 8-8 8 8M238 110V91m-8 5 8-8 8 8" fill="none" stroke="#36a879" strokeLinecap="round" strokeWidth="3" />
                  <circle cx="60" cy="77" r="13" fill="#78c99b" /><circle cx="75" cy="81" r="12" fill="#62b985" />
                  <circle cx="250" cy="76" r="14" fill="#78c99b" /><circle cx="266" cy="82" r="12" fill="#62b985" />
                  <path d="M274 42c8-13 20-13 27-1-7 12-19 15-27 1Z" fill="#a5d9fb" />
                </svg>
                <p className="max-w-24 text-right font-serif text-sm italic leading-5 text-blue-800">{ui('Building')}<br />{ui('Academic')}<br />{ui('Excellence')}</p>
              </div>
            </header>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-5 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1.5">
                  {[
                    { id: 'college', label: 'College Registration', icon: Building2 },
                    { id: 'department', label: 'Department Registration', icon: Network },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDepartmentCourseTab(id)}
                      aria-pressed={departmentCourseTab === id}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${departmentCourseTab === id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Icon size={16} aria-hidden="true" />{ui(label)}
                    </button>
                  ))}
                </div>

                {departmentCourseTab === 'college' ? (
                  <form onSubmit={handleCollegeRegistrationSubmit}>
                    <div className="mb-6 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 size={20} aria-hidden="true" /></span>
                      <div><h2 className="font-bold text-slate-900">{ui('College Information')}</h2><p className="text-xs text-slate-500">{ui('Enter the details of the college you want to register.')}</p></div>
                    </div>
                    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        {ui('College Name')} <span className="text-rose-500">*</span>
                        <span className="relative mt-2 block">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                          <input value={collegeNameInput} onChange={(event) => setCollegeNameInput(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={ui('College Name')} required />
                        </span>
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">
                        {ui('College Code')} <span className="text-rose-500">*</span>
                        <span className="relative mt-2 block">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                          <input value={collegeCodeInput} onChange={(event) => setCollegeCodeInput(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder={ui('College Code')} required />
                        </span>
                      </label>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
                      <button type="button" onClick={resetCollegeForm} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><RotateCcw size={16} aria-hidden="true" />{ui('Reset')}</button>
                      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Plus size={18} aria-hidden="true" />{ui('Register College')}</button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Network size={20} aria-hidden="true" /></span>
                      <div><h2 className="font-bold text-slate-900">{ui('Department Information')}</h2><p className="text-xs text-slate-500">{ui('Connect a department with one of your registered colleges.')}</p></div>
                    </div>
                    <DepartmentRegistration reloadKey={collegeReloadKey} onRegistered={(record) => {
                      setRegisteredDepartments((current) => [record, ...current]);
                    }} />
                  </div>
                )}
              </div>

              <aside aria-labelledby="college-quick-info" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white"><Building2 size={18} aria-hidden="true" /></span>
                  <h2 id="college-quick-info" className="font-bold text-slate-900">{ui('Quick Information')}</h2>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Total Colleges', value: isCollegesLoading ? '…' : registeredColleges.length, note: 'Registered colleges in the system', icon: Building2, iconStyle: 'bg-emerald-100 text-emerald-700' },
                    { label: 'Total Departments', value: isDepartmentsLoading ? '…' : registeredDepartments.length, note: 'Across all colleges', icon: Network, iconStyle: 'bg-blue-100 text-blue-700' },
                    { label: 'Last Updated', value: collegeLastUpdated ? collegeLastUpdated.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—', note: collegeLastUpdated ? collegeLastUpdated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'System record update', icon: Clock3, iconStyle: 'bg-violet-100 text-violet-700' },
                    { label: 'System Status', value: dbHealthMetrics.status === '--' ? 'Checking…' : databaseOnline ? 'Online' : 'Offline', note: 'All services running normally', icon: ShieldCheck, iconStyle: databaseOnline ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700' },
                  ].map(({ label, value, note, icon: Icon, iconStyle }) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconStyle}`}><Icon size={17} aria-hidden="true" /></span>
                      <div className="min-w-0"><p className="text-xs text-slate-500">{ui(label)}</p><p className="truncate text-sm font-bold text-slate-900">{['Checking…', 'Online', 'Offline'].includes(value) ? ui(value) : value}</p><p className="truncate text-[11px] text-slate-500">{ui(note)}</p></div>
                      {label === 'System Status' && databaseOnline && <CircleCheck size={16} className="ml-auto shrink-0 text-emerald-600" aria-label={ui('Online')} />}
                    </div>
                  ))}
                </div>
              </aside>
            </div>

          </section>
        )}

        {activeTab === 'register-head' && (
          <section className="space-y-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Users className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-2xl font-bold capitalize text-slate-900">{sys.registrationSectionTitle}</h3>
                <p className="mt-1 text-sm text-slate-600">{sys.registrationSectionDescription}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  id: 'instructor',
                  label: sys.instructorRegistration,
                  description: 'Register new instructor accounts and manage their information.',
                  icon: Users,
                  accent: 'border-blue-500 bg-blue-50/70 text-blue-700',
                  iconStyle: 'bg-blue-100 text-blue-700',
                  arrowStyle: 'bg-blue-600 text-white',
                },
                {
                  id: 'lab_assistant',
                  label: 'Lab Assistant (ARA) Registration',
                  description: 'Register new lab assistant accounts and manage their information.',
                  icon: FlaskConical,
                  accent: 'border-emerald-500 bg-emerald-50/70 text-emerald-700',
                  iconStyle: 'bg-emerald-100 text-emerald-700',
                  arrowStyle: 'bg-emerald-500 text-white',
                },
                {
                  id: 'student',
                  label: sys.studentRegistration,
                  description: 'Register new student accounts and manage their information.',
                  icon: GraduationCap,
                  accent: 'border-violet-500 bg-violet-50/70 text-violet-700',
                  iconStyle: 'bg-violet-100 text-violet-700',
                  arrowStyle: 'bg-violet-500 text-white',
                },
              ].map(({ id, label, description, icon: Icon, accent, iconStyle, arrowStyle }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setRegistrationMode(id);
                    setRegistrationErrors({});
                  }}
                  aria-pressed={registrationMode === id}
                  className={`group flex min-h-24 items-center gap-3 rounded-2xl border-l-4 border-y border-r px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${accent} ${registrationMode === id ? 'ring-2 ring-blue-500/30' : ''}`}
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconStyle}`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
                  </span>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition group-hover:translate-x-0.5 ${arrowStyle}`}>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>

            {!registrationMode && (
              <div className="flex min-h-[290px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
                <div className="relative mb-5 flex h-36 w-72 max-w-full items-center justify-center">
                  <span className="absolute left-5 top-10 h-3 w-3 rounded-full bg-blue-200" />
                  <span className="absolute right-8 top-5 h-4 w-4 rounded-full bg-violet-200" />
                  <span className="absolute bottom-2 left-1/2 h-24 w-56 -translate-x-1/2 rounded-full bg-blue-100/70" />
                  <div className="relative z-10 flex h-32 w-24 flex-col items-center rounded-t-lg border-4 border-slate-200 bg-white p-3 shadow-sm">
                    <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                      <UserPlus className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="mt-3 h-2 w-14 rounded-full bg-blue-100" />
                    <span className="mt-2 h-2 w-16 rounded-full bg-slate-100" />
                    <span className="mt-2 h-2 w-12 rounded-full bg-slate-100" />
                  </div>
                  <span className="absolute bottom-3 left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="absolute bottom-2 left-12 h-10 w-8 rounded-t-full bg-emerald-300/80 [clip-path:polygon(0_100%,20%_0,100%_35%,75%_100%)]" />
                  <span className="absolute bottom-2 right-12 h-12 w-10 rounded-t-full bg-blue-300/80 [clip-path:polygon(0_100%,25%_30%,100%_0,80%_100%)]" />
                </div>
                <p className="text-base font-semibold text-slate-800">{sys.registrationPromptTitle}</p>
                <p className="mt-1.5 max-w-lg text-sm text-slate-500">{sys.registrationPromptSubtitle}</p>
              </div>
            )}

              {registrationMode && (
                <div className="space-y-6">
                  <section aria-labelledby="bulk-upload-title" className="relative mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 id="bulk-upload-title" className="text-lg font-semibold text-slate-900">{t('bulkUploadTitle', 'Bulk Upload registration', 'ብዛት አስገባ ምዝገባ')}</h4>
                        <p className="mt-1 text-sm text-slate-600">{t('bulkUploadDesc', 'Upload a CSV with the required fields for the selected registration type.', 'የተመረጡትን ምዝገባ ዓይነት የሚያስፈልጉ መረጃዎችን በCSV ይስቀሉ')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleBulkUploadSubmit}
                        disabled={isBulkSubmitting || !uploadFile}
                        className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
                        aria-busy={isBulkSubmitting}
                      >
                        {isBulkSubmitting && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
                        {isBulkSubmitting ? ui('Uploading...') : <><Upload size={16} aria-hidden="true" />{ui('Upload CSV')}</>}
                      </button>
                    </div>

                    <div
                      onDragEnter={(event) => { event.preventDefault(); setIsFileDragActive(true); }}
                      onDragOver={(event) => { event.preventDefault(); setIsFileDragActive(true); }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setIsFileDragActive(false);
                      }}
                      onDrop={handleBulkFileDrop}
                      className={`mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-dashed p-4 transition sm:flex-row sm:items-center ${isFileDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50/50'}`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleFileInputChange}
                        aria-label={ui('Choose CSV file')}
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{ui('Drag and drop a file here')}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{ui('CSV files only')}</p>
                          <p className="mt-1 max-w-full truncate text-xs text-blue-700" aria-live="polite">
                            {uploadFileName || sys.noFileSelected}
                          </p>
                        </div>
                      </div>
                      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          {ui('Choose file')}
                        </button>
                        <button
                          type="button"
                          onClick={downloadRegisteredData}
                          disabled={isExportingRegisteredData}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isExportingRegisteredData ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Database className="h-4 w-4" aria-hidden="true" />}
                          {isExportingRegisteredData ? ui('Downloading...') : ui('Download Registered Data (DB)')}
                        </button>
                      </div>
                    </div>
                  </section>

                  <form noValidate onSubmit={handleUserRegistrationSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start [&_input]:h-11 [&_input]:min-h-[44px] [&_input]:min-w-0 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:leading-normal [&_select]:h-11 [&_select]:min-h-[44px] [&_select]:min-w-0 [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_select]:leading-normal [&_input:focus]:border-blue-500 [&_select:focus]:border-blue-500 [&_input:focus]:ring-2 [&_select:focus]:ring-2 [&_input:focus]:ring-blue-500 [&_select:focus]:ring-blue-500">
                    {(registrationMode === 'instructor' || registrationMode === 'lab_assistant') && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">👤 {ui('Personal Information')}</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('First Name')} <span className="text-red-600">*</span></span>
                            <input value={instructorForm.firstName} onChange={handleInstructorChange('firstName')} maxLength={30} aria-invalid={Boolean(registrationErrors.firstName)} className={registrationInputClass('firstName')} placeholder={sys.firstNamePlaceholder} required />
                            {renderRegistrationError('firstName')}
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('Last Name')} <span className="text-red-600">*</span></span>
                            <input value={instructorForm.lastName} onChange={handleInstructorChange('lastName')} maxLength={30} aria-invalid={Boolean(registrationErrors.lastName)} className={registrationInputClass('lastName')} placeholder={sys.lastNamePlaceholder} required />
                            {renderRegistrationError('lastName')}
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('Gender')} <span className="text-red-600">*</span></span>
                            <select value={instructorForm.gender} onChange={handleInstructorChange('gender')} aria-invalid={Boolean(registrationErrors.gender)} className={registrationInputClass('gender')} required>
                              <option value="">{ui('Select Gender')}</option>
                              <option value="male">{ui('Male')}</option>
                              <option value="female">{ui('Female')}</option>
                            </select>
                            {renderRegistrationError('gender')}
                          </label>
                        </div>
                      </section>

                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">🎓 {ui('Academic & Employment Information')}</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('Department')} <span className="text-red-600">*</span></span>
                            <select value={instructorForm.department} onChange={handleInstructorChange('department')} aria-invalid={Boolean(registrationErrors.department)} className={registrationInputClass('department')} required disabled={isDepartmentsLoading}>
                              {isDepartmentsLoading ? <option value="" disabled>{ui('Loading departments...')}</option> : <><option value="">{ui('Select Department')}</option>{groupedDepartmentOptions.map((group) => <optgroup key={group.id} label={group.name}>{group.departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</optgroup>)}</>}
                            </select>
                            {renderRegistrationError('department')}
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('Username / University ID')} <span className="text-red-600">*</span></span>
                            <input value={instructorForm.username} onChange={handleInstructorChange('username')} aria-invalid={Boolean(registrationErrors.username)} className={registrationInputClass('username')} placeholder={ui('Enter username or university ID')} required />
                            {renderRegistrationError('username')}
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('Phone Number')} <span className="text-red-600">*</span></span>
                            <input type="tel" inputMode="numeric" maxLength={10} aria-invalid={Boolean(registrationErrors.phoneNumber)} value={instructorForm.phoneNumber} onChange={handleInstructorChange('phoneNumber')} className={registrationInputClass('phoneNumber')} placeholder="0919640887" required />
                            {renderRegistrationError('phoneNumber')}
                          </label>
                        </div>
                      </section>
                    </div>
                  )}

                    {registrationMode === 'student' && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">👤 {ui('Personal Information')}</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('First Name')} <span className="text-red-600">*</span></span>
                            <input value={studentForm.firstName} onChange={handleStudentChange('firstName')} maxLength={30} aria-invalid={Boolean(registrationErrors.firstName)} className={registrationInputClass('firstName')} placeholder={sys.firstNamePlaceholder} required />
                            {renderRegistrationError('firstName')}
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('Last Name')} <span className="text-red-600">*</span></span>
                            <input value={studentForm.lastName} onChange={handleStudentChange('lastName')} maxLength={30} aria-invalid={Boolean(registrationErrors.lastName)} className={registrationInputClass('lastName')} placeholder={sys.lastNamePlaceholder} required />
                            {renderRegistrationError('lastName')}
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">{ui('Gender')} <span className="text-red-600">*</span></span>
                            <select value={studentForm.gender} onChange={handleStudentChange('gender')} aria-invalid={Boolean(registrationErrors.gender)} className={registrationInputClass('gender')} required>
                              <option value="">{ui('Select Gender')}</option>
                              <option value="male">{ui('Male')}</option>
                              <option value="female">{ui('Female')}</option>
                            </select>
                            {renderRegistrationError('gender')}
                          </label>
                          <label className="block md:col-span-3">
                            <span className="text-sm font-medium text-slate-700">{ui('Username / University ID')} <span className="text-red-600">*</span></span>
                            <input value={studentForm.username} onChange={handleStudentChange('username')} aria-invalid={Boolean(registrationErrors.username)} className={registrationInputClass('username')} placeholder={ui('Enter username or university ID')} required />
                            {renderRegistrationError('username')}
                          </label>
                          <label className="block md:col-span-3">
                            <span className="text-sm font-medium text-slate-700">{ui('Phone Number')} <span className="text-red-600">*</span></span>
                            <input type="tel" inputMode="numeric" maxLength={10} aria-invalid={Boolean(registrationErrors.phoneNumber)} value={studentForm.phoneNumber} onChange={handleStudentChange('phoneNumber')} className={registrationInputClass('phoneNumber')} placeholder="0919640887" required />
                            {renderRegistrationError('phoneNumber')}
                          </label>
                        </div>
                      </section>

                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">🎓 {ui('Academic Information')}</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">{ui('Program Type')} <span className="text-red-600">*</span></span>
                              <select value={studentForm.programType} onChange={handleStudentChange('programType')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>
                                {programOptions.map((opt) => <option key={opt.value} value={opt.value}>{language === 'en' ? opt.en : opt.am}</option>)}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">{ui('Department')} <span className="text-red-600">*</span></span>
                              <select value={studentForm.department} onChange={handleStudentChange('department')} aria-invalid={Boolean(registrationErrors.department)} className={registrationInputClass('department')} required disabled={isDepartmentsLoading}>
                                {isDepartmentsLoading ? <option value="" disabled>{ui('Loading departments...')}</option> : <><option value="">{ui('Select Department')}</option>{groupedDepartmentOptions.map((group) => <optgroup key={group.id} label={group.name}>{group.departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</optgroup>)}</>}
                              </select>
                              {renderRegistrationError('department')}
                            </label>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">{ui('Year')} <span className="text-red-600">*</span></span>
                              <select value={studentForm.year} onChange={handleStudentChange('year')} aria-invalid={Boolean(registrationErrors.year)} className={registrationInputClass('year')} required><option value="">{ui('Select Year')}</option>{studentYearOptions.map((yearOption) => <option key={yearOption} value={yearOption}>{ui(yearOption)}</option>)}</select>
                              {renderRegistrationError('year')}
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">{ui('Semester')} <span className="text-red-600">*</span></span>
                              <select value={studentForm.semester} onChange={handleStudentChange('semester')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>{semesterOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.en}</option>)}</select>
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">{ui('Section')} <span className="text-red-600">*</span></span>
                              <select value={studentForm.section} onChange={handleStudentChange('section')} aria-invalid={Boolean(registrationErrors.section)} className={registrationInputClass('section')} required><option value="">{ui('Select Section')}</option>{sectionOptions.map((sectionOption) => <option key={sectionOption} value={sectionOption}>{ui(sectionOption)}</option>)}</select>
                              {renderRegistrationError('section')}
                            </label>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}

                  <div className="md:col-span-2 lg:col-span-3 pt-4">
                    <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:px-8">
                      {isSubmitting ? t('registering', 'Registering...', 'በማስመዝገብ ላይ...') : uploadFile ? t('bulkRegister', 'Bulk Register', 'ብዛት አስመዝግብ') : registrationMode === 'student' ? t('registerStudent', 'Register Student', 'ተማሪ አስመዝግብ') : registrationMode === 'lab_assistant' ? ui('Register Lab Assistant') : t('registerInstructor', 'Register Instructor', 'አስተማሪ አስመዝግብ')}
                    </button>
                  </div>

                  </form>
                </div>
              )}

          </section>
        )}

        {activeTab === 'manage-roles' && (
          <ManageRoles users={[...deptHeads, ...instructors, ...students]} onRoleAssigned={(userId, assignedRole) => {
            const update = (items) => items.map((item) => (item.id === userId ? { ...item, role: assignedRole } : item));
            setDeptHeads((current) => update(current));
            setInstructors((current) => update(current));
            setStudents((current) => update(current));
          }} />
        )}

        {activeTab === 'calendar' && (
          <EvaluationCalendar
            initialCollegeData={initialCollegeData}
            onCreateEvent={(event) => {
              setLogs((current) => [
                ...current,
                {
                  id: Date.now(),
                  user: 'SystemAdmin',
                  action: 'Evaluation event scheduled',
                  time: new Date().toLocaleString(),
                  desc: `Scheduled ${event.type}: ${event.title}`,
                  ip: '127.0.0.1',
                  browser: navigator.userAgent,
                },
              ]);
              toast.success(ui('Event scheduled successfully.'));
            }}
          />
        )}

        {activeTab === 'broadcast' && <BroadcastManager totalUsers={dashboardStats?.registeredUsers || 0} />}

        {activeTab === 'security' && (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total Instructors', value: dashboardStatsLoading ? '...' : dashboardStats?.roleCounts?.instructor ?? '—', badge: '▲ 100%', icon: Users, iconStyle: 'bg-blue-100 text-blue-700', badgeStyle: 'bg-emerald-50 text-emerald-700' },
                { label: 'Active Connections', value: dbHealthMetrics.connections, badge: '+2 today', icon: Activity, iconStyle: 'bg-emerald-100 text-emerald-700', badgeStyle: 'bg-emerald-50 text-emerald-700' },
                { label: 'Events Captured', value: logs.length, badge: '+5 today', icon: CalendarDays, iconStyle: 'bg-violet-100 text-violet-700', badgeStyle: 'bg-violet-50 text-violet-700' },
                { label: 'System Security', value: `${securityScore}/100`, badge: '◆ Excellent', icon: ShieldCheck, iconStyle: 'bg-amber-100 text-amber-700', badgeStyle: 'bg-emerald-50 text-emerald-700' },
              ].map((metric) => (
                <article key={metric.label} className="relative rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.25)]">
                  <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-semibold ${metric.badgeStyle}`}>{ui(metric.badge)}</span>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${metric.iconStyle}`}>
                    <metric.icon size={20} aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-sm font-medium text-slate-500">{ui(metric.label)}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{metric.value}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[22px] font-semibold text-slate-900">{ui('Security posture')}</h3>
                    <p className="mt-1 text-sm text-slate-500">{ui('Live system risk score and protection status.')}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{ui('Protected')}</span>
                </div>
                <div className="mt-6 flex items-center gap-5">
                  <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${ui('Security score')} ${securityScore} ${ui('out of 100')}`}>
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                      <circle cx="50" cy="50" r="43" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                      <circle cx="50" cy="50" r="43" fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 43}`} strokeDashoffset={`${2 * Math.PI * 43 * (1 - securityScore / 100)}`} />
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center text-slate-900">
                      <span className="text-2xl font-bold leading-none">{securityScore}</span>
                      <span className="mt-1 text-[11px] font-medium text-slate-500">/100</span>
                    </span>
                  </div>
                  <ul className="space-y-2.5 text-xs font-medium text-slate-600">
                    {['Firewall Active', 'Intrusion Detection', 'Data Encryption', 'Access Control'].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="shrink-0 text-emerald-500" aria-hidden="true" />
                        {ui(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{ui('API token')}</span>
                  <button
                    type="button"
                    onClick={() => void resetApiToken()}
                    disabled={apiTokenLoading}
                    aria-label={ui('Refresh API token')}
                    title={ui('Refresh API token')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-500">{ui('Use this token for secure system integrations.')}</p>
                <div className="mt-5 flex min-w-0 items-center gap-2 rounded-xl border border-blue-950 bg-[#102d55] px-3 py-2.5 text-blue-50 shadow-inner">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs tracking-wider" aria-live="polite">
                    {apiTokenLoading ? ui('Loading...') : apiToken ? (apiTokenVisible ? apiToken : `${apiToken.slice(0, 6)}${'*'.repeat(Math.max(4, apiToken.length - 10))}${apiToken.slice(-4)}`) : ui('Not configured')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApiTokenVisible((visible) => !visible)}
                    disabled={!apiToken || apiTokenLoading}
                    aria-label={ui(apiTokenVisible ? 'Hide API token' : 'Show API token')}
                    title={ui(apiTokenVisible ? 'Hide token' : 'Show token')}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {apiTokenVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
              </article>

              <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.25)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[22px] font-semibold text-slate-900">{ui('Global System Lock')}</h3>
                    <p className="mt-1 text-sm text-slate-500">{ui('Block non-administrator logins while maintenance is on.')}</p>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleSystemMaintenanceToggle}
                    className={`inline-flex items-center gap-3 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${systemActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
                    aria-label={ui('Toggle global system lock')}
                  >
                    <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${systemActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${systemActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </span>
                    {ui(systemActive ? 'Enabled' : 'Disabled')}
                  </button>
                </div>
              </article>
            </div>

            <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.25)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-[22px] font-semibold text-slate-900">{ui('Audit Timeline')}</h3>
                  <p className="text-sm text-slate-500">{ui('Real-time system events and compliance history.')}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-72">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder={sys.searchLogsPlaceholder}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('logs')}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {ui('View All Activity')}
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {auditTimelineLoading && !auditTimelineLogs.length ? (
                  <p className="py-6 text-center text-sm text-slate-500">{ui('Loading activity...')}</p>
                ) : auditTimelineLogs.length ? auditTimelineLogs.filter((entry) => {
                  const query = auditSearch.trim().toLowerCase();
                  if (!query) return true;
                  return [entry.user, entry.action, entry.desc, entry.ip, entry.userAgent, entry.deviceId, entry.location].some((value) => String(value || '').toLowerCase().includes(query));
                }).slice(0, 6).map((entry) => (
                  (() => {
                    const eventText = `${entry.action} ${entry.desc}`.toLowerCase();
                    const isRegistration = /registr|new user|account created/.test(eventText);
                    const isConfiguration = /config|setting|maintenance|system lock/.test(eventText);
                    const EventIcon = isRegistration ? UserRoundPlus : isConfiguration ? Settings2 : LogIn;
                    const eventStyle = isRegistration ? 'bg-violet-100 text-violet-700' : isConfiguration ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700';
                    const { browser, device } = getAuditClientDetails(entry.userAgent);
                    return (
                      <div key={entry.id} className="rounded-[18px] border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
                        <div className="flex items-start gap-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${eventStyle}`}>
                            <EventIcon size={17} aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{entry.action}</p>
                                <p className="mt-0.5 text-xs text-slate-600">{entry.desc}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5 text-right">
                                <span className="text-[11px] font-medium text-slate-500">{entry.time}</span>
                                <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                              <span><strong className="font-semibold text-slate-600">{ui('By:')}</strong> {entry.user}</span>
                              <span><strong className="font-semibold text-slate-600">{ui('IP:')}</strong> {entry.ip}</span>
                              <span><strong className="font-semibold text-slate-600">{ui('Device:')}</strong> {device}</span>
                              <span><strong className="font-semibold text-slate-600">{ui('Browser:')}</strong> {browser}</span>
                              <span><strong className="font-semibold text-slate-600">{ui('Location:')}</strong> {entry.location}</span>
                              <span><strong className="font-semibold text-slate-600">{ui('Device ID:')}</strong> {entry.deviceId}</span>
                              <span><strong className="font-semibold text-slate-600">{ui('Interface:')}</strong> {entry.networkInterface}</span>
                              <span><strong className="font-semibold text-slate-600">{ui('MAC:')}</strong> {entry.networkMac}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )) : <p className="py-6 text-center text-sm text-slate-500">{ui('No audit activity recorded yet.')}</p>}
              </div>
            </article>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="space-y-8">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t('auditTimelineTitle', 'Audit Timeline', 'የኦዲት ጊዜሰላም')}</h3>
                  <p className="text-slate-600">{t('auditTimelineDesc', 'Real-time system events and compliance history.', 'የቀጥታ የስርዓት ክስተቶች እና የስርዓት ታሪክ')}</p>
                </div>
                <button type="button" onClick={() => setAuditTimelineRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">
                  <RefreshCw size={18} /> {sys.refreshTimeline}
                </button>
              </div>
              <div className="mt-8 grid gap-4">
                {auditTimelineLoading && !auditTimelineLogs.length ? (
                  <p className="py-6 text-center text-sm text-slate-500">{ui('Loading activity...')}</p>
                ) : auditTimelineLogs.length ? auditTimelineLogs.map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{entry.action}</p>
                        <p className="text-slate-600">{entry.desc}</p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700">{entry.user}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-slate-600 text-xs">
                      <span>{entry.time}</span>
                      <span>{ui('IP address:')} {entry.ip}</span>
                      <span>{ui('Device / browser:')} {entry.device}</span>
                      <span>{ui('Browser ID:')} {entry.deviceId}</span>
                      <span>{ui('Server interface:')} {entry.networkInterface}</span>
                      <span>{ui('Interface MAC:')} {entry.networkMac}</span>
                    </div>
                  </div>
                )) : <p className="py-6 text-center text-sm text-slate-500">{ui('No audit activity recorded yet.')}</p>}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'health' && (
          <section className="space-y-8">
            <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-600 font-semibold">{t('systemHealthTitle', 'System Health', 'የስርዓት ጤና')}</p>
                <p className="mt-4 text-4xl font-bold text-slate-900">{t('systemHealthStatus', '99.8%', '99.8%')}</p>
                <p className="text-slate-500 text-sm mt-2">{t('uptimeThisWeek', 'uptime this week', 'በዚህ ሳምንት የሚሆን')}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t('systemHealth', 'System Health', 'የስርዓት ጤና')}</h3>
                  <p className="text-slate-600">{t('systemHealthDesc', 'Monitor system performance, resources, and status.', 'የስርዓት አፈጻጸም፣ ሀብቶች እና ሁኔታ ተከታተል')}</p>
                </div>
                <button type="button" onClick={async () => { try { const health = await adminApi.getDatabaseHealth(); setDbHealthMetrics((current) => ({ ...current, ...health })); toast.success(ui('System health refreshed')); } catch (error) { toast.error(error?.message || ui('Unable to refresh system health.')); } }} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">
                  <RefreshCw size={18} /> {ui('Refresh')}
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">{ui('Storage & Backup')}</h4>
                    <span className="text-xs font-medium text-blue-600">{ui('Last Backup:')} {dbHealthMetrics.lastBackup}</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">{ui('Disk Usage')}</span>
                        <span className="font-semibold text-slate-900">{dbHealthMetrics.diskUsage}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 w-[74%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">{ui('Backup Retention')}</span>
                        <span className="font-semibold text-slate-900">{backupRetentionDays} {ui('days')}</span>
                      </div>
                      <input 
                        type="range" 
                        min="7" 
                        max="90" 
                        value={backupRetentionDays}
                        onChange={(e) => setBackupRetentionDays(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-6">
                  <h4 className="font-semibold text-slate-900 mb-4">{ui('API Performance')}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{ui('Response Time')}</span>
                      <span className="font-semibold text-slate-900">145ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{ui('Request Rate')}</span>
                      <span className="font-semibold text-slate-900">2,850/min</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{ui('Error Rate')}</span>
                      <span className="font-semibold text-green-600">0.12%</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 p-6">
                  <h4 className="font-semibold text-slate-900 mb-4">{ui('System Alerts')}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      <span className="text-slate-600">{ui('All systems operational')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                      <span className="text-slate-600">{ui('Disk usage approaching threshold')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      <span className="text-slate-600">{ui('Security protocols active')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'contact-info' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">{ui('Contact Us Details')}</h2>
              <p className="mt-1 text-sm text-slate-500">{ui('Update the contact details shown on the public Contact page and site footer.')}</p>
            </div>
            {contactInfoLoading ? <p className="py-8 text-center text-sm text-slate-500">{ui('Loading contact details...')}</p> : (
              <form onSubmit={saveContactInfo} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['name', 'Contact Name', 'text'], ['email', 'Email Address', 'email'],
                    ['phone', 'Phone Number', 'tel'], ['location', 'Location', 'text'],
                    ['poBox', 'P.O. Box', 'text'], ['officeDays', 'Office Days', 'text'],
                    ['officeHours', 'Office Hours', 'text'], ['institution', 'Institution', 'text'],
                    ['region', 'Region', 'text'], ['landmark', 'Nearby Landmark', 'text'],
                    ['mapQuery', 'Map Search Location', 'text'],
                  ].map(([key, label, type]) => (
                    <label key={key} className="block text-sm font-medium text-slate-700">
                      {ui(label)}
                      <input type={type} value={contactInfo[key] || ''} onChange={(event) => setContactInfo((current) => ({ ...current, [key]: event.target.value }))} required={['name', 'email', 'phone', 'location'].includes(key)} maxLength={key === 'email' ? 254 : 255} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </label>
                  ))}
                </div>
                <div className="flex justify-end border-t border-slate-100 pt-5">
                  <button type="submit" disabled={contactInfoSaving || contactInfoLoading} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {contactInfoSaving ? 'Saving...' : 'Save Contact Details'}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {showEditModal && selectedHead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{t('editDeptHead', 'Edit Dept Head', 'የዲፓርትመንት ኃላፊ አስተካክል')}</h3>
                  <p className="text-slate-600">{t('editDeptHeadDesc', 'Update department head profile before saving.', 'የዲፓርትመንት ኃላፊ መገለጫ አስተካክል')}</p>
                </div>
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedHead(null); }} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">{common.cancel}</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input value={selectedHead.fullName} onChange={(e) => setSelectedHead((current) => ({ ...current, fullName: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
                <input value={selectedHead.username} onChange={(e) => setSelectedHead((current) => ({ ...current, username: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
                <select value={selectedHead.department || departmentSelectionOptions[0]?.id || departmentHeadDepartmentOptions[0].id} onChange={(e) => setSelectedHead((current) => ({ ...current, department: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none">
                  {departmentSelectionOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                <input type="date" value={selectedHead.academicDate || ''} onChange={(e) => setSelectedHead((current) => ({ ...current, academicDate: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
                <input value={selectedHead.status} onChange={(e) => setSelectedHead((current) => ({ ...current, status: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={headEditTransferMode} onChange={() => setHeadEditTransferMode((current) => !current)} />
                  <span>{ui('Replace / transfer this head assignment to the selected department.')}</span>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedHead(null); }} className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700">{common.cancel}</button>
                <button type="button" onClick={() => handleSaveEdit(selectedHead)} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">{t('saveChanges', 'Save changes', 'ለውጦችን አስቀምጥ')}</button>
              </div>
            </div>
          </div>
        )}

        {showForceResetModal && selectedHead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/10">
              <h3 className="text-xl font-semibold mb-4 text-slate-900">{sys.forceResetTitle}</h3>
              <p className="text-slate-600 mb-6">{sys.forceResetDesc.replace('{username}', selectedHead.username)}</p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowForceResetModal(false); setSelectedHead(null); }} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700 hover:bg-slate-100">{common.cancel}</button>
                <button type="button" onClick={() => handleForceReset(selectedHead.id)} className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-500">{common.confirm}</button>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
};

export default SystemAdminDashboard;
