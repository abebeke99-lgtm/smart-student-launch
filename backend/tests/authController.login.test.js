const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const audit = require("../config/audit");
const userSettings = require("../utils/userSettings");

const originalQuery = pool.query;
const originalCompare = bcrypt.compare;
const originalLogAuditEvent = audit.logAuditEvent;
const originalIsSystemActive = audit.isSystemActive;
const originalCreateUserSession = userSettings.createUserSession;
let systemActive = true;
let passwordCompareCalls = 0;
const login = (() => {
  bcrypt.compare = async () => true;
  audit.logAuditEvent = async () => {};
  audit.isSystemActive = async () => systemActive;
  userSettings.createUserSession = async () => {};
  return require("../controllers/authController").login;
})();

beforeEach(() => {
  passwordCompareCalls = 0;
  bcrypt.compare = async () => {
    passwordCompareCalls += 1;
    return true;
  };
  audit.logAuditEvent = async () => {};
  audit.isSystemActive = async () => systemActive;
  userSettings.createUserSession = async () => {};
});

afterEach(() => {
  pool.query = originalQuery;
  bcrypt.compare = originalCompare;
  audit.logAuditEvent = originalLogAuditEvent;
  audit.isSystemActive = originalIsSystemActive;
  userSettings.createUserSession = originalCreateUserSession;
  systemActive = true;
});

test("rejects non-admin logins while system maintenance is active", async () => {
  pool.query = async () => [[{
    id: 7,
    username: "student.one",
    email: "student@example.edu",
    password_hash: "stored-hash",
    role: "student",
    status: "active",
    is_first_login: 0,
  }]];
  systemActive = false;

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

  await login(
    {
      body: { username: "mau12345", password: "valid-password" },
      headers: {},
      session: {},
    },
    response,
  );

  assert.equal(response.statusCode, 503);
  assert.equal(
    response.body.message,
    "System is currently unavailable. Please contact the administrator.",
  );
  assert.equal(passwordCompareCalls, 0);
});

test("allows System Admin login while system maintenance is active", async () => {
  pool.query = async () => [[{
    id: 1,
    username: "system.admin",
    email: "admin@example.edu",
    password_hash: "stored-hash",
    role: "systemadmin",
    status: "active",
    is_first_login: 0,
  }]];
  systemActive = false;

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

  await login(
    {
      body: { username: "mau12345", password: "valid-password" },
      headers: {},
      session: {},
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(passwordCompareCalls, 1);
});

test("matches an email login only against the user's current primary email", async () => {
  let query = "";
  let parameters = [];
  pool.query = async (sql, values) => {
    query = String(sql);
    parameters = values;
    return [[{
      id: 7,
      username: "super.admin",
      email: "new-address@example.edu",
      password_hash: "stored-hash",
      role: "systemadmin",
      status: "active",
      is_first_login: 0,
    }]];
  };

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

  await login(
    {
      body: {
        username: "new-address@example.edu",
        password: "valid-password",
      },
      headers: {},
      session: {},
    },
    response,
  );

  assert.match(query, /LOWER\(TRIM\(u\.username\)\) = LOWER\(\?\)/i);
  assert.match(query, /u\.role IN \('admin', 'systemadmin'\)[\s\S]*LOWER\(TRIM\(ups\.email\)\)/i);
  assert.deepEqual(parameters, [
    "new-address@example.edu",
    "new-address@example.edu",
    "new-address@example.edu",
  ]);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.user.email, "new-address@example.edu");
  assert.equal(response.body.data.user.username, "super.admin");
});

test("does not authenticate an old email when it no longer matches the primary email", async () => {
  let responseStatus = null;
  let responseBody = null;
  pool.query = async (sql, values) => {
    assert.match(String(sql), /LOWER\(TRIM\(u\.username\)\) = LOWER\(\?\)/i);
    assert.match(String(sql), /u\.role IN \('admin', 'systemadmin'\)/i);
    assert.deepEqual(values, [
      "old-address@example.edu",
      "old-address@example.edu",
      "old-address@example.edu",
    ]);
    return [[]];
  };

  await login(
    {
      body: {
        username: "old-address@example.edu",
        password: "valid-password",
      },
      headers: {},
      session: {},
    },
    {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    },
  );

  assert.equal(responseStatus, 401);
  assert.equal(responseBody.message, "Incorrect username");
});

test("rejects usernames outside the mau-number or valid-email formats without trimming", async () => {
  let queryCount = 0;
  pool.query = async () => {
    queryCount += 1;
    return [[]];
  };
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

  await login(
    {
      body: { username: " mau1600548 ", password: "password" },
      headers: {},
      session: {},
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /mau followed by digits/);
  assert.equal(queryCount, 0);
});
