const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const pool = require("../config/db");
const audit = require("../config/audit");
const emailService = require("../services/emailService");

const originalQuery = pool.query;
const originalGetSystemSetting = audit.getSystemSetting;
const originalSendEmail = emailService.sendEmail;
const originalConsoleError = console.error;
const sentEmails = [];
let deliveryError;
let configuredAdminEmail;
let configuredContactSettings;

const mockGetSystemSetting = async (key, fallback) => {
  if (key === "admin_contact_email" && configuredAdminEmail) {
    return configuredAdminEmail;
  }
  return configuredContactSettings[key] ?? fallback;
};

audit.getSystemSetting = mockGetSystemSetting;
emailService.sendEmail = async (message) => {
  sentEmails.push(message);
  if (deliveryError) throw deliveryError;
  return { messageId: "contact-email-test-id" };
};

const {
  submitContactMessage,
  getAdminContactSettings,
} = require("../controllers/contactController");

beforeEach(() => {
  sentEmails.length = 0;
  deliveryError = null;
  configuredAdminEmail = null;
  configuredContactSettings = {};
  audit.getSystemSetting = mockGetSystemSetting;
  pool.query = async (sql) => {
    if (String(sql).includes("INSERT INTO contact_messages")) {
      return [{ insertId: 42 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  console.error = originalConsoleError;
});

afterEach(() => {
  pool.query = originalQuery;
  audit.getSystemSetting = originalGetSystemSetting;
  emailService.sendEmail = originalSendEmail;
  console.error = originalConsoleError;
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

const validContactRequest = {
  body: {
    name: "Test Sender",
    email: "sender@example.com",
    subject: "Course question",
    message: "I would like more information about this course.",
  },
};

test("uses saved admin contact settings for public contact information", async () => {
  configuredContactSettings = {
    admin_contact_name: "Updated Admin",
    admin_contact_email: "updated@example.com",
    admin_contact_phone: "+251 911000000",
    admin_contact_location: "Updated Location",
  };

  const settings = await getAdminContactSettings();

  assert.equal(settings.name, "Updated Admin");
  assert.equal(settings.email, "updated@example.com");
  assert.equal(settings.phone, "+251 911000000");
  assert.equal(settings.location, "Updated Location");
});

test("dispatches contact form details to the designated admin email", async () => {
  configuredAdminEmail = "contact-admin@example.edu";
  const response = createResponse();

  await submitContactMessage(validContactRequest, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.emailSent, true);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, "contact-admin@example.edu");
  assert.equal(sentEmails[0].replyTo, "sender@example.com");
  assert.equal(sentEmails[0].subject, "[Contact Us] Course question");
  assert.match(sentEmails[0].text, /Name: Test Sender/);
  assert.match(sentEmails[0].text, /Email: sender@example\.com/);
  assert.match(sentEmails[0].text, /Subject: Course question/);
  assert.match(sentEmails[0].text, /I would like more information about this course\./);
  assert.match(sentEmails[0].html, /Test Sender/);
  assert.match(sentEmails[0].html, /sender@example\.com/);
  assert.match(sentEmails[0].html, /Course question/);
  assert.match(sentEmails[0].html, /I would like more information about this course\./);
});

test("confirms the contact message was saved when email delivery fails", async () => {
  deliveryError = new Error("SMTP server unavailable");
  const response = createResponse();
  let loggedFailure;
  console.error = (...args) => {
    loggedFailure = args;
  };

  await submitContactMessage(validContactRequest, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.success, true);
  assert.match(response.body.message.en, /message was saved.*email notification could not be delivered/i);
  assert.equal(response.body.data.id, 42);
  assert.equal(response.body.data.emailSent, false);
  assert.equal(loggedFailure[0], "Contact email sending failed.");
  assert.equal(loggedFailure[1].message, "SMTP server unavailable");
});

test("confirms saved contact messages when the email provider is missing", async () => {
  deliveryError = Object.assign(new Error("SMTP configuration missing"), {
    code: "EMAIL_PROVIDER_NOT_CONFIGURED",
  });
  const response = createResponse();

  await submitContactMessage(validContactRequest, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.emailSent, false);
  assert.match(response.body.message.en, /message was saved/i);
  assert.match(response.body.message.en, /university team will review/i);
});
