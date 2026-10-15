import { useEffect, useState } from 'react';
import { deanApi } from '../services/api';

const formatScore = (value) => `${Number(value || 0).toFixed(1)}%`;

const DeanPerformanceView = ({ loadReport = deanApi.getMyPerformance, sourceLabels = { all: 'All Evaluators', student: 'Student', peer: 'Peers', deptHead: 'Department Head', academicDirector: 'Academic Director' } }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState(() => Object.keys(sourceLabels)[0] || 'all');

  useEffect(() => {
    let mounted = true;
    loadReport()
      .then((data) => { if (mounted) setReport(data || {}); })
      .catch((loadError) => { if (mounted) setError(loadError?.message || 'Unable to load your performance.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your performance...</section>;
  if (error) return <section className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">{error}</section>;

  const feedback = report?.feedback || {};
  const selectedFeedback = source === 'all' ? feedback : (report?.feedbackBySource?.[source] || {});
  const selectedScore = source === 'all' ? report?.totalWeightedScore : report?.sourceScores?.[source];
  const renderList = (items, emptyText) => <ul className="space-y-3 text-sm"><>{items?.length ? items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span>•</span><span>{item}</span></li>) : <li>{emptyText}</li>}</></ul>;

  return (
    <section className="space-y-6" aria-labelledby="dean-performance-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-medium text-slate-500">My Evaluation Feedback: {sourceLabels[source]}</p><p id="dean-performance-title" className="mt-1 text-5xl font-bold text-ieps-blue-700">{formatScore(selectedScore)}</p><p className="mt-1 text-xs text-slate-500">{source === 'all' ? '100% total weight' : 'Evaluator source score'}</p></div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">{report?.status || 'At Risk'}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" role="tablist" aria-label="Filter feedback by evaluator source">
        {Object.entries(sourceLabels).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={source === key} onClick={() => setSource(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${source === key ? 'bg-ieps-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-emerald-950"><h3 className="mb-4 text-lg font-bold text-emerald-800">Strengths &amp; Positive Highlights</h3>{renderList(selectedFeedback.strengths, 'No strengths have been recorded yet.')}</section>
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6 text-amber-950"><h3 className="mb-4 text-lg font-bold text-amber-800">Areas for Improvement</h3>{renderList(selectedFeedback.weaknesses || selectedFeedback.improvements, 'No improvement areas have been recorded yet.')}</section>
      </div>
    </section>
  );
};

export default DeanPerformanceView;
