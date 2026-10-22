const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAllowedAcademicPeerPair,
  isAcademicDirectorRole,
  isAcademicLeaderRole,
  isCollegeDeanRole,
  isAllowedDepartmentHeadTargetRole,
  isAllowedDepartmentHeadPeerTargetRole,
  isAllowedPeerEvaluationPair,
  isSameDepartmentPeerPair,
  normalizeRole,
} = require('../utils/departmentHeadEvaluation');

test('allows instructors and lab assistant role aliases as department head targets', () => {
  for (const role of ['instructor', 'Lab Assistant', 'lab-assistant', 'ara']) {
    assert.equal(isAllowedDepartmentHeadTargetRole(role), true, role);
  }
});

test('rejects department heads and higher academic leadership roles', () => {
  for (const role of [
    'dept_head',
    'College Dean',
    'Dean',
    'Academic Director',
    'academic_directorate',
  ]) {
    assert.equal(isAllowedDepartmentHeadTargetRole(role), false, role);
  }
});

test('allows academic leaders as peer targets without widening supervisor targets', () => {
  for (const role of ['College Dean', 'Academic Directorate']) {
    assert.equal(isAllowedDepartmentHeadPeerTargetRole(role), true, role);
    assert.equal(isAllowedDepartmentHeadTargetRole(role), false, role);
  }
});

test('normalizes department role labels consistently', () => {
  assert.equal(normalizeRole('Academic Director'), 'academic_director');
  assert.equal(normalizeRole('lab-assistant'), 'lab_assistant');
  assert.equal(normalizeRole('LabAssistant'), 'lab_assistant');
  assert.equal(normalizeRole('Department Head'), 'dept_head');
});

test('recognizes academic leaders for department-restricted peer rules', () => {
  assert.equal(isAcademicDirectorRole('Academic Director'), true);
  assert.equal(isCollegeDeanRole('College Dean'), true);
  assert.equal(isAcademicLeaderRole('directorate'), true);
  assert.equal(isAcademicLeaderRole('instructor'), false);
});

test('limits academic leadership peer pairs to the eligible department roles', () => {
  assert.equal(isAllowedAcademicPeerPair('Academic Director', 'instructor'), true);
  assert.equal(isAllowedAcademicPeerPair('College Dean', 'instructor'), true);
  assert.equal(isAllowedAcademicPeerPair('instructor', 'College Dean'), true);
  assert.equal(isAllowedAcademicPeerPair('instructor', 'Academic Director'), true);
  assert.equal(isAllowedAcademicPeerPair('College Dean', 'lab_assistant'), false);
  assert.equal(isAllowedAcademicPeerPair('dept_head', 'Academic Director'), true);
  assert.equal(isAllowedAcademicPeerPair('Academic Director', 'College Dean'), false);
});

test('allows only instructors and same-department academic leaders to peer-evaluate department heads', () => {
  assert.equal(isAllowedAcademicPeerPair('Instructor', 'Department Head'), true);
  assert.equal(isAllowedAcademicPeerPair('College Dean', 'Department Head'), true);
  assert.equal(isAllowedAcademicPeerPair('Academic Directorate', 'Department Head'), true);
  assert.equal(isAllowedAcademicPeerPair('Lab Assistant', 'Department Head'), false);
  assert.equal(isAllowedAcademicPeerPair('Department Head', 'Department Head'), false);
});

test('restricts Lab Assistant peer evaluations to other Lab Assistants', () => {
  for (const role of ['Lab Assistant', 'lab_assistant', 'ara', 'lab-assistant', 'labassistant']) {
    assert.equal(isAllowedPeerEvaluationPair('Lab Assistant', role), true, role);
  }
  for (const role of ['Instructor', 'Department Head', 'College Dean', 'Academic Directorate']) {
    assert.equal(isAllowedPeerEvaluationPair('Lab Assistant', role), false, role);
    assert.equal(isAllowedPeerEvaluationPair(role, 'Lab Assistant'), false, role);
  }
});

test('requires matching, valid department IDs for peer assignment pairs', () => {
  assert.equal(isSameDepartmentPeerPair(65, '65'), true);
  assert.equal(isSameDepartmentPeerPair(65, 66), false);
  assert.equal(isSameDepartmentPeerPair(null, 65), false);
  assert.equal(isSameDepartmentPeerPair(0, 0), false);
});
