import { useEffect, useState } from 'react';
import { evaluationApi } from '../services/api';

const formatScore = (value) => `${Number(value || 0).toFixed(1)}%`;

const DeptHeadPerformanceDashboard = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('all');

  useEffect(() => {
    let mounted = true;
    const loadPerformance = async () => {
      try {
        const data = await evaluationApi.getDeptHeadPerformance();
        if (mounted) setReport(data || {});
      } catch (loadError) {
        if (mounted) setError(loadError?.message || 'Unable to load performance dashboard.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadPerformance();
    return () => { mounted = false; };
  }, []);

  if (loading) return <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading My Evaluation Feedback...</section>;
  if (error) return <section className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{error}</section>;

  const strengths = report?.strengths || report?.feedback?.strengths || [];
  const weaknesses = report?.weaknesses || report?.feedback?.improvements || [];
  const sourceLabels = { all: 'All Evaluators', student: 'Student', peer: 'Peers', collegeDean: 'College Dean' };
  const selectedFeedback = source === 'all' ? { strengths, weaknesses } : (report?.feedbackBySource?.[source] || {});
  const selectedScore = source === 'all' ? report?.totalWeightedScore : report?.sourceScores?.[source];

  return (
    <section className="space-y-6" aria-labelledby="dept-head-performance-title">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-6">
          <div><p className="text-sm font-medium text-gray-500">My Evaluation Feedback: {sourceLabels[source]}</p><p id="dept-head-performance-title" className="mt-1 text-4xl font-bold text-ieps-blue-700">{formatScore(selectedScore)}</p><p className="mt-1 text-xs text-gray-500">{source === 'all' ? '100% total weight' : 'Evaluator source score'}</p></div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">{report?.status || 'Needs Improvement'}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm" role="tablist" aria-label="Filter feedback by evaluator source">
        {Object.entries(sourceLabels).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={source === key} onClick={() => setSource(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${source === key ? 'bg-ieps-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{label}</button>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6"><h3 className="mb-4 text-lg font-bold text-emerald-800">Strengths &amp; Positive Highlights</h3><ul className="space-y-3 text-sm text-emerald-950">{selectedFeedback.strengths?.length ? selectedFeedback.strengths.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span>•</span><span>{item}</span></li>) : <li>No strengths have been recorded yet.</li>}</ul></section>
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6"><h3 className="mb-4 text-lg font-bold text-amber-800">Areas for Improvement</h3><ul className="space-y-3 text-sm text-amber-950">{(selectedFeedback.weaknesses || selectedFeedback.improvements)?.length ? (selectedFeedback.weaknesses || selectedFeedback.improvements).map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span>•</span><span>{item}</span></li>) : <li>No improvement areas have been recorded yet.</li>}</ul></section>
      </div>
    </section>
  );
};

export default DeptHeadPerformanceDashboard;
