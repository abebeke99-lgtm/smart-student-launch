const express = require("express");
const pool = require("../config/db");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { getActiveEvaluationCycle } = require("../config/evaluationCycles");
const { calculatePerformanceScore } = require("../utils/performanceScore");

const router = express.Router();
const criterionIds = [
  "self_development",
  "subject_matter",
  "teaching_methodology",
  "assignments",
  "mentorship",
  "curriculum",
  "community_service",
  "research",
  "academic_advising",
  "professional_growth",
  "problem_solving",
  "cpd_hdp",
  "continuous_assessment",
  "tutorials",
  "class_execution",
  "consultation",
  "deadlines_grading",
  "resource_use",
  "committee_teamwork",
  "professional_ethics",
];

router.use(authenticateToken, authorizeRoles("vice_president"));

router.get("/academic-directorate", async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();

    const [staff] = await pool.query(
      `SELECT u.id AS academicDirectorateId,
        COALESCE(NULLIF(CONCAT_WS(' ', i.first_name, i.last_name), ''), u.username) AS full_name,
        u.username,
        COALESCE(NULLIF(d.department_name, ''), d.name, 'University-wide') AS department_name,
        ec.academic_year,
        ec.semester,
        ec.end_at AS deadline,
        vpe.ratings,
        vpe.strengths,
        vpe.weaknesses,
        vpe.total_score AS supervisor_score,
        vpe.student_average,
        vpe.peer_average,
        COALESCE(vpe.is_teaching, EXISTS (
          SELECT 1 FROM course_assignments teaching_ca
          WHERE teaching_ca.instructor_id = i.id
            AND teaching_ca.cycle_id = ?
        )) AS is_teaching,
        COALESCE(vpe.final_score, vpe.total_score) AS score,
        COALESCE(vpe.status, 'PENDING') AS evaluation_status
       FROM users u
       INNER JOIN instructors i ON i.user_id = u.id
       LEFT JOIN departments d ON d.id = i.department_id
       LEFT JOIN evaluation_cycles ec ON ec.id = ?
       LEFT JOIN vice_president_evaluations vpe
         ON vpe.academic_directorate_user_id = u.id
        AND vpe.evaluator_id = ?
        AND vpe.cycle_id = ?
       WHERE LOWER(u.role) = 'academic_directorate'
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       ORDER BY full_name ASC`,
      [
        activeCycle?.id || null,
        activeCycle?.id || 0,
        req.user.id,
        activeCycle?.id || null,
      ],
    );

    return res.json({
      cycle: activeCycle ? {
        id: Number(activeCycle.id),
        academicYear: activeCycle.academic_year,
        semester: activeCycle.semester,
        deadline: activeCycle.end_at,
      } : null,
      staff: staff.map((row) => ({
        ...row,
        academicDirectorateId: Number(row.academicDirectorateId),
        score: row.score == null ? null : Number(row.score),
        supervisor_score:
          row.supervisor_score == null ? null : Number(row.supervisor_score),
        student_average: Number(row.student_average || 0),
        peer_average: Number(row.peer_average || 0),
        is_teaching: Boolean(row.is_teaching),
      })),
    });
  } catch (error) {
    console.error("Unable to load Academic Directorate evaluations:", error);
    return res.status(500).json({ message: "Unable to load Academic Directorate evaluations." });
  }
});

