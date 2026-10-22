import { useEffect, useMemo, useState, useContext } from 'react';
import { FaStar, FaClipboardCheck, FaHome } from 'react-icons/fa';
import { BookOpen, CheckCircle2, ClipboardCheck as ClipboardCheckIcon } from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';
import { SUBMISSIONS_UPDATED_EVENT } from '../services/formSubmissions';
import { criteriaApi, evaluationApi, studentApi, DASHBOARD_DATA_UPDATED_EVENT } from '../services/api';
import StudentEvaluationModal from '../components/StudentEvaluationModal';
import { useAuth } from '../context/AuthContext';
import InteractiveMetricCard from '../components/InteractiveMetricCard';
import EvaluationDeadlineBadge from '../components/EvaluationDeadlineBadge';
import EvaluationPeriodStatus from '../components/EvaluationPeriodStatus';
import { DashboardSidebarContext } from '../context/DashboardSidebarContext';
import useUiText from '../hooks/useUiText';

const resolveTranslationValue = (value, fallback = '', preferredLanguage = 'en') => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => resolveTranslationValue(item, '', preferredLanguage)).filter(Boolean).join(' ');
  if (value && typeof value === 'object') {
    if ('en' in value || 'am' in value || 'default' in value) {
      return value[preferredLanguage] || value.en || value.am || value.default || fallback;
    }
    return Object.fromEntries(Object.entries(value).map(([key, childValue]) => [key, resolveTranslationValue(childValue, '', preferredLanguage)]));
  }
  return fallback;
};

const isLabAssistantRole = (value) => ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(String(value || '').trim().toLowerCase());
const isEvaluationComplete = (item) => Boolean(item?.is_evaluated) || ['submitted', 'completed', 'approved', 'evaluated'].includes(String(item?.submission_status || item?.status || item?.evaluation_status || '').trim().toLowerCase());

const normalizeTranslations = (value, language = 'en') => {
  if (Array.isArray(value)) return value.map((item) => normalizeTranslations(item, language));
  if (value && typeof value === 'object') {
    if ('en' in value || 'am' in value || 'default' in value) return resolveTranslationValue(value, '', language);
    return Object.fromEntries(Object.entries(value).map(([key, childValue]) => [key, normalizeTranslations(childValue, language)]));
  }
  return value;
};

const getTranslationValue = (value, fallback = '') => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => getTranslationValue(item, '')).filter(Boolean).join(' ');
  return fallback;
};

const getTranslationByPath = (value, path, fallback = '') => {
  const tokens = path.split('.');
  let current = value;
  for (const token of tokens) {
    if (current === null || current === undefined || typeof current !== 'object') return fallback;
    current = current[token];
  }
  return getTranslationValue(current, fallback);
};

