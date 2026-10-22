const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const multer = require("multer");
const session = require("express-session");
const XLSX = require("xlsx");
const fs = require("fs");
const pool = require("./config/db");
const { ensureSystemSettingsTable } = require("./config/audit");
const { ensureEvaluationCycleSchema } = require("./config/evaluationCycles");
const { getActiveEvaluationCycle } = require("./config/evaluationCycles");
const {
  getBroadcastHistory,
  sendBroadcast,
  startBroadcastScheduler,
} = require("./controllers/adminController");
const {
  startEvaluationWindowRenewal,
} = require("./config/evaluationWindowRenewal");
const {
  ensureVicePresidentEvaluationSchema,
} = require("./config/vicePresidentEvaluations");
const {
  ensureDepartmentEvaluationWindowSchema,
  getDepartmentEvaluationDeadline,
  isEvaluationDeadlineExpired,
  seedLocalDepartmentEvaluationWindowsIfMissing,
} = require("./config/departmentEvaluationWindows");
const { ensureUserProfileSettings } = require("./utils/profileSettings");
const {
  normalizePhoneNumber,
  isValidPhoneNumber,
  isValidRegistrationPhoneNumber,
} = require("./utils/phone");
const {
  validateEvaluationFeedback,
} = require("./utils/evaluationFeedbackValidation");
const { calculatePerformanceScore } = require("./utils/performanceScore");
const {
  isAcademicLeaderRole,
  isAllowedPeerEvaluationPair,
  isLabAssistantRole,
  normalizeRole,
} = require("./utils/departmentHeadEvaluation");

const authRoutes = require("./routes/authRoutes");
const secureRoutes = require("./routes/secureRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const publicRoutes = require("./routes/publicRoutes");
const adminRoutes = require("./routes/adminRoutes");
const deptHeadRoutes = require("./routes/deptHead");
const userRoutes = require("./routes/user");
const deanRoutes = require("./routes/dean");
const directorateRoutes = require("./routes/directorate");
const vicePresidentRoutes = require("./routes/vicePresident");
const evaluationRoutes = require("./routes/evaluationRoutes");
const contactRoutes = require("./routes/contactRoutes");
const notificationRoutes = require("./routes/notifications");
const {
  bulkUploadStudents,
  registerStudent,
} = require("./controllers/studentController");
const { createDepartment } = require("./controllers/departmentController");
const { submitContactMessage } = require("./controllers/contactController");
const {
  forgotPassword,
  verifyOtp,
  resetPasswordOtp,
  resetPassword,
} = require("./controllers/authController");
const {
  authenticateToken: mwAuthenticateToken,
  authorizeRoles: mwAuthorizeRoles,
  systemMaintenanceMiddleware,
  evaluationWindowMiddleware,
} = require("./middleware/auth");
const { sendSms } = require("./services/smsService");
const {
  sendTelegramNotice,
} = require("./services/telegramService");
const {
  isValidPassword,
  validateRequestInput,
} = require("./utils/inputValidation");
const standardInstructorCriteria = require("./data/standardInstructorCriteria");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const app = express();
const PORT = process.env.PORT || 5001;
const normalizeOrigin = (value) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};
const allowedOrigins = new Set();

[
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  ...(process.env.CORS_ORIGINS || "").split(","),
  "https://ipes-1.onrender.com",
  "https://ipes-1-jstk.onrender.com",
].forEach((origin) => {
  const normalized = normalizeOrigin(origin?.trim());
  if (normalized) allowedOrigins.add(normalized);
});

console.log("CORS allowed origins:", Array.from(allowedOrigins));

const uploadsDirectory = path.join(__dirname, "uploads");
const profileUploadsDirectory = path.join(uploadsDirectory, "profile");
fs.mkdirSync(profileUploadsDirectory, { recursive: true });
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const ADMIN_DEFAULT_PASSWORD =
  process.env.ADMIN_DEFAULT_PASSWORD || "admin@123";
const USER_DEFAULT_PASSWORD =
  process.env.USER_DEFAULT_PASSWORD ||
  process.env.DEFAULT_PASSWORD ||
  "12345678";
const isValidName = (value) => {
  const normalized = String(value || "").trim();
  return normalized.length >= 3 && normalized.length <= 30;
};
const getDefaultPasswordForRole = (role) => {
  if (String(role || "").toLowerCase() === "admin")
    return ADMIN_DEFAULT_PASSWORD;
  return USER_DEFAULT_PASSWORD;
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      const isLocalDevelopmentOrigin =
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      if (isLocalDevelopmentOrigin) return callback(null, true);

      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(validateRequestInput);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ipes-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use(systemMaintenanceMiddleware);
app.use(evaluationWindowMiddleware);
app.use("/api/auth", authRoutes);
app.post("/api/forgot-password", forgotPassword);
app.post("/api/verify-otp", verifyOtp);
app.post("/api/reset-password-otp", resetPasswordOtp);
app.post("/api/reset-password", resetPassword);
app.use("/api/secure", secureRoutes);
app.use("/api/department", departmentRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.get(
  "/api/broadcasts",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin", "systemadmin"),
  getBroadcastHistory,
);
app.post(
  "/api/broadcasts/send",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin", "systemadmin"),
  sendBroadcast,
);
app.use("/api/dept-head", deptHeadRoutes);
app.use("/api/user", userRoutes);
app.use("/api/dean", deanRoutes);
app.use("/api/directorate", directorateRoutes);
app.use("/api/vice-president", vicePresidentRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/notifications", notificationRoutes);
app.post(
  "/api/courses/register",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin", "systemadmin", "dept_head", "department_head"),
  async (req, res) => {
    try {
      const courseName = String(req.body.course_name || "").trim();
      const isLabValue = req.body.is_lab;
      const isLabString = String(isLabValue ?? "").trim().toLowerCase();
      const isLab =
        isLabValue === true || isLabValue === 1 || ["true", "1"].includes(isLabString);
      const section = normalizeSectionValue(req.body.section);
      const isDepartmentHead = ["dept_head", "department_head"].includes(
        String(req.user.role || "").trim().toLowerCase(),
      );
      let departmentId = await resolveDepartmentId(
        isDepartmentHead
          ? req.user.department_id || req.user.departmentId || req.user.department
          : req.body.department_id || req.body.departmentId || req.user.department_id,
      );
      if (!departmentId && isDepartmentHead) {
        const [[departmentRow]] = await pool.query(
          `SELECT COALESCE(u.department_id, i.department_id) AS department_id
           FROM users u
           LEFT JOIN instructors i ON i.user_id = u.id
           WHERE u.id = ? LIMIT 1`,
          [req.user.id],
        );
        departmentId = departmentRow?.department_id || null;
      }
      const creditHours = req.body.credit_hours == null || req.body.credit_hours === ""
        ? 3
        : Number(req.body.credit_hours);
      let courseCode = String(req.body.course_code || "").trim();
      if (!courseCode && isLab && departmentId && section && courseName) {
        const toCodeSegment = (value) =>
          String(value || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const offeringCode = toCodeSegment(
          `${req.body.year_level || ""}-${req.body.semester || ""}`,
        );
        const labSlug = toCodeSegment(courseName).slice(0, 50) || "CLASS";
        const uniqueSuffix = Date.now().toString(36).toUpperCase();
        courseCode = `LAB-${departmentId}-${section.toUpperCase()}-${offeringCode}-${labSlug}-${uniqueSuffix}`.slice(0, 100);
      }
      if (!courseName) {
        return res.status(400).json({
          message: "course_name is required.",
        });
      }
      if (!departmentId) {
        return res.status(400).json({
          message: "A valid department could not be identified for this account.",
        });
      }
      if (!courseCode && !isLab) {
        return res.status(400).json({
          message: "course_code is required for a Lecture Course.",
        });
      }
      if (
        isLabValue !== undefined &&
        isLabValue !== null &&
        isLabString !== "" &&
        !["true", "false", "1", "0"].includes(isLabString)
      ) {
        return res.status(400).json({ message: "is_lab must be a boolean value." });
      }
      if (!Number.isInteger(creditHours) || creditHours <= 0) {
        return res.status(400).json({
          message: "credit_hours must be a positive whole number.",
        });
      }
      if (isLab && !section) {
        return res.status(400).json({ message: "A section is required for a Lab Class." });
      }

      const connection = await pool.getConnection();
      let result;
      try {
        await connection.beginTransaction();
        [result] = await connection.query(
          `INSERT INTO courses
            (code, name, department_id, year_level, semester, credit_hours)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            courseCode,
            courseName,
            departmentId,
            String(req.body.year_level || "").trim() || null,
            String(req.body.semester || "").trim() || null,
            creditHours,
          ],
        );
        if (isLab) {
          await connection.query(
            `INSERT INTO lab_classes (course_id, section)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE section = VALUES(section)`,
            [result.insertId, section],
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return res.status(201).json({
        id: result.insertId,
        code: courseCode,
        name: courseName,
        department_id: departmentId,
        year_level: req.body.year_level || null,
        semester: req.body.semester || null,
        credit_hours: creditHours,
        is_lab: isLab,
        section: isLab ? section : null,
      });
    } catch (error) {
      console.error("Course registration failed:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "That course code is already registered." });
      }
      return res.status(500).json({ message: "Unable to register course." });
    }
  },
);
app.post("/api/support/message", submitContactMessage);
app.get("/uploads/profile/:filename", async (req, res, next) => {
  const filename = String(req.params.filename || "");
  if (!/^user-\d+-\d+\.(jpg|png|webp|gif|avif)$/i.test(filename)) return next();

  try {
    await ensureUserProfileSettings();
    const [[picture]] = await pool.query(
      `SELECT profile_picture_data, profile_picture_mime_type
       FROM user_profile_settings
       WHERE profile_picture = ? AND profile_picture_data IS NOT NULL
       LIMIT 1`,
      [`/uploads/profile/${filename}`],
    );
    if (!picture?.profile_picture_data) return next();
    res.set("Content-Type", picture.profile_picture_mime_type || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(picture.profile_picture_data);
  } catch (error) {
    console.error("Profile picture retrieval failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to load this profile picture.",
    });
  }
});
app.use("/uploads", express.static(uploadsDirectory));
app.post(
  "/api/students/bulk-upload",
  upload.single("file"),
  bulkUploadStudents,
);
app.post(
  "/api/students/register",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin"),
  registerStudent,
);
app.get(
  "/api/colleges",
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    delete req.headers["if-none-match"];
    delete req.headers["if-modified-since"];
    next();
  },
  mwAuthenticateToken,
  mwAuthorizeRoles("admin", "systemadmin"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, name, code, description, created_at FROM colleges ORDER BY name ASC",
      );
      return res.json(rows);
    } catch (error) {
      console.error("Fetch colleges failed:", error);
      return res.status(500).json({ message: "Unable to load colleges." });
    }
  },
);
app.post(
  "/api/departments",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin", "systemadmin"),
  createDepartment,
);

const sendResponse = (res, statusCode, messageEn, messageAm, data = null) => {
  res.status(statusCode).json({
    success: statusCode < 400,
    message: { en: messageEn, am: messageAm },
    data,
  });
};

const authenticate = (req, res, next) => {
  const authorization =
    typeof req.headers?.authorization === "string"
      ? req.headers.authorization.trim()
      : "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    console.warn("JWT authentication header rejected:", {
      method: req.method,
      path: req.originalUrl,
      hasAuthorizationHeader: Boolean(authorization),
      scheme: authorization.split(/\s+/, 1)[0] || null,
    });
    return sendResponse(res, 401, "Authentication required.", "ማረጋገጫ ያስፈልጋል።");
  }

  const token = match[1];
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.warn("JWT authentication failed:", {
        method: req.method,
        path: req.originalUrl,
        errorName: err.name,
        errorMessage: err.message,
      });
      return sendResponse(
        res,
        401,
        "Invalid or expired token.",
        "ልክ ያልሆነ ወይም ጊዜ ያለፈ ቶከን ነው።",
      );
    }
    req.user = decoded;
    if (req.user?.id && !req.user.department_id) {
      try {
        const [rows] = await pool.query(
          `SELECT
             COALESCE(u.department_id, i.department_id, s.department_id) AS department_id,
             d.code AS department_code,
             d.name AS department_name
           FROM users u
           LEFT JOIN instructors i ON i.user_id = u.id
           LEFT JOIN students s ON s.user_id = u.id
           LEFT JOIN departments d
             ON d.id = COALESCE(u.department_id, i.department_id, s.department_id)
           WHERE u.id = ?
           LIMIT 1`,
          [req.user.id],
        );
        if (rows[0]) req.user = { ...req.user, ...rows[0] };
      } catch (lookupError) {
        console.error(
          "Authenticated user department lookup failed:",
          lookupError.message,
        );
        return res.status(503).json({
          success: false,
          message: "Authentication service is temporarily unavailable.",
        });
      }
    }
    return next();
  });
};

const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    const normalizeRole = (value) => {
      const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/g, "_");
      if (["department_head", "dept_head", "dept head"].includes(normalized))
        return "dept_head";
      if (["college_dean", "college dean"].includes(normalized))
        return "college_dean";
      if (
        [
          "academic_directorate",
          "academic directorate",
          "academic_director",
          "academic director",
        ].includes(normalized)
      )
        return "academic_directorate";
      if (["lab_assistant", "lab assistant"].includes(normalized))
        return "lab_assistant";
      return normalized;
    };
    const allowedRoles = roles.map(normalizeRole);
    const userRole = normalizeRole(req.user?.role || req.user?.user_role);
    if (!req.user || !allowedRoles.includes(userRole)) {
      return sendResponse(
        res,
        403,
        "You do not have permission to perform this action.",
        "ይህን እርምጃ ለማከናወን ፈቃድ የለህም።",
      );
    }
    next();
  };

const normalizeSectionValue = (value) => {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  const withoutPrefix = normalized.replace(/^section\s+/i, "").trim();
  return withoutPrefix.replace(/\s+/g, " ");
};

const normalizePublishTarget = (value) => {
  const normalized = String(value || "both")
    .trim()
    .toLowerCase();
  if (normalized === "students") return "student";
  if (normalized === "instructors") return "instructor";
  if (["student", "instructor", "both"].includes(normalized)) return normalized;
  return "both";
};

const initializeSchema = async () => {
  // Helper to check for column existence
  const columnExists = async (table, column) => {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return rows && rows[0] && rows[0].cnt > 0;
  };

  const ensureColumn = async (table, column, definition) => {
    if (!(await columnExists(table, column))) {
      await pool.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
      );
    }
  };

  const dropForeignKeysForColumn = async (table, column) => {
    const [rows] = await pool.query(
      `SELECT DISTINCT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [table, column],
    );
    for (const { CONSTRAINT_NAME: constraintName } of rows) {
      const escapedName = String(constraintName).replace(/`/g, "``");
      await pool.query(
        `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${escapedName}\``,
      );
    }
  };

  const normalizeUnsignedKey = async (table, column) => {
    try {
      const [rows] = await pool.query(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
      );

      if (
        rows &&
        rows[0] &&
        !String(rows[0].COLUMN_TYPE).toLowerCase().includes("unsigned")
      ) {
        await pool.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` INT UNSIGNED NOT NULL AUTO_INCREMENT`,
        );
      }
    } catch (error) {
      console.warn(
        `Could not normalize unsigned key for ${table}.${column}:`,
        error?.message || error,
      );
    }
  };

  await pool.query(`CREATE TABLE IF NOT EXISTS colleges (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(64) NOT NULL UNIQUE,
    description VARCHAR(1000) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  if (!(await columnExists("colleges", "description"))) {
    await pool.query(
      "ALTER TABLE colleges ADD COLUMN description VARCHAR(1000) DEFAULT NULL AFTER code",
    );
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    college_id INT UNSIGNED NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    department_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    CONSTRAINT fk_departments_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  if (!(await columnExists("departments", "college_id"))) {
    await pool.query(
      "ALTER TABLE departments ADD COLUMN college_id INT UNSIGNED NULL AFTER id",
    );
  }
  if (!(await columnExists("departments", "department_name"))) {
    await pool.query(
      "ALTER TABLE departments ADD COLUMN department_name VARCHAR(100) NULL AFTER college_id",
    );
  }
  if (!(await columnExists("departments", "department_code"))) {
    await pool.query(
      "ALTER TABLE departments ADD COLUMN department_code VARCHAR(20) NULL UNIQUE AFTER department_name",
    );
  }
  await pool.query(
    "UPDATE departments SET department_name = COALESCE(NULLIF(department_name, ''), name), department_code = COALESCE(NULLIF(department_code, ''), code) WHERE department_name IS NULL OR department_code IS NULL",
  );

  // Users table stores authentication and account metadata; role profiles store identity fields.
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','dept_head','instructor','student','lab_assistant','college_dean','academic_directorate','vice_president') NOT NULL DEFAULT 'student',
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
      reset_token VARCHAR(255) DEFAULT NULL,
      token_expires DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  if (!(await columnExists("users", "college_id"))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN college_id INT UNSIGNED NULL AFTER role",
    );
  }
  if (!(await columnExists("users", "department_id"))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN department_id INT UNSIGNED NULL AFTER college_id",
    );
  }
  await pool.query(
    `UPDATE users u
     INNER JOIN instructors i ON i.user_id = u.id
     SET u.department_id = i.department_id
     WHERE u.department_id IS NULL`,
  );
  await pool.query(
    `UPDATE users u
     INNER JOIN students s ON s.user_id = u.id
     SET u.department_id = s.department_id
     WHERE u.department_id IS NULL`,
  );
  await pool.query(
    `UPDATE users u
     INNER JOIN instructors i ON i.user_id = u.id
     INNER JOIN departments d ON d.id = i.department_id
     SET u.college_id = d.college_id
     WHERE u.college_id IS NULL`,
  );
  await pool.query(
    `UPDATE users u
     INNER JOIN students s ON s.user_id = u.id
     INNER JOIN departments d ON d.id = s.department_id
     SET u.college_id = d.college_id
     WHERE u.college_id IS NULL`,
  );

  if (!(await columnExists("users", "username"))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN username VARCHAR(255) NULL UNIQUE AFTER id",
    );
  }

  if (!(await columnExists("users", "is_first_login"))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN is_first_login BOOLEAN NOT NULL DEFAULT TRUE",
    );
  }
  if (!(await columnExists("users", "reset_token"))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL",
    );
  }
  if (!(await columnExists("users", "token_expires"))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN token_expires DATETIME NULL",
    );
  }
  if (!(await columnExists("users", "reset_otp"))) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN reset_otp VARCHAR(255) NULL",
    );
  }
  if (!(await columnExists("users", "otp_expiry"))) {
    await pool.query("ALTER TABLE users ADD COLUMN otp_expiry DATETIME NULL");
  }

  await pool.query(
    "ALTER TABLE users MODIFY COLUMN role ENUM('admin','dept_head','instructor','student','lab_assistant','college_dean','academic_directorate','vice_president') NOT NULL DEFAULT 'student'",
  );

  if (await columnExists("users", "student_id")) {
    await pool.query(
      "UPDATE users u LEFT JOIN students s ON s.user_id = u.id SET u.username = COALESCE(NULLIF(u.username, ''), NULLIF(s.student_id, ''), CONCAT('user_', u.id)) WHERE u.username IS NULL OR u.username = ''",
    );
  }
  await pool.query(
    "UPDATE users SET username = COALESCE(NULLIF(username, ''), CONCAT('user_', id)) WHERE username IS NULL OR username = ''",
  );
  await pool.query(
    "ALTER TABLE users MODIFY COLUMN username VARCHAR(255) NOT NULL",
  );
  for (const column of [
    "email",
    "student_id",
    "profile_picture",
    "phone_number",
    "gender",
  ]) {
    if (await columnExists("users", column)) {
      await dropForeignKeysForColumn("users", column);
      await pool.query(`ALTER TABLE users DROP COLUMN \`${column}\``);
    }
  }

  // Instructors table
  await pool.query(`CREATE TABLE IF NOT EXISTS instructors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    phone_number VARCHAR(10) DEFAULT NULL UNIQUE,
    first_name VARCHAR(128) DEFAULT NULL,
    last_name VARCHAR(128) DEFAULT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    gender VARCHAR(10) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_instructor_user (user_id),
    CONSTRAINT fk_instructors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_instructors_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    "instructors",
    "phone_number",
    "VARCHAR(10) DEFAULT NULL UNIQUE",
  );
  if (await columnExists("instructors", "employee_id")) {
    await pool.query(
      "UPDATE instructors SET phone_number = employee_id WHERE phone_number IS NULL AND employee_id REGEXP '^09[0-9]{8}$'",
    );
    await pool.query("ALTER TABLE instructors DROP COLUMN employee_id");
  }

  // Students table
  await pool.query(`CREATE TABLE IF NOT EXISTS students (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    student_id VARCHAR(64) DEFAULT NULL,
    first_name VARCHAR(128) DEFAULT NULL,
    last_name VARCHAR(128) DEFAULT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    year_level VARCHAR(64) DEFAULT NULL,
    section VARCHAR(64) DEFAULT NULL,
    gender VARCHAR(10) DEFAULT NULL,
    program_type VARCHAR(64) DEFAULT NULL,
    registration_date VARCHAR(64) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_student_user (user_id),
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    "students",
    "phone_number",
    "VARCHAR(10) DEFAULT NULL UNIQUE",
  );
  await ensureColumn(
    "students",
    "requires_profile_update",
    "TINYINT(1) NOT NULL DEFAULT 0",
  );

  // Courses
  await pool.query(`CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    credit_hours INT NOT NULL DEFAULT 3,
    year_level VARCHAR(32) DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    is_lab TINYINT(1) NOT NULL DEFAULT 0,
    section VARCHAR(32) DEFAULT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn("courses", "year_level", "VARCHAR(32) DEFAULT NULL");
  await ensureColumn("courses", "semester", "VARCHAR(32) DEFAULT NULL");
  await ensureColumn(
    "courses",
    "credit_hours",
    "INT NOT NULL DEFAULT 3",
  );
  await ensureColumn("courses", "is_lab", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("courses", "section", "VARCHAR(32) DEFAULT NULL");

  await pool.query(`CREATE TABLE IF NOT EXISTS lab_classes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id INT UNSIGNED NOT NULL UNIQUE,
    section VARCHAR(32) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(
    `INSERT INTO lab_classes (course_id, section)
     SELECT id, section FROM courses WHERE is_lab = 1
     ON DUPLICATE KEY UPDATE section = COALESCE(lab_classes.section, VALUES(section))`,
  );

  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action_title VARCHAR(255) NOT NULL,
    description TEXT,
    performed_by VARCHAR(255),
    ip_address VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_logs_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(128) PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contact_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_contact_messages_status (status),
    INDEX idx_contact_messages_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS lab_assignment_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id INT UNSIGNED NOT NULL,
    section_id INT UNSIGNED NOT NULL,
    year_level VARCHAR(64) NOT NULL,
    semester VARCHAR(64) NOT NULL,
    lab_assistant_id INT UNSIGNED NOT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_lab_assignment_evaluation (course_id, section_id, year_level, semester),
    CONSTRAINT fk_lab_assignment_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_lab_assignment_section FOREIGN KEY (section_id) REFERENCES course_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_lab_assignment_assistant FOREIGN KEY (lab_assistant_id) REFERENCES instructors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  if (!(await columnExists("contact_messages", "subject"))) {
    await pool.query(
      "ALTER TABLE contact_messages ADD COLUMN subject VARCHAR(255) NULL AFTER email",
    );
  }

  // Course assignments (connections between course, instructor, optional student)
  await pool.query(`CREATE TABLE IF NOT EXISTS course_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    instructor_id INT UNSIGNED DEFAULT NULL,
    student_id INT UNSIGNED DEFAULT NULL,
    program_type VARCHAR(32) DEFAULT NULL,
    year_level VARCHAR(32) DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    section VARCHAR(32) DEFAULT NULL,
    publish_target VARCHAR(32) DEFAULT 'both',
    is_published TINYINT(1) DEFAULT 0,
    is_student_published TINYINT(1) DEFAULT 0,
    is_peer_published TINYINT(1) DEFAULT 0,
    academic_year VARCHAR(32) DEFAULT '2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assign_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_assign_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL,
    CONSTRAINT fk_assign_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(
    "course_assignments",
    "student_id",
    "INT UNSIGNED DEFAULT NULL",
  );
  await ensureColumn(
    "course_assignments",
    "program_type",
    "VARCHAR(32) DEFAULT NULL",
  );
  await ensureColumn(
    "course_assignments",
    "year_level",
    "VARCHAR(32) DEFAULT NULL",
  );
  await ensureColumn(
    "course_assignments",
    "semester",
    "VARCHAR(32) DEFAULT NULL",
  );
  await ensureColumn(
    "course_assignments",
    "section",
    "VARCHAR(32) DEFAULT NULL",
  );
  await ensureColumn(
    "course_assignments",
    "publish_target",
    "VARCHAR(32) DEFAULT 'both'",
  );
  await ensureColumn(
    "course_assignments",
    "is_student_published",
    "TINYINT(1) DEFAULT 0",
  );
  await ensureColumn(
    "course_assignments",
    "is_peer_published",
    "TINYINT(1) DEFAULT 0",
  );
  await ensureColumn(
    "course_assignments",
    "academic_year",
    "VARCHAR(32) DEFAULT NULL",
  );
  await ensureColumn(
    "course_assignments",
    "cycle_id",
    "INT UNSIGNED DEFAULT NULL",
  );
  await ensureColumn(
    "course_assignments",
    "status",
    "VARCHAR(32) DEFAULT NULL",
  );

  // Evaluation templates
  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    template_data JSON NOT NULL,
    created_by INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluation_templates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_criteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluator_type ENUM('student', 'peer', 'dept_head', 'ara_student', 'ara_peer', 'ara_dept_head') NOT NULL,
    criterion_text VARCHAR(255) NOT NULL,
    criterion_text_am VARCHAR(255) DEFAULT NULL,
    category VARCHAR(100) DEFAULT 'General',
    weight INT DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(
    "evaluation_criteria",
    "criterion_text_am",
    "VARCHAR(255) DEFAULT NULL AFTER `criterion_text`",
  );
  await ensureColumn(
    "evaluation_criteria",
    "target_role",
    "VARCHAR(32) DEFAULT 'instructor' AFTER `evaluator_type`",
  );
  await pool.query(
    "UPDATE evaluation_criteria SET evaluator_type = 'dept_head' WHERE evaluator_type = 'dean'",
  );
  await pool.query(
    "ALTER TABLE evaluation_criteria MODIFY COLUMN evaluator_type ENUM('student', 'peer', 'dept_head', 'ara_student', 'ara_peer', 'ara_dept_head') NOT NULL",
  );
  await pool.query(
    "UPDATE evaluation_criteria SET target_role = CASE WHEN evaluator_type LIKE 'ara_%' THEN 'lab_assistant' ELSE 'instructor' END WHERE target_role IS NULL OR TRIM(target_role) = ''",
  );
  await pool.query(
    "ALTER TABLE evaluation_criteria MODIFY COLUMN target_role VARCHAR(32) NOT NULL DEFAULT 'instructor'",
  );
  await pool.query(
    "UPDATE evaluation_criteria SET target_role = CASE WHEN evaluator_type LIKE 'ara_%' THEN 'lab_assistant' ELSE 'instructor' END",
  );
  await pool.query(
    "DELETE duplicate_row FROM evaluation_criteria duplicate_row INNER JOIN evaluation_criteria retained_row ON duplicate_row.id > retained_row.id AND duplicate_row.evaluator_type = retained_row.evaluator_type AND duplicate_row.target_role = retained_row.target_role AND duplicate_row.criterion_text = retained_row.criterion_text",
  );
  await pool.query(
    "DELETE FROM evaluation_criteria WHERE evaluator_type = 'dept_head' AND target_role = 'instructor'",
  );
  for (const [category, criterionText] of standardInstructorCriteria) {
    await pool.query(
      `INSERT INTO evaluation_criteria (evaluator_type, target_role, criterion_text, category, weight, is_active)
       VALUES ('dept_head', 'instructor', ?, ?, 5, 1)`,
      [criterionText, category],
    );
  }
  const baselineCriteria = [
    [
      "student",
      "The instructor communicates clearly and supports learning.",
      "Teaching",
    ],
    [
      "peer",
      "The instructor demonstrates professional competence.",
      "Professional Competency",
    ],
  ];
  for (const [evaluatorType, criterionText, category] of baselineCriteria) {
    await pool.query(
      `INSERT INTO evaluation_criteria (evaluator_type, target_role, criterion_text, category, weight, is_active)
       SELECT ?, 'instructor', ?, ?, 5, 1
       WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = ? AND target_role = 'instructor')`,
      [evaluatorType, criterionText, category, evaluatorType],
    );
  }
  await pool.query(
    "UPDATE evaluation_criteria SET criterion_text_am = CONCAT('የግምገማ መስፈርት፦ ', criterion_text) WHERE criterion_text_am IS NULL OR TRIM(criterion_text_am) = ''",
  );
  await pool.query(
    "DELETE FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'The Lab Assistant provides helpful practical support during laboratory activities.'",
  );
  const araStudentCriteria = [
    [
      "Session Objectives",
      "Explains detailed session objectives and expected learning outcomes clearly.",
    ],
    [
      "Practical Preparation",
      "Prepares well for practical sessions and organizes required materials and equipment.",
    ],
    [
      "Student-Centered Support",
      "Uses student-centered approaches and encourages active participation.",
    ],
    [
      "Listening to Students",
      "Listens attentively to students' problems, questions, and learning needs.",
    ],
    [
      "Time Utilization",
      "Uses laboratory and instructional time appropriately.",
    ],
    [
      "Academic Problem Solving",
      "Solves or refers students' academic and practical problems on time.",
    ],
    [
      "Safety Guidance",
      "Explains and reinforces appropriate laboratory safety precautions.",
    ],
    [
      "Sample Analysis Assistance",
      "Assists students with sample preparation, analysis, and interpretation of results.",
    ],
    [
      "Instrument and Equipment Support",
      "Guides students in proper instrument operation and equipment handling.",
    ],
    [
      "Communication and Professionalism",
      "Communicates clearly and demonstrates respectful, reliable professional conduct.",
    ],
  ];
  for (const [category, criterionText] of araStudentCriteria) {
    await pool.query(
      `INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
       SELECT 'ara_student', ?, ?, 5, 1
       WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = ?)`,
      [criterionText, category, criterionText],
    );
  }
  await pool.query(
    "DELETE FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'The Lab Assistant collaborates effectively with instructors and academic staff.'",
  );
  const araPeerCriteria = [
    [
      "Subject Matter Knowledge",
      "Keeps knowledge of laboratory subject matter, methods, and procedures up to date.",
    ],
    [
      "Safety Precaution Reporting",
      "Follows safety precautions and promptly reports hazards, incidents, or unsafe conditions.",
    ],
    [
      "Sample Analysis Assistance",
      "Assists with sample preparation, analysis, handling, and accurate reporting of results.",
    ],
    [
      "Instrument Maintenance",
      "Supports proper instrument operation, routine maintenance, and calibration.",
    ],
    [
      "Equipment Handling",
      "Handles laboratory equipment, materials, and chemicals carefully and responsibly.",
    ],
    [
      "Time Utilization",
      "Uses laboratory time effectively and supports colleagues in completing activities on schedule.",
    ],
    [
      "Technical Cooperation",
      "Provides dependable technical assistance and collaborates effectively with colleagues.",
    ],
    [
      "Record Keeping",
      "Maintains complete and accurate laboratory records and documentation.",
    ],
    [
      "Communication",
      "Communicates laboratory information, instructions, and results clearly.",
    ],
    [
      "Professional Conduct",
      "Demonstrates reliability, teamwork, respect, and professional responsibility.",
    ],
  ];
  for (const [category, criterionText] of araPeerCriteria) {
    await pool.query(
      `INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
       SELECT 'ara_peer', ?, ?, 5, 1
       WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = ?)`,
      [criterionText, category, criterionText],
    );
  }
  await pool.query(
    "DELETE FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'The Lab Assistant fulfills assigned laboratory and departmental responsibilities.'",
  );
  const araDepartmentHeadCriteria = [
    [
      "Subject Matter Knowledge",
      "Demonstrates adequate knowledge of laboratory subject matter and procedures.",
    ],
    [
      "Safety Precautions",
      "Follows laboratory safety precautions and promotes safe working practices.",
    ],
    [
      "Sample Analysis",
      "Performs sample preparation, analysis, and handling accurately.",
    ],
    [
      "Instrument Operation",
      "Operates laboratory instruments correctly and responsibly.",
    ],
    [
      "Instrument Maintenance",
      "Performs or supports routine instrument maintenance and calibration.",
    ],
    [
      "Equipment Handling",
      "Handles laboratory equipment, materials, and chemicals with care.",
    ],
    [
      "Time Utilization",
      "Uses laboratory time efficiently and completes assigned activities on schedule.",
    ],
    [
      "Record Keeping",
      "Maintains accurate laboratory records, results, and documentation.",
    ],
    [
      "Technical Support",
      "Provides effective technical support to students, instructors, and researchers.",
    ],
    [
      "Professional Responsibility",
      "Demonstrates reliability, teamwork, communication, and professional conduct.",
    ],
  ];
  for (const [category, criterionText] of araDepartmentHeadCriteria) {
    await pool.query(
      `INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
       SELECT 'ara_dept_head', ?, ?, 5, 1
       WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = ?)`,
      [criterionText, category, criterionText],
    );
  }
  await pool.query(
    "UPDATE evaluation_criteria SET target_role = 'lab_assistant' WHERE evaluator_type LIKE 'ara_%'",
  );
  await pool.query(
    "DELETE duplicate_row FROM evaluation_criteria duplicate_row INNER JOIN evaluation_criteria retained_row ON duplicate_row.id > retained_row.id AND duplicate_row.evaluator_type = retained_row.evaluator_type AND duplicate_row.target_role = retained_row.target_role AND duplicate_row.criterion_text = retained_row.criterion_text",
  );
  const [criteriaIndexes] = await pool.query(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluation_criteria' AND INDEX_NAME = 'uk_evaluation_criteria_mapping' LIMIT 1",
  );
  if (!criteriaIndexes.length) {
    await pool.query(
      "ALTER TABLE evaluation_criteria ADD UNIQUE KEY uk_evaluation_criteria_mapping (evaluator_type, target_role, criterion_text)",
    );
  }

  // Evaluation dispatches
  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_dispatches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT DEFAULT NULL,
    student_id INT UNSIGNED DEFAULT NULL,
    student_identifier VARCHAR(255) DEFAULT NULL,
    course_id INT UNSIGNED DEFAULT NULL,
    assignment_id INT UNSIGNED DEFAULT NULL,
    course_code VARCHAR(64) DEFAULT NULL,
    course_name VARCHAR(255) DEFAULT NULL,
    academic_year VARCHAR(64) DEFAULT NULL,
    semester VARCHAR(64) DEFAULT NULL,
    year_level VARCHAR(64) DEFAULT NULL,
    student_group VARCHAR(255) DEFAULT NULL,
    student_identifier_text VARCHAR(255) DEFAULT NULL,
    created_by INT UNSIGNED DEFAULT NULL,
    payload JSON DEFAULT NULL,
    status ENUM('pending','submitted','closed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluation_dispatches_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE SET NULL,
    CONSTRAINT fk_evaluation_dispatches_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    CONSTRAINT fk_evaluation_dispatches_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_evaluation_dispatches_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await ensureColumn(
    "evaluation_dispatches",
    "assignment_id",
    "INT UNSIGNED DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "cycle_id",
    "INT UNSIGNED DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "course_code",
    "VARCHAR(64) DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "student_identifier_text",
    "VARCHAR(255) DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "academic_year",
    "VARCHAR(64) DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "department_id",
    "INT UNSIGNED DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "program_type",
    "VARCHAR(64) DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "semester",
    "VARCHAR(64) DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "year_level",
    "VARCHAR(64) DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_dispatches",
    "is_student_published",
    "TINYINT(1) DEFAULT 0",
  );
  await pool.query(`
    UPDATE evaluation_dispatches ed
    INNER JOIN course_assignments ca ON ca.id = ed.assignment_id
    SET ed.department_id = COALESCE(ed.department_id, ca.department_id),
        ed.academic_year = COALESCE(ed.academic_year, ca.academic_year),
        ed.program_type = COALESCE(ed.program_type, ca.program_type),
        ed.semester = COALESCE(ed.semester, ca.semester),
        ed.year_level = COALESCE(ed.year_level, ca.year_level),
        ed.is_student_published = CASE
          WHEN ed.student_group = 'student' AND ca.is_student_published = 1 THEN 1
          ELSE ed.is_student_published
        END
    WHERE ed.student_group = 'student'
  `);

  // Peer evaluations must exist before peer evaluation submissions reference them.
  await pool.query(`CREATE TABLE IF NOT EXISTS peer_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    evaluator_id INT UNSIGNED NOT NULL,
    evaluatee_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED DEFAULT NULL,
    deadline VARCHAR(64) DEFAULT '2026-08-17',
    status ENUM('pending', 'submitted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_evaluator_id (evaluator_id),
    INDEX idx_evaluatee_id (evaluatee_id),
    UNIQUE KEY uk_peer_eval (evaluator_id, evaluatee_id, course_id),
    CONSTRAINT fk_peer_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluations_evaluatee FOREIGN KEY (evaluatee_id) REFERENCES instructors(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluations_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    "peer_evaluations",
    "is_published",
    "BOOLEAN NOT NULL DEFAULT FALSE AFTER `status`",
  );
  await pool.query(
    `UPDATE peer_evaluations pe
     INNER JOIN course_assignments ca ON ca.course_id = pe.course_id
     SET pe.is_published = 1
     WHERE ca.is_peer_published = 1`,
  );
  await pool.query(
    `UPDATE peer_evaluations pe
     INNER JOIN instructors target ON target.id = pe.evaluatee_id
     SET pe.is_published = 1
     WHERE pe.course_id IS NULL
       AND EXISTS (
         SELECT 1 FROM course_assignments ca
         WHERE ca.department_id = target.department_id AND ca.is_peer_published = 1
       )`,
  );
  const [peerCourseColumns] = await pool.query(
    "SHOW COLUMNS FROM peer_evaluations LIKE 'course_id'",
  );
  if (!peerCourseColumns.length)
    await pool.query(
      "ALTER TABLE peer_evaluations ADD COLUMN course_id INT UNSIGNED DEFAULT NULL AFTER evaluatee_id",
    );

  // Student evaluation submissions
  await pool.query(`CREATE TABLE IF NOT EXISTS student_evaluation_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispatch_id INT NOT NULL,
    student_id INT UNSIGNED DEFAULT NULL,
    student_name VARCHAR(255) DEFAULT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    feedback TEXT DEFAULT NULL,
    responses JSON DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_student_evaluation_submissions_dispatch FOREIGN KEY (dispatch_id) REFERENCES evaluation_dispatches(id) ON DELETE CASCADE,
    CONSTRAINT fk_student_evaluation_submissions_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'reminder',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_read (user_id, is_read, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_resets_user (user_id, expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Peer evaluation submissions
  await pool.query(`CREATE TABLE IF NOT EXISTS peer_evaluation_submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    peer_evaluation_id INT UNSIGNED NOT NULL,
    evaluator_id INT UNSIGNED NOT NULL,
    evaluatee_id INT UNSIGNED DEFAULT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    strengths TEXT DEFAULT NULL,
    suggestions TEXT DEFAULT NULL,
    responses JSON DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_peer_evaluation_submissions_peer_eval FOREIGN KEY (peer_evaluation_id) REFERENCES peer_evaluations(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluation_submissions_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_peer_evaluation_submissions_evaluatee FOREIGN KEY (evaluatee_id) REFERENCES instructors(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Evaluations (link to course assignment and evaluator user)
  await pool.query(`CREATE TABLE IF NOT EXISTS evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT UNSIGNED NOT NULL,
    evaluator_id INT UNSIGNED NOT NULL,
    evaluator_role VARCHAR(32) NOT NULL DEFAULT 'student',
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    feedback TEXT DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluations_assignment FOREIGN KEY (assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS evaluation_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    student_average DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    peer_average DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    dept_head_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    has_student_evaluation BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    vice_president_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_evaluation_results_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
    CONSTRAINT fk_evaluation_results_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    UNIQUE KEY uk_evaluation_results_instructor (instructor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    "evaluation_results",
    "has_student_evaluation",
    "BOOLEAN NOT NULL DEFAULT FALSE AFTER `total_score`",
  );

  // Dept head evaluations (separate table to store dept head individual evaluations)
  await pool.query(`CREATE TABLE IF NOT EXISTS dept_head_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluator_id INT UNSIGNED NOT NULL,
    instructor_id INT UNSIGNED NOT NULL,
    department_id INT UNSIGNED DEFAULT NULL,
    criteria_scores JSON DEFAULT NULL,
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dept_head_eval_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_dept_head_eval_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
    CONSTRAINT fk_dept_head_eval_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    UNIQUE KEY uk_dept_head_eval_unique (evaluator_id, instructor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  if (!(await columnExists("dept_head_evaluations", "strengths"))) {
    await pool.query(
      "ALTER TABLE dept_head_evaluations ADD COLUMN strengths TEXT NULL AFTER criteria_scores",
    );
  }
  if (!(await columnExists("dept_head_evaluations", "weaknesses"))) {
    await pool.query(
      "ALTER TABLE dept_head_evaluations ADD COLUMN weaknesses TEXT NULL AFTER strengths",
    );
  }
  if (!(await columnExists("dept_head_evaluations", "general_comments"))) {
    await pool.query(
      "ALTER TABLE dept_head_evaluations ADD COLUMN general_comments TEXT NULL AFTER weaknesses",
    );
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS directorate_evaluations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    evaluator_id INT UNSIGNED NOT NULL,
    dean_id INT UNSIGNED NOT NULL,
    ratings JSON NOT NULL,
    strengths TEXT NULL,
    weaknesses TEXT NULL,
    total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    final_score DECIMAL(5,2) DEFAULT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_directorate_eval (evaluator_id, dean_id),
    CONSTRAINT fk_directorate_eval_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_directorate_eval_dean FOREIGN KEY (dean_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await ensureColumn(
    "directorate_evaluations",
    "final_score",
    "DECIMAL(5,2) DEFAULT NULL AFTER `total_score`",
  );
  await ensureColumn(
    "directorate_evaluations",
    "student_average",
    "DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER `final_score`",
  );
  await ensureColumn(
    "directorate_evaluations",
    "peer_average",
    "DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER `student_average`",
  );
  await ensureColumn(
    "directorate_evaluations",
    "is_teaching",
    "TINYINT(1) NOT NULL DEFAULT 0 AFTER `peer_average`",
  );

  const [adminRows] = await pool.query(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    ["admin.k@system.local"],
  );
  if (!adminRows.length) {
    const adminPasswordHash = await bcrypt.hash(
      getDefaultPasswordForRole("admin"),
      12,
    );
    await pool.query(
      "INSERT INTO users (username, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)",
      ["admin.k@system.local", adminPasswordHash, "admin", "active", true],
    );
  }
};

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return sendResponse(res, 200, "API is healthy.", "ኤፒአይ ጤናማ ነው።", {
      service: "ipes-api",
      database: "connected",
    });
  } catch (error) {
    return sendResponse(
      res,
      500,
      "API is running but the database is unavailable.",
      "ኤፒአይ እየሄደ ነው ነገር ግን ዳታቤዝ የለም።",
      { database: "disconnected" },
    );
  }
});

app.get(
  "/api/dept-head/courses",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const departmentValue =
        req.user.department_id ?? req.user.departmentId ?? req.user.department;
      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId) {
        return sendResponse(
          res,
          403,
          "Your department is not defined. Contact an administrator.",
          "የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።",
        );
      }

      const [departmentColumns] = await pool.query(
        `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'departments'
         AND COLUMN_NAME IN ('name', 'department_name')
       ORDER BY FIELD(COLUMN_NAME, 'name', 'department_name')
       LIMIT 1`,
      );

      const departmentNameColumn = departmentColumns.length
        ? departmentColumns[0].COLUMN_NAME === "department_name"
          ? "d.department_name"
          : "d.name"
        : "'N/A'";

      const [courseCreditColumns] = await pool.query(
        `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'courses'
         AND COLUMN_NAME IN ('credits', 'credit_hours')
       ORDER BY FIELD(COLUMN_NAME, 'credits', 'credit_hours')
       LIMIT 1`,
      );
      const creditsExpression = courseCreditColumns.length
        ? `COALESCE(c.${courseCreditColumns[0].COLUMN_NAME}, 0)`
        : "0";

      const [rows] = await pool.query(
        `SELECT
        c.id,
        c.code AS course_code,
        c.name AS course_name,
        ${creditsExpression} AS credits,
        c.year_level,
        c.semester,
        CASE WHEN lc.course_id IS NULL THEN 0 ELSE 1 END AS is_lab,
        lc.section AS section,
        c.department_id,
        ${departmentNameColumn} AS department_name
      FROM courses c
      LEFT JOIN lab_classes lc ON lc.course_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE c.department_id = ?
      ORDER BY c.code ASC`,
        [departmentId],
      );

      return sendResponse(
        res,
        200,
        "Department courses fetched successfully.",
        "የዲፓርትማንት ኮርሶች በትክክል ተመልሰዋል።",
        { courses: rows },
      );
    } catch (error) {
      console.error("Error fetching department courses:", error.message);
      return sendResponse(
        res,
        500,
        "Failed to fetch department courses.",
        "የዲፓርትማንት ኮርሶችን ማግኘት አልተቻለም።",
        { error: error.message },
      );
    }
  },
);

app.get(
  "/api/dept-head/tracking/students",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      const departmentId = Number(
        req.user.department_id ??
          req.user.department ??
          req.query.department_id,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return sendResponse(
          res,
          403,
          "Your department is not defined. Contact an administrator.",
          "የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።",
        );
      }
      const normalizeValue = (value) => (value || "").toString().trim();
      const normalizeFilter = (value, allValues) => {
        const normalized = normalizeValue(value);
        return !normalized || allValues.includes(normalized.toLowerCase())
          ? null
          : normalized;
      };
      const programType = normalizeFilter(
        req.query.program_type || req.query.program,
        ["all", "all programs"],
      );
      const yearLevel = normalizeFilter(
        req.query.year_level || req.query.year,
        ["all", "all years"],
      );
      const section = normalizeFilter(req.query.section, [
        "all",
        "all sections",
      ]);
      const instructorId = Number(req.query.instructor_id || 0) || null;
      const normalizedSection =
        section?.replace(/^section\s*/i, "").trim() || null;
      const query = `SELECT
      s.id AS student_db_id,
      u.id AS evaluator_id,
      s.phone_number,
      TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS student_name,
      CASE WHEN MAX(sub.id) IS NOT NULL THEN 'Submitted' ELSE 'Pending' END AS status
    FROM students s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN evaluation_dispatches ed ON ed.student_id = s.id AND ed.cycle_id = ?
    LEFT JOIN course_assignments ca ON ca.id = ed.assignment_id AND ca.cycle_id = ed.cycle_id
    LEFT JOIN student_evaluation_submissions sub
           ON sub.dispatch_id = ed.id
        AND (? IS NULL OR ca.instructor_id = ?
          OR JSON_UNQUOTE(JSON_EXTRACT(ed.payload, '$.lab_assistant_id')) = CAST(? AS CHAR))
    WHERE s.department_id = ?
      AND (? IS NULL OR s.program_type = ?)
      AND (? IS NULL OR s.year_level = ?)
      AND (? IS NULL OR REPLACE(LOWER(s.section), 'section ', '') = LOWER(?))
    GROUP BY s.id, u.id, s.first_name, s.last_name
    ORDER BY status DESC, student_name ASC`;
      const params = [
        activeCycle.id,
        instructorId,
        instructorId,
        instructorId,
        departmentId,
        programType,
        programType,
        yearLevel,
        yearLevel,
        normalizedSection,
        normalizedSection,
      ];

      console.log("[DEBUG] Executing Tracking Query:", query);
      console.log("[DEBUG] Query Parameters:", params);

      let rows = [];
      try {
        [rows] = await pool.query(query, params);
        console.log("[DEBUG] Tracking Query Result Count:", rows.length);
      } catch (queryError) {
        console.error("Dept Head Student Tracking DB Error:", queryError);
        return res.status(500).json({
          success: false,
          message: "Database query failed",
          error: queryError?.message || "Unknown database error",
        });
      }

      const normalized = rows.map((row) => ({
        student_db_id: row.student_db_id,
        evaluator_id: row.evaluator_id,
        student_name: row.student_name || "Unknown",
        phone_number: row.phone_number || null,
        status: String(row.status || "Submitted"),
      }));

      return sendResponse(
        res,
        200,
        "Student tracking retrieved.",
        "የተማሪ ተከታታይ መረጃ ተመለሰ።",
        normalized,
      );
    } catch (error) {
      console.error("Dept-head student tracking error:", error);
      return sendResponse(
        res,
        500,
        "Unable to retrieve student tracking.",
        "የተማሪ ተከታታይን ማግኘት አልቻለም።",
        [],
      );
    }
  },
);

app.get(
  "/api/dept-head/tracking/instructors",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      let departmentId = Number(
        req.user.department_id ??
          req.user.department ??
          req.query.department_id,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        const [[departmentRow]] = await pool.query(
          "SELECT COALESCE(u.department_id, i.department_id) AS department_id FROM users u LEFT JOIN instructors i ON i.user_id = u.id WHERE u.id = ? LIMIT 1",
          [req.user.id],
        );
        departmentId = Number(departmentRow?.department_id || 0);
      }
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return sendResponse(
          res,
          403,
          "Your department is not defined.",
          "የክፍልዎ መለያ አልተገኘም።",
        );
      }

      const normalizeFilter = (value, allValues) => {
        const normalized = String(value || "").trim();
        return !normalized || allValues.includes(normalized.toLowerCase())
          ? null
          : normalized;
      };
      const programType = normalizeFilter(
        req.query.program_type || req.query.program,
        ["all", "all programs"],
      );
      const yearLevel = normalizeFilter(
        req.query.year_level || req.query.year,
        ["all", "all years"],
      );
      const section = normalizeFilter(req.query.section, [
        "all",
        "all sections",
      ]);
      const semester = normalizeFilter(req.query.semester, [
        "all",
        "all semesters",
      ]);
      const academicYear = normalizeFilter(
        req.query.academic_year || req.query.academicYear,
        ["all", "all academic years"],
      );
      const yearAliases = yearLevel
        ? (() => {
            const match = yearLevel.match(/(?:year\s*)?([1-7])/i);
            if (!match) return [yearLevel];
            const number = match[1];
            const ordinal =
              ["1st", "2nd", "3rd"][Number(number) - 1] || `${number}th`;
            return [
              `${ordinal} year`,
              `year ${number}`,
              `${number} year`,
              number,
              `${number}th year`,
            ];
          })()
        : [];
      const sectionValue = section?.replace(/^section\s*/i, "").trim() || null;
      const where = [
        "ca.department_id = ?",
        "ca.cycle_id = ?",
        "LOWER(COALESCE(u.status, 'active')) = 'active'",
        "LOWER(COALESCE(ca.status, 'assigned')) NOT IN ('inactive', 'cancelled', 'deleted')",
      ];
      const queryParams = [departmentId, activeCycle.id];
      const addFilter = (column, values, transform = "LOWER(TRIM(??))") => {
        if (!values.length) return;
        const placeholders = values.map(() => "?").join(", ");
        where.push(`${transform.replace("??", column)} IN (${placeholders})`);
        queryParams.push(...values.map((value) => value.toLowerCase()));
      };
      addFilter("ca.program_type", programType ? [programType] : []);
      addFilter("ca.year_level", yearAliases);
      addFilter(
        "ca.section",
        sectionValue ? [sectionValue] : [],
        "LOWER(TRIM(REPLACE(LOWER(??), 'section ', '')))",
      );
      addFilter(
        "ca.semester",
        semester ? [semester.replace(/^semester\s*/i, "")] : [],
        "LOWER(TRIM(REPLACE(LOWER(??), 'semester ', '')))",
      );
      addFilter("ca.academic_year", academicYear ? [academicYear] : []);
      const query = `
      SELECT DISTINCT i.id AS instructor_id, i.user_id, i.phone_number,
        TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name,
        u.username, u.role
      FROM course_assignments ca
      INNER JOIN instructors i ON i.id = ca.instructor_id
      INNER JOIN users u ON u.id = i.user_id
      WHERE ${where.join(" AND ")}
      UNION
      SELECT DISTINCT i.id AS instructor_id, i.user_id, i.phone_number,
        TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name,
        u.username, u.role
      FROM instructors i
      INNER JOIN users u ON u.id = i.user_id
      WHERE i.department_id = ?
        AND LOWER(COALESCE(u.status, 'active')) = 'active'
        AND LOWER(TRIM(COALESCE(u.role, ''))) IN ('lab_assistant', 'ara', 'lab assistant', 'lab-assistant')
      ORDER BY instructor_name ASC`;
      queryParams.push(departmentId);
      const [rows] = await pool.query(query, queryParams);
      return sendResponse(
        res,
        200,
        "Tracking instructors retrieved.",
        "የክትትል አስተማሪዎች ተመልሰዋል።",
        rows,
      );
    } catch (error) {
      console.error("Tracking instructors query failed:", error);
      return sendResponse(
        res,
        500,
        "Unable to retrieve tracking instructors.",
        "የክትትል አስተማሪዎችን ማግኘት አልተቻለም።",
        [],
      );
    }
  },
);

