const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const {
  resetUserPassword,
  resetUserPasswordDirectly,
} = require("../controllers/adminController");

const originalQuery = pool.query;
const originalConsoleError = console.error;

afterEach(() => {
  pool.query = originalQuery;
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

test("hashes and stores an admin-provided password", async () => {
  let update;
  pool.query = async (sql, params) => {
    update = { sql, params };
    return [{ affectedRows: 1 }];
  };
  const response = createResponse();

  await resetUserPasswordDirectly(
    { body: { userId: "42", newPassword: "AdminSet1!" } },
    response,
  );

  assert.equal(response.body.success, true);
  assert.equal(update.params[1], 42);
  assert.notEqual(update.params[0], "AdminSet1!");
  assert.equal(await bcrypt.compare("AdminSet1!", update.params[0]), true);
  assert.match(update.sql, /reset_otp = NULL/);
  assert.match(update.sql, /reset_token = NULL/);
});

test("resets a user's password to the configured default and requires a password change", async () => {
  let update;
  pool.query = async (sql, params) => {
    update = { sql, params };
    return [{ affectedRows: 1 }];
  };
  const response = createResponse();

  await resetUserPassword({ params: { id: "42" } }, response);

  const defaultPassword =
    process.env.USER_DEFAULT_PASSWORD ||
    process.env.DEFAULT_PASSWORD ||
    "12345678";
  assert.equal(response.statusCode, null);
  assert.equal(response.body.success, true);
  assert.equal(response.body.defaultPassword, defaultPassword);
  assert.equal(response.body.forcePasswordChange, true);
  assert.equal(update.params[1], 42);
  assert.equal(await bcrypt.compare(defaultPassword, update.params[0]), true);
  assert.match(update.sql, /is_first_login = 1/);
  assert.match(update.sql, /reset_otp = NULL/);
  assert.match(update.sql, /reset_token = NULL/);
});

test("rejects invalid passwords without updating the account", async () => {
  let queryCount = 0;
  pool.query = async () => {
    queryCount += 1;
    return [{ affectedRows: 1 }];
  };

  for (const newPassword of ["short", "é".repeat(37)]) {
    const response = createResponse();
    await resetUserPasswordDirectly(
      { body: { userId: 42, newPassword } },
      response,
    );
    assert.equal(response.statusCode, 400);
  }
  assert.equal(queryCount, 0);
});

test("returns not found for an unknown account", async () => {
  pool.query = async () => [{ affectedRows: 0 }];
  const response = createResponse();
  await resetUserPasswordDirectly(
    { body: { userId: 42, newPassword: "AdminSet1!" } },
    response,
  );
  assert.equal(response.statusCode, 404);
});

test("returns a clear server error when the update fails", async () => {
  pool.query = async () => {
    throw new Error("database unavailable");
  };
  console.error = () => {};
  const response = createResponse();
  await resetUserPasswordDirectly(
    { body: { userId: 42, newPassword: "AdminSet1!" } },
    response,
  );
  assert.equal(response.statusCode, 500);
  assert.match(response.body.message, /Unable to reset/);
});
