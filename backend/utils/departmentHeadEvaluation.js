const normalizeRole = (role) => {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

  if (normalized === 'labassistant') return 'lab_assistant';
  if (normalized === 'ara') return 'lab_assistant';
  if (normalized === 'department_head') return 'dept_head';
  return normalized;
};

const isAcademicDirectorRole = (role) =>
  ['academic_directorate', 'academic_director', 'directorate'].includes(normalizeRole(role));

const isCollegeDeanRole = (role) =>
  ['college_dean', 'dean'].includes(normalizeRole(role));

const isAcademicLeaderRole = (role) =>
  isAcademicDirectorRole(role) || isCollegeDeanRole(role);

const isLabAssistantRole = (role) =>
  normalizeRole(role) === 'lab_assistant';

const isAllowedAcademicPeerPair = (evaluatorRole, targetRole) => {
  const normalizedEvaluator = normalizeRole(evaluatorRole);
  const normalizedTarget = normalizeRole(targetRole);
  if (normalizedEvaluator === 'lab_assistant') {
    return normalizedTarget === 'lab_assistant';
  }
  if (normalizedTarget === 'lab_assistant') {
    return false;
  }
  if (isCollegeDeanRole(normalizedEvaluator) && isAcademicDirectorRole(normalizedTarget)) {
    return true;
  }
  if (normalizedTarget === 'dept_head') {
    return normalizedEvaluator === 'instructor' || isAcademicLeaderRole(normalizedEvaluator);
  }
  if (isAcademicLeaderRole(normalizedEvaluator)) {
    return normalizedTarget === 'instructor';
  }
  if (isAcademicLeaderRole(normalizedTarget)) {
    return normalizedEvaluator === 'instructor' || normalizedEvaluator === 'dept_head';
  }
  return true;
};

const isAllowedDepartmentHeadTargetRole = (role) =>
  ['instructor', 'lab_assistant'].includes(normalizeRole(role));

const isAllowedDepartmentHeadPeerTargetRole = (role) =>
  isAllowedDepartmentHeadTargetRole(role) || isAcademicLeaderRole(role);

const isAllowedPeerEvaluationPair = (evaluatorRole, targetRole) => {
  const normalizedEvaluator = normalizeRole(evaluatorRole);
  const normalizedTarget = normalizeRole(targetRole);
  if (isLabAssistantRole(normalizedEvaluator)) {
    return isLabAssistantRole(normalizedTarget);
  }
  if (isLabAssistantRole(normalizedTarget)) {
    return false;
  }
  if (normalizedEvaluator === 'dept_head') {
    return isAllowedDepartmentHeadPeerTargetRole(normalizedTarget);
  }
  return isAllowedAcademicPeerPair(normalizedEvaluator, normalizedTarget);
};

const isSameDepartmentPeerPair = (evaluatorDepartmentId, targetDepartmentId) => {
  const evaluatorId = Number(evaluatorDepartmentId);
  const targetId = Number(targetDepartmentId);
  return (
    Number.isInteger(evaluatorId) &&
    evaluatorId > 0 &&
    Number.isInteger(targetId) &&
    evaluatorId === targetId
  );
};

module.exports = {
  isAllowedAcademicPeerPair,
  isAcademicDirectorRole,
  isAcademicLeaderRole,
  isLabAssistantRole,
  isCollegeDeanRole,
  isAllowedPeerEvaluationPair,
  isAllowedDepartmentHeadTargetRole,
  isAllowedDepartmentHeadPeerTargetRole,
  isSameDepartmentPeerPair,
  normalizeRole,
};
