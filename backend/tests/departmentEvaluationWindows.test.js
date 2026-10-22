const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  isEvaluationDeadlineExpired,
} = require("../config/departmentEvaluationWindows");

test("marks evaluation deadlines in the past as expired", () => {
  const expiredDeadline = new Date(Date.now() - 60_000).toISOString();
  assert.equal(isEvaluationDeadlineExpired(expiredDeadline), true);
});

test("keeps future evaluation deadlines active", () => {
  const futureDeadline = new Date(Date.now() + 60_000).toISOString();
  assert.equal(isEvaluationDeadlineExpired(futureDeadline), false);
});

test("does not treat missing or invalid deadlines as expired", () => {
  assert.equal(isEvaluationDeadlineExpired(null), false);
  assert.equal(isEvaluationDeadlineExpired("not-a-date"), false);
});
