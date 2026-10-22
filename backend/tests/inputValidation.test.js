const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  collectValidationErrors,
  isValidEmail,
  isValidEthiopianPhone,
  isValidPassword,
  isValidUsername,
  sanitizeValue,
  validateRequestInput,
} = require("../utils/inputValidation");
const { isValidRegistrationPhoneNumber } = require("../utils/phone");

test("accepts mau-number usernames and admin emails only when explicitly allowed", () => {
  assert.equal(isValidUsername("mau12345"), true);
  assert.equal(isValidUsername("MAU110822"), true);
  assert.equal(isValidUsername("mau12abc"), false);
  assert.equal(isValidUsername(" mau12345"), false);
  assert.equal(isValidUsername("mau12345 "), false);
  assert.equal(isValidUsername("user@example.com"), false);
  assert.equal(isValidUsername("admin@example.com", { allowEmail: true }), true);
});

test("validates minimum password length, email, and Ethiopian telephone formats", () => {
  assert.equal(isValidPassword("ValidPass1!"), true);
  assert.equal(isValidPassword("12345678"), true);
  assert.equal(isValidPassword("pass word"), true);
  assert.equal(isValidPassword("short7!"), false);
  assert.equal(isValidPassword(""), false);
  assert.equal(isValidEmail("person.name+tag@example.edu.et"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEthiopianPhone("0912345678"), true);
  assert.equal(isValidEthiopianPhone("+251912345678"), true);
  assert.equal(isValidEthiopianPhone("0712345678"), true);
  assert.equal(isValidEthiopianPhone("0612345678"), false);
});

test("requires registration phone numbers to be exactly 10 digits starting with 09 or 07", () => {
  assert.equal(isValidRegistrationPhoneNumber("0911223344"), true);
  assert.equal(isValidRegistrationPhoneNumber("0711223344"), true);
  assert.equal(isValidRegistrationPhoneNumber("09666jj666"), false);
  assert.equal(isValidRegistrationPhoneNumber("091122334"), false);
  assert.equal(isValidRegistrationPhoneNumber("+251911223344"), false);
  assert.equal(isValidRegistrationPhoneNumber("0811223344"), false);
});

test("validates registration names as letters and spaces with at least three characters", () => {
  assert.deepEqual(collectValidationErrors({
    first_name: "Negese",
    last_name: "Abewa",
  }), []);
  assert.deepEqual(
    collectValidationErrors({
      first_name: "Ne2",
      last_name: "Li",
    }).map(({ field }) => field),
    ["first_name", "last_name"],
  );
  assert.deepEqual(collectValidationErrors({
    first_name: "አበባ",
    last_name: "ተስፋዬ",
  }), []);
});

test("sanitizes HTML from text fields without modifying secrets", () => {
  assert.deepEqual(
    sanitizeValue({
      name: " <script>alert(1)</script><b>Ada</b> ",
      password: " SecretPass1! ",
    }),
    { name: "Ada", password: " SecretPass1! " },
  );
});

test("returns explicit 400 validation errors for invalid endpoint payloads", () => {
  const request = {
    method: "POST",
    path: "/api/secure/users",
    body: {
      username: "not-valid",
      email: "invalid",
      phone: "123",
      newPassword: "weak",
      ratings: { teaching: 7 },
      score: 101,
      maxScore: 101,
    },
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

  validateRequestInput(request, response, () => assert.fail("Invalid body must not pass."));
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.errors.find(({ field }) => field === "newPassword").message,
    "Password must contain at least 8 characters.",
  );
  assert.deepEqual(
    response.body.errors.map(({ field }) => field),
    ["username", "email", "phone", "newPassword", "ratings.teaching", "score", "maxScore"],
  );
});

test("allows a formatted email identifier at login but rejects it on ordinary user creation", () => {
  const invoke = (request) => {
    const response = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let proceeded = false;
    validateRequestInput(request, response, () => { proceeded = true; });
    return { proceeded, response };
  };

  assert.equal(invoke({
    method: "POST",
    path: "/api/auth/login",
    body: { username: "admin@example.edu", password: "legacy" },
  }).proceeded, true);
  const ordinaryUser = invoke({
    method: "POST",
    path: "/api/secure/users",
    body: { username: "admin@example.edu" },
  });
  assert.equal(ordinaryUser.proceeded, false);
  assert.equal(ordinaryUser.response.statusCode, 400);
});

test("allows a recovery email in the username field for password recovery", () => {
  const response = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let proceeded = false;

  validateRequestInput(
    {
      method: "POST",
      path: "/api/auth/forgot-password",
      body: { username: "recovery@example.edu", email: "recovery@example.edu" },
    },
    response,
    () => { proceeded = true; },
  );

  assert.equal(proceeded, true);
  assert.equal(response.statusCode, null);
});

test("does not trim username input before strict validation", () => {
  const response = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const request = {
    method: "POST",
    path: "/api/secure/users",
    body: { username: " mau12345 " },
  };

  validateRequestInput(request, response, () => assert.fail("Whitespace must make the username invalid."));
  assert.equal(response.statusCode, 400);
  assert.equal(request.body.username, " mau12345 ");
});

test("does not mask profile authorization checks with username format errors", () => {
  const response = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let proceeded = false;

  validateRequestInput(
    {
      method: "PUT",
      path: "/api/user/profile",
      body: { username: "not-allowed" },
    },
    response,
    () => { proceeded = true; },
  );

  assert.equal(proceeded, true);
  assert.equal(response.statusCode, null);
});

test("collects validation errors without throwing on optional values", () => {
  assert.deepEqual(collectValidationErrors({ email: "", phone: null }), []);
});