app.post(
  "/api/evaluations/send-reminder",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const departmentId = Number(
        req.user.department_id ?? req.user.department ?? req.body.department_id,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0)
        return res
          .status(403)
          .json({ message: "Your department is not defined." });

      const { evaluator_id, evaluation_type, send_to_all_pending } =
        req.body || {};
      const recipients = new Map();
      const pendingEvaluationItems = [];
      const addRecipients = (rows, type) =>
        rows.forEach((row) => {
          if (type === "student") {
            pendingEvaluationItems.push({
              studentName: row.studentName || row.student_name,
            });
          }
          if (row.evaluator_id)
            recipients.set(`${type}:${row.evaluator_id}`, {
              ...row,
              evaluation_type: type,
            });
        });

      if (send_to_all_pending) {
        const [students] = await pool.query(
          `SELECT u.id AS evaluator_id, s.phone_number,
          COALESCE(NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''), u.username) AS name,
          COALESCE(NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''), u.username, 'Student') AS studentName,
          COALESCE(NULLIF(TRIM(CONCAT(i.first_name, ' ', i.last_name)), ''), target_user.username, 'Instructor') AS instructorName,
          COALESCE(NULLIF(ed.course_name, ''), NULLIF(c.name, ''), ed.course_code, c.code, 'Course') AS courseName
        FROM students s JOIN users u ON u.id = s.user_id JOIN evaluation_dispatches ed ON ed.student_id = s.id
        LEFT JOIN course_assignments ca ON (ca.id = ed.assignment_id OR (ca.student_id = ed.student_id AND ca.course_id = ed.course_id))
          AND ca.cycle_id = ed.cycle_id
        LEFT JOIN instructors i ON i.id = ca.instructor_id
        LEFT JOIN users target_user ON target_user.id = i.user_id
        LEFT JOIN courses c ON c.id = ed.course_id
        LEFT JOIN student_evaluation_submissions sub ON sub.dispatch_id = ed.id
        WHERE s.department_id = ? AND ed.cycle_id = ? AND ed.status = 'pending' AND sub.id IS NULL`,
          [departmentId, activeCycle.id],
        );
        const [peers] = await pool.query(
          `SELECT DISTINCT u.id AS evaluator_id, evaluator.phone_number, u.role,
        COALESCE(NULLIF(TRIM(CONCAT(evaluator.first_name, ' ', evaluator.last_name)), ''), u.username) AS name,
        'N/A' AS studentName,
        COALESCE(NULLIF(TRIM(CONCAT(target.first_name, ' ', target.last_name)), ''), target_user.username, 'Instructor') AS instructorName,
        COALESCE(c.name, c.code, 'Course') AS courseName
        FROM peer_evaluations pe JOIN users u ON u.id = pe.evaluator_id
        LEFT JOIN instructors evaluator ON evaluator.user_id = u.id
        JOIN instructors target ON target.id = pe.evaluatee_id
        JOIN users target_user ON target_user.id = target.user_id
        LEFT JOIN courses c ON c.id = pe.course_id
        LEFT JOIN peer_evaluation_submissions pes ON pes.peer_evaluation_id = pe.id
        WHERE target.department_id = ? AND pe.cycle_id = ?
          AND LOWER(TRIM(COALESCE(pe.status, 'pending'))) = 'pending' AND pes.id IS NULL
          AND LOWER(TRIM(COALESCE(u.role, ''))) IN ('instructor', 'college_dean', 'college dean', 'dean', 'academic_directorate', 'academic directorate', 'academic_director', 'academic director', 'directorate', 'dept_head', 'department_head', 'department head')`,
          [departmentId, activeCycle.id],
        );
        addRecipients(students, "student");
        addRecipients(peers, "peer");
      } else if (evaluator_id) {
        const userId = Number(evaluator_id);
        if (!Number.isInteger(userId) || userId <= 0)
          return res
            .status(400)
            .json({ message: "A valid evaluator_id is required." });
        const [rows] = await pool.query(
          `SELECT u.id AS evaluator_id, COALESCE(i.phone_number, s.phone_number) AS phone_number,
        COALESCE(NULLIF(TRIM(CONCAT(i.first_name, ' ', i.last_name)), ''), NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''), u.username) AS name
        FROM users u
        LEFT JOIN instructors i ON i.user_id = u.id
        LEFT JOIN students s ON s.user_id = u.id
        WHERE u.id = ? LIMIT 1`,
          [userId],
        );
        const normalizedType = String(evaluation_type || "").toLowerCase();
        let pendingRows = [];
        if (normalizedType === "student") {
          [pendingRows] = await pool.query(
            `SELECT u.id AS evaluator_id, s.phone_number,
            COALESCE(NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''), u.username) AS name,
            COALESCE(NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), ''), u.username, 'Student') AS studentName,
            COALESCE(NULLIF(TRIM(CONCAT(i.first_name, ' ', i.last_name)), ''), target_user.username, 'Instructor') AS instructorName,
            COALESCE(NULLIF(ed.course_name, ''), NULLIF(c.name, ''), ed.course_code, c.code, 'Course') AS courseName
           FROM students s JOIN users u ON u.id = s.user_id JOIN evaluation_dispatches ed ON ed.student_id = s.id
           LEFT JOIN course_assignments ca ON (ca.id = ed.assignment_id OR (ca.student_id = ed.student_id AND ca.course_id = ed.course_id))
             AND ca.cycle_id = ed.cycle_id
           LEFT JOIN instructors i ON i.id = ca.instructor_id
           LEFT JOIN users target_user ON target_user.id = i.user_id
           LEFT JOIN courses c ON c.id = ed.course_id
           LEFT JOIN student_evaluation_submissions sub ON sub.dispatch_id = ed.id
           WHERE u.id = ? AND s.department_id = ? AND ed.cycle_id = ? AND ed.status = 'pending' AND sub.id IS NULL`,
            [userId, departmentId, activeCycle.id],
          );
        } else if (normalizedType === "peer") {
          [pendingRows] = await pool.query(
            `SELECT DISTINCT u.id AS evaluator_id, evaluator.phone_number,
            COALESCE(NULLIF(TRIM(CONCAT(evaluator.first_name, ' ', evaluator.last_name)), ''), u.username) AS name,
            'N/A' AS studentName,
            COALESCE(NULLIF(TRIM(CONCAT(target.first_name, ' ', target.last_name)), ''), target_user.username, 'Instructor') AS instructorName,
            COALESCE(c.name, c.code, 'Course') AS courseName
           FROM peer_evaluations pe JOIN users u ON u.id = pe.evaluator_id
           LEFT JOIN instructors evaluator ON evaluator.user_id = u.id
           JOIN instructors target ON target.id = pe.evaluatee_id
           JOIN users target_user ON target_user.id = target.user_id
           LEFT JOIN courses c ON c.id = pe.course_id
           LEFT JOIN peer_evaluation_submissions pes ON pes.peer_evaluation_id = pe.id
           WHERE u.id = ? AND target.department_id = ? AND pe.cycle_id = ? AND pe.status = 'pending' AND pes.id IS NULL`,
            [userId, departmentId, activeCycle.id],
          );
        } else if (normalizedType === "dept_head") {
          [pendingRows] = await pool.query(
            `SELECT u.id AS evaluator_id, i.phone_number,
             COALESCE(NULLIF(TRIM(CONCAT(i.first_name, ' ', i.last_name)), ''), u.username) AS name
           FROM users u
           INNER JOIN instructors i ON i.user_id = u.id
           WHERE u.id = ? AND i.department_id = ?
             AND NOT EXISTS (
               SELECT 1 FROM dept_head_evaluations dhe
               WHERE (dhe.instructor_id = i.id OR dhe.instructor_id = i.user_id)
                 AND dhe.cycle_id = ?
                 AND LOWER(TRIM(COALESCE(dhe.status, 'pending'))) IN ('submitted', 'completed', 'approved')
             )`,
            [userId, departmentId, activeCycle.id],
          );
        }
        if (rows.length && pendingRows.length)
          addRecipients(pendingRows, normalizedType || "evaluation");
      } else {
        return res
          .status(400)
          .json({ message: "Provide evaluator_id or send_to_all_pending." });
      }

      if (!recipients.size) {
        return res.status(404).json({
          success: false,
          message: "No pending evaluators were found for reminder delivery.",
        });
      }

      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const smsMessage = `Reminder: You have a pending IEPS instructor/TA evaluation. Please log in and complete it before ${deadline}.`;
      let smsSent = 0;
      let smsFailed = 0;
      let notificationSent = 0;
      const failedRecipients = [];

      for (const recipient of recipients.values()) {
        const description = `Dear ${recipient.name || "Evaluator"}, Please complete your pending instructor evaluation before ${deadline}.`;
        await pool.query(
          "INSERT INTO audit_logs (action_title, description, performed_by) VALUES (?, ?, ?)",
          ["Evaluation reminder sent", description, req.user.id],
        );

        const notificationTitle = "Pending Evaluation Reminder / የግምገማ ማሳሰቢያ";
        const notificationMessage =
          "You have pending instructor performance evaluations. Please complete them. / የመማር ማስተማር ግምገማ ቅጽ አልሞሉምና እባክዎ ይሙሉ፡፡";

        const notificationPromise = pool.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
          [
            recipient.evaluator_id,
            notificationTitle,
            notificationMessage,
            "evaluation_reminder",
          ],
        );

        const smsPromise = sendSms({
          phoneNumber: recipient.phone_number,
          message: smsMessage,
        }).catch((smsError) => {
          console.error(
            "Evaluation reminder SMS failed; continuing with in-app notification:",
            {
              evaluator_id: recipient.evaluator_id,
              phone_number: recipient.phone_number || null,
              error: smsError.message,
            },
          );
          return {
            sent: false,
            skipped: true,
            reason: smsError.message || "sms_delivery_failed",
          };
        });

        const [notificationOutcome, smsOutcome] = await Promise.allSettled([
          notificationPromise,
          smsPromise,
        ]);
        if (notificationOutcome.status === "fulfilled") {
          notificationSent += 1;
        } else {
          console.error("Evaluation reminder dashboard notification failed:", {
            evaluator_id: recipient.evaluator_id,
            error:
              notificationOutcome.reason?.message || notificationOutcome.reason,
          });
        }

        const smsResult =
          smsOutcome.status === "fulfilled"
            ? smsOutcome.value
            : {
                sent: false,
                reason: smsOutcome.reason?.message || "sms_delivery_failed",
              };

        if (smsResult.sent) {
          smsSent += 1;
        } else {
          smsFailed += 1;
          failedRecipients.push({
            evaluator_id: recipient.evaluator_id,
            name: recipient.name || "Evaluator",
            phone_number: recipient.phone_number || null,
            reason: smsResult.reason || "sms_delivery_failed",
          });
        }
      }

      let telegramResult = { configured: false, sent: false };
      if (send_to_all_pending) {
        try {
          let departmentName = req.user.department_name || "";
          try {
            const [departmentRows] = await pool.query(
              `SELECT COALESCE(
                NULLIF(TRIM(department_name), ''),
                NULLIF(TRIM(name), '')
              ) AS department_name
               FROM departments
               WHERE id = ?
               LIMIT 1`,
              [departmentId],
            );
            departmentName =
              departmentRows[0]?.department_name || departmentName;
          } catch (departmentError) {
            console.error(
              "Unable to load department name for Telegram reminder:",
              {
                department_id: departmentId,
                error: departmentError.message,
              },
            );
          }
          const telegramResponse = await sendTelegramNotice(
            undefined,
            departmentName || departmentId,
            pendingEvaluationItems,
          );
          telegramResult = telegramResponse.skipped
            ? { configured: false, sent: false, skipped: true }
            : { configured: true, sent: true };
        } catch (telegramError) {
          telegramResult = {
            configured: !telegramError.message?.includes("missing in environment variables"),
            sent: false,
            error: telegramError.message || "Telegram delivery failed.",
          };
          console.error("Evaluation reminder Telegram delivery failed:", {
            department_id: departmentId,
            error: telegramResult.error,
          });
        }
      }

      return res.json({
        success: true,
        sent: recipients.size,
        smsSent,
        smsFailed,
        failedRecipients,
        notificationCount: notificationSent,
        telegram: telegramResult,
        message: `Reminders sent to ${recipients.size} pending evaluators; ${smsSent} SMS message(s) dispatched successfully.`,
      });
    } catch (error) {
      console.error("Send evaluation reminder failed:", error);
      return res.status(500).json({
        message: "Unable to send evaluation reminders.",
        error: error.message,
      });
    }
  },
);

app.get(
  "/api/dept-head/tracking/peers",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle)
        return sendResponse(res, 409, "There is no active evaluation cycle.");
      const departmentId = Number(
        req.user.department_id ??
          req.user.department ??
          req.query.department_id,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return sendResponse(
          res,
          403,
          "Your department is not defined. Contact an administrator.",
          "የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።",
        );
      }

      const targetInstructorId = Number(
        req.query.target_instructor_id || req.query.instructor_id || 0,
      );
      if (!targetInstructorId)
        return sendResponse(
          res,
          400,
          "target_instructor_id is required.",
          "የታለመ አስተማሪ መለያ ያስፈልጋል።",
          [],
        );

      const query = `SELECT
      pe.id AS peer_id,
      pe.evaluator_id,
      TRIM(CONCAT(COALESCE(evaluator.first_name, ''), ' ', COALESCE(evaluator.last_name, u.username))) AS peer_instructor,
      CASE WHEN MAX(pes.id) IS NOT NULL THEN 'Submitted' ELSE 'Pending' END AS status
    FROM peer_evaluations pe
    JOIN instructors target ON pe.evaluatee_id = target.id
    JOIN users u ON pe.evaluator_id = u.id
    LEFT JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
    LEFT JOIN peer_evaluation_submissions pes ON pes.peer_evaluation_id = pe.id
    WHERE target.department_id = ?
      AND pe.cycle_id = ?
      AND (target.id = ? OR target.user_id = ?)
      AND LOWER(TRIM(COALESCE(u.role, ''))) IN ('instructor', 'dept_head', 'college_dean', 'college dean', 'dean', 'academic_directorate', 'academic directorate', 'academic_director', 'academic director', 'directorate', 'department_head', 'department head')
    GROUP BY pe.id, pe.evaluator_id, evaluator.first_name, evaluator.last_name, u.username
    ORDER BY status DESC, peer_instructor ASC`;
      const params = [departmentId, activeCycle.id, targetInstructorId, targetInstructorId];

      let rows = [];
      try {
        [rows] = await pool.query(query, params);
      } catch (err) {
        console.error("Peer Tracking DB Error:", err);
        return res.status(500).json({
          success: false,
          message: "Database query failed",
          error: err.message,
        });
      }

      const normalized = rows.map((row) => ({
        peer_id: row.peer_id,
        evaluator_id: row.evaluator_id,
        peer_instructor: (row.peer_instructor || "").trim() || "Unknown Peer",
        status: String(row.status || "Pending"),
      }));

      return sendResponse(
        res,
        200,
        "Peer tracking retrieved.",
        "የእርስ ላይ ግምገማ ተከታታይ ተመለሰ።",
        normalized,
      );
    } catch (error) {
      console.error("Dept-head peer tracking error:", error);
      return sendResponse(
        res,
        500,
        "Unable to retrieve peer tracking.",
        "የእርስ ላይ ግምገማ ተከታታይን ማግኘት አልቻለም።",
        [],
      );
    }
  },
);

