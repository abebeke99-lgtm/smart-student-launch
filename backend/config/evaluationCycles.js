const pool = require("./db");

const ensureColumn = async (table, column, definition) => {
  const [rows] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [table, column],
  );
  if (!rows.length) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
};

const ensureCycleIndex = async (table, oldIndexName, newIndexName, columns) => {
  const [newIndexes] = await pool.query(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
    [table, newIndexName],
  );
  if (!newIndexes.length) {
    await pool.query(
      `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${newIndexName}\` (${columns.map((column) => `\`${column}\``).join(", ")})`,
    );
  }

  const [oldIndexes] = await pool.query(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
    [table, oldIndexName],
  );
  if (oldIndexes.length) {
    await pool.query(`ALTER TABLE \`${table}\` DROP INDEX \`${oldIndexName}\``);
  }
};

const deduplicateEvaluationResults = async () => {
  await pool.query(`
    DELETE older
    FROM evaluation_results older
    INNER JOIN evaluation_results newer
      ON newer.instructor_id = older.instructor_id
     AND newer.cycle_id = older.cycle_id
     AND (
       newer.published_at > older.published_at
       OR (newer.published_at = older.published_at AND newer.id > older.id)
     )
  `);
};

const ensureEvaluationCycleSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS evaluation_cycles (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      academic_year VARCHAR(64) NOT NULL,
      semester VARCHAR(64) NOT NULL,
      start_at VARCHAR(40) NOT NULL,
      end_at VARCHAR(40) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'archived',
      created_by INT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_evaluation_cycle_period (academic_year, semester),
      INDEX idx_evaluation_cycles_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureColumn(
    "evaluation_cycles",
    "start_at",
    "VARCHAR(40) NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    "evaluation_cycles",
    "end_at",
    "VARCHAR(40) NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    "evaluation_cycles",
    "created_by",
    "INT UNSIGNED DEFAULT NULL",
  );
  await ensureColumn(
    "evaluation_cycles",
    "created_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  );
  await pool.query(
    "ALTER TABLE evaluation_cycles MODIFY COLUMN status VARCHAR(16) NOT NULL DEFAULT 'archived'",
  );

  for (const table of [
    "course_assignments",
    "evaluation_dispatches",
    "evaluations",
    "peer_evaluations",
    "dept_head_evaluations",
    "directorate_evaluations",
    "evaluation_results",
  ]) {
    await ensureColumn(table, "cycle_id", "INT UNSIGNED DEFAULT NULL");
  }

  const [periods] = await pool.query(`
    SELECT DISTINCT
      COALESCE(NULLIF(TRIM(academic_year), ''), 'Legacy') AS academic_year,
      COALESCE(NULLIF(TRIM(semester), ''), 'Legacy') AS semester
    FROM course_assignments
  `);

  const savedWindow = await pool.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'evaluation_window' LIMIT 1",
  ).then(([rows]) => rows[0]?.setting_value);
  let legacyWindow = { startAt: "", endAt: "" };
  if (savedWindow) {
    try {
      legacyWindow = { ...legacyWindow, ...JSON.parse(savedWindow) };
    } catch (error) {
      console.error("Unable to parse legacy evaluation window during cycle migration:", error);
    }
  }

  for (const period of periods) {
    const [existingRows] = await pool.query(
      "SELECT id FROM evaluation_cycles WHERE academic_year = ? AND semester = ? LIMIT 1",
      [period.academic_year, period.semester],
    );
    if (existingRows.length) continue;

    await pool.query(
      `INSERT INTO evaluation_cycles (academic_year, semester, start_at, end_at, status)
       VALUES (?, ?, ?, ?, 'archived')`,
      [period.academic_year, period.semester, "", ""],
    );
  }

  const [legacyRows] = await pool.query(
    "SELECT id FROM evaluation_cycles WHERE academic_year = 'Legacy' AND semester = 'Legacy' LIMIT 1",
  );
  if (!legacyRows.length) {
    await pool.query(
      `INSERT INTO evaluation_cycles (academic_year, semester, start_at, end_at, status)
       VALUES ('Legacy', 'Legacy', ?, ?, 'archived')`,
      [legacyWindow.startAt || "", legacyWindow.endAt || ""],
    );
  }

  const [[activeSetting]] = await pool.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'active_evaluation_cycle_id' LIMIT 1",
  );
  let activeCycleId = Number(activeSetting?.setting_value) || 0;
  if (!activeCycleId) {
    const [[latestCycle]] = await pool.query(
      "SELECT id FROM evaluation_cycles WHERE academic_year <> 'Legacy' ORDER BY id DESC LIMIT 1",
    );
    const [[legacyCycle]] = await pool.query(
      "SELECT id FROM evaluation_cycles WHERE academic_year = 'Legacy' AND semester = 'Legacy' LIMIT 1",
    );
    activeCycleId = Number(latestCycle?.id || legacyCycle?.id || 0);
    if (activeCycleId) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES ('active_evaluation_cycle_id', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [String(activeCycleId)],
      );
    }
  }

  const [[activeCycle]] = await pool.query(
    "SELECT id FROM evaluation_cycles WHERE id = ? LIMIT 1",
    [activeCycleId],
  );
  if (activeCycle) {
    const [[legacyCycle]] = await pool.query(
      "SELECT id FROM evaluation_cycles WHERE academic_year = 'Legacy' AND semester = 'Legacy' LIMIT 1",
    );
    await pool.query(
      `UPDATE course_assignments ca
       INNER JOIN evaluation_cycles ec
         ON ec.academic_year = COALESCE(NULLIF(TRIM(ca.academic_year), ''), 'Legacy')
        AND ec.semester = COALESCE(NULLIF(TRIM(ca.semester), ''), 'Legacy')
       SET ca.cycle_id = ec.id
       WHERE ca.cycle_id IS NULL`,
    );
    await pool.query(
      `UPDATE evaluation_dispatches ed
       INNER JOIN course_assignments ca ON ca.id = ed.assignment_id
       SET ed.cycle_id = ca.cycle_id
       WHERE ed.cycle_id IS NULL`,
    );
    await pool.query(
      `UPDATE evaluations ev
       INNER JOIN course_assignments ca ON ca.id = ev.assignment_id
       SET ev.cycle_id = ca.cycle_id
       WHERE ev.cycle_id IS NULL`,
    );
    await pool.query(
      "UPDATE evaluation_dispatches SET cycle_id = ? WHERE cycle_id IS NULL",
      [legacyCycle.id],
    );
    await pool.query(
      "UPDATE evaluations SET cycle_id = ? WHERE cycle_id IS NULL",
      [legacyCycle.id],
    );
    for (const table of [
      "peer_evaluations",
      "dept_head_evaluations",
      "directorate_evaluations",
      "evaluation_results",
    ]) {
      await pool.query(
        `UPDATE \`${table}\` SET cycle_id = ? WHERE cycle_id IS NULL`,
        [legacyCycle.id],
      );
    }

    await pool.query(
      "UPDATE evaluation_cycles SET status = IF(id = ?, 'active', 'archived')",
      [activeCycle.id],
    );
    await pool.query(
      "UPDATE evaluation_cycles SET start_at = ?, end_at = ? WHERE id = ? AND start_at = '' AND end_at = ''",
      [legacyWindow.startAt || "", legacyWindow.endAt || "", activeCycle.id],
    );
  }

  await ensureCycleIndex(
    "peer_evaluations",
    "uk_peer_eval",
    "uk_peer_eval_cycle",
    ["evaluator_id", "evaluatee_id", "course_id", "cycle_id"],
  );
  await ensureCycleIndex(
    "dept_head_evaluations",
    "uk_dept_head_eval_unique",
    "uk_dept_head_eval_cycle",
    ["evaluator_id", "instructor_id", "cycle_id"],
  );
  await ensureCycleIndex(
    "directorate_evaluations",
    "uk_directorate_eval",
    "uk_directorate_eval_cycle",
    ["evaluator_id", "dean_id", "cycle_id"],
  );
  await deduplicateEvaluationResults();
  await ensureCycleIndex(
    "evaluation_results",
    "uk_evaluation_results_instructor",
    "uk_evaluation_results_instructor_cycle",
    ["instructor_id", "cycle_id"],
  );
};

