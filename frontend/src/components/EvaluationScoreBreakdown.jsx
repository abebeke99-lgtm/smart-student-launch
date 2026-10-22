import { useUiText } from '../hooks/useUiText';

const formatScore = (value) => Number(value || 0).toFixed(2);

const EvaluationScoreBreakdown = ({
  isTeaching,
  studentScore = 0,
  peerScore = 0,
  supervisorScore = 0,
  supervisorLabel = "Supervisor",
  finalScore,
}) => {
  const t = useUiText();
  const teaching = Boolean(isTeaching);
  const rows = [
    ...(teaching
      ? [{ label: t('Students'), score: studentScore, weight: 50 }]
      : []),
    { label: t('Peers'), score: peerScore, weight: teaching ? 20 : 40 },
    {
      label: t(supervisorLabel),
      score: supervisorScore,
      weight: teaching ? 30 : 60,
    },
  ];
  const weightedTotal = rows.reduce(
    (total, row) => total + (Number(row.score || 0) * row.weight) / 100,
    0,
  );
  const total = Number(finalScore ?? weightedTotal);

  return (
    <table className="mt-6 w-full border-collapse border border-black text-center">
      <thead>
        <tr>
          <th className="border border-black p-2 text-left">{t('Evaluation component')}</th>
          <th className="border border-black p-2">{t('Component score (%)')}</th>
          <th className="border border-black p-2">{t('Weight')}</th>
          <th className="border border-black p-2">{t('Weighted score')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className="border border-black p-2 text-left">{row.label}</td>
            <td className="border border-black p-2">{formatScore(row.score)}</td>
            <td className="border border-black p-2">{row.weight}%</td>
            <td className="border border-black p-2">
              {formatScore((Number(row.score || 0) * row.weight) / 100)}
            </td>
          </tr>
        ))}
        <tr>
          <td className="border border-black p-2 text-right font-bold" colSpan="3">
            {t('Final weighted percentage')}
          </td>
          <td className="border border-black p-2 font-bold">{formatScore(total)}%</td>
        </tr>
      </tbody>
    </table>
  );
};

export default EvaluationScoreBreakdown;
