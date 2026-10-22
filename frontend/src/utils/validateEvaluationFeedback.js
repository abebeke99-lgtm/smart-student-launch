const forbiddenWords = [
  'fuck',
  'fucker',
  'fuckers',
  'fucking',
  'fucked',
  'shit',
  'shits',
  'shitty',
  'bitch',
  'bastard',
  'asshole',
  'motherfucker',
  'dickhead',
  'ደደብ',
  'ሞኝ',
  'ባለጌ',
  'ርኩስ',
];

const containsForbiddenWord = (value) => {
  const escapedWords = forbiddenWords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(
    `(^|[^\\p{L}\\p{N}])(?:${escapedWords.join('|')})(?=$|[^\\p{L}\\p{N}])`,
    'iu',
  );
  return expression.test(value);
};

const isRandomText = (value) => {
  const compact = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return (
    /(\p{L})\1{4,}/iu.test(value) ||
    /^(.{1,3})\1{3,}$/u.test(compact) ||
    /(?:qwerty|asdfgh|zxcvbn|123456|098765|abcdef)/iu.test(compact)
  );
};

export const validateEvaluationFeedback = (fields, language = 'en') => {
  const isAmharic = language === 'am';

  for (const [label, rawValue] of Object.entries(fields)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    if (typeof rawValue !== 'string') {
      return isAmharic
        ? `${label}: የአስተያየት ጽሑፍ ትክክለኛ አይደለም።`
        : `${label}: Please enter valid text.`;
    }

    const value = rawValue.trim();
    if (!value) continue;
    const length = [...value].length;
    if (containsForbiddenWord(value)) {
      return isAmharic
        ? `${label}: የማይገባ ቃል ተጠቅመዋል። እባክዎ ያስተካክሉት።`
        : `${label}: Inappropriate language was detected. Please revise your comment.`;
    }
    if (length < 5 || length > 500) {
      return isAmharic
        ? `${label}: አስተያየቱ ከ5 እስከ 500 ቁምፊዎች መሆን አለበት።`
        : `${label}: Comments must be between 5 and 500 characters.`;
    }
    if (isRandomText(value)) {
      return isAmharic
        ? `${label}: ጽሑፉ ግልጽ አይደለም። ትርጉም ያለው አስተያየት ያስገቡ።`
        : `${label}: This looks like random or repeated text. Please enter meaningful feedback.`;
    }
  }

  return '';
};
