const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const nodemailer = require("nodemailer");
const {
  sendEmail,
  sendRecoveryEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");

const savedEnvironment = { ...process.env };
const originalFetch = global.fetch;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalCreateTransport = nodemailer.createTransport;

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, savedEnvironment);
  global.fetch = originalFetch;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  nodemailer.createTransport = originalCreateTransport;
});

test("requires a Resend API key", async () => {
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    sendEmail({ to: "person@example.com", subject: "Test", text: "Test" }),
    { code: "EMAIL_PROVIDER_NOT_CONFIGURED" },
  );
});

test("sends branded recovery email through Resend using the testing sender", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <onboarding@resend.dev>";
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ id: "email-test-id" }),
    };
  };

  const result = await sendRecoveryEmail({
    to: "person@example.com",
    code: "123456",
    expiresInMinutes: 15,
  });

  assert.equal(result.id, "email-test-id");
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.get("authorization"), "Bearer re_test_api_key");
  assert.equal(request.body.from, "IPES System <onboarding@resend.dev>");
  assert.deepEqual(request.body.to, ["person@example.com"]);
  assert.match(request.body.subject, /password recovery code/i);
  assert.match(request.body.html, /Instructor Performance Evaluation System \(IPES\)/);
  assert.match(request.body.html, /Mekdela Amba University/);
  assert.match(request.body.html, /123456/);
  assert.match(request.body.text, /15 minutes/);
});

test("sends recovery codes through configured Gmail SMTP", async () => {
  process.env.EMAIL_SERVICE = "gmail";
  delete process.env.EMAIL_PROVIDER;
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-app-password";
  delete process.env.SMTP_FROM;

  let transportOptions;
  let sentMessage;
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return {
      sendMail: async (message) => {
        sentMessage = message;
        return { messageId: "smtp-test-id" };
      },
    };
  };

  const result = await sendRecoveryEmail({
    to: "admin@example.com",
    code: "123456",
    expiresInMinutes: 15,
  });

  assert.equal(result.messageId, "smtp-test-id");
  assert.deepEqual(transportOptions, {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: "sender@example.com", pass: "test-app-password" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  assert.equal(sentMessage.from, "sender@example.com");
  assert.equal(sentMessage.to, "admin@example.com");
  assert.match(sentMessage.text, /123456/);
  assert.match(sentMessage.html, /123456/);
});

test("sends password reset instructions through configured Gmail SMTP", async () => {
  process.env.EMAIL_SERVICE = "gmail";
  delete process.env.EMAIL_PROVIDER;
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-app-password";
  delete process.env.SMTP_FROM;

  let sentMessage;
  nodemailer.createTransport = () => ({
    sendMail: async (message) => {
      sentMessage = message;
      return { messageId: "reset-link-test-id" };
    },
  });

  const result = await sendPasswordResetEmail({
    toEmail: "admin@example.com",
    resetUrl: "https://ipes.example.com/login?resetToken=secure-token",
    expiresInMinutes: 15,
  });

  assert.equal(result.messageId, "reset-link-test-id");
  assert.equal(sentMessage.to, "admin@example.com");
  assert.match(sentMessage.subject, /reset your IPES password/i);
  assert.match(sentMessage.text, /https:\/\/ipes\.example\.com\/login\?resetToken=secure-token/);
  assert.match(sentMessage.html, /href="https:\/\/ipes\.example\.com\/login\?resetToken=secure-token"/);
  assert.match(sentMessage.text, /15 minutes/);
});

test("automatically uses SMTP when SMTP settings exist and no provider is selected", async () => {
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_SERVICE;
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-password";

  let transportOptions;
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return { sendMail: async () => ({ messageId: "smtp-auto-selected" }) };
  };

  const result = await sendRecoveryEmail({
    to: "admin@example.com",
    code: "123456",
  });

  assert.equal(result.messageId, "smtp-auto-selected");
  assert.equal(transportOptions.host, "smtp.example.com");
});

test("falls back to configured SMTP when Resend is selected but not configured", async () => {
  process.env.EMAIL_PROVIDER = "resend";
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-password";
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  let transportOptions;
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return { sendMail: async () => ({ messageId: "smtp-provider-fallback" }) };
  };
  console.warn = () => {};

  const result = await sendRecoveryEmail({
    to: "admin@example.com",
    code: "123456",
  });

  assert.equal(result.messageId, "smtp-provider-fallback");
  assert.equal(transportOptions.host, "smtp.example.com");
});

test("uses configured SMTP in production", async () => {
  process.env.NODE_ENV = "production";
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-app-password";

  let transportOptions;
  let sentMessage;
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return {
      sendMail: async (message) => {
        sentMessage = message;
        return { messageId: "production-smtp-test" };
      },
    };
  };

  const result = await sendRecoveryEmail({
    to: "admin@example.com",
    code: "123456",
  });

  assert.equal(result.messageId, "production-smtp-test");
  assert.equal(transportOptions.host, "smtp.gmail.com");
  assert.equal(transportOptions.port, 465);
  assert.equal(sentMessage.to, "admin@example.com");
});

