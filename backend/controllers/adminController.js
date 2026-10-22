const pool = require("../config/db");
const { isValidPassword } = require("../utils/inputValidation");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  ensureAuditTable,
  setSystemSetting,
  getSystemSetting,
  isSystemActive,
  logAuditEvent,
} = require("../config/audit");
const { getActiveEvaluationCycle } = require("../config/evaluationCycles");
const DEFAULT_USER_PASSWORD =
  process.env.USER_DEFAULT_PASSWORD ||
  process.env.DEFAULT_PASSWORD ||
  "12345678";

const tableExists = async (tableName) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS tableCount
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows[0]?.tableCount || 0) > 0;
};

const columnExists = async (tableName, columnName) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS columnCount
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.columnCount || 0) > 0;
};

const ensureBroadcastTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_broadcasts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      audience VARCHAR(32) NOT NULL,
      message TEXT NOT NULL,
      recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_by VARCHAR(255) NULL,
      title VARCHAR(255) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'sent',
      scheduled_at DATETIME NULL,
      failure_reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_broadcasts_created_at (created_at),
      INDEX idx_admin_broadcasts_schedule (status, scheduled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const columns = [
    ["title", "VARCHAR(255) NULL AFTER `created_by`"],
    ["status", "VARCHAR(16) NOT NULL DEFAULT 'sent' AFTER `title`"],
    ["scheduled_at", "DATETIME NULL AFTER `status`"],
    ["failure_reason", "TEXT NULL AFTER `scheduled_at`"],
  ];
  for (const [column, definition] of columns) {
    if (!(await columnExists("admin_broadcasts", column))) {
      await pool.query(`ALTER TABLE admin_broadcasts ADD COLUMN \`${column}\` ${definition}`);
    }
  }
  const [indexes] = await pool.query(
    `SELECT COUNT(*) AS indexCount FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_broadcasts' AND INDEX_NAME = 'idx_admin_broadcasts_schedule'`,
  );
  if (!Number(indexes[0]?.indexCount || 0)) {
    await pool.query("CREATE INDEX idx_admin_broadcasts_schedule ON admin_broadcasts (status, scheduled_at)");
  }
};

const getAdminDashboardStats = async (req, res) => {
  try {
    await ensureBroadcastTable();
    const hasPublishedEvaluations = await tableExists("published_evaluations");
    const hasSecurityLog = await tableExists("security_logs");
    const [hasPublishedEvaluationCreatedAt, hasSecurityLogCreatedAt] =
      await Promise.all([
        hasPublishedEvaluations
          ? columnExists("published_evaluations", "created_at")
          : false,
        hasSecurityLog ? columnExists("security_logs", "created_at") : false,
      ]);

    const upcomingEventsQuery = hasPublishedEvaluations
      ? "SELECT COUNT(*) AS upcomingEvents FROM published_evaluations WHERE status = 'active'"
      : "SELECT COUNT(*) AS upcomingEvents FROM evaluation_dispatches WHERE status = 'pending'";
    const securityPulseQuery = hasSecurityLog
      ? "SELECT COUNT(*) AS securityPulse FROM security_logs WHERE status IN ('flagged', 'pending', 'open')"
      : "SELECT COUNT(*) AS securityPulse FROM users WHERE LOWER(COALESCE(status, 'active')) <> 'active'";

    const [
      upcomingRows,
      broadcastRows,
      securityRows,
      headRows,
      userRows,
      roleRows,
      recentBroadcastRows,
      posture,
    ] = await Promise.all([
      pool.query(upcomingEventsQuery),
      pool.query(
        "SELECT COUNT(*) AS totalBroadcasts FROM admin_broadcasts WHERE status = 'sent'",
      ),
      pool.query(securityPulseQuery),
      pool.query(
        "SELECT COUNT(*) AS registeredHeads FROM users WHERE LOWER(TRIM(role)) = 'dept_head' AND LOWER(COALESCE(status, 'active')) = 'active'",
      ),
      pool.query(
        "SELECT COUNT(*) AS registeredUsers FROM users WHERE LOWER(COALESCE(status, 'active')) = 'active'",
      ),
      pool.query(
        "SELECT LOWER(TRIM(role)) AS role, COUNT(*) AS total FROM users WHERE LOWER(COALESCE(status, 'active')) = 'active' GROUP BY LOWER(TRIM(role)) ORDER BY total DESC",
      ),
      pool.query(
        "SELECT id, title, audience, message, recipient_count, created_by, status, scheduled_at, created_at FROM admin_broadcasts ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 8",
      ),
      calculateSecurityScore(),
    ]);

    const [
      broadcastTrendRows,
      headTrendRows,
      userTrendRows,
      eventTrendRows,
      securityTrendRows,
    ] = await Promise.all([
      pool.query(`SELECT
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS currentPeriod,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS previousPeriod
        FROM admin_broadcasts WHERE status = 'sent'`),
      pool.query(`SELECT
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS currentPeriod,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS previousPeriod
        FROM users WHERE LOWER(TRIM(role)) = 'dept_head' AND LOWER(COALESCE(status, 'active')) = 'active'`),
      pool.query(`SELECT
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS currentPeriod,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS previousPeriod
        FROM users WHERE LOWER(COALESCE(status, 'active')) = 'active'`),
      hasPublishedEvaluations && hasPublishedEvaluationCreatedAt
        ? pool.query(`SELECT
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS currentPeriod,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS previousPeriod
          FROM published_evaluations WHERE status = 'active'`)
        : !hasPublishedEvaluations
          ? pool.query(`SELECT
            SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS currentPeriod,
            SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS previousPeriod
            FROM evaluation_dispatches WHERE status = 'pending'`)
          : Promise.resolve([[]]),
      hasSecurityLog && hasSecurityLogCreatedAt
        ? pool.query(`SELECT
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS currentPeriod,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS previousPeriod
          FROM security_logs WHERE status IN ('flagged', 'pending', 'open')`)
        : Promise.resolve([[]]),
    ]);
    const percentageChange = (row) => {
      const previous = Number(row?.previousPeriod || 0);
      if (!row || !previous) return null;
      return Number(
        (
          ((Number(row.currentPeriod || 0) - previous) / previous) *
          100
        ).toFixed(1),
      );
    };

    return res.json({
      success: true,
      message: {
        en: "Admin dashboard statistics retrieved successfully.",
        am: "የአስተዳዳሪ ዳሽቦርድ ስታቲስቲክስ በተሳካ ሁኔታ ተገኝቷል።",
      },
      data: {
        upcomingEvents: Number(upcomingRows[0][0]?.upcomingEvents || 0),
        totalBroadcasts: Number(broadcastRows[0][0]?.totalBroadcasts || 0),
        securityPulse: Number(securityRows[0][0]?.securityPulse || 0),
        registeredHeads: Number(headRows[0][0]?.registeredHeads || 0),
        registeredUsers: Number(userRows[0][0]?.registeredUsers || 0),
        securityScore: Number(posture?.score || 0),
        roleCounts: Object.fromEntries(
          roleRows[0].map((row) => [row.role, Number(row.total || 0)]),
        ),
        recentBroadcasts: recentBroadcastRows[0],
        trends: {
          upcomingEvents: percentageChange(eventTrendRows[0]?.[0]),
          totalBroadcasts: percentageChange(broadcastTrendRows[0]?.[0]),
          securityPulse: percentageChange(securityTrendRows[0]?.[0]),
          registeredHeads: percentageChange(headTrendRows[0]?.[0]),
          registeredUsers: percentageChange(userTrendRows[0]?.[0]),
        },
      },
    });
  } catch (error) {
    console.error("Unable to retrieve admin dashboard statistics:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Unable to retrieve admin dashboard statistics.",
        am: "የአስተዳዳሪ ዳሽቦርድ ስታቲስቲክስን ማግኘት አልተቻለም።",
      },
      data: null,
    });
  }
};

