import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ClipboardCheck, Printer, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import DirectorateDeanEvaluationView from '../components/DirectorateDeanEvaluationView';
import InteractiveMetricCard from '../components/InteractiveMetricCard';
import { DASHBOARD_DATA_UPDATED_EVENT, vicePresidentApi } from '../services/api';
import formatEvaluationDeadline from '../utils/formatEvaluationDeadline';
import {
  createOfficialLetterMetadata,
  OfficialLetterEndorsements,
  OfficialLetterHeader,
  OfficialLetterMetadataFields,
  OfficialLetterReference,
} from '../components/OfficialLetterMetadata';
import EvaluationScoreBreakdown from '../components/EvaluationScoreBreakdown';

const dashboardTabs = new Set(['overview', 'evaluate-academic-directorate', 'reports']);

const getStatus = (person) => String(person.evaluation_status || '').toLowerCase();
const isEvaluated = (person) => ['completed', 'published', 'approved'].includes(getStatus(person));
const isPublished = (person) => getStatus(person) === 'published';
const displayName = (person) => person.full_name || person.username || 'Academic Directorate staff';
const VicePresidentDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculatingResults, setCalculatingResults] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reportPerson, setReportPerson] = useState(null);
  const [letterMetadata, setLetterMetadata] = useState(null);

  const activeTab = dashboardTabs.has(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  const completedCount = useMemo(() => staff.filter(isEvaluated).length, [staff]);
  const pendingCount = staff.length - completedCount;

  const loadAcademicDirectorate = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setLoadError('');
    try {
      const result = await vicePresidentApi.getAcademicDirectorate();
      setCycle(result.cycle || null);
      setStaff(Array.isArray(result.staff) ? result.staff : []);
    } catch (error) {
      setLoadError(error.message || 'Unable to load Academic Directorate staff.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAcademicDirectorate();
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadAcademicDirectorate(false);
    };
    const intervalId = window.setInterval(refresh, 30000);
    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadAcademicDirectorate]);

  useEffect(() => {
    if (!reportPerson) return undefined;
    document.body.classList.add('print-result-letter');
    return () => document.body.classList.remove('print-result-letter');
  }, [reportPerson]);

  const submitEvaluation = async ({ deanId, ratings, strengths, weaknesses }) => {
    await vicePresidentApi.evaluateAcademicDirectorate({
      academicDirectorateId: deanId,
      ratings,
      strengths,
      weaknesses,
    });
    toast.success('Academic Directorate evaluation saved.');
    await loadAcademicDirectorate(false);
  };

  const openTab = (tab) => navigate(`/vice-president/dashboard#${tab}`);
  const calculateAndPublishResults = async () => {
    if (calculatingResults) return;
    setCalculatingResults(true);
    try {
      const result = await vicePresidentApi.calculatePublishResults();
      toast.success(`${result?.count || 0} Academic Directorate result(s) calculated and published.`);
      await loadAcademicDirectorate(false);
    } catch (error) {
      toast.error(error.message || 'Unable to calculate and publish Vice President results.');
    } finally {
      setCalculatingResults(false);
    }
  };
  const closeCertificate = () => {
    setReportPerson(null);
    setLetterMetadata(null);
  };
  const openCertificate = (person) => {
    setReportPerson(person);
    setLetterMetadata(createOfficialLetterMetadata({
      referencePrefix: 'MAU/VP',
      referenceId: person.academicDirectorateId,
      year: person.academic_year || cycle?.academicYear || '',
      semester: person.semester || cycle?.semester || '',
    }));
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" />
        Loading Vice President dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <div className="flex-1">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadAcademicDirectorate()} className="mt-2 font-semibold underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {!loadError && !cycle && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          There is no active evaluation cycle. The staff directory is available, but new evaluations and current-cycle results are unavailable.
        </p>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-blue-100 bg-blue-50 px-6 py-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Mekdela Amba University</p>
            <h1 className="mt-3 text-3xl font-bold text-blue-950">Vice President Overview</h1>
            <p className="mt-2 text-sm text-blue-800">Review Academic Directorate evaluations and current cycle progress.</p>
            {cycle && (
              <p className="mt-3 text-sm font-semibold text-blue-950">
                Cycle: {cycle.academicYear} · Semester {cycle.semester}
                {cycle.deadline ? ` · Deadline: ${formatEvaluationDeadline(cycle.deadline)}` : ''}
              </p>
            )}
          </section>
          <div className="dashboard-grid min-w-0">
            <InteractiveMetricCard label="Academic Directorate Staff" value={staff.length} icon={Users} tone="cyan" onClick={() => openTab('evaluate-academic-directorate')} />
            <InteractiveMetricCard label="Pending Evaluations" value={pendingCount} icon={ClipboardCheck} tone="amber" onClick={() => openTab('evaluate-academic-directorate')} />
            <InteractiveMetricCard label="Completed Evaluations" value={completedCount} icon={CheckCircle2} tone="emerald" onClick={() => openTab('reports')} />
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Evaluation progress</h2>
                <p className="mt-1 text-sm text-slate-600">{completedCount} of {staff.length} staff evaluations completed.</p>
              </div>
              <button type="button" onClick={() => openTab('evaluate-academic-directorate')} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!cycle}>
                Evaluate Academic Directorate
              </button>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Evaluation progress" aria-valuemin={0} aria-valuemax={staff.length} aria-valuenow={completedCount}>
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${staff.length ? (completedCount / staff.length) * 100 : 0}%` }} />
            </div>
          </section>
        </div>
      )}

      {activeTab === 'evaluate-academic-directorate' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
            <h2 className="text-lg font-bold">Academic Directorate evaluation</h2>
            <p className="mt-1 text-sm">Rate each criterion from 1–5 or select NA. Completed evaluations can be reviewed from the list.</p>
            {cycle && (
              <p className="mt-2 text-sm font-semibold">
                Cycle: {cycle.academicYear} · Semester {cycle.semester}
                {cycle.deadline ? ` · Deadline: ${formatEvaluationDeadline(cycle.deadline)}` : ''}
              </p>
            )}
          </section>
          {cycle ? (
            <DirectorateDeanEvaluationView
              deans={staff.map((person) => ({ ...person, deanId: person.academicDirectorateId }))}
              onSubmit={submitEvaluation}
              targetLabel="Academic Directorate Staff"
              scopeLabel="Department"
            />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Start an evaluation cycle to submit staff evaluations.
            </section>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-5">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Academic Directorate Final Results</h2>
              <p className="mt-1 text-sm text-slate-500">Calculate and publish completed Vice President evaluations.</p>
            </div>
            <button type="button" onClick={() => void calculateAndPublishResults()} disabled={calculatingResults || !cycle || completedCount === 0} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
              {calculatingResults ? 'Calculating...' : 'Calculate & Publish Results'}
            </button>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Academic Directorate Result Certificates</h2>
              <p className="mt-1 text-sm text-slate-500">Export official result letters for published evaluations.</p>
            </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Final Score</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.filter(isPublished).length ? staff.filter(isPublished).map((person) => (
                  <tr key={person.academicDirectorateId}>
                    <td className="px-3 py-3 font-medium">{displayName(person)}</td>
                    <td className="px-3 py-3 capitalize">{String(person.role || 'academic_directorate').replaceAll('_', ' ')}</td>
                    <td className="px-3 py-3">{person.department_name || 'University-wide'}</td>
                    <td className="px-3 py-3 font-semibold">{Number(person.score || 0).toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => openCertificate(person)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">
                        <Printer className="h-4 w-4" /> Export / Print
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No published results are available. Complete evaluations, then calculate and publish results.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          </section>
        </div>
      )}

      {reportPerson && letterMetadata && (
        <div className="result-letter fixed inset-0 z-[80] overflow-y-auto bg-black/40 p-4 print:static print:overflow-visible print:bg-white print:p-0">
          <article className="result-letter__page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-6 text-[13px] leading-relaxed text-black shadow-2xl sm:p-10 print:min-h-0 print:max-h-none print:max-w-none print:overflow-visible print:p-4 print:shadow-none">
            <OfficialLetterHeader office="Office of the Vice President" amharicOffice="የምክትል ፕሬዝዳንት ጽሕፈት ቤት" />
            <OfficialLetterMetadataFields value={letterMetadata} onChange={setLetterMetadata} />
            <OfficialLetterReference metadata={letterMetadata} />
            <p className="mt-5 font-bold">To: {displayName(reportPerson)}</p>
            <p className="mt-1 font-semibold">{reportPerson.department_name || 'Academic Directorate'}</p>
            <p className="mt-1 text-sm">
              Role: Academic Director · Teaching status: {reportPerson.is_teaching ? 'Teaching' : 'Non-teaching'}
              {reportPerson.username ? ` · Username: ${reportPerson.username}` : ''}
            </p>
            <h3 className="mt-4 text-base font-bold underline">Subject: To notify {letterMetadata.year} {letterMetadata.semester} efficiency evaluation result</h3>
            <p className="mt-2" lang="am">ጉዳዩ፡ የ{letterMetadata.year} {letterMetadata.semester} የአካዳሚክ ዳይሬክቶሬት የውጤታማነት ምዘና ውጤት</p>
            <p className="mt-3">Dear Sir/Madam,</p>
            <p className="mt-2">
              As it is mentioned above in the subject, the Office of the Vice President would like to inform you of your
              {' '}{letterMetadata.year} {letterMetadata.semester} efficiency evaluation result. The summary of the overall evaluation is given in the table below.
            </p>
            <EvaluationScoreBreakdown
              isTeaching={reportPerson.is_teaching}
              studentScore={reportPerson.student_average}
              peerScore={reportPerson.peer_average}
              supervisorScore={reportPerson.supervisor_score ?? reportPerson.score}
              supervisorLabel="Vice President"
              finalScore={reportPerson.score}
            />
            <div className="mt-4">
              <p className="font-bold">Remarks / አስተያየት</p>
              <p className="mt-1"><strong>Strengths:</strong> {reportPerson.strengths || 'No additional strengths recorded.'}</p>
              <p className="mt-1"><strong>Areas for improvement:</strong> {reportPerson.weaknesses || 'No additional improvement areas recorded.'}</p>
              <p className="mt-1">We encourage you to maintain and further improve your performance in the coming academic year.</p>
            </div>
            <OfficialLetterEndorsements signerTitle="Vice President" organization="Mekdela Amba University" ccRecipients={['Human Resource Directorate', 'Educational Quality Improvement Directorate', reportPerson.department_name || 'Academic Directorate']} />
            <div className="mt-8 flex justify-end gap-3 print:hidden">
              <button type="button" onClick={closeCertificate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Close</button>
              <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Print Official Letter</button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
};

export default VicePresidentDashboard;
