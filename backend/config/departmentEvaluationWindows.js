const pool = require("./db");

let departmentEvaluationWindowSchemaPromise;

const ensureDepartmentEvaluationWindowSchema = async () => {
  if (!departmentEvaluationWindowSchemaPromise) {
    departmentEvaluationWindowSchemaPromise = (async () => {
      await pool.query(`
    CREATE TABLE IF NOT EXISTS department_evaluation_windows (
      department_id INT UNSIGNED NOT NULL PRIMARY KEY,
      id INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
      start_at VARCHAR(40) DEFAULT NULL,
      end_at VARCHAR(40) DEFAULT NULL,
      start_date DATETIME DEFAULT NULL,
      expiry_date DATETIME DEFAULT NULL,
      academic_year VARCHAR(20) DEFAULT NULL,
      semester VARCHAR(20) DEFAULT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by INT UNSIGNED DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_department_evaluation_windows_expiry (end_at),
      INDEX idx_department_evaluation_windows_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

      const [columns] = await pool.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'department_evaluation_windows'`,
      );
      const existingColumns = new Set(columns.map((column) => column.COLUMN_NAME));
      const columnMigrations = [
        ["id", "INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE"],
        ["start_at", "VARCHAR(40) DEFAULT NULL"],
        ["end_at", "VARCHAR(40) DEFAULT NULL"],
        ["start_date", "DATETIME DEFAULT NULL"],
        ["expiry_date", "DATETIME DEFAULT NULL"],
        ["academic_year", "VARCHAR(20) DEFAULT NULL"],
        ["semester", "VARCHAR(20) DEFAULT NULL"],
        ["is_active", "BOOLEAN NOT NULL DEFAULT TRUE"],
      ];

      for (const [columnName, definition] of columnMigrations) {
        if (existingColumns.has(columnName)) continue;
        await pool.query(
          `ALTER TABLE department_evaluation_windows
           ADD COLUMN ${columnName} ${definition}`,
        );
      }

      const normalizeTextColumn = async (columnName) => {
        const [[column]] = await pool.query(
          `SELECT DATA_TYPE
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'department_evaluation_windows'
             AND COLUMN_NAME = ?
           LIMIT 1`,
          [columnName],
        );
        const dataType = String(column?.DATA_TYPE || '').toLowerCase();
        if (['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext'].includes(dataType)) return;

        const normalizedColumn = `${columnName}_text`;
        const [[normalized]] = await pool.query(
          `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'department_evaluation_windows'
             AND COLUMN_NAME = ?
           LIMIT 1`,
          [normalizedColumn],
        );
        if (!normalized) {
          await pool.query(
            `ALTER TABLE department_evaluation_windows
             ADD COLUMN ${normalizedColumn} VARCHAR(40) DEFAULT NULL`,
          );
        }
        const valueExpression = ['date', 'datetime', 'timestamp'].includes(dataType)
          ? `DATE_FORMAT(${columnName}, '%Y-%m-%dT%H:%i:%s.000Z')`
          : `CAST(${columnName} AS CHAR)`;
        await pool.query(
          `UPDATE department_evaluation_windows
           SET ${normalizedColumn} = ${valueExpression}
           WHERE ${columnName} IS NOT NULL`,
        );
        await pool.query(
          `ALTER TABLE department_evaluation_windows
           DROP COLUMN ${columnName},
           CHANGE COLUMN ${normalizedColumn} ${columnName} VARCHAR(40) DEFAULT NULL`,
        );
      };

      await normalizeTextColumn('start_at');
      await normalizeTextColumn('end_at');

      const normalizeDateColumn = async (columnName, sourceColumn) => {
        const [[column]] = await pool.query(
          `SELECT DATA_TYPE
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'department_evaluation_windows'
             AND COLUMN_NAME = ?
           LIMIT 1`,
          [columnName],
        );
        if (String(column?.DATA_TYPE || '').toLowerCase() === 'datetime') return;

        const normalizedColumn = `${columnName}_normalized`;
        const [[normalized]] = await pool.query(
          `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'department_evaluation_windows'
             AND COLUMN_NAME = ?
           LIMIT 1`,
          [normalizedColumn],
        );
        if (!normalized) {
          await pool.query(
            `ALTER TABLE department_evaluation_windows
             ADD COLUMN ${normalizedColumn} DATETIME DEFAULT NULL`,
          );
        }
        await pool.query(
          `UPDATE department_evaluation_windows
           SET ${normalizedColumn} = CAST(
             NULLIF(REPLACE(REPLACE(${sourceColumn}, 'T', ' '), 'Z', ''), '')
             AS DATETIME
           )
           WHERE ${sourceColumn} IS NOT NULL
             AND ${sourceColumn} <> ''`,
        );
        await pool.query(
          `ALTER TABLE department_evaluation_windows
           DROP COLUMN ${columnName},
           CHANGE COLUMN ${normalizedColumn} ${columnName} DATETIME DEFAULT NULL`,
        );
      };

      await normalizeDateColumn('start_date', 'start_at');
      await normalizeDateColumn('expiry_date', 'end_at');

      const [indexes] = await pool.query(
        `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'department_evaluation_windows'`,
      );
      const existingIndexes = new Set(indexes.map((index) => index.INDEX_NAME));
      if (!existingIndexes.has("idx_department_evaluation_windows_expiry")) {
        await pool.query(
          `CREATE INDEX idx_department_evaluation_windows_expiry
           ON department_evaluation_windows (end_at)`,
        );
      }
      if (!existingIndexes.has("idx_department_evaluation_windows_active")) {
        await pool.query(
          `CREATE INDEX idx_department_evaluation_windows_active
           ON department_evaluation_windows (is_active)`,
        );
      }
      const hasUniqueDepartmentIndex = indexes.some(
        (index) =>
          Number(index.NON_UNIQUE) === 0 &&
          Number(index.SEQ_IN_INDEX) === 1 &&
          index.COLUMN_NAME === "department_id",
      );
      if (!hasUniqueDepartmentIndex) {
        const [[duplicateDepartment]] = await pool.query(
          `SELECT department_id
           FROM department_evaluation_windows
           GROUP BY department_id
           HAVING COUNT(*) > 1
           LIMIT 1`,
        );
        if (duplicateDepartment) {
          throw new Error(
            `Cannot enforce one evaluation schedule per department: duplicate rows exist for department ${duplicateDepartment.department_id}.`,
          );
        }
        await pool.query(
          `CREATE UNIQUE INDEX uk_department_evaluation_windows_department
           ON department_evaluation_windows (department_id)`,
        );
      }

    })().catch((error) => {
      departmentEvaluationWindowSchemaPromise = null;
      throw error;
    });
  }

  await departmentEvaluationWindowSchemaPromise;
};

