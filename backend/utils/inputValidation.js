const USERNAME_PATTERN = /^(?:mau\d+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/i;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ETHIOPIAN_PHONE_PATTERN = /^(?:(?:\+251|251)[97]\d{8}|0[97]\d{8})$/;
const PERSON_NAME_PATTERN = /^[\p{L} ]{3,}$/u;
const PASSWORD_FIELDS = new Set([
  "password",
  "newPassword",
  "new_password",
  "confirmPassword",
  "confirm_password",
  "currentPassword",
  "current_password",
]);
const SECRET_FIELDS = new Set([...PASSWORD_FIELDS, "username", "token", "resetToken", "otp"]);

const isValidUsername = (value, { allowEmail = false } = {}) => {
  const username = String(value ?? "");
  if (!username) return false;
  return allowEmail
    ? USERNAME_PATTERN.test(username)
    : /^mau\d+$/i.test(username);
};

const isValidPassword = (value) =>
  typeof value === "string" && value.length >= 8;

const isValidEmail = (value) =>
  typeof value === "string" && EMAIL_PATTERN.test(value.trim());

const isValidEthiopianPhone = (value) =>
  typeof value === "string" &&
  ETHIOPIAN_PHONE_PATTERN.test(value.replace(/[\s().-]/g, ""));

const sanitizeText = (value) =>
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();

const sanitizeValue = (value, key = "") => {
  if (typeof value === "string") {
    return SECRET_FIELDS.has(key) ? value : sanitizeText(value);
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childValue, childKey),
      ]),
    );
  }
  return value;
};

const collectValidationErrors = (value, path = "", errors = [], options = {}) => {
  if (!value || typeof value !== "object") return errors;
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectValidationErrors(entry, `${path}[${index}]`, errors, options),
    );
    return errors;
  }

  for (const [key, entry] of Object.entries(value)) {
    const field = path ? `${path}.${key}` : key;
    if (entry === "" || entry === null || entry === undefined) continue;

    if (typeof entry === "string") {
      if (
        key === "username" &&
        !options.skipUsernameValidation &&
        !isValidUsername(entry, { allowEmail: options.isLogin || options.isPasswordRecovery })
      ) {
        errors.push({ field, message: "Username must start with mau and contain digits only." });
      } else if (/^(?:firstName|first_name|lastName|last_name)$/i.test(key) && !PERSON_NAME_PATTERN.test(entry.trim())) {
        errors.push({
          field,
          message: "Name must contain only letters and be at least 3 characters.",
        });
      } else if (/^(?:email|emailAddress|recoveryEmail|contact_email|email_address)$/i.test(key) && !isValidEmail(entry)) {
        errors.push({ field, message: "Enter a valid email address." });
      } else if (/^(?:phone|phoneNumber|phone_number|mobile|mobileNumber|telephone|contact_phone)$/i.test(key) && !isValidEthiopianPhone(entry)) {
        errors.push({ field, message: "Enter a valid Ethiopian phone number." });
      } else if (
        PASSWORD_FIELDS.has(key) &&
        !(options.isLogin && key === "password") &&
        !(key === "currentPassword")
      ) {
        if (!isValidPassword(entry)) {
          errors.push({
            field,
            message: "Password must contain at least 8 characters.",
          });
        }
      }

      if (/^(?:rating|ratings|criteria_scores|criteriaScores|scores)$/i.test(key)) {
        const numericValue = Number(entry);
        if (
          String(entry).toUpperCase() !== "NA" &&
          (!Number.isFinite(numericValue) || numericValue < 1 || numericValue > 5)
        ) {
          errors.push({ field, message: "Rating must be between 1 and 5." });
        }
      } else if (/^(?:score|maxScore|max_score|totalScore|total_score|scorePercent|score_percent|percentage)$/i.test(key)) {
        const numericValue = Number(entry);
        if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
          errors.push({ field, message: "Score must be between 0 and 100." });
        }
      }
    } else if (/^(?:ratings|criteria_scores|criteriaScores|scores)$/i.test(key) && entry && typeof entry === "object") {
      const values = Array.isArray(entry) ? entry : Object.values(entry);
      values.forEach((rating, index) => {
        const numericValue = Number(rating);
        if (
          String(rating).toUpperCase() !== "NA" &&
          (!Number.isFinite(numericValue) || numericValue < 1 || numericValue > 5)
        ) {
          errors.push({
            field: `${field}.${Array.isArray(entry) ? index : Object.keys(entry)[index]}`,
            message: "Rating must be between 1 and 5.",
          });
        }
      });
    } else if (typeof entry === "number") {
      if (/^(?:rating)$/i.test(key) && (!Number.isFinite(entry) || entry < 1 || entry > 5)) {
        errors.push({ field, message: "Rating must be between 1 and 5." });
      } else if (/^(?:score|maxScore|max_score|totalScore|total_score|scorePercent|score_percent|percentage)$/i.test(key) && (!Number.isFinite(entry) || entry < 0 || entry > 100)) {
        errors.push({ field, message: "Score must be between 0 and 100." });
      }
    }

    collectValidationErrors(entry, field, errors, options);
  }
  return errors;
};

const validateRequestInput = (req, res, next) => {
  if (!req.body || typeof req.body !== "object") return next();
  const requestPath = req.path || req.originalUrl || req.url || "";
  const isLogin = req.method === "POST" && /\/(?:api\/)?auth\/login\/?$/i.test(requestPath);
  const isPasswordRecovery = req.method === "POST" && /\/(?:api\/)?auth\/forgot-password\/?$/i.test(requestPath);
  const isProfileUpdate = req.method === "PUT" && /(?:\/api\/user)?\/profile\/?(?:\?.*)?$/i.test(requestPath);
  req.body = sanitizeValue(req.body);
  const errors = collectValidationErrors(req.body, "", [], {
    isLogin,
    isPasswordRecovery,
    skipUsernameValidation: isProfileUpdate,
  });
  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: "Request validation failed.",
      errors,
    });
  }
  return next();
};

module.exports = {
  EMAIL_PATTERN,
  ETHIOPIAN_PHONE_PATTERN,
  PERSON_NAME_PATTERN,
  USERNAME_PATTERN,
  collectValidationErrors,
  isValidEmail,
  isValidEthiopianPhone,
  isValidPassword,
  isValidUsername,
  sanitizeValue,
  validateRequestInput,
};