const getBroadcastHistory = async (req, res) => {
  try {
    await ensureBroadcastTable();
    const [rows, countRows] = await Promise.all([
      pool.query(`
        SELECT id, title, audience, message, recipient_count, created_by, status, scheduled_at, failure_reason, created_at
        FROM admin_broadcasts
        ORDER BY COALESCE(scheduled_at, created_at) DESC
        LIMIT 100
      `),
      pool.query(`SELECT
        SUM(status = 'sent') AS sent,
        SUM(status = 'scheduled') AS scheduled,
        SUM(status = 'draft') AS drafts
        FROM admin_broadcasts`),
    ]);
    return res.json({
      success: true,
      data: {
        records: rows[0],
        counts: {
          sent: Number(countRows[0][0]?.sent || 0),
          scheduled: Number(countRows[0][0]?.scheduled || 0),
          drafts: Number(countRows[0][0]?.drafts || 0),
        },
      },
    });
  } catch (error) {
    console.error("Unable to retrieve broadcast history:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Unable to retrieve broadcast history.",
      });
  }
};

const BROADCAST_AUDIENCES = {
  all: null,
  students: ["student"],
  instructors: ["instructor"],
  deptheads: ["dept_head", "department_head", "department head"],
  academicdirectorate: [
    "academic_directorate",
    "academic_director",
    "directorate",
    "academic directorate",
  ],
  collegedean: ["college_dean", "dean", "college dean"],
  labassistants: ["lab_assistant", "ara", "lab assistant", "lab-assistant"],
};

