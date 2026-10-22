const pool = require("../config/db");

let initialization;

const ensureUserProfileSettings = async () => {
  if (!initialization) {
    initialization = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS user_profile_settings (
        user_id INT UNSIGNED PRIMARY KEY,
        full_name VARCHAR(255) DEFAULT NULL,
        email VARCHAR(254) DEFAULT NULL,
        phone_number VARCHAR(64) DEFAULT NULL,
        profile_picture VARCHAR(255) DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_profile_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_profile_settings_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

      const [fullNameColumns] = await pool.query(
        "SHOW COLUMNS FROM user_profile_settings LIKE 'full_name'",
      );
      if (!fullNameColumns.length) {
        await pool.query(
          "ALTER TABLE user_profile_settings ADD COLUMN full_name VARCHAR(255) DEFAULT NULL AFTER user_id",
        );
      }

      const [columns] = await pool.query(
        "SHOW COLUMNS FROM user_profile_settings LIKE 'email'",
      );
      if (!columns.length) {
        await pool.query(
          "ALTER TABLE user_profile_settings ADD COLUMN email VARCHAR(254) DEFAULT NULL AFTER full_name",
        );
      }

      const profilePictureDataColumns = [
        ["profile_picture_data", "MEDIUMBLOB DEFAULT NULL AFTER profile_picture"],
        ["profile_picture_mime_type", "VARCHAR(100) DEFAULT NULL AFTER profile_picture_data"],
      ];
      for (const [column, definition] of profilePictureDataColumns) {
        const [existingColumns] = await pool.query(
          `SHOW COLUMNS FROM user_profile_settings LIKE '${column}'`,
        );
        if (!existingColumns.length) {
          await pool.query(
            `ALTER TABLE user_profile_settings ADD COLUMN ${column} ${definition}`,
          );
        }
      }

      const [indexes] = await pool.query(
        "SHOW INDEX FROM user_profile_settings WHERE Key_name = 'uq_user_profile_settings_email'",
      );
      if (!indexes.length) {
        await pool.query(
          "CREATE UNIQUE INDEX uq_user_profile_settings_email ON user_profile_settings (email)",
        );
      }
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
};

module.exports = { ensureUserProfileSettings };