app.post(
  "/api/evaluations/peer/publish-department",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const activeCycle = await getActiveEvaluationCycle(connection);
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const departmentId = Number(
        req.user.department_id ?? req.user.department,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return res.status(403).json({
          message: "Your department is not defined. Contact an administrator.",
        });
      }

      const [[publishedAssignments]] = await connection.query(
        "SELECT COUNT(*) AS total FROM course_assignments WHERE department_id = ? AND cycle_id = ? AND is_peer_published = 1",
        [departmentId, activeCycle.id],
      );
      if (Number(publishedAssignments?.total || 0) > 0) {
        return res.status(400).json({
          success: false,
          isAlreadyPublished: true,
          message:
            "Peer evaluations have already been published for this department.",
        });
      }
      const [[existingSession]] = await connection.query(
        "SELECT COUNT(*) AS total FROM peer_evaluations pe INNER JOIN instructors target ON target.id = pe.evaluatee_id WHERE target.department_id = ? AND pe.course_id IS NULL AND pe.cycle_id = ?",
        [departmentId, activeCycle.id],
      );
      if (Number(existingSession?.total || 0) > 0) {
        return res.status(400).json({
          success: false,
          isAlreadyPublished: true,
          message:
            "Peer evaluations have already been published for this department.",
        });
      }
      const [evaluators] = await connection.query(
        `SELECT i.id AS instructor_id, i.user_id
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       WHERE i.department_id = ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
         AND LOWER(TRIM(COALESCE(u.role, ''))) IN ('instructor', 'dept_head', 'college_dean', 'college dean', 'dean', 'academic_directorate', 'academic directorate', 'academic_director', 'academic director', 'directorate', 'department_head', 'department head')`,
        [departmentId],
      );
      const [targets] = await connection.query(
        `SELECT i.id AS instructor_id, i.user_id
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       WHERE i.department_id = ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
        [departmentId],
      );
      if (evaluators.length < 2)
        return res.status(400).json({
          message: "At least two eligible academic staff are required.",
        });

      await connection.beginTransaction();
      await connection.query(
        "UPDATE course_assignments SET is_published = 1, is_student_published = 1 WHERE id = ?",
        [assignment.id],
      );
      await connection.query(
        `UPDATE course_assignments
       SET is_peer_published = 1,
           is_published = 1,
           publish_target = CASE WHEN is_student_published = 1 THEN 'both' ELSE 'instructor' END
       WHERE department_id = ? AND cycle_id = ?`,
        [departmentId, activeCycle.id],
      );
      let createdCount = 0;
      for (const evaluator of evaluators) {
        for (const target of targets) {
          if (evaluator.instructor_id === target.instructor_id) continue;
          const [existing] = await connection.query(
            "SELECT id FROM peer_evaluations WHERE evaluator_id = ? AND evaluatee_id = ? AND course_id IS NULL AND cycle_id = ? LIMIT 1",
            [evaluator.user_id, target.instructor_id, activeCycle.id],
          );
          if (existing.length) {
            await connection.query(
              "UPDATE peer_evaluations SET status = 'pending' WHERE id = ? AND status <> 'submitted'",
              [existing[0].id],
            );
          } else {
            await connection.query(
              "INSERT INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, cycle_id, deadline, status, is_published) VALUES (?, ?, NULL, ?, ?, 'pending', 1)",
              [evaluator.user_id, target.instructor_id, activeCycle.id, activeCycle.end_at],
            );
            createdCount += 1;
          }
        }
      }
      await connection.commit();
      return res.status(201).json({
        success: true,
        staffCount: targets.length,
        evaluatorCount: evaluators.length,
        createdCount,
        message: `Peer evaluations published for ${targets.length} academic staff members.`,
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Peer publish rollback failed:", rollbackError);
      }
      console.error("Department peer publishing failed:", error);
      return res.status(500).json({
        message: "Unable to publish department peer evaluations.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  },
);

app.post(
  "/api/evaluations/peer/unpublish-department",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const activeCycle = await getActiveEvaluationCycle(connection);
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const departmentId = Number(
        req.user.department_id ?? req.user.department,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0)
        return res.status(403).json({
          message: "Your department is not defined. Contact an administrator.",
        });

      const [submitted] = await connection.query(
        `SELECT pes.id FROM peer_evaluation_submissions pes
       INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
       INNER JOIN instructors target ON target.id = pe.evaluatee_id
       WHERE target.department_id = ? AND pe.course_id IS NULL AND pe.cycle_id = ? LIMIT 1`,
        [departmentId, activeCycle.id],
      );
      if (submitted.length)
        return res.status(400).json({
          success: false,
          message:
            "Cannot unpublish because peer evaluations have already been submitted.",
        });

      await connection.beginTransaction();
      await connection.query(
        `DELETE pe FROM peer_evaluations pe
       INNER JOIN instructors target ON target.id = pe.evaluatee_id
       WHERE target.department_id = ? AND pe.course_id IS NULL AND pe.cycle_id = ?`,
        [departmentId, activeCycle.id],
      );
      await connection.query(
        `UPDATE course_assignments
       SET is_peer_published = 0,
           is_published = IF(is_student_published = 1, 1, 0),
           publish_target = IF(is_student_published = 1, 'student', '')
       WHERE department_id = ? AND cycle_id = ?`,
        [departmentId, activeCycle.id],
      );
      await connection.commit();
      return res.json({
        success: true,
        message: "Peer evaluations unpublished successfully.",
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Peer unpublish rollback failed:", rollbackError);
      }
      return res.status(500).json({
        message: "Unable to unpublish peer evaluations.",
        error: error.message,
      });
    } finally {
      if (connection) connection.release();
    }
  },
);

app.get(
  "/api/dept-head/tracking/dept-head",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const departmentId = Number(
        req.user.department_id ??
          req.user.department ??
          req.query.department_id,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return sendResponse(
          res,
          403,
          "Your department is not defined. Contact an administrator.",
          "የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።",
        );
      }

      const instructorId = Number(req.query.instructor_id || 0);
      const whereClauses = ["i.department_id = ?"];
      const params = [activeCycle.id, departmentId];

      if (instructorId > 0) {
        whereClauses.push("(i.id = ? OR i.user_id = ?)");
        params.push(instructorId, instructorId);
      }

      const query = `SELECT
      i.id AS instructor_id,
      i.user_id,
      CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
      COALESCE(dhe.total_score, 0) AS score,
      COALESCE(dhe.status, 'Pending') AS status,
      dhe.updated_at AS submitted_at,
      dhe.id AS evaluation_id
    FROM instructors i
    LEFT JOIN dept_head_evaluations dhe ON (dhe.instructor_id = i.id OR dhe.instructor_id = i.user_id)
      AND dhe.cycle_id = ?
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY i.id, dhe.id
    ORDER BY i.id ASC, dhe.updated_at DESC`;

      const [rows] = await pool.query(query, params);
      const normalized = rows.map((row) => ({
        id: row.evaluation_id ?? row.instructor_id,
        instructor_id: row.instructor_id,
        user_id: row.user_id,
        instructor_name:
          (row.instructor_name || "").trim() || "Unknown Instructor",
        score: Number(row.score || 0),
        status: String(row.status || "Pending"),
        submitted_at: row.submitted_at || null,
      }));

      return sendResponse(
        res,
        200,
        "Dept head tracking retrieved.",
        "የዲፓርትመንት ኃላፊ ተከታታይ ተመለሰ።",
        normalized,
      );
    } catch (error) {
      console.error("Dept-head dept-head tracking error:", error);
      return sendResponse(
        res,
        500,
        "Unable to retrieve dept head tracking.",
        "የዲፓርትመንት ኃላፊ ተከታታይን ማግኘት አልቻለም።",
        [],
      );
    }
  },
);

// Fetch instructors for department head evaluation view
app.get(
  "/api/dept-head/instructors",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      let departmentId = Number(req.user.department_id || 0);
      if (departmentId <= 0) {
        const [[departmentRow]] = await pool.query(
          "SELECT COALESCE(u.department_id, i.department_id) AS department_id FROM users u LEFT JOIN instructors i ON i.user_id = u.id WHERE u.id = ? LIMIT 1",
          [req.user.id],
        );
        departmentId = Number(departmentRow?.department_id || 0);
      }
      if (!departmentId) {
        return sendResponse(
          res,
          403,
          "Your department is not defined. Contact an administrator.",
          "የክፍልዎ መለያ አልተገኘም።",
        );
      }

      const evaluationDeadline = await getDepartmentEvaluationDeadline(
        departmentId,
        activeCycle.end_at,
      );
      const evaluatorId = Number(req.user.id || req.user.user_id || 0);

      const query = `
      SELECT 
        i.id AS instructor_id,
        i.user_id,
        i.phone_number,
        i.department_id,
        d.name AS department_name,
        c.name AS college_name,
        TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name,
        u.username,
        u.role,
        CASE WHEN dhe.id IS NOT NULL THEN 'Submitted' ELSE 'Pending' END AS evaluation_status,
        dhe.total_score,
        dhe.criteria_scores,
        dhe.strengths,
        dhe.weaknesses,
        dhe.general_comments,
        COALESCE(MAX(ca.academic_year), CONCAT(YEAR(CURDATE()) - CASE WHEN MONTH(CURDATE()) > 9 OR (MONTH(CURDATE()) = 9 AND DAY(CURDATE()) >= 11) THEN 7 ELSE 8 END, ' E.C.')) AS academic_year,
        COALESCE(MAX(ca.semester), 'Semester II') AS semester,
        MAX(course.name) AS course_name,
        MAX(course.code) AS course_code
      FROM instructors i
      JOIN users u ON i.user_id = u.id
      JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      LEFT JOIN course_assignments ca ON ca.instructor_id = i.id AND ca.cycle_id = ?
      LEFT JOIN courses course ON course.id = ca.course_id
      LEFT JOIN dept_head_evaluations dhe ON dhe.instructor_id = i.id AND dhe.evaluator_id = ? AND dhe.cycle_id = ?
      WHERE i.department_id = ? 
        AND i.user_id <> ?
        AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'lab_assistant', 'ara')
        AND LOWER(COALESCE(u.status, 'active')) = 'active'
      GROUP BY i.id
    `;

      const [rows] = await pool.query(query, [
        activeCycle.id,
        evaluatorId,
        activeCycle.id,
        departmentId,
        evaluatorId,
      ]);

      const formattedData = rows.map((row) => ({
        id: row.instructor_id,
        instructor_id: row.instructor_id,
        instructor_name: (row.instructor_name || "").trim() || row.username,
        phone_number: row.phone_number,
        department_id: row.department_id,
        department_name: row.department_name || "",
        college_name: row.college_name || "",
        role: row.role,
        criteria_scores: row.criteria_scores || {},
        strengths: row.strengths || "",
        weaknesses: row.weaknesses || "",
        general_comments: row.general_comments || "",
        academic_year: activeCycle.academic_year,
        semester: activeCycle.semester,
        course_name: row.course_name || "",
        course_code: row.course_code || "",
        deadline: evaluationDeadline,
        evaluation_status: row.evaluation_status,
        total_score: row.total_score ? Number(row.total_score) : null,
      }));

      return sendResponse(
        res,
        200,
        "Department instructors fetched.",
        "የዲፓርትመንት አስተማሪዎች ተመልሰዋል።",
        formattedData,
      );
    } catch (err) {
      console.error("Dept Head Instructors DB Error:", err);
      return res.status(500).json({
        success: false,
        message: "Database query failed",
        error: err.message,
      });
    }
  },
);

const getDeptHeadPerformance = async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle)
      return sendResponse(res, 409, "There is no active evaluation cycle.");
    const [instructorRows] = await pool.query(
      "SELECT id, department_id FROM instructors WHERE user_id = ? LIMIT 1",
      [req.user.id],
    );
    if (!instructorRows.length)
      return res
        .status(404)
        .json({ message: "Department Head profile not found." });

    const instructorId = instructorRows[0].id;
    const [[assignmentCount]] = await pool.query(
      `SELECT COUNT(*) AS total FROM course_assignments
       WHERE instructor_id = ?
         AND cycle_id = ?
         AND (is_published = 1 OR is_student_published = 1 OR is_peer_published = 1)
         AND (semester IS NULL OR semester <> '')
         AND (academic_year IS NULL OR academic_year <> '')`,
      [instructorId, activeCycle.id],
    );
    const isTeaching = Number(assignmentCount?.total || 0) > 0;
    const [studentRows] = await pool.query(
      `SELECT ses.score, ses.feedback
       FROM student_evaluation_submissions ses
       INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
       INNER JOIN course_assignments ca ON ca.course_id = ed.course_id AND ca.instructor_id = ?
         AND ca.cycle_id = ed.cycle_id
         AND (ca.is_published = 1 OR ca.is_student_published = 1 OR ca.is_peer_published = 1)
       WHERE ca.instructor_id = ? AND ed.cycle_id = ? AND LOWER(ses.status) = 'submitted'`,
      [instructorId, instructorId, activeCycle.id],
    );
    const [peerRows] = await pool.query(
      `SELECT pes.score, pes.strengths, pes.suggestions
       FROM peer_evaluation_submissions pes
       INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
       INNER JOIN instructors target ON target.id = pe.evaluatee_id
       INNER JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
       WHERE pe.evaluatee_id = ? AND pe.cycle_id = ?
         AND evaluator.department_id = target.department_id
         AND pe.is_published = 1
         AND LOWER(pes.status) IN ('submitted', 'completed', 'approved')`,
      [instructorId, activeCycle.id],
    );
    const [deanRows] = await pool.query(
      `SELECT dhe.total_score AS score, dhe.criteria_scores, dhe.strengths,
        dhe.weaknesses, dhe.general_comments, dhe.updated_at
       FROM dept_head_evaluations dhe
       INNER JOIN users evaluator ON evaluator.id = dhe.evaluator_id
         AND LOWER(TRIM(evaluator.role)) IN ('college_dean', 'college dean', 'dean')
       WHERE dhe.instructor_id = ?
         AND dhe.cycle_id = ?
         AND LOWER(TRIM(dhe.status)) IN ('submitted', 'completed', 'approved')
       ORDER BY dhe.updated_at DESC`,
      [instructorId, activeCycle.id],
    );

    const average = (rows) =>
      rows.length
        ? rows.reduce((sum, row) => sum + Number(row.score || 0), 0) /
          rows.length
        : 0;
    const studentAvg = average(studentRows);
    const peerAvg = average(peerRows);
    const deanScore = average(deanRows);
    const totalScore = calculatePerformanceScore({
      isTeaching,
      studentScore: studentAvg,
      peerScore: peerAvg,
      supervisorScore: deanScore,
    }).totalScore;
    const strengths = [];
    const improvements = [];
    const feedbackBySource = {
      student: { strengths: [], weaknesses: [] },
      peer: { strengths: [], weaknesses: [] },
      deptHead: { strengths: [], weaknesses: [] },
      collegeDean: { strengths: [], weaknesses: [] },
      academicDirector: { strengths: [], weaknesses: [] },
    };
    const addFeedback = (list, value) => {
      const text = String(value || "").trim();
      if (text && !list.includes(text)) list.push(text);
    };
    studentRows.forEach((row) => {
      const target = Number(row.score || 0) >= 70 ? "strengths" : "weaknesses";
      addFeedback(
        target === "strengths" ? strengths : improvements,
        row.feedback,
      );
      addFeedback(feedbackBySource.student[target], row.feedback);
    });
    peerRows.forEach((row) => {
      addFeedback(strengths, row.strengths);
      addFeedback(improvements, row.suggestions);
      addFeedback(feedbackBySource.peer.strengths, row.strengths);
      addFeedback(feedbackBySource.peer.weaknesses, row.suggestions);
    });
    deanRows.forEach((row) => {
      const deanStrength = row.strengths;
      const deanWeakness = row.weaknesses;
      const generalComment = row.general_comments;
      addFeedback(strengths, deanStrength);
      addFeedback(improvements, deanWeakness);
      addFeedback(feedbackBySource.collegeDean.strengths, deanStrength);
      addFeedback(feedbackBySource.collegeDean.weaknesses, deanWeakness);
      addFeedback(feedbackBySource.collegeDean.strengths, generalComment);

      let criteriaData = row.criteria_scores;
      if (typeof criteriaData === "string") {
        try {
          criteriaData = JSON.parse(criteriaData);
        } catch {
          criteriaData = {};
        }
      }
      const criteriaComment = criteriaData?.remarks || criteriaData?.feedback;
      addFeedback(deanScore >= 70 ? strengths : improvements, criteriaComment);
      addFeedback(
        feedbackBySource.collegeDean[
          deanScore >= 70 ? "strengths" : "weaknesses"
        ],
        criteriaComment,
      );
    });

    return res.json({
      totalWeightedScore: Number(totalScore.toFixed(2)),
      isTeaching,
      sourceScores: {
        student: Number(studentAvg.toFixed(2)),
        peer: Number(peerAvg.toFixed(2)),
        collegeDean: deanScore,
        deptHead: 0,
        academicDirector: 0,
      },
      feedbackBySource,
      strengths,
      weaknesses: improvements,
    });
  } catch (error) {
    console.error("Department Head performance error:", error);
    return res.status(500).json({
      message: "Unable to load Department Head performance.",
      error: error.message,
    });
  }
};

app.get(
  "/api/dept-head/performance",
  authenticate,
  authorizeRoles("dept_head"),
  getDeptHeadPerformance,
);
app.get(
  "/api/dept-head/my-performance",
  authenticate,
  authorizeRoles("dept_head"),
  getDeptHeadPerformance,
);

app.get(
  "/api/dept-head/students",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const departmentValue =
        req.user.department_id ?? req.user.departmentId ?? req.user.department;
      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId) {
        return res.status(404).json({ message: "Department was not found." });
      }

      const yearLevel = String(req.query.year_level || "").trim();
      const programType = String(req.query.program_type || "").trim();
      const section = normalizeSectionValue(req.query.section);
      const filters = ["u.role = 'student'", "s.department_id = ?"];
      const params = [departmentId];

      if (yearLevel && yearLevel.toLowerCase() !== "all") {
        filters.push("LOWER(TRIM(s.year_level)) = LOWER(TRIM(?))");
        params.push(yearLevel);
      }
      if (programType && programType.toLowerCase() !== "all") {
        filters.push("LOWER(TRIM(s.program_type)) = LOWER(TRIM(?))");
        params.push(programType);
      }
      if (section && section.toLowerCase() !== "all") {
        filters.push(
          "LOWER(TRIM(REPLACE(REPLACE(s.section, 'Section ', ''), 'section ', ''))) = LOWER(?)",
        );
        params.push(section);
      }

      const [rows] = await pool.query(
        `SELECT
        s.student_id,
        TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS name,
        s.program_type,
        s.year_level,
        s.section,
        COALESCE(NULLIF(ups.phone_number, ''), NULLIF(s.phone_number, ''), '') AS phone_number,
        d.name AS department,
        s.department_id
      FROM users u
      INNER JOIN students s ON s.user_id = u.id
      LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
      INNER JOIN departments d ON d.id = s.department_id
      WHERE ${filters.join(" AND ")}
      ORDER BY name ASC`,
        params,
      );

      return res.json(rows);
    } catch (error) {
      console.error("Department head students query failed:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch department students." });
    }
  },
);

app.get(
  "/api/department-data/:type",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const { type } = req.params;
      if (!["instructors", "students", "courses"].includes(type)) {
        return res
          .status(400)
          .json({ message: "Unsupported department data type." });
      }

      const isDepartmentHead = ["dept_head", "department_head"].includes(
        String(req.user.role || "")
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_"),
      );
      const departmentValue = isDepartmentHead
        ? (req.user.department_id ??
          req.user.departmentId ??
          req.user.department)
        : (req.query.department ??
          req.query.department_id ??
          req.user.department_id ??
          req.user.departmentId ??
          req.user.department);
      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId)
        return res.status(404).json({ message: "Department was not found." });

      let query;
      if (type === "instructors") {
        query = `SELECT u.id, TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS name,
        u.username, u.role, i.phone_number, i.department_id
        FROM users u
        INNER JOIN instructors i ON i.user_id = u.id
        WHERE i.department_id = ? AND LOWER(COALESCE(u.status, 'active')) = 'active'
        ORDER BY name ASC`;
      } else if (type === "students") {
        query = `SELECT u.id, TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS name,
        u.username, u.role, s.student_id, s.department_id,
        s.program_type, s.year_level, s.section
        FROM users u
        INNER JOIN students s ON s.user_id = u.id
        WHERE u.role = 'student' AND s.department_id = ?
        ORDER BY name ASC`;
      } else {
        const [courseCreditColumns] = await pool.query(
          `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'courses'
           AND COLUMN_NAME IN ('credits', 'credit_hours')
         ORDER BY FIELD(COLUMN_NAME, 'credits', 'credit_hours')
         LIMIT 1`,
        );
        const creditsExpression = courseCreditColumns.length
          ? `${courseCreditColumns[0].COLUMN_NAME} AS credits`
          : "0 AS credits";
        query = `SELECT id, code, name, ${creditsExpression}, department_id
        FROM courses WHERE department_id = ? ORDER BY code ASC`;
      }

      const [rows] = await pool.query(query, [departmentId]);
      return res.json(rows);
    } catch (error) {
      console.error("Department data query failed:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch department data." });
    }
  },
);

// Submit or update a department head evaluation
app.post(
  ["/api/dept-head/evaluations", "/api/dept-head/submit-evaluation"],
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const {
        instructor_id,
        target_role,
        targetRole,
        criteria_scores,
        total_score,
        strengths,
        weaknesses,
        general_comments,
      } = req.body;
      const requestedTargetRole = target_role ?? targetRole;
      if (
        requestedTargetRole !== undefined &&
        !isAllowedDepartmentHeadTargetRole(requestedTargetRole)
      ) {
        return sendResponse(
          res,
          403,
          "Department Heads may only evaluate instructors and lab assistants.",
        );
      }
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      const feedbackValidation = validateEvaluationFeedback({
        Strengths: strengths,
        "Areas for Improvement": weaknesses,
        "General Comments": general_comments,
      });
      if (!feedbackValidation.valid) {
        return sendResponse(
          res,
          400,
          feedbackValidation.message,
          feedbackValidation.messageAm,
        );
      }
      const evaluatorId = Number(req.user.id || req.user.user_id || 0);
      const instrId = Number(instructor_id || 0);
      let deptId = Number(req.user.department_id || 0);
      if (deptId <= 0) {
        const [[departmentRow]] = await pool.query(
          "SELECT COALESCE(u.department_id, i.department_id) AS department_id FROM users u LEFT JOIN instructors i ON i.user_id = u.id WHERE u.id = ? LIMIT 1",
          [evaluatorId],
        );
        deptId = Number(departmentRow?.department_id || 0);
      }

      if (!evaluatorId || !instrId || !deptId) {
        return sendResponse(
          res,
          400,
          "Missing required fields.",
          "የሚያስፈልጉ መረጃዎች አልተሰጡም።",
        );
      }

      const [[target]] = await pool.query(
        `SELECT i.id, u.role AS target_role FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       WHERE i.id = ? AND i.department_id = ? AND i.user_id <> ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active' LIMIT 1`,
        [instrId, deptId, evaluatorId],
      );
      if (!target)
        return sendResponse(
          res,
          403,
          "You may only evaluate instructors and lab assistants in your department.",
        );
      if (!isAllowedDepartmentHeadTargetRole(target.target_role)) {
        return sendResponse(
          res,
          403,
          "Department Heads may only evaluate instructors and lab assistants.",
        );
      }

      // persist into dept_head_evaluations (upsert)
      const criteriaJson = criteria_scores
        ? JSON.stringify(criteria_scores)
        : null;
      await pool.query(
        `INSERT INTO dept_head_evaluations (evaluator_id, instructor_id, department_id, cycle_id, criteria_scores, strengths, weaknesses, general_comments, total_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')
       ON DUPLICATE KEY UPDATE criteria_scores = VALUES(criteria_scores), strengths = VALUES(strengths), weaknesses = VALUES(weaknesses), general_comments = VALUES(general_comments), total_score = VALUES(total_score), status = VALUES(status), updated_at = CURRENT_TIMESTAMP`,
        [
          evaluatorId,
          instrId,
          deptId,
          activeCycle.id,
          criteriaJson,
          strengths || null,
          weaknesses || null,
          general_comments || null,
          Number(total_score || 0),
        ],
      );

      // reflect in evaluation_results so tracking shows the dept_head_score
      await pool.query(
        `INSERT INTO evaluation_results (instructor_id, department_id, cycle_id, student_average, peer_average, dept_head_score, total_score)
       VALUES (?, ?, ?, 0, 0, ?, ?)
       ON DUPLICATE KEY UPDATE dept_head_score = VALUES(dept_head_score), total_score = VALUES(total_score), published_at = CURRENT_TIMESTAMP`,
        [instrId, deptId, activeCycle.id, Number(total_score || 0), Number(total_score || 0)],
      );

      return sendResponse(
        res,
        200,
        "Evaluation submitted successfully.",
        "ግምገማው በተሳካ ሁኔታ ተሳክቷል።",
        { success: true, total_score: Number(total_score || 0) },
      );
    } catch (error) {
      console.error("Submit dept-head evaluation error:", error);
      return sendResponse(
        res,
        500,
        "Unable to submit evaluation.",
        "ግምገማውን ማስተካከል አልቻለም።",
        { error: error.message },
      );
    }
  },
);

app.post(
  "/api/dept-head/calculate-publish",
  authenticate,
  authorizeRoles("dept_head"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      const departmentId = Number(
        req.user.department_id ?? req.user.department ?? req.body.department_id,
      );
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return sendResponse(
          res,
          403,
          "Your department is not defined. Contact an administrator.",
          "የክፍልዎ መለያ አልተገኘም። እባክዎ ከአስተዳደሩ ጋር ይገናኙ።",
        );
      }

      const [instructors] = await pool.query(
        `SELECT DISTINCT i.id
       , LOWER(TRIM(COALESCE(u.role, ''))) AS role
       , EXISTS (
           SELECT 1 FROM course_assignments teaching_ca
           WHERE teaching_ca.instructor_id = i.id
             AND teaching_ca.cycle_id = ?
         ) AS is_teaching
       FROM instructors i
       INNER JOIN users u ON u.id = i.user_id
       LEFT JOIN course_assignments ca ON ca.instructor_id = i.id AND ca.department_id = ? AND ca.cycle_id = ?
       WHERE (i.department_id = ? OR ca.id IS NOT NULL)
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       ORDER BY i.id ASC`,
        [activeCycle.id, departmentId, activeCycle.id, departmentId],
      );

      const results = [];
      for (const instructor of instructors) {
        const isLabAssistant = isLabAssistantRole(instructor.role);
        const [studentGroups] = isLabAssistant
          ? await pool.query(
              `SELECT AVG(ses.score) AS group_average
           FROM evaluation_dispatches ed
           INNER JOIN student_evaluation_submissions ses ON ses.dispatch_id = ed.id
           WHERE ed.student_group = 'lab_assistant'
             AND JSON_UNQUOTE(JSON_EXTRACT(ed.payload, '$.lab_assistant_id')) = CAST(? AS CHAR)
             AND ed.cycle_id = ?
             AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')
           GROUP BY ed.academic_year, ed.semester, ed.year_level`,
              [instructor.id, activeCycle.id],
            )
          : await pool.query(
              `SELECT AVG(ses.score) AS group_average
           FROM course_assignments ca
           LEFT JOIN evaluation_dispatches ed ON ed.assignment_id = ca.id
           LEFT JOIN student_evaluation_submissions ses ON ses.dispatch_id = ed.id
             AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')
           WHERE ca.instructor_id = ? AND ca.cycle_id = ?
           GROUP BY ca.id`,
              [instructor.id, activeCycle.id],
            );
        const scoredGroups = studentGroups.filter(
          (row) => row.group_average !== null,
        );
        const studentAverage = scoredGroups.length
          ? scoredGroups.reduce(
              (sum, row) => sum + Number(row.group_average || 0),
              0,
            ) / scoredGroups.length
          : 0;
        const hasStudentEvaluation = scoredGroups.length > 0;

        const [peerRows] = await pool.query(
          `SELECT AVG(pes.score) AS avg_score
         FROM peer_evaluation_submissions pes
         JOIN peer_evaluations pe ON pes.peer_evaluation_id = pe.id
         JOIN instructors target ON target.id = pe.evaluatee_id
         JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
         JOIN users evaluator_user ON evaluator_user.id = evaluator.user_id
         JOIN users target_user ON target_user.id = target.user_id
         LEFT JOIN departments evaluator_department
           ON evaluator_department.id = COALESCE(evaluator.department_id, evaluator_user.department_id)
         LEFT JOIN departments target_department
           ON target_department.id = COALESCE(target.department_id, target_user.department_id)
         WHERE pe.evaluatee_id = ? AND pe.cycle_id = ?
           AND (
             (
               LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_'))
                 IN ('lab_assistant', 'ara', 'labassistant')
               AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_user.role, '')), '-', '_'), ' ', '_'))
                 IN ('lab_assistant', 'ara', 'labassistant')
               AND COALESCE(evaluator_user.college_id, evaluator_department.college_id)
                 = COALESCE(target_user.college_id, target_department.college_id)
             )
             OR (
               LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_'))
                 NOT IN ('lab_assistant', 'ara', 'labassistant')
               AND evaluator.department_id = target.department_id
               AND pe.is_published = 1
             )
           )
           AND LOWER(COALESCE(pes.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
          [instructor.id, activeCycle.id],
        );
        const peerAverage = Number(peerRows[0]?.avg_score || 0);

        const [deptHeadRows] = await pool.query(
          `SELECT AVG(dhe.total_score) AS avg_score
         FROM dept_head_evaluations dhe
         WHERE dhe.instructor_id = ?
           AND dhe.cycle_id = ?
           AND LOWER(COALESCE(dhe.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
          [instructor.id, activeCycle.id],
        );
        const supervisorAverage = Number(deptHeadRows[0]?.avg_score || 0);
        const isTeaching = Boolean(instructor.is_teaching);
        const breakdown = calculatePerformanceScore({
          isTeaching,
          isLabAssistant,
          studentScore: studentAverage,
          peerScore: peerAverage,
          supervisorScore: supervisorAverage,
        });
        const totalScore = breakdown.totalScore;

        await pool.query(
          `INSERT INTO evaluation_results (instructor_id, department_id, cycle_id, student_average, peer_average, dept_head_score, total_score, has_student_evaluation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE student_average = VALUES(student_average), peer_average = VALUES(peer_average), dept_head_score = VALUES(dept_head_score), total_score = VALUES(total_score), has_student_evaluation = VALUES(has_student_evaluation), published_at = CURRENT_TIMESTAMP`,
          [
            instructor.id,
            departmentId,
            activeCycle.id,
            studentAverage,
            peerAverage,
            supervisorAverage,
            totalScore,
            hasStudentEvaluation,
          ],
        );

        results.push({
          instructor_id: instructor.id,
          student_average: Number(studentAverage.toFixed(2)),
          peer_average: Number(peerAverage.toFixed(2)),
          dept_head_score: Number(supervisorAverage.toFixed(2)),
          total_score: Number(totalScore.toFixed(2)),
          has_student_evaluation: hasStudentEvaluation,
          is_teaching: isTeaching,
        });
      }

      return sendResponse(
        res,
        200,
        "Final results calculated and published successfully.",
        "የመጨረሻ ውጤቶች ተሰብስበው ተለጠፉ።",
        { results },
      );
    } catch (error) {
      console.error("Calculate publish final results error:", error);
      return sendResponse(
        res,
        500,
        "Unable to calculate and publish results.",
        "ውጤቶችን ለማስተካከል እና ለማስታወቂያ አልቻለም።",
        { error: error.message },
      );
    }
  },
);

const getRequesterDepartmentId = async (req, connection = pool) => {
  const fromToken = Number(req.user?.department_id || 0);
  if (fromToken > 0) return fromToken;
  const [[row]] = await connection.query(
    "SELECT COALESCE(u.department_id, i.department_id) AS department_id FROM users u LEFT JOIN instructors i ON i.user_id = u.id WHERE u.id = ? LIMIT 1",
    [req.user.id],
  );
  return Number(row?.department_id || 0);
};

const getRequesterCollegeId = async (req, connection = pool) => {
  const fromToken = Number(req.user?.college_id || 0);
  if (fromToken > 0) return fromToken;
  const [[row]] = await connection.query(
    `SELECT COALESCE(u.college_id, d.college_id) AS college_id
     FROM users u
     LEFT JOIN instructors i ON i.user_id = u.id
     LEFT JOIN departments d ON d.id = i.department_id
     WHERE u.id = ? LIMIT 1`,
    [req.user.id],
  );
  return Number(row?.college_id || 0);
};

const finalResultQuery = `
  SELECT er.id AS result_id, er.instructor_id, er.department_id,
    i.phone_number, i.first_name, i.last_name, u.username, u.role,
    d.name AS department_name, c.name AS college_name, er.student_average, er.peer_average,
    er.dept_head_score, er.total_score, er.has_student_evaluation, er.published_at,
    COALESCE(NULLIF(learning_period.academic_year, ''), active_cycle.academic_year) AS academic_year,
    COALESCE(NULLIF(learning_period.semester, ''), active_cycle.semester) AS semester,
    (LOWER(TRIM(COALESCE(u.role, ''))) IN ('lab_assistant', 'ara', 'lab assistant', 'lab-assistant')
      OR EXISTS (SELECT 1 FROM course_assignments load_ca WHERE load_ca.instructor_id = er.instructor_id AND load_ca.cycle_id = er.cycle_id)) AS has_teaching_load,
    (SELECT COUNT(DISTINCT ed.id)
       FROM course_assignments student_ca
       INNER JOIN evaluation_dispatches ed
         ON ed.cycle_id = student_ca.cycle_id
        AND (
          ed.assignment_id = student_ca.id
          OR (
            ed.assignment_id IS NULL
            AND ed.department_id = student_ca.department_id
            AND (ed.course_id IS NULL OR ed.course_id = student_ca.course_id)
            AND ed.academic_year = student_ca.academic_year
            AND ed.semester = student_ca.semester
            AND ed.year_level = student_ca.year_level
            AND (ed.program_type IS NULL OR ed.program_type = student_ca.program_type)
            AND (ed.student_group IS NULL OR ed.student_group = student_ca.section)
          )
        )
       WHERE student_ca.instructor_id = er.instructor_id
         AND student_ca.cycle_id = er.cycle_id
         AND student_ca.is_student_published = 1) AS student_dispatch_count
    , (SELECT COUNT(DISTINCT ed.id)
       FROM course_assignments student_ca
       INNER JOIN evaluation_dispatches ed
         ON ed.cycle_id = student_ca.cycle_id
        AND (
          ed.assignment_id = student_ca.id
          OR (
            ed.assignment_id IS NULL
            AND ed.department_id = student_ca.department_id
            AND (ed.course_id IS NULL OR ed.course_id = student_ca.course_id)
            AND ed.academic_year = student_ca.academic_year
            AND ed.semester = student_ca.semester
            AND ed.year_level = student_ca.year_level
            AND (ed.program_type IS NULL OR ed.program_type = student_ca.program_type)
            AND (ed.student_group IS NULL OR ed.student_group = student_ca.section)
          )
        )
       INNER JOIN student_evaluation_submissions student_submission
         ON student_submission.dispatch_id = ed.id
        AND LOWER(COALESCE(student_submission.status, 'submitted')) IN ('submitted', 'completed', 'approved')
       WHERE student_ca.instructor_id = er.instructor_id
         AND student_ca.cycle_id = er.cycle_id
         AND student_ca.is_student_published = 1) AS student_submission_count
  FROM evaluation_results er
  INNER JOIN instructors i ON i.id = er.instructor_id
  INNER JOIN users u ON u.id = i.user_id
  LEFT JOIN departments d ON d.id = er.department_id
  LEFT JOIN colleges c ON c.id = d.college_id
  LEFT JOIN evaluation_cycles active_cycle ON active_cycle.id = er.cycle_id
  LEFT JOIN (
    SELECT ca.instructor_id, ca.cycle_id,
      GROUP_CONCAT(DISTINCT COALESCE(NULLIF(TRIM(ed.academic_year), ''), NULLIF(TRIM(ca.academic_year), ''))
        ORDER BY COALESCE(NULLIF(TRIM(ed.academic_year), ''), NULLIF(TRIM(ca.academic_year), '')) SEPARATOR ', ') AS academic_year,
      GROUP_CONCAT(DISTINCT COALESCE(NULLIF(TRIM(ed.semester), ''), NULLIF(TRIM(ca.semester), ''))
        ORDER BY COALESCE(NULLIF(TRIM(ed.semester), ''), NULLIF(TRIM(ca.semester), '')) SEPARATOR ', ') AS semester
    FROM course_assignments ca
    LEFT JOIN evaluation_dispatches ed
      ON ed.assignment_id = ca.id
      AND ed.cycle_id = ca.cycle_id
      AND ed.student_group = 'student'
    GROUP BY ca.instructor_id, ca.cycle_id
  ) learning_period
    ON learning_period.instructor_id = er.instructor_id
    AND learning_period.cycle_id = er.cycle_id
`;

