const express = require("express");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { ensureUserProfileSettings } = require("../utils/profileSettings");
const { isValidPhoneNumber } = require("../utils/phone");
const { validateRequestInput } = require("../utils/inputValidation");
const {
  createUserSession,
  ensureUserNotificationPreferences,
  ensureUserSessions,
} = require("../utils/userSettings");
const { getClientIp } = require("../config/audit");

const router = express.Router();
const allowedPhotoTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (allowedPhotoTypes[file.mimetype]) return callback(null, true);
    return callback(new Error("Upload a JPG, PNG, WEBP, GIF, or AVIF image."));
  },
});

router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.user?.id || 0);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user is required.",
      });
    }

    await ensureUserProfileSettings();
    const [[profile]] = await pool.query(
      `SELECT u.id, u.username, u.role, u.department_id,
        COALESCE(NULLIF(ups.full_name, ''), NULLIF(CONCAT_WS(' ', i.first_name, i.last_name), ''), NULLIF(CONCAT_WS(' ', s.first_name, s.last_name), ''), u.username) AS full_name,
        COALESCE(ups.phone_number, i.phone_number, s.phone_number, '') AS phone_number,
        ups.email, ups.profile_picture, d.name AS department_name,
        c.name AS college_name
       FROM users u
       LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
       LEFT JOIN instructors i ON i.user_id = u.id
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN departments d ON d.id = COALESCE(u.department_id, i.department_id, s.department_id)
       LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, d.college_id)
       WHERE u.id = ?
       LIMIT 1`,
      [userId],
    );
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "User account was not found.",
      });
    }

    return res.json({
      success: true,
      user: {
        ...profile,
        email: profile.email || "",
      },
    });
  } catch (error) {
    console.error("Profile retrieval failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to load your profile.",
    });
  }
});

