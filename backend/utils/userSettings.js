const pool = require("../config/db");

let preferencesInitialization;
let sessionsInitialization;

const ensureUserNotificationPreferences = async () => {
  if (!preferencesInitialization) {
    preferencesInitialization = pool
      .query(`CREATE TABLE IF NOT EXISTS user_notification_preferences (
        user_id INT UNSIGNED PRIMARY KEY,
        evaluation_deadlines TINYINT(1) NOT NULL DEFAULT 1,
        system_announcements TINYINT(1) NOT NULL DEFAULT 1,
        security_alerts TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      .catch((error) => {
        preferencesInitialization = null;
        throw error;
      });
  }
  return preferencesInitialization;
};

const ensureUserSessions = async () => {
  if (!sessionsInitialization) {
    sessionsInitialization = pool
      .query(`CREATE TABLE IF NOT EXISTS user_sessions (
        id CHAR(36) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        ip_address VARCHAR(45) NULL,
        device_id VARCHAR(128) NULL,
        user_agent VARCHAR(512) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_sessions_user_active (user_id, revoked_at, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      .catch((error) => {
        sessionsInitialization = null;
        throw error;
      });
  }
  return sessionsInitialization;
};

const createUserSession = async ({
  id,
  userId,
  ipAddress,
  deviceId,
  userAgent,
  expiresAt,
}) => {
  await ensureUserSessions();
  const limitedValue = (value, maxLength) =>
    typeof value === "string" ? value.slice(0, maxLength) : null;
  await pool.query(
    `INSERT INTO user_sessions
      (id, user_id, ip_address, device_id, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      limitedValue(ipAddress, 45),
      limitedValue(deviceId, 128),
      limitedValue(userAgent, 512),
      expiresAt,
    ],
  );
};

module.exports = {
  ensureUserNotificationPreferences,
  ensureUserSessions,
  createUserSession,
};
