const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const crypto = require("crypto");
const { getClientIp, isSystemActive, logAuditEvent } = require("../config/audit");
const { ensureUserProfileSettings } = require("../utils/profileSettings");
const { createUserSession, ensureUserSessions } = require("../utils/userSettings");
const { sendRecoveryEmail } = require("../services/emailService");

const isNetworkUnreachableError = (error) =>
  error?.code === "ENETUNREACH" ||
  error?.errno === "ENETUNREACH" ||
  String(error?.message || "").includes("ENETUNREACH");

const isDevelopmentRuntime = (req) => {
  if (
    process.env.NODE_ENV === "development" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.npm_lifecycle_event === "dev")
  ) {
    return true;
  }
  if (process.env.NODE_ENV === "production") return false;

  const hostname = String(req.hostname || req.headers?.host || "")
    .split(":")[0]
    .toLowerCase();
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
};

const findUserByIdentifierForRecovery = async (identifier) => {
  const normalized = String(identifier || "").trim();
  if (!normalized) return null;

  const normalizedValue = normalized.toLowerCase();

  const query = `
    SELECT u.id, u.username, u.role, u.reset_otp, u.otp_expiry,
           COALESCE(
             NULLIF(TRIM(ups.email), ''),
             CASE
               WHEN TRIM(u.username) LIKE '%@%' THEN NULLIF(TRIM(u.username), '')
               ELSE NULL
             END
           ) AS email
    FROM users u
    LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
    WHERE u.status = 'active'
      AND (
        LOWER(TRIM(u.username)) = ?
        OR LOWER(TRIM(COALESCE(ups.email, ''))) = ?
      )
    LIMIT 1
  `;

  const [rows] = await pool.query(query, [normalizedValue, normalizedValue]);
  return rows?.[0] || null;
};

const forgotPassword = async (req, res) => {
  const email = String(req.body?.email || req.body?.username || "")
    .trim()
    .toLowerCase();
  if (!email)
    return res
      .status(400)
      .json({ success: false, message: "Recovery email is required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res
      .status(400)
      .json({ success: false, message: "Enter a valid recovery email address." });
  }

  try {
    await ensureUserProfileSettings();
    const user = await findUserByIdentifierForRecovery(email);

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No active account was found for that username or email",
        });
    }

    const savedRecoveryEmail = String(user.email || "").trim();
    const recipientEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(savedRecoveryEmail)
      ? savedRecoveryEmail
      : email;

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 12);

    await pool.query(
      `UPDATE users
       SET reset_otp = ?,
           otp_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
           reset_token = NULL,
           token_expires = NULL
       WHERE id = ?`,
      [otpHash, user.id],
    );

    try {
      await sendRecoveryEmail({
        toEmail: recipientEmail,
        code: otp,
        expiresInMinutes: 15,
      });
    } catch (emailError) {
      const configurationError = [
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "EMAIL_SENDER_NOT_CONFIGURED",
      ].includes(emailError?.code);
      if (isDevelopmentRuntime(req)) {
        console.warn(
          "Password recovery email could not be delivered; returning a development-only recovery code.",
          { code: emailError.code },
        );
        return res.json({
          success: true,
          message:
            "Email delivery failed in development. Use the recovery code below.",
          developmentCode: otp,
        });
      }

      console.error("Password recovery email delivery failed.", {
        code: emailError?.code || "EMAIL_DELIVERY_FAILED",
        errno: emailError?.errno,
      });
      try {
        await pool.query(
          "UPDATE users SET reset_otp = NULL, otp_expiry = NULL WHERE id = ? AND reset_otp = ?",
          [user.id, otpHash],
        );
      } catch (cleanupError) {
        console.error("Unable to clear undelivered password recovery OTP:", cleanupError);
      }
      const networkUnavailable = isNetworkUnreachableError(emailError);
      const statusCode = networkUnavailable ? 503 : 500;
      return res.status(statusCode).json({
        success: false,
        code: networkUnavailable
          ? "EMAIL_NETWORK_UNAVAILABLE"
          : emailError?.code || "EMAIL_DELIVERY_FAILED",
        message: networkUnavailable
          ? "The email service is temporarily unreachable. Please try again later."
          : configurationError
            ? "Password recovery email is not configured. Configure SMTP or Resend before using password recovery."
            : "Unable to send the password recovery email. Please try again later or contact the system administrator.",
      });
    }

    return res.json({
      success: true,
      message: "Code sent successfully",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Unable to process the password recovery request.",
        code: "PASSWORD_RECOVERY_FAILED",
      });
  }
};