router.put(
  "/profile",
  authenticateToken,
  upload.single("photo"),
  validateRequestInput,
  async (req, res) => {
    let connection;
    try {
      const userId = Number(req.user?.id || 0);
      const fullName =
        typeof req.body?.full_name === "string"
          ? req.body.full_name.trim().replace(/\s+/g, " ")
          : undefined;
      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : undefined;
      const username =
        typeof req.body?.username === "string"
          ? req.body.username.trim()
          : undefined;
      let phone =
        typeof req.body?.phone === "string" ? req.body.phone.trim() : undefined;
      if (!userId)
        return res
          .status(401)
          .json({ success: false, message: "Authenticated user is required." });
      if (fullName !== undefined && !fullName) {
        return res.status(400).json({
          success: false,
          message: "Full name cannot be empty.",
        });
      }
      const isAdmin = ["admin", "systemadmin", "super_admin"].includes(
        String(req.user?.role || "").trim().toLowerCase(),
      );
      if (username !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Username cannot be changed from the profile page.",
        });
      }
      if (!isAdmin && email !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Only an administrator can change recovery email addresses.",
        });
      }
      if (req.file) {
        req.file.filename = `user-${userId}-${Date.now()}${allowedPhotoTypes[req.file.mimetype]}`;
      }
      if (
        fullName === undefined &&
        email === undefined &&
        phone === undefined &&
        !req.file
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide at least one profile detail to update.",
        });
      }
      if (
        fullName !== undefined &&
        (fullName.length < 3 ||
          fullName.length > 255 ||
          fullName.split(" ").length < 2)
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a full name with at least a first and last name.",
        });
      }
      if (
        fullName !== undefined &&
        fullName.split(" ").some((part) => part.length > 128)
      ) {
        return res.status(400).json({
          success: false,
          message: "Each part of the name must be 128 characters or fewer.",
        });
      }
      if (
        email !== undefined &&
        (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Enter a valid email address." });
      }
      await ensureUserProfileSettings();

      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [[account]] = await connection.query(
        `SELECT u.username, u.role, u.college_id, u.department_id,
        i.user_id AS instructor_user_id, s.user_id AS student_user_id,
        COALESCE(NULLIF(ups.full_name, ''), NULLIF(CONCAT_WS(' ', i.first_name, i.last_name), ''), NULLIF(CONCAT_WS(' ', s.first_name, s.last_name), ''), u.username) AS full_name,
        COALESCE(ups.phone_number, i.phone_number, s.phone_number, '') AS phone_number,
        ups.email, ups.profile_picture
       FROM users u
       LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
       LEFT JOIN instructors i ON i.user_id = u.id
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.id = ? LIMIT 1 FOR UPDATE`,
        [userId],
      );
      if (!account) {
        await connection.rollback();
        return res
          .status(404)
          .json({ success: false, message: "User account was not found." });
      }

      if (email !== undefined) {
        const [[emailOwner]] = await connection.query(
          `SELECT u.id
           FROM users u
           LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
           WHERE u.id <> ?
             AND (LOWER(TRIM(ups.email)) = ? OR LOWER(TRIM(u.username)) = ?)
           LIMIT 1`,
          [userId, email, email],
        );
        if (emailOwner) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            message: "That email address is already linked to another account.",
          });
        }
      }

      if (phone !== undefined && phone) {
        if (account.instructor_user_id || account.student_user_id) {
          const digits = phone.replace(/\D/g, "");
          phone = /^251[79]\d{8}$/.test(digits)
            ? `0${digits.slice(3)}`
            : digits;
          if (!isValidPhoneNumber(phone)) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              message: "Phone number must be a valid local or international number.",
            });
          }
        } else if (phone.length > 64) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: "Phone number must be 64 characters or fewer.",
          });
        }
      }

      const updatedName = fullName ?? account.full_name;
      const nameParts = updatedName.split(" ");
      const firstName = nameParts.shift();
      const lastName = nameParts.join(" ");
      const updatedPhone = phone === undefined ? account.phone_number : phone;
      if (fullName !== undefined && account.instructor_user_id) {
        await connection.query(
          "UPDATE instructors SET first_name = ?, last_name = ? WHERE user_id = ?",
          [firstName, lastName, userId],
        );
      }
      if (fullName !== undefined && account.student_user_id) {
        await connection.query(
          "UPDATE students SET first_name = ?, last_name = ? WHERE user_id = ?",
          [firstName, lastName, userId],
        );
      }
      if (phone !== undefined && account.instructor_user_id) {
        await connection.query(
          "UPDATE instructors SET phone_number = ? WHERE user_id = ?",
          [phone || null, userId],
        );
      }
      if (phone !== undefined && account.student_user_id) {
        await connection.query(
          "UPDATE students SET phone_number = ? WHERE user_id = ?",
          [phone || null, userId],
        );
      }

      const profileFields = [];
      if (fullName !== undefined)
        profileFields.push("full_name = VALUES(full_name)");
      if (email !== undefined)
        profileFields.push("email = VALUES(email)");
      if (phone !== undefined)
        profileFields.push("phone_number = VALUES(phone_number)");
      if (req.file)
        profileFields.push(
          "profile_picture = VALUES(profile_picture)",
          "profile_picture_data = VALUES(profile_picture_data)",
          "profile_picture_mime_type = VALUES(profile_picture_mime_type)",
        );
      const photoValue = req.file
        ? `/uploads/profile/${req.file.filename}`
        : account.profile_picture;
      if (profileFields.length) {
        await connection.query(
          `INSERT INTO user_profile_settings
            (user_id, full_name, email, phone_number, profile_picture,
             profile_picture_data, profile_picture_mime_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ${profileFields.join(", ")}`,
          [
            userId,
            fullName ?? null,
            email ?? null,
            phone === undefined ? null : phone || null,
            photoValue || null,
            req.file?.buffer || null,
            req.file?.mimetype || null,
          ],
        );
      }
      await connection.commit();

      const sessionId = crypto.randomUUID();
      const token = jwt.sign(
        {
          id: userId,
          jti: sessionId,
          username: account.username,
          email: email ?? account.email ?? "",
          role: account.role,
          college_id: account.college_id,
          department_id: account.department_id,
          department_code: req.user.department_code,
          department_name: req.user.department_name,
        },
        process.env.JWT_SECRET || "change-this-secret",
        { expiresIn: "8h" },
      );
      await createUserSession({
        id: sessionId,
        userId,
        ipAddress: getClientIp(req),
        deviceId: req.headers["x-device-id"],
        userAgent: req.headers["user-agent"],
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });
      if (req.session) {
        req.session.user = {
          id: userId,
          username: account.username,
          email: email ?? account.email ?? "",
          role: account.role,
        };
        req.session.token = token;
      }

      const [[profile]] = await pool.query(
        "SELECT email, profile_picture FROM user_profile_settings WHERE user_id = ? LIMIT 1",
        [userId],
      );
      return res.json({
        success: true,
        message: "Profile updated successfully.",
        token,
        user: {
          id: userId,
          username: account.username,
          email: profile?.email || "",
          role: account.role,
          name: updatedName,
          full_name: updatedName,
          first_name: fullName === undefined ? undefined : firstName,
          last_name: fullName === undefined ? undefined : lastName,
          phone: updatedPhone || "",
          phone_number: updatedPhone || "",
          profile_picture: profile?.profile_picture || "",
        },
      });
    } catch (error) {
      if (connection) await connection.rollback().catch(() => {});
      if (error?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          success: false,
          message:
            "That email address or phone number is already linked to another account.",
        });
      }
      console.error("Profile update failed:", error?.message || error);
      return res
        .status(500)
        .json({ success: false, message: "Unable to update your profile." });
    } finally {
      connection?.release();
    }
  },
);

