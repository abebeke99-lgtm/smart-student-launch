const pool = require("./db");

const ensureVicePresidentEvaluationSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vice_president_evaluations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      evaluator_id INT UNSIGNED NOT NULL,
      academic_directorate_user_id INT UNSIGNED NOT NULL,
      cycle_id INT UNSIGNED NOT NULL,
      ratings JSON NOT NULL,
      strengths TEXT NULL,
      weaknesses TEXT NULL,
      total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_vice_president_evaluation_cycle (evaluator_id, academic_directorate_user_id, cycle_id),
      CONSTRAINT fk_vice_president_evaluation_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_vice_president_evaluation_target FOREIGN KEY (academic_directorate_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  for (const [column, definition] of [
    ["student_average", "DECIMAL(5,2) NOT NULL DEFAULT 0.00"],
    ["peer_average", "DECIMAL(5,2) NOT NULL DEFAULT 0.00"],
    ["is_teaching", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["final_score", "DECIMAL(5,2) DEFAULT NULL"],
  ]) {
    const [rows] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vice_president_evaluations' AND COLUMN_NAME = ? LIMIT 1",
      [column],
    );
    if (!rows.length) {
      await pool.query(
        `ALTER TABLE vice_president_evaluations ADD COLUMN \`${column}\` ${definition}`,
      );
    }
  }

  const [columns] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'evaluation_results' AND COLUMN_NAME = 'vice_president_score' LIMIT 1",
  );
  if (!columns.length) {
    await pool.query(
      "ALTER TABLE evaluation_results ADD COLUMN vice_president_score DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER dept_head_score",
    );
  }
};

module.exports = { ensureVicePresidentEvaluationSchema };
