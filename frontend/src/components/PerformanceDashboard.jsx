import { useEffect, useState } from 'react';
import { evaluationApi } from '../services/api';
import { useUiText } from '../hooks/useUiText';

const CommentList = ({ items = [], emptyText }) => (
  items.length ? (
    <ul className="space-y-3 text-sm text-gray-700">
      {items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3"><span className="mt-1 text-current">•</span><span>{item}</span></li>)}
    </ul>
  ) : <p className="text-sm text-gray-500">{emptyText}</p>
);

const PerformanceDashboard = () => {
  const t = useUiText();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('all');

  useEffect(() => {
    let mounted = true;
    const loadReport = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await evaluationApi.getPerformanceDashboard();
        if (mounted) setReport(data);
      } catch (loadError) {
        if (mounted) setError(loadError?.message || t('Unable to load performance dashboard.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadReport();
    return () => { mounted = false; };
  }, []);

  if (loading) return <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t('Loading performance dashboard...')}</section>;
  if (error) return <section className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{error}</section>;

  const feedback = report?.feedback || {};
  const feedbackBySource = report?.feedbackBySource || {};
  const sourceLabels = { all: 'All Evaluators', student: 'Student', peer: 'Peers', deptHead: 'Department Head' };
  const selectedFeedback = source === 'all' ? feedback : (feedbackBySource[source] || {});

  return (
    <section id="performance-dashboard" className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between print:shadow-none">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('My Evaluation Feedback')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('Your overall evaluation score and qualitative feedback.')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm" role="tablist" aria-label={t('Filter feedback by evaluator source')}>
        {Object.entries(sourceLabels).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={source === key} onClick={() => setSource(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${source === key ? 'bg-ieps-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{t(label)}</button>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-emerald-800">{t('Strengths & Positive Highlights')}</h3><span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{t('Strengths')}</span></div>
          <CommentList items={selectedFeedback.strengths} emptyText={t('No strengths have been recorded yet.')} />
        </section>
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-amber-800">{t('Areas for Improvement (Weaknesses)')}</h3><span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{t('Focus Areas')}</span></div>
          <CommentList items={selectedFeedback.weaknesses || selectedFeedback.improvements} emptyText={t('No improvement areas have been recorded yet.')} />
        </section>
      </div>
    </section>
  );
};

export default PerformanceDashboard;