const pool = require("../config/db");

const createDepartment = async (req, res) => {
  const collegeId = Number(req.body.collegeId ?? req.body.college_id);
  const departmentName = String(
    req.body.departmentName ?? req.body.department_name ?? req.body.name ?? "",
  ).trim();
  const departmentCode = String(
    req.body.departmentCode ?? req.body.department_code ?? req.body.code ?? "",
  )
    .trim()
    .toUpperCase();

  if (
    !Number.isInteger(collegeId) ||
    collegeId <= 0 ||
    !departmentName ||
    !departmentCode
  ) {
    return res
      .status(400)
      .json({
        message: "collegeId, departmentName, and departmentCode are required.",
      });
  }

  try {
    const [[college]] = await pool.query(
      "SELECT id FROM colleges WHERE id = ? LIMIT 1",
      [collegeId],
    );
    if (!college)
      return res
        .status(400)
        .json({ message: "The selected college does not exist." });

    const [result] = await pool.query(
      `INSERT INTO departments (college_id, department_name, department_code, name, code)
       VALUES (?, ?, ?, ?, ?)`,
      [
        collegeId,
        departmentName,
        departmentCode,
        departmentName,
        departmentCode,
      ],
    );
    return res
      .status(201)
      .json({ id: result.insertId, collegeId, departmentName, departmentCode });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({
          message:
            "Department code already exists. Please use a unique department code.",
        });
    }
    console.error("Create department failed:", error);
    return res.status(500).json({ message: "Unable to create department." });
  }
};