const deliverBroadcast = async (connection, broadcast) => {
  const roleList = BROADCAST_AUDIENCES[broadcast.audience];
  const roleFilter = roleList
    ? ` AND LOWER(TRIM(role)) IN (${roleList.map(() => "?").join(", ")})`
    : "";
  const [recipients] = await connection.query(
    `SELECT id FROM users WHERE LOWER(COALESCE(status, 'active')) = 'active'${roleFilter}`,
    roleList || [],
  );
  if (!recipients.length) {
    await connection.query(
      "UPDATE admin_broadcasts SET status = 'failed', failure_reason = ?, scheduled_at = NULL WHERE id = ?",
      ["No active users match this broadcast audience.", broadcast.id],
    );
    return 0;
  }

  const title = broadcast.title || "System Broadcast";
  for (let offset = 0; offset < recipients.length; offset += 500) {
    const batch = recipients.slice(offset, offset + 500);
    const values = batch.map(() => "(?, ?, ?, ?)").join(", ");
    const params = batch.flatMap((recipient) => [
      recipient.id,
      title,
      broadcast.message,
      "broadcast",
    ]);
    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ${values}`,
      params,
    );
  }
  await connection.query(
    "UPDATE admin_broadcasts SET status = 'sent', recipient_count = ?, scheduled_at = NULL, failure_reason = NULL WHERE id = ?",
    [recipients.length, broadcast.id],
  );
  return recipients.length;
};

const sendBroadcast = async (req, res) => {
  const audience = String(req.body.audience || "")
    .trim()
    .toLowerCase();
  const message = String(req.body.message || "").trim();
  const requestedStatus = String(req.body.status || "sent").trim().toLowerCase();
  const status = requestedStatus === "draft" ? "draft" : requestedStatus === "scheduled" ? "scheduled" : requestedStatus;
  const scheduledAt = req.body.scheduled_at ? new Date(req.body.scheduled_at) : null;
  const title = String(req.body.title || message.split(/\r?\n/, 1)[0] || "System Broadcast").trim().slice(0, 255);

  if (!Object.prototype.hasOwnProperty.call(BROADCAST_AUDIENCES, audience)) {
    return res
      .status(400)
      .json({ success: false, message: "Select a valid broadcast audience." });
  }
  if (!["sent", "scheduled", "draft"].includes(status)) {
    return res.status(400).json({ success: false, message: "Select a valid broadcast status." });
  }
  if (!message || message.length > 500) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Broadcast message is required and must be 500 characters or fewer.",
      });
  }
  if (status === "scheduled" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) {
    return res.status(400).json({ success: false, message: "Choose a future date and time for scheduled delivery." });
  }

  let connection;
  try {
    await ensureBroadcastTable();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const createdBy = req.user?.username || req.user?.id || "Admin";
    let broadcastId;
    let recipientCount = 0;
    if (status === "sent") {
      const [result] = await connection.query(
        `INSERT INTO admin_broadcasts
          (audience, message, recipient_count, created_by, title, status)
         VALUES (?, ?, 0, ?, ?, 'draft')`,
        [audience, message, String(createdBy), title],
      );
      broadcastId = result.insertId;
      recipientCount = await deliverBroadcast(connection, {
        id: broadcastId,
        audience,
        message,
        title,
      });
      if (!recipientCount) {
        await connection.commit();
        return res.status(404).json({
          success: false,
          message: "No active users match this broadcast audience.",
        });
      }
    } else {
      const [result] = await connection.query(
        `INSERT INTO admin_broadcasts
          (audience, message, recipient_count, created_by, title, status, scheduled_at)
         VALUES (?, ?, 0, ?, ?, ?, ?)`,
        [audience, message, String(createdBy), title, status, status === "scheduled" ? scheduledAt : null],
      );
      broadcastId = result.insertId;
    }
    const [[savedBroadcast]] = await connection.query(
      "SELECT created_at FROM admin_broadcasts WHERE id = ? LIMIT 1",
      [broadcastId],
    );
    await connection.commit();
    return res.status(201).json({
      success: true,
      data: {
        id: broadcastId,
        title,
        audience,
        message,
        recipient_count: recipientCount,
        created_by: String(createdBy),
        status,
        scheduled_at: status === "scheduled" ? scheduledAt : null,
        created_at: savedBroadcast?.created_at || new Date(),
      },
      message: status === "sent" ? "Broadcast sent successfully." : `Broadcast ${status} successfully.`,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Unable to send broadcast:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to send broadcast." });
  } finally {
    connection?.release();
  }
};

const deleteBroadcast = async (req, res) => {
  const broadcastId = Number(req.params.id);
  if (!Number.isInteger(broadcastId) || broadcastId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid broadcast ID." });
  }
  try {
    await ensureBroadcastTable();
    const [result] = await pool.query(
      "DELETE FROM admin_broadcasts WHERE id = ? AND status IN ('draft', 'scheduled', 'failed')",
      [broadcastId],
    );
    if (!result.affectedRows) {
      return res.status(409).json({ success: false, message: "Only drafts, scheduled, or failed broadcasts can be deleted." });
    }
    return res.json({ success: true, message: "Broadcast deleted." });
  } catch (error) {
    console.error("Unable to delete broadcast:", error);
    return res.status(500).json({ success: false, message: "Unable to delete broadcast." });
  }
};

let broadcastSchedulerTimer = null;
let broadcastSchedulerRunning = false;
const processDueBroadcasts = async () => {
  if (broadcastSchedulerRunning) return;
  broadcastSchedulerRunning = true;
  let connection;
  try {
    await ensureBroadcastTable();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [broadcasts] = await connection.query(
      `SELECT id, audience, message, title FROM admin_broadcasts
       WHERE status = 'scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC LIMIT 20 FOR UPDATE`,
    );
    for (const broadcast of broadcasts) {
      try {
        const recipientCount = await deliverBroadcast(connection, broadcast);
        if (!recipientCount) {
          console.error(`Scheduled broadcast ${broadcast.id} failed: no active recipients.`);
        }
      } catch (error) {
        await connection.query(
          "UPDATE admin_broadcasts SET status = 'failed', failure_reason = ?, scheduled_at = NULL WHERE id = ?",
          [error.message || "Broadcast delivery failed.", broadcast.id],
        );
        console.error(`Scheduled broadcast ${broadcast.id} failed:`, error);
      }
    }
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Unable to process scheduled broadcasts:", error);
  } finally {
    connection?.release();
    broadcastSchedulerRunning = false;
  }
};

const startBroadcastScheduler = async () => {
  if (broadcastSchedulerTimer) return;
  await ensureBroadcastTable();
  void processDueBroadcasts();
  broadcastSchedulerTimer = setInterval(processDueBroadcasts, 30000);
  broadcastSchedulerTimer.unref?.();
};