const verifyOtp = async (req, res) => {
  const identifier = String(req.body?.username || req.body?.email || "").trim();
  const otp = String(req.body?.otp || "").trim();

  if (!identifier || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Username or email and OTP code are required." });
  }

  try {
    const user = await findUserByIdentifierForRecovery(identifier);

    if (!user || !user.reset_otp || !user.otp_expiry) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP." });
    }

    const otpExpired = new Date(user.otp_expiry).getTime() <= Date.now();
    if (otpExpired) {
      await pool.query(
        "UPDATE users SET reset_otp = NULL, otp_expiry = NULL WHERE id = ?",
        [user.id],
      );
      return res
        .status(400)
        .json({
          success: false,
          message: "OTP expired. Please request a new code.",
        });
    }

    const isOtpValid = await bcrypt.compare(otp, user.reset_otp);
    if (!isOtpValid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP code." });
    }

    return res.json({ success: true, message: "OTP verified successfully." });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to verify OTP." });
  }
};

const resetPasswordOtp = async (req, res) => {
  const identifier = String(req.body?.username || req.body?.email || "").trim();
  const otp = String(req.body?.otp || "").trim();
  const newPassword = String(
    req.body?.newPassword || req.body?.new_password || "",
  ).trim();

  if (!identifier || !otp || newPassword.length < 8) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Username or email, OTP, and a password of at least 8 characters are required.",
      });
  }

  try {
    const user = await findUserByIdentifierForRecovery(identifier);

    if (!user || !user.reset_otp || !user.otp_expiry) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP." });
    }

    const otpExpired = new Date(user.otp_expiry).getTime() <= Date.now();
    if (otpExpired) {
      await pool.query(
        "UPDATE users SET reset_otp = NULL, otp_expiry = NULL WHERE id = ?",
        [user.id],
      );
      return res
        .status(400)
        .json({
          success: false,
          message: "OTP expired. Please request a new code.",
        });
    }

    const isOtpValid = await bcrypt.compare(otp, user.reset_otp);
    if (!isOtpValid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP code." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password_hash = ?, is_first_login = 0, reset_otp = NULL, otp_expiry = NULL, reset_token = NULL, token_expires = NULL WHERE id = ?",
      [passwordHash, user.id],
    );

    return res.json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("OTP password reset failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to reset password." });
  }
};

const resetPassword = async (req, res) => {
  if (
    (req.body?.email || req.body?.username) &&
    req.body?.otp
  ) {
    return resetPasswordOtp(req, res);
  }

  const token = String(req.body?.token || "").trim();
  const newPassword = String(
    req.body?.newPassword || req.body?.new_password || "",
  ).trim();
  if (!token || newPassword.length < 8) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "A valid reset token and a password of at least 8 characters are required.",
      });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [[user]] = await pool.query(
      "SELECT id FROM users WHERE reset_token = ? AND token_expires > NOW() AND status = 'active' LIMIT 1",
      [tokenHash],
    );
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired reset link." });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password_hash = ?, is_first_login = 0, reset_token = NULL, token_expires = NULL WHERE id = ?",
      [passwordHash, user.id],
    );
    return res.json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("Password reset failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to reset password." });
  }
};