app.get(
  "/api/results/final",
  authenticate,
  authorizeRoles("dept_head", "college_dean", "college dean", "dean", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const role = String(req.user?.role || "").toLowerCase();
      const isDepartmentHeadAudience =
        String(req.query.audience || "").toLowerCase() === "department_head";
      if (
        isDepartmentHeadAudience &&
        !["college_dean", "dean", "college dean"].includes(role)
      ) {
        return res.status(403).json({
          message:
            "Only College Deans can access Department Head final results.",
        });
      }
      let where = ["er.total_score IS NOT NULL", "er.cycle_id = ?"];
      const params = [activeCycle.id];
      if (isDepartmentHeadAudience) {
        where.push("LOWER(TRIM(u.role)) = 'dept_head'");
        const collegeId = await getRequesterCollegeId(req);
        if (!collegeId)
          return res
            .status(403)
            .json({ message: "Your college is not defined." });
        where.push("d.college_id = ?");
        params.push(collegeId);
      } else if (role === "dept_head") {
        const departmentId = await getRequesterDepartmentId(req);
        if (!Number.isInteger(departmentId) || departmentId <= 0)
          return res
            .status(403)
            .json({ message: "Your department is not defined." });
        where.push(
          "er.department_id = ?",
          "i.department_id = ?",
          "LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'lab_assistant', 'ara')",
        );
        params.push(departmentId, departmentId);
      } else if (
        role === "college_dean" ||
        role === "dean" ||
        role === "college dean"
      ) {
        const collegeId = await getRequesterCollegeId(req);
        if (!collegeId)
          return res
            .status(403)
            .json({ message: "Your college is not defined." });
        where.push("LOWER(u.role) = 'dept_head'", "d.college_id = ?");
        params.push(collegeId);
      }
      const [rows] = await pool.query(
        `${finalResultQuery} WHERE ${where.join(" AND ")} ORDER BY d.name, i.first_name, i.last_name`,
        params,
      );
      return res.json({
        success: true,
        results: rows.map((row) => ({
          resultId: row.result_id,
          instructorId: row.instructor_id,
          departmentId: row.department_id,
          instructorName:
            `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
            row.username,
          username: row.username,
          phoneNumber: row.phone_number,
          role: row.role,
          departmentName: row.department_name,
          collegeName: row.college_name,
          studentAverage: Number(row.student_average || 0),
          peerAverage: Number(row.peer_average || 0),
          deptHeadScore: Number(row.dept_head_score || 0),
          totalScore: Number(row.total_score || 0),
          hasTeachingLoad: Boolean(row.has_teaching_load),
          isTeaching: Boolean(row.has_teaching_load),
          is_teaching: Boolean(row.has_teaching_load),
          hasStudentEvaluation: Boolean(row.has_student_evaluation),
          studentDispatchCount: Number(row.student_dispatch_count || 0),
          studentSubmissionCount: Number(row.student_submission_count || 0),
          publishedAt: row.published_at,
          academicYear: row.academic_year || "",
          semester: row.semester || "",
        })),
      });
    } catch (error) {
      console.error("Final results query failed:", error);
      return res.status(500).json({ message: "Unable to load final results." });
    }
  },
);

app.get(
  "/api/results/final/:instructorId/certificate",
  authenticate,
  authorizeRoles("dept_head", "college_dean", "college dean", "dean", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const instructorId = Number(req.params.instructorId);
      const role = String(req.user?.role || "")
        .trim()
        .toLowerCase();
      const isDepartmentHeadAudience =
        String(req.query.audience || "").toLowerCase() === "department_head";
      if (
        isDepartmentHeadAudience &&
        !["college_dean", "dean", "college dean"].includes(role)
      ) {
        return res.status(403).json({
          message:
            "Only College Deans can access Department Head certificates.",
        });
      }
      let scope;
      let scopeParams;
      if (isDepartmentHeadAudience) {
        scope = `LOWER(TRIM(u.role)) = 'dept_head' AND d.college_id = ?`;
        scopeParams = [await getRequesterCollegeId(req)];
      } else if (role === "dept_head") {
        const departmentId = await getRequesterDepartmentId(req);
        if (!Number.isInteger(departmentId) || departmentId <= 0)
          return res
            .status(403)
            .json({ message: "Your department is not defined." });
        scope = `er.department_id = ?
          AND i.department_id = ?
          AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'lab_assistant', 'ara')`;
        scopeParams = [departmentId, departmentId];
      } else if (
        role === "college_dean" ||
        role === "dean" ||
        role === "college dean"
      ) {
        scope = `LOWER(u.role) = 'dept_head' AND d.college_id = ?`;
        scopeParams = [await getRequesterCollegeId(req)];
      } else {
        scope = "1 = 1";
        scopeParams = [];
      }
      const [rows] = await pool.query(
        `${finalResultQuery} WHERE er.instructor_id = ? AND er.cycle_id = ? AND er.total_score IS NOT NULL AND ${scope} LIMIT 1`,
        [instructorId, activeCycle.id, ...scopeParams],
      );
      if (!rows.length)
        return res
          .status(403)
          .json({ message: "You are not authorized to export this result." });
      const row = rows[0];
      return res.json({
        success: true,
        certificate: {
          resultId: row.result_id,
          instructorId: row.instructor_id,
          instructorName:
            `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
            row.username,
          username: row.username,
          phoneNumber: row.phone_number,
          role: row.role,
          departmentName: row.department_name,
          collegeName: row.college_name,
          studentAverage: Number(row.student_average || 0),
          peerAverage: Number(row.peer_average || 0),
          deptHeadScore: Number(row.dept_head_score || 0),
          totalScore: Number(row.total_score || 0),
          hasTeachingLoad: Boolean(row.has_teaching_load),
          isTeaching: Boolean(row.has_teaching_load),
          is_teaching: Boolean(row.has_teaching_load),
          hasStudentEvaluation: Boolean(row.has_student_evaluation),
          studentDispatchCount: Number(row.student_dispatch_count || 0),
          studentSubmissionCount: Number(row.student_submission_count || 0),
          publishedAt: row.published_at,
          academicYear: row.academic_year || "",
          semester: row.semester || "",
        },
      });
    } catch (error) {
      console.error("Final result certificate query failed:", error);
      return res
        .status(500)
        .json({ message: "Unable to load result certificate." });
    }
  },
);

// Public endpoint to fetch students with strict DB filtering
app.get("/api/students", authenticate, async (req, res) => {
  try {
    const {
      department_id,
      program_type = "All",
      year_level = "All",
      section = "All",
    } = req.query;

    // If the requester is a dept_head, restrict to their department
    let deptId = department_id;
    if (req.user && req.user.role === "dept_head") {
      deptId = req.user.department_id || req.user.department || deptId;
    }

    if (!deptId) {
      return sendResponse(
        res,
        400,
        "department_id is required.",
        "የክፍል መለያ ያስፈልጋል።",
      );
    }

    const query = `SELECT 
      s.id,
      s.student_id,
      CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS full_name,
      s.department_id,
      s.program_type,
      s.year_level,
      s.section
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.department_id = ?
      AND (? = 'All' OR s.program_type = ?)
      AND (? = 'All' OR s.year_level = ?)
      AND (? = 'All' OR s.section = ?)`;

    const params = [
      deptId,
      program_type,
      program_type,
      year_level,
      year_level,
      section,
      section,
    ];
    const [rows] = await pool.query(query, params);
    return sendResponse(res, 200, "Students retrieved.", "ተማሪዎች ተመልሰዋል።", rows);
  } catch (error) {
    console.error("Student list fetch error:", error?.message || error);
    return sendResponse(
      res,
      500,
      "Unable to fetch students.",
      "ተማሪዎችን ማግኘት አልተቻለም።",
      [],
    );
  }
});

app.post(
  "/api/auth/register",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin"),
  async (req, res) => {
    try {
      const {
        full_name,
        email,
        username,
        password,
        role = "student",
        department,
        department_id,
        department_name,
        phone_number,
        college,
        academic_year,
        semester,
        year,
        section,
        specialization,
        learning_level,
        student_id,
        program_type,
        gender,
        replace_existing = false,
      } = req.body;
      const normalizedPhoneNumber = normalizePhoneNumber(phone_number);

      const errors = {};
      if (!isValidName(full_name))
        errors.full_name = "full_name must be between 3 and 30 characters.";

      // Validation based on role
      if (role === "student") {
        if (!student_id || !String(student_id).trim())
          errors.student_id = "student_id is required for students.";
        if (!section || !String(section).trim())
          errors.section = "section is required for students.";
        if (!year || !String(year).trim())
          errors.year = "year is required for students.";
      } else {
        if (!username || !String(username).trim())
          errors.username = "username is required for staff roles.";
        if (
          ["instructor", "lab_assistant", "dept_head"].includes(role) &&
          !isValidPhoneNumber(normalizedPhoneNumber)
        )
          errors.phone_number =
            "phone_number must start with 09 or 07 and contain exactly 10 digits.";
      }

      if (Object.keys(errors).length) {
        return sendResponse(res, 400, "Validation failed.", "ማረጋገጫ አልተሳካም።", {
          errors,
        });
      }

      const normalizedStudentId =
        role === "student"
          ? typeof student_id === "string" && student_id.trim()
            ? student_id.trim()
            : null
          : null;
      const normalizedUsername = String(
        username || normalizedStudentId || "",
      ).trim();

      const resolvedDepartmentId = await resolveDepartmentId(
        department_id ?? department ?? department_name,
      );
      const [departmentRows] = resolvedDepartmentId
        ? await pool.query(
            "SELECT college_id FROM departments WHERE id = ? LIMIT 1",
            [resolvedDepartmentId],
          )
        : [[]];
      const inferredCollegeId = departmentRows[0]?.college_id || null;
      const resolvedDepartment =
        [department, department_name, department_id].find(
          (value) => typeof value === "string" && value.trim(),
        ) || null;
      const normalizedDepartment =
        typeof resolvedDepartment === "string" && resolvedDepartment.trim()
          ? resolvedDepartment.trim()
          : null;

      if (role === "dept_head") {
        if (!resolvedDepartmentId) {
          return res.status(400).json({
            message:
              "Please select a valid department before assigning a Department Head.",
          });
        }
        if (await hasActiveDepartmentHead(resolvedDepartmentId)) {
          return res.status(400).json({
            message:
              "This department already has an assigned Department Head. Please reassign or update the existing one.",
          });
        }
      }

      const passwordValue =
        typeof password === "string" && password.trim()
          ? password.trim()
          : getDefaultPasswordForRole(role);
      const hashedPassword = await bcrypt.hash(passwordValue, 12);

      const userFields = {
        full_name: String(full_name).trim(),
        username: normalizedUsername,
        password_hash: hashedPassword,
        role,
        department: normalizedDepartment,
        department_name:
          typeof department_name === "string" && department_name.trim()
            ? department_name.trim()
            : null,
        phone_number: normalizedPhoneNumber || null,
        college:
          typeof college === "string" && college.trim() ? college.trim() : null,
        academic_year:
          typeof academic_year === "string" && academic_year.trim()
            ? academic_year.trim()
            : null,
        semester:
          typeof semester === "string" && semester.trim()
            ? semester.trim()
            : null,
        year: typeof year === "string" && year.trim() ? year.trim() : null,
        section:
          typeof section === "string" && section.trim() ? section.trim() : null,
        specialization:
          typeof specialization === "string" && specialization.trim()
            ? specialization.trim()
            : null,
        learning_level:
          typeof learning_level === "string" && learning_level.trim()
            ? learning_level.trim()
            : null,
        program_type:
          typeof program_type === "string" && program_type.trim()
            ? program_type.trim()
            : null,
        gender:
          typeof gender === "string" && gender.trim() ? gender.trim() : null,
      };

      // Use transaction: insert into users then role-specific tables
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [existingUsername] = await conn.query(
          "SELECT id FROM users WHERE username = ? LIMIT 1",
          [normalizedUsername],
        );
        if (existingUsername.length) {
          await conn.rollback();
          return sendResponse(
            res,
            409,
            "Username already exists.",
            "የተጠቃሚ ስም አስቀድሞ አለ።",
          );
        }

        const [userResult] = await conn.query(
          "INSERT INTO users (username, password_hash, role, college_id, department_id, status, is_first_login) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            userFields.username,
            userFields.password_hash,
            userFields.role,
            inferredCollegeId,
            resolvedDepartmentId || null,
            "active",
            1,
          ],
        );
        const userId = userResult.insertId;

        // Insert into role-specific table
        if (userFields.role === "student") {
          await conn.query(
            "INSERT INTO students (user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              userId,
              userFields.student_id,
              userFields.full_name || null,
              null,
              resolvedDepartmentId || null,
              req.body.semester || null,
              req.body.year || null,
              req.body.section || null,
              userFields.program_type || null,
              userFields.gender || null,
            ],
          );
        } else if (
          userFields.role === "instructor" ||
          userFields.role === "dept_head"
        ) {
          await conn.query(
            "INSERT INTO instructors (user_id, phone_number, first_name, last_name, department_id, gender) VALUES (?, ?, ?, ?, ?, ?)",
            [
              userId,
              userFields.phone_number || null,
              userFields.full_name || null,
              null,
              resolvedDepartmentId || null,
              userFields.gender || null,
            ],
          );
        }

        await conn.commit();
        return sendResponse(
          res,
          201,
          "User registered successfully.",
          "ተጠቃሚ በተሳካ ሁኔታ ተመዝግቧል።",
          { id: userId, role: userFields.role },
        );
      } catch (sqlErr) {
        console.error("SQL Error:", sqlErr);
        try {
          await conn.rollback();
        } catch (e) {}
        return sendResponse(
          res,
          500,
          "Registration failed due to database error.",
          "መመዝገብ በዳታቤዝ ስህተት ምክንያት አልተሳካም።",
        );
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error("Registration failed:", {
        message: error.message,
        code: error.code,
        sql: error.sql,
        sqlMessage: error.sqlMessage,
        stack: error.stack,
        body: req.body,
      });
      if (error.code === "ER_DUP_ENTRY") {
        return sendResponse(
          res,
          409,
          "Department Head already exists for this department. Please update or reassign the existing Department Head.",
          "ይህ ዲፓርትመንት ለነበረው የዲፓርትመንት አስተዳዳሪ ነው። እባክዎ ነበረውን ይለውጡ ወይም አስተካክሉ።",
        );
      }

      return res.status(500).json({
        message: "Registration failed due to database error.",
        error: error.sqlMessage || error.message,
      });
    }
  },
);

const cleanCsvKey = (key) =>
  String(key || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_]/g, "");

const normalizeFieldName = (field) => cleanCsvKey(field);
const normalizeRow = (row) => {
  const normalized = {};
  const aliases = {
    studentid: "student_id",
    studentnumber: "student_number",
    phone: "phone_number",
    employeenumber: "employee_number",
    fullname: "full_name",
    firstname: "first_name",
    lastname: "last_name",
    departmentid: "department_id",
    departmentname: "department_name",
    registrationdate: "registration_date",
    enrollmentdate: "enrollment_date",
    programtype: "program_type",
    academicyear: "academic_year",
    username: "user_name",
  };
  Object.keys(row).forEach((key) => {
    const cleanKey = normalizeFieldName(key);
    const value = row[key] != null ? String(row[key]).trim() : "";
    const snakeKey = cleanKey
      .replace(/_+/g, "_")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase();
    normalized[cleanKey] = value;
    normalized[snakeKey] = value;
    if (aliases[cleanKey]) normalized[aliases[cleanKey]] = value;
  });
  return normalized;
};

const parseUploadRows = (fileBuffer, originalName) => {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", raw: false });
  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) return [];
  const sheet = workbook.Sheets[sheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows
    .map(normalizeRow)
    .filter((row) =>
      Object.values(row).some((value) => String(value).trim() !== ""),
    );
};

const resolveRoleFromType = (registration_type) => {
  const type = String(registration_type || "")
    .trim()
    .toLowerCase();
  if (type === "dept_head") return "dept_head";
  if (["lab_assistant", "ara", "lab assistant", "lab-assistant"].includes(type))
    return "lab_assistant";
  if (type === "instructor") return "instructor";
  return "student";
};

const resolveDepartmentId = async (value, db = pool) => {
  if (value == null) return null;
  const candidate = String(value).trim();
  if (!candidate) return null;

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

  const lowerCandidate = candidate.toLowerCase();
  const [rows] = await db.query(
    "SELECT id FROM departments WHERE LOWER(name) = ? OR LOWER(code) = ? LIMIT 1",
    [lowerCandidate, lowerCandidate],
  );

  return rows.length ? rows[0].id : null;
};
const notifyDepartmentHeadOfSubmission = async ({
  departmentId,
  courseId,
  assignmentId,
  submissionType,
  submitterName,
  courseName,
}) => {
  if (!departmentId && (courseId || assignmentId)) {
    const [[context]] = await pool.query(
      `SELECT COALESCE(ca.department_id, c.department_id) AS department_id
       FROM courses c LEFT JOIN course_assignments ca ON ca.id = ?
       WHERE c.id = ? LIMIT 1`,
      [assignmentId || 0, courseId || 0],
    );
    departmentId = context?.department_id;
  }
  if (!departmentId) return;
  const [heads] = await pool.query(
    `SELECT u.id FROM users u
     LEFT JOIN instructors i ON i.user_id = u.id
     WHERE u.role = 'dept_head' AND u.status != 'inactive'
       AND (u.department_id = ? OR i.department_id = ?)`,
    [departmentId, departmentId],
  );
  for (const head of heads) {
    await pool.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
      [
        head.id,
        "Evaluation submitted",
        `${submitterName || "A user"} submitted a ${submissionType} evaluation${courseName ? ` for ${courseName}` : ""}.`,
        "evaluation_submission",
      ],
    );
  }
};

const findConflictingAssignment = async (
  db,
  {
    departmentId,
    courseId,
    programType,
    yearLevel,
    semester,
    section,
    instructorId,
    cycleId,
  },
) => {
  if (!cycleId) return null;
  const [rows] = await db.query(
    `SELECT id, instructor_id FROM course_assignments
     WHERE department_id = ? AND course_id = ? AND LOWER(TRIM(COALESCE(program_type, ''))) = LOWER(TRIM(?))
       AND LOWER(TRIM(COALESCE(year_level, ''))) = LOWER(TRIM(?))
       AND LOWER(TRIM(COALESCE(semester, ''))) = LOWER(TRIM(?))
       AND LOWER(TRIM(COALESCE(section, ''))) = LOWER(TRIM(?)) AND cycle_id = ?
     LIMIT 1`,
    [departmentId, courseId, programType, yearLevel, semester, section, cycleId],
  );
  return rows.length && Number(rows[0].instructor_id) !== Number(instructorId)
    ? rows[0]
    : null;
};

const hasActiveDepartmentHead = async (departmentId, excludeUserId = null) => {
  if (!departmentId) return false;
  const query = `SELECT u.id FROM users u
    INNER JOIN instructors i ON u.id = i.user_id
    WHERE i.department_id = ? AND u.role = ? AND u.status != ?${excludeUserId ? " AND u.id != ?" : ""} LIMIT 1`;
  const params = [departmentId, "dept_head", "inactive"];
  if (excludeUserId) params.push(excludeUserId);
  const [rows] = await pool.query(query, params);
  return rows.length > 0;
};

const resolveDepartmentValue = (row) => {
  if (row.department_id) return row.department_id;
  if (row.department_name) return row.department_name;
  if (row.department) return row.department;
  return null;
};

app.post("/api/auth/bulk-register", upload.single("file"), async (req, res) => {
  let connection;
  try {
    if (!req.file) {
      return sendResponse(res, 400, "No file uploaded.", "ፋይል አልተላከም።");
    }

    const registrationType = resolveRoleFromType(req.body.registration_type);
    const replaceExisting =
      String(req.body.replace_existing || "false").toLowerCase() === "true";
    const rows = parseUploadRows(req.file.buffer, req.file.originalname);

    if (!rows.length) {
      return sendResponse(
        res,
        400,
        "Uploaded file contains no rows.",
        "አሸናፊ ፋይሉ ምንም ረድፎችን አልያዘም።",
      );
    }

    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      created_users: [],
      errors: [],
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;
      const role = resolveRoleFromType(row.role || registrationType);
      const full_name =
        row.full_name ||
        `${row.first_name || ""} ${row.last_name || ""}`.trim();
      const student_id = String(
        row.student_id || row.student_number || row.studentid || "",
      ).trim();
      const phone_number = normalizePhoneNumber(
        row.phone_number || row.phone || "",
      );
      const username = String(
        row.username || row.user_name || (role === "student" ? student_id : ""),
      ).trim();
      const department = resolveDepartmentValue(row);
      const resolvedDepartmentId = await resolveDepartmentId(
        department,
        connection,
      );
      const section = row.section || "";
      const year = row.year || "";
      const program_type = row.program_type || row.program || "regular";
      const department_name = row.department_name || "";
      const semester = row.semester || "";
      const academic_year = row.academic_year || "";
      const specialization = row.specialization || "";
      const learning_level = row.learning_level || "";

      // Determine identifier based on role
      const loginIdentifier = username;

      const rowErrors = [];
      if (!isValidName(full_name))
        rowErrors.push("full_name must be between 3 and 30 characters");
      if (!loginIdentifier) rowErrors.push("username is required");
      if (!resolvedDepartmentId) rowErrors.push("department is required");
      if (role === "student" && !student_id)
        rowErrors.push("student_id is required");
      if (role === "student" && !section) rowErrors.push("section is required");
      if (role === "student" && !year) rowErrors.push("year is required");
      if (role !== "student" && !isValidPhoneNumber(phone_number))
        rowErrors.push(
          "phone_number must start with 09 or 07 and contain exactly 10 digits",
        );

      if (rowErrors.length) {
        result.failed += 1;
        result.errors.push({ row: rowNumber, errors: rowErrors });
        continue;
      }

      // Check for existing user based on role
      let existingUserQuery, existingUserParams;
      if (role === "student") {
        existingUserQuery =
          "SELECT id, role FROM users WHERE username = ? LIMIT 1";
        existingUserParams = [username];
      } else {
        existingUserQuery =
          "SELECT id, role FROM users WHERE username = ? LIMIT 1";
        existingUserParams = [username];
      }

      const [existingUsers] = await connection.query(
        existingUserQuery,
        existingUserParams,
      );
      const existingUser = existingUsers[0];

      if (role === "dept_head" && resolvedDepartmentId) {
        const [existingDeptHead] = await connection.query(
          "SELECT u.id FROM users u INNER JOIN instructors i ON u.id = i.user_id WHERE i.department_id = ? AND u.role = ? AND u.status != ?" +
            (existingUser ? " AND u.id != ?" : " LIMIT 1"),
          existingUser
            ? [resolvedDepartmentId, "dept_head", "inactive", existingUser.id]
            : [resolvedDepartmentId, "dept_head", "inactive"],
        );
        if (existingDeptHead.length) {
          result.failed += 1;
          result.errors.push({
            row: rowNumber,
            errors: ["Department Head already exists for this department."],
          });
          continue;
        }
      }

      if (existingUser) {
        if (
          existingUser.role === "dept_head" &&
          role === "dept_head" &&
          replaceExisting
        ) {
          const password_hash = await bcrypt.hash(
            getDefaultPasswordForRole(role),
            12,
          );
          const updateFields =
            role === "student"
              ? {
                  username,
                  password_hash,
                }
              : {
                  username,
                  password_hash,
                };
          const updateClause = Object.keys(updateFields)
            .map((key) => `${key} = ?`)
            .join(", ");
          const updateValues = Object.values(updateFields);
          updateValues.push(existingUser.id);
          await connection.query(
            `UPDATE users SET ${updateClause} WHERE id = ?`,
            updateValues,
          );
          result.updated += 1;
          continue;
        }

        result.failed += 1;
        result.errors.push({
          row: rowNumber,
          errors: ["username already exists"],
        });
        continue;
      }

      const password_hash = await bcrypt.hash(
        getDefaultPasswordForRole(role),
        12,
      );
      const userFields = {
        username,
        password_hash,
        role,
      };

      const [insertResult] = await connection.query(
        `INSERT INTO users (username, password_hash, role, status, is_first_login)
         VALUES (?, ?, ?, 'active', 1)`,
        [userFields.username, userFields.password_hash, userFields.role],
      );

      const nameParts = full_name.split(/\s+/).filter(Boolean);
      const firstName = row.first_name || nameParts.shift() || "";
      const lastName = row.last_name || nameParts.join(" ");

      if (role === "student") {
        await connection.query(
          "INSERT INTO students (user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            insertResult.insertId,
            student_id,
            firstName,
            lastName,
            resolvedDepartmentId,
            semester || null,
            year || null,
            section || null,
            program_type || null,
          ],
        );
      } else {
        await connection.query(
          "INSERT INTO instructors (user_id, phone_number, first_name, last_name, department_id) VALUES (?, ?, ?, ?, ?)",
          [
            insertResult.insertId,
            phone_number,
            firstName,
            lastName,
            resolvedDepartmentId,
          ],
        );
      }

      result.created += 1;
      result.created_users.push({
        id: insertResult.insertId,
        ...userFields,
        full_name,
        first_name: firstName,
        last_name: lastName,
        department: department || resolvedDepartmentId,
        department_id: resolvedDepartmentId,
        department_name,
        phone_number,
        student_id,
        semester,
        year,
        section,
        program_type,
      });
    }

    await connection.commit();
    connection.release();
    return sendResponse(
      res,
      200,
      "Bulk registration completed.",
      "ብዛት ምዝገባ ተካሄዷል።",
      result,
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("Bulk registration failed:", {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack,
      file: req.file?.originalname,
      body: req.body,
    });
    return sendResponse(
      res,
      500,
      "Bulk registration failed.",
      "የብዛት ምዝገባ አልተሳካም።",
      {
        errors: [{ message: error.message }],
      },
    );
  }
});

app.post("/api/auth/change-password", mwAuthenticateToken, async (req, res) => {
  try {
    const userId = Number(
      req.user?.id ?? req.user?.userId ?? req.user?._id ?? 0,
    );
    const currentPassword =
      typeof req.body?.currentPassword === "string"
        ? req.body.currentPassword
        : typeof req.body?.current_password === "string"
          ? req.body.current_password
          : "";
    const newPassword =
      typeof req.body?.newPassword === "string"
        ? req.body.newPassword
        : typeof req.body?.new_password === "string"
          ? req.body.new_password
          : "";

    if (!userId) {
      console.error("SERVER CHANGE PASSWORD ERROR: Missing auth user id.", {
        userId: req.user?.id ?? null,
      });
      return res.status(401).json({
        success: false,
        message: "Authentication failed. Please log in again.",
      });
    }

    if (
      !currentPassword ||
      !String(currentPassword).trim() ||
      !newPassword ||
      !String(newPassword).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Both current and new passwords are required.",
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    if (String(newPassword).trim() === String(currentPassword).trim()) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password.",
      });
    }

    const [rows] = await pool.query(
      "SELECT id, username, password_hash, is_first_login, role FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const user = rows[0];
    const displayIdentifier = user.username;
    const storedPassword =
      typeof user.password_hash === "string" ? user.password_hash : "";
    const isBcryptHash =
      storedPassword.startsWith("$2a$") ||
      storedPassword.startsWith("$2b$") ||
      storedPassword.startsWith("$2y$");
    const currentPasswordMatches = isBcryptHash
      ? await bcrypt.compare(String(currentPassword).trim(), storedPassword)
      : storedPassword === String(currentPassword).trim();

    if (!currentPasswordMatches) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password_hash = ?, is_first_login = FALSE WHERE id = ?",
      [hashedPassword, userId],
    );

    const tokenPayload = {
      id: userId,
      username: displayIdentifier,
      role: req.user?.role || user.role || "student",
      isFirstLogin: false,
    };

    const refreshedToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "8h",
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      data: {
        token: refreshedToken,
        user: {
          id: userId,
          username: displayIdentifier,
          role: req.user?.role || user.role || "student",
          isFirstLogin: false,
        },
      },
    });
  } catch (error) {
    console.error("SERVER CHANGE PASSWORD ERROR:", {
      message: error?.message,
      stack: error?.stack,
      userId: req.user?.id ?? req.user?.userId ?? req.user?._id,
      body: req.body,
    });
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
});

app.get("/api/auth/me", authenticate, async (req, res) => {
  try {
    if (!req.user?.id) {
      console.error(
        "Error in /api/auth/me: missing authenticated user in request",
      );
      return res
        .status(401)
        .json({ message: "User not found or unauthenticated" });
    }

    const [rows] = await pool.query(
      `SELECT
        u.id,
        u.username,
        u.role,
        u.status,
        u.is_first_login,
        u.created_at,
        ups.email AS email,
        ups.full_name AS profile_full_name,
        ups.profile_picture AS profile_picture,
        COALESCE(i.first_name, s.first_name, '') AS first_name,
        COALESCE(i.last_name, s.last_name, '') AS last_name,
        COALESCE(i.gender, s.gender, NULL) AS gender,
        COALESCE(i.department_id, s.department_id, NULL) AS department_id,
        d.name AS department_name,
        c.name AS college_name,
        s.student_id AS student_id
      FROM users u
      LEFT JOIN user_profile_settings ups ON u.id = ups.user_id
      LEFT JOIN instructors i ON u.id = i.user_id
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id)
      LEFT JOIN colleges c ON c.id = d.college_id
      WHERE u.id = ? LIMIT 1`,
      [req.user.id],
    );

    if (!rows.length) {
      console.error(
        `Error in /api/auth/me: user not found for id=${req.user.id}`,
      );
      return res
        .status(401)
        .json({ message: "User not found or unauthenticated" });
    }

    const user = rows[0];
    const displayIdentifier = user.username;
    return res.status(200).json({
      success: true,
      message: { en: "User profile loaded.", am: "የተጠቃሚ መገለጫ ተጭኗል።" },
      data: {
        id: user.id,
        username: displayIdentifier,
        role: user.role,
        status: user.status,
        isFirstLogin: Boolean(user.is_first_login),
        gender: user.gender,
        created_at: user.created_at,
        department_id: user.department_id,
        department_name: user.department_name,
        college_name: user.college_name,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name:
          user.profile_full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.username,
        name:
          user.profile_full_name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          user.username,
        email: user.email || user.username,
        profile_picture: user.profile_picture || "",
        student_id: user.student_id,
      },
    });
  } catch (error) {
    console.error("Error in /api/auth/me:", error?.message || error);
    return res.status(503).json({
      success: false,
      message: "Authentication service is temporarily unavailable.",
    });
  }
});

// Register an instructor (creates user + instructor record) using a transaction (admin only)
app.post(
  "/api/auth/register-instructor",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin", "systemadmin", "dept_head"),
  async (req, res) => {
    let {
      first_name,
      last_name,
      department_id,
      department,
      department_name,
      email,
      username,
      phone_number,
      gender,
      password,
      full_name,
      name,
      role: requestedRole,
    } = req.body;
    const submittedPhoneNumber = String(phone_number ?? "");
    const role = resolveRoleFromType(requestedRole || "instructor");
    if (!["instructor", "lab_assistant"].includes(role))
      return res.status(400).json({
        message: "Only instructors and Lab Assistants can be registered here.",
      });

    const staffUsername = String(username || email || "").trim();
    const staffEmail = email || null;

    const nameToSplit = String(full_name || name || "").trim();
    if ((!first_name || !last_name) && nameToSplit) {
      const [firstName, ...lastNameParts] = nameToSplit
        .split(/\s+/)
        .filter(Boolean);
      first_name = first_name || firstName || "";
      last_name = last_name || lastNameParts.join(" ") || "";
    }

    if (
      !staffUsername ||
      !first_name ||
      !String(first_name).trim() ||
      !last_name ||
      !String(last_name).trim()
    ) {
      return sendResponse(
        res,
        400,
        "Missing required fields (username, first_name, last_name).",
        "የሚጠየቁ መረጃዎች አሉ።",
      );
    }

    const normalizedUsername = staffUsername;
    const normalizedEmail = staffEmail ? String(staffEmail).trim() : null;
    first_name = String(first_name).trim();
    last_name = String(last_name).trim();

    if (!isValidName(first_name) || !isValidName(last_name)) {
      return res.status(400).json({
        message:
          "first_name and last_name must each be between 3 and 30 characters.",
      });
    }
    if (!isValidRegistrationPhoneNumber(submittedPhoneNumber)) {
      return res.status(400).json({
        message:
          "Phone number must contain only numbers and be exactly 10 digits starting with 09 or 07.",
      });
    }
    phone_number = normalizePhoneNumber(submittedPhoneNumber);

    const resolvedDepartmentId = await resolveDepartmentId(
      department_id ?? department ?? department_name,
    );
    if (!resolvedDepartmentId) {
      return res.status(400).json({
        message: "Please select a valid department before registering.",
      });
    }

    if (
      String(req.user.role).toLowerCase() === "dept_head" &&
      Number(req.user.department_id) !== Number(resolvedDepartmentId)
    ) {
      return res.status(403).json({
        message:
          "Department Heads can only register Lab Assistants in their own department.",
      });
    }

    if (department_id || department || department_name) {
      console.debug("Instructor registration department resolution:", {
        department_id,
        department,
        department_name,
        resolvedDepartmentId,
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [exists] = await conn.query(
        "SELECT id FROM users WHERE username = ? LIMIT 1",
        [normalizedUsername],
      );
      if (exists.length) {
        await conn.rollback();
        return sendResponse(
          res,
          409,
          "Username already exists.",
          "የተጠቃሚ ስም አስቀድሞ አለ።",
        );
      }

      const passwordValue =
        typeof password === "string" && password.trim()
          ? password.trim()
          : getDefaultPasswordForRole(role);
      const hashed = await bcrypt.hash(String(passwordValue), 12);

      const [userResult] = await conn.query(
        "INSERT INTO users (username, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)",
        [normalizedUsername, hashed, role, "active", 1],
      );
      const userId = userResult.insertId;

      await conn.query(
        "INSERT INTO instructors (user_id, phone_number, first_name, last_name, department_id, gender) VALUES (?, ?, ?, ?, ?, ?)",
        [
          userId,
          String(phone_number).trim(),
          first_name,
          last_name,
          resolvedDepartmentId || null,
          gender || null,
        ],
      );

      await conn.commit();
      return sendResponse(
        res,
        201,
        "Instructor registered successfully.",
        "አስተማሪ በተሳካ ሁኔታ ተመዝግቧል።",
        { id: userId },
      );
    } catch (error) {
      console.error("Register instructor failed:", error);
      try {
        await conn.rollback();
      } catch (e) {}
      return res.status(500).json({
        message: "Registration failed due to database error.",
        error: error.sqlMessage || error.message,
      });
    } finally {
      conn.release();
    }
  },
);

// Register a student (creates user + student record) using a transaction (admin only)
app.post(
  "/api/auth/register-student",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin"),
  async (req, res) => {
    const {
      first_name,
      last_name,
      department_id,
      department,
      department_name,
      username,
      gender,
      semester,
      year_level,
      section,
      program_type,
      password,
    } = req.body;

    if (!username || !first_name || !last_name) {
      return sendResponse(
        res,
        400,
        "Missing required fields (username, first_name, last_name).",
        "የሚጠየቁ መረጃዎች አሉ።",
      );
    }

    const resolvedDepartmentId = await resolveDepartmentId(
      department_id ?? department ?? department_name,
    );
    if (!resolvedDepartmentId) {
      return res.status(400).json({
        message: "Please select a valid department before registering.",
      });
    }

    if (department_id || department || department_name) {
      console.debug("Student registration department resolution:", {
        department_id,
        department,
        department_name,
        resolvedDepartmentId,
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.query(
        "SELECT id FROM users WHERE username = ? LIMIT 1",
        [username],
      );
      if (existing.length) {
        await conn.rollback();
        return sendResponse(
          res,
          400,
          "Username already exists.",
          "የተጠቃሚ ስም አስቀድሞ አለ።",
        );
      }

      const passwordValue =
        typeof password === "string" && password.trim()
          ? password.trim()
          : getDefaultPasswordForRole("student");
      const hashedPassword = await bcrypt.hash(String(passwordValue), 12);

      const [userResult] = await conn.query(
        "INSERT INTO users (username, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)",
        [username, hashedPassword, "student", "active", 1],
      );
      const newUserId = userResult.insertId;

      await conn.query(
        "INSERT INTO students (user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          newUserId,
          username,
          first_name || null,
          last_name || null,
          resolvedDepartmentId || null,
          semester || null,
          year_level || null,
          section || null,
          program_type || null,
          gender || null,
        ],
      );

      await conn.commit();
      return sendResponse(
        res,
        201,
        "Student registered successfully.",
        "ተማሪ በተሳካ ሁኔታ ተመዝግቧል።",
        { id: newUserId },
      );
    } catch (error) {
      console.error("Registration Error:", error);
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
      return res.status(500).json({
        message: "Registration failed due to database error.",
        error: error.sqlMessage || error.message,
      });
    } finally {
      conn.release();
    }
  },
);

// Legacy alias for clients that still use /api/auth/departments.
app.post(
  "/api/auth/departments",
  mwAuthenticateToken,
  mwAuthorizeRoles("admin", "systemadmin"),
  createDepartment,
);

// List departments
app.get("/api/departments", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT d.id, d.college_id, d.department_name, d.department_code, d.name, d.code, c.name AS college_name FROM departments d LEFT JOIN colleges c ON c.id = d.college_id ORDER BY c.name ASC, d.name ASC",
    );
    return sendResponse(res, 200, "Departments loaded.", "ዲፓርትመንቶች ተጫኑ።", rows);
  } catch (error) {
    console.error("Fetch departments failed:", error?.message || error);
    return sendResponse(
      res,
      500,
      "Unable to load departments.",
      "ዲፓርትመንቶችን ማግኘት አልቻለም።",
    );
  }
});

const getDepartmentInstructors = async (req, res) => {
  try {
    const departmentId = Number(req.params.deptId);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res
        .status(400)
        .json({ message: "A valid department ID is required." });
    }

    const [rows] = await pool.query(
      `SELECT i.id AS instructor_id,
        u.id AS user_id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS full_name,
        u.username, u.status, u.role,
        i.department_id,
        d.name AS department_name,
        c.name AS college_name
       FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      WHERE i.department_id = ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       ORDER BY i.first_name ASC`,
      [departmentId],
    );
    return res.json(rows);
  } catch (error) {
    console.error("Department instructors query failed:", error);
    return res.status(500).json({
      message: "Unable to load department instructors.",
      error: error.message,
    });
  }
};

app.get(
  "/api/courses/department-instructors/:deptId",
  authenticate,
  authorizeRoles("admin", "dept_head", "college_dean"),
  getDepartmentInstructors,
);
app.get(
  "/api/instructors/department/:deptId",
  authenticate,
  authorizeRoles("admin", "dept_head", "college_dean"),
  getDepartmentInstructors,
);