const getDepartmentEvaluationWindow = async (departmentId) => {
  await ensureDepartmentEvaluationWindowSchema();
  const [rows] = await pool.query(
    `SELECT start_at AS startAt,
            end_at AS endAt,
            end_at AS deadline,
            end_at AS expiryDate,
            DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%s.000Z') AS startDate,
            academic_year AS academicYear,
            semester,
            is_active AS isActive
     FROM department_evaluation_windows
     WHERE department_id = ?
       AND is_active = TRUE
     LIMIT 1`,
    [departmentId],
  );
  if (!rows.length) return null;
  return {
    startAt: rows[0].startAt || "",
    endAt: rows[0].endAt || "",
    deadline: rows[0].deadline || null,
    expiryDate: rows[0].expiryDate || null,
    startDate: rows[0].startDate || null,
    academicYear: rows[0].academicYear || "",
    semester: rows[0].semester || "",
    isActive: Boolean(rows[0].isActive),
  };
};

const getDepartmentEvaluationDeadline = async (
  departmentId,
  cycleDeadline = null,
) => {
  if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) {
    const departmentWindow = await getDepartmentEvaluationWindow(
      Number(departmentId),
    );
    const departmentDeadline = String(
      departmentWindow?.deadline ||
        departmentWindow?.expiryDate ||
        departmentWindow?.endAt ||
        "",
    ).trim();
    if (departmentDeadline) return departmentDeadline;
  }

  const activeCycleDeadline = String(cycleDeadline || "").trim();
  if (activeCycleDeadline) return activeCycleDeadline;

  const [rows] = await pool.query(
    `SELECT setting_value
     FROM system_settings
     WHERE setting_key = 'evaluation_window'
     LIMIT 1`,
  );
  const savedWindow = String(rows[0]?.setting_value || "").trim();
  if (!savedWindow) return null;

  let parsedWindow;
  try {
    parsedWindow = JSON.parse(savedWindow);
  } catch (error) {
    throw new Error("Stored evaluation window is invalid JSON.", {
      cause: error,
    });
  }

  const configuredDeadline = String(parsedWindow?.endAt || "").trim();
  return configuredDeadline || null;
};

