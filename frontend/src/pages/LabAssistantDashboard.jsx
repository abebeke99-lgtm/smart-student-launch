import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Award, BookOpen, CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronDown, Eye, GraduationCap, Sparkles, Star, UserRound, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { courseAssignmentApi, DASHBOARD_DATA_UPDATED_EVENT, evaluationApi } from '../services/api';
import { SUBMISSIONS_UPDATED_EVENT } from '../services/formSubmissions';
import PeerEvaluationModal, { standardPeerEvaluationSections } from '../components/PeerEvaluationModal';
import PeerEvaluationDeadlineBadge from '../components/PeerEvaluationDeadlineBadge';

const evaluationSources = [
  { key: 'student', label: 'Students', weight: '50%', icon: BookOpen },
  { key: 'deptHead', label: 'Department Head', weight: '30%', icon: Award },
  { key: 'peer', label: 'Instructors / Peers', weight: '20%', icon: Users },
];

const formatScore = (value) => `${Number(value || 0).toFixed(1)}%`;
const metricToneClasses = {
  blue: { card: 'border-blue-100 bg-blue-50/70', icon: 'bg-blue-600 text-white', arrow: 'text-blue-600', link: 'text-blue-700' },
  green: { card: 'border-emerald-100 bg-emerald-50/70', icon: 'bg-emerald-500 text-white', arrow: 'text-emerald-600', link: 'text-emerald-700' },
  purple: { card: 'border-violet-100 bg-violet-50/70', icon: 'bg-violet-600 text-white', arrow: 'text-violet-600', link: 'text-violet-700' },
  amber: { card: 'border-amber-100 bg-amber-50/70', icon: 'bg-amber-500 text-white', arrow: 'text-amber-600', link: 'text-amber-700' },
};

const FeedbackList = ({ items, emptyText }) => (
  items?.length ? <ul className="space-y-3 text-sm">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span>•</span><span>{item}</span></li>)}</ul> : <p className="text-sm text-slate-500">{emptyText}</p>
);

const LabAssistantDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [activeView, setActiveView] = useState('overview');
  const [source, setSource] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [peerTargets, setPeerTargets] = useState([]);
  const [peerTargetsLoading, setPeerTargetsLoading] = useState(false);
  const [peerTargetsError, setPeerTargetsError] = useState('');
  const [preparingPeerId, setPreparingPeerId] = useState(null);
  const [selectedPeerTarget, setSelectedPeerTarget] = useState(null);
  const [peerSubmitting, setPeerSubmitting] = useState(false);
  const [peerError, setPeerError] = useState('');

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    setActiveView(['feedback', 'peer-evaluation'].includes(hash) ? hash : 'overview');
  }, [location.hash]);

  useEffect(() => {
    let mounted = true;
    const loadPerformance = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const data = await evaluationApi.getLabAssistantPerformance();
        if (mounted) {
          setReport(data || {});
          setError('');
        }
      } catch (loadError) {
        if (mounted) setError(loadError?.message || 'Unable to load evaluation feedback.');
      } finally {
        if (mounted && showLoading) setLoading(false);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadPerformance();
    };
    void loadPerformance(true);
    const intervalId = window.setInterval(() => void loadPerformance(), 30000);
    window.addEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshWhenVisible);
    window.addEventListener(SUBMISSIONS_UPDATED_EVENT, refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener(DASHBOARD_DATA_UPDATED_EVENT, refreshWhenVisible);
      window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (activeView !== 'peer-evaluation') return undefined;
    let mounted = true;
    const loadPeerTargets = async () => {
      setPeerTargetsLoading(true);
      setPeerTargetsError('');
      try {
        const targets = await courseAssignmentApi.getPeerTargets();
        if (mounted) {
          setPeerTargets(Array.isArray(targets)
            ? targets.filter((target) => ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant', 'labassistant'].includes(String(target.target_role || '').trim().toLowerCase()))
            : []);
        }
      } catch (loadError) {
        if (mounted) {
          setPeerTargets([]);
          setPeerTargetsError(loadError?.message || 'Unable to load Lab Assistant peers.');
        }
      } finally {
        if (mounted) setPeerTargetsLoading(false);
      }
    };
    void loadPeerTargets();
    return () => { mounted = false; };
  }, [activeView, user?.id]);

  if (loading && activeView !== 'peer-evaluation') return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading evaluation feedback...</section>;
  if (error && activeView !== 'peer-evaluation') return <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</section>;

  const sourceScores = report?.sourceScores || {};
  const overallScore = Number(report?.totalWeightedScore) || 0;
  const selectedFeedback = source === 'all' ? report?.feedback || {} : report?.feedbackBySource?.[source] || {};
  const feedbackSources = [{ key: 'all', label: 'All Evaluators' }, ...evaluationSources.map(({ key, label }) => ({ key, label }))];
  const selectedScore = source === 'all' ? overallScore : Number(sourceScores[source]) || 0;
  const openFeedback = (selectedSource) => {
    setSource(selectedSource);
    navigate('/lab-assistant/dashboard#feedback');
  };
  const displayName = user?.full_name || user?.name || user?.username || 'Lab Assistant';

  const openPeerEvaluation = async (target) => {
    setPeerError('');
    if (target.id) {
      setSelectedPeerTarget(target);
      return;
    }

    setPreparingPeerId(target.target_user_id);
    try {
      const assignment = await courseAssignmentApi.preparePeerTarget(target.target_user_id);
      if (!assignment?.id) {
        throw new Error('The peer evaluation assignment could not be prepared.');
      }
      const preparedTarget = { ...target, id: assignment.id, peer_evaluation_id: assignment.id };
      setPeerTargets((current) => current.map((peer) => (
        peer.target_user_id === target.target_user_id ? preparedTarget : peer
      )));
      setSelectedPeerTarget(preparedTarget);
    } catch (prepareError) {
      setPeerError(prepareError?.message || 'Unable to prepare this peer evaluation.');
    } finally {
      setPreparingPeerId(null);
    }
  };

  const submitPeerEvaluation = async (payload) => {
    setPeerSubmitting(true);
    setPeerError('');
    try {
      await evaluationApi.submitPeerEvaluationForm(payload);
      setSelectedPeerTarget(null);
      setPeerTargets((current) => current.map((target) => (
        target.id === payload.peer_evaluation_id
          ? {
            ...target,
            status: 'completed',
            is_submitted: true,
            is_evaluated: true,
            score: Number(payload.score) || 0,
            total_score: Number(payload.score) || 0,
          }
          : target
      )));
      window.dispatchEvent(new CustomEvent(SUBMISSIONS_UPDATED_EVENT, { detail: { type: 'peer-submission' } }));
      try {
        const targets = await courseAssignmentApi.getPeerTargets();
        setPeerTargets(Array.isArray(targets)
          ? targets.filter((target) => ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant', 'labassistant'].includes(String(target.target_role || '').trim().toLowerCase()))
          : []);
      } catch (refreshError) {
        setPeerTargetsError(refreshError?.message || 'Evaluation submitted, but peer statuses could not be refreshed.');
      }
    } catch (submitError) {
      setPeerError(submitError?.message || 'Unable to submit peer evaluation.');
      throw submitError;
    } finally {
      setPeerSubmitting(false);
    }
  };

  return (
    <section className="w-full min-w-0 space-y-6" aria-labelledby="lab-assistant-dashboard-title">
      <header className="relative isolate overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-100 px-5 py-6 shadow-sm sm:px-8 sm:py-7">
        <div className="relative z-10 flex items-center gap-4 sm:gap-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 sm:h-14 sm:w-14"><UserRound className="h-7 w-7" /></span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-800">Instructor Performance</p>
            <h1 id="lab-assistant-dashboard-title" className="mt-1 text-2xl font-bold text-blue-950 sm:text-3xl">Welcome, {displayName}</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">Lab Assistant / ARA</p>
            <button type="button" onClick={() => navigate('/lab-assistant/dashboard#overview')} className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold text-blue-900 shadow-sm transition hover:bg-white">
              <GraduationCap className="h-4 w-4 text-blue-700" />
              {activeView === 'feedback' ? 'My Evaluation Feedback' : activeView === 'peer-evaluation' ? 'Peer Evaluation' : 'Performance Overview'}
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] items-end justify-between overflow-hidden px-5 lg:flex">
          <div className="relative mb-1 flex h-28 flex-1 items-end justify-center">
            <div className="absolute bottom-0 h-20 w-64 rounded-t-[50%] bg-blue-100/80" />
            <div className="relative mb-1 flex items-end gap-2">
              <div className="flex h-16 w-32 items-center justify-center rounded-t-xl border-4 border-blue-800 bg-white shadow-lg">
                <BookOpen className="h-9 w-9 text-blue-500" />
              </div>
              <div className="mb-0 flex flex-col gap-1">
                <span className="h-3 w-12 rounded bg-indigo-500" />
                <span className="h-3 w-16 rounded bg-blue-400" />
                <span className="h-3 w-14 rounded bg-sky-300" />
              </div>
              <GraduationCap className="absolute -top-6 left-20 h-10 w-10 -rotate-6 text-blue-900" />
              <Sparkles className="absolute -right-7 top-1 h-5 w-5 text-amber-500" />
            </div>
          </div>
          <p className="mb-7 max-w-28 text-xs font-semibold italic leading-relaxed text-blue-900">“Quality teaching builds a brighter future.”</p>
        </div>
      </header>

      {activeView === 'overview' ? (
        <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { key: 'overall', label: 'Overall Score', value: overallScore, icon: Award, tone: 'blue', hint: 'View feedback', onClick: () => openFeedback('all') },
              ...evaluationSources.map(({ key, label, icon }) => ({
                key,
                label,
                value: Number(sourceScores[key]) || 0,
                icon,
                tone: key === 'student' ? 'green' : key === 'deptHead' ? 'purple' : 'amber',
                hint: 'Filter feedback',
                onClick: () => openFeedback(key),
              })),
            ].map(({ key, label, value, icon: Icon, tone, hint, onClick }) => {
              const colors = metricToneClasses[tone];
              return (
                <button key={key} type="button" onClick={onClick} className={`group relative min-h-32 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${colors.card}`}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm ${colors.icon}`}><Icon className="h-5 w-5" /></span>
                  <ArrowUpRight className={`absolute right-4 top-4 h-4 w-4 ${colors.arrow}`} />
                  <span className="mt-3 block text-xs font-semibold text-slate-600">{label}</span>
                  <span className="mt-1 block text-2xl font-bold tabular-nums text-slate-950">{formatScore(value)}</span>
                  <span className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${colors.link}`}>{hint}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                </button>
              );
            })}
          </div>

          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:grid-cols-3" aria-labelledby="evaluator-breakdown-title">
            <div className="xl:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-700"><ChartNoAxesColumnIncreasing className="h-5 w-5" /></span>
                  <div><h2 id="evaluator-breakdown-title" className="text-base font-bold text-slate-900">Evaluation Breakdown</h2><p className="mt-1 text-xs text-slate-500">Scores by evaluator and contribution to your overall score.</p></div>
                </div>
                <button type="button" aria-label="Evaluation period: October 11, 2025 to October 25, 2026" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-semibold text-slate-600 shadow-sm">
                  <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" /><span><span className="block text-[10px] font-medium text-slate-400">Evaluation Period</span>Oct 11, 2025 - Oct 25, 2026</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </button>
              </div>
              <div className="space-y-2">
                {evaluationSources.map(({ key, label, weight, icon: Icon }) => {
                  const score = Math.max(0, Math.min(100, Number(sourceScores[key]) || 0));
                  const tone = key === 'student' ? 'green' : key === 'deptHead' ? 'purple' : 'amber';
                  const colors = metricToneClasses[tone];
                  const description = key === 'student' ? 'Feedback from students about your teaching and performance.' : key === 'deptHead' ? 'Evaluation by your department head or supervisor.' : 'Feedback from fellow instructors and peers.';
                  return (
                    <div key={key} className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-[42px_minmax(150px,1fr)_minmax(120px,1.5fr)_74px] sm:items-center">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.icon}`}><Icon className="h-5 w-5" /></span>
                      <div className="min-w-0"><h3 className="text-xs font-bold text-slate-800">{label}</h3><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{description}</p></div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${key === 'student' ? 'bg-blue-500' : key === 'deptHead' ? 'bg-violet-500' : 'bg-amber-500'}`} style={{ width: `${score}%` }} /></div>
                      <div className="text-right"><p className="text-xs font-bold tabular-nums text-slate-800">{formatScore(score)}</p><p className="mt-0.5 text-[10px] text-slate-500">Weight: {weight}</p></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="flex flex-col rounded-2xl border border-blue-100 bg-gradient-to-b from-sky-50 to-blue-50 p-4 text-center">
              <div className="mx-auto flex h-20 w-full max-w-48 items-center justify-center rounded-2xl bg-white/70 text-blue-600">
                <div className="relative flex items-end gap-2">
                  <ChartNoAxesColumnIncreasing className="h-12 w-12" />
                  <GraduationCap className="mb-1 h-9 w-9 text-indigo-700" />
                  <Sparkles className="absolute -right-3 -top-1 h-4 w-4 text-amber-500" />
                </div>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Your Performance Matters</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">Your evaluation helps improve teaching quality and supports academic excellence.</p>
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-100/70 p-3 text-left text-[11px] leading-relaxed text-blue-900">
                <p className="font-semibold">ⓘ No evaluation data available yet.</p>
                <p className="mt-1">Results will appear after the evaluation period is completed.</p>
              </div>
            </aside>
          </section>
        </>
      ) : activeView === 'feedback' ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filter feedback by evaluator">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Evaluation feedback sources">{feedbackSources.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={source === key} onClick={() => setSource(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${source === key ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}</div>
            <p className="mt-4 text-sm font-semibold text-slate-700">{feedbackSources.find(({ key }) => key === source)?.label} score: {formatScore(selectedScore)}</p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-emerald-950"><h2 className="mb-4 text-lg font-bold text-emerald-800">Strengths &amp; Positive Highlights</h2><FeedbackList items={selectedFeedback.strengths} emptyText="No strengths have been recorded yet." /></section>
            <section className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-amber-950"><h2 className="mb-4 text-lg font-bold text-amber-800">Improvement Suggestions</h2><FeedbackList items={selectedFeedback.weaknesses || selectedFeedback.improvements} emptyText="No improvement suggestions have been recorded yet." /></section>
          </div>
        </>
      ) : (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Peer Evaluation</h2>
            <p className="mt-1 text-sm text-slate-500">Evaluate Lab Assistant colleagues in your college. This contributes to your 20% peer score.</p>
          </div>
          {peerError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{peerError}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Lab Assistant</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {peerTargetsLoading ? (
                  <tr><td colSpan="3" className="px-4 py-8 text-center text-slate-500">Loading Lab Assistant peers...</td></tr>
                ) : peerTargetsError ? (
                  <tr><td colSpan="3" className="px-4 py-8 text-center text-red-600">{peerTargetsError}</td></tr>
                ) : peerTargets.length ? peerTargets.map((target) => (
                  <tr key={target.target_user_id}>
                    <td className="px-4 py-4 font-medium text-slate-900">{target.instructor_name || target.username || 'Lab Assistant'}</td>
                    <td className="px-4 py-4"><PeerEvaluationDeadlineBadge item={target} /></td>
                    <td className="px-4 py-4">
                      {target.is_submitted || target.is_evaluated ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                            <Check size={15} aria-hidden="true" />
                            Evaluated ({Number(target.score ?? target.total_score ?? 0).toFixed(0)}/100)
                          </span>
                          <button type="button" onClick={() => setSelectedPeerTarget(target)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 underline hover:text-blue-900"><Eye size={14} /> View Details</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void openPeerEvaluation(target)}
                          disabled={preparingPeerId === target.target_user_id}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
                        >
                          <Star size={16} fill="currentColor" />
                          {preparingPeerId === target.target_user_id ? 'Preparing...' : 'Evaluate'}
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="3" className="px-4 py-8 text-center text-slate-500">No Lab Assistant peers found in your college.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <PeerEvaluationModal
        open={Boolean(selectedPeerTarget)}
        onClose={() => setSelectedPeerTarget(null)}
        evaluation={selectedPeerTarget || {}}
        sections={standardPeerEvaluationSections}
        onSubmit={submitPeerEvaluation}
        isSubmitting={peerSubmitting}
        mode={selectedPeerTarget?.is_submitted || selectedPeerTarget?.is_evaluated ? 'view' : 'create'}
        evaluationRecord={selectedPeerTarget || null}
      />
    </section>
  );
};

export default LabAssistantDashboard;
