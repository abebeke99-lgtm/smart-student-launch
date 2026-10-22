const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const pool = require("../config/db");
const { getActiveEvaluationCycle } = require("../config/evaluationCycles");
const {
  getDepartmentEvaluationDeadline,
} = require("../config/departmentEvaluationWindows");
const {
  isAllowedPeerEvaluationPair,
  isAcademicLeaderRole,
  isLabAssistantRole,
  isSameDepartmentPeerPair,
  normalizeRole,
} = require("../utils/departmentHeadEvaluation");

const router = express.Router();

router.get(
  "/peer-targets",
  authenticateToken,
  authorizeRoles(
    "instructor",
    "lab_assistant",
    "ara",
    "dept_head",
    "department_head",
    "college_dean",
    "dean",
    "academic_directorate",
    "academic_director",
    "directorate",
  ),
  async (req, res) => {
    try {
      const isLabAssistant = isLabAssistantRole(req.user.role);
      const [[evaluator]] = await pool.query(
        `SELECT COALESCE(u.department_id, i.department_id) AS department_id,
                COALESCE(
                  u.college_id,
                  user_department.college_id,
                  instructor_department.college_id
                ) AS college_id
         FROM users u
         LEFT JOIN instructors i ON i.user_id = u.id
         LEFT JOIN departments user_department
           ON user_department.id = u.department_id
         LEFT JOIN departments instructor_department
           ON instructor_department.id = i.department_id
         WHERE u.id = ?
         LIMIT 1`,
        [req.user.id],
      );
      const departmentId = Number(
        evaluator?.department_id || req.user.department_id,
      );
      const collegeId = Number(evaluator?.college_id || req.user.college_id || 0);
      if (
        isLabAssistant
          ? !Number.isInteger(collegeId) || collegeId <= 0
          : !Number.isInteger(departmentId) || departmentId <= 0
      ) {
        return res.status(403).json({
          success: false,
          message: isLabAssistant
            ? "Your college is not configured for peer evaluation."
            : "Your department is not configured for peer evaluation.",
        });
      }

      const activeCycle = await getActiveEvaluationCycle();
      const deadline = await getDepartmentEvaluationDeadline(
        departmentId,
        activeCycle?.end_at,
      );
      const targetRoles = isLabAssistant
        ? ["lab_assistant", "ara"]
        : [
            "department_head",
            "dept_head",
            "instructor",
            "college_dean",
            "dean",
            "academic_directorate",
            "academic_director",
            "directorate",
          ];
      const targetRolePredicate = isLabAssistant
        ? "LOWER(REPLACE(REPLACE(TRIM(COALESCE(target.role, '')), '-', '_'), ' ', '_')) IN ('lab_assistant', 'ara', 'labassistant')"
        : `LOWER(REPLACE(REPLACE(TRIM(COALESCE(target.role, '')), '-', '_'), ' ', '_'))
             IN (${targetRoles.map(() => "?").join(", ")})`;
      if (isLabAssistant && activeCycle?.id) {
        await pool.query(
          `INSERT INTO peer_evaluations
             (evaluator_id, evaluatee_id, course_id, cycle_id, deadline, status)
           SELECT ?, target_i.id, NULL, ?, ?, 'pending'
           FROM instructors target_i
           INNER JOIN users target_user ON target_user.id = target_i.user_id
           LEFT JOIN departments target_user_department
             ON target_user_department.id = target_user.department_id
           LEFT JOIN departments target_instructor_department
             ON target_instructor_department.id = target_i.department_id
           WHERE (
               target_user.college_id = ?
               OR target_user_department.college_id = ?
               OR target_instructor_department.college_id = ?
             )
             AND target_i.user_id <> ?
             AND LOWER(COALESCE(target_user.status, 'active')) = 'active'
             AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_user.role, '')), '-', '_'), ' ', '_'))
               IN ('lab_assistant', 'ara', 'labassistant')
             AND NOT EXISTS (
               SELECT 1
               FROM peer_evaluations existing
               WHERE existing.evaluator_id = ?
                 AND existing.evaluatee_id = target_i.id
                 AND existing.course_id IS NULL
                 AND existing.cycle_id = ?
             )`,
          [
            req.user.id,
            activeCycle.id,
            deadline,
            collegeId,
            collegeId,
            collegeId,
            req.user.id,
            req.user.id,
            activeCycle.id,
          ],
        );
      }
      const [targets] = await pool.query(
        `SELECT
           pe.id,
           pe.id AS peer_evaluation_id,
           target.id AS target_user_id,
           target.username,
           target.role AS target_role,
           i.id AS evaluatee_id,
           COALESCE(
             NULLIF(TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))), ''),
             target.username
           ) AS instructor_name,
           COALESCE(i.department_id, target.department_id) AS target_department_id,
           COALESCE(
             instructor_department.department_name,
             user_department.department_name
           ) AS target_department_name,
           COALESCE(
             target.college_id,
             user_department.college_id,
             instructor_department.college_id
           ) AS target_college_id,
           pe.deadline,
           CASE
             WHEN pes.id IS NOT NULL THEN 'completed'
             WHEN pe.id IS NOT NULL THEN 'pending'
             ELSE 'unpublished'
           END AS status,
           pes.score AS score,
           pes.score AS total_score,
           pes.strengths,
           pes.suggestions,
           pes.responses,
           pes.id AS submission_id,
           CASE WHEN pes.id IS NOT NULL THEN 1 ELSE 0 END AS is_submitted,
           CASE WHEN pes.id IS NOT NULL THEN 1 ELSE 0 END AS is_evaluated
         FROM users target
         LEFT JOIN instructors i ON i.user_id = target.id
         LEFT JOIN departments user_department
           ON user_department.id = target.department_id
         LEFT JOIN departments instructor_department
           ON instructor_department.id = i.department_id
         LEFT JOIN peer_evaluations pe
           ON pe.evaluatee_id = i.id
          AND pe.evaluator_id = ?
          AND pe.cycle_id = ?
          AND pe.course_id IS NULL
          ${isLabAssistant ? "" : "AND pe.is_published = 1"}
         LEFT JOIN peer_evaluation_submissions pes
           ON pes.peer_evaluation_id = pe.id
          AND pes.evaluator_id = ?
          AND LOWER(COALESCE(pes.status, 'submitted')) = 'submitted'
         WHERE ${
           isLabAssistant
             ? "(target.college_id = ? OR user_department.college_id = ? OR instructor_department.college_id = ?)"
             : "COALESCE(i.department_id, target.department_id) = ?"
         }
           AND target.id <> ?
           AND i.id IS NOT NULL
           AND ${targetRolePredicate}
            AND LOWER(COALESCE(target.status, 'active')) = 'active'
         ORDER BY target.role, instructor_name`,
        [
           req.user.id,
           activeCycle?.id || null,
           req.user.id,
           ...(isLabAssistant
             ? [collegeId, collegeId, collegeId]
             : [departmentId]),
           req.user.id,
           ...(isLabAssistant ? [] : targetRoles),
        ],
      );
      if (isLabAssistant) {
        console.log("Lab Assistant peer evaluation college:", {
          activeCollegeId: collegeId,
          evaluatorId: req.user.id,
          evaluatorRole: req.user.role,
          peersCount: targets.length,
        });
      }

      return res.status(200).json(
        (targets || []).map((target) => ({
          ...target,
          deadline,
          expiryDate: deadline,
          total_score:
            target.total_score === null ? 0 : Number(target.total_score),
          score: target.score === null ? null : Number(target.score),
          is_submitted: Boolean(target.is_submitted),
          is_evaluated: Boolean(target.is_evaluated),
          responses: target.responses
            ? typeof target.responses === "string"
              ? JSON.parse(target.responses)
              : target.responses
            : {},
        })),
      );
    } catch (error) {
      console.error("Peer evaluation targets query failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load peer evaluation targets.",
      });
    }
  },
);