const getDepartmentAnalytics = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        d.id AS department_id,
        d.name AS department,
        ROUND(COALESCE(AVG(ses.score), 0), 2) AS score
      FROM departments d
      LEFT JOIN course_assignments ca ON ca.department_id = d.id
      LEFT JOIN evaluation_dispatches ed ON ed.assignment_id = ca.id
      LEFT JOIN student_evaluation_submissions ses
        ON ses.dispatch_id = ed.id
        AND LOWER(TRIM(COALESCE(ses.status, 'submitted'))) = 'submitted'
      GROUP BY d.id, d.name
      ORDER BY d.name ASC
    `);

    return res.json({
      success: true,
      message: {
        en: "Department analytics retrieved successfully.",
        am: "የዲፓርትመንት ትንታኔ በተሳካ ሁኔታ ተገኝቷል።",
      },
      data: rows.map((row) => ({
        department: row.department,
        score: Number(row.score || 0),
      })),
    });
  } catch (error) {
    console.error("Unable to retrieve department analytics:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Unable to retrieve department analytics.",
        am: "የዲፓርትመንት ትንታኔን ማግኘት አልተቻለም።",
      },
      data: null,
    });
  }
};

const getSecurityLogs = async (req, res) => {
  try {
    await ensureAuditTable();
    const [auditRows, connectionRows, settingRows] = await Promise.all([
      pool.query(
        `
        SELECT id, action_title, action, description, performed_by, ip_address, user_agent, device_id, network_interface_name, network_interface_mac, created_at
        FROM audit_logs
        WHERE (? = '' OR CONCAT_WS(' ', action_title, action, description, performed_by, ip_address, user_agent, device_id, network_interface_name, network_interface_mac) LIKE ?)
        ORDER BY created_at DESC
        LIMIT 30
      `,
        [
          String(req.query.search || "").trim(),
          `%${String(req.query.search || "").trim()}%`,
        ],
      ),
      pool.query("SHOW STATUS LIKE 'Threads_connected'"),
      pool.query(`
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE setting_key IN ('last_backup', 'backup_retention_days', 'security_score', 'api_token', 'system_active')
      `),
    ]);

    const settingValues = Array.isArray(settingRows[0]) ? settingRows[0] : [];
    const settings = settingValues.reduce((result, row) => {
      result[row.setting_key] = row.setting_value;
      return result;
    }, {});

    const systemState = await isSystemActive();

    return res.json({
      success: true,
      message: {
        en: "Security logs retrieved successfully.",
        am: "የደህንነት መዝገቦች በተሳካ ሁኔታ ተገኝተዋል።",
      },
      data: {
        logs: auditRows[0].map((row) => ({
          id: row.id,
          action: row.action_title || row.action || "SYSTEM_EVENT",
          desc: row.description || row.action || "No description provided",
          user: row.performed_by || "System",
          ip: row.ip_address || "N/A",
          time: row.created_at,
          browser: row.user_agent || "Unknown agent",
          deviceId: row.device_id || "Not available",
          networkInterface: row.network_interface_name || "Not available",
          networkMac: row.network_interface_mac || "Not available",
        })),
        database: {
          status: "Online",
          connections: Number(connectionRows[0]?.Value || 0),
          lastBackup: settings.last_backup || "--",
          backupRetentionDays: Number(settings.backup_retention_days || 0),
          securityScore: settings.security_score || "0",
          apiToken: settings.api_token || "",
          systemActive: systemState,
        },
      },
    });
  } catch (error) {
    console.error("Unable to retrieve security logs:", error);
    return res.status(500).json({
      success: false,
      message: {
        en: "Unable to retrieve security logs.",
        am: "የደህንነት መዝገቦችን ማግኘት አልተቻለም።",
      },
      data: null,
    });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    await ensureAuditTable();
    const search = String(req.query.search || "").trim();
    const [rows] = await pool.query(
      `
      SELECT id, user_id, action, ip_address, user_agent, device_id, network_interface_name, network_interface_mac, description, performed_by, action_title, created_at
      FROM audit_logs
      WHERE (? = '' OR CONCAT_WS(' ', action, action_title, description, performed_by, ip_address, user_agent, device_id, network_interface_name, network_interface_mac) LIKE ?)
      ORDER BY created_at DESC
      LIMIT 100
    `,
      [search, `%${search}%`],
    );

    return res.json({
      success: true,
      message: "Audit logs retrieved successfully.",
      data: rows,
    });
  } catch (error) {
    console.error("Unable to retrieve audit logs:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve audit logs.",
      data: null,
    });
  }
};

const setSystemMaintenanceMode = async (req, res) => {
  try {
    const active = String(req.body?.active ?? "true")
      .trim()
      .toLowerCase();
    const value =
      active === "false" || active === "0" || active === "off"
        ? "false"
        : "true";
    const savedValue = await setSystemSetting("system_active", value);

    return res.json({
      success: true,
      message:
        value === "true"
          ? "System access enabled."
          : "System access disabled for maintenance.",
      data: { systemActive: savedValue === "true" },
    });
  } catch (error) {
    console.error("Unable to update system maintenance mode:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update system maintenance mode.",
    });
  }
};

const getEvaluationWindow = async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (activeCycle) {
      return res.json({
        success: true,
        data: {
          startAt: activeCycle.start_at || "",
          endAt: activeCycle.end_at || "",
          academicYear: activeCycle.academic_year,
          semester: activeCycle.semester,
          cycleId: Number(activeCycle.id),
          configured: Boolean(activeCycle.start_at && activeCycle.end_at),
        },
      });
    }

    const savedValue = await getSystemSetting("evaluation_window");
    let window = { startAt: "", endAt: "" };
    if (savedValue) {
      try {
        const parsedValue = JSON.parse(savedValue);
        window = {
          startAt: String(parsedValue.startAt || ""),
          endAt: String(parsedValue.endAt || ""),
        };
      } catch (error) {
        console.error("Stored evaluation window is invalid JSON:", error);
        return res.status(500).json({
          success: false,
          message: "The saved evaluation window is invalid.",
        });
      }
    }

    return res.json({
      success: true,
      data: {
        ...window,
        configured: Boolean(window.startAt && window.endAt),
      },
    });
  } catch (error) {
    console.error("Unable to retrieve evaluation window:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve evaluation window.",
    });
  }
};

const getEvaluationCycles = async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    const [cycles] = await pool.query(
      `SELECT ec.id, ec.academic_year, ec.semester, ec.start_at, ec.end_at, ec.status,
         ec.created_at, COUNT(ca.id) AS assignment_count
       FROM evaluation_cycles ec
       LEFT JOIN course_assignments ca ON ca.cycle_id = ec.id
       GROUP BY ec.id
       ORDER BY ec.id DESC`,
    );
    return res.json({
      success: true,
      data: {
        activeCycleId: Number(activeCycle?.id || 0),
        cycles: cycles.map((cycle) => ({
          ...cycle,
          id: Number(cycle.id),
          assignment_count: Number(cycle.assignment_count || 0),
        })),
      },
    });
  } catch (error) {
    console.error("Unable to retrieve evaluation cycles:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve evaluation cycles.",
    });
  }
};

const setEvaluationWindow = async (req, res) => {
  try {
    const startAt = String(req.body?.startAt || "").trim();
    const endAt = String(req.body?.endAt || "").trim();
    if ((!startAt && endAt) || (startAt && !endAt)) {
      return res.status(400).json({
        success: false,
        message: "Both evaluation start and expiry date/time are required.",
      });
    }

    if (startAt || endAt) {
      const isUtcTimestamp = (value) =>
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString() === value;
      if (
        !isUtcTimestamp(startAt) ||
        !isUtcTimestamp(endAt) ||
        Date.parse(startAt) >= Date.parse(endAt)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Enter valid dates and times, with the expiry later than the start.",
        });
      }
    }

    const window = { startAt, endAt };
    await setSystemSetting(
      "evaluation_window",
      startAt ? JSON.stringify(window) : "",
    );
    const activeCycle = await getActiveEvaluationCycle();
    if (activeCycle) {
      await pool.query(
        "UPDATE evaluation_cycles SET start_at = ?, end_at = ? WHERE id = ?",
        [startAt, endAt, activeCycle.id],
      );
    }
    await logAuditEvent({
      userId: req.user?.id,
      action: "EVALUATION_WINDOW_UPDATED",
      req,
      description: startAt
        ? `Evaluation window set from ${startAt} to ${endAt}.`
        : "Evaluation window cleared.",
      performedBy: req.user?.username,
    });

    return res.json({
      success: true,
      message: "Evaluation window updated successfully.",
      data: {
        ...window,
        academicYear: activeCycle?.academic_year || "",
        semester: activeCycle?.semester || "",
        cycleId: Number(activeCycle?.id || 0),
        configured: Boolean(startAt && endAt),
      },
    });
  } catch (error) {
    console.error("Unable to update evaluation window:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update evaluation window.",
    });
  }
};

const startEvaluationCycle = async (req, res) => {
  let connection;
  try {
    const academicYear = String(req.body?.academicYear || "").trim();
    const semester = String(req.body?.semester || "").trim();
    const startAt = String(req.body?.startAt || "").trim();
    const endAt = String(req.body?.endAt || "").trim();
    const isUtcTimestamp = (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value;

    if (!academicYear || academicYear.length > 32 || !semester || semester.length > 32) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid academic year and semester for the new cycle.",
      });
    }
    if (
      !isUtcTimestamp(startAt) ||
      !isUtcTimestamp(endAt) ||
      Date.parse(startAt) >= Date.parse(endAt)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter valid cycle dates, with the expiry later than the start.",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [[activeCycle]] = await connection.query(
      `SELECT ec.* FROM system_settings setting
       INNER JOIN evaluation_cycles ec ON ec.id = CAST(setting.setting_value AS UNSIGNED)
       WHERE setting.setting_key = 'active_evaluation_cycle_id'
       LIMIT 1 FOR UPDATE`,
    );
    if (!activeCycle) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "There is no active evaluation cycle to renew.",
      });
    }

    const activeCycleExpiry = Date.parse(activeCycle.end_at || "");
    if (!Number.isFinite(activeCycleExpiry)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Set a valid expiry date for the active cycle before starting another.",
      });
    }
    if (activeCycleExpiry > Date.now()) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "The active evaluation cycle has not expired yet.",
      });
    }

    const [[existingCycle]] = await connection.query(
      "SELECT id FROM evaluation_cycles WHERE academic_year = ? AND semester = ? LIMIT 1",
      [academicYear, semester],
    );
    if (existingCycle) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "An evaluation cycle already exists for that academic year and semester.",
      });
    }

    const [[assignmentCount]] = await connection.query(
      "SELECT COUNT(*) AS total FROM course_assignments WHERE cycle_id = ?",
      [activeCycle.id],
    );
    if (!Number(assignmentCount?.total || 0)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "The current cycle has no course assignments to copy.",
      });
    }

    const [cycleResult] = await connection.query(
      `INSERT INTO evaluation_cycles
        (academic_year, semester, start_at, end_at, status, created_by)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [academicYear, semester, startAt, endAt, req.user?.id || null],
    );
    const cycleId = Number(cycleResult.insertId);
    const [copyResult] = await connection.query(
      `INSERT INTO course_assignments
        (course_id, department_id, instructor_id, student_id, program_type,
         year_level, semester, section, academic_year, cycle_id, publish_target,
         is_published, is_student_published, is_peer_published, status)
       SELECT course_id, department_id, instructor_id, student_id, program_type,
         year_level, ?, section, ?, ?, '', 0, 0, 0, 'Assigned'
       FROM course_assignments
       WHERE cycle_id = ?`,
      [semester, academicYear, cycleId, activeCycle.id],
    );

    await connection.query(
      "UPDATE evaluation_cycles SET status = 'archived' WHERE id = ?",
      [activeCycle.id],
    );
    await connection.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('active_evaluation_cycle_id', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [String(cycleId)],
    );
    await connection.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('evaluation_window', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [JSON.stringify({ startAt, endAt })],
    );

    await connection.commit();
    await logAuditEvent({
      userId: req.user?.id,
      action: "EVALUATION_CYCLE_STARTED",
      req,
      description: `Started evaluation cycle ${academicYear} ${semester}; copied ${copyResult.affectedRows} unpublished course assignments.`,
      performedBy: req.user?.username,
    });
    return res.status(201).json({
      success: true,
      message: "New evaluation cycle started.",
      data: {
        cycleId,
        academicYear,
        semester,
        startAt,
        endAt,
        assignmentCount: Number(copyResult.affectedRows || 0),
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Evaluation cycle rollback failed:", rollbackError);
      });
    }
    console.error("Unable to start evaluation cycle:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to start the new evaluation cycle.",
    });
  } finally {
    connection?.release();
  }
};