app.get(
  "/api/courses/filter",
  authenticate,
  authorizeRoles("admin", "dept_head", "college_dean"),
  async (req, res) => {
    try {
      const departmentId = Number(req.query.deptId);
      const year = String(req.query.year || "").trim();
      const semester = String(req.query.semester || "").trim();
      if (!departmentId || !year || !semester)
        return res
          .status(400)
          .json({ message: "deptId, year, and semester are required." });
      const [rows] = await pool.query(
        `SELECT c.id, c.code, c.name, c.department_id, c.year_level, c.semester,
                c.credit_hours, CASE WHEN lc.course_id IS NULL THEN 0 ELSE 1 END AS is_lab,
                lc.section AS section
         FROM courses c LEFT JOIN lab_classes lc ON lc.course_id = c.id
         WHERE c.department_id = ? AND (c.year_level = ? OR c.year_level IS NULL OR c.year_level = '')
           AND (c.semester = ? OR c.semester IS NULL OR c.semester = '')
         ORDER BY c.code ASC`,
        [departmentId, year, semester],
      );
      return res.json(rows);
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Unable to filter courses.", error: error.message });
    }
  },
);

const getCoursesByFilters = async (req, res) => {
  try {
    const departmentId = Number(req.query.deptId);
    const requestedYear = String(
      req.query.year_level || req.query.year || "",
    ).trim();
    const requestedSemester = String(req.query.semester || "").trim();
    const yearNum = requestedYear.match(/\d+/)?.[0] || requestedYear;
    const dbYear = /^year\s+\d+$/i.test(requestedYear)
      ? requestedYear
      : `Year ${yearNum}`;
    const semesterValue = requestedSemester.replace(/^semester\s+/i, "").trim();
    const semesterRoman =
      { 1: "I", 2: "II", 3: "III", 4: "IV" }[semesterValue] || semesterValue;
    const dbSemester = `Semester ${semesterRoman}`;
    if (!departmentId || !requestedYear || !requestedSemester)
      return res
        .status(400)
        .json({ message: "deptId, year, and semester are required." });
    const [rows] = await pool.query(
      `SELECT c.id, c.code, c.name, c.code AS course_code, c.name AS course_title,
              c.department_id, c.year_level, c.semester,
              CASE WHEN lc.course_id IS NULL THEN 0 ELSE 1 END AS is_lab,
              lc.section AS section
       FROM courses c LEFT JOIN lab_classes lc ON lc.course_id = c.id
       WHERE c.department_id = ?
         AND (c.year_level = ? OR c.year_level LIKE ?)
         AND (c.semester = ? OR c.semester LIKE ?)
       ORDER BY c.code ASC`,
      [departmentId, dbYear, `%${dbYear}%`, dbSemester, `%${dbSemester}%`],
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      message: "Unable to load courses by year and semester.",
      error: error.message,
    });
  }
};

app.get(
  "/api/courses/by-filters",
  authenticate,
  authorizeRoles("admin", "dept_head", "college_dean"),
  getCoursesByFilters,
);
app.get(
  "/api/courses/by-year-semester",
  authenticate,
  authorizeRoles("admin", "dept_head", "college_dean"),
  getCoursesByFilters,
);

// Create a course
app.post("/api/auth/courses", async (req, res) => {
  const code = req.body.course_code || req.body.code;
  const name = req.body.course_name || req.body.name;
  const departmentId = req.body.department_id ?? req.body.departmentId ?? null;
  if (!code || !name)
    return sendResponse(
      res,
      400,
      "code and name are required",
      "code እና name ያስፈልጋሉ",
    );
  try {
    const [result] = await pool.query(
      "INSERT INTO courses (code, name, department_id) VALUES (?, ?, ?)",
      [code, name, departmentId || null],
    );
    return sendResponse(res, 201, "Course created.", "ኮርስ ተፈጥሯል።", {
      id: result.insertId,
      code,
      name,
      department_id: departmentId,
    });
  } catch (error) {
    console.error("Create course failed:", error?.message || error);
    return sendResponse(
      res,
      500,
      "Unable to create course.",
      "ኮርስን ማፍጠር አልቻለም።",
    );
  }
});

app.get("/api/course-assignments", authenticate, async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return sendResponse(res, 200, "No active evaluation cycle.", "ምንም ንቁ የግምገማ ዙር የለም።", []);
    }
    const params = [];
    let query = `SELECT ca.id, ca.course_id, c.code AS course_code, c.name AS course_name, ca.department_id, ca.instructor_id, ca.student_id, ca.program_type, ca.year_level, ca.semester, ca.section, ca.publish_target, ca.is_published, ca.is_student_published, ca.is_peer_published, ca.academic_year, ca.status, ca.created_at,
      CONCAT(COALESCE(i_instructor.first_name, ''), ' ', COALESCE(i_instructor.last_name, '')) AS instructor_name,
      CONCAT(COALESCE(s_student.first_name, ''), ' ', COALESCE(s_student.last_name, '')) AS student_name
      FROM course_assignments ca
      LEFT JOIN courses c ON ca.course_id = c.id
      LEFT JOIN instructors i_instructor ON ca.instructor_id = i_instructor.id
      LEFT JOIN students s_student ON ca.student_id = s_student.id`;

    query += " WHERE ca.cycle_id = ?";
    params.push(activeCycle.id);
    if (req.user && req.user.role === "dept_head") {
      query += " AND ca.department_id = ?";
      params.push(req.user.department_id || null);
    }

    query += " ORDER BY ca.created_at DESC";
    const [rows] = await pool.query(query, params);
    return sendResponse(
      res,
      200,
      "Course assignments retrieved.",
      "የኮርስ ስራዎች ተመልሰዋል።",
      rows,
    );
  } catch (error) {
    console.error("Course assignments fetch error:", error?.message || error);
    return sendResponse(
      res,
      200,
      "Course assignments unavailable; returning empty list.",
      "ስራዎች አልተገኙም; ባዶ ዝርዝር ተመልሷል።",
      [],
    );
  }
});

app.post(
  "/api/courses/batch-assign",
  authenticate,
  authorizeRoles("dept_head", "admin", "college_dean"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const {
        instructorId,
        courseIds,
        yearLevel,
        semester,
        section,
        programType,
      } = req.body;
      const ids = Array.isArray(courseIds)
        ? [
            ...new Set(
              courseIds
                .map(Number)
                .filter((id) => Number.isInteger(id) && id > 0),
            ),
          ]
        : [];
      const callerDepartmentId = Number(
        req.user.department_id || req.body.departmentId || 0,
      );
      if (
        !instructorId ||
        !ids.length ||
        !yearLevel ||
        !semester ||
        !section ||
        !programType ||
        !callerDepartmentId
      ) {
        return res.status(400).json({
          message:
            "instructorId, courseIds, yearLevel, semester, section, and programType are required.",
        });
      }
      const activeCycle = await getActiveEvaluationCycle(connection);
      if (!activeCycle) {
        return res.status(409).json({ message: "There is no active evaluation cycle." });
      }

      const [instructorRows] = await connection.query(
        `SELECT i.id, i.department_id, u.role FROM instructors i INNER JOIN users u ON u.id = i.user_id
      WHERE (i.id = ? OR i.user_id = ?) AND LOWER(COALESCE(u.status, 'active')) = 'active' LIMIT 1`,
        [Number(instructorId), Number(instructorId)],
      );
      if (!instructorRows.length)
        return res
          .status(404)
          .json({ message: "Teaching staff member not found." });

      const placeholders = ids.map(() => "?").join(", ");
      const [courseRows] = await connection.query(
        `SELECT c.id, c.department_id,
                (lc.course_id IS NOT NULL) AS is_lab,
                lc.section AS section
         FROM courses c LEFT JOIN lab_classes lc ON lc.course_id = c.id
         WHERE c.id IN (${placeholders})`,
        ids,
      );
      if (courseRows.length !== ids.length)
        return res
          .status(404)
          .json({ message: "One or more courses were not found." });
      if (
        req.user.role === "dept_head" &&
        courseRows.some(
          (course) => Number(course.department_id) !== callerDepartmentId,
        )
      ) {
        return res.status(403).json({
          message: "You can only assign courses from your department.",
        });
      }
      const instructorIsLabAssistant =
        normalizeRole(instructorRows[0].role) === "lab_assistant";
      if (courseRows.some((course) => Boolean(course.is_lab) !== instructorIsLabAssistant)) {
        return res.status(400).json({
          message: instructorIsLabAssistant
            ? "Lab Assistants can only be assigned to Lab classes."
            : "Lab classes can only be assigned to Lab Assistants.",
        });
      }
      if (
        courseRows.some(
          (course) =>
            Boolean(course.is_lab) &&
            course.section &&
            normalizeSectionValue(course.section).toLowerCase() !==
              normalizeSectionValue(section).toLowerCase(),
        )
      ) {
        return res.status(400).json({
          message: "Lab classes can only be assigned to their registered section.",
        });
      }

      await connection.beginTransaction();
      for (const course of courseRows) {
        await connection.query(
          `INSERT INTO course_assignments (department_id, course_id, instructor_id, program_type, year_level, semester, section, academic_year, cycle_id, is_published, is_student_published, is_peer_published, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'Assigned')`,
          [
            course.department_id,
            course.id,
            instructorRows[0].id,
            programType,
            yearLevel,
            semester,
            String(section).trim(),
            activeCycle.academic_year,
            activeCycle.id,
          ],
        );
      }
      await connection.commit();
      return res
        .status(201)
        .json({ success: true, assignedCount: courseRows.length });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Batch assignment rollback failed:", rollbackError);
      }
      console.error("Batch assignment failed:", error);
      return res.status(500).json({
        message: "Unable to save batch course assignments.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  },
);

app.post(
  "/api/courses/batch-assign-matrix",
  authenticate,
  authorizeRoles("dept_head", "admin", "college_dean"),
  async (req, res) => {
    const connection = await pool.getConnection();
    let transactionStarted = false;
    try {
      const {
        programType,
        yearLevel,
        semester,
        section,
        assignments = [],
      } = req.body;
      const rows = assignments
        .filter((row) => row?.instructorId)
        .map((row) => ({
          courseId: Number(row.courseId),
          instructorId: Number(row.instructorId),
        }))
        .filter((row) => row.courseId > 0 && row.instructorId > 0);
      if (!programType || !yearLevel || !semester || !section || !rows.length)
        return res.status(400).json({
          message: "Filters and at least one assigned course are required.",
        });
      const activeCycle = await getActiveEvaluationCycle(connection);
      if (!activeCycle) {
        return res.status(409).json({ message: "There is no active evaluation cycle." });
      }

      let callerDepartmentId = Number(req.user.department_id || 0);
      if (req.user.role === "dept_head" && callerDepartmentId <= 0) {
        const [[departmentRow]] = await connection.query(
          "SELECT COALESCE(u.department_id, i.department_id) AS department_id FROM users u LEFT JOIN instructors i ON i.user_id = u.id WHERE u.id = ? LIMIT 1",
          [req.user.id],
        );
        callerDepartmentId = Number(departmentRow?.department_id || 0);
      }

      await connection.beginTransaction();
      transactionStarted = true;
      for (const row of rows) {
        const [[course]] = await connection.query(
          `SELECT c.id, c.department_id, (lc.course_id IS NOT NULL) AS is_lab,
                  lc.section AS section
           FROM courses c LEFT JOIN lab_classes lc ON lc.course_id = c.id
           WHERE c.id = ? LIMIT 1`,
          [row.courseId],
        );
        const [[staff]] = await connection.query(
          `SELECT i.id, i.department_id, u.id AS user_id, u.department_id AS user_department_id,
          COALESCE(i.first_name, s.first_name, '') AS first_name,
          COALESCE(i.last_name, s.last_name, '') AS last_name,
          u.username, u.role
         FROM users u
         LEFT JOIN instructors i ON i.user_id = u.id
         LEFT JOIN students s ON s.user_id = u.id
         WHERE (i.id = ? OR u.id = ?)
           AND LOWER(COALESCE(u.status, 'active')) = 'active' LIMIT 1`,
          [row.instructorId, row.instructorId],
        );
        if (!course || !staff)
          throw new Error(
            `Invalid course or instructor for course ${row.courseId}.`,
          );
        const staffIsLabAssistant = normalizeRole(staff.role) === "lab_assistant";
        if (Boolean(course.is_lab) !== staffIsLabAssistant) {
          const assignmentTypeError = new Error(
            course.is_lab
              ? "Lab classes can only be assigned to Lab Assistants."
              : "Lab Assistants can only be assigned to Lab classes.",
          );
          assignmentTypeError.status = 400;
          throw assignmentTypeError;
        }
        if (
          Boolean(course.is_lab) &&
          course.section &&
          normalizeSectionValue(course.section).toLowerCase() !==
            normalizeSectionValue(section).toLowerCase()
        ) {
          const labSectionError = new Error(
            "Lab classes can only be assigned to their registered section.",
          );
          labSectionError.status = 400;
          throw labSectionError;
        }
        if (
          req.user.role === "dept_head" &&
          (callerDepartmentId <= 0 ||
            Number(course.department_id) !== callerDepartmentId)
        ) {
          const ownershipError = new Error(
            "Department Heads may only assign courses from their department.",
          );
          ownershipError.status = 403;
          throw ownershipError;
        }
        let assignmentInstructorId = staff.id;
        if (!assignmentInstructorId) {
          const fullName = String(
            `${staff.first_name || ""} ${staff.last_name || ""}`.trim() ||
              staff.username ||
              "Teaching Staff",
          ).trim();
          const nameParts = fullName.split(/\s+/).filter(Boolean);
          const [profileResult] = await connection.query(
            `INSERT INTO instructors (user_id, phone_number, first_name, last_name, department_id)
           VALUES (?, ?, ?, ?, ?)`,
            [
              staff.user_id,
              null,
              nameParts.shift() || fullName,
              nameParts.join(" ") || "",
              staff.user_department_id || course.department_id,
            ],
          );
          assignmentInstructorId = profileResult.insertId;
        }
        const conflict = await findConflictingAssignment(connection, {
          departmentId: course.department_id,
          courseId: row.courseId,
          programType,
          yearLevel,
          semester,
          section: String(section).trim(),
          instructorId: assignmentInstructorId,
          cycleId: activeCycle.id,
        });
        if (conflict) {
          const error = new Error(
            "This course is already assigned to another instructor for the selected program, year, semester, and section.",
          );
          error.status = 409;
          throw error;
        }
        await connection.query(
          `INSERT INTO course_assignments (department_id, course_id, instructor_id, program_type, year_level, semester, section, academic_year, cycle_id, is_published, is_student_published, is_peer_published, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'Assigned')
         ON DUPLICATE KEY UPDATE instructor_id = VALUES(instructor_id), program_type = VALUES(program_type), year_level = VALUES(year_level), semester = VALUES(semester), section = VALUES(section), status = 'Assigned'`,
          [
            course.department_id,
            course.id,
            assignmentInstructorId,
            programType,
            yearLevel,
            semester,
            String(section).trim(),
            activeCycle.academic_year,
            activeCycle.id,
          ],
        );
      }
      await connection.commit();
      transactionStarted = false;
      return res
        .status(200)
        .json({ success: true, assignedCount: rows.length });
    } catch (error) {
      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error("Matrix rollback failed:", rollbackError);
        }
      }
      return res.status(error.status || 500).json({
        message:
          error.status === 403
            ? error.message
            : "Unable to save course assignment matrix.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  },
);

app.post(
  "/api/assignments/assign",
  authenticate,
  authorizeRoles("dept_head", "admin", "college_dean"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const {
        course_id,
        instructor_id,
        program_type,
        year_level,
        semester,
        section,
      } = req.body;
      const normalizedSection = normalizeSectionValue(section);
      const departmentId = Number(
        req.user.department_id || req.body.department_id || 0,
      );
      const courseId = Number(course_id);
      const instructorId = Number(instructor_id);
      if (
        !departmentId ||
        !courseId ||
        !instructorId ||
        !program_type ||
        !year_level ||
        !semester ||
        !normalizedSection
      ) {
        return res
          .status(400)
          .json({ message: "All assignment fields are required." });
      }

      const [courseRows] = await pool.query(
        "SELECT id, department_id FROM courses WHERE id = ? LIMIT 1",
        [courseId],
      );
      const [instructorRows] = await pool.query(
        `SELECT i.id, i.department_id, u.role
       FROM instructors i INNER JOIN users u ON u.id = i.user_id
       WHERE (i.id = ? OR i.user_id = ?)
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
       LIMIT 1`,
        [instructorId, instructorId],
      );
      if (!courseRows.length)
        return res.status(404).json({ message: "Course not found." });
      if (!instructorRows.length)
        return res.status(404).json({ message: "Instructor not found." });
      if (
        Number(courseRows[0].department_id) !== departmentId ||
        Number(instructorRows[0].department_id) !== departmentId
      ) {
        return res.status(403).json({
          message: "Course and instructor must belong to your department.",
        });
      }
      if (
        await findConflictingAssignment(pool, {
          departmentId,
          courseId,
          programType: program_type,
          yearLevel: year_level,
          semester,
          section: normalizedSection,
          instructorId: instructorRows[0].id,
          cycleId: activeCycle.id,
        })
      ) {
        return res.status(409).json({
          message:
            "This course is already assigned to another instructor for the selected program, year, semester, and section.",
        });
      }

      const [result] = await pool.query(
        `INSERT INTO course_assignments
        (department_id, course_id, instructor_id, program_type, year_level, semester, section, academic_year, cycle_id, is_published, is_student_published, is_peer_published, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'Assigned')`,
        [
          departmentId,
          courseId,
          instructorRows[0].id,
          program_type,
          year_level,
          semester,
          normalizedSection,
          activeCycle.academic_year,
          activeCycle.id,
        ],
      );
      return res
        .status(201)
        .json({ id: result.insertId, message: "Course assignment saved." });
    } catch (error) {
      console.error("Assignment save failed:", error);
      return res
        .status(500)
        .json({ message: "Unable to save course assignment." });
    }
  },
);

app.get(
  "/api/evaluations/publish-assignments",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const departmentValue =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? req.user.department_id || req.user.department
          : req.query.department ||
            req.user.department_id ||
            req.user.department;
      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId)
        return res.status(404).json({ message: "Department was not found." });
      const academicYear = String(req.query.academic_year || "").trim();
      const [rows] = await pool.query(
        `SELECT ca.id, ca.course_id, ca.instructor_id, ca.program_type, ca.year_level, ca.semester, ca.section,
        ca.academic_year, ca.cycle_id,
        ca.is_student_published,
        ca.is_peer_published,
        c.code AS course_code, c.name AS course_name,
        TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name
       FROM course_assignments ca
       INNER JOIN courses c ON c.id = ca.course_id
       INNER JOIN instructors i ON i.id = ca.instructor_id
       WHERE ca.department_id = ?
         AND (? = '' OR ca.academic_year = ?)
       ORDER BY ca.created_at DESC`,
        [departmentId, academicYear, academicYear],
      );
      return res.json(rows);
    } catch (error) {
      console.error("Publish assignments query failed:", error);
      return res
        .status(500)
        .json({ message: "Unable to load course assignments." });
    }
  },
);

const findPublishedEvaluationTerm = async (
  departmentId,
  yearLevel,
  semester,
  academicYear,
  programType = null,
  section = null,
  publishedColumn = "is_published",
) => {
  const publishedColumns = new Set([
    "is_published",
    "is_student_published",
    "is_peer_published",
  ]);
  const statusColumn = publishedColumns.has(publishedColumn)
    ? publishedColumn
    : "is_published";
  const filters = [
    "ca.department_id = ?",
    "ca.year_level = ?",
    "ca.semester = ?",
    "ca.academic_year = ?",
    `ca.${statusColumn} = 1`,
  ];
  const params = [departmentId, yearLevel, semester, academicYear];
  if (programType) {
    filters.push("LOWER(TRIM(ca.program_type)) = LOWER(TRIM(?))");
    params.push(programType);
  }
  if (section) {
    filters.push("LOWER(TRIM(ca.section)) = LOWER(TRIM(?))");
    params.push(normalizeSectionValue(section));
  }
  const [rows] = await pool.query(
    `SELECT ca.id FROM course_assignments ca
     WHERE ${filters.join(" AND ")}
     LIMIT 1`,
    params,
  );
  return rows.length > 0;
};

const validateEvaluationPublishTerm = async (
  res,
  departmentId,
  yearLevel,
  semester,
  academicYear,
  programType = null,
  section = null,
  publishedColumn = "is_published",
) => {
  if (
    await findPublishedEvaluationTerm(
      departmentId,
      yearLevel,
      semester,
      academicYear,
      programType,
      section,
      publishedColumn,
    )
  ) {
    res.status(400).json({
      message:
        "Evaluation form has already been published for the selected year, semester, and section.",
    });
    return false;
  }
  return true;
};

app.post(
  "/api/evaluations/publish",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    if (
      req.body?.requires_lab === true &&
      req.body?.course_id &&
      req.body?.section_id &&
      req.body?.lab_assistant_id &&
      req.body?.is_published === true
    ) {
      try {
        const activeCycle = await getActiveEvaluationCycle();
        if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
        const connection = await pool.getConnection();
        const courseId = Number(req.body.course_id);
        const sectionId = String(req.body.section_id).trim();
        const labAssistantId = Number(req.body.lab_assistant_id);
        try {
          const [[assignment]] = await connection.query(
            `SELECT ca.id, ca.department_id, ca.course_id, ca.program_type, ca.year_level,
                    ca.semester, ca.section, ca.academic_year, c.code AS course_code, c.name AS course_name
             FROM course_assignments ca
             INNER JOIN courses c ON c.id = ca.course_id
             WHERE ca.course_id = ? AND ca.cycle_id = ?
               AND (ca.id = ? OR LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) =
                    LOWER(TRIM(REPLACE(REPLACE(?, 'Section ', ''), 'section ', ''))))
             LIMIT 1 FOR UPDATE`,
            [courseId, activeCycle.id, Number(sectionId) || 0, sectionId],
          );
          if (!assignment) return res.status(404).json({ message: "Course section assignment was not found." });
          if (String(req.user?.role || "").toLowerCase() === "dept_head" && Number(req.user.department_id) !== Number(assignment.department_id)) {
            return res.status(403).json({ message: "You can only publish evaluations for your department." });
          }
          const [[assistant]] = await connection.query(
            `SELECT i.id, i.user_id FROM instructors i
             INNER JOIN users u ON u.id = i.user_id
             WHERE i.id = ? AND i.department_id = ?
               AND LOWER(COALESCE(u.status, 'active')) = 'active'
               AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_')) IN ('lab_assistant', 'ara')
             LIMIT 1`,
            [labAssistantId, assignment.department_id],
          );
          if (!assistant) return res.status(400).json({ message: "Select an active Lab Assistant from the department." });
          const [students] = await connection.query(
            `SELECT id FROM students
             WHERE department_id = ?
               AND LOWER(TRIM(COALESCE(year_level, ''))) = LOWER(TRIM(?))
               AND LOWER(TRIM(COALESCE(semester, ''))) = LOWER(TRIM(?))
               AND LOWER(TRIM(REPLACE(REPLACE(COALESCE(section, ''), 'Section ', ''), 'section ', ''))) =
                   LOWER(TRIM(REPLACE(REPLACE(?, 'Section ', ''), 'section ', '')))
               AND (? = '' OR LOWER(TRIM(COALESCE(program_type, ''))) = LOWER(TRIM(?)))`,
            [assignment.department_id, assignment.year_level, assignment.semester, assignment.section, assignment.program_type || "", assignment.program_type || ""],
          );
          const payload = JSON.stringify({
            source: "course_publish",
            requires_lab: true,
            lab_assistant_id: assistant.id,
            lab_assistant_user_id: assistant.user_id,
            course_id: assignment.course_id,
            section_id: assignment.id,
          });
          await connection.beginTransaction();
          await connection.query(
            `UPDATE evaluation_dispatches
             SET is_student_published = 1, payload = ?
             WHERE assignment_id = ? AND cycle_id = ? AND student_group = 'lab_assistant'`,
            [payload, assignment.id, activeCycle.id],
          );
          for (const student of students) {
            const [existing] = await connection.query(
              `SELECT id FROM evaluation_dispatches
               WHERE student_id = ? AND assignment_id = ? AND student_group = 'lab_assistant' AND cycle_id = ? LIMIT 1`,
              [student.id, assignment.id, activeCycle.id],
            );
            if (!existing.length) {
              await connection.query(
                `INSERT INTO evaluation_dispatches
                  (assignment_id, cycle_id, department_id, program_type, student_id, course_id,
                   course_code, course_name, academic_year, semester, year_level, student_group,
                   is_student_published, created_by, payload)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lab_assistant', 1, ?, ?)`,
                [
                  assignment.id, activeCycle.id, assignment.department_id, assignment.program_type || null,
                  student.id, assignment.course_id, assignment.course_code, assignment.course_name,
                  assignment.academic_year, assignment.semester, assignment.year_level, req.user.id, payload,
                ],
              );
            }
          }
          await connection.commit();
          return res.json({ message: "Lab Assistant evaluation assigned and published.", students: students.length });
        } catch (error) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            console.error("Lab Assistant publish rollback failed:", rollbackError);
          }
          throw error;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error("Lab Assistant evaluation publish failed:", error);
        return res.status(500).json({ message: "Unable to publish the Lab Assistant evaluation." });
      }
    }
    const connection = await pool.getConnection();
    try {
      const {
        department_id,
        program_type,
        year_level,
        semester,
        section,
        academic_year,
      } = req.body;
      const departmentValue =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? req.user.department_id || req.user.department
          : department_id || req.user.department_id || req.user.department;
      const departmentId = await resolveDepartmentId(departmentValue);
      const academicYear = String(academic_year || new Date().getFullYear());
      if (!departmentId)
        return res.status(404).json({ message: "Department was not found." });
      if (
        !(await validateEvaluationPublishTerm(
          res,
          departmentId,
          year_level,
          semester,
          academicYear,
          program_type,
          section,
        ))
      )
        return;

      const filters = [
        "ca.department_id = ?",
        "ca.year_level = ?",
        "ca.semester = ?",
        "ca.academic_year = ?",
      ];
      const params = [departmentId, year_level, semester, academicYear];
      if (program_type) {
        filters.push("LOWER(TRIM(ca.program_type)) = LOWER(TRIM(?))");
        params.push(program_type);
      }
      if (section) {
        filters.push("LOWER(TRIM(ca.section)) = LOWER(TRIM(?))");
        params.push(normalizeSectionValue(section));
      }
      const [assignments] = await connection.query(
        `SELECT ca.id, ca.course_id, c.name FROM course_assignments ca INNER JOIN courses c ON c.id = ca.course_id WHERE ${filters.join(" AND ")}`,
        params,
      );
      await connection.beginTransaction();
      for (const assignment of assignments) {
        await connection.query(
          "UPDATE course_assignments SET is_published = 1, is_student_published = 1, is_peer_published = 1, publish_target = 'both' WHERE id = ?",
          [assignment.id],
        );
      }
      await connection.commit();
      return res.json({
        message: `Published student and peer evaluations for ${assignments.length} assignments.`,
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Publish rollback failed:", rollbackError);
      }
      return res.status(500).json({
        message: "Unable to publish evaluations.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  },
);

app.get(
  "/api/evaluations/student-list",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const departmentId = Number(
        req.user.department_id || req.query.department_id || 0,
      );
      const yearLevel = String(
        req.query.year_level || req.query.year || "",
      ).trim();
      const semester = String(req.query.semester || "").trim();
      const academicYear = String(
        req.query.academic_year || new Date().getFullYear(),
      );
      if (!departmentId)
        return res
          .status(400)
          .json({ message: "Student department is not configured." });
      const [rows] = await pool.query(
        `SELECT i.id AS instructor_id,
        TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name,
        GROUP_CONCAT(DISTINCT c.code ORDER BY c.code SEPARATOR ', ') AS course_codes,
        COUNT(DISTINCT ca.course_id) AS course_count
       FROM course_assignments ca
       INNER JOIN instructors i ON i.id = ca.instructor_id
       INNER JOIN users u ON u.id = i.user_id AND LOWER(u.status) = 'active'
       INNER JOIN courses c ON c.id = ca.course_id
       WHERE ca.department_id = ?
         AND ca.is_published = 1
         AND (? = '' OR ca.year_level = ?)
         AND (? = '' OR ca.semester = ?)
         AND (? = '' OR ca.academic_year = ?)
       GROUP BY i.id, i.first_name, i.last_name
       ORDER BY instructor_name ASC`,
        [
          departmentId,
          yearLevel,
          yearLevel,
          semester,
          semester,
          academicYear,
          academicYear,
        ],
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({
        message: "Unable to load student evaluation list.",
        error: error.message,
      });
    }
  },
);

app.post(
  "/api/evaluations/publish-student",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const { department_id, program_type, year_level, semester, section } =
        req.body;
      const departmentValue =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? req.user.department_id || req.user.department
          : department_id || req.user.department_id || req.user.department;
      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId)
        return res.status(404).json({ message: "Department was not found." });
      const academicYear = String(req.body.academic_year || "").trim();
      const selectedSemester = String(semester || "").trim();
      if (!academicYear || !selectedSemester) {
        return res.status(400).json({
          message: "Academic year and semester are required to publish evaluations.",
        });
      }
      if (req.body.course_id && req.body.lab_assistant_id) {
        const courseId = Number(req.body.course_id);
        const labAssistantId = Number(req.body.lab_assistant_id);
        const sectionValue = normalizeSectionValue(section);
        const [[assignment]] = await pool.query(
          `SELECT ca.id, ca.cycle_id, ca.department_id, ca.course_id, ca.program_type, ca.year_level,
                  ca.semester, ca.section, ca.academic_year, c.code AS course_code, c.name
           FROM course_assignments ca
           INNER JOIN courses c ON c.id = ca.course_id
           WHERE ca.course_id = ? AND ca.academic_year = ?
             AND LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) =
                 LOWER(TRIM(?))
             AND LOWER(TRIM(ca.year_level)) = LOWER(TRIM(?))
             AND LOWER(TRIM(ca.semester)) = LOWER(TRIM(?))
             AND (? = '' OR LOWER(TRIM(COALESCE(ca.program_type, ''))) = LOWER(TRIM(?)))
           LIMIT 1`,
          [courseId, academicYear, sectionValue, year_level, selectedSemester, program_type || "", program_type || ""],
        );
        if (!assignment) return res.status(404).json({ message: "Course section assignment was not found." });
        if (String(req.user?.role || "").toLowerCase() === "dept_head" && Number(req.user.department_id) !== Number(assignment.department_id)) {
          return res.status(403).json({ message: "You can only publish evaluations for your department." });
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
        if (!assistant) return res.status(400).json({ message: "Select an active Lab Assistant from the department." });
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
              `UPDATE evaluation_dispatches SET is_student_published = 1, status = 'pending', payload = ?
               WHERE id = ?`,
              [payload, existing[0].id],
            );
          } else {
            await pool.query(
              `INSERT INTO evaluation_dispatches
                (assignment_id, cycle_id, department_id, program_type, student_id, course_id,
                 course_code, course_name, academic_year, semester, year_level, student_group,
                 is_student_published, created_by, payload)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lab_assistant', 1, ?, ?)`,
              [assignment.id, assignment.cycle_id, assignment.department_id, assignment.program_type || null, student.id,
                assignment.course_id, assignment.course_code, assignment.name, assignment.academic_year,
                assignment.semester, assignment.year_level, req.user.id, payload],
            );
          }
        }
        return res.json({ message: "Lecture and Lab Assistant evaluations published.", lab_assistant_id: assistant.id });
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
        return res.status(400).json({
          success: false,
          isAlreadyPublished: true,
          message:
            "Evaluation form has already been published for this section/batch.",
        });
      }
      if (
        !(await validateEvaluationPublishTerm(
          res,
          departmentId,
          year_level,
          semester,
          academicYear,
          program_type,
          section,
          "is_student_published",
        ))
      )
        return;
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
        `SELECT ca.id, ca.cycle_id, ca.course_id, ca.instructor_id, ca.academic_year,
                ca.program_type, ca.year_level, ca.semester, ca.section,
                c.code AS course_code, c.name, (lc.course_id IS NOT NULL) AS is_lab
         FROM course_assignments ca
         JOIN courses c ON c.id = ca.course_id
         LEFT JOIN lab_classes lc ON lc.course_id = c.id
         WHERE ${filters.join(" AND ")}`,
        params,
      );
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
        for (const student of students)
          await pool.query(
            `INSERT INTO evaluation_dispatches
              (assignment_id, cycle_id, department_id, program_type, student_id, course_id,
               course_name, academic_year, semester, year_level, student_group,
               is_student_published, created_by, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', 1, ?, ?)`,
            [
              assignment.id,
              assignment.cycle_id,
              departmentId,
              assignment.program_type || null,
              student.id,
              assignment.course_id,
              assignment.name,
              academicYear,
              semester || null,
              year_level || null,
              req.user.id,
              JSON.stringify({ source: "student_publish" }),
            ],
          );
      }
      return res.json({
        message: `Published student evaluations for ${assignments.length} assignments.`,
      });
    } catch (error) {
      console.error("Student evaluation publish failed:", error);
      return res
        .status(500)
        .json({ message: "Unable to publish student evaluations." });
    }
  },
);

app.post(
  "/api/evaluations/student/unpublish",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      const { department_id, program_type, year_level, semester, section } =
        req.body;
      const departmentValue =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? req.user.department_id || req.user.department
          : department_id || req.user.department_id || req.user.department;
      const departmentId = await resolveDepartmentId(departmentValue);
      const academicYear = String(req.body.academic_year || "").trim();
      if (!academicYear) {
        return res.status(400).json({ message: "Academic year is required to withdraw evaluations." });
      }
      if (!departmentId)
        return res.status(404).json({ message: "Department was not found." });

      const filters = [
        "ca.department_id = ?",
        "ca.academic_year = ?",
        "ca.is_student_published = 1",
      ];
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
      const [assignments] = await connection.query(
        `SELECT id FROM course_assignments ca WHERE ${filters.join(" AND ")}`,
        params,
      );
      if (!assignments.length)
        return res
          .status(404)
          .json({ message: "No published student evaluation batch found." });
      const assignmentIds = assignments.map((assignment) => assignment.id);
      const placeholders = assignmentIds.map(() => "?").join(", ");
      const [submitted] = await connection.query(
        `SELECT ses.id FROM student_evaluation_submissions ses INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id WHERE ed.assignment_id IN (${placeholders}) LIMIT 1`,
        assignmentIds,
      );
      if (submitted.length)
        return res.status(400).json({
          success: false,
          message:
            "Cannot unpublish because student evaluations have already been submitted.",
        });

      await connection.beginTransaction();
      await connection.query(
        `DELETE FROM evaluation_dispatches WHERE assignment_id IN (${placeholders})`,
        assignmentIds,
      );
      const labDispatchFilters = [
        "department_id = ?",
        "student_group = 'lab_assistant'",
        "academic_year = ?",
        "semester <=> ?",
      ];
      const labDispatchParams = [departmentId, academicYear, semester || null];
      if (year_level) {
        labDispatchFilters.push("year_level = ?");
        labDispatchParams.push(year_level);
      }
      if (program_type) {
        labDispatchFilters.push("program_type = ?");
        labDispatchParams.push(program_type);
      }
      await connection.query(
        `DELETE FROM evaluation_dispatches WHERE ${labDispatchFilters.join(" AND ")}`,
        labDispatchParams,
      );
      await connection.query(
        `UPDATE course_assignments SET is_student_published = 0, is_published = IF(is_peer_published = 1, 1, 0), publish_target = IF(is_peer_published = 1, 'instructor', '') WHERE id IN (${placeholders})`,
        assignmentIds,
      );
      await connection.commit();
      return res.json({
        success: true,
        message: "Student evaluation form unpublished successfully.",
      });
    } catch (error) {
      try {
        if (connection) await connection.rollback();
      } catch (rollbackError) {
        console.error("Student unpublish rollback failed:", rollbackError);
      }
      console.error("Student evaluation unpublish failed:", {
        message: error?.message,
        code: error?.code,
        body: req.body,
      });
      return res.status(500).json({
        success: false,
        message: "Unable to unpublish student evaluations.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      if (connection) connection.release();
    }
  },
);

