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
const secureRoutes = require("../routes/secureRoutes");

after(() => {
  pool.query = originalQuery;
  pool.getConnection = originalGetConnection;
  userSettings.createUserSession = originalCreateUserSession;
  profileSettings.ensureUserProfileSettings = originalEnsureUserProfileSettings;
});

const makeToken = (role) => jwt.sign(
  { id: 17, role, department_id: 4 },
  process.env.JWT_SECRET || "change-this-secret",
  { expiresIn: "1h" },
);

const invokeRoute = (router, request) => new Promise((resolve, reject) => {
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
  router.handle(request, response, (error) => {
    reject(error || new Error("Route did not handle the request."));
  });
});

test("non-admin users cannot update username or recovery email", async () => {
  const originalPoolQuery = pool.query;
  pool.query = async () => [[]];

  try {
    for (const body of [
      { username: "new-login-name" },
      { email: "new-address@example.com" },
    ]) {
      const response = await invokeRoute(userRoutes, {
        method: "PUT",
        url: "/profile",
        headers: {
          authorization: `Bearer ${makeToken("instructor")}`,
          "content-type": "application/json",
        },
        body,
      });
      assert.equal(response.statusCode, 403);
    }
  } finally {
    pool.query = originalPoolQuery;
  }
});

test("admins cannot change username through the profile endpoint", async () => {
  const response = await invokeRoute(userRoutes, {
    method: "PUT",
    url: "/profile",
    headers: {
      authorization: `Bearer ${makeToken("systemadmin")}`,
      "content-type": "application/json",
    },
    body: { username: "new-login-name" },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body.message, /username cannot be changed/i);
});

test("non-admin users can update their full name", async () => {
  const connectionQueries = [];
  pool.query = async (sql) => {
    assert.match(String(sql), /SELECT email, profile_picture FROM user_profile_settings/);
    return [[{ email: "instructor@example.com", profile_picture: null }]];
  };
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      const statement = String(sql);
      connectionQueries.push(statement);
      if (statement.includes("SELECT u.username, u.role")) {
        return [[{
          username: "instructor17",
          role: "instructor",
          college_id: null,
          department_id: 4,
          instructor_user_id: 17,
          student_user_id: null,
          full_name: "Old Instructor",
          phone_number: "0912345678",
          email: "instructor@example.com",
          profile_picture: null,
        }]];
      }
      return [{ affectedRows: 1 }];
    },
  });

  const response = await invokeRoute(userRoutes, {
    method: "PUT",
    url: "/profile",
    headers: {
      authorization: `Bearer ${makeToken("instructor")}`,
      "content-type": "application/json",
    },
    body: { full_name: "New Instructor" },
  });

  assert.equal(response.statusCode, null);
  assert.equal(response.body.user.full_name, "New Instructor");
  assert.ok(connectionQueries.some((sql) => sql.includes("UPDATE instructors SET first_name")));
});

test("department heads cannot change login names through user management", async () => {
  const originalPoolQuery = pool.query;
  pool.query = async (sql) => (
    String(sql).includes("SELECT role, department_id FROM users")
      ? [[{ role: "instructor", department_id: 4 }]]
      : [[]]
  );

  try {
    const response = await invokeRoute(secureRoutes, {
      method: "PUT",
      url: "/users/17",
      headers: {
        authorization: `Bearer ${makeToken("dept_head")}`,
        "content-type": "application/json",
      },
      body: { username: "new-login-name" },
    });

    assert.equal(response.statusCode, 403);
  } finally {
    pool.query = originalPoolQuery;
  }
});
