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

const forbiddenWordExpression = new RegExp(
  `(^|[^\\p{L}\\p{N}])(?:${forbiddenWords.join('|')})(?=$|[^\\p{L}\\p{N}])`,
  'iu',
);

const isRandomText = (value) => {
  const compact = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return (
    /(\p{L})\1{4,}/iu.test(value) ||
    /^(.{1,3})\1{3,}$/u.test(compact) ||
    /(?:qwerty|asdfgh|zxcvbn|123456|098765|abcdef)/iu.test(compact)
  );
};

const validateEvaluationFeedback = (fields) => {
  for (const [label, rawValue] of Object.entries(fields)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    if (typeof rawValue !== 'string') {
      return {
        valid: false,
        message: `${label}: Please enter valid text.`,
        messageAm: `${label}: የአስተያየት ጽሑፍ ትክክለኛ አይደለም።`,
      };
    }

    const value = rawValue.trim();
    if (!value) continue;
    const length = [...value].length;
    if (forbiddenWordExpression.test(value)) {
      return {
        valid: false,
        message: `${label}: Inappropriate language was detected. Please revise your comment.`,
        messageAm: `${label}: የማይገባ ቃል ተጠቅመዋል። እባክዎ ያስተካክሉት።`,
      };
    }
    if (length < 5 || length > 500) {
      return {
        valid: false,
        message: `${label}: Comments must be between 5 and 500 characters.`,
        messageAm: `${label}: አስተያየቱ ከ5 እስከ 500 ቁምፊዎች መሆን አለበት።`,
      };
    }
    if (isRandomText(value)) {
      return {
        valid: false,
        message: `${label}: This looks like random or repeated text. Please enter meaningful feedback.`,
        messageAm: `${label}: ጽሑፉ ግልጽ አይደለም። ትርጉም ያለው አስተያየት ያስገቡ።`,
      };
    }
  }

  return { valid: true };
};

module.exports = { validateEvaluationFeedback };
