const normalizePhoneNumber = (value) => {
  let normalized = String(value ?? '').trim();
  normalized = normalized.replace(/[\s'"`().-]/g, '');
  if (/^\+/.test(normalized)) normalized = normalized.slice(1);
  if (/^\d+\.0+$/.test(normalized)) normalized = normalized.split('.')[0];
  if (/^\d(?:[\d.]*\d)?e[+-]?\d+$/i.test(normalized)) {
    const numericValue = Number(normalized);
    if (Number.isSafeInteger(numericValue)) normalized = String(numericValue);
  }
  if (/^[97]\d{8}$/.test(normalized)) normalized = `0${normalized}`;
  if (/^251[97]\d{8}$/.test(normalized)) normalized = `0${normalized.slice(3)}`;
  return normalized.replace(/\D/g, '');
};

const isValidPhoneNumber = (value) => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return false;
  if (/^(09|07)\d{8}$/.test(normalized)) return true;
  if (/^(?:251)?[79]\d{8}$/.test(normalized)) return true;
  return /^[1-9]\d{7,14}$/.test(normalized);
};

const isValidRegistrationPhoneNumber = (value) =>
  typeof value === 'string' && /^(09|07)\d{8}$/.test(value);

module.exports = { normalizePhoneNumber, isValidPhoneNumber, isValidRegistrationPhoneNumber };
