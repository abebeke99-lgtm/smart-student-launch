const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

const originalQuery = pool.query;
const secret = process.env.JWT_SECRET || "change-this-secret";

const authenticate = (token) =>
  new Promise((resolve) => {
    let statusCode = 200;
    let body;
    let nextCalled = false;
    const req = {
      headers: { authorization: `Bearer ${token}` },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(responseBody) {
        body = responseBody;
        resolve({ statusCode, body, nextCalled });
        return this;
      },
    };

    authenticateToken(req, res, () => {
      nextCalled = true;
      resolve({ statusCode, body, nextCalled, user: req.user });
    });
  });

(async () => {
  try {
    const sessionId = "a3bb4411-86c9-4e4f-a1a8-021ceab1d47f";
    const token = jwt.sign(
      { id: 42, jti: sessionId, role: "systemadmin", department_id: 7 },
      secret,
      { expiresIn: "1h" },
    );

    pool.query = async (sql) => {
      if (String(sql).includes("FROM user_sessions")) return [[{ id: sessionId }]];
      if (String(sql).includes("UPDATE user_sessions")) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    };
    const activeResult = await authenticate(token);
    assert.equal(activeResult.nextCalled, true, "an active tracked session should pass authentication");
    assert.equal(activeResult.user.jti, sessionId);

    pool.query = async (sql) => {
      if (String(sql).includes("FROM user_sessions")) return [[]];
      throw new Error(`Unexpected query: ${sql}`);
    };
    const revokedResult = await authenticate(token);
    assert.equal(revokedResult.statusCode, 401, "a revoked session should be rejected");
    assert.equal(revokedResult.nextCalled, false);
    assert.match(revokedResult.body.message, /session has ended/i);
  } catch (error) {
    console.error("User session authentication tests failed:", error);
    process.exitCode = 1;
  } finally {
    pool.query = originalQuery;
  }
})();
