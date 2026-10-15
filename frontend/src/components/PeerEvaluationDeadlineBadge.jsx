import { formatEvaluationDeadlineDate } from '../utils/formatEvaluationDeadline';

const PeerEvaluationDeadlineBadge = ({ deadline }) => {
  const hasDeadline =
    deadline != null && !['', '-', '—'].includes(String(deadline).trim());
  const label = hasDeadline
    ? `⏰ ${formatEvaluationDeadlineDate(deadline)}`
    : 'No Deadline Configured';

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
      hasDeadline
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-slate-50 text-slate-500 ring-slate-200'
    }`}>
      {label}
    </span>
  );
};

export default PeerEvaluationDeadlineBadge;
