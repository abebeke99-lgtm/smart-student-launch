const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const pool = require('../config/db');
const { isSystemActive, getClientIp, getSystemSetting } = require('../config/audit');
const { renewExpiredEvaluationWindow } = require('../config/evaluationWindowRenewal');
const {
  getDepartmentEvaluationWindow,
} = require('../config/departmentEvaluationWindows');

dotenv.config();

const systemMaintenanceMiddleware = async (req, res, next) => {
  try {
    const pathname = req.path || '';
    const isPublicAuthEndpoint = /^\/api\/auth\/(login|forgot-password|verify-otp|reset-password-otp|reset-password)$/i.test(pathname);
    const isMaintenanceControlEndpoint = /^\/api\/admin\/system\/maintenance$/i.test(pathname);

    if (isPublicAuthEndpoint || isMaintenanceControlEndpoint) {
      return next();
    }

    const active = await isSystemActive();
    if (active) return next();

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret');
        if (decoded && ['admin', 'systemadmin'].includes(String(decoded.role || '').trim().toLowerCase())) {
          return next();
        }
        if (decoded?.jti && decoded?.id) {
          await pool.query(
            `UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW())
             WHERE id = ? AND user_id = ?`,
            [decoded.jti, decoded.id],
          );
        }
      } catch (error) {
        console.error('Unable to revoke a session during system maintenance:', error);
      }
    }

    return res.status(503).json({
      success: false,
      message: 'System is currently unavailable. Please contact the administrator.',
      ip: getClientIp(req),
    });
  } catch (error) {
    console.error('System maintenance check failed:', error);
    return res.status(503).json({
      success: false,
      message: 'System is currently unavailable. Please contact the administrator.',
    });
  }
};

const evaluationWindowSubmissionPaths = new Set([
  "/api/dept-head/evaluations",
  "/api/dept-head/submit-evaluation",
  "/api/dean/submit-evaluation",
  "/api/dean/evaluate-dept-head",
  "/api/dean/dept-head-evaluations",
  "/api/directorate/evaluate-dean",
  "/api/evaluations",
  "/api/evaluations/submit-student",
  "/api/evaluations/submit-peer",
  "/api/student/evaluations/submit",
]);

const evaluationWindowMiddleware = async (req, res, next) => {
  if (req.method !== "POST" || !evaluationWindowSubmissionPaths.has(req.path)) {
    return next();
  }

  try {
    const authorization = String(req.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    let departmentId = null;
    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'change-this-secret',
        );
        const tokenDepartmentId = Number(decoded.department_id);
        if (Number.isInteger(tokenDepartmentId) && tokenDepartmentId > 0) {
          departmentId = tokenDepartmentId;
        }
      } catch (tokenError) {
        departmentId = null;
      }
    }

    if (departmentId) {
      const departmentWindow = await getDepartmentEvaluationWindow(departmentId);
      if (departmentWindow) {
        const startAt = Date.parse(departmentWindow.startAt);
        const endAt = Date.parse(departmentWindow.endAt);
        if (
          !Number.isFinite(startAt) ||
          !Number.isFinite(endAt) ||
          startAt >= endAt
        ) {
          console.error('Stored department evaluation schedule has invalid dates.', {
            department_id: departmentId,
          });
          return res.status(503).json({
            success: false,
            message:
              "Evaluation submissions are unavailable because the department schedule is invalid.",
          });
        }

        const now = Date.now();
        if (now < startAt) {
          return res.status(403).json({
            success: false,
            message: "Evaluation submissions have not opened yet.",
          });
        }
        if (now >= endAt) {
          return res.status(403).json({
            success: false,
            message: "The evaluation submission deadline has passed.",
          });
        }
        return next();
      }
    }

    await renewExpiredEvaluationWindow();
    const savedValue = await getSystemSetting("evaluation_window");
    if (!savedValue) return next();

    let window;
    try {
      window = JSON.parse(savedValue);
    } catch (error) {
      console.error("Stored evaluation window is invalid JSON:", error);
      return res.status(503).json({
        success: false,
        message:
          "Evaluation submissions are unavailable because the system schedule is invalid.",
      });
    }

    const startAt = Date.parse(window?.startAt);
    const endAt = Date.parse(window?.endAt);
    if (
      !Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      startAt >= endAt
    ) {
      console.error("Stored evaluation window has invalid dates.");
      return res.status(503).json({
        success: false,
        message:
          "Evaluation submissions are unavailable because the system schedule is invalid.",
      });
    }

    const now = Date.now();
    if (now < startAt) {
      return res.status(403).json({
        success: false,
        message: "Evaluation submissions have not opened yet.",
      });
    }
    if (now >= endAt) {
      return res.status(403).json({
        success: false,
        message: "The evaluation submission deadline has passed.",
      });
    }
    return next();
  } catch (error) {
    console.error("Evaluation window check failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify the evaluation submission window.",
    });
  }
};

