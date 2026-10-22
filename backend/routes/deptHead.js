const express = require('express');
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { getActiveEvaluationCycle } = require('../config/evaluationCycles');
const {
  getDepartmentEvaluationWindow,
  setDepartmentEvaluationWindow,
  deleteDepartmentEvaluationWindow,
} = require('../config/departmentEvaluationWindows');
const {
  isAllowedDepartmentHeadTargetRole,
} = require('../utils/departmentHeadEvaluation');
const { validateEvaluationFeedback } = require('../utils/evaluationFeedbackValidation');

const router = express.Router();

const getOwnDepartmentId = (req) => {
  const departmentId = Number(req.user?.department_id);
  return Number.isInteger(departmentId) && departmentId > 0
    ? departmentId
    : null;
};

router.get('/evaluation-schedule', authenticateToken, authorizeRoles('dept_head'), async (req, res) => {
  const departmentId = getOwnDepartmentId(req);
  if (!departmentId) {
    return res.status(403).json({
      success: false,
      message: 'Your department is not defined. Contact an administrator.',
    });
  }

  try {
    const [departmentRows] = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(department_name), ''), NULLIF(TRIM(name), '')) AS department_name
       FROM departments
       WHERE id = ?
       LIMIT 1`,
      [departmentId],
    );
    const window = await getDepartmentEvaluationWindow(departmentId);
    return res.json({
      success: true,
      data: {
        ...window,
        deadline: window?.expiryDate || window?.endAt || null,
        departmentName: departmentRows[0]?.department_name || '',
        configured: Boolean(window?.startAt && window?.endAt && window?.isActive),
      },
    });
  } catch (error) {
    console.error('Unable to retrieve department evaluation schedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve the department evaluation schedule.',
    });
  }
});

const saveEvaluationSchedule = async (req, res) => {
  const departmentId = getOwnDepartmentId(req);
  if (!departmentId) {
    return res.status(403).json({
      success: false,
      message: 'Your department is not defined. Contact an administrator.',
    });
  }

  const startAt = String(req.body?.startAt || '').trim();
  const endAt = String(req.body?.endAt || '').trim();
  const academicYear = String(req.body?.academicYear || '').trim();
  const isValidUtcTimestamp = (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
  if (
    !isValidUtcTimestamp(startAt) ||
    !isValidUtcTimestamp(endAt) ||
    Date.parse(startAt) >= Date.parse(endAt) ||
    (academicYear && !/^\d{4}\/\d{4}$/.test(academicYear))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid academic year and valid dates and times, with the expiry later than the start.',
    });
  }

  try {
    const window = await setDepartmentEvaluationWindow(
      departmentId,
      startAt,
      endAt,
      req.user?.id,
      academicYear || null,
    );
    return res.json({
      success: true,
      message: 'Department evaluation schedule saved successfully.',
      data: {
        ...window,
        deadline: window.expiryDate || window.endAt,
        configured: true,
      },
    });
  } catch (error) {
    console.error('Unable to save department evaluation schedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to save the department evaluation schedule.',
    });
  }
};

router.post('/evaluation-schedule', authenticateToken, authorizeRoles('dept_head'), saveEvaluationSchedule);
router.put('/evaluation-schedule', authenticateToken, authorizeRoles('dept_head'), saveEvaluationSchedule);

router.delete('/evaluation-schedule', authenticateToken, authorizeRoles('dept_head'), async (req, res) => {
  const departmentId = getOwnDepartmentId(req);
  if (!departmentId) {
    return res.status(403).json({
      success: false,
      message: 'Your department is not defined. Contact an administrator.',
    });
  }

  try {
    await deleteDepartmentEvaluationWindow(departmentId);
    return res.json({
      success: true,
      message: 'Department evaluation schedule cleared successfully.',
    });
  } catch (error) {
    console.error('Unable to clear department evaluation schedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to clear the department evaluation schedule.',
    });
  }
});

router.get('/analytics', authenticateToken, authorizeRoles('dept_head'), async (req, res) => {
  const departmentId = Number(req.user?.department_id);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(403).json({ message: 'Your department is not defined. Contact an administrator.' });
  }

  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) return res.status(409).json({ message: 'There is no active evaluation cycle.' });
    const [rows] = await pool.query(`
      SELECT
        COALESCE(NULLIF(d.department_name, ''), d.name) AS department,
        ROUND(AVG(er.total_score), 2) AS satisfaction
      FROM evaluation_results er
      INNER JOIN instructors i ON i.id = er.instructor_id
      INNER JOIN departments d ON d.id = er.department_id
      INNER JOIN users u ON u.id = i.user_id
      WHERE er.department_id = ?
        AND er.cycle_id = ?
        AND LOWER(COALESCE(u.status, 'active')) = 'active'
      GROUP BY d.id, d.department_name, d.name
      ORDER BY department ASC
    `, [departmentId, activeCycle.id]);

    return res.json(rows.map((row) => ({
      department: row.department || 'Department',
      satisfaction: Number(row.satisfaction || 0),
    })));
  } catch (error) {
    console.error('Unable to load department-head analytics:', error);
    return res.status(500).json({ message: 'Unable to load department analytics.' });
  }
});

router.post('/evaluations', authenticateToken, authorizeRoles('dept_head'), (req, res, next) => {
  const targetRole = req.body?.target_role ?? req.body?.targetRole;
  if (targetRole !== undefined && !isAllowedDepartmentHeadTargetRole(targetRole)) {
    return res.status(403).json({
      success: false,
      message: 'Department Heads may only evaluate instructors and lab assistants.',
    });
  }
  return next();
});

router.post('/submit-evaluation', authenticateToken, authorizeRoles('dept_head'), async (req, res) => {
  const evaluatedId = Number(req.body?.evaluated_id ?? req.body?.instructor_id ?? 0);
  const scores = req.body?.scores ?? req.body?.criteria_scores ?? {};
  const totalScore = Number(req.body?.total_score ?? req.body?.totalScore);
  const strengths = String(req.body?.strengths || '').trim();
  const weaknesses = String(req.body?.weaknesses ?? req.body?.improvements ?? '').trim();
  const generalComments = String(req.body?.comments ?? req.body?.general_comments ?? req.body?.generalComments ?? '').trim();

  const feedbackValidation = validateEvaluationFeedback({
    Strengths: strengths,
    'Areas for Improvement': weaknesses,
    'General Comments': generalComments,
  });
  if (!feedbackValidation.valid) {
    return res.status(400).json({
      success: false,
      message: feedbackValidation.message,
    });
  }

  if (!evaluatedId || !Number.isFinite(totalScore)) {
    return res.status(400).json({
      success: false,
      message: 'Evaluated instructor and total score are required.',
    });
  }

  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ success: false, message: 'There is no active evaluation cycle.' });
    }

    const evaluatorId = Number(req.user?.id || req.user?.user_id || 0);
    const evaluatorDepartmentId = Number(req.user?.department_id || 0);
    const [[evaluator]] = await pool.query(
      'SELECT department_id FROM users WHERE id = ? LIMIT 1',
      [evaluatorId],
    );
    const departmentId = evaluatorDepartmentId || Number(evaluator?.department_id || 0);

    const [targetRows] = await pool.query(
      `SELECT i.id, i.department_id, u.role AS target_role
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       WHERE (i.id = ? OR u.id = ?)
         AND i.department_id = ?
         AND i.user_id <> ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       LIMIT 1`,
      [evaluatedId, evaluatedId, departmentId, evaluatorId],
    );
    if (!targetRows.length || !isAllowedDepartmentHeadTargetRole(targetRows[0].target_role)) {
      return res.status(403).json({
        success: false,
        message: 'You may only evaluate instructors and lab assistants in your department.',
      });
    }

    const criteriaScores = scores && typeof scores === 'object' ? scores : {};
    const [existingRows] = await pool.query(
      `SELECT id FROM dept_head_evaluations
       WHERE evaluator_id = ? AND instructor_id = ? AND cycle_id = ?
       LIMIT 1`,
      [evaluatorId, targetRows[0].id, activeCycle.id],
    );

    let evaluationId;
    if (existingRows.length) {
      evaluationId = existingRows[0].id;
      await pool.query(
        `UPDATE dept_head_evaluations
         SET criteria_scores = ?, strengths = ?, weaknesses = ?, general_comments = ?,
             total_score = ?, status = 'Submitted', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          JSON.stringify(criteriaScores),
          strengths,
          weaknesses,
          generalComments,
          totalScore,
          evaluationId,
        ],
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO dept_head_evaluations
         (evaluator_id, instructor_id, department_id, cycle_id, criteria_scores,
          strengths, weaknesses, general_comments, total_score, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')`,
        [
          evaluatorId,
          targetRows[0].id,
          targetRows[0].department_id,
          activeCycle.id,
          JSON.stringify(criteriaScores),
          strengths,
          weaknesses,
          generalComments,
          totalScore,
        ],
      );
      evaluationId = result.insertId;
    }

    await pool.query(
      `INSERT INTO evaluation_results
       (instructor_id, department_id, cycle_id, student_average, peer_average, dept_head_score, total_score)
       VALUES (?, ?, ?, 0, 0, ?, ?)
       ON DUPLICATE KEY UPDATE dept_head_score = VALUES(dept_head_score),
         total_score = VALUES(total_score), published_at = CURRENT_TIMESTAMP`,
      [targetRows[0].id, targetRows[0].department_id, activeCycle.id, totalScore, totalScore],
    );

    return res.status(200).json({
      success: true,
      message: 'Department Head evaluation submitted successfully.',
      data: { id: evaluationId, total_score: totalScore, status: 'Submitted' },
    });
  } catch (error) {
    console.error('Submit department-head evaluation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to submit Department Head evaluation.',
    });
  }
});

module.exports = router;