app.post(
  "/api/evaluations/publish-instructor",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const { department_id, program_type, year_level, semester, section } =
        req.body;
      const departmentValue =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? req.user.department_id || req.user.department
          : department_id || req.user.department_id || req.user.department;
      const departmentId = await resolveDepartmentId(departmentValue);
      if (!departmentId)
        return res.status(404).json({ message: "Department was not found." });
      const academicYear = String(
        req.body.academic_year || activeCycle.academic_year,
      );
      if (academicYear !== String(activeCycle.academic_year)) {
        return res.status(409).json({
          message: `The active evaluation cycle is ${activeCycle.academic_year} ${activeCycle.semester}.`,
        });
      }
      if (
        !(await validateEvaluationPublishTerm(
          res,
          departmentId,
          year_level,
          semester,
          academicYear,
          program_type,
          section,
          "is_peer_published",
        ))
      )
        return;
      const filters = ["ca.department_id = ?", "ca.cycle_id = ?"];
      const params = [departmentId, activeCycle.id];
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
        `SELECT id, course_id, instructor_id FROM course_assignments ca WHERE ${filters.join(" AND ")}`,
        params,
      );
      for (const assignment of assignments) {
        await pool.query(
          "UPDATE course_assignments SET is_published = 1, is_peer_published = 1, publish_target = CASE WHEN is_student_published = 1 THEN 'both' ELSE 'instructor' END WHERE id = ?",
          [assignment.id],
        );
        const [peers] = await pool.query(
          `SELECT i.user_id FROM instructors i
         INNER JOIN users u ON u.id = i.user_id
         WHERE i.department_id = ? AND i.id <> ?
           AND LOWER(COALESCE(u.status, 'active')) = 'active'
           AND LOWER(TRIM(COALESCE(u.role, ''))) IN ('instructor', 'dept_head', 'college_dean', 'college dean', 'dean', 'academic_directorate', 'academic directorate', 'academic_director', 'academic director', 'directorate', 'department_head', 'department head')`,
          [departmentId, assignment.instructor_id],
        );
        for (const peer of peers)
          await pool.query(
            "INSERT INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, cycle_id, deadline, status, is_published) VALUES (?, ?, ?, ?, ?, 'pending', 1) ON DUPLICATE KEY UPDATE is_published = 1",
            [peer.user_id, assignment.instructor_id, assignment.course_id, activeCycle.id, activeCycle.end_at],
          );
      }
      const [labAssistants] = await pool.query(
        `SELECT i.id AS instructor_id, i.user_id
       FROM instructors i INNER JOIN users u ON u.id = i.user_id
       WHERE i.department_id = ?
         AND LOWER(TRIM(COALESCE(u.role, ''))) IN ('lab_assistant', 'ara', 'lab assistant', 'lab-assistant')
         AND LOWER(COALESCE(u.status, 'active')) = 'active'`,
        [departmentId],
      );
      const [departmentPeers] = await pool.query(
        `SELECT i.user_id
       FROM instructors i INNER JOIN users u ON u.id = i.user_id
       WHERE i.department_id = ? AND i.user_id <> ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
         AND LOWER(TRIM(u.role)) IN ('instructor', 'dept_head', 'college_dean', 'college dean', 'dean', 'academic_directorate', 'academic directorate', 'academic_director', 'academic director', 'directorate', 'department_head', 'department head')`,
        [departmentId, req.user.id],
      );
      for (const assistant of assignments.length ? labAssistants : []) {
        for (const peer of departmentPeers) {
          if (Number(peer.user_id) === Number(assistant.user_id)) continue;
          await pool.query(
            "INSERT INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, cycle_id, deadline, status, is_published) VALUES (?, ?, NULL, ?, ?, 'pending', 1) ON DUPLICATE KEY UPDATE is_published = 1",
            [
              peer.user_id,
              assistant.instructor_id,
              activeCycle.id,
              activeCycle.end_at,
            ],
          );
        }
      }
      return res.json({
        message: `Published instructor evaluations for ${assignments.length} assignments.`,
      });
    } catch (error) {
      console.error("Instructor evaluation publish failed:", error);
      return res
        .status(500)
        .json({ message: "Unable to publish instructor evaluations." });
    }
  },
);

app.get(
  "/api/instructor/dashboard-stats",
  authenticate,
  authorizeRoles("instructor"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const [[instructor]] = await pool.query(
        "SELECT id, department_id FROM instructors WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!instructor) {
        return res
          .status(404)
          .json({ message: "Instructor profile not found." });
      }

      const [[courseStats]] = await pool.query(
        `SELECT COUNT(DISTINCT ca.course_id) AS assignedCourses
         FROM course_assignments ca
         WHERE ca.instructor_id = ?
          AND ca.cycle_id = ?
          AND (ca.is_published = 1 OR ca.is_student_published = 1 OR ca.is_peer_published = 1)`,
        [instructor.id, activeCycle.id],
      );
      const [[peerStats]] = await pool.query(
        `SELECT COUNT(DISTINCT pes.id) AS receivedPeerEvaluations,
                AVG(pes.score) AS averageScore
         FROM peer_evaluation_submissions pes
         INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
         WHERE pe.evaluatee_id = ?
           AND pe.cycle_id = ?
           AND LOWER(TRIM(COALESCE(pes.status, 'submitted'))) IN ('submitted', 'completed', 'approved')`,
        [instructor.id, activeCycle.id],
      );
      const [[departmentStats]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM courses WHERE department_id = ?) AS totalCourses,
           (SELECT COUNT(*) FROM students WHERE department_id = ?) AS totalStudents`,
        [instructor.department_id, instructor.department_id],
      );

      return res.json({
        assignedCourses: Number(courseStats?.assignedCourses || 0),
        totalCourses: Number(departmentStats?.totalCourses || 0),
        totalStudents: Number(departmentStats?.totalStudents || 0),
        receivedPeerEvaluations: Number(
          peerStats?.receivedPeerEvaluations || 0,
        ),
        averageScore: Number(peerStats?.averageScore || 0),
      });
    } catch (error) {
      console.error(
        "Instructor dashboard stats fetch error:",
        error?.message || error,
      );
      return res
        .status(500)
        .json({ message: "Unable to load instructor dashboard statistics." });
    }
  },
);

app.get(
  "/api/instructor/assigned-courses",
  authenticate,
  authorizeRoles("instructor", "dept_head", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const userId =
        req.user.role === "instructor"
          ? req.user.id
          : Number(req.query.instructor_id || req.query.user_id || req.user.id);
      const isAdmin = req.user.role === "admin";
      const [[instructor]] = await pool.query(
        isAdmin
          ? `SELECT id FROM instructors WHERE user_id = ? OR id = ?
             ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END LIMIT 1`
          : "SELECT id FROM instructors WHERE user_id = ? LIMIT 1",
        isAdmin ? [userId, userId, userId] : [userId],
      );
      const [rows] = await pool.query(
        `SELECT ca.id, ca.course_id, c.code AS course_code, c.name AS course_name, ca.department_id, ca.program_type, ca.year_level, ca.semester, ca.section, ca.is_published, ca.status
       FROM course_assignments ca
       LEFT JOIN courses c ON c.id = ca.course_id
       WHERE ca.instructor_id = ? AND ca.cycle_id = ? AND ca.is_published = 1
       ORDER BY ca.created_at DESC`,
        [instructor?.id || 0, activeCycle.id],
      );

      return sendResponse(
        res,
        200,
        "Instructor assignments retrieved.",
        "የመምህራን ስራዎች ተመልሰዋል።",
        rows,
      );
    } catch (error) {
      console.error(
        "Instructor assignments fetch error:",
        error?.message || error,
      );
      return sendResponse(
        res,
        200,
        "Instructor assignments unavailable; returning empty list.",
        "የመምህራን ስራዎች አልተገኙም።",
        [],
      );
    }
  },
);

app.get(
  "/api/instructor/peer-evaluations",
  authenticate,
  authorizeRoles(
    "instructor",
    "lab_assistant",
    "ara",
    "dept_head",
    "college_dean",
    "academic_directorate",
    "academic_director",
    "directorate",
    "admin",
  ),
  async (req, res) => {
    let evaluatorId = Number(req.user?.id || req.params.evaluatorId || 0);
    let departmentFilter = "";
    let activeCycleId = null;
    let queryStage = "load_active_cycle";
    try {
      const activeCycle = await getActiveEvaluationCycle();
      activeCycleId = activeCycle?.id || null;
      queryStage = "resolve_evaluator";
      const instructorIdParam = Number(
        req.query.instructor_id || req.query.user_id || 0,
      );

      if (
        instructorIdParam &&
        ["admin"].includes(String(req.user?.role || "").toLowerCase())
      ) {
        const [userRows] = await pool.query(
          "SELECT user_id FROM instructors WHERE id = ? OR user_id = ? LIMIT 1",
          [instructorIdParam, instructorIdParam],
        );
        if (userRows.length) {
          evaluatorId = userRows[0].user_id;
        }
      }

      if (!evaluatorId) {
        return res
          .status(400)
          .json({ success: false, message: "Instructor ID is required." });
      }

      console.log(
        "Fetching peer evaluations for evaluator user_id:",
        evaluatorId,
      );

      queryStage = "load_evaluator_scope";
      const [[evaluatorScope]] = await pool.query(
        `SELECT COALESCE(i.department_id, u.department_id) AS department_id
       FROM users u
       LEFT JOIN instructors i ON i.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
        [evaluatorId],
      );
      const evaluatorRole = normalizeRole(req.user?.role);
      const isAdmin = evaluatorRole === "admin";
      const evaluatorDepartmentId = Number(
        isAdmin
          ? evaluatorScope?.department_id || req.user?.department_id || 0
          : req.user?.department_id || evaluatorScope?.department_id || 0,
      );
      const evaluationDeadline = await getDepartmentEvaluationDeadline(
        evaluatorDepartmentId,
        activeCycle?.end_at,
      );
      if (!isAdmin && evaluatorDepartmentId <= 0) {
        return res.status(403).json({
          success: false,
          message:
            "Your operational department is not configured. Contact an administrator.",
        });
      }
      const isExpired = isEvaluationDeadlineExpired(evaluationDeadline);
      if (isExpired || !activeCycle) {
        return res.status(200).json({
            success: true,
            pendingCount: 0,
            evaluations: [],
            deadline: evaluationDeadline,
            expiryDate: evaluationDeadline,
            isExpired,
        });
      }
      departmentFilter = isAdmin ? "" : "AND i.department_id = ?";
      const isAcademicLeader = isAcademicLeaderRole(evaluatorRole);
      const isAcademicDirectorateEvaluator = [
        "academic_directorate",
        "academic_director",
        "directorate",
      ].includes(evaluatorRole);
      const isCollegeDeanEvaluator = ["college_dean", "dean"].includes(evaluatorRole);
      const peerTargetRoleFilter = evaluatorRole === "lab_assistant"
        ? "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u_target.role, '')), '-', '_'), ' ', '_')) IN ('lab_assistant', 'ara')"
        : isAcademicDirectorateEvaluator
          ? "AND LOWER(TRIM(COALESCE(u_target.role, ''))) IN ('dept_head', 'instructor')"
        : isCollegeDeanEvaluator
          ? "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u_target.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'academic_directorate')"
        : isAcademicLeader
          ? "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u_target.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'department_head', 'dept_head')"
          : "AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u_target.role, '')), '-', '_'), ' ', '_')) NOT IN ('lab_assistant', 'ara')";
      if (isAcademicLeader) {
        queryStage = "count_published_department_evaluations";
        const [[published]] = await pool.query(
          `SELECT COUNT(*) AS total
           FROM peer_evaluations pe
           INNER JOIN instructors target ON target.id = pe.evaluatee_id
           INNER JOIN users target_user ON target_user.id = target.user_id
           WHERE pe.evaluator_id = ?
             AND pe.cycle_id = ?
             AND pe.is_published = 1
             AND ${
               isAcademicDirectorateEvaluator
                 ? "LOWER(TRIM(COALESCE(target_user.role, ''))) IN ('dept_head', 'instructor')"
                 : isCollegeDeanEvaluator
                   ? "LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_user.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'academic_directorate')"
                 : "LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_user.role, '')), '-', '_'), ' ', '_')) IN ('instructor', 'department_head', 'dept_head')"
             }
             AND target.department_id = ?`,
          [evaluatorId, activeCycle.id, evaluatorDepartmentId],
        );
        if (Number(published?.total || 0) === 0) {
          return res.status(200).json({
            success: true,
            published: false,
            evaluations: [],
            pendingCount: 0,
            deadline: evaluationDeadline,
            expiryDate: evaluationDeadline,
            isExpired: false,
            message:
              "Peer evaluations have not been published for your department yet.",
          });
        }
      }

      queryStage = "load_peer_evaluations";
      const [rows] = await pool.query(
        `SELECT DISTINCT
        pe.id,
        pe.evaluatee_id,
        pe.course_id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
        u_target.role AS target_role,
        c.code AS course_code,
        c.name AS course_name,
        pe.deadline,
        CASE
          WHEN LOWER(TRIM(pe.status)) = 'pending' THEN 'pending'
          ELSE 'completed'
        END AS status,
        pes.score AS total_score,
        pes.strengths,
        pes.suggestions,
        pes.responses,
        pes.status AS submission_status,
        pes.id AS submission_id,
        CASE WHEN pes.id IS NOT NULL THEN 1 ELSE 0 END AS is_evaluated,
        i.department_id AS target_department_id,
        target_department.department_name AS target_department_name,
        pe.created_at
       FROM peer_evaluations pe
       JOIN instructors i ON pe.evaluatee_id = i.id
      JOIN users u_target ON u_target.id = i.user_id
      JOIN departments target_department ON target_department.id = i.department_id
       LEFT JOIN courses c ON pe.course_id = c.id
       LEFT JOIN course_assignments ca
         ON ca.course_id = pe.course_id
        AND ca.instructor_id = pe.evaluatee_id
        AND ca.cycle_id = pe.cycle_id
        AND ca.is_peer_published = 1
       LEFT JOIN peer_evaluation_submissions pes ON pes.peer_evaluation_id = pe.id
       WHERE pe.evaluator_id = ?
       AND pe.cycle_id = ?
       ${departmentFilter}
       ${peerTargetRoleFilter}
       AND pe.is_published = 1
        AND (pe.course_id IS NULL OR ca.id IS NOT NULL)
       ORDER BY pe.created_at DESC`,
        departmentFilter
          ? [evaluatorId, activeCycle.id, evaluatorDepartmentId]
          : [evaluatorId, activeCycle.id],
      );

      if (!rows.length) {
        return res.status(200).json({
          success: true,
          pendingCount: 0,
          evaluations: [],
          deadline: evaluationDeadline,
          expiryDate: evaluationDeadline,
          isExpired: false,
        });
      }

      queryStage = "normalize_peer_evaluations";
      const normalized = rows.map((row) => ({
        ...row,
        deadline: row.deadline || evaluationDeadline,
        expiryDate: row.deadline || evaluationDeadline,
        total_score: row.total_score !== null ? Number(row.total_score) : 0,
        is_evaluated: Boolean(row.is_evaluated),
        responses: row.responses
          ? typeof row.responses === "string"
            ? JSON.parse(row.responses)
            : row.responses
          : {},
      }));

      const pendingCount = normalized.reduce(
        (count, row) => count + (row.status === "pending" ? 1 : 0),
        0,
      );
      return res.status(200).json({
        success: true,
        pendingCount,
        evaluations: normalized,
        deadline: evaluationDeadline,
        expiryDate: evaluationDeadline,
        isExpired: false,
      });
    } catch (err) {
      console.error("Peer Evaluations SQL Error:", {
        message: err?.message || err,
        code: err?.code,
        sqlState: err?.sqlState,
        errno: err?.errno,
        stack: err?.stack,
        method: req.method,
        path: req.originalUrl,
        evaluatorId,
        evaluatorRole: req.user?.role,
        activeCycleId,
        departmentFilter,
        queryStage,
      });
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve peer evaluations. Please try again.",
        error:
          process.env.NODE_ENV === "development" ? err?.message : undefined,
      });
    }
  },
);

app.get(
  "/api/student/assigned-courses",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const [studentRows] = await pool.query(
        "SELECT department_id, year_level, semester, section FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!studentRows.length) {
        return sendResponse(
          res,
          200,
          "Student record not found.",
          "የተማሪ መረጃ አልተገኘም።",
          [],
        );
      }

      const student = studentRows[0];
      const normalizedSection = normalizeSectionValue(student.section);
      const [rows] = await pool.query(
        `SELECT ca.id, ca.course_id, c.code AS course_code, c.name AS course_name, ca.department_id, ca.program_type, ca.year_level, ca.semester, ca.section, ca.is_student_published, ca.is_peer_published, ca.status
       FROM course_assignments ca
       LEFT JOIN courses c ON c.id = ca.course_id
       WHERE ca.department_id = ?
         AND ca.year_level = ?
         AND ca.semester = ?
         AND LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) = LOWER(?)
         AND ca.is_student_published = 1
       ORDER BY c.code ASC`,
        [
          student.department_id,
          student.year_level,
          student.semester,
          normalizedSection,
        ],
      );

      return sendResponse(
        res,
        200,
        "Student assignments retrieved.",
        "የተማሪ ስራዎች ተመልሰዋል።",
        rows,
      );
    } catch (error) {
      console.error(
        "Student assignments fetch error:",
        error?.message || error,
      );
      return sendResponse(
        res,
        200,
        "Student assignments unavailable; returning empty list.",
        "የተማሪ ስራዎች አልተገኙም።",
        [],
      );
    }
  },
);

app.post(
  "/api/course-assignments",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const {
        course_id,
        instructor_id,
        program_type,
        year_level,
        semester,
        section,
        publish_target = "both",
      } = req.body;

      const normalizedSection = normalizeSectionValue(section);
      if (
        !course_id ||
        !instructor_id ||
        !program_type ||
        !year_level ||
        !semester ||
        !normalizedSection
      ) {
        return sendResponse(
          res,
          400,
          "course_id, instructor_id, program_type, year_level, semester, and section are required.",
          "course_id፣ instructor_id፣ program_type፣ year_level፣ semester እና section ያስፈልጋሉ።",
        );
      }

      const departmentId = req.user.department_id || null;
      const [courseRows] = await pool.query(
        "SELECT department_id, name FROM courses WHERE id = ? LIMIT 1",
        [course_id],
      );
      if (!courseRows.length) {
        return sendResponse(res, 404, "Course not found.", "ኮርስ አልተገኘም።");
      }

      if (departmentId && courseRows[0].department_id !== departmentId) {
        return sendResponse(
          res,
          403,
          "Course must belong to your department.",
          "ኮርሱ የየትም ክፍልዎ መሆን አለበት።",
        );
      }

      const publishTargetValue = normalizePublishTarget(publish_target);
      const isPublishedValue = publishTargetValue ? 1 : 0;
      const isStudentPublished =
        publishTargetValue === "student" || publishTargetValue === "both"
          ? 1
          : 0;
      const isPeerPublished =
        publishTargetValue === "instructor" || publishTargetValue === "both"
          ? 1
          : 0;

      const [result] = await pool.query(
        "INSERT INTO course_assignments (course_id, department_id, instructor_id, program_type, year_level, semester, section, publish_target, is_published, is_student_published, is_peer_published, academic_year, cycle_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          course_id,
          departmentId,
          instructor_id,
          program_type,
          year_level,
          semester,
          normalizedSection,
          publishTargetValue,
          isPublishedValue,
          isStudentPublished,
          isPeerPublished,
          activeCycle.academic_year,
          activeCycle.id,
        ],
      );

      return sendResponse(
        res,
        201,
        "Course assignment saved successfully!",
        "የኮርስ ምውጫ በተሳካ ሁኔታ ተቀምጧል።",
        {
          id: result.insertId,
          publish_target: publishTargetValue,
          section: normalizedSection,
        },
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to create assignment.",
        "ስራ ለመፍጠር አልተቻለም።",
      );
    }
  },
);

app.post(
  "/api/dept-head/assign-course",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ success: false, message: "There is no active evaluation cycle." });
      console.log("Incoming Assign Payload:", req.body);
      const {
        course_id,
        instructor_id,
        department_id,
        program_type,
        year_level,
        semester,
        section,
        publish_target = "both",
        is_published,
        academic_year,
      } = req.body;
      const normalizedSection = normalizeSectionValue(section);
      const departmentIdFromBody = Number(department_id);
      const courseIdNum = Number(course_id);
      const instructorIdNum = Number(instructor_id);
      const publishedVal = is_published ? 1 : 0;
      const publishTargetValue = normalizePublishTarget(publish_target);
      const acYear = activeCycle.academic_year || (typeof academic_year === "string" ? academic_year.trim() : "");

      if (
        !Number.isInteger(courseIdNum) ||
        courseIdNum <= 0 ||
        !Number.isInteger(instructorIdNum) ||
        instructorIdNum <= 0 ||
        !program_type ||
        !year_level ||
        !semester ||
        !normalizedSection
      ) {
        return sendResponse(
          res,
          400,
          "course_id, instructor_id, program_type, year_level, semester, and section are required and must be valid.",
          "course_id፣ instructor_id፣ program_type፣ year_level፣ semester እና section ያስፈልጋሉ እና ትክክለኛ መሆን አለባቸው።",
        );
      }

      let departmentId =
        Number(departmentIdFromBody) || Number(req.user.department_id) || null;
      const [courseRows] = await pool.query(
        "SELECT department_id, code, name FROM courses WHERE id = ? LIMIT 1",
        [courseIdNum],
      );
      if (!courseRows.length) {
        return sendResponse(res, 404, "Course not found.", "ኮርስ አልተገኘም።");
      }

      if (!departmentId) {
        departmentId = courseRows[0].department_id || null;
      }

      if (!departmentId) {
        return sendResponse(
          res,
          400,
          "department_id is required.",
          "department_id ያስፈልጋል።",
        );
      }

      if (courseRows[0].department_id !== departmentId) {
        return sendResponse(
          res,
          403,
          "Course must belong to your department.",
          "ኮርሱ የየትም ክፍልዎ መሆን አለበት።",
        );
      }

      const [instructorRows] = await pool.query(
        "SELECT id, user_id FROM instructors WHERE id = ? OR user_id = ? LIMIT 1",
        [instructorIdNum, instructorIdNum],
      );
      if (!instructorRows.length) {
        return sendResponse(
          res,
          404,
          "Instructor record not found.",
          "የመምህር መዝገብ አልተገኘም።",
        );
      }

      const instructorRecordId = instructorRows[0].id;
      if (
        await findConflictingAssignment(pool, {
          departmentId,
          courseId: courseIdNum,
          programType: program_type,
          yearLevel: year_level,
          semester,
          section: normalizedSection,
          instructorId: instructorRecordId,
          cycleId: activeCycle.id,
        })
      ) {
        return sendResponse(
          res,
          409,
          "This course is already assigned to another instructor for the selected program, year, semester, and section.",
          "ይህ ኮርስ በተመረጠው ፕሮግራም፣ ዓመት፣ ሴሚስተር እና ክፍል ለሌላ አስተማሪ ተመድቧል።",
        );
      }
      const isStudentPublished =
        publishTargetValue === "student" || publishTargetValue === "both"
          ? 1
          : 0;
      const isPeerPublished =
        publishTargetValue === "instructor" || publishTargetValue === "both"
          ? 1
          : 0;

      const [result] = await pool.query(
        "INSERT INTO course_assignments (department_id, course_id, instructor_id, program_type, year_level, semester, section, publish_target, is_published, is_student_published, is_peer_published, academic_year, cycle_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          departmentId,
          courseIdNum,
          instructorRecordId,
          program_type,
          year_level,
          semester,
          normalizedSection,
          publishTargetValue,
          publishedVal,
          isStudentPublished,
          isPeerPublished,
          acYear,
          activeCycle.id,
        ],
      );

      if (publishedVal === 1) {
        if (publishTargetValue !== "instructor") {
          let [studentRows] = await pool.query(
            `SELECT id, user_id FROM students s
           WHERE s.department_id = ?
             AND (
               LOWER(TRIM(s.program_type)) = LOWER(TRIM(?))
               OR s.program_type IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )
             AND (
               REGEXP_REPLACE(LOWER(s.year_level), '[^0-9]', '') = REGEXP_REPLACE(LOWER(?), '[^0-9]', '')
               OR s.year_level IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )
             AND (
               LOWER(TRIM(s.semester)) = LOWER(TRIM(?))
               OR s.semester IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )
             AND (
               LOWER(TRIM(s.section)) = LOWER(TRIM(?))
               OR s.section IS NULL
               OR ? IS NULL
               OR ? = ''
               OR LOWER(?) = 'all'
             )`,
            [
              departmentId,
              program_type,
              program_type,
              program_type,
              program_type,
              year_level,
              year_level,
              year_level,
              year_level,
              year_level,
              semester,
              semester,
              semester,
              semester,
              semester,
              normalizedSection,
              normalizedSection,
              normalizedSection,
              normalizedSection,
              normalizedSection,
            ],
          );

          if (!studentRows.length) {
            console.log(
              `[Assign Course Warning] No strict match for Dept ${departmentId}. Falling back to all department students.`,
            );
            [studentRows] = await pool.query(
              `SELECT id, user_id FROM students WHERE department_id = ?`,
              [departmentId],
            );
          }

          console.log(
            `[Assign Course Success] Creating dispatches for ${studentRows.length} students.`,
          );

          for (const student of studentRows) {
            try {
              await pool.query(
                "INSERT INTO evaluation_dispatches (assignment_id, cycle_id, template_id, student_id, student_identifier, course_id, course_name, academic_year, semester, year_level, student_group, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  result.insertId,
                  activeCycle.id,
                  null,
                  student.id,
                  null,
                  courseIdNum,
                  courseRows[0].name || "",
                  acYear,
                  semester,
                  year_level,
                  "student",
                  req.user.id,
                  JSON.stringify({ source: "course_publish" }),
                ],
              );
            } catch (dispatchError) {
              console.warn(
                "Failed to dispatch student evaluation for student",
                student.id,
                dispatchError.message || dispatchError,
              );
            }
          }
        }

        if (publishTargetValue !== "student") {
          await pool.query(`CREATE TABLE IF NOT EXISTS peer_evaluations (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          evaluator_id INT UNSIGNED NOT NULL,
          evaluatee_id INT UNSIGNED NOT NULL,
          course_id INT UNSIGNED DEFAULT NULL,
          deadline VARCHAR(64) DEFAULT '2026-08-17',
          status ENUM('pending', 'submitted') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

          const [courseIdColumn] = await pool.query(
            "SHOW COLUMNS FROM peer_evaluations LIKE 'course_id'",
          );
          if (!courseIdColumn.length) {
            await pool.query(
              "ALTER TABLE peer_evaluations ADD COLUMN course_id INT UNSIGNED DEFAULT NULL",
            );
          }

          console.log(
            "Dispatching to instructors strictly by department_id...",
          );
          const [peerRows] = await pool.query(
            "SELECT user_id FROM instructors WHERE department_id = ? AND id != ?",
            [departmentId, instructorRecordId],
          );
          console.log(
            `Found ${peerRows.length} peer instructors in department ${departmentId}`,
          );
          for (const peer of peerRows) {
            if (!peer.user_id) continue;
            await pool.query(
              "INSERT INTO peer_evaluations (evaluator_id, evaluatee_id, course_id, cycle_id, deadline, status, is_published) VALUES (?, ?, ?, ?, ?, 'pending', 1)",
              [peer.user_id, instructorRecordId, courseIdNum, activeCycle.id, activeCycle.end_at],
            );
          }
        }
      }

      return sendResponse(
        res,
        200,
        "Course assigned successfully",
        "የኮርስ ምውጫ በተሳካ ሁኔታ ተደርጓል።",
        { id: result.insertId },
      );
    } catch (err) {
      console.log("Incoming Assign Payload:", req.body);
      console.error("CRITICAL BACKEND ERROR ON ASSIGN COURSE:");
      console.error("SQL Message:", err.sqlMessage || err.message);
      console.error("Full Error Stack:", err);
      return res.status(500).json({
        error: "Unable to create department assignment.",
        details: err.sqlMessage || err.message,
      });
    }
  },
);

app.get("/api/evaluations", async (req, res) => {
  try {
    const query = `SELECT e.id, e.assignment_id, e.score, e.feedback, e.status, e.created_at, e.updated_at,
      ca.course_code, ca.course_name, ca.assignment_title,
      COALESCE(
        CONCAT(i.first_name, ' ', i.last_name),
        CONCAT(s.first_name, ' ', s.last_name),
        u.username
      ) AS evaluator_name
      FROM evaluations e
      LEFT JOIN course_assignments ca ON e.assignment_id = ca.id
      LEFT JOIN users u ON e.evaluator_id = u.id
      LEFT JOIN instructors i ON i.user_id = u.id
      LEFT JOIN students s ON s.user_id = u.id
      ORDER BY e.created_at DESC`;
    const [rows] = await pool.query(query);
    return sendResponse(
      res,
      200,
      "Evaluations retrieved.",
      "ግምገማዎች ተመልሰዋል።",
      rows,
    );
  } catch (error) {
    console.error(error);
    return sendResponse(
      res,
      500,
      "Unable to retrieve evaluations.",
      "ግምገማዎችን ማግኘት አልተቻለም።",
    );
  }
});

app.post(
  "/api/evaluations",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const {
        assignment_id,
        score,
        feedback = "",
        status = "submitted",
      } = req.body;
      const feedbackValidation = validateEvaluationFeedback({
        "General Comments": feedback,
      });
      if (!feedbackValidation.valid) {
        return sendResponse(
          res,
          400,
          feedbackValidation.message,
          feedbackValidation.messageAm,
        );
      }

      if (!assignment_id || score === undefined) {
        return sendResponse(
          res,
          400,
          "assignment_id and score are required.",
          "assignment_id እና score ያስፈልጋሉ።",
        );
      }

      const [assignmentRows] = await pool.query(
        "SELECT * FROM course_assignments WHERE id = ? LIMIT 1",
        [assignment_id],
      );
      if (!assignmentRows.length) {
        return sendResponse(res, 404, "Assignment not found.", "ስራ አልተገኘም።");
      }

      const cappedScore = Math.min(Math.max(Number(score), 0), 30);
      const evaluatorId = req.user.id;
      const evaluatorRole = req.user.role || "dept_head";

      const [result] = await pool.query(
        "INSERT INTO evaluations (assignment_id, evaluator_id, evaluator_role, score, feedback, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
          assignment_id,
          evaluatorId,
          evaluatorRole,
          cappedScore,
          feedback,
          status,
        ],
      );

      await pool.query(
        "UPDATE course_assignments SET status = ? WHERE id = ?",
        ["evaluated", assignment_id],
      );

      return sendResponse(
        res,
        201,
        "Evaluation submitted successfully.",
        "ግምገማ በተሳካ ሁኔታ ተላክቷል።",
        { id: result.insertId },
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to submit evaluation.",
        "ግምገማ ለመላክ አልተቻለም።",
      );
    }
  },
);

app.get(
  "/api/evaluations/template",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM evaluation_templates ORDER BY updated_at DESC LIMIT 1",
      );
      if (!rows.length) {
        // No template exists yet — return an empty object with 200 so frontend can use defaults
        return sendResponse(
          res,
          200,
          "No evaluation template found; returning empty.",
          "የግምገማ አቅም አልተገኘም፤ ባዶ ነገር ተመልሷል።",
          {},
        );
      }
      return sendResponse(
        res,
        200,
        "Evaluation template loaded.",
        "የግምገማ አቅም ተጫኗል።",
        rows[0],
      );
    } catch (error) {
      console.error(
        "Evaluation template fetch error:",
        error?.message || error,
      );
      // Return an empty object so frontend can proceed using local/default template
      return sendResponse(
        res,
        200,
        "Evaluation template unavailable; returning empty.",
        "የግምገማ አቅም አልተገኘም፤ ባዶ ነገር ተመልሷል።",
        {},
      );
    }
  },
);

app.post(
  "/api/evaluations/template",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const { name = "Student Evaluation Template", template_data } = req.body;
      if (!template_data) {
        return sendResponse(
          res,
          400,
          "Template data is required.",
          "የአቅም ውሂብ ያስፈልጋል።",
        );
      }
      const [result] = await pool.query(
        "INSERT INTO evaluation_templates (name, template_data, created_by) VALUES (?, ?, ?)",
        [name, JSON.stringify(template_data), req.user.id],
      );
      return sendResponse(
        res,
        201,
        "Evaluation template saved.",
        "የግምገማ አቅም ተቀምጧል።",
        { id: result.insertId },
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to save evaluation template.",
        "የግምገማ አቅም ለማስቀመጥ አልተቻለም።",
      );
    }
  },
);

app.put(
  "/api/evaluations/template/:id",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const { name, template_data } = req.body;
      const [rows] = await pool.query(
        "SELECT * FROM evaluation_templates WHERE id = ? LIMIT 1",
        [req.params.id],
      );
      if (!rows.length) {
        return sendResponse(
          res,
          404,
          "Evaluation template not found.",
          "የግምገማ አቅም አልተገኘም።",
        );
      }
      const updateFields = [];
      const values = [];
      if (name) {
        updateFields.push("name = ?");
        values.push(name);
      }
      if (template_data) {
        updateFields.push("template_data = ?");
        values.push(JSON.stringify(template_data));
      }
      if (!updateFields.length) {
        return sendResponse(
          res,
          400,
          "No updates provided.",
          "ምንም የማስተካከያ መረጃ አልተሰጠም።",
        );
      }
      values.push(req.params.id);
      await pool.query(
        `UPDATE evaluation_templates SET ${updateFields.join(", ")} WHERE id = ?`,
        values,
      );
      return sendResponse(
        res,
        200,
        "Evaluation template updated.",
        "የግምገማ አቅም ተዘምኗል።",
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to update evaluation template.",
        "የግምገማ አቅም ለማዘመን አልተቻለም።",
      );
    }
  },
);

const criterionTypes = [
  "student",
  "peer",
  "dept_head",
  "ara_student",
  "ara_peer",
  "ara_dept_head",
];
const criteriaTargetRoles = ["instructor", "lab_assistant"];
const criteriaRoleByType = {
  student: "instructor",
  peer: "instructor",
  dept_head: "instructor",
  ara_student: "lab_assistant",
  ara_peer: "lab_assistant",
  ara_dept_head: "lab_assistant",
};
const isValidCriteriaMapping = (evaluatorType, targetRole) =>
  criteriaRoleByType[evaluatorType] === targetRole;

app.get(
  "/api/admin/criteria",
  authenticate,
  authorizeRoles("admin", "systemadmin"),
  async (req, res) => {
    try {
      const type = req.query.type
        ? String(req.query.type).trim().toLowerCase()
        : null;
      if (type && !criterionTypes.includes(type))
        return res.status(400).json({ message: "Invalid evaluator type." });
      const [rows] = await pool.query(
        `SELECT id, evaluator_type, target_role, criterion_text, criterion_text_am, category, weight, is_active, created_at
       FROM evaluation_criteria ${type ? "WHERE evaluator_type = ?" : ""} ORDER BY evaluator_type ASC, category ASC, id ASC`,
        type ? [type] : [],
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({
        message: "Unable to load all evaluation criteria.",
        error: error.message,
      });
    }
  },
);

app.get(
  "/api/criteria",
  authenticate,
  authorizeRoles(
    "student",
    "instructor",
    "dept_head",
    "college_dean",
    "dean",
    "academic_directorate",
    "academic_director",
    "directorate",
    "admin",
    "systemadmin",
  ),
  async (req, res) => {
    try {
      const type = String(req.query.type || "")
        .trim()
        .toLowerCase();
      if (!criterionTypes.includes(type))
        return res
          .status(400)
          .json({ message: "A valid evaluator type is required." });
      const requestedRole = String(req.query.target_role || "")
        .trim()
        .toLowerCase()
        .replace(/[ -]+/g, "_");
      const roleAliases = {
        teaching_assistant: "ta",
        ara: "lab_assistant",
        lab_assistant: "lab_assistant",
        department_head: "dept_head",
        college_dean: "college_dean",
        academic_director: "academic_directorate",
      };
      const targetRole =
        roleAliases[requestedRole] ||
        requestedRole ||
        (type.startsWith("ara_") ? "lab_assistant" : "instructor");
      if (!isValidCriteriaMapping(type, targetRole))
        return res
          .status(400)
          .json({ message: "A valid target_role is required." });
      const [rows] = await pool.query(
        "SELECT id, evaluator_type, target_role, criterion_text, criterion_text_am, category, weight, is_active, created_at FROM evaluation_criteria WHERE evaluator_type = ? AND is_active = 1 AND target_role IN (?, 'both') ORDER BY category ASC, id ASC",
        [type, targetRole],
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({
        message: "Unable to load evaluation criteria.",
        error: error.message,
      });
    }
  },
);

app.post(
  "/api/admin/criteria",
  authenticate,
  authorizeRoles("admin", "systemadmin"),
  async (req, res) => {
    try {
      const evaluatorType = String(req.body.evaluator_type || "")
        .trim()
        .toLowerCase();
      const targetRole = String(req.body.target_role || "")
        .trim()
        .toLowerCase();
      const criterionText = String(req.body.criterion_text || "").trim();
      const criterionTextAm = String(req.body.criterion_text_am || "").trim();
      const category =
        String(req.body.category || "General").trim() || "General";
      const weight = Number(req.body.weight ?? 5);
      if (
        !criterionTypes.includes(evaluatorType) ||
        !isValidCriteriaMapping(evaluatorType, targetRole) ||
        !criterionText ||
        criterionText.length > 255 ||
        !Number.isInteger(weight) ||
        weight < 1
      ) {
        return res.status(400).json({
          message:
            "evaluator_type, criterion_text, and a positive whole-number weight are required.",
        });
      }
      if (criterionTextAm.length > 255)
        return res.status(400).json({
          message: "criterion_text_am must be 255 characters or fewer.",
        });
      const [result] = await pool.query(
        "INSERT INTO evaluation_criteria (evaluator_type, target_role, criterion_text, criterion_text_am, category, weight, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
        [
          evaluatorType,
          targetRole,
          criterionText,
          criterionTextAm || null,
          category,
          weight,
        ],
      );
      return res.status(201).json({
        id: result.insertId,
        evaluator_type: evaluatorType,
        target_role: targetRole,
        criterion_text: criterionText,
        criterion_text_am: criterionTextAm || null,
        category,
        weight,
        is_active: 1,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Unable to create evaluation criterion.",
        error: error.message,
      });
    }
  },
);

app.put(
  "/api/admin/criteria/:id",
  authenticate,
  authorizeRoles("admin", "systemadmin"),
  async (req, res) => {
    try {
      const criterionId = Number(req.params.id);
      const fields = [];
      const values = [];
      if (req.body.criterion_text !== undefined) {
        const text = String(req.body.criterion_text).trim();
        if (!text || text.length > 255)
          return res
            .status(400)
            .json({ message: "criterion_text must be 1-255 characters." });
        fields.push("criterion_text = ?");
        values.push(text);
      }
      if (req.body.criterion_text_am !== undefined) {
        const textAm = String(req.body.criterion_text_am || "").trim();
        if (textAm.length > 255)
          return res.status(400).json({
            message: "criterion_text_am must be 255 characters or fewer.",
          });
        fields.push("criterion_text_am = ?");
        values.push(textAm || null);
      }
      if (req.body.target_role !== undefined) {
        const targetRole = String(req.body.target_role || "")
          .trim()
          .toLowerCase();
        const [[existingCriterion]] = await pool.query(
          "SELECT evaluator_type FROM evaluation_criteria WHERE id = ? LIMIT 1",
          [criterionId],
        );
        if (
          !existingCriterion ||
          !isValidCriteriaMapping(existingCriterion.evaluator_type, targetRole)
        )
          return res.status(400).json({
            message: "target_role must be instructor or lab_assistant.",
          });
        fields.push("target_role = ?");
        values.push(targetRole);
      }
      if (req.body.category !== undefined) {
        fields.push("category = ?");
        values.push(String(req.body.category).trim() || "General");
      }
      if (req.body.weight !== undefined) {
        const weight = Number(req.body.weight);
        if (!Number.isInteger(weight) || weight < 1)
          return res
            .status(400)
            .json({ message: "weight must be a positive whole number." });
        fields.push("weight = ?");
        values.push(weight);
      }
      if (req.body.is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(req.body.is_active ? 1 : 0);
      }
      if (!Number.isInteger(criterionId) || criterionId <= 0 || !fields.length)
        return res
          .status(400)
          .json({ message: "A valid criterion id and update are required." });
      values.push(criterionId);
      const [result] = await pool.query(
        `UPDATE evaluation_criteria SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
      if (!result.affectedRows)
        return res
          .status(404)
          .json({ message: "Evaluation criterion not found." });
      return res.json({ success: true, id: criterionId });
    } catch (error) {
      return res.status(500).json({
        message: "Unable to update evaluation criterion.",
        error: error.message,
      });
    }
  },
);