router.post(
  "/peer-targets/:targetUserId/assignment",
  authenticateToken,
  authorizeRoles("lab_assistant", "ara"),
  async (req, res) => {
    try {
      const targetUserId = Number(req.params.targetUserId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({
          success: false,
          message: "A valid peer user ID is required.",
        });
      }

      const [[evaluator]] = await pool.query(
        `SELECT COALESCE(
                  user_department.college_id,
                  instructor_department.college_id,
                  evaluator.college_id
                ) AS college_id,
                COALESCE(evaluator.department_id, evaluator_instructor.department_id) AS department_id
         FROM users evaluator
         LEFT JOIN instructors evaluator_instructor
           ON evaluator_instructor.user_id = evaluator.id
         LEFT JOIN departments user_department
           ON user_department.id = evaluator.department_id
         LEFT JOIN departments instructor_department
           ON instructor_department.id = evaluator_instructor.department_id
         WHERE evaluator.id = ?
         LIMIT 1`,
        [req.user.id],
      );
      const collegeId = Number(evaluator?.college_id || 0);
      if (!Number.isInteger(collegeId) || collegeId <= 0) {
        return res.status(403).json({
          success: false,
          message: "Your college is not configured for peer evaluation.",
        });
      }

      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle?.id) {
        return res.status(409).json({
          success: false,
          message: "There is no active evaluation cycle.",
        });
      }

      const [[target]] = await pool.query(
        `SELECT target_instructor.id AS instructor_id,
                COALESCE(
                  target.college_id,
                  target_user_department.college_id,
                  target_instructor_department.college_id
                ) AS college_id
         FROM users target
         INNER JOIN instructors target_instructor
           ON target_instructor.user_id = target.id
         LEFT JOIN departments target_user_department
           ON target_user_department.id = target.department_id
         LEFT JOIN departments target_instructor_department
           ON target_instructor_department.id = target_instructor.department_id
         WHERE target.id = ?
           AND target.id <> ?
           AND LOWER(COALESCE(target.status, 'active')) = 'active'
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(target.role, '')), '-', '_'), ' ', '_'))
             IN ('lab_assistant', 'ara', 'labassistant')
           AND (
             target.college_id = ?
             OR target_user_department.college_id = ?
             OR target_instructor_department.college_id = ?
           )
         LIMIT 1`,
        [targetUserId, req.user.id, collegeId, collegeId, collegeId],
      );
      if (!target) {
        return res.status(404).json({
          success: false,
          message: "This Lab Assistant is not an active peer in your college.",
        });
      }

      const deadline = await getDepartmentEvaluationDeadline(
        Number(evaluator.department_id || req.user.department_id || 0),
        activeCycle.end_at,
      );
      let [[assignment]] = await pool.query(
        `SELECT id
         FROM peer_evaluations
         WHERE evaluator_id = ?
           AND evaluatee_id = ?
           AND course_id IS NULL
           AND cycle_id = ?
         LIMIT 1`,
        [req.user.id, target.instructor_id, activeCycle.id],
      );
      if (!assignment) {
        await pool.query(
          `INSERT INTO peer_evaluations
             (evaluator_id, evaluatee_id, course_id, cycle_id, deadline, status)
           VALUES (?, ?, NULL, ?, ?, 'pending')`,
          [req.user.id, target.instructor_id, activeCycle.id, deadline],
        );
        [[assignment]] = await pool.query(
          `SELECT id
           FROM peer_evaluations
           WHERE evaluator_id = ?
             AND evaluatee_id = ?
             AND course_id IS NULL
             AND cycle_id = ?
           LIMIT 1`,
          [req.user.id, target.instructor_id, activeCycle.id],
        );
      }
      if (!assignment?.id) {
        throw new Error("Peer evaluation assignment could not be created.");
      }

      return res.status(200).json({ id: assignment.id });
    } catch (error) {
      console.error("Unable to prepare Lab Assistant peer evaluation:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to prepare this peer evaluation.",
      });
    }
  },
);