const resetEvaluationCycle = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let [[activeCycle]] = await connection.query(
      `SELECT ec.* FROM system_settings setting
       INNER JOIN evaluation_cycles ec ON ec.id = CAST(setting.setting_value AS UNSIGNED)
       WHERE setting.setting_key = 'active_evaluation_cycle_id'
         AND ec.status = 'active'
       LIMIT 1 FOR UPDATE`,
    );
    if (!activeCycle) {
      const [[fallbackCycle]] = await connection.query(
        "SELECT * FROM evaluation_cycles WHERE status = 'active' ORDER BY id DESC LIMIT 1 FOR UPDATE",
      );
      if (!fallbackCycle) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: "There is no active evaluation cycle to reset.",
          data: { cycle: "unchanged" },
        });
      }
      activeCycle = fallbackCycle;
    }

    const [[resultSummary]] = await connection.query(
      `SELECT COUNT(*) AS publishedResults
       FROM evaluation_results
       WHERE cycle_id = ?`,
      [activeCycle.id],
    );
    const [assignmentResult] = await connection.query(
      `UPDATE course_assignments
       SET status = 'Archived'
       WHERE cycle_id = ?`,
      [activeCycle.id],
    );
    const [studentResult] = await connection.query(
      "UPDATE students SET requires_profile_update = 1 WHERE requires_profile_update = 0",
    );
    await connection.query(
      `UPDATE evaluation_cycles
       SET status = 'archived', start_at = '', end_at = ''
       WHERE id = ?`,
      [activeCycle.id],
    );
    await connection.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('active_evaluation_cycle_id', '')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    );
    await connection.query(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('evaluation_window', '')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    );

    await connection.commit();
    let auditLog = "recorded";
    try {
      await logAuditEvent({
        userId: req.user?.id,
        action: "EVALUATION_CYCLE_RESET",
        req,
        description: `Archived evaluation cycle ${activeCycle.academic_year} ${activeCycle.semester}; archived ${assignmentResult.affectedRows} course assignments and marked ${studentResult.affectedRows} student profiles for update.`,
        performedBy: req.user?.username,
      });
    } catch (auditError) {
      auditLog = "failed";
      console.error("Evaluation cycle reset succeeded but audit logging failed:", auditError);
    }
    return res.json({
      success: true,
      message: auditLog === "recorded"
        ? "Evaluation cycle reset successfully."
        : "Evaluation cycle reset successfully, but audit logging failed.",
      data: {
        cycle: {
          id: Number(activeCycle.id),
          academicYear: activeCycle.academic_year,
          semester: activeCycle.semester,
          status: "archived",
        },
        courseAssignments: {
          archived: Number(assignmentResult.affectedRows || 0),
        },
        studentProfiles: {
          markedForUpdate: Number(studentResult.affectedRows || 0),
        },
        instructorPerformanceResults: {
          preserved: Number(resultSummary?.publishedResults || 0),
        },
        evaluationDates: "cleared",
        activeCycle: "cleared",
        auditLog,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Evaluation cycle reset rollback failed:", rollbackError);
      });
    }
    console.error("Unable to reset evaluation cycle:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset the evaluation cycle.",
      data: { reset: "rolled_back" },
    });
  } finally {
    connection?.release();
  }
};