const authenticateToken = (req, res, next) => {
  const authorization = typeof req.headers?.authorization === 'string'
    ? req.headers.authorization.trim()
    : '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Bearer access token required.',
    });
  }

  const token = match[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret', async (err, user) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: err.name === 'TokenExpiredError'
            ? 'Unauthorized: access token expired.'
            : 'Unauthorized: invalid access token.',
        });
      }
      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: token subject is missing.',
        });
      }

      try {
        if (user.jti) {
          const [sessions] = await pool.query(
            `SELECT id FROM user_sessions
             WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
             LIMIT 1`,
            [user.jti, user.id],
          );
          if (!sessions.length) {
            return res.status(401).json({
              success: false,
              message: 'Unauthorized: this login session has ended.',
            });
          }
          await pool.query(
            `UPDATE user_sessions SET last_seen_at = NOW()
             WHERE id = ? AND last_seen_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
            [user.jti],
          );
        }

        const rawRole = String(user.role || user.user_role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
        const normalizedRole = rawRole === 'department_head'
          ? 'dept_head'
          : ['ara', 'lab_assistant'].includes(rawRole) ? 'lab_assistant'
          : ['vice_president', 'vice_presdant', 'vic_president'].includes(rawRole) ? 'vice_president'
          : rawRole;
        req.user = { ...user, role: normalizedRole };
        if (!['admin', 'systemadmin'].includes(req.user.role)) {
          const systemActive = await isSystemActive();
          if (!systemActive) {
            if (req.user.jti) {
              await pool.query(
                `UPDATE user_sessions SET revoked_at = COALESCE(revoked_at, NOW())
                 WHERE id = ? AND user_id = ?`,
                [req.user.jti, req.user.id],
              );
            }
            return res.status(503).json({
              success: false,
              message: 'System is currently unavailable. Please contact the administrator.',
            });
          }
        }
        if (!req.user.department_id) {
          const [rows] = await pool.query(
            `SELECT COALESCE(i.department_id, s.department_id) AS department_id,
              d.code AS department_code, d.name AS department_name
             FROM users u
             LEFT JOIN instructors i ON i.user_id = u.id
             LEFT JOIN students s ON s.user_id = u.id
             LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id)
             WHERE u.id = ? LIMIT 1`,
            [req.user.id],
          );
          if (rows[0]) req.user = { ...req.user, ...rows[0] };
        }
        return next();
      } catch (lookupError) {
        console.error('Authenticated user lookup failed:', lookupError.message);
        return res.status(503).json({
          success: false,
          message: 'Authentication service is temporarily unavailable.',
        });
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: unable to verify access token.',
    });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  const normalizeRole = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const aliases = {
      department_head: 'dept_head',
      dept_head: 'dept_head',
      depthead: 'dept_head',
      college_dean: 'college_dean',
      academic_directorate: 'academic_directorate',
      academic_director: 'academic_directorate',
      vice_president: 'vice_president',
      vice_presdant: 'vice_president',
      vic_president: 'vice_president',
      lab_assistant: 'lab_assistant',
      labassistant: 'lab_assistant',
      ara: 'lab_assistant',
    };
    return aliases[normalized] ?? normalized;
  };

  const allowedRoles = roles.map(normalizeRole);
  const userRole = normalizeRole(req.user?.role || req.user?.user_role);

  if (!req.user || !allowedRoles.includes(userRole)) {
    return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
  }

  next();
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  systemMaintenanceMiddleware,
  evaluationWindowMiddleware,
};