const isEvaluationDeadlineExpired = (deadline) => {
  if (!deadline) return false;
  const expiryTime = new Date(deadline).getTime();
  return Number.isFinite(expiryTime) && Date.now() > expiryTime;
};

const setDepartmentEvaluationWindow = async (
  departmentId,
  startAt,
  endAt,
  updatedBy,
  academicYear = null,
) => {
  await ensureDepartmentEvaluationWindowSchema();
  await pool.query(
    `INSERT INTO department_evaluation_windows
      (department_id, start_at, end_at, start_date, expiry_date, is_active, updated_by, academic_year)
     VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)
     ON DUPLICATE KEY UPDATE
       start_at = VALUES(start_at),
       end_at = VALUES(end_at),
       start_date = VALUES(start_date),
       expiry_date = VALUES(expiry_date),
       is_active = TRUE,
       updated_by = VALUES(updated_by),
       academic_year = COALESCE(VALUES(academic_year), academic_year)`,
    [
      departmentId,
      startAt,
      endAt,
      new Date(startAt).toISOString().slice(0, 19).replace("T", " "),
      new Date(endAt).toISOString().slice(0, 19).replace("T", " "),
      updatedBy || null,
      academicYear || null,
    ],
  );
  return {
    startAt,
    endAt,
    startDate: new Date(startAt),
    expiryDate: new Date(endAt),
    isActive: true,
    academicYear: academicYear || null,
  };
};

const deleteDepartmentEvaluationWindow = async (departmentId) => {
  await ensureDepartmentEvaluationWindowSchema();
  await pool.query(
    `DELETE FROM department_evaluation_windows
     WHERE department_id = ?`,
    [departmentId],
  );
};

const seedLocalDepartmentEvaluationWindowsIfMissing = async () => {
  const databaseHost = String(process.env.DB_HOST || "127.0.0.1")
    .trim()
    .toLowerCase();
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);
  if (!isLocalhost) return false;

  await ensureDepartmentEvaluationWindowSchema();
  const [departments] = await pool.query(
    `SELECT d.id
     FROM departments d
     LEFT JOIN department_evaluation_windows w ON w.department_id = d.id
     WHERE w.department_id IS NULL
     ORDER BY d.id ASC`,
  );
  if (!departments.length) {
    const [[departmentCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM departments",
    );
    if (Number(departmentCount?.total || 0) === 0) {
      console.warn(
        "Local evaluation schedule seed skipped: no department exists yet.",
      );
    }
    return false;
  }

  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  for (const department of departments) {
    await setDepartmentEvaluationWindow(
      Number(department.id),
      startAt.toISOString(),
      endAt.toISOString(),
      null,
    );
  }
  console.info(
    `Seeded local evaluation windows for ${departments.length} department${departments.length === 1 ? "" : "s"}.`,
  );
  return true;
};

module.exports = {
  ensureDepartmentEvaluationWindowSchema,
  getDepartmentEvaluationWindow,
  getDepartmentEvaluationDeadline,
  isEvaluationDeadlineExpired,
  setDepartmentEvaluationWindow,
  deleteDepartmentEvaluationWindow,
  seedLocalDepartmentEvaluationWindowsIfMissing,
};