app.delete(
  "/api/admin/criteria/:id",
  authenticate,
  authorizeRoles("admin", "systemadmin"),
  async (req, res) => {
    try {
      const criterionId = Number(req.params.id);
      const [result] = await pool.query(
        "UPDATE evaluation_criteria SET is_active = 0 WHERE id = ?",
        [criterionId],
      );
      if (!result.affectedRows)
        return res
          .status(404)
          .json({ message: "Evaluation criterion not found." });
      return res.json({
        success: true,
        message: "Evaluation criterion disabled.",
      });
    } catch (error) {
      return res.status(500).json({
        message: "Unable to disable evaluation criterion.",
        error: error.message,
      });
    }
  },
);

app.post(
  "/api/evaluations/publish-dispatch",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const {
        department_id,
        program_type = null,
        year_level,
        semester,
        section = null,
        academic_year,
      } = req.body;
      const departmentId = await resolveDepartmentId(
        department_id || req.user.department_id || req.user.department,
      );
      if (!departmentId || !year_level || !semester || !academic_year)
        return res.status(400).json({
          message:
            "Batch department, year level, semester, and academic year are required.",
        });

      const [existing] = await pool.query(
        `SELECT id FROM evaluation_dispatches
       WHERE department_id = ? AND program_type <=> ? AND year_level = ? AND semester = ? AND student_group <=> ? AND academic_year = ? AND cycle_id = ?
       LIMIT 1`,
        [
          departmentId,
          program_type,
          year_level,
          semester,
          section,
          academic_year,
          activeCycle.id,
        ],
      );
      if (existing.length) {
        await pool.query(
          "UPDATE evaluation_dispatches SET is_student_published = 1, status = 'pending' WHERE id = ?",
          [existing[0].id],
        );
        return res.json({
          success: true,
          dispatchId: existing[0].id,
          updated: true,
        });
      }

      const [result] = await pool.query(
        `INSERT INTO evaluation_dispatches (cycle_id, department_id, program_type, year_level, semester, student_group, academic_year, is_student_published, status, created_by, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?, ?)`,
        [
          activeCycle.id,
          departmentId,
          program_type,
          year_level,
          semester,
          section,
          academic_year,
          req.user.id,
          JSON.stringify({ source: "batch_publish" }),
        ],
      );
      return res
        .status(201)
        .json({ success: true, dispatchId: result.insertId, updated: false });
    } catch (error) {
      console.error("Batch dispatch publish failed:", error);
      return res.status(500).json({
        message: "Unable to publish evaluation batch.",
        error: error.message,
      });
    }
  },
);

app.get(
  "/api/student/evaluations",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.json([]);
      const [[student]] = await pool.query(
        "SELECT id, department_id, year_level, semester, section, program_type FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!student) return res.json([]);
      const studentDepartmentId = Number(
        req.user?.department_id || student.department_id || 0,
      );
      const [rows] = await pool.query(
        `SELECT DISTINCT ca.id AS assignment_id, ed.id AS dispatch_id, c.code AS course_code, c.name AS course_name,
        ca.year_level, ca.semester, ca.section, ca.program_type,
        evaluation_window.end_at AS deadline,
        evaluation_window.end_at AS expiryDate,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name
       FROM course_assignments ca
       INNER JOIN courses c ON c.id = ca.course_id
       LEFT JOIN department_evaluation_windows evaluation_window
         ON evaluation_window.department_id = ca.department_id
        AND evaluation_window.is_active = TRUE
       LEFT JOIN instructors i ON i.id = ca.instructor_id
       INNER JOIN evaluation_dispatches ed ON ed.department_id = ca.department_id
         AND ed.year_level = ca.year_level AND ed.semester = ca.semester
         AND ed.academic_year = ca.academic_year AND ed.is_student_published = 1
         AND ed.cycle_id = ca.cycle_id
         AND (ed.program_type IS NULL OR ed.program_type = ca.program_type)
         AND (ed.student_group IS NULL OR ed.student_group = ca.section)
       WHERE ca.department_id = ? AND ca.cycle_id = ? AND ca.year_level = ? AND ca.semester = ?
         AND ca.section = ? AND ca.program_type = ?
       ORDER BY c.code ASC`,
        [
          studentDepartmentId,
          activeCycle.id,
          student.year_level,
          student.semester,
          student.section,
          student.program_type,
        ],
      );
      return res.json(rows);
    } catch (error) {
      return res.status(500).json({
        message: "Unable to load student evaluations.",
        error: error.message,
      });
    }
  },
);

app.put(
  "/api/course-assignments/:assignmentId",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    let connection;
    let transactionStarted = false;
    const respond = async (status, body) => {
      if (transactionStarted) {
        await connection.rollback();
        transactionStarted = false;
      }
      return res.status(status).json(body);
    };

    try {
      const assignmentId = Number(req.params.assignmentId);
      const courseId = Number(req.body?.course_id);
      const instructorId = Number(req.body?.instructor_id);
      const programType = String(req.body?.program_type || "").trim();
      const yearLevel = String(req.body?.year_level || "").trim();
      const semester = String(req.body?.semester || "").trim();
      const section = normalizeSectionValue(req.body?.section);
      if (
        !Number.isInteger(assignmentId) || assignmentId <= 0 ||
        !Number.isInteger(courseId) || courseId <= 0 ||
        !Number.isInteger(instructorId) || instructorId <= 0 ||
        !programType || !yearLevel || !semester || !section
      ) {
        return res.status(400).json({
          success: false,
          message: "All course assignment fields are required and must be valid.",
        });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();
      transactionStarted = true;
      const activeCycle = await getActiveEvaluationCycle(connection);
      if (!activeCycle) {
        return respond(409, {
          success: false,
          message: "There is no active evaluation cycle.",
        });
      }

      const [[assignment]] = await connection.query(
        `SELECT id, department_id, course_id, instructor_id, cycle_id,
           is_student_published, is_peer_published
         FROM course_assignments
         WHERE id = ? AND cycle_id = ?
         LIMIT 1 FOR UPDATE`,
        [assignmentId, activeCycle.id],
      );
      if (!assignment) {
        return respond(404, {
          success: false,
          message: "Course assignment not found in the active cycle.",
        });
      }
      if (
        req.user.role === "dept_head" &&
        Number(assignment.department_id) !== Number(req.user.department_id)
      ) {
        return respond(403, {
          success: false,
          message: "You can only edit assignments in your department.",
        });
      }
      if (assignment.is_student_published || assignment.is_peer_published) {
        return respond(409, {
          success: false,
          message: "Unpublish evaluations before editing this assignment.",
        });
      }

      const [[course]] = await connection.query(
        "SELECT id, department_id FROM courses WHERE id = ? LIMIT 1",
        [courseId],
      );
      const [[instructor]] = await connection.query(
        `SELECT i.id, i.department_id
         FROM instructors i
         INNER JOIN users u ON u.id = i.user_id
         WHERE i.id = ?
           AND LOWER(COALESCE(u.status, 'active')) = 'active'
         LIMIT 1`,
        [instructorId],
      );
      if (!course) {
        return respond(404, { success: false, message: "Course not found." });
      }
      if (!instructor) {
        return respond(404, { success: false, message: "Instructor not found." });
      }
      if (
        Number(course.department_id) !== Number(assignment.department_id) ||
        Number(instructor.department_id) !== Number(assignment.department_id)
      ) {
        return respond(403, {
          success: false,
          message: "Course and instructor must belong to the assignment department.",
        });
      }

      const [[dispatch]] = await connection.query(
        "SELECT id FROM evaluation_dispatches WHERE assignment_id = ? LIMIT 1",
        [assignmentId],
      );
      const [[peerEvaluation]] = await connection.query(
        `SELECT id FROM peer_evaluations
         WHERE course_id = ? AND evaluatee_id = ? AND cycle_id = ?
         LIMIT 1`,
        [assignment.course_id, assignment.instructor_id, assignment.cycle_id],
      );
      const [[studentSubmission]] = await connection.query(
        `SELECT ses.id
         FROM student_evaluation_submissions ses
         INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
         WHERE ed.assignment_id = ?
         LIMIT 1`,
        [assignmentId],
      );
      const [[peerSubmission]] = await connection.query(
        `SELECT pes.id
         FROM peer_evaluation_submissions pes
         INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
         WHERE pe.course_id = ? AND pe.evaluatee_id = ? AND pe.cycle_id = ?
         LIMIT 1`,
        [assignment.course_id, assignment.instructor_id, assignment.cycle_id],
      );
      if (dispatch || peerEvaluation || studentSubmission || peerSubmission) {
        return respond(409, {
          success: false,
          message: "This assignment is already linked to evaluation activity and cannot be edited.",
        });
      }

      const [[conflict]] = await connection.query(
        `SELECT id FROM course_assignments
         WHERE id <> ? AND department_id = ? AND course_id = ?
           AND LOWER(TRIM(COALESCE(program_type, ''))) = LOWER(TRIM(?))
           AND LOWER(TRIM(COALESCE(year_level, ''))) = LOWER(TRIM(?))
           AND LOWER(TRIM(COALESCE(semester, ''))) = LOWER(TRIM(?))
           AND LOWER(TRIM(COALESCE(section, ''))) = LOWER(TRIM(?))
           AND cycle_id = ?
         LIMIT 1`,
        [
          assignmentId,
          assignment.department_id,
          courseId,
          programType,
          yearLevel,
          semester,
          section,
          activeCycle.id,
        ],
      );
      if (conflict) {
        return respond(409, {
          success: false,
          message: "Another assignment already exists for this course and student group.",
        });
      }

      await connection.query(
        `UPDATE course_assignments
         SET course_id = ?, instructor_id = ?, program_type = ?,
           year_level = ?, semester = ?, section = ?
         WHERE id = ? AND cycle_id = ?`,
        [
          courseId,
          instructorId,
          programType,
          yearLevel,
          semester,
          section,
          assignmentId,
          activeCycle.id,
        ],
      );
      await connection.commit();
      transactionStarted = false;
      return res.json({
        success: true,
        message: "Course assignment updated successfully.",
        data: {
          id: assignmentId,
          course_id: courseId,
          instructor_id: instructorId,
          program_type: programType,
          year_level: yearLevel,
          semester,
          section,
        },
      });
    } catch (error) {
      if (transactionStarted) {
        await connection.rollback().catch((rollbackError) => {
          console.error("Assignment update rollback failed:", rollbackError);
        });
        transactionStarted = false;
      }
      console.error("Course assignment update failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update course assignment.",
      });
    } finally {
      connection?.release();
    }
  },
);

app.delete(
  "/api/courses/assign/:assignmentId",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const activeCycle = await getActiveEvaluationCycle(connection);
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const assignmentId = Number(req.params.assignmentId);
      if (!Number.isInteger(assignmentId) || assignmentId <= 0)
        return res.status(400).json({ message: "Invalid assignment ID." });
      const [rows] = await connection.query(
        "SELECT id, department_id, course_id, instructor_id, cycle_id FROM course_assignments WHERE id = ? AND cycle_id = ? LIMIT 1",
        [assignmentId, activeCycle.id],
      );
      if (!rows.length)
        return res
          .status(404)
          .json({ message: "Course assignment not found." });
      const assignment = rows[0];
      if (
        req.user.role === "dept_head" &&
        Number(assignment.department_id) !== Number(req.user.department_id)
      )
        return res.status(403).json({
          message: "You can only delete assignments in your department.",
        });

      const [submittedStudents] = await connection.query(
        "SELECT ses.id FROM student_evaluation_submissions ses INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id WHERE ed.assignment_id = ? LIMIT 1",
        [assignmentId],
      );
      const [submittedPeers] = await connection.query(
        "SELECT pes.id FROM peer_evaluation_submissions pes INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id WHERE pe.course_id = ? AND pe.evaluatee_id = ? AND pe.cycle_id = ? LIMIT 1",
        [assignment.course_id, assignment.instructor_id, assignment.cycle_id],
      );
      if (submittedStudents.length || submittedPeers.length)
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete this assignment because evaluations have already been submitted.",
        });

      await connection.beginTransaction();
      await connection.query(
        "DELETE FROM evaluation_dispatches WHERE assignment_id = ?",
        [assignmentId],
      );
      await connection.query(
        "DELETE FROM peer_evaluations WHERE course_id = ? AND evaluatee_id = ? AND cycle_id = ?",
        [assignment.course_id, assignment.instructor_id, assignment.cycle_id],
      );
      await connection.query("DELETE FROM course_assignments WHERE id = ?", [
        assignmentId,
      ]);
      await connection.commit();
      return res.json({
        success: true,
        message: "Course assignment deleted successfully.",
      });
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Assignment delete rollback failed:", rollbackError);
      }
      return res.status(500).json({
        message: "Unable to delete course assignment.",
        error: error.message,
      });
    } finally {
      connection.release();
    }
  },
);

app.post(
  "/api/evaluations/dispatch",
  authenticate,
  authorizeRoles("dept_head", "admin"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(409).json({ message: "There is no active evaluation cycle." });
      const {
        template_id = null,
        student_id = null,
        student_identifier = null,
        student_group = null,
        course_code = null,
        course_name = null,
        academic_year = null,
        semester = null,
        year_level = null,
        student_identifier_text = null,
        payload = {},
      } = req.body;

      if (
        !course_code ||
        !course_name ||
        !academic_year ||
        !semester ||
        !year_level
      ) {
        return sendResponse(
          res,
          400,
          "Required dispatch fields are missing.",
          "የማስተላለፊያ አስፈላጊ መረጃዎች የጎደሉት ናቸው።",
        );
      }
      if (String(academic_year) !== String(activeCycle.academic_year)) {
        return res.status(409).json({
          message: `The active evaluation cycle is ${activeCycle.academic_year} ${activeCycle.semester}.`,
        });
      }

      const requesterDepartmentId =
        String(req.user?.role || "").toLowerCase() === "dept_head"
          ? Number(req.user.department_id || req.user.department || 0)
          : 0;
      if (
        String(req.user?.role || "").toLowerCase() === "dept_head" &&
        !requesterDepartmentId
      ) {
        return res.status(403).json({
          message: "Your department is not defined. Contact an administrator.",
        });
      }

      // If a course_code is provided, attempt to dispatch to all students assigned to that course
      const assignmentScope = requesterDepartmentId
        ? " AND department_id = ?"
        : "";
      const assignmentParams = requesterDepartmentId
        ? [course_code, requesterDepartmentId, activeCycle.id]
        : [course_code, activeCycle.id];
      const [assignedStudents] = await pool.query(
        `SELECT DISTINCT student_id, department_id FROM course_assignments WHERE course_code = ?${assignmentScope} AND cycle_id = ? AND student_id IS NOT NULL`,
        assignmentParams,
      );

      if (assignedStudents.length) {
        const insertedIds = [];
        for (const row of assignedStudents) {
          try {
            const [r] = await pool.query(
              "INSERT INTO evaluation_dispatches (cycle_id, template_id, student_id, department_id, student_identifier, course_code, course_name, academic_year, semester, year_level, student_group, student_identifier_text, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                activeCycle.id,
                template_id,
                row.student_id,
                row.department_id || requesterDepartmentId || null,
                null,
                course_code,
                course_name,
                academic_year,
                semester,
                year_level,
                student_group,
                student_identifier_text,
                req.user.id,
                JSON.stringify(payload),
              ],
            );
            insertedIds.push(r.insertId);
          } catch (err) {
            console.warn(
              "Failed to insert dispatch for student",
              row.student_id,
              err.message || err,
            );
          }
        }
        return sendResponse(
          res,
          201,
          "Student evaluations dispatched to course students.",
          "የተማሪ ግምገማዎች ወደ ኮርስ ተማሪዎች ተልከዋል።",
          { created: insertedIds.length, ids: insertedIds },
        );
      }

      // Fallback: create a generic dispatch (e.g., for a group or individual identifier)
      if (requesterDepartmentId && student_id) {
        const [[studentRow]] = await pool.query(
          "SELECT department_id FROM students WHERE id = ? LIMIT 1",
          [student_id],
        );
        if (
          !studentRow ||
          Number(studentRow.department_id) !== requesterDepartmentId
        ) {
          return res.status(403).json({
            message:
              "You can only dispatch evaluations within your department.",
          });
        }
      }
      const [result] = await pool.query(
        "INSERT INTO evaluation_dispatches (cycle_id, template_id, student_id, department_id, student_identifier, course_code, course_name, academic_year, semester, year_level, student_group, student_identifier_text, created_by, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          activeCycle.id,
          template_id,
          student_id,
          requesterDepartmentId || null,
          student_identifier,
          course_code,
          course_name,
          academic_year,
          semester,
          year_level,
          student_group,
          student_identifier_text,
          req.user.id,
          JSON.stringify(payload),
        ],
      );

      return sendResponse(
        res,
        201,
        "Student evaluation dispatched successfully.",
        "የተማሪ ግምገማ በተሳካ ሁኔታ ተላክቷል።",
        { id: result.insertId },
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to dispatch evaluation.",
        "ግምገማ ለማስተላለፍ አልተቻለም።",
      );
    }
  },
);

app.get(
  "/api/student/profile",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      if (!req.user) {
        throw new Error("Authenticated user is required");
      }

      const [rows] = await pool.query(
        `SELECT u.id AS user_id,
        u.username,
        s.id AS student_row_id,
        s.student_id,
        s.first_name,
        s.last_name,
        s.department_id,
        TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS full_name,
        d.name AS department_name,
        s.program_type,
        s.program_type AS program,
        s.year_level,
        s.semester,
        s.section
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE u.id = ? LIMIT 1`,
        [req.user.id],
      );

      if (!rows.length) {
        return sendResponse(
          res,
          200,
          "Student profile retrieved successfully.",
          "የተማሪ መረጃ በትክክል ተቀርቧል።",
          {
            user_id: req.user.id,
            student_id: null,
            username: req.user.username,
            full_name: req.user.username,
            department_id: null,
            department_name: null,
            program_type: null,
            year_level: null,
            semester: null,
            section: null,
          },
        );
      }

      const profile = rows[0];
      const fullName =
        profile.full_name && profile.full_name.trim()
          ? profile.full_name
          : profile.first_name && profile.last_name
            ? `${profile.first_name} ${profile.last_name}`
            : profile.username || "Student";

      profile.full_name = fullName;
      profile.first_name = profile.first_name || profile.username || "";
      profile.last_name = profile.last_name || "";
      profile.program = profile.program_type || null;

      return sendResponse(
        res,
        200,
        "Student profile retrieved successfully.",
        "የተማሪ መረጃ በትክክል ተቀርቧል።",
        profile,
      );
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Unable to load student profile.",
      });
    }
  },
);

app.get(
  "/api/instructor/profile",
  authenticate,
  authorizeRoles("instructor"),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
        i.id,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS full_name,
        d.name AS department_name,
        i.phone_number,
        i.gender
      FROM instructors i
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE i.user_id = ? LIMIT 1`,
        [req.user.id],
      );

      if (!rows.length) {
        return sendResponse(
          res,
          404,
          "Instructor profile not found.",
          "የመምህር መገለጫ አልተገኘም።",
        );
      }

      return sendResponse(
        res,
        200,
        "Instructor profile retrieved successfully.",
        "የመምህር መገለጫ ተቀርቧል።",
        rows[0],
      );
    } catch (error) {
      console.error("Instructor profile error:", error);
      return res
        .status(500)
        .json({ message: "Unable to load instructor profile." });
    }
  },
);

app.get(
  [
    "/api/instructor/performance-summary",
    "/api/lab-assistant/performance-summary",
  ],
  authenticate,
  authorizeRoles(
    "instructor",
    "lab_assistant",
    "academic_directorate",
    "academic_director",
    "directorate",
  ),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      const [instructorRows] = await pool.query(
        "SELECT id, department_id FROM instructors WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!instructorRows.length) {
        return sendResponse(
          res,
          404,
          "Instructor profile not found.",
          "የመምህር መገለጫ አልተገኘም።",
        );
      }

      const instructor = instructorRows[0];
      const [studentRows] = await pool.query(
        `SELECT ses.score, ses.feedback, ses.responses, ed.course_name, ses.created_at
       FROM student_evaluation_submissions ses
       JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
       LEFT JOIN course_assignments ca ON (ca.id = ed.assignment_id OR (ca.student_id = ed.student_id AND ca.course_id = ed.course_id))
         AND ca.cycle_id = ed.cycle_id
      LEFT JOIN instructors ara ON ara.id = JSON_UNQUOTE(JSON_EXTRACT(ed.payload, '$.lab_assistant_id'))
      WHERE (ca.instructor_id = ? OR (ed.student_group = 'lab_assistant' AND ara.id = ?))
        AND ed.cycle_id = ? AND ses.status = 'submitted'
      ORDER BY ses.created_at DESC`,
       [instructor.id, instructor.id, activeCycle.id],
      );
      const [deptHeadRows] = await pool.query(
        `SELECT dhe.total_score AS score, dhe.criteria_scores,
          dhe.strengths, dhe.weaknesses, dhe.general_comments, dhe.created_at
       FROM dept_head_evaluations dhe
       WHERE dhe.instructor_id = ? AND dhe.cycle_id = ?
         AND LOWER(TRIM(dhe.status)) IN ('submitted', 'completed', 'approved')
       ORDER BY dhe.created_at DESC`,
        [instructor.id, activeCycle.id],
      );
      const [peerRows] = await pool.query(
        `SELECT pes.score, pes.strengths, pes.suggestions, pes.responses, pes.created_at
       FROM peer_evaluation_submissions pes
       JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
       JOIN instructors target ON target.id = pe.evaluatee_id
       JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
       JOIN users evaluator_user ON evaluator_user.id = evaluator.user_id
       JOIN users target_user ON target_user.id = target.user_id
       LEFT JOIN departments evaluator_department
         ON evaluator_department.id = COALESCE(evaluator.department_id, evaluator_user.department_id)
       LEFT JOIN departments target_department
         ON target_department.id = COALESCE(target.department_id, target_user.department_id)
       WHERE pe.evaluatee_id = ? AND pe.cycle_id = ?
         AND (
           (
             LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_'))
               IN ('lab_assistant', 'ara', 'labassistant')
             AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_user.role, '')), '-', '_'), ' ', '_'))
               IN ('lab_assistant', 'ara', 'labassistant')
             AND COALESCE(evaluator_user.college_id, evaluator_department.college_id)
               = COALESCE(target_user.college_id, target_department.college_id)
           )
           OR (
             LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_'))
               NOT IN ('lab_assistant', 'ara', 'labassistant')
             AND (? = 0 OR LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_')) = 'instructor')
             AND evaluator.department_id = target.department_id
             AND pe.is_published = 1
           )
         )
         AND LOWER(TRIM(pes.status)) IN ('submitted', 'completed', 'approved')
       ORDER BY pes.created_at DESC`,
        [instructor.id, activeCycle.id, isAcademicLeaderRole(req.user.role) ? 1 : 0],
      );
      const [[teachingRow]] = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM course_assignments
           WHERE instructor_id = ? AND cycle_id = ?
         ) AS is_teaching`,
        [instructor.id, activeCycle.id],
      );

      const parseJson = (value) => {
        if (!value) return {};
        if (typeof value === "object") return value;
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      };
      const average = (rows) =>
        rows.length
          ? rows.reduce((total, row) => total + Number(row.score || 0), 0) /
            rows.length
          : 0;
      const scores = {
        student: average(studentRows),
        deptHead: average(deptHeadRows),
        peer: average(peerRows),
      };
      const isTeaching = Boolean(teachingRow?.is_teaching);
      const totalScore = calculatePerformanceScore({
        isTeaching,
        isLabAssistant: isLabAssistantRole(req.user.role),
        studentScore: scores.student,
        peerScore: scores.peer,
        supervisorScore: scores.deptHead,
      }).totalScore;
      const status =
        totalScore >= 85
          ? "Excellent"
          : totalScore >= 70
            ? "Good"
            : totalScore >= 50
              ? "Needs Improvement"
              : "At Risk";
      const badgeColor =
        totalScore >= 85
          ? "emerald"
          : totalScore >= 70
            ? "blue"
            : totalScore >= 50
              ? "amber"
              : "red";
      const strengths = [];
      const improvements = [];
      const feedbackBySource = {
        student: { strengths: [], weaknesses: [] },
        peer: { strengths: [], weaknesses: [] },
        deptHead: { strengths: [], weaknesses: [] },
        collegeDean: { strengths: [], weaknesses: [] },
        academicDirector: { strengths: [], weaknesses: [] },
      };
      const addUnique = (list, value) => {
        const text = String(value || "").trim();
        if (text && !list.includes(text)) list.push(text);
      };
      const classifyRemark = (text, score, fallback, source) => {
        const normalized = String(text || "").trim();
        if (!normalized) {
          addUnique(score >= 70 ? strengths : improvements, fallback);
          addUnique(
            score >= 70
              ? feedbackBySource[source].strengths
              : feedbackBySource[source].weaknesses,
            fallback,
          );
          return;
        }
        const indicatesImprovement =
          /improv|enhanc|weak|need|lack|late|timely|คว|should|suggest/i.test(
            normalized,
          );
        addUnique(
          indicatesImprovement || score < 50 ? improvements : strengths,
          normalized,
        );
        addUnique(
          indicatesImprovement || score < 50
            ? feedbackBySource[source].weaknesses
            : feedbackBySource[source].strengths,
          normalized,
        );
      };

      studentRows.forEach((row) =>
        classifyRemark(
          row.feedback,
          Number(row.score || 0),
          "Maintains positive engagement with students.",
          "student",
        ),
      );
      deptHeadRows.forEach((row) => {
        const criteria = parseJson(row.criteria_scores);
        addUnique(strengths, row.strengths);
        addUnique(feedbackBySource.deptHead.strengths, row.strengths);
        addUnique(improvements, row.weaknesses);
        addUnique(feedbackBySource.deptHead.weaknesses, row.weaknesses);
        classifyRemark(
          criteria.remarks || criteria.feedback,
          Number(row.score || 0),
          "Demonstrates consistent professional performance.",
          "deptHead",
        );
        if (row.general_comments) {
          classifyRemark(
            row.general_comments,
            Number(row.score || 0),
            "",
            "deptHead",
          );
        }
      });
      peerRows.forEach((row) => {
        addUnique(strengths, row.strengths);
        addUnique(improvements, row.suggestions);
        addUnique(feedbackBySource.peer.strengths, row.strengths);
        addUnique(feedbackBySource.peer.weaknesses, row.suggestions);
      });

      if (!strengths.length)
        addUnique(strengths, "No positive highlights have been recorded yet.");
      if (!improvements.length)
        addUnique(improvements, "No improvement areas have been recorded yet.");

      return sendResponse(
        res,
        200,
        "Performance summary retrieved.",
        "የአፈጻጸም ማጠቃለያ ተመለሰ።",
        {
          totalWeightedScore: Number(totalScore.toFixed(2)),
          is_teaching: isTeaching,
          status,
          badgeColor,
          sourceScores: {
            student: Number(scores.student.toFixed(2)),
            peer: Number(scores.peer.toFixed(2)),
            deptHead: Number(scores.deptHead.toFixed(2)),
            collegeDean: 0,
            academicDirector: 0,
          },
          feedbackBySource,
          feedback: { strengths, improvements },
        },
      );
    } catch (error) {
      console.error("Performance dashboard error:", error);
      return sendResponse(
        res,
        500,
        "Unable to retrieve performance dashboard.",
        "የአፈጻጸም ዳሽቦርድን ማግኘት አልተቻለም።",
      );
    }
  },
);

app.get(
  "/api/student/pending-evaluations",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      if (!req.user) {
        console.warn(
          "Request missing authenticated user for pending evaluations",
        );
        return sendResponse(
          res,
          200,
          "Pending evaluations retrieved successfully.",
          "የቅድሚያ ግምገማዎች በትክክል ተቀርቧል።",
          {
            evaluations: [],
            deadline: null,
            expiryDate: null,
            isExpired: false,
          },
        );
      }

      const [studentRows] = await pool.query(
        "SELECT department_id, year_level, semester, section FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );

      if (!studentRows.length) {
        return sendResponse(
          res,
          200,
          "Pending evaluations retrieved successfully.",
          "የቅድሚያ ግምገማዎች በትክክል ተቀርቧል።",
          {
            evaluations: [],
            deadline: null,
            expiryDate: null,
            isExpired: false,
          },
        );
      }

      const student = studentRows[0];
      const studentDepartmentId = Number(
        req.user?.department_id || student.department_id || 0,
      );
      const activeCycle = await getActiveEvaluationCycle();
      const evaluationDeadline = await getDepartmentEvaluationDeadline(
        studentDepartmentId,
        activeCycle?.end_at,
      );
      const isExpired = isEvaluationDeadlineExpired(evaluationDeadline);
      if (isExpired || !activeCycle) {
        return sendResponse(
          res,
          200,
          "Pending evaluations retrieved successfully.",
          "የቅድሚያ ግምገማዎች በትክክል ተቀርቧል።",
          {
            evaluations: [],
            deadline: evaluationDeadline,
            expiryDate: evaluationDeadline,
            isExpired,
          },
        );
      }
      const normalizedSection = normalizeSectionValue(student.section);
      const [rows] = await pool.query(
        `SELECT c.code AS course_code, c.name AS course_name,
        CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
        'instructor' AS target_role,
        ? AS deadline,
        ca.id AS assignment_id,
        ca.is_published,
        ca.is_student_published,
        ca.is_peer_published
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      LEFT JOIN instructors i ON ca.instructor_id = i.id
      WHERE ca.department_id = ?
        AND ca.cycle_id = ?
        AND LOWER(TRIM(ca.year_level)) = LOWER(TRIM(?))
        AND LOWER(TRIM(ca.semester)) = LOWER(TRIM(?))
        AND LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) =
            LOWER(TRIM(REPLACE(REPLACE(?, 'Section ', ''), 'section ', '')))
        AND ca.is_student_published = 1
      UNION ALL
      SELECT 'LAB' AS course_code, 'Lab Assistant Evaluation' AS course_name,
        CONCAT(COALESCE(lab_i.first_name, ''), ' ', COALESCE(lab_i.last_name, '')) AS instructor_name,
        'lab_assistant' AS target_role,
        ? AS deadline,
        MIN(ca.id) AS assignment_id,
        MAX(ca.is_published) AS is_published,
        MAX(ca.is_student_published) AS is_student_published,
        MAX(ca.is_peer_published) AS is_peer_published
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      JOIN lab_assignment_evaluations lae
        ON lae.course_id = ca.course_id
       AND lae.section_id = ca.id
       AND CONVERT(lae.year_level USING utf8mb4) COLLATE utf8mb4_general_ci =
           CONVERT(ca.year_level USING utf8mb4) COLLATE utf8mb4_general_ci
       AND CONVERT(lae.semester USING utf8mb4) COLLATE utf8mb4_general_ci =
           CONVERT(ca.semester USING utf8mb4) COLLATE utf8mb4_general_ci
       AND lae.is_published = 1
      JOIN instructors lab_i ON lab_i.id = lae.lab_assistant_id
      JOIN users target_u ON target_u.id = lab_i.user_id
      WHERE ca.cycle_id = ?
        AND ca.department_id = ?
        AND LOWER(TRIM(ca.year_level)) = LOWER(TRIM(?))
        AND LOWER(TRIM(ca.semester)) = LOWER(TRIM(?))
        AND LOWER(TRIM(REPLACE(REPLACE(ca.section, 'Section ', ''), 'section ', ''))) =
            LOWER(TRIM(REPLACE(REPLACE(?, 'Section ', ''), 'section ', '')))
        AND ca.is_student_published = 1
        AND LOWER(COALESCE(target_u.status, 'active')) = 'active'
        AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_u.role, '')), '-', '_'), ' ', '_')) IN ('lab_assistant', 'ara')
      GROUP BY lae.lab_assistant_id, lab_i.id, lab_i.first_name, lab_i.last_name
      ORDER BY course_code ASC`,
        [
          evaluationDeadline,
          studentDepartmentId,
          activeCycle.id,
          student.year_level,
          student.semester,
          normalizedSection,
          evaluationDeadline,
          activeCycle.id,
          studentDepartmentId,
          student.year_level,
          student.semester,
          normalizedSection,
        ],
      );

      return sendResponse(
        res,
        200,
        "Pending evaluations retrieved successfully.",
        "የቅድሚያ ግምገማዎች በትክክል ተቀርቧል።",
        {
          evaluations: rows.map((row) => ({
            ...row,
            deadline: evaluationDeadline,
            expiryDate: evaluationDeadline,
          })),
          deadline: evaluationDeadline,
          expiryDate: evaluationDeadline,
          isExpired: false,
        },
      );
    } catch (error) {
      console.error("Pending student evaluations fetch failed:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve pending student evaluations.",
      });
    }
  },
);

