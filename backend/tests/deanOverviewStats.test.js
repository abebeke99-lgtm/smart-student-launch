const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../config/db");
const deanRoutes = require("../routes/dean");

const originalQuery = pool.query;

after(() => {
  pool.query = originalQuery;
});

const invokeOverviewStats = () => new Promise((resolve, reject) => {
  const route = deanRoutes.stack.find(
    (layer) => layer.route?.path === "/overview-stats",
  )?.route;
  const handler = route?.stack[route.stack.length - 1]?.handle;
  if (!handler) return reject(new Error("Overview stats route was not found."));

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      resolve({ statusCode: this.statusCode, body });
      return this;
    },
  };
  Promise.resolve(handler({ user: { id: 23 } }, response)).catch(reject);
});

test("resolves a College Dean's college from their instructor department", async () => {
  const calls = [];
  pool.query = async (sql, values) => {
    const query = String(sql);
    calls.push({ query, values });

    if (query.includes("FROM system_settings")) {
      return [[{ setting_value: "7" }]];
    }
    if (query.includes("FROM evaluation_cycles WHERE id = ?")) {
      return [[{ id: 7 }]];
    }
    if (query.includes("instructor_department.college_id")) {
      assert.match(query, /LEFT JOIN instructors i ON i\.user_id = u\.id/);
      assert.match(query, /LEFT JOIN departments instructor_department ON instructor_department\.id = i\.department_id/);
      return [[{ college_id: 4 }]];
    }
    if (query.includes("COUNT(*) AS departmentsCount")) {
      assert.deepEqual(values, [4]);
      return [[{ departmentsCount: 2 }]];
    }
    if (query.includes("pendingDeptHeadEvals")) {
      assert.deepEqual(values, [4, 23, 7]);
      return [[{ pendingDeptHeadEvals: 3, completedEvals: 1 }]];
    }

    throw new Error(`Unexpected query in test: ${query}`);
  };

  const response = await invokeOverviewStats();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    departmentsCount: 2,
    pendingDeptHeadEvals: 3,
    completedEvals: 1,
  });
  assert.equal(calls.some(({ query }) => query.includes("instructor_department.college_id")), true);
});
