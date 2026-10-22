import EvaluationDeadlineBadge from './EvaluationDeadlineBadge';
import { useUiText } from '../hooks/useUiText';

const EvaluationPeriodStatus = ({ isClosed, deadline, highlightDeadline = false }) => {
  const t = useUiText();
  return isClosed ? (
    <div
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-900"
    >
      {t('The evaluation period has officially closed. Evaluation forms are no longer available.')}
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
      <span className="text-sm font-semibold text-blue-900">{t('Complete your evaluations before:')}</span>
      <EvaluationDeadlineBadge value={deadline} highlight={highlightDeadline} />
    </div>
  );
};

export default EvaluationPeriodStatus;