const getActiveEvaluationCycle = async (connection = pool) => {
  const [[activeSetting]] = await connection.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'active_evaluation_cycle_id' LIMIT 1",
  );
  if (activeSetting?.setting_value) {
    const [[cycle]] = await connection.query(
      "SELECT * FROM evaluation_cycles WHERE id = ? LIMIT 1",
      [activeSetting.setting_value],
    );
    if (cycle) return cycle;
  }

  const [[cycle]] = await connection.query(
    "SELECT * FROM evaluation_cycles WHERE status = 'active' ORDER BY id DESC LIMIT 1",
  );
  if (cycle) return cycle;

  // Recover installations where the active-cycle setting or status was lost.
  // A current non-legacy cycle is safer than making every cycle-dependent
  // dashboard endpoint fail with HTTP 409.
  const [[fallbackCycle]] = await connection.query(
    "SELECT * FROM evaluation_cycles WHERE academic_year <> 'Legacy' ORDER BY id DESC LIMIT 1",
  );
  if (!fallbackCycle) return null;

  await connection.query(
    "UPDATE evaluation_cycles SET status = IF(id = ?, 'active', 'archived')",
    [fallbackCycle.id],
  );
  await connection.query(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES ('active_evaluation_cycle_id', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [String(fallbackCycle.id)],
  );

  return { ...fallbackCycle, status: "active" };
};

module.exports = {
  ensureEvaluationCycleSchema,
  getActiveEvaluationCycle,
};
