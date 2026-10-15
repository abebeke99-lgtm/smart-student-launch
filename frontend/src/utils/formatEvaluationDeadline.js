const parseEvaluationDeadline = (value) => {
  const rawValue = String(value).trim();
  const hasTime = /[T ]\d{2}:\d{2}/.test(rawValue);
  let date;
  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const localDateTimeMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);
  if (dateOnlyMatch) {
    date = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
  } else if (localDateTimeMatch) {
    date = new Date(
      Number(localDateTimeMatch[1]),
      Number(localDateTimeMatch[2]) - 1,
      Number(localDateTimeMatch[3]),
      Number(localDateTimeMatch[4]),
      Number(localDateTimeMatch[5]),
      Number(localDateTimeMatch[6] || 0),
      Number((localDateTimeMatch[7] || '').slice(0, 3).padEnd(3, '0')),
    );
  } else {
    date = new Date(rawValue);
  }
  return { date, hasTime, rawValue };
};

const formatEvaluationDeadline = (value, emptyValue = '—') => {
  if (value == null || value === '') return emptyValue;
  const { date, hasTime, rawValue } = parseEvaluationDeadline(value);
  if (Number.isNaN(date.getTime())) return rawValue;
  return new Intl.DateTimeFormat(undefined, hasTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
};

export const formatEvaluationDeadlineDate = (value, emptyValue = '—') => {
  if (value == null || value === '') return emptyValue;
  const { date, rawValue } = parseEvaluationDeadline(value);
  if (Number.isNaN(date.getTime())) return rawValue;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

export default formatEvaluationDeadline;
