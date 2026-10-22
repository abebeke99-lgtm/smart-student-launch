import { useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaClipboardCheck, FaUsers, FaChartBar, FaStar } from 'react-icons/fa';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  MessageSquareText,
  Search,
  Send,
  Star,
  Users,
} from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';
import PeerEvaluationModal, { standardPeerEvaluationSections } from '../components/PeerEvaluationModal';
import PerformanceDashboard from '../components/PerformanceDashboard';
import { adminApi, authApi, courseAssignmentApi, evaluationApi, DASHBOARD_DATA_UPDATED_EVENT } from '../services/api';
import { SUBMISSIONS_UPDATED_EVENT } from '../services/formSubmissions';
import { adminData } from '../data/adminOptions';
import PeerEvaluationDeadlineBadge from '../components/PeerEvaluationDeadlineBadge';
import EvaluationPeriodStatus from '../components/EvaluationPeriodStatus';
import { DashboardSidebarContext } from '../context/DashboardSidebarContext';
import useUiText from '../hooks/useUiText';

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
const isLabAssistantRole = (role) => ['lab_assistant', 'ara'].includes(normalizeRole(role));

const InstructorDashboard = () => {
  const { strings } = useContext(LanguageContext);
  const t = useUiText();
  const { sidebarOpen, setSidebarOpen } = useContext(DashboardSidebarContext);
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(() => {
    if (typeof window === 'undefined') return authUser || null;
    try {
      const storedUser = JSON.parse(window.localStorage.getItem('user') || '{}');
      return storedUser && Object.keys(storedUser).length ? storedUser : authUser || null;
    } catch {
      return authUser || null;
    }
  });
  const [activeView, setActiveView] = useState('overview');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(true);
  const [activeAcademicYear, setActiveAcademicYear] = useState('2025/2026');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [assignedCoursesLoading, setAssignedCoursesLoading] = useState(false);
  const [assignedCoursesError, setAssignedCoursesError] = useState('');
  const [peerEvaluations, setPeerEvaluations] = useState([]);
  const [peerPendingCount, setPeerPendingCount] = useState(0);
  const [peerDeadline, setPeerDeadline] = useState(null);
  const [isPeerEvaluationExpired, setIsPeerEvaluationExpired] = useState(false);
  const [peerLoading, setPeerLoading] = useState(false);
  const [peerError, setPeerError] = useState('');
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [selectedPeerEvaluation, setSelectedPeerEvaluation] = useState(null);
  const [peerModalMode, setPeerModalMode] = useState('create');
  const [peerModalRecord, setPeerModalRecord] = useState(null);
  const [peerModalLoading, setPeerModalLoading] = useState(false);
  const [peerModalError, setPeerModalError] = useState('');
  const [peerModalSuccess, setPeerModalSuccess] = useState('');
  const loadInstructorDashboardStats = async (showLoading = false) => {
    if (showLoading) setDashboardStatsLoading(true);
    try {
      const stats = await courseAssignmentApi.getInstructorDashboardStats();
      setDashboardStats({
        assignedCourses: Number(stats?.assignedCourses) || 0,
        receivedPeerEvaluations: Number(stats?.receivedPeerEvaluations) || 0,
        totalCourses: Number(stats?.totalCourses) || 0,
        totalStudents: Number(stats?.totalStudents) || 0,
        averageScore: Number(stats?.averageScore) || 0,
      });
    } catch (error) {
      console.error('Instructor dashboard stats load failed:', error);
      setDashboardStats(null);
    } finally {
      if (showLoading) setDashboardStatsLoading(false);
    }
  };
  const academicYear = selectedAcademicYear || activeAcademicYear;
  const academicYearOptions = useMemo(() => [...new Set([
    activeAcademicYear,
    ...adminData.academicYears.map(({ name }) => name),
  ])].filter(Boolean).sort((first, second) => second.localeCompare(first)), [activeAcademicYear]);

  useEffect(() => {
    let isMounted = true;
    adminApi.getEvaluationWindow()
      .then((cycle) => {
        if (isMounted && cycle?.academicYear) {
          setActiveAcademicYear(cycle.academicYear);
          setSelectedAcademicYear('');
        }
      })
      .catch((error) => console.warn('Unable to load the active academic year:', error));
    return () => { isMounted = false; };
  }, []);

  const loadPeerEvaluations = async () => {
    setPeerLoading(true);
    setPeerError('');
    try {
      const data = await courseAssignmentApi.getPeerEvaluations();
      if (data && typeof data === 'object' && Array.isArray(data.evaluations)) {
        const evaluations = data.isExpired ? [] : data.evaluations;
        const eligibleEvaluations = isLabAssistantRole(profile?.role || authUser?.role)
          ? evaluations.filter((item) => isLabAssistantRole(item.target_role))
          : evaluations.filter((item) => !isLabAssistantRole(item.target_role));
        setPeerEvaluations(eligibleEvaluations);
        setPeerPendingCount(eligibleEvaluations.filter((item) =>
          item.status === 'pending' &&
          !item.is_evaluated &&
          !['submitted', 'completed', 'approved', 'evaluated'].includes(
            String(item.submission_status || item.evaluation_status || '').toLowerCase(),
          ),
        ).length);
        setPeerDeadline(data.deadline || eligibleEvaluations.find((item) => item.deadline || item.expiryDate)?.deadline || eligibleEvaluations.find((item) => item.expiryDate)?.expiryDate || null);
        setIsPeerEvaluationExpired(Boolean(data.isExpired));
        if (data.isExpired) {
          setShowPeerModal(false);
          setSelectedPeerEvaluation(null);
        }
      } else if (Array.isArray(data)) {
        const eligibleEvaluations = isLabAssistantRole(profile?.role || authUser?.role)
          ? data.filter((item) => isLabAssistantRole(item.target_role))
          : data.filter((item) => !isLabAssistantRole(item.target_role));
        setPeerEvaluations(eligibleEvaluations);
        setPeerPendingCount(eligibleEvaluations.filter((item) =>
          item.status === 'pending' &&
          !item.is_evaluated &&
          !['submitted', 'completed', 'approved', 'evaluated'].includes(
            String(item.submission_status || item.evaluation_status || '').toLowerCase(),
          ),
        ).length);
        setPeerDeadline(eligibleEvaluations.find((item) => item.deadline || item.expiryDate)?.deadline || eligibleEvaluations.find((item) => item.expiryDate)?.expiryDate || null);
        setIsPeerEvaluationExpired(false);
      } else if (data?.success === false) {
        setPeerError(data?.message || t('Unable to load peer evaluations.'));
        setPeerEvaluations([]);
        setPeerPendingCount(0);
        setPeerDeadline(null);
        setIsPeerEvaluationExpired(false);
      } else {
        setPeerEvaluations([]);
        setPeerPendingCount(0);
        setPeerDeadline(data?.deadline || null);
        setIsPeerEvaluationExpired(Boolean(data?.isExpired));
      }
    } catch (error) {
      console.error('Peer evaluations load failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      setPeerError(error.response?.data?.message || error?.message || t('Unable to load peer evaluations.'));
      setPeerEvaluations([]);
      setPeerPendingCount(0);
      setPeerDeadline(null);
      setIsPeerEvaluationExpired(false);
    } finally {
      setPeerLoading(false);
    }
  };

  const getInstructorFullName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.user?.first_name && profile?.user?.last_name) {
      return `${profile.user.first_name} ${profile.user.last_name}`;
    }
    if (profile?.full_name && profile.full_name.trim() !== '') {
      return profile.full_name;
    }
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser?.first_name && storedUser?.last_name) {
      return `${storedUser.first_name} ${storedUser.last_name}`;
    }
    return profile?.username || storedUser?.username || t('Instructor');
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const profileData = await authApi.me().catch(() => null);
        if (isMounted) {
          setProfile(profileData || authUser || null);
        }
      } catch {
        if (isMounted) {
          setProfile(authUser || null);
        }
      }
    };

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [authUser]);

  useEffect(() => {
    const handleDispatchUpdate = () => {
      void loadInstructorDashboardStats();
      if (activeView === 'peerEvaluation') {
        void loadPeerEvaluations();
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadInstructorDashboardStats();
    };

    window.addEventListener(SUBMISSIONS_UPDATED_EVENT, handleDispatchUpdate);
    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, handleDispatchUpdate);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const intervalId = window.setInterval(loadInstructorDashboardStats, 30000);
    return () => {
      window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, handleDispatchUpdate);
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, handleDispatchUpdate);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(intervalId);
    };
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'overview') {
      void loadInstructorDashboardStats(true);
      void loadPeerEvaluations();
    }
    if (activeView !== 'peerEvaluation') return;
    void loadPeerEvaluations();
  }, [activeView]);

  useEffect(() => {
    if (!['overview', 'courses'].includes(activeView)) return;
    let mounted = true;
    setAssignedCoursesLoading(true);
    setAssignedCoursesError('');
    courseAssignmentApi.getInstructorAssignments()
      .then((rows) => { if (mounted) setAssignedCourses(Array.isArray(rows) ? rows : []); })
      .catch((error) => { if (mounted) setAssignedCoursesError(error?.message || t('Unable to load assigned courses.')); })
      .finally(() => { if (mounted) setAssignedCoursesLoading(false); });
    return () => { mounted = false; };
  }, [activeView]);

  const sidebarItems = [
    { key: 'overview', label: strings.instructorDashboard.reviewEvaluations, icon: FaClipboardCheck, active: activeView === 'overview' },
    { key: 'peerEvaluation', label: strings.instructorDashboard.peerEvaluation, icon: FaUsers, active: activeView === 'peerEvaluation' },
    { key: 'performanceDashboard', label: t('My Evaluation Feedback'), icon: FaChartBar, active: activeView === 'performanceDashboard' },
  ];


  const openPeerModal = (evaluation, mode = 'create', record = null) => {
    setSelectedPeerEvaluation(evaluation);
    setPeerModalMode(mode);
    setPeerModalRecord(record);
    setPeerModalError('');
    setPeerModalSuccess('');
    setShowPeerModal(true);
  };

  const handlePeerEvaluationSubmit = async (payload) => {
    setPeerModalLoading(true);
    setPeerModalError('');
    setPeerModalSuccess('');
    try {
      await evaluationApi.submitPeerEvaluationForm(payload);
      setPeerModalSuccess(t('Peer evaluation submitted successfully.'));
      setShowPeerModal(false);
      setPeerEvaluations((current) => current.map((item) => (item.id === payload.peer_evaluation_id ? { ...item, status: 'completed' } : item)));
      setPeerPendingCount((count) => Math.max(0, count - 1));
      setPeerModalLoading(false);
      window.dispatchEvent(new CustomEvent(SUBMISSIONS_UPDATED_EVENT, { detail: { type: 'peer-submission' } }));
    } catch (submitError) {
      console.error(submitError);
      setPeerModalError(submitError?.message || t('Unable to submit peer evaluation.'));
      setPeerModalLoading(false);
      throw submitError;
    }
  };

  const renderContent = () => {
    if (activeView === 'peerEvaluation') {
      const isPeerPeriodClosed = isPeerEvaluationExpired ||
        (!peerLoading && !peerError && peerPendingCount === 0);
      return (
        <section className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{strings.instructorDashboard.peerEvaluationTitle}</h2>
                <p className="text-sm text-gray-500">{strings.instructorDashboard.peerEvaluationDesc}</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 font-medium text-sm rounded-full">
                {peerPendingCount} {t('pending')}
              </span>
            </div>

            {isPeerPeriodClosed ? (
              <EvaluationPeriodStatus isClosed />
            ) : (
              <>
                <EvaluationPeriodStatus deadline={peerDeadline} highlightDeadline />
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Instructor')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Deadline')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {peerLoading ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-sm text-gray-500">{t('Loading peer evaluations...')}</td>
                    </tr>
                  ) : peerError ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-sm text-red-600">{peerError}</td>
                    </tr>
                  ) : peerEvaluations.length ? (
                    peerEvaluations.map((row, index) => {
                      const isComplete = row.status === 'completed' || row.status === 'submitted' || row.is_evaluated || row.evaluation_status === 'submitted';
                      const scoreValue = Number(row?.total_score ?? row?.score ?? row?.totalScore ?? row?.overall_score ?? 0) || 0;
                      const deadline = [row.deadline, row.expiryDate, peerDeadline].find((candidate) =>
                        candidate != null && !['', '-', '—'].includes(String(candidate).trim()),
                      );

                      return (
                        <tr key={`peer-${row.id}-${index}`} className="border-b border-gray-100">
                          <td className="px-4 py-4 text-sm font-medium text-gray-900"><span className="block">{row.instructor_name || t('Instructor')}</span>{['lab_assistant', 'ara'].includes(String(row.target_role || '').toLowerCase()) && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{t('Lab Assistant (ARA)')}</span>}</td>
                          <td className="px-4 py-4 text-sm"><PeerEvaluationDeadlineBadge deadline={deadline} /></td>
                          <td className="px-4 py-4 text-sm">
                            {isComplete ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-emerald-600">✓ {t('Evaluated')} ({scoreValue}/100)</span>
                                <button
                                  type="button"
                                  onClick={() => openPeerModal(row, 'view', row)}
                                  className="text-sm font-semibold text-blue-600 underline transition-colors hover:text-blue-800"
                                >
                                  {t('View Details')}
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => openPeerModal(row, 'create', null)} className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700">
                                <FaStar className="mr-1" /> {t('Evaluate')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-sm text-gray-500">{t('No peer evaluations available')}</td>
                    </tr>
                  )}
                </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      );
    }

    if (activeView === 'performanceDashboard') {
      return <PerformanceDashboard />;
    }

    if (activeView === 'courses') {
      return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">{t('My Assigned Courses')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('Courses currently published to your account.')}</p>
          </div>
          {assignedCoursesError ? <p className="p-5 text-sm text-rose-700">{assignedCoursesError}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">{t('Course')}</th><th className="px-5 py-3">{t('Code')}</th><th className="px-5 py-3">{t('Year / Semester')}</th><th className="px-5 py-3">{t('Section')}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {assignedCoursesLoading ? <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-500">{t('Loading courses...')}</td></tr> : assignedCourses.length ? assignedCourses.map((course) => <tr key={course.id}><td className="px-5 py-4 font-medium text-slate-900">{course.course_name || t('Course')}</td><td className="px-5 py-4 text-slate-600">{course.course_code || '-'}</td><td className="px-5 py-4 text-slate-600">{[course.year_level, course.semester].filter(Boolean).join(' / ') || '-'}</td><td className="px-5 py-4 text-slate-600">{course.section || '-'}</td></tr>) : <tr><td colSpan="4" className="px-5 py-8 text-center text-slate-500">{t('No published courses are assigned.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {[
            { label: 'Assigned Courses', value: dashboardStatsLoading ? '...' : dashboardStats?.assignedCourses ?? '—', note: 'Courses assigned for evaluation', icon: BookOpen, theme: 'blue', action: () => setActiveView('courses') },
            { label: 'Peer Evaluations Received', value: dashboardStatsLoading ? '...' : dashboardStats?.receivedPeerEvaluations ?? '—', note: 'Peer reviews submitted for you', icon: Users, theme: 'violet', action: () => setActiveView('performanceDashboard') },
          ].map(({ label, value, note, icon: Icon, theme, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className={`group relative flex min-h-32 items-center gap-4 overflow-hidden rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${theme === 'blue' ? 'border-blue-100 bg-gradient-to-br from-blue-50 to-white' : 'border-violet-100 bg-gradient-to-br from-violet-50 to-white'}`}
            >
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${theme === 'blue' ? 'bg-blue-600' : 'bg-violet-600'}`}><Icon size={24} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${theme === 'blue' ? 'text-blue-800' : 'text-violet-800'}`}>{t(label)}</span>
                <span className="mt-1 block text-3xl font-bold tabular-nums text-slate-900">{value}</span>
                <span className="mt-1 block text-xs text-slate-500">{t(note)}</span>
              </span>
              <span className="self-stretch flex flex-col items-end justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm"><ArrowRight size={15} aria-hidden="true" /></span>
                <span className="text-[10px] font-semibold text-slate-400">{t('View details')}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total Courses', value: dashboardStatsLoading ? '...' : dashboardStats?.totalCourses ?? '—', note: 'Courses in your department', icon: BookOpen, theme: 'emerald', action: () => setActiveView('courses') },
            { label: 'Total Students', value: dashboardStatsLoading ? '...' : dashboardStats?.totalStudents ?? '—', note: 'Students in your department', icon: GraduationCap, theme: 'blue', action: () => setActiveView('courses') },
            { label: 'Evaluations Pending', value: peerLoading ? '...' : peerError ? '—' : peerPendingCount, note: 'Peer reviews awaiting your input', icon: Clock3, theme: 'amber', action: () => setActiveView('peerEvaluation') },
            { label: 'Average Score', value: dashboardStatsLoading ? '...' : dashboardStats ? dashboardStats.averageScore.toFixed(1) : '—', note: 'Average peer evaluation score', icon: Star, theme: 'rose', action: () => setActiveView('performanceDashboard') },
          ].map(({ label, value, note, icon: Icon, theme, action }) => {
            const tones = {
              emerald: 'border-emerald-100 bg-emerald-50/70 text-emerald-700 bg-emerald-500',
              blue: 'border-blue-100 bg-blue-50/70 text-blue-700 bg-blue-600',
              amber: 'border-amber-100 bg-amber-50/70 text-amber-700 bg-amber-500',
              rose: 'border-rose-100 bg-rose-50/70 text-rose-700 bg-rose-500',
            };
            const [border, background, labelTone, iconTone] = tones[theme].split(' ');
            return (
              <button
                key={label}
                type="button"
                onClick={action}
                className={`group flex min-h-24 items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${border} ${background}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${iconTone}`}><Icon size={17} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-xs font-semibold ${labelTone}`}>{t(label)}</span>
                  <span className="mt-0.5 block text-2xl font-bold tabular-nums text-slate-900">{value}</span>
                  <span className="block truncate text-[10px] text-slate-500">{t(note)}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ClipboardCheck size={17} aria-hidden="true" /></span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t('Recent Course Evaluations')}</h2>
                  <p className="text-[10px] text-slate-500">{t('Latest course evaluation activity and feedback.')}</p>
                </div>
              </div>
              <button type="button" onClick={() => setActiveView('performanceDashboard')} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-50">
                {t('View All')} <ArrowRight size={12} aria-hidden="true" />
              </button>
            </div>
            <div className="grid min-h-48 place-items-center px-5 py-8 text-center">
              <div>
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500"><Search size={22} aria-hidden="true" /></span>
                <h3 className="mt-3 text-sm font-semibold text-slate-700">{t('No Course Evaluations Yet')}</h3>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{t('Course evaluation feedback will appear here once students submit their evaluations.')}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Send size={17} aria-hidden="true" /></span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t('Quick Links')}</h2>
                <p className="text-[10px] text-slate-500">{t('Access your evaluation tools and feedback.')}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {[
                { label: 'Review Evaluations', description: 'View your course feedback', icon: ClipboardCheck, theme: 'blue', action: () => setActiveView('performanceDashboard') },
                { label: 'Peer Evaluation', description: 'Evaluate your peers', icon: Users, theme: 'violet', action: () => setActiveView('peerEvaluation') },
                { label: 'My Feedback', description: 'Read evaluation comments', icon: MessageSquareText, theme: 'emerald', action: () => setActiveView('performanceDashboard') },
              ].map(({ label, description, icon: Icon, theme, action }) => (
                <button key={label} type="button" onClick={action} className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${theme === 'blue' ? 'border-blue-100 bg-blue-50/60 hover:bg-blue-50' : theme === 'violet' ? 'border-violet-100 bg-violet-50/60 hover:bg-violet-50' : 'border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50'}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${theme === 'blue' ? 'bg-blue-600' : theme === 'violet' ? 'bg-violet-600' : 'bg-emerald-500'}`}><Icon size={16} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-800">{t(label)}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">{t(description)}</span>
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="instructor-dashboard-root h-full w-full min-w-0 overflow-hidden">
      {sidebarOpen ? <button type="button" aria-label={t('Close sidebar')} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="instructor-dashboard-shell grid h-full min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[256px_minmax(0,1fr)]">
        <aside className={`fixed bottom-0 left-0 top-16 z-50 h-auto w-64 flex-shrink-0 border-r border-white/15 bg-[#38A0DC] p-4 text-white shadow-xl transition-transform duration-300 lg:static lg:z-auto lg:block lg:h-full lg:w-64 lg:translate-x-0 lg:rounded-none lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">{strings.instructorDashboard.menu}</h3>
          <div className="space-y-2">
            {sidebarItems.map(({ label, icon: Icon, active, key }) => (
              <button key={label} type="button" onClick={() => { setActiveView(key); setSidebarOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left text-sm font-medium leading-5 transition ${active ? 'border-transparent bg-[#2B87BD] text-white shadow-none' : 'border-transparent text-white hover:bg-white/15 hover:text-white'}`}>
                <Icon className="shrink-0" />
                <span className="min-w-0 flex-1 truncate [overflow-wrap:normal]" title={label}>{label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="main-content min-h-0 min-w-0 space-y-5 overflow-y-auto p-4 sm:p-6">
          {activeView === 'overview' && (
            <header className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-sky-100 via-blue-50 to-cyan-50 px-5 py-4 shadow-sm sm:px-7">
              <div className="pointer-events-none absolute -right-12 -top-24 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
              <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mekdela Amba University</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{t('Welcome')}, {getInstructorFullName()}</h1>
                  <span className="mt-2 inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                    {t('Department')}: {profile?.department_name || profile?.department || t('N/A')}
                  </span>
                  <p className="mt-2 text-xs font-medium text-slate-600">{t('Quality teaching builds a stronger future')}</p>
                </div>
                <label className="relative z-10 inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                  <CalendarDays size={16} className="text-blue-700" aria-hidden="true" />
                  <span>{t('Academic Year')}</span>
                  <select
                    aria-label={t('Academic year')}
                    value={academicYear}
                    onChange={(event) => setSelectedAcademicYear(event.target.value === activeAcademicYear ? '' : event.target.value)}
                    className="max-w-28 cursor-pointer appearance-none bg-transparent pr-4 font-bold text-slate-800 outline-none"
                  >
                    {academicYearOptions.map((year) => <option key={year} value={year}>{t(year)}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2 text-slate-400" aria-hidden="true" />
                </label>
              </div>
            </header>
          )}
          {renderContent()}
        </main>
      </div>
      <PeerEvaluationModal
        open={showPeerModal}
        onClose={() => {
          setShowPeerModal(false);
          setPeerModalMode('create');
          setPeerModalRecord(null);
        }}
        evaluation={selectedPeerEvaluation || {}}
        sections={standardPeerEvaluationSections}
        onSubmit={handlePeerEvaluationSubmit}
        isSubmitting={peerModalLoading}
        successMessage={peerModalSuccess}
        errorMessage={peerModalError}
        mode={peerModalMode}
        evaluationRecord={peerModalRecord}
      />
    </div>
  );
};

export default InstructorDashboard;