const login = async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "").trim();

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
    }

    let systemActive;
    try {
      systemActive = await isSystemActive();
    } catch (error) {
      console.error("Login system status check failed:", error?.message || error);
      return res.status(503).json({
        success: false,
        message: "System is currently unavailable. Please contact the administrator.",
      });
    }

    let rows;
    try {
      [rows] = await pool.query(
        `SELECT u.id,
          u.username,
          ups.email AS email,
          u.password_hash,
          u.role,
          u.status,
          u.is_first_login,
          u.college_id,
          u.department_id AS user_department_id,
          COALESCE(i.gender, s.gender, NULL) AS gender,
          COALESCE(i.first_name, s.first_name, '') AS first_name,
          COALESCE(i.last_name, s.last_name, '') AS last_name,
          COALESCE(u.department_id, i.department_id, s.department_id) AS department_id,
          d.code AS department_code,
          d.name AS department_name,
          s.student_id AS student_id,
          COALESCE(NULLIF(ups.full_name, ''), NULLIF(CONCAT_WS(' ', i.first_name, i.last_name), ''), NULLIF(CONCAT_WS(' ', s.first_name, s.last_name), ''), u.username) AS full_name
         FROM users u
         LEFT JOIN instructors i ON i.user_id = u.id
         LEFT JOIN students s ON s.user_id = u.id
         LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
         LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id)
        WHERE (
          LOWER(TRIM(u.username)) = LOWER(?)
          OR (
            u.role IN ('admin', 'systemadmin')
            AND LOWER(TRIM(ups.email)) = LOWER(?)
          )
        )
          AND u.status = 'active'
        ORDER BY (LOWER(TRIM(u.username)) = LOWER(?)) DESC
        LIMIT 1`,
        [username, username, username],
      );
    } catch (err) {
      console.error("Login database query failed:", err.message, err.code);
      return res
        .status(503)
        .json({
          success: false,
          message: "Authentication service is temporarily unavailable.",
        });
    }

    if (!rows.length) {
      if (!systemActive) {
        return res.status(503).json({
          success: false,
          message: "System is currently unavailable. Please contact the administrator.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Incorrect username",
      });
    }

    const user = rows[0];
    const isSystemAdministrator = ["admin", "systemadmin"].includes(
      String(user.role || "").trim().toLowerCase(),
    );
    if (!systemActive && !isSystemAdministrator) {
      return res.status(503).json({
        success: false,
        message: "System is currently unavailable. Please contact the administrator.",
      });
    }

    if (typeof user.password_hash !== "string" || !user.password_hash.trim()) {
      console.warn(
        "Login rejected because the account has no usable password hash:",
        user.id,
      );
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password." });
    }
    const fullName =
      user.full_name ||
      `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
      "User";
    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(password, user.password_hash);
    } catch (error) {
      console.error("Login password verification failed:", error.message);
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password." });
    }

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      {
        id: user.id,
        jti: sessionId,
        username: user.username,
        email: user.email || "",
        role: user.role,
        college_id: user.college_id,
        department_id: user.department_id,
        department_code: user.department_code,
        department_name: user.department_name,
      },
      process.env.JWT_SECRET || "change-this-secret",
      { expiresIn: "8h" },
    );
    await createUserSession({
      id: sessionId,
      userId: user.id,
      ipAddress: getClientIp(req),
      deviceId: req.headers["x-device-id"],
      userAgent: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });

    if (req.session) {
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email || "",
        role: user.role,
      };
      req.session.token = token;
    }

    await logAuditEvent({
      userId: user.id,
      action: "LOGIN",
      req,
      description: `${user.username} (${user.role}) logged in successfully.`,
      performedBy: user.username,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          isFirstLogin: Boolean(user.is_first_login),
          name: fullName,
          full_name: fullName,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email || user.username,
          gender: user.gender,
          department_id: user.department_id,
          username: user.username,
        },
      },
    });
  } catch (error) {
    console.error("Login controller failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to complete login at this time.",
    });
  }
};

const logout = async (req, res) => {
  try {
    if (req.user?.jti) {
      await ensureUserSessions();
      await pool.query(
        `UPDATE user_sessions SET revoked_at = NOW()
         WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        [req.user.jti, req.user.id],
      );
    }
    if (req.session && typeof req.session.destroy === "function") {
      req.session.destroy((err) => {
        if (err) {
          console.error("Logout session destroy error:", err);
        }
      });
    }

    if (req.user?.id || req.user?.username) {
      await logAuditEvent({
        userId: req.user?.id || null,
        action: "LOGOUT",
        req,
        description: `${req.user?.username || "Unknown user"} (${req.user?.role || "unknown role"}) logged out.`,
        performedBy: req.user?.username || req.user?.id || "system",
      });
    }

    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout Error:", err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || "Logout failed." });
  }
};

module.exports = {
  login,
  logout,
  forgotPassword,
  verifyOtp,
  resetPasswordOtp,
  resetPassword,
};
