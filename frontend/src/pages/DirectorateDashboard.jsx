import { useContext, useEffect, useState } from 'react';
import { Building2, CheckCircle2, ClipboardCheck, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { directorateApi, DASHBOARD_DATA_UPDATED_EVENT } from '../services/api';
import DeanPeerEvaluationView from '../components/DeanPeerEvaluationView';
import DirectorateDeanEvaluationView from '../components/DirectorateDeanEvaluationView';
import DeanPerformanceView from '../components/DeanPerformanceView';
import { evaluationApi } from '../services/api';
import { LanguageContext } from '../context/LanguageContext';
import InteractiveMetricCard from '../components/InteractiveMetricCard';
import {
  createOfficialLetterMetadata,
  OfficialLetterEndorsements,
  OfficialLetterHeader,
  OfficialLetterMetadataFields,
  OfficialLetterReference,
} from '../components/OfficialLetterMetadata';
import EvaluationScoreBreakdown from '../components/EvaluationScoreBreakdown';
import useUiText from '../hooks/useUiText';

const criteria = ['Leadership and institutional management', 'Academic quality assurance', 'Communication and stakeholder engagement', 'Planning, accountability, and reporting', 'Support for departments and faculty'];

const getReportBreakdown = (record) => {
  const isTeaching = Boolean(record.is_teaching ?? record.isTeaching ?? record.hasTeachingLoad);
  const studentAverage = Number(record.student_average ?? record.studentAverage ?? 0);
  const peerAverage = Number(record.peer_average ?? record.peerAverage ?? record.peerScore ?? 0);
  const supervisorAverage = Number(record.supervisor_score ?? record.supervisorScore ?? record.score ?? 0);
  const total = Number(record.final_score ?? record.totalScore ?? record.score ?? 0);
  return { isTeaching, studentAverage, peerAverage, supervisorAverage, total };
};

const CollegeDeanReports = ({ deans, onCalculate, calculating }) => {
  const t = useUiText();
  const [selectedDean, setSelectedDean] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const rows = (deans || []).map((dean) => ({ dean, breakdown: getReportBreakdown(dean) }));
  const clearCertificate = () => {
    setSelectedDean(null);
    setMetadata(null);
  };
  const openCertificate = (dean) => {
    setSelectedDean(dean);
    setMetadata(createOfficialLetterMetadata({
      referencePrefix: 'MAU/DIR',
      referenceId: dean.deanId,
      year: dean.academic_year || '',
      semester: dean.semester || '',
    }));
  };
  const score = getReportBreakdown(selectedDean || {}).total.toFixed(2);
  const hasPublishedResult = String(selectedDean?.evaluation_status || '').toLowerCase() === 'published';

  useEffect(() => {
    if (!selectedDean) return undefined;
    document.body.classList.add('print-result-letter');
    return () => document.body.classList.remove('print-result-letter');
  }, [selectedDean]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('College Dean Final Results')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('Calculate and publish the completed College Dean evaluations.')}</p>
        </div>
        <button type="button" onClick={onCalculate} disabled={calculating} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
          {calculating ? t('Calculating...') : t('Calculate & Publish Results')}
        </button>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{t('College Dean Reports and Certificates')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('View final evaluation results and print individual dean reports.')}</p>
          </div>
          <Download className="h-5 w-5 text-blue-700" />
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">{t('Name')}</th>
              <th className="px-3 py-3">{t('Role / College')}</th>
              <th className="px-3 py-3 text-right">{t('Final Score')}</th>
              <th className="px-3 py-3 text-right">{t('Action')}</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
            {rows.length ? rows.map(({ dean, breakdown }) => {
              const hasFinalResult = String(dean.evaluation_status || '').toLowerCase() === 'published'
                && dean.score !== null
                && dean.score !== undefined;
              return (
                <tr key={dean.deanId}>
                  <td className="px-3 py-3 font-medium">{dean.full_name || dean.username || t('College Dean')}</td>
                  <td className="px-3 py-3"><span className="capitalize">{String(dean.role || 'college_dean').replaceAll('_', ' ')}</span><span className="mt-1 block text-xs text-slate-500">{dean.college_name || dean.department_name || '—'}</span></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{hasFinalResult ? breakdown.total.toFixed(2) : '—'}</td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => openCertificate(dean)} disabled={!hasFinalResult} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Printer className="h-4 w-4" /> {t('Export / Print')}</button>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">{t('No finalized results are available.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {selectedDean && metadata && (
        <div className="result-letter fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 print:static print:overflow-visible print:bg-white print:p-0">
          <article className="result-letter__page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-6 text-[13px] leading-relaxed text-black shadow-2xl sm:p-10 print:min-h-0 print:max-h-none print:max-w-none print:overflow-visible print:p-4 print:shadow-none">
            <OfficialLetterHeader office="Academic Directorate" amharicOffice="የአካዳሚክ ዳይሬክቶሬት" />
            <OfficialLetterMetadataFields value={metadata} onChange={setMetadata} />
            <OfficialLetterReference metadata={metadata} />
            <p className="mt-5 font-bold">{t('To')}: {selectedDean.full_name || selectedDean.username || t('College Dean')}</p>
            <p className="mt-1 font-semibold">{selectedDean.college_name || t('College')}</p>
            <p className="mt-1 text-sm">
              {t('Role')}: {t('College Dean')} · {t('Teaching status')}: {selectedDean.is_teaching ? t('Teaching') : t('Non-teaching')}
              {selectedDean.username ? ` · ${t('Username')}: ${selectedDean.username}` : ''}
            </p>
            <h3 className="mt-4 text-base font-bold underline">{t('Subject: To notify {year} {semester} College Dean efficiency evaluation result').replace('{year}', metadata.year).replace('{semester}', metadata.semester)}</h3>
            <p className="mt-2" lang="am">ጉዳዩ፡ የ{metadata.year} {metadata.semester} የኮሌጅ ዲን የውጤታማነት ምዘና ውጤት</p>
            <p className="mt-3">{t('Dear Sir/Madam,')}</p>
            <p className="mt-2">{t('As it is mentioned above in the subject, the Academic Directorate would like to inform you of your {year} {semester} efficiency evaluation result. The summary of the overall evaluation is given in the table below.').replace('{year}', metadata.year).replace('{semester}', metadata.semester)}</p>
            <EvaluationScoreBreakdown
              isTeaching={selectedDean.is_teaching}
              studentScore={selectedDean.student_average}
              peerScore={selectedDean.peer_average}
              supervisorScore={selectedDean.supervisor_score}
              supervisorLabel={t('Academic Director')}
              finalScore={hasPublishedResult ? score : 0}
            />
            <div className="mt-4"><p className="font-bold">{t('Remarks')} / አስተያየት</p><p className="mt-1">➢ {t('The evaluation results showed that you have effectively accomplished your responsibility.')}</p><p className="mt-1">➢ {t('Finally, we strongly believe that you will maintain and improve your performance in the coming semester.')}</p></div>
            <OfficialLetterEndorsements signerTitle="Academic Directorate" organization="Mekdela Amba University" ccRecipients={['Human Resource Directorate', 'Educational Quality Improvement Directorate', `College: ${selectedDean.college_name || 'College'}`]} />
            <div className="mt-5 flex justify-end gap-3 print:hidden"><button type="button" onClick={clearCertificate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{t('Close')}</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"><Printer className="h-4 w-4" /> {t('Print Official Letter')}</button></div>
          </article>
        </div>
      )}
    </div>
  );
};

const EvaluateDeansView = ({ deans, onSubmit }) => {
  const t = useUiText();
  const [selected, setSelected] = useState(null);
  const [ratings, setRatings] = useState({});
  const [formData, setFormData] = useState({ strengths: '', weaknesses: '' });
  const { language, setLanguage } = useContext(LanguageContext);
   if (!selected) return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t('Evaluate College Deans')}</h2><p className="mt-1 text-sm text-slate-500">{t('Select a Dean to begin the evaluation.')}</p><div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">{t('College Dean')}</th><th className="px-4 py-3">{t('College')}</th><th className="px-4 py-3">{t('Status')}</th><th className="px-4 py-3">{t('Action')}</th></tr></thead><tbody className="divide-y divide-slate-100">{deans.length ? deans.map((dean) => <tr key={dean.deanId}><td className="px-4 py-4 font-medium">{dean.full_name}<span className="block text-xs font-normal text-slate-500">{dean.email}</span></td><td className="px-4 py-4">{dean.college_name}</td><td className="px-4 py-4">{dean.evaluation_status}</td><td className="px-4 py-4"><button type="button" onClick={() => { setSelected(dean); setRatings({}); setFormData({ strengths: '', weaknesses: '' }); }} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">★ {t('Evaluate')}</button></td></tr>) : <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-500">{t('No College Deans found.')}</td></tr>}</tbody></table></div></section>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><LanguageToggle language={language} onChange={setLanguage} /><div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{t('College Dean Evaluation')}</p><h2 className="mt-2 text-xl font-bold">{selected.full_name}</h2><p className="text-sm text-slate-500">{selected.college_name}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-2 text-sm">{t('Back to list')}</button></div><div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><strong>{t('Instructions')}:</strong> {t('Rate every criterion from 1 (Poor) to 5 (Excellent).')}</div><form onSubmit={(event) => { event.preventDefault(); onSubmit({ deanId: selected.deanId, ratings, ...formData }); setSelected(null); }} className="space-y-5">{criteria.map((criterion, index) => <div key={criterion} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-medium">{index + 1}. {t(criterion)}</p><div className="mt-3 flex gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => setRatings((current) => ({ ...current, [index]: rating }))} className={`h-10 w-10 rounded-full font-bold ${ratings[index] === rating ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{rating}</button>)}</div></div>)}<label className="block text-sm font-medium">{t('Strengths / Key Achievements')}<textarea rows="3" value={formData.strengths} onChange={(event) => setFormData((current) => ({ ...current, strengths: event.target.value }))} className="mt-2 w-full rounded-xl border px-3 py-3" /></label><label className="block text-sm font-medium">{t('Areas for Improvement / Growth Opportunities')}<textarea rows="3" value={formData.weaknesses} onChange={(event) => setFormData((current) => ({ ...current, weaknesses: event.target.value }))} className="mt-2 w-full rounded-xl border px-3 py-3" /></label><button type="submit" disabled={Object.keys(ratings).length !== criteria.length} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300">{t('Submit Evaluation')}</button></form></section>;
};

  const DirectorateDashboard = () => {
    const t = useUiText();
  const { user } = useAuth(); const location = useLocation(); const navigate = useNavigate();
    const { strings } = useContext(LanguageContext); const common = strings.common;
    const metricCards = [{ key: 'totalColleges', label: common.totalColleges, icon: Building2 }, { key: 'pendingDeans', label: common.pendingDeanEvaluations, icon: ClipboardCheck }, { key: 'completedDeans', label: common.completedEvaluations, icon: CheckCircle2 }];
  const [activeTab, setActiveTab] = useState('overview'); const [evaluationFilter, setEvaluationFilter] = useState('all'); const [stats, setStats] = useState({}); const [deans, setDeans] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [calculatingResults, setCalculatingResults] = useState(false);
  useEffect(() => { const hash = location.hash.replace('#', '') || 'overview'; setActiveTab(['overview', 'evaluate-deans', 'peer-evaluation', 'reports', 'my-performance', 'settings'].includes(hash) ? hash : 'overview'); }, [location.hash]);
  const loadData = async (quiet = false) => { if (!quiet) { setLoading(true); setError(''); } try { const [overview, deanRows] = await Promise.all([directorateApi.getOverviewStats(), directorateApi.getDeans()]); setStats(overview || {}); setDeans(Array.isArray(deanRows) ? deanRows : []); } catch (loadError) { setStats({ totalColleges: 0, pendingDeans: 0, completedDeans: 0 }); setDeans([]); setError(loadError?.message || t('Unable to load Directorate data.')); } finally { if (!quiet) setLoading(false); } };
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadData(true);
    };
    void loadData();
    const intervalId = window.setInterval(() => void loadData(true), 30000);
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
  const submitEvaluation = async (payload) => { try { await directorateApi.evaluateDean(payload); setMessage(t('College Dean evaluation submitted successfully.')); await loadData(); } catch (submitError) { setError(submitError?.message || t('Unable to submit evaluation.')); throw submitError; } };
  const calculateAndPublishResults = async () => {
    if (calculatingResults) return;
    setCalculatingResults(true);
    setMessage('');
    setError('');
    try {
      const result = await directorateApi.calculatePublishResults();
      await loadData();
      const successMessage = `${result?.count || 0} ${t('College Dean result(s) calculated and published.')}`;
      setMessage(successMessage);
      toast.success(successMessage);
    } catch (calculationError) {
      const errorMessage = calculationError?.response?.data?.message || calculationError?.message || t('Unable to calculate and publish College Dean results.');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCalculatingResults(false);
    }
  };
  const reportRows = deans.map((dean) => ({ Dean: dean.full_name, College: dean.college_name, Status: dean.evaluation_status, Score: dean.score }));
  const downloadReport = () => { const csv = ['Dean,College,Status,Score', ...reportRows.map((row) => [row.Dean, row.College, row.Status, row.Score].map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(','))].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'directorate-evaluation-report.csv'; link.click(); };
  const renderPeerEvaluation = () => activeTab === 'peer-evaluation' ? <DeanPeerEvaluationView /> : null;
  const openMetricView = (key) => {
    if (key === 'completedDeans') {
      navigate('/directorate/dashboard#reports');
      return;
    }
    setEvaluationFilter(key === 'pendingDeans' ? 'pending' : 'all');
    navigate('/directorate/dashboard#evaluate-deans');
  };
  const renderView = () => {
    if (loading) return <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">{t('Loading Directorate data...')}</div>;
    if (activeTab === 'evaluate-deans') {
      const visibleDeans = evaluationFilter === 'pending'
        ? deans.filter((dean) => !['completed', 'published'].includes(String(dean.evaluation_status || '').toLowerCase()))
        : deans;
      return <EvaluateDeansView deans={visibleDeans} onSubmit={submitEvaluation} />;
    }
    if (activeTab === 'my-performance') return <DeanPerformanceView loadReport={evaluationApi.getPerformanceDashboard} sourceLabels={{ student: t('Students'), peer: t('Peers (Colleagues)'), deptHead: t('Department Head') }} />;
    if (activeTab === 'analytics') return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t('Institutional Analytics')}</h2><div className="mt-6 space-y-4">{analytics.map((row) => <div key={`${row.collegeId}-${row.departmentId || 'all'}`}><div className="flex justify-between text-sm"><span>{row.college_name} / {row.department_name}</span><strong>{row.performance}%</strong></div><div className="mt-1 h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.min(100, row.performance)}%` }} /></div><p className="mt-1 text-xs text-slate-500">{t('College and department comparison')}</p></div>)}</div></section>;
    if (activeTab === 'reports') return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t('System Reports')}</h2><p className="mt-1 text-sm text-slate-500">{t('Export institution-wide Dean evaluations.')}</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={downloadReport} className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><Download className="h-4 w-4" /> {t('Export Excel-compatible CSV')}</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800"><Printer className="h-4 w-4" /> {t('Print / PDF')}</button></div></section>;
    if (activeTab === 'settings') return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t('Directorate Settings')}</h2><p className="mt-2 text-sm text-slate-600">{t('Evaluation cycle and account preferences are managed here.')}</p><label className="mt-6 flex items-center gap-3 text-sm"><input type="checkbox" defaultChecked /> {t('Enable evaluation reminders')}</label></section>;
    return <>
      <header className="rounded-3xl border border-blue-100 bg-blue-50 px-6 py-7">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Mekdela Amba University</p>
        <h1 className="mt-3 text-3xl font-bold text-blue-950">{t('Welcome')}, {user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || t('Academic Directorate')}</h1>
        <p className="mt-2 text-sm text-blue-800">{t('Institution-wide evaluation oversight and cycle control.')}</p>
      </header>
      <div className="dashboard-grid min-w-0">
        {metricCards.map(({ key, label, icon }) => <InteractiveMetricCard key={key} label={label} value={stats[key] ?? 0} icon={icon} tone={key === 'totalColleges' ? 'cyan' : key === 'pendingDeans' ? 'amber' : 'emerald'} onClick={() => openMetricView(key)} />)}
      </div>
    </>;
  };
  const renderDashboardView = () => {
    if (activeTab === 'analytics') return null;
    if (activeTab === 'reports') return <CollegeDeanReports deans={deans} onCalculate={calculateAndPublishResults} calculating={calculatingResults} />;
    return renderView();
  };
  return <section className="w-full min-w-0 space-y-6" aria-labelledby="directorate-dashboard-title"><BackButton />{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}{message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div> : null}{activeTab === 'evaluate-deans' ? <DirectorateDeanEvaluationView deans={deans} onSubmit={submitEvaluation} /> : renderPeerEvaluation() || renderDashboardView()}</section>;
};

export default DirectorateDashboard;
