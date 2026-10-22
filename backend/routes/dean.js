const express = require("express");
const pool = require("../config/db");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { getActiveEvaluationCycle } = require("../config/evaluationCycles");
const {
  ensureDepartmentEvaluationWindowSchema,
  getDepartmentEvaluationDeadline,
} = require("../config/departmentEvaluationWindows");
const {
  validateEvaluationFeedback,
} = require("../utils/evaluationFeedbackValidation");
const { calculatePerformanceScore } = require("../utils/performanceScore");

const router = express.Router();
const getCollegeId = async (req) => {
  const tokenCollegeId = Number(req.user?.college_id || 0);
  if (tokenCollegeId > 0) return tokenCollegeId;

  const userId = Number(req.user?.id || req.user?.user_id || 0);
  if (!userId) return 0;

  const [[fallbackRow]] = await pool.query(
    `SELECT COALESCE(u.college_id, user_department.college_id, instructor_department.college_id) AS college_id
     FROM users u
     LEFT JOIN departments user_department ON user_department.id = u.department_id
     LEFT JOIN instructors i ON i.user_id = u.id
     LEFT JOIN departments instructor_department ON instructor_department.id = i.department_id
     WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  return Number(fallbackRow?.college_id || 0);
};
const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

router.use(authenticateToken, authorizeRoles("college_dean", "dean"));

router.get("/my-performance", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    const [[instructor]] = await pool.query(
      "SELECT id FROM instructors WHERE user_id = ? LIMIT 1",
      [req.user.id],
    );
    const instructorId = instructor?.id || null;
    const [[assignmentCount]] = instructorId
      ? await pool.query(
          "SELECT COUNT(*) AS total FROM course_assignments WHERE instructor_id = ? AND cycle_id = ?",
          [instructorId, activeCycle?.id || 0],
        )
      : [[{ total: 0 }]];
    const hasTeachingAssignments = Number(assignmentCount?.total || 0) > 0;

    const [[studentRow]] = instructorId
      ? await pool.query(
          `SELECT COALESCE(AVG(ses.score), 0) AS score
         FROM student_evaluation_submissions ses
         INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
         INNER JOIN course_assignments ca ON ca.course_id = ed.course_id AND ca.instructor_id = ?
           AND ca.cycle_id = ed.cycle_id
         WHERE LOWER(ses.status) = 'submitted' AND ed.cycle_id = ?`,
          [instructorId, activeCycle?.id || 0],
        )
      : [[{ score: 0 }]];
    const [[peerRow]] = instructorId
      ? await pool.query(
          `SELECT COALESCE(AVG(pes.score), 0) AS score
         FROM peer_evaluation_submissions pes
         INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
         INNER JOIN instructors target ON target.id = pe.evaluatee_id
         INNER JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
         INNER JOIN users evaluator_user ON evaluator_user.id = evaluator.user_id
         WHERE pe.evaluatee_id = ? AND pe.cycle_id = ?
           AND evaluator.department_id = target.department_id
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_')) = 'instructor'
           AND pe.is_published = 1
           AND LOWER(pes.status) IN ('submitted', 'completed', 'approved')`,
          [instructorId, activeCycle?.id || 0],
        )
      : [[{ score: 0 }]];
    const [[directorateRow]] = await pool.query(
      `SELECT total_score AS score, strengths, weaknesses
       FROM directorate_evaluations
       WHERE dean_id = ? AND cycle_id = ? AND LOWER(status) = 'completed'
       ORDER BY updated_at DESC LIMIT 1`,
      [req.user.id, activeCycle?.id || 0],
    );
    const [departmentHeadRows] = instructorId
      ? await pool.query(
          `SELECT dhe.total_score AS score, dhe.strengths, dhe.weaknesses,
          dhe.general_comments, dhe.criteria_scores, dhe.updated_at
         FROM dept_head_evaluations dhe
         INNER JOIN users evaluator ON evaluator.id = dhe.evaluator_id
           AND LOWER(TRIM(evaluator.role)) IN ('dept_head', 'department_head', 'department head')
         WHERE dhe.instructor_id = ?
           AND dhe.cycle_id = ?
           AND LOWER(TRIM(dhe.status)) IN ('submitted', 'completed', 'approved')
         ORDER BY dhe.updated_at DESC`,
          [instructorId, activeCycle?.id || 0],
        )
      : [[]];

    const studentScore = Number(studentRow?.score || 0);
    const peerScore = Number(peerRow?.score || 0);
    const directorateScore = Number(directorateRow?.score || 0);
    const departmentHeadScore = departmentHeadRows.length
      ? departmentHeadRows.reduce(
          (sum, row) => sum + Number(row.score || 0),
          0,
        ) / departmentHeadRows.length
      : 0;
    const totalWeightedScore = hasTeachingAssignments
      ? studentScore * 0.5 + peerScore * 0.2 + directorateScore * 0.3
      : peerScore * 0.4 + directorateScore * 0.6;
    const strengths = directorateRow?.strengths
      ? [directorateRow.strengths]
      : [];
    const improvements = directorateRow?.weaknesses
      ? [directorateRow.weaknesses]
      : [];
    const feedbackBySource = {
      student: { strengths: [], weaknesses: [] },
      peer: { strengths: [], weaknesses: [] },
      deptHead: { strengths: [], weaknesses: [] },
      collegeDean: { strengths: [], weaknesses: [] },
      academicDirector: { strengths, weaknesses: improvements },
    };
    const addFeedback = (list, value) => {
      const text = String(value || "").trim();
      if (text && !list.includes(text)) list.push(text);
    };
    departmentHeadRows.forEach((row) => {
      const strength = row.strengths;
      const weakness = row.weaknesses;
      const generalComment = row.general_comments;
      addFeedback(strengths, strength);
      addFeedback(improvements, weakness);
      addFeedback(feedbackBySource.deptHead.strengths, strength);
      addFeedback(feedbackBySource.deptHead.weaknesses, weakness);
      addFeedback(feedbackBySource.deptHead.strengths, generalComment);
    });

    return res.json({
      totalWeightedScore: Number(totalWeightedScore.toFixed(2)),
      status:
        totalWeightedScore >= 85
          ? "Excellent"
          : totalWeightedScore >= 70
            ? "Good"
            : totalWeightedScore >= 50
              ? "Needs Improvement"
              : "At Risk",
      sourceScores: {
        student: studentScore,
        peer: peerScore,
        deptHead: Number(departmentHeadScore.toFixed(2)),
        collegeDean: 0,
        academicDirector: directorateScore,
      },
      feedbackBySource,
      feedback: { strengths, improvements },
    });
  } catch (error) {
    console.error("Dean performance error:", error);
    return res
      .status(500)
      .json({
        message: "Unable to load Dean performance.",
        error: error.message,
      });
  }
});

router.get("/overview-stats", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    const collegeId = await getCollegeId(req);
    if (!collegeId)
      return sendError(
        res,
        400,
        "Your college is not configured. Contact an administrator.",
      );
    const [departmentRows] = await pool.query(
      "SELECT COUNT(*) AS departmentsCount FROM departments WHERE college_id = ?",
      [collegeId],
    );
    const [evaluationRows] = await pool.query(
      `SELECT
        SUM(CASE WHEN dhe.id IS NULL OR LOWER(COALESCE(dhe.status, 'pending')) NOT IN ('submitted', 'completed', 'approved') THEN 1 ELSE 0 END) AS pendingDeptHeadEvals,
        SUM(CASE WHEN dhe.id IS NOT NULL AND LOWER(COALESCE(dhe.status, 'pending')) IN ('submitted', 'completed', 'approved') THEN 1 ELSE 0 END) AS completedEvals
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.role) = 'dept_head'
       INNER JOIN departments d ON d.id = i.department_id AND d.college_id = ?
       LEFT JOIN dept_head_evaluations dhe ON dhe.id = (
         SELECT MAX(latest.id)
         FROM dept_head_evaluations latest
         WHERE latest.instructor_id = i.id
           AND latest.evaluator_id = ?
           AND latest.cycle_id = ?
       )`,
      [collegeId, req.user.id, activeCycle?.id || 0],
    );

    return res.json({
      departmentsCount: Number(departmentRows[0]?.departmentsCount || 0),
      pendingDeptHeadEvals: Number(
        evaluationRows[0]?.pendingDeptHeadEvals || 0,
      ),
      completedEvals: Number(evaluationRows[0]?.completedEvals || 0),
    });
  } catch (error) {
    console.error("Dean overview stats error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
});

router.get("/department-analytics", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    const collegeId = await getCollegeId(req);
    if (!collegeId)
      return sendError(res, 400, "Your college is not configured.");
    const [rows] = await pool.query(
      `SELECT d.id AS departmentId,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        ROUND(COALESCE(AVG(er.total_score), 0), 2) AS performance
       FROM departments d
       LEFT JOIN evaluation_results er ON er.department_id = d.id
       WHERE d.college_id = ? AND er.cycle_id = ?
       GROUP BY d.id, d.department_name, d.name
       ORDER BY department ASC`,
      [collegeId, activeCycle?.id || 0],
    );
    return res.json(
      rows.map((row) => ({
        ...row,
        performance: Number(row.performance || 0),
      })),
    );
  } catch (error) {
    console.error("Dean department analytics error:", error);
    return sendError(res, 500, "Unable to load college analytics.");
  }
});

router.get("/dept-heads", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) return sendError(res, 409, "There is no active evaluation cycle.");
    await ensureDepartmentEvaluationWindowSchema();
    const collegeId = await getCollegeId(req);
    if (!collegeId) {
      return res.status(200).json([]);
    }

    const [rows] = await pool.query(
      `SELECT u.id AS dept_head_id,
        i.id AS instructorId,
        COALESCE(NULLIF(CONCAT_WS(' ', i.first_name, i.last_name), ''), u.username) AS full_name,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS name,
        u.username,
        d.id AS departmentId,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department_name,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        c.name AS college_name,
        active_cycle.academic_year,
        active_cycle.semester,
        d.id AS departmentId,
        COALESCE(
          NULLIF(TRIM(evaluation_schedule.end_at), ''),
          DATE_FORMAT(evaluation_schedule.expiry_date, '%Y-%m-%dT%H:%i:%s.000Z'),
          active_cycle.end_at
        ) AS deadline,
        COALESCE(
          NULLIF(TRIM(evaluation_schedule.end_at), ''),
          DATE_FORMAT(evaluation_schedule.expiry_date, '%Y-%m-%dT%H:%i:%s.000Z'),
          active_cycle.end_at
        ) AS expiryDate,
        COALESCE(dhe.total_score, 0) AS score,
        COALESCE(dhe.status, 'Pending') AS status,
        dhe.strengths,
        dhe.weaknesses,
        dhe.general_comments,
        dhe.criteria_scores
       FROM users u
       INNER JOIN instructors i ON i.user_id = u.id
       INNER JOIN departments d ON d.id = i.department_id
       INNER JOIN colleges c ON c.id = d.college_id
         AND c.id = ?
       LEFT JOIN evaluation_cycles active_cycle ON active_cycle.id = ?
       LEFT JOIN department_evaluation_windows evaluation_schedule
         ON evaluation_schedule.department_id = d.id
        AND evaluation_schedule.is_active = TRUE
       LEFT JOIN dept_head_evaluations dhe ON dhe.instructor_id = i.id AND dhe.evaluator_id = ? AND dhe.cycle_id = ?
       WHERE LOWER(u.role) = 'dept_head'
       ORDER BY department_name ASC, full_name ASC`,
      [collegeId, activeCycle.id, req.user.id, activeCycle.id],
    );
    const deadlinesByDepartment = new Map();
    for (const departmentId of new Set(rows.map((row) => row.departmentId))) {
      deadlinesByDepartment.set(
        departmentId,
        await getDepartmentEvaluationDeadline(departmentId, activeCycle.end_at),
      );
    }
    return res.json(
      rows.map((row) => ({
        ...row,
        deadline: deadlinesByDepartment.get(row.departmentId) || null,
        expiryDate: deadlinesByDepartment.get(row.departmentId) || null,
        academic_year: row.academic_year || "",
        semester: row.semester || "",
        score: Number(row.score || 0),
        name: row.full_name || row.name || row.email,
        department: row.department_name || row.department,
        general_comments: row.general_comments || row.strengths || "",
      })),
    );
  } catch (error) {
    console.error("Dean department heads error:", error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
});

const submitDepartmentHeadEvaluation = async (req, res) => {
  const feedbackValidation = validateEvaluationFeedback({
    Strengths: req.body?.strengths,
    "Areas for Improvement": req.body?.weaknesses,
    "General Comments": req.body?.generalComments,
  });
  if (!feedbackValidation.valid) {
    return res.status(400).json({
      success: false,
      message: {
        en: feedbackValidation.message,
        am: feedbackValidation.messageAm,
      },
    });
  }
  const instructorId = Number(req.body?.instructorId || 0);
  const criteriaScores = req.body?.criteriaScores || {};
  const totalScore = Number(req.body?.totalScore || 0);
  const generalComments = String(
    req.body?.generalComments || req.body?.strengths || "",
  ).trim();
  const weaknesses = String(req.body?.weaknesses || "").trim();

  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) return sendError(res, 409, "There is no active evaluation cycle.");
    const collegeId = await getCollegeId(req);
    if (!collegeId || !instructorId || !Number.isFinite(totalScore))
      return sendError(
        res,
        400,
        "Instructor and evaluation scores are required.",
      );

    const [targetRows] = await pool.query(
      `SELECT i.id, i.department_id FROM instructors i
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.role) = 'dept_head'
       INNER JOIN departments d ON d.id = i.department_id
      WHERE (i.id = ? OR u.id = ?) AND d.college_id = ? LIMIT 1`,
      [instructorId, instructorId, collegeId],
    );
    if (!targetRows.length)
      return sendError(
        res,
        404,
        "Department Head was not found in your college.",
      );

    await pool.query(
      `INSERT INTO dept_head_evaluations (evaluator_id, instructor_id, department_id, cycle_id, criteria_scores, strengths, weaknesses, general_comments, total_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
       ON DUPLICATE KEY UPDATE criteria_scores = VALUES(criteria_scores), strengths = VALUES(strengths), weaknesses = VALUES(weaknesses), general_comments = VALUES(general_comments), total_score = VALUES(total_score), status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        instructorId,
        targetRows[0].department_id,
        activeCycle.id,
        JSON.stringify(criteriaScores),
        generalComments,
        weaknesses,
        generalComments,
        totalScore,
      ],
    );
    return res.json({
      success: true,
      message: "Department Head evaluation submitted.",
    });
  } catch (error) {
    console.error("Dean department head evaluation error:", error);
    return sendError(res, 500, "Unable to submit Department Head evaluation.");
  }
};

