const express = require("express");
const pool = require("../config/db");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { getActiveEvaluationCycle } = require("../config/evaluationCycles");
const {
  getDepartmentEvaluationDeadline,
} = require("../config/departmentEvaluationWindows");
const { calculatePerformanceScore } = require("../utils/performanceScore");

const router = express.Router();
router.use(
  authenticateToken,
  authorizeRoles("academic_directorate", "academic_director", "directorate"),
);

const sendServerError = (res, error, message) => {
  console.error(`Directorate ${message}:`, error);
  return res
    .status(500)
    .json({ message: "Server Error", error: error.message });
};

router.get("/overview-stats", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    const [[collegeCount]] = await pool.query(
      "SELECT COUNT(*) AS totalColleges FROM colleges",
    );
    const [[evaluationCount]] = await pool.query(
      `SELECT
        SUM(CASE WHEN de.id IS NULL OR LOWER(COALESCE(de.status, 'pending')) NOT IN ('completed', 'published') THEN 1 ELSE 0 END) AS pendingDeans,
        SUM(CASE WHEN LOWER(COALESCE(de.status, 'pending')) IN ('completed', 'published') THEN 1 ELSE 0 END) AS completedDeans
       FROM users u
       LEFT JOIN directorate_evaluations de ON de.id = (
         SELECT MAX(latest.id)
         FROM directorate_evaluations latest
         WHERE latest.dean_id = u.id AND latest.evaluator_id = ?
           AND latest.cycle_id = ?
       )
       WHERE LOWER(u.role) = 'college_dean'`,
      [req.user.id, activeCycle?.id || 0],
    );
    return res.json({
      totalColleges: Number(collegeCount?.totalColleges || 0),
      pendingDeans: Number(evaluationCount?.pendingDeans || 0),
      completedDeans: Number(evaluationCount?.completedDeans || 0),
    });
  } catch (error) {
    return sendServerError(res, error, "overview stats error");
  }
});