const createCollege = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const code = String(req.body.code || "")
      .trim()
      .toUpperCase();
    const description = String(req.body.description || "").trim();
    if (!name || !code)
      return res
        .status(400)
        .json({ message: "College name and code are required." });
    if (description.length > 1000) {
      return res
        .status(400)
        .json({ message: "College description must be 1000 characters or fewer." });
    }

    const [result] = await pool.query(
      "INSERT INTO colleges (name, code, description) VALUES (?, ?, ?)",
      [name, code, description || null],
    );
    return res
      .status(201)
      .json({
        id: result.insertId,
        name,
        code,
        description: description || null,
        message: "College created successfully.",
      });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ message: "College name or code already exists." });
    console.error("Unable to create college:", error);
    return res.status(500).json({ message: "Unable to create college." });
  }
};

const updateCollege = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || "").trim();
    const code = String(req.body.code || "").trim().toUpperCase();
    const description = req.body.description === undefined
      ? undefined
      : String(req.body.description || "").trim();
    if (!Number.isInteger(id) || id <= 0 || !name || !code) {
      return res.status(400).json({
        message: "A valid college ID, name, and code are required.",
      });
    }
    if (description !== undefined && description.length > 1000) {
      return res
        .status(400)
        .json({ message: "College description must be 1000 characters or fewer." });
    }

    const [result] = description === undefined
      ? await pool.query(
          "UPDATE colleges SET name = ?, code = ? WHERE id = ?",
          [name, code, id],
        )
      : await pool.query(
          "UPDATE colleges SET name = ?, code = ?, description = ? WHERE id = ?",
          [name, code, description || null, id],
        );
    if (!result.affectedRows) {
      const [rows] = await pool.query(
        "SELECT id FROM colleges WHERE id = ?",
        [id],
      );
      if (!rows.length) {
        return res.status(404).json({ message: "College not found." });
      }
    }

    return res.json({
      id,
      name,
      code,
      ...(description === undefined ? {} : { description: description || null }),
      message: "College updated successfully.",
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "College name or code already exists." });
    }
    console.error("Unable to update college:", error);
    return res.status(500).json({ message: "Unable to update college." });
  }
};

const deleteCollege = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "A valid college ID is required." });
  }

  try {
    const [result] = await pool.query("DELETE FROM colleges WHERE id = ?", [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "College not found." });
    }
    return res.json({ id, message: "College deleted successfully." });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message: "This college cannot be deleted while it has departments.",
      });
    }
    console.error("Unable to delete college:", error);
    return res.status(500).json({ message: "Unable to delete college." });
  }
};

const getColleges = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, code, description, created_at FROM colleges ORDER BY name ASC",
    );
    return res.json(rows);
  } catch (error) {
    console.error("Unable to retrieve colleges:", error);
    return res.status(500).json({ message: "Unable to retrieve colleges." });
  }
};

const normalizeManagementRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  const aliases = {
    vice_president: "vice_president",
    vice_presdant: "vice_president",
    vic_president: "vice_president",
  };
  return aliases[normalized] ?? normalized;
};

const getManagementRoleOccupant = async (req, res) => {
  const role = normalizeManagementRole(req.query.role);
  const collegeId = Number(req.query.college_id || 0) || null;
  const departmentId = Number(req.query.department_id || 0) || null;
  if (!["dept_head", "college_dean", "academic_directorate", "vice_president"].includes(role)) {
    return res.status(400).json({ message: "Unsupported management role." });
  }
  if (role === "college_dean" && !collegeId)
    return res.status(400).json({ message: "A college is required." });
  if (role === "dept_head" && !departmentId)
    return res.status(400).json({ message: "A department is required." });

  try {
    const scopeClause =
      ["academic_directorate", "vice_president"].includes(role)
        ? ""
        : role === "college_dean"
          ? "AND d.college_id = ?"
          : "AND i.department_id = ?";
    const params =
      ["academic_directorate", "vice_president"].includes(role)
        ? [role]
        : [role, role === "college_dean" ? collegeId : departmentId];
    const [[occupant]] = await pool.query(
      `
      SELECT u.id, u.role, COALESCE(CONCAT(i.first_name, ' ', i.last_name), u.username) AS full_name,
        i.department_id, d.name AS department_name, d.college_id, c.name AS college_name
      FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      WHERE u.role = ? AND LOWER(COALESCE(u.status, 'active')) = 'active' ${scopeClause}
      ORDER BY u.id ASC LIMIT 1
    `,
      params,
    );
    return res.json(occupant || null);
  } catch (error) {
    console.error("Unable to retrieve management role occupant:", error);
    return res
      .status(500)
      .json({ message: "Unable to retrieve management role occupant." });
  }
};