const studentEvaluationSections = [
  {
    title: { en: 'መሠረታዊ ብቃት (Core Competency)', am: 'መሠረታዊ ብቃት' },
    items: [
      { id: 's1', en: 'The course objective, content, and relevance are clearly stated.', am: 'የትምህርቱ ዓላማ፣ ይዘት እና አስፈላጊነት በግልጽ ተገልጿል።' },
      { id: 's2', en: 'The instructor prepares and shares a well-structured course outline.', am: 'መምህሩ በደንብ የተደራጀ የኮርስ እቅድ አዘጋጅቶ ይሰጣል።' },
      { id: 's3', en: 'Relevant reference books and supplemental materials are prepared.', am: 'ተጨማሪ እና ተዛማጅ የማጣቀሻ መጽሐፍት ተዘጋጅተዋል።' },
      { id: 's4', en: 'The instructor provides practical activities such as labs, field visits, or case studies.', am: 'መምህሩ እንደ ላብራቶሪ፣ የመስክ ጉብኝት ወይም አጉሊ ምሳሌ ተግባራዊ ተግባራት ይሰጣል።' },
      { id: 's5', en: 'The instructor demonstrates strong foundational knowledge and skill in the subject.', am: 'መምህሩ በትምህርቱ ላይ ጠንካራ መሰረታዊ እውቀት እና ብቃት ያሳያል።' },
      { id: 's6', en: 'The instructor links theory to practice and real-life examples.', am: 'መምህሩ ሕንፃን እና ታሪክን በእውነተኛ ህይወት ምሳሌዎች ይያዛል።' },
    ],
  },
  {
    title: { en: 'የሙያ ብቃት (Professional Competency)', am: 'የሙያ ብቃት' },
    items: [
      { id: 's7', en: 'The instructor communicates clearly and uses appropriate teaching aids.', am: 'መምህሩ በግልጽ ይገልጻል እና ተገቢ የማስተማሪያ መሳሪያዎችን ይጠቀማል።' },
      { id: 's8', en: 'The instructor provides timely feedback on classwork, homework, and quizzes.', am: 'መምህሩ በትምህርት ስራ፣ ቤት ስራ እና ካውዚ ላይ በወቅቱ አስተያየት ይሰጣል።' },
      { id: 's9', en: 'The instructor encourages cooperative learning and active participation in class.', am: 'መምህሩ የጋራ መማር እና ንቁ ተሳትፎን በክፍል ውስጥ ያበረታታል።' },
      { id: 's10', en: 'The instructor uses continuous assessment effectively and communicates results clearly.', am: 'መምህሩ ቀጣይነት ያለው ተግባር በብቃት ይጠቀማል እና ውጤቶቹን በግልጽ ይገልጻል።' },
      { id: 's11', en: 'The instructor provides appropriate support to both low-achieving and high-achieving students.', am: 'መምህሩ ለዝቅተኛ እና ከፍተኛ ውጤት ያላቸው ተማሪዎች ተገቢ ድጋፍ ይሰጣል።' },
      { id: 's12', en: 'The instructor demonstrates professionalism in communication and conduct.', am: 'መምህሩ በግንኙነት እና በፍትሃዊነት ሙያዊነት ያሳያል።' },
      { id: 's13', en: 'The instructor integrates technology and resources to support learning.', am: 'መምህሩ ለመማር ቴክኖሎጂን እና ምንጮችን ያጠቀማል።' },
      { id: 's14', en: 'The instructor creates a respectful and inclusive classroom environment.', am: 'መምህሩ ክፍለ ትምህርት በክብር እና በአካባቢ ያስተዳድራል።' },
    ],
  },
  {
    title: { en: 'የሥነ-ምግባር ብቃት (Ethical Competency)', am: 'የሥነ-ምግባር ብቃት' },
    items: [
      { id: 's15', en: 'The instructor treats students with respect and creates a supportive learning environment.', am: 'መምህሩ ተማሪዎችን በአክብሮት ይይዛል እና የማስተማር አካባቢን ይደግፋል።' },
      { id: 's16', en: 'The instructor accepts student questions patiently and allows them to express ideas freely.', am: 'መምህሩ የተማሪዎችን ጥያቄዎች በትዕግስት ይቀበላል እና ሀሳባቸውን በነጻነት እንዲገልጹ ያስችላል።' },
      { id: 's17', en: 'The instructor handles students impartially and fairly.', am: 'መምህሩ ተማሪዎችን እኩል አድልዎ እንዳይኖር በፍትሃዊነት ይቆጣጠራል።' },
      { id: 's18', en: 'The instructor demonstrates professional ethics and strong discipline.', am: 'መምህሩ ሙያዊ ስነ-ምግባር እና ጥንካሬ ያለው ባህሪ ያሳያል።' },
    ],
  },
  {
    title: { en: 'የጊዜ አጠቃቀም (Time Management)', am: 'የጊዜ አጠቃቀም' },
    items: [
      { id: 's19', en: 'The instructor maintains consistency in class delivery and follow-up.', am: 'መምህሩ በክፍል አቅርቦት እና ተከታታይ ክትትል ላይ ይቆጣጠራል።' },
      { id: 's20', en: 'The instructor responds to student concerns and progress updates in a timely way.', am: 'መምህሩ የተማሪዎችን ጥያቄ እና እድገት በወቅቱ ይመልሳል።' },
    ],
  },
];

