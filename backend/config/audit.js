const pool = require("./db");
const os = require("os");

let systemActiveCache = null;

const ensureAuditTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NULL,
      action VARCHAR(255) NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      device_id VARCHAR(128) NULL,
      network_interface_name VARCHAR(255) NULL,
      network_interface_mac VARCHAR(32) NULL,
      description TEXT NULL,
      performed_by VARCHAR(255) NULL,
      action_title VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_logs_created_at (created_at),
      INDEX idx_audit_logs_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const columns = [
    ["user_id", "INT UNSIGNED NULL AFTER `id`"],
    ["action", "VARCHAR(255) NULL AFTER `user_id`"],
    ["ip_address", "VARCHAR(45) NULL AFTER `action`"],
    ["user_agent", "TEXT NULL AFTER `ip_address`"],
    ["device_id", "VARCHAR(128) NULL AFTER `user_agent`"],
    [
      "network_interface_name",
      "VARCHAR(255) NULL AFTER `device_id`",
    ],
    [
      "network_interface_mac",
      "VARCHAR(32) NULL AFTER `network_interface_name`",
    ],
    ["description", "TEXT NULL AFTER `network_interface_mac`"],
    ["performed_by", "VARCHAR(255) NULL AFTER `description`"],
    ["action_title", "VARCHAR(255) NULL AFTER `performed_by`"],
  ];

  for (const [column, definition] of columns) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = ?`,
      [column],
    );
    if (Number(rows[0].count) === 0) {
      await pool.query(
        `ALTER TABLE audit_logs ADD COLUMN \`${column}\` ${definition}`,
      );
    }
  }
};

const ensureSystemSettingsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(128) PRIMARY KEY,
      setting_value TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(
    `INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
      ('system_active', 'true'),
      ('admin_contact_name', 'Mekdela Amba University Admin'),
      ('admin_contact_email', 'enyihefikiradis@gmail.com'),
      ('admin_contact_phone', '+251 332405111'),
      ('admin_contact_location', 'Gimba, Ethiopia'),
      ('admin_contact_po_box', 'P.O. Box 32'),
      ('admin_contact_office_days', 'Mon-Fri'),
      ('admin_contact_office_hours', '9:00 AM - 5:00 PM'),
      ('admin_contact_institution', 'Mekdela Amba University (Main Campus - Tulu Awulia / Gimba)'),
      ('admin_contact_region', 'Amhara Region, South Wollo, Ethiopia'),
      ('admin_contact_landmark', 'Near Gimba Masjid Al-Noor'),
      ('admin_contact_map_query', 'Mekdela Amba University Gimba Ethiopia')`,
  );
};

const normalizeIpAddress = (value) => String(value || "").trim().replace(/^::ffff:/i, "");

const isLoopbackAddress = (value) => {
  const address = normalizeIpAddress(value).toLowerCase();
  return address === "::1" || address === "0:0:0:0:0:0:0:1" || /^127(?:\.\d{1,3}){3}$/.test(address);
};

const getLocalNetworkInterface = () => {
  const virtualInterfaceName = /virtual|docker|vmware|virtualbox|vbox|loopback|tunnel|wsl/i;
  const preferredInterfaceName = /^(wi-?fi|ethernet|wlan|en\d|enp|eth\d)/i;
  const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses || [])
      .filter((entry) => {
        const family = entry.family === "IPv4" || entry.family === 4;
        return family && !entry.internal && !String(entry.address).startsWith("169.254.");
      })
      .map((entry) => ({
        name,
        address: entry.address,
        mac: entry.mac && !/^00(?::00){5}$/i.test(entry.mac) ? entry.mac : null,
      })),
  );

  candidates.sort((left, right) => {
    const score = (candidate) =>
      (virtualInterfaceName.test(candidate.name) ? 20 : 0)
      + (preferredInterfaceName.test(candidate.name) ? 0 : 5)
      + (candidate.mac ? 0 : 1);
    return score(left) - score(right);
  });

  return candidates[0] || null;
};

const getClientNetworkDetails = (req) => {
  const forwardedFor = req?.headers?.["x-forwarded-for"];
  const forwardedAddress = typeof forwardedFor === "string"
    ? forwardedFor.split(",")[0]
    : Array.isArray(forwardedFor) ? forwardedFor[0] : "";
  const requestAddress = normalizeIpAddress(
    forwardedAddress || req?.ip || req?.socket?.remoteAddress || "unknown",
  );

  if (!isLoopbackAddress(requestAddress)) {
    return {
      ipAddress: requestAddress,
      networkInterfaceName: null,
      networkInterfaceMac: null,
    };
  }

  const networkInterface = getLocalNetworkInterface();
  return {
    ipAddress: networkInterface?.address || requestAddress,
    networkInterfaceName: networkInterface?.name || null,
    networkInterfaceMac: networkInterface?.mac || null,
  };
};

const getClientIp = (req) => getClientNetworkDetails(req).ipAddress;

const setSystemSetting = async (key, value) => {
  await ensureSystemSettingsTable();
  const normalizedValue = String(value ?? "");
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [key, normalizedValue],
  );
  if (key === "system_active") systemActiveCache = normalizedValue;
  return normalizedValue;
};

const getSystemSetting = async (key, fallback = null) => {
  await ensureSystemSettingsTable();
  const [rows] = await pool.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1",
    [key],
  );
  return rows[0]?.setting_value ?? fallback;
};

const isSystemActive = async () => {
  const envValue = process.env.SYSTEM_ACTIVE;
  const fallback = envValue === undefined ? "true" : envValue;
  const value = await getSystemSetting("system_active", fallback);
  systemActiveCache = value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false") return false;
    return normalized !== "0" && normalized !== "off";
  }
  return Boolean(value);
};

const getSystemActiveCache = () => systemActiveCache;

const logAuditEvent = async ({
  userId = null,
  action = "SYSTEM_EVENT",
  req = null,
  description = "",
  performedBy = null,
}) => {
  try {
    await ensureAuditTable();

    const resolvedUserId = userId ?? performedBy ?? null;
    const networkDetails = getClientNetworkDetails(req);
    const userAgent =
      req?.get?.("User-Agent") || req?.headers?.["user-agent"] || "";
    const deviceId = String(req?.headers?.["x-device-id"] || "").trim().slice(0, 128) || null;
    const safeDescription = description || `${action} event`;

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, device_id, network_interface_name, network_interface_mac, description, performed_by, action_title)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resolvedUserId,
        action,
        networkDetails.ipAddress,
        userAgent,
        deviceId,
        networkDetails.networkInterfaceName,
        networkDetails.networkInterfaceMac,
        safeDescription,
        performedBy || (resolvedUserId ? `user:${resolvedUserId}` : "system"),
        action,
      ],
    );
  } catch (error) {
    console.error("Audit logging failed:", error);
  }
};

module.exports = {
  ensureAuditTable,
  ensureSystemSettingsTable,
  getClientIp,
  getClientNetworkDetails,
  setSystemSetting,
  getSystemSetting,
  isSystemActive,
  getSystemActiveCache,
  logAuditEvent,
};