const assignRoleWithHierarchy = async (req, res) => {
  const allowedRoles = ["dept_head", "college_dean", "academic_directorate", "vice_president"];
  const role = normalizeManagementRole(req.body.role);
  const userId = Number(req.params.id);
  const collegeId = Number(req.body.college_id || 0) || null;
  const departmentId = Number(req.body.department_id || 0) || null;
  if (!allowedRoles.includes(role))
    return res.status(400).json({ message: "Unsupported management role." });
  if (!Number.isInteger(userId) || userId <= 0)
    return res.status(400).json({ message: "Invalid user ID." });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.query(
      `
      SELECT u.id, u.role, u.status, i.department_id, d.college_id
      FROM users u
      LEFT JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      WHERE u.id = ? LIMIT 1
    `,
      [userId],
    );
    if (!user) {
      await connection.rollback();
      return res.status(404).json({ message: "User not found." });
    }
    const currentRole = normalizeManagementRole(user.role);
    const currentStatus = String(user.status || "active").trim().toLowerCase();
    if (currentStatus !== "active") {
      await connection.rollback();
      return res
        .status(400)
        .json({
          message: "Only active instructors can receive institutional roles.",
        });
    }
    if (
      !["instructor", "dept_head", "college_dean"].includes(currentRole)
    ) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Students cannot receive institutional roles." });
    }
    if (
      role === "college_dean" &&
      (!collegeId || Number(user.college_id) !== collegeId)
    ) {
      await connection.rollback();
      return res
        .status(400)
        .json({
          message: "Instructor does not belong to the selected college.",
        });
    }
    if (
      role === "dept_head" &&
      (!departmentId ||
        currentRole !== "instructor" ||
        Number(user.department_id) !== departmentId)
    ) {
      await connection.rollback();
      return res
        .status(400)
        .json({
          message: "Instructor does not belong to the selected department.",
        });
    }
    if (
      ["academic_directorate", "vice_president"].includes(role) &&
      !["instructor", "dept_head", "college_dean"].includes(currentRole)
    ) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Only academic staff can receive this role." });
    }

    const scopeClause =
      ["academic_directorate", "vice_president"].includes(role)
        ? ""
        : role === "college_dean"
          ? "AND d.college_id = ?"
          : "AND i.department_id = ?";
    const scopeParams =
      ["academic_directorate", "vice_president"].includes(role)
        ? []
        : [role === "college_dean" ? collegeId : departmentId];
    const [[occupant]] = await connection.query(
      `
      SELECT u.id, COALESCE(CONCAT(i.first_name, ' ', i.last_name), u.username) AS full_name
      FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      WHERE u.role = ? AND LOWER(COALESCE(u.status, 'active')) = 'active' ${scopeClause}
      LIMIT 1 FOR UPDATE
    `,
      [role, ...scopeParams],
    );
    if (occupant && Number(occupant.id) !== userId) {
      await connection.rollback();
      const roleLabel = {
        dept_head: "Department Head",
        college_dean: "College Dean",
        academic_directorate: "Academic Directorate",
        vice_president: "Vice President",
      }[role];
      return res
        .status(409)
        .json({
          message: `Current ${roleLabel}: ${occupant.full_name}. Remove the current occupant first.`,
        });
    }

    const [result] = await connection.query(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, userId],
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ message: "User not found." });
    }
    await connection.commit();
    return res.json({
      id: userId,
      role,
      message: "Role assigned successfully.",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Unable to assign management role:", error);
    return res
      .status(500)
      .json({ message: "Unable to assign management role." });
  } finally {
    connection.release();
  }
};

const resetManagementRole = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0)
    return res.status(400).json({ message: "Invalid user ID." });
  try {
    const [result] = await pool.query(
      "UPDATE users SET role = 'instructor' WHERE id = ? AND role IN ('dept_head', 'college_dean', 'academic_directorate', 'vice_president', 'vic_president', 'vice_presdant')",
      [userId],
    );
    if (!result.affectedRows)
      return res
        .status(404)
        .json({ message: "Active management role occupant not found." });
    return res.json({
      id: userId,
      role: "instructor",
      message: "Management role removed successfully.",
    });
  } catch (error) {
    console.error("Unable to reset management role:", error);
    return res
      .status(500)
      .json({ message: "Unable to reset management role." });
  }
};

const resetUserPassword = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0)
    return res.status(400).json({ message: "Invalid user ID." });

  if (
    DEFAULT_USER_PASSWORD.length < 8 ||
    Buffer.byteLength(DEFAULT_USER_PASSWORD, "utf8") > 72
  ) {
    console.error(
      "Unable to reset user password: configured default password must be at least 8 characters and no more than 72 bytes.",
    );
    return res.status(500).json({
      success: false,
      message: "The configured default password is invalid. Contact the system administrator.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 12);
    const [result] = await pool.query(
      `UPDATE users
       SET password_hash = ?, is_first_login = 1,
           reset_otp = NULL, otp_expiry = NULL,
           reset_token = NULL, token_expires = NULL
       WHERE id = ?`,
      [passwordHash, userId],
    );
    if (!result.affectedRows)
      return res.status(404).json({ message: "User not found." });
    return res.json({
      success: true,
      id: userId,
      defaultPassword: DEFAULT_USER_PASSWORD,
      forcePasswordChange: true,
      message: "Password reset completed.",
    });
  } catch (error) {
    console.error("Unable to reset user password:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to reset user password." });
  }
};

const resetUserPasswordDirectly = async (req, res) => {
  const userId = Number(req.body?.userId);
  const newPassword = req.body?.newPassword;
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: "A valid target user ID is required.",
    });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "Password must contain at least 8 characters.",
    });
  }
  if (Buffer.byteLength(newPassword, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message: "Password must not exceed 72 UTF-8 bytes.",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const [result] = await pool.query(
      `UPDATE users
       SET password_hash = ?, is_first_login = 1,
           reset_otp = NULL, otp_expiry = NULL,
           reset_token = NULL, token_expires = NULL
       WHERE id = ?`,
      [passwordHash, userId],
    );
    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Target user was not found.",
      });
    }
    return res.json({
      success: true,
      id: userId,
      message: "Password reset successfully. The user must change it at next login.",
    });
  } catch (error) {
    console.error("Unable to reset user password directly:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to reset the target user's password.",
    });
  }
};

const getRoleCandidates = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.role, u.status,
        COALESCE(CONCAT(i.first_name, ' ', i.last_name), u.username) AS full_name,
        i.department_id, d.name AS department_name, d.college_id, c.name AS college_name,
        ups.profile_picture
      FROM users u
      INNER JOIN instructors i ON i.user_id = u.id
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN colleges c ON c.id = d.college_id
      LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
      WHERE u.role IN ('instructor', 'dept_head', 'college_dean', 'vice_president', 'vic_president', 'vice_presdant')
        AND LOWER(COALESCE(u.status, 'active')) = 'active'
      ORDER BY full_name ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Unable to retrieve role candidates:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Unable to retrieve role candidates.",
        data: null,
      });
  }
};

