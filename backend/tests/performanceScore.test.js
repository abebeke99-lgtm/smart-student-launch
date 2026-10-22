const test = require("node:test");
const assert = require("node:assert/strict");
const { calculatePerformanceScore } = require("../utils/performanceScore");

test("teaching performance weights student, peer, and supervisor scores", () => {
  assert.deepEqual(
    calculatePerformanceScore({
      isTeaching: true,
      studentScore: 80,
      peerScore: 70,
      supervisorScore: 90,
    }),
    {
      isTeaching: true,
      weights: { student: 50, peer: 20, supervisor: 30 },
      studentContribution: 40,
      peerContribution: 14,
      supervisorContribution: 27,
      totalScore: 81,
    },
  );
});

test("non-teaching performance excludes student scores entirely", () => {
  const result = calculatePerformanceScore({
    isTeaching: false,
    studentScore: 100,
    peerScore: 70,
    supervisorScore: 90,
  });

  assert.deepEqual(result.weights, {
    student: 0,
    peer: 40,
    supervisor: 60,
  });
  assert.equal(result.studentContribution, 0);
  assert.equal(result.totalScore, 82);
});

test("Lab Assistant peer evaluations contribute 20 percent", () => {
  const result = calculatePerformanceScore({
    isTeaching: false,
    isLabAssistant: true,
    peerScore: 80,
  });

  assert.deepEqual(result.weights, {
    student: 50,
    peer: 20,
    supervisor: 30,
  });
  assert.equal(result.peerContribution, 16);
  assert.equal(result.totalScore, 16);
});

test("performance totals are rounded to two decimal places", () => {
  assert.equal(
    calculatePerformanceScore({
      isTeaching: true,
      studentScore: 82.25,
      peerScore: 77.75,
      supervisorScore: 91.5,
    }).totalScore,
    84.13,
  );
});

test("rejects missing teaching status instead of guessing a weight set", () => {
  assert.throws(
    () =>
      calculatePerformanceScore({
        studentScore: 80,
        peerScore: 70,
        supervisorScore: 90,
      }),
    { name: "TypeError", message: "isTeaching must be a boolean." },
  );
});