router.get("/notification-preferences", authenticateToken, async (req, res) => {
  try {
    await ensureUserNotificationPreferences();
    const [[preferences]] = await pool.query(
      `SELECT evaluation_deadlines, system_announcements, security_alerts
       FROM user_notification_preferences WHERE user_id = ?`,
      [req.user.id],
    );
    return res.json({
      success: true,
      data: {
        evaluationDeadlines: preferences
          ? Boolean(preferences.evaluation_deadlines)
          : true,
        systemAnnouncements: preferences
          ? Boolean(preferences.system_announcements)
          : true,
        securityAlerts: preferences ? Boolean(preferences.security_alerts) : true,
      },
    });
  } catch (error) {
    console.error("Notification preference retrieval failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to load your notification preferences.",
    });
  }
});

router.put("/notification-preferences", authenticateToken, async (req, res) => {
  const preferenceKeys = [
    ["evaluationDeadlines", "evaluation_deadlines"],
    ["systemAnnouncements", "system_announcements"],
    ["securityAlerts", "security_alerts"],
  ];
  const providedKeys = preferenceKeys.filter(([key]) =>
    Object.prototype.hasOwnProperty.call(req.body || {}, key),
  );
  if (!providedKeys.length || providedKeys.some(([key]) => typeof req.body[key] !== "boolean")) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one notification preference as a boolean.",
    });
  }

  try {
    await ensureUserNotificationPreferences();
    const [[existing]] = await pool.query(
      `SELECT evaluation_deadlines, system_announcements, security_alerts
       FROM user_notification_preferences WHERE user_id = ?`,
      [req.user.id],
    );
    const values = {
      evaluation_deadlines: existing?.evaluation_deadlines ?? 1,
      system_announcements: existing?.system_announcements ?? 1,
      security_alerts: existing?.security_alerts ?? 1,
    };
    for (const [requestKey, databaseKey] of providedKeys) {
      values[databaseKey] = req.body[requestKey] ? 1 : 0;
    }
    await pool.query(
      `INSERT INTO user_notification_preferences
        (user_id, evaluation_deadlines, system_announcements, security_alerts)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        evaluation_deadlines = VALUES(evaluation_deadlines),
        system_announcements = VALUES(system_announcements),
        security_alerts = VALUES(security_alerts)`,
      [
        req.user.id,
        values.evaluation_deadlines,
        values.system_announcements,
        values.security_alerts,
      ],
    );
    return res.json({
      success: true,
      data: {
        evaluationDeadlines: Boolean(values.evaluation_deadlines),
        systemAnnouncements: Boolean(values.system_announcements),
        securityAlerts: Boolean(values.security_alerts),
      },
    });
  } catch (error) {
    console.error("Notification preference update failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to save your notification preferences.",
    });
  }
});

router.get("/sessions", authenticateToken, async (req, res) => {
  try {
    await ensureUserSessions();
    const [sessions] = await pool.query(
      `SELECT id, ip_address, device_id, user_agent, created_at, last_seen_at, expires_at
       FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_seen_at DESC`,
      [req.user.id],
    );
    return res.json({
      success: true,
      data: sessions.map((session) => ({
        ...session,
        isCurrent: session.id === req.user.jti,
      })),
    });
  } catch (error) {
    console.error("Active session retrieval failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to load your active sessions.",
    });
  }
});

router.delete("/sessions/:sessionId", authenticateToken, async (req, res) => {
  if (req.params.sessionId === req.user.jti) {
    return res.status(400).json({
      success: false,
      message: "Use Sign out to end the current session.",
    });
  }
  try {
    await ensureUserSessions();
    const [result] = await pool.query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
      [req.params.sessionId, req.user.id],
    );
    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Active session was not found.",
      });
    }
    return res.json({ success: true, message: "Session signed out." });
  } catch (error) {
    console.error("Session revocation failed:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to end the selected session.",
    });
  }
});

module.exports = router;
