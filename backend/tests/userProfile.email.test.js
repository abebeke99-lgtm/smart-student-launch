const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const userSettings = require("../utils/userSettings");
const profileSettings = require("../utils/profileSettings");

const originalQuery = pool.query;
const originalGetConnection = pool.getConnection;
const originalCreateUserSession = userSettings.createUserSession;
const originalEnsureUserProfileSettings = profileSettings.ensureUserProfileSettings;
profileSettings.ensureUserProfileSettings = async () => {};
userSettings.createUserSession = async () => {};
const userRoutes = require("../routes/user");

after(() => {
  pool.query = originalQuery;
  pool.getConnection = originalGetConnection;
  userSettings.createUserSession = originalCreateUserSession;
  profileSettings.ensureUserProfileSettings = originalEnsureUserProfileSettings;
});

const makeToken = (role = "student") => jwt.sign(
  { id: 17, role, department_id: 4 },
  process.env.JWT_SECRET || "change-this-secret",
  { expiresIn: "1h" },
);

const invokeProfileUpdate = (body, role) => new Promise((resolve, reject) => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      resolve(this);
      return this;
    },
  };
  userRoutes.handle({
    method: "PUT",
    url: "/profile",
    headers: {
      authorization: `Bearer ${makeToken(role)}`,
      "content-type": "application/json",
    },
    body,
  }, response, (error) => reject(error || new Error("Profile route did not handle request.")));
});

test("saves a user's normalized recovery email and refreshed session token", async () => {
  const writes = [];
  pool.query = async (sql) => {
    if (String(sql).includes("SELECT email, profile_picture FROM user_profile_settings")) {
      return [[{ email: "new.address@example.com", profile_picture: null }]];
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  };
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      const statement = String(sql);
      if (statement.includes("SELECT u.username, u.role")) {
        return [[{
          username: "student17",
          email: "old.address@example.com",
          role: "student",
          department_id: 4,
          full_name: "Student Name",
          phone_number: "",
          profile_picture: null,
          student_user_id: 17,
        }]];
      }
      if (statement.includes("SELECT u.id") && statement.includes("LOWER(TRIM(ups.email))")) {
        assert.deepEqual(values, [17, "new.address@example.com", "new.address@example.com"]);
        return [[]];
      }
      writes.push({ sql: statement, values });
      return [{ affectedRows: 1 }];
    },
  });

  const response = await invokeProfileUpdate(
    { email: "  NEW.ADDRESS@Example.com " },
    "systemadmin",
  );

  assert.equal(response.statusCode, null);
  assert.equal(response.body.success, true);
  assert.equal(response.body.user.email, "new.address@example.com");
  assert.ok(writes.some(({ sql, values }) => (
    sql.includes("INSERT INTO user_profile_settings")
      && values[2] === "new.address@example.com"
  )));
  const decodedToken = jwt.verify(
    response.body.token,
    process.env.JWT_SECRET || "change-this-secret",
  );
  assert.equal(decodedToken.email, "new.address@example.com");
});

test("rejects an email address already used by another user", async () => {
  pool.query = async () => {
    throw new Error("The profile must not be reread for a duplicate email.");
  };
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (String(sql).includes("SELECT u.username, u.role")) {
        return [[{
          username: "student17",
          email: "old.address@example.com",
          role: "student",
          department_id: 4,
          full_name: "Student Name",
          phone_number: "",
          student_user_id: 17,
        }]];
      }
      if (String(sql).includes("LOWER(TRIM(ups.email))")) {
        return [[{ id: 22 }]];
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
  });

  const response = await invokeProfileUpdate({ email: "taken@example.com" }, "systemadmin");

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /already linked/i);
});
