const calculatePerformanceScore = ({
  isTeaching,
  studentScore = 0,
  peerScore = 0,
  supervisorScore = 0,
  isLabAssistant = false,
}) => {
  if (typeof isTeaching !== "boolean") {
    throw new TypeError("isTeaching must be a boolean.");
  }

  const weights = isTeaching || isLabAssistant
    ? { student: 0.5, peer: 0.2, supervisor: 0.3 }
    : { student: 0, peer: 0.4, supervisor: 0.6 };
  const studentContribution = Number(studentScore || 0) * weights.student;
  const peerContribution = Number(peerScore || 0) * weights.peer;
  const supervisorContribution =
    Number(supervisorScore || 0) * weights.supervisor;

  return {
    isTeaching,
    weights: {
      student: weights.student * 100,
      peer: weights.peer * 100,
      supervisor: weights.supervisor * 100,
    },
    studentContribution,
    peerContribution,
    supervisorContribution,
    totalScore: Number(
      (
        studentContribution +
        peerContribution +
        supervisorContribution
      ).toFixed(2),
    ),
  };
};

module.exports = { calculatePerformanceScore };