const parseBooleanSetting = (value, fallback = false) => {
  if (value === null || value === undefined || value === "") return fallback;
  return ["true", "1", "on", "enabled"].includes(
    String(value).trim().toLowerCase(),
  );
};

const calculateSecurityScore = async () => {
  const [mfa, token, system] = await Promise.all([
    getSystemSetting("mfa_enabled", "true"),
    getSystemSetting("api_token", ""),
    isSystemActive(),
  ]);
  let score = 60;
  if (parseBooleanSetting(mfa, true)) score += 20;
  if (token) score += 15;
  if (system) score += 5;
  return {
    score,
    protectionStatus:
      score >= 85 ? "Protected" : score >= 70 ? "Needs attention" : "At risk",
  };
};

const getSecurityScore = async (req, res) => {
  try {
    const posture = await calculateSecurityScore();
    await setSystemSetting("security_score", String(posture.score));
    return res.json({ success: true, data: posture });
  } catch (error) {
    console.error("Unable to calculate security score:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to calculate security score." });
  }
};

const getApiToken = async (req, res) => {
  try {
    const token = await getSystemSetting("api_token", "");
    return res.json({
      success: true,
      data: {
        token,
        maskedToken: token
          ? `${token.slice(0, 6)}${"*".repeat(Math.max(4, token.length - 10))}${token.slice(-4)}`
          : null,
      },
    });
  } catch (error) {
    console.error("Unable to retrieve API token:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to retrieve API token." });
  }
};

const rotateApiToken = async (req, res) => {
  try {
    const token = `ipes_${crypto.randomBytes(32).toString("hex")}`;
    await setSystemSetting("api_token", token);
    await logAuditEvent({
      req,
      userId: req.user?.id,
      performedBy: req.user?.id,
      action: "API_TOKEN_ROTATED",
      description: "Integration API token rotated.",
    });
    return res.json({
      success: true,
      data: {
        token,
        maskedToken: `${token.slice(0, 6)}${"*".repeat(token.length - 10)}${token.slice(-4)}`,
      },
    });
  } catch (error) {
    console.error("Unable to rotate API token:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to rotate API token." });
  }
};

const setMfaToggle = async (req, res) => {
  try {
    const enabled = parseBooleanSetting(req.body?.enabled, true);
    const roles = Array.isArray(req.body?.roles)
      ? req.body.roles.map((role) => String(role).trim()).filter(Boolean)
      : [];
    await setSystemSetting("mfa_enabled", enabled ? "true" : "false");
    await setSystemSetting("mfa_roles", JSON.stringify(roles));
    await logAuditEvent({
      req,
      userId: req.user?.id,
      performedBy: req.user?.id,
      action: "MFA_SETTING_CHANGED",
      description: `MFA ${enabled ? "enabled" : "disabled"}${roles.length ? ` for ${roles.join(", ")}` : " system-wide"}.`,
    });
    return res.json({ success: true, data: { enabled, roles } });
  } catch (error) {
    console.error("Unable to update MFA setting:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update MFA setting." });
  }
};

const getMfaToggle = async (req, res) => {
  try {
    const enabled = parseBooleanSetting(
      await getSystemSetting("mfa_enabled", "true"),
      true,
    );
    let roles = [];
    try {
      roles = JSON.parse(await getSystemSetting("mfa_roles", "[]")) || [];
    } catch {
      roles = [];
    }
    return res.json({ success: true, data: { enabled, roles } });
  } catch (error) {
    console.error("Unable to retrieve MFA setting:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to retrieve MFA setting." });
  }
};

const getDatabaseHealth = async (req, res) => {
  const startedAt = Date.now();
  try {
    const connection = await pool.getConnection();
    try {
      await connection.query("SELECT 1");
      const [statusRows] = await connection.query(
        "SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running')",
      );
      let replicaRows;
      try {
        [replicaRows] = await connection.query("SHOW REPLICA STATUS");
      } catch {
        [replicaRows] = await connection.query("SHOW SLAVE STATUS");
      }
      const status = Object.fromEntries(
        statusRows.map((row) => [row.Variable_name, Number(row.Value || 0)]),
      );
      const replica = replicaRows[0] || null;
      const lastBackup = await getSystemSetting("last_backup", null);
      const backupRetentionDays =
        Number(await getSystemSetting("backup_retention_days", "7")) || 7;
      return res.json({
        success: true,
        data: {
          status: "Online",
          latencyMs: Date.now() - startedAt,
          connections: status.Threads_connected || 0,
          runningQueries: status.Threads_running || 0,
          replication: replica
            ? replica.Replica_SQL_Running === "Yes"
              ? "Online"
              : "Degraded"
            : "Standalone",
          replicationLag: replica?.Seconds_Behind_Master ?? 0,
          cacheHitRate: "N/A",
          diskUsage: "N/A",
          backupReady: Boolean(lastBackup),
          lastBackup: lastBackup || "Not recorded",
          backupRetentionDays,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Unable to check database health:", error);
    return res
      .status(503)
      .json({
        success: false,
        data: { status: "Offline", backupReady: false },
        message: "Database health check failed.",
      });
  }
};

module.exports = {
  getAdminDashboardStats,
  getBroadcastHistory,
  sendBroadcast,
  deleteBroadcast,
  startBroadcastScheduler,
  getDepartmentAnalytics,
  getSecurityLogs,
  getAuditLogs,
  setSystemMaintenanceMode,
  getEvaluationWindow,
  getEvaluationCycles,
  startEvaluationCycle,
  resetEvaluationCycle,
  setEvaluationWindow,
  getSecurityScore,
  getApiToken,
  rotateApiToken,
  getMfaToggle,
  setMfaToggle,
  getDatabaseHealth,
  createCollege,
  updateCollege,
  deleteCollege,
  getColleges,
  getManagementRoleOccupant,
  assignRoleWithHierarchy,
  resetManagementRole,
  resetUserPassword,
  resetUserPasswordDirectly,
  getRoleCandidates,
};
