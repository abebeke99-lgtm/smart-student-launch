import formatEvaluationDeadline, {
  formatEvaluationDeadlineDate,
} from '../utils/formatEvaluationDeadline';

const EvaluationDeadlineBadge = ({ value, highlight = false }) => {
  const candidates = value && typeof value === 'object'
    ? [value.expiryDate, value.deadline]
    : [value];
  const deadline = candidates.find((candidate) =>
    candidate != null && !['', '-', '—'].includes(String(candidate).trim()),
  );
  const hasDeadline = deadline !== undefined;
  const label = hasDeadline
    ? highlight
      ? `⏰ ${formatEvaluationDeadlineDate(deadline)}`
      : formatEvaluationDeadline(deadline)
    : 'No Deadline Configured';

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
      hasDeadline
        ? highlight
          ? 'bg-amber-50 text-amber-800 ring-amber-200'
          : 'bg-blue-50 text-blue-700 ring-blue-200'
        : 'bg-slate-50 text-slate-500 ring-slate-200'
    }`}>
      {label}
    </span>
  );
};

export default EvaluationDeadlineBadge;