const StudentDashboard = () => {
  const tUi = useUiText();
  const { strings: rawStrings, language } = useContext(LanguageContext);
  const { sidebarOpen, setSidebarOpen } = useContext(DashboardSidebarContext);
  const { user, role, isAuthenticated, authToken } = useAuth();
  const strings = useMemo(() => normalizeTranslations(rawStrings, language), [rawStrings, language]);
  const t = (path, fallback = '') => getTranslationByPath(strings, path, fallback);
  const renderText = (value, fallback = '') => resolveTranslationValue(value, fallback, language);

  const [activeTab, setActiveTab] = useState('overview');
  const [evaluationFilter, setEvaluationFilter] = useState('all');
  const [profile, setProfile] = useState(null);
  const [pendingCourses, setPendingCourses] = useState([]);
  const [pendingDispatches, setPendingDispatches] = useState([]);
  const [evaluationDeadline, setEvaluationDeadline] = useState(null);
  const [isEvaluationExpired, setIsEvaluationExpired] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState('create');
  const [studentModalRecord, setStudentModalRecord] = useState(null);
  const [studentModalLoading, setStudentModalLoading] = useState(false);
  const [studentModalError, setStudentModalError] = useState('');
  const [studentModalSuccess, setStudentModalSuccess] = useState('');
  const [error, setError] = useState('');
  const [dynamicStudentSections, setDynamicStudentSections] = useState([]);
  const [dynamicAraSections, setDynamicAraSections] = useState([]);
  useEffect(() => {
    criteriaApi.get('student').then((rows) => {
      const grouped = (Array.isArray(rows) ? rows : []).reduce((result, criterion) => {
        const category = criterion.category || tUi('General');
        const section = result.find((item) => item.title.en === category);
        const item = { id: String(criterion.id), en: criterion.criterion_text, am: criterion.criterion_text_am || criterion.criterion_text };
        if (section) section.items.push(item);
        else result.push({ title: { en: category, am: category }, items: [item] });
        return result;
      }, []);
      if (grouped.length) setDynamicStudentSections(grouped);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    criteriaApi.get('ara_student').then((rows) => {
      const grouped = (Array.isArray(rows) ? rows : []).reduce((result, criterion) => {
        const category = criterion.category || 'Laboratory Support';
        const section = result.find((item) => item.title.en === category);
        const item = { id: String(criterion.id), en: criterion.criterion_text, am: criterion.criterion_text_am || criterion.criterion_text };
        if (section) section.items.push(item);
        else result.push({ title: { en: category, am: category }, items: [item] });
        return result;
      }, []);
      if (grouped.length) setDynamicAraSections(grouped);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (role !== 'student' || !isAuthenticated || !authToken || !user || user.isFirstLogin === true) {
      setLoading(false);
      setProfile(null);
      setPendingDispatches([]);
      setPendingCourses([]);
      setEvaluationDeadline(null);
      setIsEvaluationExpired(false);
      return;
    }

    const loadDashboardData = async () => {
      setLoading(true);
      setError('');
      try {
        const [profileData, pendingDispatchesData] = await Promise.all([
          studentApi.getProfile().catch(() => null),
          evaluationApi.getPendingStudentEvaluations(),
        ]);
        setProfile(profileData || null);
        const dispatches = Array.isArray(pendingDispatchesData)
          ? pendingDispatchesData
          : Array.isArray(pendingDispatchesData?.evaluations)
            ? pendingDispatchesData.evaluations
            : [];
        setPendingDispatches(dispatches);
        setPendingCourses(dispatches);
        setEvaluationDeadline(
          pendingDispatchesData?.deadline ||
          dispatches.find((item) => item?.deadline || item?.expiryDate)?.deadline ||
          dispatches.find((item) => item?.expiryDate)?.expiryDate ||
          null,
        );
        setIsEvaluationExpired(Boolean(pendingDispatchesData?.isExpired));
        if (pendingDispatchesData?.isExpired) {
          setShowStudentModal(false);
          setSelectedCourse(null);
          setSelectedDispatch(null);
        }
      } catch (fetchError) {
        console.error(fetchError);
        setError(fetchError?.message || tUi('Unable to load student dashboard data.'));
      } finally {
        setLoading(false);
      }
    };
    void loadDashboardData();
  }, [authToken, isAuthenticated, role, user]);

  useEffect(() => {
    const refreshDispatches = async () => {
      if (role !== 'student' || !isAuthenticated || !authToken) return;
      try {
        const pendingDispatchesData = await evaluationApi.getPendingStudentEvaluations();
        const dispatches = Array.isArray(pendingDispatchesData)
          ? pendingDispatchesData
          : Array.isArray(pendingDispatchesData?.evaluations)
            ? pendingDispatchesData.evaluations
            : [];
        setPendingDispatches(dispatches);
        setPendingCourses(dispatches);
        setEvaluationDeadline(
          pendingDispatchesData?.deadline ||
          dispatches.find((item) => item?.deadline || item?.expiryDate)?.deadline ||
          dispatches.find((item) => item?.expiryDate)?.expiryDate ||
          null,
        );
        setIsEvaluationExpired(Boolean(pendingDispatchesData?.isExpired));
        if (pendingDispatchesData?.isExpired) {
          setShowStudentModal(false);
          setSelectedCourse(null);
          setSelectedDispatch(null);
        }
        setError('');
      } catch (refreshError) {
        console.error('Student evaluations refresh failed:', refreshError);
        setPendingCourses([]);
        setPendingDispatches([]);
        setError(refreshError?.message || tUi('Unable to refresh student evaluations.'));
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshDispatches();
    };
    const intervalId = window.setInterval(refreshDispatches, 30000);
    window.addEventListener(SUBMISSIONS_UPDATED_EVENT, refreshDispatches);
    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshDispatches);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, refreshDispatches);
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshDispatches);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [authToken, isAuthenticated, role]);

  const activeEvaluationSections = useMemo(
    () =>
      ((isLabAssistantRole(selectedDispatch?.target_role) && dynamicAraSections.length) ? dynamicAraSections : (dynamicStudentSections.length ? dynamicStudentSections : studentEvaluationSections)).map((section) => ({
        ...section,
        title: resolveTranslationValue(section.title, '', 'en'),
        items: section.items.map((item) => ({
          ...item,
          en: resolveTranslationValue(item.en, '', 'en'),
          am: resolveTranslationValue(item.am, '', 'am'),
        })),
      })),
    [dynamicAraSections, dynamicStudentSections, selectedDispatch?.target_role]
  );

  const pendingCount = pendingCourses.filter((course) => !isEvaluationComplete(course)).length;
  const completedCount = pendingCourses.filter(isEvaluationComplete).length;
  const totalCourses = pendingCourses.length;
  const isEvaluationPeriodClosed = isEvaluationExpired || pendingCount === 0;
  const filteredEvaluationCourses = pendingCourses.filter((course) => evaluationFilter === 'all' || (evaluationFilter === 'completed' ? isEvaluationComplete(course) : !isEvaluationComplete(course)));
  const fullNameParts = [profile?.first_name, profile?.last_name].filter(Boolean);
  const getStudentFullName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.user?.first_name && profile?.user?.last_name) {
      return `${profile.user.first_name} ${profile.user.last_name}`;
    }

    let storedUser = {};
    try {
      storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      storedUser = {};
    }

    if (storedUser?.first_name && storedUser?.last_name) {
      return `${storedUser.first_name} ${storedUser.last_name}`;
    }
    if (storedUser?.full_name && !storedUser.full_name.includes('.')) {
      return storedUser.full_name;
    }
    if (profile?.full_name && profile.full_name.trim() !== '' && !profile.full_name.includes('.')) {
      return profile.full_name;
    }

    const rawUsername = profile?.username || storedUser?.username;
    if (rawUsername && rawUsername.includes('.')) {
      const parts = rawUsername.split('.').filter(Boolean);
      const formattedFirst = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '';
      const formattedLast = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
      if (formattedFirst || formattedLast) {
        return `${formattedFirst} ${formattedLast}`.trim();
      }
    }

    if (profile?.username === 'abebe.b' || rawUsername === 'abebe.b') {
      return 'Abebe Bikila';
    }

    return fullNameParts.length ? fullNameParts.join(' ') : tUi('Student');
  };
  const sidebarItems = [
    { key: 'overview', label: t('studentDashboard.overview'), icon: FaHome },
    { key: 'my-evaluations', label: t('studentDashboard.myEvaluations'), icon: FaClipboardCheck },
  ];

  const findDispatchForCourse = (course) => {
    if (!course) return null;
    if (course.id) return course;
    return (
      pendingDispatches.find((dispatch) => dispatch.course_code === course.course_code || dispatch.course_name === course.course_name || dispatch.course_code === course.code) || null
    );
  };

  const openEvaluation = (course, mode = 'create', record = null) => {
    setSelectedCourse(course);
    setSelectedDispatch(findDispatchForCourse(course));
    setStudentModalMode(mode);
    setStudentModalRecord(record);
    setShowStudentModal(true);

  };

  const getInstructorName = (course) => {
    if (isLabAssistantRole(course?.target_role) || isLabAssistantRole(course?.role)) {
      return course?.instructor_name?.trim() || tUi('Lab Assistant');
    }
    return course?.instructor_name?.trim() || course?.instructor?.trim() || tUi('Assigned Instructor');
  };
  const getScoreValue = (item) => Number(item?.total_score ?? item?.score ?? item?.totalScore ?? item?.overall_score ?? 0) || 0;

  const renderCourseAction = (course) => {
    const status = String(course?.status || course?.evaluation_status || '').toLowerCase();
    const isEvaluated = Boolean(course?.is_evaluated || status === 'submitted' || status === 'completed' || status === 'evaluated');
    const scoreValue = getScoreValue(course);

    if (isEvaluated) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
            ✓ {tUi('Evaluated')} ({scoreValue}/100)
          </span>
          <button
            type="button"
            onClick={() => openEvaluation(course, 'view', course)}
            className="text-sm font-semibold text-blue-600 underline transition-colors hover:text-blue-800"
          >
            {tUi('View Details')}
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => openEvaluation(course, 'create', null)}
        className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
      >
        <FaStar /> {tUi('Evaluate')}
      </button>
    );
  };

  const handleStudentEvaluationSubmit = async (payload) => {
    setStudentModalLoading(true);
    setStudentModalError('');
    setStudentModalSuccess('');
    try {
      const submission = await evaluationApi.submitStudentEvaluationForm(payload);
      const submittedScore = Number(submission?.score ?? submission?.total_score ?? payload.score ?? 0);
      setStudentModalSuccess(tUi('Student evaluation submitted successfully.'));
      setShowStudentModal(false);
      setPendingDispatches((current) => current.map((dispatch) => (dispatch.id === payload.dispatch_id ? { ...dispatch, status: 'submitted', score: submittedScore, total_score: submittedScore, submission_status: 'submitted', is_evaluated: true } : dispatch)));
      setPendingCourses((current) => current.map((course) => (course.id === payload.dispatch_id ? { ...course, status: 'submitted', score: submittedScore, total_score: submittedScore, submission_status: 'submitted', is_evaluated: true } : course)));
      setSelectedCourse(null);
      setSelectedDispatch(null);
      window.dispatchEvent(new CustomEvent(SUBMISSIONS_UPDATED_EVENT, { detail: { type: 'submission' } }));
    } catch (submitError) {
      console.error('Student evaluation submission error:', submitError);
      setStudentModalError(submitError?.message || tUi('Unable to submit evaluation.'));
    } finally {
      setStudentModalLoading(false);
    }
  };

  const handleMenuClick = (key) => {
    try {
      setSidebarOpen(false);
      setActiveTab(key);
      setEvaluationFilter('all');
      setSelectedCourse(null);
      setSelectedDispatch(null);
    } catch (err) {
      console.error('Error handling menu click:', err);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="card p-6">
          <p className="text-sm text-gray-600">{tUi('Loading dashboard data...')}</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="card rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p>{error}</p>
        </div>
      );
    }
    switch (activeTab) {
      case 'my-evaluations':
        return (
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-ieps-blue-600">{t('studentDashboard.myEvaluationsTitle')}</h2>
                <p className="text-sm text-gray-500">{t('studentDashboard.myEvaluationsDesc')}</p>
              </div>
              <div className="rounded-full bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-700">
                {pendingCount} {t('studentDashboard.pendingLabel')}
              </div>
            </div>
            {isEvaluationPeriodClosed ? (
              <EvaluationPeriodStatus isClosed />
            ) : (
              <>
                <EvaluationPeriodStatus deadline={evaluationDeadline} />
                <div className="overflow-x-auto">
                  <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.courseCode')}</th>
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.courseName')}</th>
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.instructor')}</th>
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.deadline')}</th>
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvaluationCourses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-sm text-gray-500">{tUi('No pending evaluations.')}</td>
                    </tr>
                  ) : (
                    filteredEvaluationCourses.map((course, index) => (
                      <tr key={`dispatch-${course.id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-sm font-medium text-gray-800">{course.course_code || course.code || '-'}</td>
                        <td className="py-3 text-sm text-gray-600">
                          {renderText(`${course.course_name || course.name || '-'}${isLabAssistantRole(course.target_role) && !String(course.course_name || '').endsWith(' (Lab)') ? ` (${tUi('Lab')})` : ''}`)}
                          {(course.semester || course.academic_year) && <span className="mt-1 block text-xs text-gray-400">{[course.semester, course.academic_year].filter(Boolean).join(' · ')}</span>}
                        </td>
                        <td className="py-3 text-sm text-gray-600"><span className="block">{getInstructorName(course)}</span>{isLabAssistantRole(course.target_role) && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{tUi('Lab Assistant (ARA)')}</span>}</td>
                        <td className="py-3 text-sm"><EvaluationDeadlineBadge value={course} /></td>
                        <td className="py-3">{renderCourseAction(course)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      case 'my-courses':
        return (
          <div className="card">
            <h2 className="text-xl font-bold text-ieps-blue-600 mb-4">{t('studentDashboard.myCourses')}</h2>
            {isEvaluationPeriodClosed ? (
              <EvaluationPeriodStatus isClosed />
            ) : (
              <>
                <EvaluationPeriodStatus deadline={evaluationDeadline} />
                <div className="overflow-x-auto">
                  <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.courseCode')}</th>
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.courseName')}</th>
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.instructor')}</th>
                    <th className="text-left py-3 text-sm font-semibold text-gray-500">{t('studentDashboard.deadline')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingCourses.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-sm text-gray-500">{tUi('No courses available.')}</td>
                    </tr>
                  ) : (
                    pendingCourses.map((course, index) => (
                      <tr key={`dispatch-${course.id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-sm font-medium text-gray-800">{course.course_code || course.code || '-'}</td>
                        <td className="py-3 text-sm text-gray-600">{renderText(`${course.course_name || course.name || '-'}${isLabAssistantRole(course.target_role) && !String(course.course_name || '').endsWith(' (Lab)') ? ` (${tUi('Lab')})` : ''}`)}</td>
                        <td className="py-3 text-sm text-gray-600"><span className="block">{getInstructorName(course)}</span>{isLabAssistantRole(course.target_role) && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{tUi('Lab Assistant (ARA)')}</span>}</td>
                        <td className="py-3 text-sm"><EvaluationDeadlineBadge value={course} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      case 'progress':
        return (
          <div className="card">
            <h2 className="text-xl font-bold text-ieps-blue-600 mb-4">{t('studentDashboard.progressTitle')}</h2>
            <div className="stats-grid">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.completedEvaluations')}</p>
                <p className="mt-2 text-3xl font-bold text-gray-800">{completedCount}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.remainingDeadlines')}</p>
                <p className="mt-2 text-3xl font-bold text-gray-800">{pendingCount}</p>
              </div>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="card">
            <h2 className="text-xl font-bold text-ieps-blue-600 mb-4">{t('studentDashboard.studentProfile')}</h2>
            <div className="stats-grid">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.fullName')}</p>
                <p className="mt-1 font-semibold text-gray-800">{profile?.full_name || profile?.username || profile?.name || '-'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.studentId')}</p>
                <p className="mt-1 font-semibold text-gray-800">{profile?.student_id || profile?.username || profile?.id || '-'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.department')}</p>
                <p className="mt-1 font-semibold text-gray-800">{profile?.department_name || profile?.department || '-'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.programType')}</p>
                <p className="mt-1 font-semibold text-gray-800">{profile?.program_type || '-'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.academicYear')}</p>
                <p className="mt-1 font-semibold text-gray-800">{profile?.year_level || profile?.year || '-'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{t('studentDashboard.section')}</p>
                <p className="mt-1 font-semibold text-gray-800">{profile?.section || '-'}</p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
              <InteractiveMetricCard label={tUi('Total Courses')} value={totalCourses} icon={BookOpen} tone="cyan" onClick={() => { setEvaluationFilter('all'); setActiveTab('my-evaluations'); }} />
              <InteractiveMetricCard label={tUi('Pending')} value={pendingCount} icon={ClipboardCheckIcon} tone="amber" onClick={() => { setEvaluationFilter('pending'); setActiveTab('my-evaluations'); }} />
              <InteractiveMetricCard label={tUi('Completed')} value={completedCount} icon={CheckCircle2} tone="emerald" onClick={() => { setEvaluationFilter('completed'); setActiveTab('my-evaluations'); }} />
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setActiveTab('my-evaluations')}
                className="w-full max-w-lg rounded-3xl bg-ieps-blue-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-ieps-blue-700 sm:w-auto"
              >
                {tUi('Start Pending Evaluations')}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="student-dashboard-root h-full w-full min-w-0">
      {sidebarOpen ? <button type="button" aria-label={tUi('Close sidebar')} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="student-dashboard-shell grid h-full min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className={`fixed bottom-0 left-0 top-16 z-50 h-auto w-64 shrink-0 flex-shrink-0 border-r border-white/15 bg-[#38A0DC] p-4 text-white shadow-xl transition-transform duration-300 lg:static lg:z-auto lg:block lg:h-full lg:w-[232px] lg:translate-x-0 lg:rounded-none lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">{t('studentDashboard.menu')}</h3>
          <div className="space-y-2">
            {sidebarItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleMenuClick(key)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left text-sm font-medium leading-5 transition ${activeTab === key ? 'border-transparent bg-[#2B87BD] text-white shadow-none' : 'border-transparent text-white hover:bg-white/15 hover:text-white'}`}
              >
                <Icon className="shrink-0" />
                <span className="min-w-0 flex-1 truncate [overflow-wrap:normal]" title={label}>{label}</span>
              </button>
            ))}
          </div>
        </aside>
        <main className="main-content min-h-0 min-w-0 space-y-6 overflow-y-auto p-4 sm:p-6">
          <div className="welcome-card flex flex-col gap-4 rounded-3xl border border-sky-200 bg-sky-100 p-6 text-slate-800 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">Mekdela Amba University</p>
                <h1 className="mt-1 text-2xl font-extrabold text-sky-950 md:text-3xl">{tUi('Welcome')}, {getStudentFullName()}</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium md:text-sm">
              <span className="rounded-full border border-sky-300/60 bg-sky-200/80 px-3 py-1 text-sky-950">
                <strong>{tUi('ID')}:</strong> {profile?.student_id || profile?.username || tUi('N/A')}
              </span>
              <span className="rounded-full border border-sky-300/60 bg-sky-200/80 px-3 py-1 text-sky-950">
                <strong>{tUi('Department')}:</strong> {profile?.department_name || profile?.department || tUi('N/A')}
              </span>
              <span className="rounded-full border border-sky-300/60 bg-sky-200/80 px-3 py-1 text-sky-950">
                <strong>{tUi('Program')}:</strong> {profile?.program_type || profile?.program || tUi('N/A')}
              </span>
              <span className="rounded-full border border-sky-300/60 bg-sky-200/80 px-3 py-1 text-sky-950">
                <strong>{tUi('Year Level')}:</strong> {profile?.year_level || tUi('N/A')}
              </span>
              <span className="rounded-full border border-sky-300/60 bg-sky-200/80 px-3 py-1 text-sky-950">
                <strong>{tUi('Section')}:</strong> {profile?.section ? `${tUi('Section')} ${profile.section}` : tUi('N/A')}
              </span>
            </div>
          </div>

          {renderContent()}
        </main>
      </div>
      <StudentEvaluationModal
        open={showStudentModal}
        onClose={() => {
          setShowStudentModal(false);
          setStudentModalMode('create');
          setStudentModalRecord(null);
        }}
        course={{ ...(selectedCourse || {}), ...(selectedDispatch || {}) }}
        dispatchItem={selectedDispatch}
        sections={activeEvaluationSections}
        onSubmit={handleStudentEvaluationSubmit}
        isSubmitting={studentModalLoading}
        successMessage={studentModalSuccess}
        errorMessage={studentModalError}
        mode={studentModalMode}
        evaluationRecord={studentModalRecord}
      />
    </div>
  );
};

export default StudentDashboard;