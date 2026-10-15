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
const originalConsoleWarn = console.warn;
const originalNodeEnv = process.env.NODE_ENV;
const originalNpmLifecycleEvent = process.env.npm_lifecycle_event;
let sendRecoveryEmailMock = async () => {};

emailService.sendRecoveryEmail = (...args) => sendRecoveryEmailMock(...args);
profileSettings.ensureUserProfileSettings = async () => {};
const { forgotPassword } = require("../controllers/authController");

afterEach(() => {
  pool.query = originalQuery;
  emailService.sendRecoveryEmail = originalSendRecoveryEmail;
  profileSettings.ensureUserProfileSettings =
    originalEnsureUserProfileSettings;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  if (originalNpmLifecycleEvent === undefined) {
    delete process.env.npm_lifecycle_event;
  } else {
    process.env.npm_lifecycle_event = originalNpmLifecycleEvent;
  }
});

const createResponse = () => ({
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
});

test("sends a six-digit OTP to the matched account email", async () => {
  let recoveryEmail;
  let savedOtpHash;
  let updateQuery;
  let lookupQuery;
  let lookupParams;
  let queryCount = 0;
  sendRecoveryEmailMock = async (payload) => {
    recoveryEmail = payload;
  };
  pool.query = async (sql, params) => {
    queryCount += 1;
    if (queryCount === 1) {
      lookupQuery = String(sql);
      lookupParams = params;
      return [[{
        id: 7,
        username: "super.admin",
        role: "systemadmin",
        reset_otp: null,
        otp_expiry: null,
        email: "super-admin@example.edu",
      }]];
    }
    updateQuery = String(sql);
    savedOtpHash = params[0];
    return [{ affectedRows: 1 }];
  };
  const response = createResponse();

  await forgotPassword({ body: { email: "super-admin@example.edu" } }, response);

  assert.equal(response.body.success, true);
  assert.match(lookupQuery, /LOWER\(TRIM\(COALESCE\(ups\.email/i);
  assert.deepEqual(lookupParams, ["super-admin@example.edu", "super-admin@example.edu"]);
  assert.equal(recoveryEmail.toEmail, "super-admin@example.edu");
  assert.match(recoveryEmail.code, /^\d{6}$/);
  assert.match(savedOtpHash, /^\$2[aby]\$/);
  assert.equal(await require("bcryptjs").compare(recoveryEmail.code, savedOtpHash), true);
  assert.match(updateQuery, /reset_otp = \?/);
  assert.match(updateQuery, /otp_expiry = DATE_ADD\(NOW\(\), INTERVAL 15 MINUTE\)/i);
  assert.equal(queryCount, 2);
});

test("uses the submitted email when the matched account recovery email is missing or invalid", async () => {
  for (const savedEmail of [null, "invalid-recovery-email"]) {
    let recoveryEmail;
    sendRecoveryEmailMock = async (payload) => {
      recoveryEmail = payload;
    };
    let queryCount = 0;
    pool.query = async () => {
      queryCount += 1;
      if (queryCount === 1) return [[{
        id: 9,
        username: "admin",
        role: "systemadmin",
        email: savedEmail,
      }]];
      return [{ affectedRows: 1 }];
    };
    const response = createResponse();

    await forgotPassword({ body: { email: "recovery@example.edu" } }, response);

    assert.equal(response.body.success, true);
    assert.equal(recoveryEmail.toEmail, "recovery@example.edu");
    assert.match(recoveryEmail.code, /^\d{6}$/);
  }
});

test("returns an explicit HTTP 500 when recovery email delivery fails", async () => {
  let queryCount = 0;
  sendRecoveryEmailMock = async () => {
    const error = new Error("Resend rejected delivery");
    error.code = "EMAIL_DELIVERY_FAILED";
    throw error;
  };
  pool.query = async () => {
    queryCount += 1;
    if (queryCount === 1) {
      return [[{
        id: 8,
        username: "admin",
        role: "admin",
        reset_otp: null,
        otp_expiry: null,
        email: "admin@example.edu",
      }]];
    }
    return [{ affectedRows: 1 }];
  };
  console.error = () => {};
  const response = createResponse();

  await forgotPassword({ body: { email: "admin@example.edu" } }, response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "EMAIL_DELIVERY_FAILED");
  assert.match(response.body.message, /Unable to send the password recovery email/);
  assert.equal("error" in response.body, false);
  assert.equal(queryCount, 3);
});

test("returns a development-only recovery code when email configuration is missing", async () => {
  delete process.env.NODE_ENV;
  process.env.npm_lifecycle_event = "dev";
  let savedOtpHash;
  let queryCount = 0;
  sendRecoveryEmailMock = async () => {
    const error = new Error("SMTP configuration is missing");
    error.code = "EMAIL_PROVIDER_NOT_CONFIGURED";
    throw error;
  };
  pool.query = async (sql, params) => {
    queryCount += 1;
    if (String(sql).includes("FROM users u")) {
      return [[{
        id: 19,
        username: "local-user",
        email: "local-user@example.edu",
      }]];
    }
    savedOtpHash = params[0];
    return [{ affectedRows: 1 }];
  };
  console.warn = () => {};
  const response = createResponse();

  await forgotPassword({ body: { email: "local-user@example.edu" } }, response);

  assert.equal(response.statusCode, null);
  assert.equal(response.body.success, true);
  assert.match(response.body.developmentCode, /^\d{6}$/);
  assert.equal(
    await require("bcryptjs").compare(response.body.developmentCode, savedOtpHash),
    true,
  );
  assert.equal(queryCount, 2);
});

test("returns a development-only recovery code when SMTP delivery fails", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.npm_lifecycle_event;
  let savedOtpHash;
  sendRecoveryEmailMock = async () => {
    const error = new Error("SMTP authentication failed");
    error.code = "EAUTH";
    throw error;
  };
  pool.query = async (sql, params) => {
    if (String(sql).includes("FROM users u")) {
      return [[{
        id: 21,
        username: "local-user",
        email: "local-user@example.edu",
      }]];
    }
    savedOtpHash = params[0];
    return [{ affectedRows: 1 }];
  };
  console.warn = () => {};
  const response = createResponse();

  await forgotPassword({ body: { email: "local-user@example.edu" } }, response);

  assert.equal(response.statusCode, null);
  assert.equal(response.body.success, true);
  assert.match(response.body.developmentCode, /^\d{6}$/);
  assert.equal(
    await require("bcryptjs").compare(response.body.developmentCode, savedOtpHash),
    true,
  );
});

test("uses the development recovery code for local requests when NODE_ENV is unset", async () => {
  delete process.env.NODE_ENV;
  delete process.env.npm_lifecycle_event;
  sendRecoveryEmailMock = async () => {
    const error = new Error("RESEND_API_KEY is not configured.");
    error.code = "EMAIL_PROVIDER_NOT_CONFIGURED";
    throw error;
  };
  pool.query = async (sql) => {
    if (String(sql).includes("FROM users u")) {
      return [[{
        id: 22,
        username: "local-user",
        email: "local-user@example.edu",
      }]];
    }
    return [{ affectedRows: 1 }];
  };
  console.warn = () => {};
  const response = createResponse();

  await forgotPassword(
    {
      body: { email: "local-user@example.edu" },
      hostname: "localhost",
      headers: { host: "localhost:5001" },
    },
    response,
  );

  assert.equal(response.statusCode, null);
  assert.equal(response.body.success, true);
  assert.match(response.body.developmentCode, /^\d{6}$/);
});

test("returns a helpful production error and clears OTP when email is not configured", async () => {
  process.env.NODE_ENV = "production";
  let queryCount = 0;
  sendRecoveryEmailMock = async () => {
    const error = new Error("SMTP credentials are missing");
    error.code = "EMAIL_PROVIDER_NOT_CONFIGURED";
    throw error;
  };
  pool.query = async (sql) => {
    queryCount += 1;
    if (String(sql).includes("FROM users u")) {
      return [[{
        id: 20,
        username: "production-user",
        email: "production-user@example.edu",
      }]];
    }
    return [{ affectedRows: 1 }];
  };
  console.error = () => {};
  const response = createResponse();

  await forgotPassword(
    { body: { email: "production-user@example.edu" } },
    response,
  );

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "EMAIL_PROVIDER_NOT_CONFIGURED");
  assert.match(response.body.message, /Configure SMTP or Resend/);
  assert.equal("error" in response.body, false);
  assert.equal(queryCount, 3);
});

test("returns the requested message when no active account matches", async () => {
  pool.query = async () => [[]];
  const response = createResponse();

  await forgotPassword({ body: { email: "missing@example.edu" } }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(
    response.body.message,
    "No active account was found for that username or email",
  );
});

test("registers POST /forgot-password on the auth router", () => {
  const authRouter = require("../routes/authRoutes");
  const forgotPasswordRoute = authRouter.stack.find(
    (layer) => layer.route?.path === "/forgot-password",
  );

  assert.ok(forgotPasswordRoute);
  assert.equal(forgotPasswordRoute.route.methods.post, true);
});
