import { useContext, useEffect, useState } from 'react';
import { Building2, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { deanApi, DASHBOARD_DATA_UPDATED_EVENT } from '../services/api';
import { LanguageContext } from '../context/LanguageContext';
import EvaluateDeptHeads from './EvaluateDeptHeads';
import DeanPerformanceView from '../components/DeanPerformanceView';
import DeanPeerEvaluationView from '../components/DeanPeerEvaluationView';
import ResultCertificateActions from '../components/ResultCertificateActions';
import InteractiveMetricCard from '../components/InteractiveMetricCard';

const CollegeDeanDashboard = () => {
  const { user } = useAuth();
  const { strings } = useContext(LanguageContext);
  const common = strings.common;
  const navigate = useNavigate();
  const metricCards = [
    { key: 'departmentsCount', label: common.totalDepartments, icon: Building2 },
    { key: 'pendingDeptHeadEvals', label: common.pendingDeanEvaluations, icon: ClipboardCheck },
    { key: 'completedEvals', label: common.completedEvaluations, icon: CheckCircle2 },
  ];
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [calculatingResults, setCalculatingResults] = useState(false);
  const [reportsKey, setReportsKey] = useState(0);

  useEffect(() => {
    const hashTab = { 'evaluate-heads': 'evaluate' }[location.hash.replace('#', '')] || location.hash.replace('#', '') || 'overview';
    setActiveTab(['overview', 'evaluate', 'peer-evaluation', 'reports', 'my-performance'].includes(hashTab) ? hashTab : 'overview');
  }, [location.hash]);

  const loadOverview = async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError('');
    }
    try {
      const [overview] = await Promise.all([
        deanApi.getOverviewStats(),
      ]);
      setStats(overview || {});
    } catch (loadError) {
      setStats({ departmentsCount: 0, pendingDeptHeadEvals: 0, completedEvals: 0 });
      setError(loadError?.message || 'Unable to load college dean dashboard.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadOverview(true);
    };
    void loadOverview();
    const intervalId = window.setInterval(() => void loadOverview(true), 30000);
    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const calculateDepartmentHeadResults = async () => {
    setCalculatingResults(true);
    setError('');
    try {
      const result = await deanApi.calculateDepartmentHeadResults();
      setMessage(`${result?.count || 0} Department Head result(s) calculated and published.`);
      setReportsKey((current) => current + 1);
    } catch (calculationError) {
      setError(calculationError?.message || 'Unable to calculate Department Head results.');
    } finally {
      setCalculatingResults(false);
    }
  };

  return (
    <section className="w-full min-w-0 space-y-6" aria-labelledby="dean-dashboard-title">
      {activeTab === 'overview' ? <header className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50 px-6 py-7 sm:px-8 sm:py-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Mekdela Amba University</p>
        <h1 id="dean-dashboard-title" className="mt-3 text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">Welcome, {user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'College Dean'}</h1>
        <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm">College Dean</span><span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">College-level access</span></div>
      </header> : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{common.collegeDataLoading}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div> : null}

      {!loading && activeTab === 'overview' ? <>
        <div className="dashboard-grid min-w-0">{metricCards.map(({ key, label, icon }) => <InteractiveMetricCard key={key} label={label} value={stats[key] ?? 0} icon={icon} tone={key === 'departmentsCount' ? 'cyan' : key === 'pendingDeptHeadEvals' ? 'amber' : 'emerald'} onClick={() => navigate(`/dean/dashboard#${key === 'completedEvals' ? 'reports' : 'evaluate-heads'}`)} />)}</div>
      </> : null}

      {!loading && activeTab === 'evaluate' ? <EvaluateDeptHeads /> : null}
      {!loading && activeTab === 'peer-evaluation' ? <DeanPeerEvaluationView /> : null}
      {!loading && activeTab === 'reports' ? <>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h2 className="text-xl font-bold text-slate-900">{common.departmentHeadFinalResults}</h2><p className="mt-1 text-sm text-slate-500">{common.calculatePublishResults}</p></div>
          <button type="button" onClick={() => void calculateDepartmentHeadResults()} disabled={calculatingResults} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{calculatingResults ? common.calculating : common.calculatePublishResults}</button>
        </div>
        <ResultCertificateActions key={reportsKey} title="Department Head Result Certificates" audience="college" />
      </> : null}
      {!loading && activeTab === 'my-performance' ? <DeanPerformanceView /> : null}
    </section>
  );
};

export default CollegeDeanDashboard;