/**
 * GET /api/evaluations/publish-assignments
 *
 * Retrieves course assignments with their publication status for a department.
 * Returns the list of assignments that can be published to students or instructors.
 *
 * Authentication Required: Yes (dept_head, admin roles)
 *
 * Query Parameters:
 *   - department (optional): Department ID or name. If not provided, uses authenticated user's department.
 *
 * Returns:
 *   - Array of assignment objects with fields:
 *     * id: Assignment ID
 *     * course_id: Associated course ID
 *     * instructor_id: Assigned instructor ID
 *     * program_type: e.g., "Regular", "Extension"
 *     * year_level: e.g., "1st Year (Freshman)"
 *     * semester: e.g., "Semester I"
 *     * section: Student section
 *     * is_student_published: Boolean indicating if published to students
 *     * is_peer_published: Boolean indicating if published to instructors/peers
 *     * course_code: Course code
 *     * course_name: Course name
 *     * instructor_name: Name of assigned instructor
 *
 * Error Responses:
 *   - 404: Department not found
 *   - 500: Database error
 */
router.get(
  "/publish-assignments",
  authenticateToken,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const departmentValue =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? req.user.department_id || req.user.department
          : req.query.department ||
            req.user.department_id ||
            req.user.department;

      if (!departmentValue) {
        return res.status(400).json({
          success: false,
          message:
            "Department information not found. Please provide a valid department parameter.",
        });
      }

      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId) {
        return res.status(404).json({
          success: false,
          message: "Department was not found.",
        });
      }

      const [rows] = await pool.query(
        `SELECT ca.id, ca.course_id, ca.instructor_id, ca.program_type, ca.year_level,
          ca.semester, ca.section, ca.academic_year, ca.cycle_id,
                ca.is_student_published,
                ca.is_peer_published,
                c.code AS course_code, c.name AS course_name,
                TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name
         FROM course_assignments ca
         INNER JOIN courses c ON c.id = ca.course_id
         INNER JOIN instructors i ON i.id = ca.instructor_id
         WHERE ca.department_id = ?
         ORDER BY ca.created_at DESC`,
        [departmentId],
      );

      return res.status(200).json(rows || []);
    } catch (error) {
      console.error("Publish assignments query failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load course assignments.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

router.post(
  "/publish-student",
  authenticateToken,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const {
        department_id,
        program_type,
        year_level,
        semester,
        section,
        academic_year,
        course_id,
        lab_assistant_id,
      } = req.body;
      const departmentValue =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? req.user.department_id || req.user.department
          : department_id || req.user.department_id || req.user.department;
      if (!departmentValue) return res.status(400).json({ success: false, message: "Missing required publish fields: department_id." });

      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId) {
        console.warn(
          "Student evaluation publish validation failed: department not found.",
          { departmentValue, body: req.body, userId: req.user?.id },
        );
        return res
          .status(404)
          .json({ success: false, message: "Department was not found." });
      }

      const academicYear = String(academic_year || "").trim();
      const selectedSemester = String(semester || "").trim();
      if (!academicYear || !selectedSemester) {
        return res.status(400).json({
          success: false,
          message: "Academic year and semester are required to publish evaluations.",
        });
      }

      if (course_id && lab_assistant_id) {
        const courseId = Number(course_id);
        const labAssistantId = Number(lab_assistant_id);
        const sectionValue = normalizeSectionValue(section);
        const [[assignment]] = await pool.query(
            `SELECT ca.id, ca.cycle_id, ca.department_id, ca.course_id, ca.program_type, ca.year_level,
                  ca.semester, ca.section, ca.academic_year, c.code AS course_code, c.name
           FROM course_assignments ca
           INNER JOIN courses c ON c.id = ca.course_id
             WHERE ca.course_id = ? AND ca.department_id = ? AND ca.academic_year = ?
             AND LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) =
                 LOWER(TRIM(?))
             AND LOWER(TRIM(ca.year_level)) = LOWER(TRIM(?))
             AND LOWER(TRIM(ca.semester)) = LOWER(TRIM(?))
             AND (? = '' OR LOWER(TRIM(COALESCE(ca.program_type, ''))) = LOWER(TRIM(?)))
           LIMIT 1`,
          [courseId, departmentId, academicYear, sectionValue, year_level, selectedSemester, program_type || "", program_type || ""],
        );
        if (!assignment) {
          return res.status(404).json({ success: false, message: "Course section assignment was not found." });
        }
        if (String(req.user?.role || "").toLowerCase() === "dept_head" && Number(req.user.department_id) !== Number(assignment.department_id)) {
          return res.status(403).json({ success: false, message: "You can only publish evaluations for your department." });
        }
        const [[assistant]] = await pool.query(
          `SELECT i.id, i.user_id
           FROM instructors i
           INNER JOIN users u ON u.id = i.user_id
           WHERE i.id = ? AND i.department_id = ?
             AND LOWER(COALESCE(u.status, 'active')) = 'active'
             AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_')) IN ('lab_assistant', 'ara')
           LIMIT 1`,
          [labAssistantId, assignment.department_id],
        );
        if (!assistant) {
          return res.status(400).json({ success: false, message: "Select an active Lab Assistant from the department." });
        }
        const [students] = await pool.query(
          `SELECT id FROM students
           WHERE department_id = ?
             AND LOWER(TRIM(COALESCE(year_level, ''))) = LOWER(TRIM(?))
             AND LOWER(TRIM(COALESCE(semester, ''))) = LOWER(TRIM(?))
             AND LOWER(TRIM(REPLACE(REPLACE(COALESCE(section, ''), 'Section ', ''), 'section ', ''))) = LOWER(TRIM(?))
             AND (? = '' OR LOWER(TRIM(COALESCE(program_type, ''))) = LOWER(TRIM(?)))`,
          [assignment.department_id, assignment.year_level, assignment.semester, sectionValue, assignment.program_type || "", assignment.program_type || ""],
        );
        const payload = JSON.stringify({
          source: "student_publish",
          requires_lab: true,
          lab_assistant_id: assistant.id,
          lab_assistant_user_id: assistant.user_id,
          course_id: assignment.course_id,
          section_id: assignment.id,
        });
        await pool.query(
          `INSERT INTO lab_assignment_evaluations
            (course_id, section_id, year_level, semester, lab_assistant_id, is_published)
           VALUES (?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE lab_assistant_id = VALUES(lab_assistant_id), is_published = 1`,
          [assignment.course_id, assignment.id, assignment.year_level, assignment.semester, assistant.id],
        );
        await pool.query(
          "UPDATE course_assignments SET is_published = 1, is_student_published = 1, publish_target = CASE WHEN is_peer_published = 1 THEN 'both' ELSE 'student' END WHERE id = ?",
          [assignment.id],
        );
        for (const student of students) {
          const [lectureDispatch] = await pool.query(
            `SELECT id FROM evaluation_dispatches
             WHERE student_id = ? AND assignment_id = ? AND student_group = 'student' AND cycle_id <=> ? LIMIT 1`,
            [student.id, assignment.id, assignment.cycle_id],
          );
          if (!lectureDispatch.length) {
            await pool.query(
              `INSERT INTO evaluation_dispatches
                (assignment_id, cycle_id, department_id, program_type, student_id, course_id,
                 course_code, course_name, academic_year, semester, year_level, student_group,
                 is_student_published, created_by, payload)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', 1, ?, ?)`,
              [assignment.id, assignment.cycle_id, assignment.department_id, assignment.program_type || null, student.id,
                assignment.course_id, assignment.course_code, assignment.name, assignment.academic_year,
                assignment.semester, assignment.year_level, req.user.id,
                JSON.stringify({ source: "student_publish", course_id: assignment.course_id, section_id: assignment.id })],
            );
          }
          const [existing] = await pool.query(
            `SELECT id FROM evaluation_dispatches
             WHERE student_id = ? AND assignment_id = ? AND student_group = 'lab_assistant' AND cycle_id <=> ? LIMIT 1`,
            [student.id, assignment.id, assignment.cycle_id],
          );
          if (existing.length) {
            await pool.query(
              `UPDATE evaluation_dispatches
               SET department_id = ?, program_type = ?, course_id = ?, course_code = ?, course_name = ?,
                   academic_year = ?, semester = ?, year_level = ?, is_student_published = 1,
                   payload = ?, created_by = ?
               WHERE id = ?`,
              [assignment.department_id, assignment.program_type || null, assignment.course_id, assignment.course_code, assignment.name,
                assignment.academic_year, assignment.semester, assignment.year_level, payload, req.user.id, existing[0].id],
            );
          } else {
            await pool.query(
              `INSERT INTO evaluation_dispatches
                (assignment_id, cycle_id, department_id, program_type, student_id, course_id, course_code,
                 course_name, academic_year, semester, year_level, student_group, is_student_published, created_by, payload)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lab_assistant', 1, ?, ?)`,
              [assignment.id, assignment.cycle_id, assignment.department_id, assignment.program_type || null, student.id,
                assignment.course_id, assignment.course_code, assignment.name, assignment.academic_year,
                assignment.semester, assignment.year_level, req.user.id, payload],
            );
          }
        }
        return res.status(200).json({ success: true, message: "Lecture and Lab Assistant evaluations published.", lab_assistant_id: assistant.id });
      }
      const duplicateFilters = [
        "ca.department_id = ?",
        "ca.academic_year = ?",
        "ca.is_student_published = 1",
      ];
      const duplicateParams = [departmentId, academicYear];

      [
        ["ca.program_type", program_type],
        ["ca.year_level", year_level],
        ["ca.semester", semester],
        ["ca.section", normalizeSectionValue(section)],
      ].forEach(([column, value]) => {
        if (value) {
          duplicateFilters.push(`LOWER(TRIM(${column})) = LOWER(TRIM(?))`);
          duplicateParams.push(value);
        }
      });

      const [[existingBatch]] = await pool.query(
        `SELECT COUNT(*) AS total FROM course_assignments ca WHERE ${duplicateFilters.join(" AND ")}`,
        duplicateParams,
      );

      if (Number(existingBatch?.total || 0) > 0) {
        console.warn(
          "Student evaluation publish skipped: batch is already published.",
          {
            departmentId,
            program_type,
            year_level,
            semester,
            section,
            academicYear,
            userId: req.user?.id,
          },
        );
        return res.status(200).json({
          success: false,
          isAlreadyPublished: true,
          message:
            "Evaluation form is already published for this section/batch. No changes were made.",
        });
      }

      const filters = ["ca.department_id = ?", "ca.academic_year = ?"];
      const params = [departmentId, academicYear];
      [
        ["ca.program_type", program_type],
        ["ca.year_level", year_level],
        ["ca.semester", semester],
        ["ca.section", normalizeSectionValue(section)],
      ].forEach(([column, value]) => {
        if (value) {
          filters.push(`LOWER(TRIM(${column})) = LOWER(TRIM(?))`);
          params.push(value);
        }
      });

      const [assignments] = await pool.query(
        `SELECT ca.id, ca.cycle_id, ca.course_id, ca.instructor_id, ca.academic_year, ca.program_type,
              ca.year_level, ca.semester, ca.section, c.code AS course_code, c.name,
             (lc.course_id IS NOT NULL) AS is_lab
       FROM course_assignments ca
       JOIN courses c ON c.id = ca.course_id
       LEFT JOIN lab_classes lc ON lc.course_id = c.id
       WHERE ${filters.join(" AND ")}`,
        params,
      );
      if (!assignments.length) {
        console.warn(
          "Student evaluation publish validation failed: no assignments matched.",
          {
            departmentId,
            program_type,
            year_level,
            semester,
            section,
            academicYear,
            userId: req.user?.id,
          },
        );
        return res
          .status(400)
          .json({
            success: false,
            message:
              "No course assignments matched the selected department, academic year, and filters.",
            fields: {
              department_id: departmentId,
              academic_year: academicYear,
              program_type,
              year_level,
              semester,
              section,
            },
          });
      }

      for (const assignment of assignments) {
        await pool.query(
          "UPDATE course_assignments SET is_published = 1, is_student_published = 1, publish_target = CASE WHEN is_peer_published = 1 THEN 'both' ELSE 'student' END WHERE id = ?",
          [assignment.id],
        );

        const [students] = await pool.query(
          "SELECT id FROM students WHERE department_id = ? AND (? = '' OR LOWER(TRIM(program_type)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(year_level)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(semester)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(REPLACE(REPLACE(section, 'Section ', ''), 'section ', ''))) = LOWER(TRIM(?)))",
          [
            departmentId,
            program_type || "",
            program_type || "",
            year_level || "",
            year_level || "",
            semester || "",
            semester || "",
            normalizeSectionValue(section),
            normalizeSectionValue(section),
          ],
        );

        if (Boolean(assignment.is_lab)) continue;

        for (const student of students) {
          await pool.query(
            `INSERT INTO evaluation_dispatches
            (assignment_id, cycle_id, student_id, course_id, course_code, course_name, academic_year, program_type,
             semester, year_level, student_group, department_id, is_student_published, created_by, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', ?, 1, ?, ?)`,
            [
              assignment.id,
              assignment.cycle_id,
              student.id,
              assignment.course_id,
              assignment.course_code || null,
              assignment.name,
              assignment.academic_year || academicYear,
              assignment.program_type || program_type || null,
              assignment.semester || semester || null,
              assignment.year_level || year_level || null,
              departmentId,
              req.user.id,
              JSON.stringify({ source: "student_publish" }),
            ],
          );
        }
      }

      const [students] = await pool.query(
        "SELECT id, program_type, year_level, semester, section FROM students WHERE department_id = ? AND (? = '' OR LOWER(TRIM(program_type)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(year_level)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(semester)) = LOWER(TRIM(?))) AND (? = '' OR LOWER(TRIM(REPLACE(REPLACE(section, 'Section ', ''), 'section ', ''))) = LOWER(TRIM(?)))",
        [
          departmentId,
          program_type || "",
          program_type || "",
          year_level || "",
          year_level || "",
          semester || "",
          semester || "",
          normalizeSectionValue(section),
          normalizeSectionValue(section),
        ],
      );
      return res.status(200).json({
        success: true,
        message: `Published student evaluations for ${assignments.length} assignments.`,
        publishedCount: assignments.length,
        studentCount: students.length,
      });
    } catch (error) {
      console.error("Student evaluation publish failed:", {
        message: error?.message,
        code: error?.code,
        body: req.body,
        userId: req.user?.id,
      });
      return res.status(500).json({
        success: false,
        message: "Unable to publish student evaluations.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

router.post(
  "/peer/publish-department",
  authenticateToken,
  authorizeRoles("dept_head"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const activeCycle = await getActiveEvaluationCycle(connection);
      if (!activeCycle) {
        return res.status(409).json({ message: "There is no active evaluation cycle." });
      }
      const departmentId = Number(
        req.user.department_id ?? req.user.department,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return res
          .status(403)
          .json({
            message:
              "Your department is not defined. Contact an administrator.",
          });
      }

      const sessionDeadline = activeCycle.end_at;
      const [[departmentScope]] = await connection.query(
        "SELECT college_id FROM departments WHERE id = ? LIMIT 1",
        [departmentId],
      );
      const collegeId = Number(departmentScope?.college_id || 0);
      if (!collegeId) {
        return res.status(403).json({
          message: "Your department is not assigned to a college.",
        });
      }

      const [evaluators] = await connection.query(
       `SELECT i.id AS instructor_id, u.id AS user_id, u.role AS evaluator_role,
               COALESCE(u.department_id, i.department_id) AS department_id
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       WHERE i.department_id = ?
        AND COALESCE(u.department_id, i.department_id) = ?
        AND LOWER(COALESCE(u.status, 'active')) = 'active'
        AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_'))
          IN ('instructor', 'lab_assistant', 'ara', 'dept_head', 'department_head', 'college_dean', 'dean',
              'academic_directorate', 'academic_director', 'directorate')`,
       [departmentId, departmentId],
      );
      const [targets] = await connection.query(
       `SELECT i.id AS instructor_id, i.user_id, u.role AS target_role,
               COALESCE(u.department_id, i.department_id) AS department_id
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       WHERE i.department_id = ?
        AND COALESCE(u.department_id, i.department_id) = ?
        AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'lab_assistant', 'ara')
        AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
       [departmentId, departmentId],
      );
      const [academicLeaderTargets] = await connection.query(
       `SELECT i.id AS instructor_id, i.user_id, u.role AS target_role,
               COALESCE(u.department_id, i.department_id) AS department_id
        FROM instructors i
        INNER JOIN users u ON u.id = i.user_id
        WHERE i.department_id = ?
          AND COALESCE(u.department_id, i.department_id) = ?
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
          AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_'))
            IN ('college_dean', 'dean', 'academic_directorate', 'academic_director', 'directorate')`,
       [departmentId, departmentId],
      );
      const [departmentHeadTargets] = await connection.query(
       `SELECT i.id AS instructor_id, i.user_id, u.role AS target_role,
               COALESCE(u.department_id, i.department_id) AS department_id
        FROM instructors i
        INNER JOIN users u ON u.id = i.user_id
        WHERE i.department_id = ?
          AND COALESCE(u.department_id, i.department_id) = ?
          AND LOWER(COALESCE(u.status, 'active')) = 'active'
          AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_'))
            IN ('dept_head', 'department_head')`,
       [departmentId, departmentId],
      );
      await connection.beginTransaction();
      await connection.query(
        `UPDATE course_assignments
       SET is_peer_published = 1,
           is_published = 1,
           publish_target = CASE WHEN is_student_published = 1 THEN 'both' ELSE 'instructor' END
       WHERE department_id = ? AND cycle_id = ?`,
        [departmentId, activeCycle.id],
      );

      let createdCount = 0;
      const ensurePeerAssignment = async (evaluator, target) => {
        if (
          !isSameDepartmentPeerPair(
            evaluator.department_id,
            target.department_id,
          )
        ) return;
        if (Number(evaluator.instructor_id) === Number(target.instructor_id)) return;
        if (!isAllowedPeerEvaluationPair(evaluator.evaluator_role, target.target_role)) return;
        const [existing] = await connection.query(
          "SELECT id FROM peer_evaluations WHERE evaluator_id = ? AND evaluatee_id = ? AND course_id IS NULL AND cycle_id = ? LIMIT 1",
          [evaluator.user_id, target.instructor_id, activeCycle.id],
        );
        if (existing.length) {
          await connection.query(
            "UPDATE peer_evaluations SET is_published = 1 WHERE id = ?",
            [existing[0].id],
          );
          return;
        }
        await connection.query(
          "INSERT INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, cycle_id, deadline, status, is_published) VALUES (?, ?, NULL, ?, ?, 'pending', 1)",
          [evaluator.user_id, target.instructor_id, activeCycle.id, sessionDeadline],
        );
        createdCount += 1;
      };

      for (const evaluator of evaluators) {
        for (const target of targets) {
          await ensurePeerAssignment(evaluator, target);
        }
      }

      const peerEvaluatorsForAcademicLeaders = evaluators.filter((evaluator) =>
        ['instructor', 'dept_head', 'college_dean', 'dean'].includes(
          normalizeRole(evaluator.evaluator_role),
        ),
      );
      for (const evaluator of peerEvaluatorsForAcademicLeaders) {
        for (const target of academicLeaderTargets) {
          await ensurePeerAssignment(evaluator, target);
        }
      }

      const departmentHeadEvaluators = evaluators.filter((evaluator) => {
        const evaluatorRole = normalizeRole(evaluator.evaluator_role);
        return evaluatorRole === 'instructor' || isAcademicLeaderRole(evaluatorRole);
      });
      for (const evaluator of departmentHeadEvaluators) {
        for (const target of departmentHeadTargets) {
          await ensurePeerAssignment(evaluator, target);
        }
      }

      await connection.commit();
      const staffCount =
        targets.length + academicLeaderTargets.length + departmentHeadTargets.length;
      return res.status(201).json({
        success: true,
        staffCount,
        evaluatorCount: evaluators.length,
        createdCount,
        message: `Peer evaluations published for ${staffCount} academic staff members.`,
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Peer publish rollback failed:", rollbackError);
      }
      console.error("Department peer publishing failed:", error);
      return res
        .status(500)
        .json({
          message: "Unable to publish department peer evaluations.",
          error: error.message,
        });
    } finally {
      connection.release();
    }
  },
);

function normalizeSectionValue(value) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  const withoutPrefix = normalized.replace(/^section\s+/i, "").trim();
  return withoutPrefix.replace(/\s+/g, " ");
}

/**
 * Helper function to resolve department ID from either numeric ID or department name/code
 *
 * @param {string|number} value - Department ID, name, or code
 * @param {Object} db - Database pool (defaults to module-level pool)
 * @returns {Promise<number|null>} - Department ID if found, null otherwise
 */
async function resolveDepartmentId(value, db = pool) {
  if (value == null) return null;
  const candidate = String(value).trim();
  if (!candidate) return null;

  // Try numeric ID first
  const numericId = Number(candidate);
  if (
    Number.isFinite(numericId) &&
    Number.isInteger(numericId) &&
    numericId > 0
  ) {
    const [rows] = await db.query(
      "SELECT id FROM departments WHERE id = ? LIMIT 1",
      [numericId],
    );
    if (rows.length) return rows[0].id;
  }

  // Try by name or code (case-insensitive)
  const lowerCandidate = candidate.toLowerCase();
  const [rows] = await db.query(
    "SELECT id FROM departments WHERE LOWER(name) = ? OR LOWER(code) = ? LIMIT 1",
    [lowerCandidate, lowerCandidate],
  );

  return rows.length ? rows[0].id : null;
}

module.exports = router;