const updateDepartment = async (req, res) => {
  const departmentId = Number(req.params.id);
  const departmentName = String(
    req.body.departmentName ?? req.body.department_name ?? req.body.name ?? "",
  ).trim();
  const departmentCode = String(
    req.body.departmentCode ?? req.body.department_code ?? req.body.code ?? "",
  )
    .trim()
    .toUpperCase();
  const collegeId = Number(req.body.collegeId ?? req.body.college_id);
  if (
    !Number.isInteger(departmentId) ||
    departmentId <= 0 ||
    !departmentName ||
    !departmentCode ||
    !Number.isInteger(collegeId) ||
    collegeId <= 0
  ) {
    return res
      .status(400)
      .json({
        message:
          "id, collegeId, departmentName, and departmentCode are required.",
      });
  }
  try {
    const [result] = await pool.query(
      `UPDATE departments SET college_id = ?, department_name = ?, department_code = ?, name = ?, code = ? WHERE id = ?`,
      [
        collegeId,
        departmentName,
        departmentCode,
        departmentName,
        departmentCode,
        departmentId,
      ],
    );
    if (!result.affectedRows)
      return res.status(404).json({ message: "Department not found." });
    return res.json({
      id: departmentId,
      collegeId,
      departmentName,
      departmentCode,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(400)
        .json({ message: "Department code already exists." });
    console.error("Update department failed:", error);
    return res.status(500).json({ message: "Unable to update department." });
  }
};

const deleteDepartment = async (req, res) => {
  const departmentId = Number(req.params.id);
  if (!Number.isInteger(departmentId) || departmentId <= 0)
    return res.status(400).json({ message: "Invalid department ID." });
  try {
    const [result] = await pool.query("DELETE FROM departments WHERE id = ?", [
      departmentId,
    ]);
    if (!result.affectedRows)
      return res.status(404).json({ message: "Department not found." });
    return res.json({ message: "Department deleted successfully." });
  } catch (error) {
    console.error("Delete department failed:", error);
    return res
      .status(409)
      .json({
        message: "Department cannot be deleted while it is still in use.",
      });
  }
};

const state = {
  registeredUsers: [
    {
      id: 1,
      fullName: "Alemu Bekele",
      email: "alemu@mu.edu.et",
      role: "Student",
      collegeId: "college-1",
      departmentId: "dept-1",
      programId: "program-2",
    },
    {
      id: 2,
      fullName: "Dr. Selamawit Tadesse",
      email: "selam@mu.edu.et",
      role: "Instructor",
      collegeId: "college-1",
      departmentId: "dept-1",
      programId: "program-2",
    },
  ],
  registeredCourses: [
    {
      id: 1,
      name: "Software Engineering",
      code: "SE401",
      collegeId: "college-1",
      departmentId: "dept-1",
      creditHours: "3",
    },
    {
      id: 2,
      name: "Database Systems",
      code: "CS402",
      collegeId: "college-1",
      departmentId: "dept-1",
      creditHours: "3",
    },
  ],
  evaluationSummaries: [
    {
      id: 1,
      instructorId: 2,
      instructorName: "Dr. Selamawit Tadesse",
      courseCode: "CS401",
      courseName: "Software Engineering",
      averageScore: 4.6,
      completed: 18,
      pending: 2,
      status: "On track",
    },
    {
      id: 2,
      instructorId: 3,
      instructorName: "Prof. Bekele Dadi",
      courseCode: "CS402",
      courseName: "Database Systems",
      averageScore: 4.4,
      completed: 15,
      pending: 5,
      status: "Needs follow-up",
    },
  ],
  departmentAssignments: [
    {
      id: 1,
      title: "Finalize semester review pack",
      courseCode: "SE401",
      courseName: "Software Engineering",
      dueDate: "2026-08-18",
      priority: "High",
      status: "In progress",
      owner: "Dept. Head",
      notes: "Collect instructor evidence and finalize summary.",
      createdAt: "2026-08-04T08:00:00.000Z",
    },
    {
      id: 2,
      title: "Confirm assessment schedule",
      courseCode: "CS402",
      courseName: "Database Systems",
      dueDate: "2026-08-12",
      priority: "Medium",
      status: "Planned",
      owner: "Academic Office",
      notes: "Coordinate with program coordinator.",
      createdAt: "2026-08-04T07:30:00.000Z",
    },
  ],
  departmentNotifications: [
    {
      id: 1,
      title: "Course mapping updated",
      detail:
        "Instructor assignment has been synchronized with the department roster.",
      createdAt: "2026-08-04T08:00:00.000Z",
    },
    {
      id: 2,
      title: "Evaluation follow-up",
      detail: "Two pending reviews need leadership attention before Friday.",
      createdAt: "2026-08-04T07:30:00.000Z",
    },
  ],
};

const getHealth = (req, res) => {
  res.json({
    status: "OK",
    message: "IEPS Backend is running",
    timestamp: new Date().toISOString(),
  });
};

const getUsers = (req, res) => res.json(state.registeredUsers);

const createUser = (req, res) => {
  const newUser = { id: Date.now(), ...req.body };
  state.registeredUsers = [newUser, ...state.registeredUsers];
  res.status(201).json(newUser);
};

const updateUser = (req, res) => {
  const userId = Number(req.params.id);
  state.registeredUsers = state.registeredUsers.map((user) =>
    user.id === userId ? { ...user, ...req.body } : user,
  );
  const updatedUser = state.registeredUsers.find((user) => user.id === userId);
  res.json(updatedUser);
};

const deleteUser = (req, res) => {
  const userId = Number(req.params.id);
  state.registeredUsers = state.registeredUsers.filter(
    (user) => user.id !== userId,
  );
  res.json({ success: true });
};

const getCourses = (req, res) => res.json(state.registeredCourses);

const createCourse = (req, res) => {
  const newCourse = { id: Date.now(), ...req.body };
  state.registeredCourses = [newCourse, ...state.registeredCourses];
  res.status(201).json(newCourse);
};

const updateCourse = (req, res) => {
  const courseId = Number(req.params.id);
  state.registeredCourses = state.registeredCourses.map((course) =>
    course.id === courseId ? { ...course, ...req.body } : course,
  );
  const updatedCourse = state.registeredCourses.find(
    (course) => course.id === courseId,
  );
  res.json(updatedCourse);
};

const deleteCourse = (req, res) => {
  const courseId = Number(req.params.id);
  state.registeredCourses = state.registeredCourses.filter(
    (course) => course.id !== courseId,
  );
  res.json({ success: true });
};

const getEvaluations = (req, res) => res.json(state.evaluationSummaries);

const getOverview = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = ["admin", "systemadmin"].includes(role);
    const departmentValue =
      req.user?.department_id ||
      req.user?.departmentId ||
      req.user?.department ||
      (isAdmin ? req.query.department_id || req.query.department : null);
    if (!departmentValue)
      return res.status(400).json({ message: "Department is required." });

    const numericDepartmentId = Number(departmentValue);
    const [departments] = await pool.query(
      `SELECT id FROM departments
       WHERE id = ? OR LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?)
       LIMIT 1`,
      [
        Number.isInteger(numericDepartmentId) ? numericDepartmentId : 0,
        String(departmentValue),
        String(departmentValue),
      ],
    );
    const departmentId = departments[0]?.id;
    if (!departmentId)
      return res.status(404).json({ message: "Department was not found." });

    const [
      [instructorCount],
      [studentCount],
      [courseCount],
      [assignmentCount],
      [evaluationStats],
      [periodStats],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total FROM instructors i JOIN users u ON u.id = i.user_id WHERE i.department_id = ? AND LOWER(TRIM(u.role)) IN ('instructor', 'dept_head') AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
        [departmentId],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM students s JOIN users u ON u.id = s.user_id WHERE s.department_id = ? AND LOWER(TRIM(u.role)) = 'student' AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
        [departmentId],
      ),
      pool.query(
        "SELECT COUNT(*) AS total FROM courses WHERE department_id = ?",
        [departmentId],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM course_assignments WHERE department_id = ? AND (is_published = 1 OR is_student_published = 1 OR is_peer_published = 1)`,
        [departmentId],
      ),
      pool.query(
        `SELECT
          COUNT(DISTINCT CASE WHEN ed.status = 'pending' AND ed.is_student_published = 1 THEN COALESCE(ed.assignment_id, ed.id) END) AS openEvaluations,
          COUNT(DISTINCT CASE WHEN ed.status = 'pending' AND ed.is_student_published = 1 THEN ed.id END) AS pendingReviewItems,
          ROUND(COALESCE(AVG(CASE WHEN LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved') THEN ses.score END), 0), 1) AS averageScore
         FROM evaluation_dispatches ed
         LEFT JOIN student_evaluation_submissions ses ON ses.dispatch_id = ed.id
         WHERE ed.department_id = ?`,
        [departmentId],
      ),
      pool.query(
        `SELECT
          SUM(CASE WHEN i.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS instructorsCurrent,
          SUM(CASE WHEN i.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND i.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS instructorsPrevious,
          (SELECT SUM(CASE WHEN s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) FROM students s JOIN users u ON u.id = s.user_id WHERE s.department_id = ? AND LOWER(TRIM(u.role)) = 'student' AND LOWER(COALESCE(u.status, 'active')) = 'active') AS studentsCurrent,
          (SELECT SUM(CASE WHEN s.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND s.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) FROM students s JOIN users u ON u.id = s.user_id WHERE s.department_id = ? AND LOWER(TRIM(u.role)) = 'student' AND LOWER(COALESCE(u.status, 'active')) = 'active') AS studentsPrevious,
          (SELECT SUM(CASE WHEN c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) FROM courses c WHERE c.department_id = ?) AS coursesCurrent,
          (SELECT SUM(CASE WHEN c.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND c.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) FROM courses c WHERE c.department_id = ?) AS coursesPrevious,
          (SELECT SUM(CASE WHEN ca.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) FROM course_assignments ca WHERE ca.department_id = ? AND (ca.is_published = 1 OR ca.is_student_published = 1 OR ca.is_peer_published = 1)) AS assignmentsCurrent,
          (SELECT SUM(CASE WHEN ca.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND ca.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) FROM course_assignments ca WHERE ca.department_id = ? AND (ca.is_published = 1 OR ca.is_student_published = 1 OR ca.is_peer_published = 1)) AS assignmentsPrevious,
          (SELECT COUNT(DISTINCT CASE WHEN ed.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN COALESCE(ed.assignment_id, ed.id) END) FROM evaluation_dispatches ed WHERE ed.department_id = ? AND ed.status = 'pending' AND ed.is_student_published = 1) AS evaluationsCurrent,
          (SELECT COUNT(DISTINCT CASE WHEN ed.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND ed.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN COALESCE(ed.assignment_id, ed.id) END) FROM evaluation_dispatches ed WHERE ed.department_id = ? AND ed.status = 'pending' AND ed.is_student_published = 1) AS evaluationsPrevious,
          (SELECT COUNT(DISTINCT CASE WHEN ed.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ed.id END) FROM evaluation_dispatches ed WHERE ed.department_id = ? AND ed.status = 'pending' AND ed.is_student_published = 1) AS reviewsCurrent,
          (SELECT COUNT(DISTINCT CASE WHEN ed.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND ed.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ed.id END) FROM evaluation_dispatches ed WHERE ed.department_id = ? AND ed.status = 'pending' AND ed.is_student_published = 1) AS reviewsPrevious,
          (SELECT AVG(CASE WHEN ses.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ses.score END) FROM evaluation_dispatches ed JOIN student_evaluation_submissions ses ON ses.dispatch_id = ed.id WHERE ed.department_id = ? AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')) AS scoreCurrent,
          (SELECT AVG(CASE WHEN ses.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND ses.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ses.score END) FROM evaluation_dispatches ed JOIN student_evaluation_submissions ses ON ses.dispatch_id = ed.id WHERE ed.department_id = ? AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')) AS scorePrevious
         FROM instructors i JOIN users u ON u.id = i.user_id
         WHERE i.department_id = ? AND LOWER(TRIM(u.role)) IN ('instructor', 'dept_head') AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
        [
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
          departmentId,
        ],
      ),
    ]);

    const percentageChange = (current, previous) => {
      const priorValue = Number(previous || 0);
      if (!priorValue) return null;
      return Number(
        (((Number(current || 0) - priorValue) / priorValue) * 100).toFixed(1),
      );
    };
    const period = periodStats[0] || {};

    return res.json({
      departmentId,
      totalInstructors: Number(instructorCount[0]?.total || 0),
      totalStudents: Number(studentCount[0]?.total || 0),
      totalCourses: Number(courseCount[0]?.total || 0),
      activeAssignments: Number(assignmentCount[0]?.total || 0),
      openEvaluations: Number(evaluationStats[0]?.openEvaluations || 0),
      averageScore: Number(evaluationStats[0]?.averageScore || 0),
      pendingReviewItems: Number(evaluationStats[0]?.pendingReviewItems || 0),
      trends: {
        totalInstructors: percentageChange(
          period.instructorsCurrent,
          period.instructorsPrevious,
        ),
        totalStudents: percentageChange(
          period.studentsCurrent,
          period.studentsPrevious,
        ),
        totalCourses: percentageChange(
          period.coursesCurrent,
          period.coursesPrevious,
        ),
        activeAssignments: percentageChange(
          period.assignmentsCurrent,
          period.assignmentsPrevious,
        ),
        openEvaluations: percentageChange(
          period.evaluationsCurrent,
          period.evaluationsPrevious,
        ),
        averageScore: percentageChange(
          period.scoreCurrent,
          period.scorePrevious,
        ),
        pendingReviewItems: percentageChange(
          period.reviewsCurrent,
          period.reviewsPrevious,
        ),
      },
    });
  } catch (error) {
    console.error("Department overview stats failed:", error);
    return res
      .status(500)
      .json({ message: "Unable to load department overview stats." });
  }
};

const getAssignments = (req, res) => {
  res.json({
    assignments: state.departmentAssignments,
    notifications: state.departmentNotifications,
  });
};

const createAssignment = (req, res) => {
  const assignment = { id: Date.now(), ...req.body };
  state.departmentAssignments = [assignment, ...state.departmentAssignments];
  state.departmentNotifications = [
    {
      id: Date.now(),
      title: "Assignment created",
      detail: `${assignment.title} was added to the assignment hub.`,
      createdAt: assignment.createdAt || new Date().toISOString(),
    },
    ...state.departmentNotifications,
  ].slice(0, 8);
  res.status(201).json(assignment);
};

const updateAssignment = (req, res) => {
  const assignmentId = Number(req.params.id);
  state.departmentAssignments = state.departmentAssignments.map((assignment) =>
    assignment.id === assignmentId
      ? { ...assignment, ...req.body }
      : assignment,
  );
  const updatedAssignment = state.departmentAssignments.find(
    (assignment) => assignment.id === assignmentId,
  );
  res.json(updatedAssignment);
};

const deleteAssignment = (req, res) => {
  const assignmentId = Number(req.params.id);
  state.departmentAssignments = state.departmentAssignments.filter(
    (assignment) => assignment.id !== assignmentId,
  );
  res.json({ success: true });
};

module.exports = {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getHealth,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getEvaluations,
  getOverview,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
