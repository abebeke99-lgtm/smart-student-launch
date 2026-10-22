const assert = require("node:assert/strict");
const { test } = require("node:test");
const deptHeadRoutes = require("../routes/deptHead");

test("registers GET, POST, and DELETE department evaluation schedule endpoints", () => {
  const registeredMethods = deptHeadRoutes.stack
    .filter((layer) => layer.route?.path === "/evaluation-schedule")
    .flatMap((layer) => Object.keys(layer.route.methods));

  assert.ok(registeredMethods.includes("get"));
  assert.ok(registeredMethods.includes("post"));
  assert.ok(registeredMethods.includes("delete"));
});