router.post("/evaluate-dept-head", submitDepartmentHeadEvaluation);
router.post("/submit-evaluation", submitDepartmentHeadEvaluation);
router.post("/dept-head-evaluations", submitDepartmentHeadEvaluation);

router.post("/calculate-dept-head-results", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) return sendError(res, 409, "There is no active evaluation cycle.");
    const collegeId = await getCollegeId(req);
    if (!collegeId)
      return sendError(res, 403, "Your college is not configured.");

    const [departmentHeads] = await pool.query(
      `SELECT i.id AS instructor_id, i.department_id,
         EXISTS (
           SELECT 1 FROM course_assignments teaching_ca
           WHERE teaching_ca.instructor_id = i.id
             AND teaching_ca.cycle_id = ?
         ) AS is_teaching
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       INNER JOIN departments d ON d.id = i.department_id
       WHERE d.college_id = ?
         AND LOWER(TRIM(u.role)) = 'dept_head'
         AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
      [activeCycle.id, collegeId],
    );
    const results = [];
    for (const departmentHead of departmentHeads) {
      const [[studentRow]] = await pool.query(
        `SELECT COALESCE(AVG(ses.score), 0) AS score, COUNT(ses.id) AS submission_count
         FROM student_evaluation_submissions ses
         INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
         LEFT JOIN course_assignments ca ON ca.id = ed.assignment_id
         WHERE ca.instructor_id = ? AND ed.cycle_id = ?
           AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
        [departmentHead.instructor_id, activeCycle.id],
      );
      const [[peerRow]] = await pool.query(
        `SELECT COALESCE(AVG(pes.score), 0) AS score
         FROM peer_evaluation_submissions pes
         INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
         INNER JOIN instructors target ON target.id = pe.evaluatee_id
         INNER JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
         WHERE pe.evaluatee_id = ? AND pe.cycle_id = ?
           AND evaluator.department_id = target.department_id
           AND pe.is_published = 1
           AND LOWER(COALESCE(pes.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
        [departmentHead.instructor_id, activeCycle.id],
      );
      const [[deanRow]] = await pool.query(
        `SELECT COALESCE(AVG(dhe.total_score), 0) AS score
         FROM dept_head_evaluations dhe
         INNER JOIN users evaluator ON evaluator.id = dhe.evaluator_id
         WHERE dhe.instructor_id = ?
           AND dhe.cycle_id = ?
           AND LOWER(TRIM(evaluator.role)) IN ('college_dean', 'dean', 'college dean')
           AND LOWER(COALESCE(dhe.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
        [departmentHead.instructor_id, activeCycle.id],
      );
      const isTeaching = Boolean(departmentHead.is_teaching);
      const studentAverage = Number(studentRow?.score || 0);
      const hasStudentEvaluation =
        Number(studentRow?.submission_count || 0) > 0;
      const peerAverage = Number(peerRow?.score || 0);
      const deanScore = Number(deanRow?.score || 0);
      const breakdown = calculatePerformanceScore({
        isTeaching,
        studentScore: studentAverage,
        peerScore: peerAverage,
        supervisorScore: deanScore,
      });
      const totalScore = breakdown.totalScore;
      await pool.query(
        `INSERT INTO evaluation_results (instructor_id, department_id, cycle_id, student_average, peer_average, dept_head_score, total_score, has_student_evaluation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE department_id = VALUES(department_id), student_average = VALUES(student_average), peer_average = VALUES(peer_average), dept_head_score = VALUES(dept_head_score), total_score = VALUES(total_score), has_student_evaluation = VALUES(has_student_evaluation), published_at = CURRENT_TIMESTAMP`,
        [
          departmentHead.instructor_id,
          departmentHead.department_id,
          activeCycle.id,
          hasStudentEvaluation ? studentAverage : 0,
          peerAverage,
          deanScore,
          totalScore,
          hasStudentEvaluation,
        ],
      );
      results.push({
        instructor_id: departmentHead.instructor_id,
        student_average: hasStudentEvaluation ? studentAverage : 0,
        peer_average: peerAverage,
        college_dean_score: deanScore,
        total_score: totalScore,
        has_student_evaluation: hasStudentEvaluation,
        is_teaching: isTeaching,
      });
    }
    return res.json({ success: true, results, count: results.length });
  } catch (error) {
    console.error(
      "College Dean Department Head result calculation failed:",
      error,
    );
    return sendError(res, 500, "Unable to calculate Department Head results.");
  }
});

router.get("/faculty-performance", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle)
      return sendError(res, 409, "There is no active evaluation cycle.");
    const collegeId = await getCollegeId(req);
    if (!collegeId)
      return sendError(res, 400, "Your college is not configured.");
    const [rows] = await pool.query(
      `SELECT i.id AS instructorId,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS name,
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        COALESCE(er.total_score, 0) AS score,
        CASE WHEN er.id IS NULL THEN 'Pending' WHEN er.total_score >= 70 THEN 'Good' ELSE 'Needs Improvement' END AS status
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.role) = 'instructor'
       INNER JOIN departments d ON d.id = i.department_id AND d.college_id = ?
       LEFT JOIN evaluation_results er ON er.instructor_id = i.id AND er.cycle_id = ?
       ORDER BY department ASC, name ASC`,
      [collegeId, activeCycle.id],
    );
    return res.json(
      rows.map((row) => ({ ...row, score: Number(row.score || 0) })),
    );
  } catch (error) {
    console.error("Dean faculty performance error:", error);
    return sendError(res, 500, "Unable to load faculty performance.");
  }
});

module.exports = router;