router.post("/calculate-publish-results", async (req, res) => {
  let connection;
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ message: "There is no active evaluation cycle." });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [evaluations] = await connection.query(
      `SELECT vpe.id, vpe.academic_directorate_user_id, vpe.ratings,
         i.id AS instructor_id, i.department_id,
         EXISTS (
           SELECT 1 FROM course_assignments teaching_ca
           WHERE teaching_ca.instructor_id = i.id
             AND teaching_ca.cycle_id = vpe.cycle_id
         ) AS is_teaching
       FROM vice_president_evaluations vpe
       INNER JOIN instructors i ON i.user_id = vpe.academic_directorate_user_id
       WHERE vpe.evaluator_id = ? AND vpe.cycle_id = ?
         AND LOWER(vpe.status) IN ('completed', 'published')
       FOR UPDATE`,
      [req.user.id, activeCycle.id],
    );

    const publishedResults = [];
    for (const evaluation of evaluations) {
      let ratings = evaluation.ratings;
      if (typeof ratings === "string") ratings = JSON.parse(ratings);
      if (
        !ratings ||
        typeof ratings !== "object" ||
        Array.isArray(ratings) ||
        !criterionIds.every((criterionId) => Object.hasOwn(ratings, criterionId))
      ) {
        throw new Error(`Evaluation ${evaluation.id} has invalid criterion ratings.`);
      }

      const ratedValues = criterionIds
        .map((criterionId) => ratings[criterionId])
        .filter((value) => value !== "NA")
        .map(Number)
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
      const score = ratedValues.length
        ? Number(((ratedValues.reduce((sum, value) => sum + value, 0) / (ratedValues.length * 5)) * 100).toFixed(2))
        : 0;

      const [[studentRow]] = await connection.query(
        `SELECT COALESCE(AVG(ses.score), 0) AS score, COUNT(ses.id) AS submission_count
         FROM student_evaluation_submissions ses
         INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
         LEFT JOIN course_assignments ca ON ca.id = ed.assignment_id AND ca.cycle_id = ed.cycle_id
         WHERE ca.instructor_id = ? AND ed.cycle_id = ?
           AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
        [evaluation.instructor_id, activeCycle.id],
      );
      const [[peerRow]] = await connection.query(
        `SELECT COALESCE(AVG(pes.score), 0) AS score
         FROM peer_evaluation_submissions pes
         INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
         INNER JOIN instructors target ON target.id = pe.evaluatee_id
         INNER JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
         INNER JOIN users evaluator_user ON evaluator_user.id = evaluator.user_id
         WHERE pes.evaluatee_id = ? AND pe.cycle_id = ?
           AND evaluator.department_id = target.department_id
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_')) = 'instructor'
           AND pe.is_published = 1
           AND LOWER(COALESCE(pes.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
        [evaluation.instructor_id, activeCycle.id],
      );
      const isTeaching = Boolean(evaluation.is_teaching);
      const studentAverage = Number(studentRow?.score || 0);
      const peerAverage = Number(peerRow?.score || 0);
      const hasStudentEvaluation = Number(studentRow?.submission_count || 0) > 0;
      const breakdown = calculatePerformanceScore({
        isTeaching,
        studentScore: studentAverage,
        peerScore: peerAverage,
        supervisorScore: score,
      });

      await connection.query(
        `UPDATE vice_president_evaluations
         SET total_score = ?, student_average = ?, peer_average = ?,
           is_teaching = ?, final_score = ?, status = 'PUBLISHED',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          score,
          isTeaching ? studentAverage : 0,
          peerAverage,
          isTeaching,
          breakdown.totalScore,
          evaluation.id,
        ],
      );
      await connection.query(
        `INSERT INTO evaluation_results
          (instructor_id, department_id, cycle_id, student_average, peer_average,
           dept_head_score, vice_president_score, total_score, has_student_evaluation)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
         ON DUPLICATE KEY UPDATE department_id = VALUES(department_id),
          student_average = VALUES(student_average),
          peer_average = VALUES(peer_average),
          vice_president_score = VALUES(vice_president_score),
          total_score = VALUES(total_score),
          has_student_evaluation = VALUES(has_student_evaluation),
          published_at = CURRENT_TIMESTAMP`,
        [
          evaluation.instructor_id,
          evaluation.department_id,
          activeCycle.id,
          isTeaching ? studentAverage : 0,
          peerAverage,
          score,
          breakdown.totalScore,
          hasStudentEvaluation,
        ],
      );
      publishedResults.push({
        academicDirectorateId: Number(evaluation.academic_directorate_user_id),
        studentScore: isTeaching ? studentAverage : null,
        peerScore: peerAverage,
        supervisorScore: score,
        totalScore: breakdown.totalScore,
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
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Vice President result publication rollback failed:", rollbackError);
      });
    }
    console.error("Unable to calculate and publish Vice President results:", error);
    return res.status(500).json({ message: "Unable to calculate and publish Vice President results." });
  } finally {
    connection?.release();
  }
});

router.post("/evaluate-academic-directorate", async (req, res) => {
  const academicDirectorateId = Number(req.body?.academicDirectorateId || 0);
  const ratings = req.body?.ratings;
  const strengths = String(req.body?.strengths || "").trim();
  const weaknesses = String(req.body?.weaknesses || "").trim();

  if (
    !Number.isInteger(academicDirectorateId) ||
    academicDirectorateId <= 0 ||
    !ratings ||
    typeof ratings !== "object" ||
    Array.isArray(ratings) ||
    !criterionIds.every((criterionId) => Object.hasOwn(ratings, criterionId)) ||
    criterionIds.some((criterionId) => {
      const rating = ratings[criterionId];
      return rating !== "NA" &&
        (!Number.isFinite(Number(rating)) || Number(rating) < 1 || Number(rating) > 5);
    })
  ) {
    return res.status(400).json({
      message: "Academic Directorate staff and valid ratings for all criteria are required.",
    });
  }

  const ratedValues = criterionIds
    .map((criterionId) => ratings[criterionId])
    .filter((value) => value !== "NA")
    .map(Number);
  const vicePresidentScore = ratedValues.length
    ? (ratedValues.reduce((sum, value) => sum + value, 0) / (ratedValues.length * 5)) * 100
    : 0;

  let connection;
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ message: "There is no active evaluation cycle." });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[target]] = await connection.query(
      `SELECT i.id AS instructor_id, i.department_id
       FROM users u
       INNER JOIN instructors i ON i.user_id = u.id
       WHERE u.id = ? AND LOWER(u.role) = 'academic_directorate'
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       LIMIT 1 FOR UPDATE`,
      [academicDirectorateId],
    );
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ message: "Academic Directorate staff member not found." });
    }

    const [[studentRow]] = await connection.query(
      `SELECT COALESCE(AVG(ses.score), 0) AS score, COUNT(ses.id) AS submission_count
       FROM student_evaluation_submissions ses
       INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
       LEFT JOIN course_assignments ca ON ca.id = ed.assignment_id AND ca.cycle_id = ed.cycle_id
       WHERE ca.instructor_id = ? AND ed.cycle_id = ?
         AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
      [target.instructor_id, activeCycle.id],
    );
    const [[peerRow]] = await connection.query(
      `SELECT COALESCE(AVG(pes.score), 0) AS score
       FROM peer_evaluation_submissions pes
       INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
       INNER JOIN instructors target ON target.id = pe.evaluatee_id
       INNER JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
       INNER JOIN users evaluator_user ON evaluator_user.id = evaluator.user_id
       WHERE pes.evaluatee_id = ? AND pe.cycle_id = ?
         AND evaluator.department_id = target.department_id
         AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_')) = 'instructor'
         AND pe.is_published = 1
         AND LOWER(COALESCE(pes.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
      [target.instructor_id, activeCycle.id],
    );
    const [[teachingRow]] = await connection.query(
      `SELECT EXISTS (
         SELECT 1 FROM course_assignments
         WHERE instructor_id = ? AND cycle_id = ?
       ) AS is_teaching`,
      [target.instructor_id, activeCycle.id],
    );
    const hasStudentEvaluation = Number(studentRow?.submission_count || 0) > 0;
    const isTeaching = Boolean(teachingRow?.is_teaching);
    const studentAverage = Number(studentRow?.score || 0);
    const peerAverage = Number(peerRow?.score || 0);
    const breakdown = calculatePerformanceScore({
      isTeaching,
      studentScore: studentAverage,
      peerScore: peerAverage,
      supervisorScore: vicePresidentScore,
    });
    const totalScore = breakdown.totalScore;

    await connection.query(
      `INSERT INTO evaluation_results
        (instructor_id, department_id, cycle_id, student_average, peer_average,
         dept_head_score, vice_president_score, total_score, has_student_evaluation)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE department_id = VALUES(department_id),
        student_average = VALUES(student_average), peer_average = VALUES(peer_average),
        vice_president_score = VALUES(vice_president_score), total_score = VALUES(total_score),
        has_student_evaluation = VALUES(has_student_evaluation),
        published_at = CURRENT_TIMESTAMP`,
      [
        target.instructor_id,
        target.department_id,
        activeCycle.id,
        hasStudentEvaluation ? studentAverage : 0,
        peerAverage,
        vicePresidentScore,
        totalScore,
        hasStudentEvaluation,
      ],
    );
    await connection.query(
      `INSERT INTO vice_president_evaluations
        (evaluator_id, academic_directorate_user_id, cycle_id, ratings, strengths,
         weaknesses, total_score, student_average, peer_average, is_teaching,
         final_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
       ON DUPLICATE KEY UPDATE ratings = VALUES(ratings),
        strengths = VALUES(strengths), weaknesses = VALUES(weaknesses),
        total_score = VALUES(total_score),
        student_average = VALUES(student_average),
        peer_average = VALUES(peer_average), is_teaching = VALUES(is_teaching),
        final_score = VALUES(final_score), status = 'COMPLETED',
        updated_at = CURRENT_TIMESTAMP`,
      [
        req.user.id,
        academicDirectorateId,
        activeCycle.id,
        JSON.stringify(ratings),
        strengths,
        weaknesses,
        vicePresidentScore,
        isTeaching ? studentAverage : 0,
        peerAverage,
        isTeaching,
        totalScore,
      ],
    );

    await connection.commit();
    return res.json({
      success: true,
      vicePresidentScore: Number(vicePresidentScore.toFixed(2)),
      studentAverage: isTeaching ? studentAverage : null,
      peerAverage,
      totalScore,
      isTeaching,
      status: "COMPLETED",
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Vice President evaluation rollback failed:", rollbackError);
      });
    }
    console.error("Unable to submit Academic Directorate evaluation:", error);
    return res.status(500).json({ message: "Unable to submit Academic Directorate evaluation." });
  } finally {
    connection?.release();
  }
});

module.exports = router;
