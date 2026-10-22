export const USERNAME_PATTERN = /^(?:mau\d+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/i;
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const ETHIOPIAN_PHONE_PATTERN = /^(?:(?:\+251|251)[97]\d{8}|0[97]\d{8})$/;

export const isValidUsername = (value) => USERNAME_PATTERN.test(String(value ?? ''));
export const isValidUniversityUsername = (value) => /^mau\d+$/i.test(String(value ?? ''));
export const isValidPassword = (value) => typeof value === 'string' && value.length >= 8;
export const isValidEmail = (value) => EMAIL_PATTERN.test(String(value ?? '').trim());
export const isValidEthiopianPhone = (value) => ETHIOPIAN_PHONE_PATTERN.test(String(value ?? '').replace(/[\s().-]/g, ''));

export const stripHtmlTags = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
  .replace(/<[^>]*>/g, '')
  .trim();