app.get(
  "/api/student/evaluations/pending",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      if (!req.user) {
        console.warn("Pending evaluations request missing authenticated user.");
        return res.status(401).json({
          success: false,
          message: "Authentication is required.",
        });
      }

      const [studentRows] = await pool.query(
        "SELECT id, department_id, year_level, semester, section, program_type FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!studentRows.length) {
        return res.status(200).json({
          success: true,
          data: {
            evaluations: [],
            deadline: null,
            expiryDate: null,
            isExpired: false,
          },
        });
      }

      const student = studentRows[0];
      const studentDepartmentId = Number(
        req.user?.department_id || student.department_id || 0,
      );
      const evaluationDeadline = await getDepartmentEvaluationDeadline(
        studentDepartmentId,
      );

      const [rows] = await pool.query(
        `SELECT ed.id,
        COALESCE(NULLIF(ec.end_at, ''), ?) AS deadline,
        ed.template_id,
        ed.student_id,
        CASE WHEN ed.student_group = 'lab_assistant'
          THEN 'LAB'
          ELSE COALESCE(ed.course_code, c.code)
        END AS course_code,
        CASE WHEN ed.student_group = 'lab_assistant'
          THEN 'Lab Assistant Evaluation'
          ELSE COALESCE(ed.course_name, c.name)
        END AS course_name,
        ed.academic_year,
        ed.semester,
        ed.year_level,
        ed.student_group,
        ed.student_identifier_text,
        ed.payload,
        ed.status,
        ed.created_at,
        TRIM(CONCAT(
          COALESCE(
            CASE WHEN ed.student_group = 'lab_assistant' THEN target_i.first_name ELSE i.first_name END,
            ''
          ),
          ' ',
          COALESCE(
            CASE WHEN ed.student_group = 'lab_assistant' THEN target_i.last_name ELSE i.last_name END,
            ''
          )
        )) AS instructor_name,
        CASE 
          WHEN ed.student_group = 'lab_assistant' THEN 'lab_assistant'
          WHEN LOWER(TRIM(COALESCE(target_user.role, ''))) IN ('lab_assistant', 'ara', 'lab assistant', 'lab-assistant') THEN 'lab_assistant'
          ELSE COALESCE(target_user.role, 'instructor')
        END AS target_role,
        COALESCE(target_department.name, assignment_department.name) AS department_name,
        COALESCE(target_college.name, assignment_college.name) AS college_name,
        ses.score AS total_score,
        ses.feedback,
        ses.responses,
        ses.status AS submission_status,
        ses.id AS submission_id,
        CASE WHEN ses.id IS NOT NULL THEN 1 ELSE 0 END AS is_evaluated
      FROM evaluation_dispatches ed
      LEFT JOIN evaluation_cycles ec ON ec.id = ed.cycle_id
      LEFT JOIN courses c ON ed.course_id = c.id
      LEFT JOIN lab_classes lc ON lc.course_id = c.id
      LEFT JOIN course_assignments ca ON ca.id = ed.assignment_id
        AND ca.academic_year = ed.academic_year
        AND ca.semester = ed.semester
      LEFT JOIN (
        SELECT
          student_id,
          cycle_id,
          JSON_UNQUOTE(JSON_EXTRACT(payload, '$.lab_assistant_id')) AS lab_assistant_id,
          MIN(id) AS dispatch_id
        FROM evaluation_dispatches
        WHERE student_group = 'lab_assistant'
          AND is_student_published = 1
        GROUP BY student_id, cycle_id,
          JSON_UNQUOTE(JSON_EXTRACT(payload, '$.lab_assistant_id'))
      ) lab_dispatch
        ON lab_dispatch.student_id = ed.student_id
        AND lab_dispatch.cycle_id <=> ed.cycle_id
        AND lab_dispatch.lab_assistant_id =
            JSON_UNQUOTE(JSON_EXTRACT(ed.payload, '$.lab_assistant_id'))
      LEFT JOIN instructors i ON ca.instructor_id = i.id
      LEFT JOIN instructors target_i ON target_i.id = JSON_UNQUOTE(JSON_EXTRACT(ed.payload, '$.lab_assistant_id'))
      LEFT JOIN lab_assignment_evaluations lae
        ON lae.course_id = ed.course_id
        AND lae.section_id = ed.assignment_id
        AND CONVERT(lae.year_level USING utf8mb4) COLLATE utf8mb4_general_ci =
            CONVERT(ed.year_level USING utf8mb4) COLLATE utf8mb4_general_ci
        AND CONVERT(lae.semester USING utf8mb4) COLLATE utf8mb4_general_ci =
            CONVERT(ed.semester USING utf8mb4) COLLATE utf8mb4_general_ci
        AND lae.lab_assistant_id = target_i.id
        AND lae.is_published = 1
      LEFT JOIN users target_user ON target_user.id = CASE WHEN ed.student_group = 'lab_assistant' THEN target_i.user_id ELSE i.user_id END
      LEFT JOIN departments assignment_department ON assignment_department.id = ca.department_id
      LEFT JOIN colleges assignment_college ON assignment_college.id = assignment_department.college_id
      LEFT JOIN departments target_department ON target_department.id = target_i.department_id
      LEFT JOIN colleges target_college ON target_college.id = target_department.college_id
      LEFT JOIN student_evaluation_submissions ses ON ses.dispatch_id = ed.id
      WHERE ed.student_id = ? AND ed.is_student_published = 1
        AND COALESCE(ed.department_id, ca.department_id) = ?
        AND (
          LOWER(TRIM(COALESCE(ed.student_group, ''))) <> 'lab_assistant'
          OR (
            ed.id = lab_dispatch.dispatch_id
            AND
            ca.id IS NOT NULL
            AND JSON_UNQUOTE(JSON_EXTRACT(ed.payload, '$.requires_lab')) = 'true'
            AND lae.id IS NOT NULL
            AND target_i.department_id = ca.department_id
            AND LOWER(COALESCE(target_user.status, 'active')) = 'active'
            AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_user.role, '')), '-', '_'), ' ', '_'))
              IN ('lab_assistant', 'ara')
          )
        )
      ORDER BY ed.created_at DESC`,
        [
          evaluationDeadline,
          student.id,
          studentDepartmentId,
        ],
      );

      const normalized = rows.map((row) => ({
        ...row,
        deadline: evaluationDeadline,
        expiryDate: evaluationDeadline,
        total_score: row.total_score !== null ? Number(row.total_score) : 0,
        is_evaluated: Boolean(row.is_evaluated),
        responses: row.responses
          ? typeof row.responses === "string"
            ? JSON.parse(row.responses)
            : row.responses
          : {},
      }));

      return res.status(200).json({
        success: true,
        data: {
          evaluations: normalized,
          deadline: normalized[0]?.deadline || evaluationDeadline,
          expiryDate: normalized[0]?.deadline || evaluationDeadline,
          isExpired: false,
        },
      });
    } catch (error) {
      console.error("Pending Evaluations Error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve pending student evaluations.",
      });
    }
  },
);

app.get(
  "/api/student/evaluations/available",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return res.status(200).json([]);
      const [studentRows] = await pool.query(
        "SELECT department_id, year_level, semester, section FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );

      if (!studentRows.length) {
        return sendResponse(
          res,
          200,
          "No student record found.",
          "የተማሪ መዝገብ አልተገኘም።",
          [],
        );
      }

      const student = studentRows[0];
      const studentDepartmentId = Number(
        req.user?.department_id || student.department_id || 0,
      );
      const evaluationDeadline = await getDepartmentEvaluationDeadline(
        studentDepartmentId,
        activeCycle.end_at,
      );
      const [rows] = await pool.query(
        `SELECT
          ca.id AS assignment_id,
          c.code AS course_code,
          c.name AS course_name,
          CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, '')) AS instructor_name,
          ? AS deadline
        FROM course_assignments ca
        JOIN courses c ON ca.course_id = c.id
        LEFT JOIN instructors i ON ca.instructor_id = i.id
        WHERE ca.department_id = ?
          AND ca.cycle_id = ?
          AND ca.is_student_published = 1
        ORDER BY c.code ASC`,
        [evaluationDeadline, studentDepartmentId, activeCycle.id],
      );

      return sendResponse(
        res,
        200,
        "Available student evaluations retrieved successfully.",
        "ለተማሪዎች የሚገኙ ግምገማዎች ተመለሰ።",
        rows.map((row) => ({ ...row, expiryDate: row.deadline })),
      );
    } catch (error) {
      console.error("Available Student Evaluations Error:", error);
      return sendResponse(
        res,
        500,
        "Unable to load available student evaluations.",
        "ለተማሪዎች የሚገኙ ግምገማዎችን ማግኘት አልቻለም።",
      );
    }
  },
);

const refreshInstructorEvaluationResult = async (instructorId) => {
  const activeCycle = await getActiveEvaluationCycle();
  if (!activeCycle) return null;
  const [[instructor]] = await pool.query(
    `SELECT i.id, i.department_id, u.role
     FROM instructors i
     INNER JOIN users u ON u.id = i.user_id
     WHERE i.id = ? LIMIT 1`,
    [instructorId],
  );
  if (!instructor) return null;

  const isLabAssistant = isLabAssistantRole(instructor.role);
  const [[studentRow]] = isLabAssistant
    ? await pool.query(
        `SELECT COALESCE(AVG(ses.score), 0) AS score, COUNT(ses.id) AS submission_count
         FROM student_evaluation_submissions ses
         INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
         LEFT JOIN instructors assistant
           ON assistant.id = JSON_UNQUOTE(JSON_EXTRACT(ed.payload, '$.lab_assistant_id'))
         WHERE ed.student_group = 'lab_assistant'
           AND assistant.id = ?
           AND ed.cycle_id = ?
           AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
        [instructorId, activeCycle.id],
      )
    : await pool.query(
        `SELECT COALESCE(AVG(ses.score), 0) AS score, COUNT(ses.id) AS submission_count
         FROM student_evaluation_submissions ses
         INNER JOIN evaluation_dispatches ed ON ed.id = ses.dispatch_id
         LEFT JOIN course_assignments ca ON ca.id = ed.assignment_id AND ca.cycle_id = ed.cycle_id
         WHERE ca.instructor_id = ? AND ed.cycle_id = ?
           AND LOWER(COALESCE(ses.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
        [instructorId, activeCycle.id],
      );
  const [[peerRow]] = await pool.query(
    `SELECT COALESCE(AVG(pes.score), 0) AS score
     FROM peer_evaluation_submissions pes
     INNER JOIN peer_evaluations pe ON pe.id = pes.peer_evaluation_id
     INNER JOIN instructors target ON target.id = pe.evaluatee_id
     INNER JOIN instructors evaluator ON evaluator.user_id = pe.evaluator_id
     INNER JOIN users evaluator_user ON evaluator_user.id = evaluator.user_id
     INNER JOIN users target_user ON target_user.id = target.user_id
     LEFT JOIN departments evaluator_department
       ON evaluator_department.id = COALESCE(evaluator.department_id, evaluator_user.department_id)
     LEFT JOIN departments target_department
       ON target_department.id = COALESCE(target.department_id, target_user.department_id)
     WHERE pes.evaluatee_id = ?
       AND pe.cycle_id = ?
       AND (
         (
           LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_'))
             IN ('lab_assistant', 'ara', 'labassistant')
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(target_user.role, '')), '-', '_'), ' ', '_'))
             IN ('lab_assistant', 'ara', 'labassistant')
           AND COALESCE(evaluator_user.college_id, evaluator_department.college_id)
             = COALESCE(target_user.college_id, target_department.college_id)
         )
         OR (
           LOWER(REPLACE(REPLACE(TRIM(COALESCE(evaluator_user.role, '')), '-', '_'), ' ', '_'))
             NOT IN ('lab_assistant', 'ara', 'labassistant')
           AND evaluator.department_id = target.department_id
           AND pe.is_published = 1
         )
       )
       AND LOWER(COALESCE(pes.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
    [instructorId, activeCycle.id],
  );
  const [[supervisorRow]] = await pool.query(
    `SELECT COALESCE(AVG(dhe.total_score), 0) AS score
     FROM dept_head_evaluations dhe
     WHERE dhe.instructor_id = ? AND dhe.cycle_id = ?
       AND LOWER(COALESCE(dhe.status, 'submitted')) IN ('submitted', 'completed', 'approved')`,
    [instructorId, activeCycle.id],
  );
  const hasStudentEvaluation = Number(studentRow?.submission_count || 0) > 0;
  const studentAverage = Number(studentRow?.score || 0);
  const peerAverage = Number(peerRow?.score || 0);
  const supervisorAverage = Number(supervisorRow?.score || 0);
  const [[teachingRow]] = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM course_assignments
       WHERE instructor_id = ? AND cycle_id = ?
     ) AS is_teaching`,
    [instructorId, activeCycle.id],
  );
  const isTeaching = Boolean(teachingRow?.is_teaching);
  const totalScore = calculatePerformanceScore({
    isTeaching,
    isLabAssistant,
    studentScore: studentAverage,
    peerScore: peerAverage,
    supervisorScore: supervisorAverage,
  }).totalScore;

  await pool.query(
    `INSERT INTO evaluation_results (instructor_id, department_id, cycle_id, student_average, peer_average, dept_head_score, total_score, has_student_evaluation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE department_id = VALUES(department_id), student_average = VALUES(student_average), peer_average = VALUES(peer_average), dept_head_score = VALUES(dept_head_score), total_score = VALUES(total_score), has_student_evaluation = VALUES(has_student_evaluation), published_at = CURRENT_TIMESTAMP`,
    [
      instructor.id,
      instructor.department_id,
      activeCycle.id,
      hasStudentEvaluation ? studentAverage : 0,
      peerAverage,
      supervisorAverage,
      totalScore,
      hasStudentEvaluation,
    ],
  );
  return {
    studentAverage,
    peerAverage,
    supervisorAverage,
    totalScore,
    hasStudentEvaluation,
  };
};

app.post(
  "/api/student/evaluations/submit",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const {
        dispatch_id,
        score,
        feedback = "",
        strengths = "",
        improvements = "",
        responses = {},
      } = req.body;
      const feedbackValidation = validateEvaluationFeedback({
        "General Comments": feedback,
        Strengths: strengths,
        "Areas for Improvement": improvements,
      });
      if (!feedbackValidation.valid) {
        return sendResponse(
          res,
          400,
          feedbackValidation.message,
          feedbackValidation.messageAm,
        );
      }
      const feedbackToSave = [
        feedback,
        strengths ? `Strengths: ${strengths}` : "",
        improvements ? `Areas for improvement: ${improvements}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (!dispatch_id) {
        return sendResponse(
          res,
          400,
          "Dispatch ID is required.",
          "Dispatch ID ያስፈልጋል።",
        );
      }

      const scores = Array.isArray(responses)
        ? responses
        : responses && typeof responses === "object"
          ? Object.values(responses)
          : [];

      const computedScore = scores
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .reduce((sum, value) => sum + value, 0);
      const count = scores.filter(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0,
      ).length;
      const normalizedScore = count ? (computedScore / count) * 20 : 0;
      const finalScore = count
        ? normalizedScore
        : Number.isFinite(Number(score))
          ? Number(score)
          : 0;

      const [studentRows] = await pool.query(
        "SELECT id, CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS student_name FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!studentRows.length) {
        return sendResponse(
          res,
          404,
          "Student record not found.",
          "የተማሪ መረጃ አልተገኘም።",
        );
      }

      const student = studentRows[0];
      const [dispatchRows] = await pool.query(
        "SELECT * FROM evaluation_dispatches WHERE id = ? AND student_id = ? AND is_student_published = 1 LIMIT 1",
        [dispatch_id, student.id],
      );
      if (!dispatchRows.length) {
        return sendResponse(
          res,
          404,
          "Dispatch not found.",
          "Dispatch አልተገኘም።",
        );
      }

      const dispatch = dispatchRows[0];
      const responsePayload = JSON.stringify(
        responses && typeof responses === "object" ? responses : {},
      );
      const [result] = await pool.query(
        "INSERT INTO student_evaluation_submissions (dispatch_id, student_id, student_name, score, feedback, responses, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          dispatch.id,
          student.id,
          student.student_name || req.user.username,
          finalScore,
          feedbackToSave,
          responsePayload,
          "submitted",
        ],
      );

      await pool.query(
        "UPDATE evaluation_dispatches SET status = ? WHERE id = ?",
        ["submitted", dispatch.id],
      );
      await notifyDepartmentHeadOfSubmission({
        departmentId: dispatch.department_id,
        courseId: dispatch.course_id,
        assignmentId: dispatch.assignment_id,
        submissionType: "student",
        submitterName: student.student_name || req.user.username,
        courseName: dispatch.course_name,
      });
      await notifyDepartmentHeadOfSubmission({
        departmentId: dispatch.department_id,
        courseId: dispatch.course_id,
        assignmentId: dispatch.assignment_id,
        submissionType: "student",
        submitterName: student.student_name || req.user.username,
        courseName: dispatch.course_name,
      });
      const [[studentAssignment]] = await pool.query(
        "SELECT instructor_id FROM course_assignments WHERE id = ? OR course_id = ? LIMIT 1",
        [dispatch.assignment_id || 0, dispatch.course_id || 0],
      );
      if (studentAssignment?.instructor_id)
        await refreshInstructorEvaluationResult(
          studentAssignment.instructor_id,
        );

      return sendResponse(
        res,
        201,
        "Student evaluation submitted.",
        "የተማሪ ግምገማ ተላክቷል።",
        {
          id: result.insertId,
          score: finalScore,
          total_score: finalScore,
          status: "submitted",
        },
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to submit student evaluation.",
        "የተማሪ ግምገማ ለማስገባት አልተቻለም።",
      );
    }
  },
);

app.post(
  "/api/evaluations/submit-student",
  authenticate,
  authorizeRoles("student"),
  async (req, res) => {
    try {
      const {
        dispatch_id,
        score,
        feedback = "",
        strengths = "",
        improvements = "",
        responses = {},
      } = req.body;
      const feedbackValidation = validateEvaluationFeedback({
        "General Comments": feedback,
        Strengths: strengths,
        "Areas for Improvement": improvements,
      });
      if (!feedbackValidation.valid) {
        return sendResponse(
          res,
          400,
          feedbackValidation.message,
          feedbackValidation.messageAm,
        );
      }
      const feedbackToSave = [
        feedback,
        strengths ? `Strengths: ${strengths}` : "",
        improvements ? `Areas for improvement: ${improvements}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      if (!dispatch_id) {
        return sendResponse(
          res,
          400,
          "Dispatch ID is required.",
          "Dispatch ID ያስፈልጋል።",
        );
      }

      // Validate that responses are not empty
      const responseValues = Array.isArray(responses)
        ? responses
        : responses && typeof responses === "object"
          ? Object.values(responses)
          : [];
      if (responseValues.length === 0) {
        return sendResponse(
          res,
          400,
          "Please answer all criteria questions before submitting.",
          "ሁሉንም ጥያቄዎች መልስ ከመስጠት በፊት እባክዎ ያስገቡ።",
        );
      }

      const scores = Array.isArray(responses)
        ? responses
        : responses && typeof responses === "object"
          ? Object.values(responses)
          : [];

      const computedScore = scores
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .reduce((sum, value) => sum + value, 0);
      const count = scores.filter(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0,
      ).length;
      const normalizedScore = count ? (computedScore / count) * 20 : 0;
      const finalScore = count
        ? normalizedScore
        : Number.isFinite(Number(score))
          ? Number(score)
          : 0;

      const [studentRows] = await pool.query(
        "SELECT id, CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS student_name FROM students WHERE user_id = ? LIMIT 1",
        [req.user.id],
      );
      if (!studentRows.length) {
        return sendResponse(
          res,
          404,
          "Student record not found.",
          "የተማሪ መረጃ አልተገኘም።",
        );
      }

      const student = studentRows[0];
      const [dispatchRows] = await pool.query(
        "SELECT * FROM evaluation_dispatches WHERE id = ? AND student_id = ? AND is_student_published = 1 LIMIT 1",
        [dispatch_id, student.id],
      );
      if (!dispatchRows.length) {
        return sendResponse(
          res,
          404,
          "Dispatch not found.",
          "Dispatch አልተገኘም።",
        );
      }

      const dispatch = dispatchRows[0];
      const responsePayload = JSON.stringify(
        responses && typeof responses === "object" ? responses : {},
      );

      // Check if submission already exists for this dispatch
      const [existingSubmission] = await pool.query(
        "SELECT id FROM student_evaluation_submissions WHERE dispatch_id = ? LIMIT 1",
        [dispatch.id],
      );

      let result;
      if (existingSubmission.length > 0) {
        // Update existing submission
        await pool.query(
          "UPDATE student_evaluation_submissions SET score = ?, feedback = ?, responses = ?, status = ? WHERE dispatch_id = ?",
          [finalScore, feedbackToSave, responsePayload, "submitted", dispatch.id],
        );
        result = { insertId: existingSubmission[0].id };
      } else {
        // Insert new submission
        [result] = await pool.query(
          "INSERT INTO student_evaluation_submissions (dispatch_id, student_id, student_name, score, feedback, responses, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            dispatch.id,
            student.id,
            student.student_name || req.user.username,
            finalScore,
            feedbackToSave,
            responsePayload,
            "submitted",
          ],
        );
      }

      await pool.query(
        "UPDATE evaluation_dispatches SET status = ? WHERE id = ?",
        ["submitted", dispatch.id],
      );
      const [[studentAssignment]] = await pool.query(
        "SELECT instructor_id FROM course_assignments WHERE id = ? OR course_id = ? LIMIT 1",
        [dispatch.assignment_id || 0, dispatch.course_id || 0],
      );
      if (studentAssignment?.instructor_id)
        await refreshInstructorEvaluationResult(
          studentAssignment.instructor_id,
        );

      return sendResponse(
        res,
        201,
        "Student evaluation submitted.",
        "የተማሪ ግምገማ ተላክቷል።",
        {
          id: result.insertId,
          score: finalScore,
          total_score: finalScore,
          status: "submitted",
        },
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to submit student evaluation.",
        "የተማሪ ግምገማ ለማስገባት አልተቻለም።",
      );
    }
  },
);

app.post(
  "/api/evaluations/submit-peer",
  authenticate,
  authorizeRoles(
    "instructor",
    "lab_assistant",
    "ara",
    "dept_head",
    "college_dean",
    "academic_directorate",
    "academic_director",
    "directorate",
    "admin",
  ),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      const {
        peer_evaluation_id,
        score,
        strengths = "",
        suggestions = "",
        responses = {},
      } = req.body;
      const feedbackValidation = validateEvaluationFeedback({
        Strengths: strengths,
        "Areas for Improvement": suggestions,
      });
      if (!feedbackValidation.valid) {
        return sendResponse(
          res,
          400,
          feedbackValidation.message,
          feedbackValidation.messageAm,
        );
      }
      if (!peer_evaluation_id) {
        return sendResponse(
          res,
          400,
          "Peer evaluation ID is required.",
          "Peer evaluation ID ያስፈልጋል።",
        );
      }

      // Validate that responses are not empty
      const responseValues = Array.isArray(responses)
        ? responses
        : responses && typeof responses === "object"
          ? Object.values(responses)
          : [];
      if (responseValues.length === 0) {
        return sendResponse(
          res,
          400,
          "Please answer all criteria questions before submitting.",
          "ሁሉንም ጥያቄዎች መልስ ከመስጠት በፊት እባክዎ ያስገቡ።",
        );
      }

      const scores = Array.isArray(responses)
        ? responses
        : responses && typeof responses === "object"
          ? Object.values(responses)
          : [];

      const computedScore = scores
        .map((value) => {
          if (typeof value === "string" && value.trim().toUpperCase() === "NA")
            return null;
          return Number(value);
        })
        .filter((value) => Number.isFinite(value) && value > 0)
        .reduce((sum, value) => sum + value, 0);
      const count = scores
        .map((value) => {
          if (typeof value === "string" && value.trim().toUpperCase() === "NA")
            return null;
          return Number(value);
        })
        .filter((value) => Number.isFinite(value) && value > 0).length;
      const normalizedScore = count ? (computedScore / count) * 20 : 0;
      const finalScore = count
        ? normalizedScore
        : Number.isFinite(Number(score))
          ? Number(score)
          : 0;

      const [peerRows] = await pool.query(
        "SELECT * FROM peer_evaluations WHERE id = ? AND evaluator_id = ? AND cycle_id = ? LIMIT 1",
        [peer_evaluation_id, req.user.id, activeCycle.id],
      );
      if (!peerRows.length) {
        return sendResponse(
          res,
          404,
          "Peer evaluation assignment not found.",
          "የባልደረባ ግምገባ መዋጮ አልተገኘም።",
        );
      }

      const peerEval = peerRows[0];
      const [[peerScope]] = await pool.query(
        `SELECT COALESCE(evaluator.department_id, evaluator_instructor.department_id) AS evaluator_department_id,
          COALESCE(evaluator.college_id, evaluator_department.college_id) AS evaluator_college_id,
           evaluator.role AS evaluator_role,
           target.department_id AS target_department_id,
          COALESCE(target_user.college_id, target_department.college_id) AS target_college_id,
           evaluator.id AS evaluator_user_id,
           target_user.id AS target_user_id,
           target_user.role AS target_role
         FROM users evaluator
         LEFT JOIN instructors evaluator_instructor ON evaluator_instructor.user_id = evaluator.id
         LEFT JOIN departments evaluator_department
           ON evaluator_department.id = COALESCE(evaluator_instructor.department_id, evaluator.department_id)
         INNER JOIN instructors target ON target.id = ?
         INNER JOIN users target_user ON target_user.id = target.user_id
         LEFT JOIN departments target_department ON target_department.id = target.department_id
         LIMIT 1`,
        [peerEval.evaluatee_id],
      );
      const evaluatorRole = normalizeRole(peerScope?.evaluator_role);
      const targetRole = normalizeRole(peerScope?.target_role);
      const isLabAssistant = evaluatorRole === "lab_assistant";
      const isLeaderTarget = isAcademicLeaderRole(targetRole);
      const sameDepartment =
        Number(peerScope?.evaluator_department_id || 0) > 0 &&
        Number(peerScope?.evaluator_department_id) ===
          Number(peerScope?.target_department_id);
      const sameCollege =
        Number(peerScope?.evaluator_college_id || 0) > 0 &&
        Number(peerScope?.evaluator_college_id) ===
          Number(peerScope?.target_college_id);
      const isNotSelf =
        Number(peerScope?.evaluator_user_id) !==
        Number(peerScope?.target_user_id);
      const peerRuleSatisfied = isAllowedPeerEvaluationPair(
        evaluatorRole,
        targetRole,
      );
      if (
        evaluatorRole !== "admin" &&
        (!isNotSelf ||
          !(isLabAssistant ? sameCollege : sameDepartment) ||
          !peerRuleSatisfied)
      ) {
        return sendResponse(
          res,
          403,
          isLabAssistant
            ? "Lab Assistant peer evaluations are limited to colleagues in your own college."
            : "Peer evaluations are limited to permitted colleagues in your own department.",
        );
      }
      const responsePayload = JSON.stringify(
        responses && typeof responses === "object" ? responses : {},
      );

      // Check if submission already exists for this peer evaluation and evaluator
      const [existingSubmission] = await pool.query(
        "SELECT id FROM peer_evaluation_submissions WHERE peer_evaluation_id = ? AND evaluator_id = ? LIMIT 1",
        [peerEval.id, req.user.id],
      );

      let result;
      if (existingSubmission.length > 0) {
        // Update existing submission
        await pool.query(
          "UPDATE peer_evaluation_submissions SET score = ?, strengths = ?, suggestions = ?, responses = ?, status = ? WHERE peer_evaluation_id = ? AND evaluator_id = ?",
          [
            finalScore,
            strengths,
            suggestions,
            responsePayload,
            "submitted",
            peerEval.id,
            req.user.id,
          ],
        );
        result = { insertId: existingSubmission[0].id };
      } else {
        // Insert new submission
        [result] = await pool.query(
          "INSERT INTO peer_evaluation_submissions (peer_evaluation_id, evaluator_id, evaluatee_id, score, strengths, suggestions, responses, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            peerEval.id,
            req.user.id,
            peerEval.evaluatee_id,
            finalScore,
            strengths,
            suggestions,
            responsePayload,
            "submitted",
          ],
        );
      }

      await pool.query("UPDATE peer_evaluations SET status = ? WHERE id = ?", [
        "submitted",
        peerEval.id,
      ]);
      if (!isLeaderTarget) {
        await refreshInstructorEvaluationResult(peerEval.evaluatee_id);
      }
      const [[evaluatee]] = await pool.query(
        `SELECT i.department_id, c.name AS course_name FROM instructors i
       LEFT JOIN courses c ON c.id = ? WHERE i.id = ? LIMIT 1`,
        [peerEval.course_id, peerEval.evaluatee_id],
      );
      await notifyDepartmentHeadOfSubmission({
        departmentId: evaluatee?.department_id,
        submissionType: "peer",
        submitterName: req.user.username,
        courseName: evaluatee?.course_name,
      });

      return sendResponse(
        res,
        201,
        "Peer evaluation submitted.",
        "የባልደረባ ግምገባ ተላክቷል።",
        { id: result.insertId },
      );
    } catch (error) {
      console.error(error);
      return sendResponse(
        res,
        500,
        "Unable to submit peer evaluation.",
        "የባልደረባ ግምገባ ለማስገባት አልተቻለም።",
      );
    }
  },
);

// List evaluation dispatches (admin/dept_head/instructor)
app.get(
  "/api/evaluations/dispatches",
  authenticate,
  authorizeRoles("admin", "dept_head", "instructor"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      const { status = null, created_by = null } = req.query;
      const where = ["cycle_id = ?"];
      const params = [activeCycle.id];
      if (String(req.user?.role || "").toLowerCase() === "dept_head") {
        const departmentId = Number(
          req.user.department_id || req.user.department || 0,
        );
        if (!departmentId)
          return res
            .status(403)
            .json({ message: "Your department is not defined." });
        where.push("department_id = ?");
        params.push(departmentId);
      }
      if (status) {
        where.push("status = ?");
        params.push(status);
      }
      if (created_by) {
        where.push("created_by = ?");
        params.push(created_by);
      }
      const query = `SELECT * FROM evaluation_dispatches ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
      const [rows] = await pool.query(query, params);
      return sendResponse(
        res,
        200,
        "Dispatches retrieved.",
        "የማስተላለፊያ ዝርዝር ተመልሷል።",
        rows,
      );
    } catch (error) {
      console.error("Failed to list dispatches:", error?.message || error);
      return sendResponse(
        res,
        500,
        "Unable to list dispatches.",
        "የማስተላለፊያ ማውጫ አልተሳካም።",
        [],
      );
    }
  },
);

// List submissions (admin/dept_head/instructor)
app.get(
  "/api/evaluations/submissions",
  authenticate,
  authorizeRoles("admin", "dept_head", "instructor"),
  async (req, res) => {
    try {
      const activeCycle = await getActiveEvaluationCycle();
      if (!activeCycle) return sendResponse(res, 409, "There is no active evaluation cycle.");
      const { dispatch_id = null, student_id = null } = req.query;
      const where = [
        "EXISTS (SELECT 1 FROM evaluation_dispatches ed WHERE ed.id = student_evaluation_submissions.dispatch_id AND ed.cycle_id = ?)",
      ];
      const params = [activeCycle.id];
      if (dispatch_id) {
        where.push("dispatch_id = ?");
        params.push(dispatch_id);
      }
      if (student_id) {
        where.push("student_id = ?");
        params.push(student_id);
      }
      const query = `SELECT * FROM student_evaluation_submissions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
      const [rows] = await pool.query(query, params);
      return sendResponse(
        res,
        200,
        "Submissions retrieved.",
        "የግምገማ ሰነዶች ተመልሰዋል።",
        rows,
      );
    } catch (error) {
      console.error("Failed to list submissions:", error?.message || error);
      return sendResponse(
        res,
        500,
        "Unable to list submissions.",
        "የግምገማ ሰነዶችን ለማግኘት አልተቻለም።",
        [],
      );
    }
  },
);

app.put("/api/evaluations/:id", authenticate, async (req, res) => {
  try {
    const { score, feedback, status } = req.body;
    const [rows] = await pool.query(
      "SELECT * FROM evaluations WHERE id = ? LIMIT 1",
      [req.params.id],
    );

    if (!rows.length) {
      return sendResponse(res, 404, "Evaluation not found.", "ግምገማ አልተገኘም።");
    }

    const updateFields = [];
    const values = [];

    if (score !== undefined) {
      updateFields.push("score = ?");
      values.push(score);
    }
    if (feedback !== undefined) {
      updateFields.push("feedback = ?");
      values.push(feedback);
    }
    if (status) {
      updateFields.push("status = ?");
      values.push(status);
    }

    if (!updateFields.length) {
      return sendResponse(
        res,
        400,
        "No update fields provided.",
        "ምንም የማዘመኛ መስኮች አልተሰጡም።",
      );
    }

    values.push(req.params.id);
    await pool.query(
      `UPDATE evaluations SET ${updateFields.join(", ")} WHERE id = ?`,
      values,
    );
    return sendResponse(
      res,
      200,
      "Evaluation updated successfully.",
      "ግምገማ በተሳካ ሁኔታ ተዘምኗል።",
    );
  } catch (error) {
    console.error(error);
    return sendResponse(
      res,
      500,
      "Unable to update evaluation.",
      "ግምገማ ለመዘመን አልተቻለም።",
    );
  }
});

const frontendDistPath = path.resolve(__dirname, "../frontend/dist");
app.use(express.static(frontendDistPath));

app.get("/", (req, res) => {
  const frontendIndexPath = path.join(frontendDistPath, "index.html");
  if (fs.existsSync(frontendIndexPath)) return res.sendFile(frontendIndexPath);
  return sendResponse(
    res,
    200,
    "Welcome to the IEPS API.",
    "እንኳን ወደ IEPS API በደህና መጡ።",
  );
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "API endpoint not found." });
  }
  const frontendIndexPath = path.join(frontendDistPath, "index.html");
  if (!fs.existsSync(frontendIndexPath)) {
    return res.status(404).send("Frontend build is unavailable.");
  }
  return res.sendFile(frontendIndexPath);
});

const startServer = async () => {
  try {
    if (process.env.SKIP_SCHEMA_INIT !== "true") {
      await initializeSchema();
    } else {
      console.log("Skipping schema initialization (SKIP_SCHEMA_INIT=true)");
    }
    await ensureSystemSettingsTable();
    await ensureUserProfileSettings();
    await ensureEvaluationCycleSchema();
    await ensureDepartmentEvaluationWindowSchema();
    await seedLocalDepartmentEvaluationWindowsIfMissing();
    await ensureVicePresidentEvaluationSchema();
    await startEvaluationWindowRenewal();
    await startBroadcastScheduler();
    app.listen(PORT, () => {
      console.log(`🚀 IEPS API listening on http://localhost:${PORT}`);
      console.log(`📘 Health: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Failed to start API:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
