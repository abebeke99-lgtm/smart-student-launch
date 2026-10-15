const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const pool = require("../config/db");
const emailService = require("../services/emailService");
const profileSettings = require("../utils/profileSettings");

const originalQuery = pool.query;
const originalSendRecoveryEmail = emailService.sendRecoveryEmail;
const originalEnsureUserProfileSettings =
  profileSettings.ensureUserProfileSettings;
const originalConsoleError = console.error;
const queries = [];

emailService.sendRecoveryEmail = async () => {
  const error = new Error("connect ENETUNREACH");
  error.code = "ESOCKET";
  error.errno = "ENETUNREACH";
  throw error;
};
profileSettings.ensureUserProfileSettings = async () => {};

const { forgotPassword } = require("../controllers/authController");

afterEach(() => {
  pool.query = originalQuery;
  emailService.sendRecoveryEmail = originalSendRecoveryEmail;
  profileSettings.ensureUserProfileSettings =
    originalEnsureUserProfileSettings;
  console.error = originalConsoleError;
  queries.length = 0;
});

test("returns a handled 503 and clears the OTP when SMTP is unreachable", async () => {
  pool.query = async (sql) => {
    queries.push(String(sql));
    if (String(sql).includes("FROM users u")) {
      return [[{
        id: 17,
        email: "user@example.com",
      }]];
    }
    return [{ affectedRows: 1 }];
  };
  console.error = () => {};

  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await forgotPassword({ body: { email: "user@example.com" } }, response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "EMAIL_NETWORK_UNAVAILABLE");
  assert.match(response.body.message, /temporarily unreachable/i);
  assert.equal("error" in response.body, false);
  assert.ok(queries.some((sql) => sql.includes("reset_otp = NULL")));
});
