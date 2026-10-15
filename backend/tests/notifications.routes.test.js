const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const notificationRoutes = require("../routes/notifications");

const originalQuery = pool.query;
const userId = 42;
const token = jwt.sign(
  { id: userId, role: "student", department_id: 7 },
  process.env.JWT_SECRET || "change-this-secret",
  { expiresIn: "1h" },
);

after(() => {
  pool.query = originalQuery;
});

const invokeRoute = (request) => new Promise((resolve, reject) => {
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

  notificationRoutes.handle({
    headers: { authorization: `Bearer ${token}` },
    ...request,
  }, response, (error) => {
    reject(error || new Error("Notification route did not handle request."));
  });
});

test("deletes one notification only for the authenticated user", async () => {
  pool.query = async (sql, values) => {
    assert.match(String(sql), /DELETE FROM notifications WHERE id = \? AND user_id = \?/);
    assert.deepEqual(values, [15, userId]);
    return [{ affectedRows: 1 }];
  };

  const response = await invokeRoute({
    method: "DELETE",
    url: "/15",
    params: { id: "15" },
  });

  assert.equal(response.statusCode, null);
  assert.deepEqual(response.body, { success: true, deletedCount: 1 });
});

test("clears all notifications only for the authenticated user", async () => {
  pool.query = async (sql, values) => {
    assert.match(String(sql), /DELETE FROM notifications WHERE user_id = \?/);
    assert.deepEqual(values, [userId]);
    return [{ affectedRows: 3 }];
  };

  const response = await invokeRoute({
    method: "DELETE",
    url: "/clear-all",
  });

  assert.equal(response.statusCode, null);
  assert.deepEqual(response.body, { success: true, deletedCount: 3 });
});

test("bulk-deletes selected notifications with user-scoped IDs", async () => {
  pool.query = async (sql, values) => {
    assert.match(String(sql), /WHERE user_id = \? AND id IN \(\?, \?\)/);
    assert.deepEqual(values, [userId, 10, 11]);
    return [{ affectedRows: 2 }];
  };

  const response = await invokeRoute({
    method: "DELETE",
    url: "/bulk-delete",
    body: { ids: [10, 11, 10] },
  });

  assert.equal(response.statusCode, null);
  assert.deepEqual(response.body, { success: true, deletedCount: 2 });
});

test("rejects invalid bulk notification IDs without querying the database", async () => {
  pool.query = async () => {
    throw new Error("Invalid notification IDs must not reach the database.");
  };

  const response = await invokeRoute({
    method: "DELETE",
    url: "/bulk-delete",
    body: { ids: [10, "not-an-id"] },
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /valid notification IDs/i);
});

test("returns not found when the user does not own the notification", async () => {
  pool.query = async (_sql, values) => {
    assert.deepEqual(values, [15, userId]);
    return [{ affectedRows: 0 }];
  };

  const response = await invokeRoute({
    method: "DELETE",
    url: "/15",
    params: { id: "15" },
  });

  assert.equal(response.statusCode, 404);
});