router.get("/deans", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    const [[evaluatorScope]] = await pool.query(
      `SELECT COALESCE(i.department_id, u.department_id) AS department_id
       FROM users u
       LEFT JOIN instructors i ON i.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [req.user.id],
    );
    const deadline = await getDepartmentEvaluationDeadline(
      evaluatorScope?.department_id || req.user.department_id,
      activeCycle?.end_at,
    );
    const [rows] = await pool.query(
      `SELECT u.id AS deanId,
        COALESCE(NULLIF(ups.full_name, ''), NULLIF(CONCAT_WS(' ', i.first_name, i.last_name), ''), u.username) AS full_name,
        u.username,
        u.role,
        u.college_id AS collegeId,
        COALESCE(c.name, 'Unassigned') AS college_name,
          active_cycle.academic_year,
          active_cycle.semester,
          ? AS expiryDate,
          ? AS deadline,
          COALESCE(de.status, 'PENDING') AS evaluation_status,
          COALESCE(de.final_score, de.total_score) AS score,
          de.final_score AS final_score,
          de.total_score AS supervisor_score,
          de.student_average,
          de.peer_average,
          COALESCE(de.is_teaching, EXISTS (
            SELECT 1 FROM course_assignments teaching_ca
            WHERE teaching_ca.instructor_id = i.id
              AND teaching_ca.cycle_id = active_cycle.id
          )) AS is_teaching,
          de.ratings,
          de.strengths,
          de.weaknesses,
          de.updated_at AS evaluation_updated_at
       FROM users u
      LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
      LEFT JOIN instructors i ON i.user_id = u.id
      LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN colleges c ON c.id = u.college_id
         LEFT JOIN evaluation_cycles active_cycle ON active_cycle.id = ?
         LEFT JOIN directorate_evaluations de ON de.id = (
           SELECT latest.id
           FROM directorate_evaluations latest
           WHERE latest.dean_id = u.id AND latest.evaluator_id = ?
             AND latest.cycle_id = ?
           ORDER BY latest.updated_at DESC, latest.id DESC
           LIMIT 1
         )
       WHERE LOWER(u.role) = 'college_dean'
       ORDER BY college_name ASC, full_name ASC`,
      [
        deadline,
        deadline,
        activeCycle?.id || 0,
        req.user.id,
        activeCycle?.id || 0,
      ],
    );
    return res.json(
      rows.map((row) => ({
        ...row,
        score:
          row.score === null || row.score === undefined
            ? null
            : Number(row.score),
        final_score:
          row.final_score === null || row.final_score === undefined
            ? null
            : Number(row.final_score),
        supervisor_score:
          row.supervisor_score === null || row.supervisor_score === undefined
            ? null
            : Number(row.supervisor_score),
        student_average: Number(row.student_average || 0),
        peer_average: Number(row.peer_average || 0),
        is_teaching: Boolean(row.is_teaching),
      })),
    );
  } catch (error) {
    return sendServerError(res, error, "deans query error");
  }
});

router.post("/calculate-publish-results", async (req, res) => {
  let connection;
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [evaluations] = await connection.query(
      `SELECT u.id AS dean_id, i.id AS instructor_id,
        EXISTS (
          SELECT 1 FROM course_assignments teaching_ca
          WHERE teaching_ca.instructor_id = i.id
            AND teaching_ca.cycle_id = ?
        ) AS is_teaching,
        de.id AS directorate_evaluation_id, de.ratings,
        de.total_score AS supervisor_score
       FROM users u
       LEFT JOIN instructors i ON i.user_id = u.id
       LEFT JOIN directorate_evaluations de ON de.dean_id = u.id
         AND de.evaluator_id = ?
         AND de.cycle_id = ?
         AND LOWER(de.status) IN ('completed', 'published')
       WHERE LOWER(u.role) = 'college_dean'
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       FOR UPDATE`,
      [activeCycle.id, req.user.id, activeCycle.id],
    );
    const publishedResults = [];
    for (const evaluation of evaluations) {
      let ratings = evaluation.ratings;
      if (typeof ratings === "string") ratings = JSON.parse(ratings);
      const supervisorValues = Object.values(ratings || {})
        .filter((value) => value !== "NA")
        .map(Number)
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);

      const [[studentRow]] = evaluation.instructor_id
        ? await connection.query(
            `SELECT COALESCE(AVG(ses.score), 0) AS score,
              COUNT(DISTINCT ses.id) AS submission_count
           FROM student_evaluation_submissions ses
           INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
           WHERE EXISTS (
             SELECT 1 FROM course_assignments ca
               WHERE ca.instructor_id = ? AND ca.cycle_id = ?
               AND (ca.id = ed.assignment_id OR (ca.student_id = ed.student_id AND ca.course_id = ed.course_id))
           )
             AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
            [evaluation.instructor_id, activeCycle.id],
          )
        : [[{ score: 0, submission_count: 0 }]];
      const [[peerRow]] = evaluation.instructor_id
        ? await connection.query(
            `SELECT COALESCE(AVG(pes.score), 0) AS score,
              COUNT(DISTINCT pes.id) AS submission_count
           FROM peer_evaluation_submissions pes
           INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
           INNER JOIN instructors target ON target.id = pe.evaluatee_id
           INNER JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
           INNER JOIN users evaluator_user ON evaluator_user.id = evaluator.user_id
           WHERE pe.evaluatee_id = ?
             AND pe.cycle_id = ?
             AND evaluator.department_id = target.department_id
             AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_')) = 'instructor'
             AND pe.is_published = 1
             AND LOWER(COALESCE(pes.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
            [evaluation.instructor_id, activeCycle.id],
          )
        : [[{ score: 0, submission_count: 0 }]];

      const hasSupervisorEvaluation = Boolean(
        evaluation.directorate_evaluation_id,
      );
      const hasStudentEvaluation =
        Number(studentRow?.submission_count || 0) > 0;
      const hasPeerEvaluation = Number(peerRow?.submission_count || 0) > 0;

      const supervisorScore = supervisorValues.length
        ? (supervisorValues.reduce((sum, value) => sum + value, 0) /
            (supervisorValues.length * 5)) *
          100
        : Number(evaluation.supervisor_score || 0);
      const studentScore = Number(studentRow?.score || 0);
      const peerScore = Number(peerRow?.score || 0);
      const isTeaching = Boolean(evaluation.is_teaching);
      const breakdown = calculatePerformanceScore({
        isTeaching,
        studentScore,
        peerScore,
        supervisorScore,
      });
      const totalScore = breakdown.totalScore;
      await connection.query(
        `INSERT INTO directorate_evaluations
          (evaluator_id, dean_id, cycle_id, ratings, total_score, final_score,
           student_average, peer_average, is_teaching, status)
         VALUES (?, ?, ?, '{}', ?, ?, ?, ?, ?, 'PUBLISHED')
         ON DUPLICATE KEY UPDATE final_score = VALUES(final_score),
          student_average = VALUES(student_average),
          peer_average = VALUES(peer_average),
          is_teaching = VALUES(is_teaching),
          status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP`,
        [
          req.user.id,
          evaluation.dean_id,
          activeCycle.id,
          supervisorScore,
          totalScore,
          isTeaching ? studentScore : 0,
          peerScore,
          isTeaching,
        ],
      );
      publishedResults.push({
        deanId: evaluation.dean_id,
        studentScore,
        peerScore,
        supervisorScore: Number(supervisorScore.toFixed(2)),
        totalScore,
        hasStudentEvaluation,
        hasPeerEvaluation,
        hasSupervisorEvaluation,
        isTeaching,
      });
    }
    await connection.commit();
    return res.json({
      success: true,
      count: publishedResults.length,
      results: publishedResults,
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return sendServerError(res, error, "calculate and publish results error");
  } finally {
    connection?.release();
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    const [rows] = await pool.query(
      `SELECT c.id AS collegeId, c.name AS college_name,
        d.id AS departmentId,
        COALESCE(NULLIF(d.department_name, ''), d.name, 'All Departments') AS department_name,
        ROUND(COALESCE(AVG(de.total_score), 0), 2) AS performance,
        COUNT(DISTINCT d.id) AS departments
       FROM colleges c
       LEFT JOIN departments d ON d.college_id = c.id
       LEFT JOIN users u ON u.college_id = c.id AND LOWER(u.role) = 'college_dean'
       LEFT JOIN directorate_evaluations de ON de.dean_id = u.id AND de.cycle_id = ? AND LOWER(de.status) = 'completed'
      GROUP BY c.id, c.name, d.id, d.department_name, d.name ORDER BY college_name ASC, department_name ASC`,
      [activeCycle?.id || 0],
    );
    return res.json(
      rows.map((row) => ({
        ...row,
        performance: Number(row.performance || 0),
        departments: Number(row.departments || 0),
      })),
    );
  } catch (error) {
    return sendServerError(res, error, "analytics query error");
  }
});

router.post("/evaluate-dean", async (req, res) => {
  const deanId = Number(req.body?.deanId || 0);
  const ratings = req.body?.ratings || {};
  const strengths = String(req.body?.strengths || "").trim();
  const weaknesses = String(req.body?.weaknesses || "").trim();
  const criteriaIds = [
    "self_development", "subject_matter", "teaching_methodology", "assignments", "mentorship",
    "curriculum", "community_service", "research", "academic_advising", "professional_growth",
    "problem_solving", "cpd_hdp", "continuous_assessment", "tutorials", "class_execution",
    "consultation", "deadlines_grading", "resource_use", "committee_teamwork", "professional_ethics",
  ];
  const hasAllCriteria = criteriaIds.every((criterionId) => Object.hasOwn(ratings, criterionId));
  const hasInvalidRating = criteriaIds.some((criterionId) => {
    const value = ratings[criterionId];
    return value !== "NA" && (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 5);
  });
  if (!deanId || !ratings || typeof ratings !== "object" || !hasAllCriteria || hasInvalidRating) {
    return res.status(400).json({
      message: "Dean and valid ratings for all 20 criteria are required.",
    });
  }

  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
    const [[dean]] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND LOWER(role) = 'college_dean' LIMIT 1",
      [deanId],
    );
    if (!dean)
      return res.status(404).json({ message: "College Dean not found." });
    const values = criteriaIds.map((criterionId) => ratings[criterionId]).filter((value) => value !== "NA").map(Number);
    const totalScore = values.length
      ? (values.reduce((sum, value) => sum + value, 0) / (values.length * 5)) * 100
      : 0;
    await pool.query(
      `INSERT INTO directorate_evaluations (evaluator_id, dean_id, cycle_id, ratings, strengths, weaknesses, total_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
       ON DUPLICATE KEY UPDATE ratings = VALUES(ratings), strengths = VALUES(strengths), weaknesses = VALUES(weaknesses), total_score = VALUES(total_score), final_score = NULL, status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        deanId,
        activeCycle.id,
        JSON.stringify(ratings),
        strengths,
        weaknesses,
        totalScore,
      ],
    );
    return res.json({
      success: true,
      totalScore: Number(totalScore.toFixed(2)),
      status: "COMPLETED",
    });
  } catch (error) {
    return sendServerError(res, error, "Dean evaluation submission error");
  }
});

module.exports = router;