test("falls back to Resend when SMTP cannot reach its network", async () => {
  process.env.NODE_ENV = "production";
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-app-password";
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <recovery@ipes.example.edu>";
  nodemailer.createTransport = () => ({
    sendMail: async () => {
      const error = new Error("connect ENETUNREACH");
      error.code = "ESOCKET";
      error.errno = "ENETUNREACH";
      throw error;
    },
  });

  let requestBody;
  global.fetch = async (_url, options) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => {
      requestBody = JSON.parse(options.body);
      return { id: "resend-fallback-test" };
    },
  });
  console.warn = () => {};

  const result = await sendRecoveryEmail({
    to: "admin@example.com",
    code: "123456",
  });

  assert.equal(result.id, "resend-fallback-test");
  assert.deepEqual(requestBody.to, ["admin@example.com"]);
  assert.match(requestBody.text, /123456/);
});

test("falls back to Resend when SMTP connection times out", async () => {
  process.env.NODE_ENV = "production";
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_USER = "sender@example.com";
  process.env.SMTP_PASS = "test-app-password";
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <recovery@ipes.example.edu>";
  nodemailer.createTransport = () => ({
    sendMail: async () => {
      const error = new Error("Connection timeout");
      error.code = "ETIMEDOUT";
      error.errno = "ETIMEDOUT";
      throw error;
    },
  });

  let sentTo;
  global.fetch = async (_url, options) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => {
      sentTo = JSON.parse(options.body).to;
      return { id: "resend-timeout-fallback-test" };
    },
  });
  console.warn = () => {};

  const result = await sendRecoveryEmail({
    toEmail: "person@example.com",
    code: "123456",
  });

  assert.equal(result.id, "resend-timeout-fallback-test");
  assert.deepEqual(sentTo, ["person@example.com"]);
});

test("reports missing SMTP configuration in production", async () => {
  process.env.NODE_ENV = "production";
  process.env.EMAIL_PROVIDER = "smtp";
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  console.error = () => {};

  await assert.rejects(
    sendRecoveryEmail({ to: "admin@example.com", code: "123456" }),
    {
      code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      message: /SMTP_HOST, SMTP_USER, SMTP_PASS are required/,
    },
  );
});

test("sends an email to multiple recipients", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <onboarding@resend.dev>";
  let requestBody;
  global.fetch = async (_url, options) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => {
      requestBody = JSON.parse(options.body);
      return { id: "email-multiple-recipients" };
    },
  });

  await sendEmail({
    to: ["first-admin@example.com", "second-admin@example.com"],
    subject: "IPES notification",
    text: "Test message",
  });

  assert.deepEqual(requestBody.to, [
    "first-admin@example.com",
    "second-admin@example.com",
  ]);
});

test("uses the configured verified-domain sender when provided", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <recovery@ipes.example.edu>";
  let requestBody;
  global.fetch = async (_url, options) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => {
      requestBody = JSON.parse(options.body);
      return { id: "email-custom-sender" };
    },
  });

  await sendRecoveryEmail({
    to: "second-admin@example.com",
    code: "654321",
  });

  assert.equal(requestBody.from, "IPES System <recovery@ipes.example.edu>");
  assert.deepEqual(requestBody.to, ["second-admin@example.com"]);
});

test("sends recovery codes to valid recipient addresses across common domains", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <recovery@ipes.example.edu>";
  const sentRecipients = [];
  global.fetch = async (_url, options) => {
    sentRecipients.push(...JSON.parse(options.body).to);
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ id: "email-domain-recipient-test" }),
    };
  };
  const recipients = [
    "admin@gmail.com",
    "user@yahoo.com",
    "student@outlook.com",
    "person@custom.example.edu",
  ];

  for (const recipient of recipients) {
    await sendRecoveryEmail({ to: recipient, code: "123456" });
  }

  assert.deepEqual(sentRecipients, recipients);
});

test("reports Resend dispatch errors with the provider details", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <onboarding@resend.dev>";
  console.error = () => {};
  global.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    headers: new Headers(),
    text: async () => JSON.stringify({
      name: "validation_error",
      message: "The sender domain is not verified.",
    }),
  });

  await assert.rejects(
    sendRecoveryEmail({
      to: "person@example.com",
      code: "123456",
    }),
    /The sender domain is not verified/,
  );
});

test("rejects invalid recovery codes before calling Resend", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  let dispatched = false;
  global.fetch = async () => {
    dispatched = true;
    throw new Error("Unexpected request");
  };

  await assert.rejects(
    sendRecoveryEmail({ to: "person@example.com", code: "abc" }),
    /exactly 6 digits/,
  );
  assert.equal(dispatched, false);
});

test("requires a configured sender instead of using Resend's restricted default", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  delete process.env.RESEND_FROM;
  console.error = () => {};
  let dispatched = false;
  global.fetch = async () => {
    dispatched = true;
    throw new Error("Unexpected request");
  };

  await assert.rejects(
    sendRecoveryEmail({ to: "person@example.com", code: "123456" }),
    {
      code: "EMAIL_SENDER_NOT_CONFIGURED",
      message: /Verify a sending domain in Resend and set RESEND_FROM/,
    },
  );
  assert.equal(dispatched, false);
});

test("rejects malformed recovery recipient addresses", async () => {
  process.env.RESEND_API_KEY = "re_test_api_key";
  process.env.RESEND_FROM = "IPES System <recovery@ipes.example.edu>";
  let dispatched = false;
  global.fetch = async () => {
    dispatched = true;
    throw new Error("Unexpected request");
  };

  await assert.rejects(
    sendRecoveryEmail({ to: "not-an-email", code: "123456" }),
    /recipient must be a valid email address/,
  );
  assert.equal(dispatched, false);
});
