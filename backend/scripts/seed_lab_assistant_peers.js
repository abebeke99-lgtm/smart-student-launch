const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const roleAliases = ["lab assistant", "lab_assistant", "labassistant", "ara"];
const identifier = String(process.env.LAB_ASSISTANT_USER || "").trim();
const seedPassword = String(process.env.LAB_ASSISTANT_SEED_PASSWORD || "");
const requestedDepartmentId = Number(
  process.env.LAB_ASSISTANT_DEPARTMENT_ID || 0,
);
const applyChanges = process.argv.includes("--apply");
const requiredPeerCount = 3;

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

async function seedLabAssistantPeers() {
  if (!identifier) {
    throw new Error(
      "Set LAB_ASSISTANT_USER to the target account username or profile full name.",
    );
  }
  if (applyChanges && seedPassword.length < 8) {
    throw new Error(
      "Set LAB_ASSISTANT_SEED_PASSWORD to a password of at least 8 characters before using --apply.",
    );
  }
  const databaseHost = String(process.env.DB_HOST || "127.0.0.1").trim();
  if (
    applyChanges &&
    !["localhost", "127.0.0.1", "::1"].includes(databaseHost.toLowerCase()) &&
    process.env.ALLOW_NON_LOCAL_SEED !== "true"
  ) {
    throw new Error(
      "Refusing to modify a non-local database. Set ALLOW_NON_LOCAL_SEED=true only if this remote seed is intentional.",
    );
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    const [userRows] = await connection.query(
      `SELECT u.id, u.username, u.role, u.status, u.department_id, u.college_id,
              i.id AS instructor_id, i.department_id AS instructor_department_id,
              user_department.college_id AS user_department_college_id,
              instructor_department.college_id AS instructor_department_college_id
       FROM users u
       LEFT JOIN instructors i ON i.user_id = u.id
       LEFT JOIN departments user_department ON user_department.id = u.department_id
       LEFT JOIN departments instructor_department ON instructor_department.id = i.department_id
       LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
       WHERE LOWER(TRIM(u.username)) = LOWER(TRIM(?))
          OR LOWER(TRIM(COALESCE(ups.full_name, ''))) = LOWER(TRIM(?))`,
      [identifier, identifier],
    );
    if (userRows.length !== 1) {
      throw new Error(
        userRows.length
          ? "The target identifier matched multiple accounts. Use the exact username in LAB_ASSISTANT_USER."
          : "No account matched LAB_ASSISTANT_USER.",
      );
    }

    const evaluator = userRows[0];
    if (!roleAliases.includes(String(evaluator.role || "").trim().toLowerCase())) {
      throw new Error(
        `The target account role '${evaluator.role}' is not Lab Assistant/ARA.`,
      );
    }

    const departmentId = requestedDepartmentId ||
      Number(evaluator.department_id || evaluator.instructor_department_id || 0);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      throw new Error(
        "The target account has no valid department. Set LAB_ASSISTANT_DEPARTMENT_ID to the intended department.",
      );
    }
    const [[department]] = await connection.query(
      "SELECT id, college_id FROM departments WHERE id = ? LIMIT 1",
      [departmentId],
    );
    if (!department) {
      throw new Error(`Department ${departmentId} does not exist.`);
    }

    const collegeId = Number(
      evaluator.college_id ||
        evaluator.user_department_college_id ||
        evaluator.instructor_department_college_id ||
        department.college_id ||
        0,
    );
    if (!Number.isInteger(collegeId) || collegeId <= 0) {
      throw new Error("Could not resolve a valid college for the target account.");
    }
    if (Number(department.college_id) !== collegeId) {
      throw new Error(
        `Department ${departmentId} belongs to college ${department.college_id}, not the target account's college ${collegeId}.`,
      );
    }

    console.log("Lab Assistant peer seed preview:", {
      targetUsername: evaluator.username,
      activeCollegeId: collegeId,
      departmentId,
      applyChanges,
    });

    if (!applyChanges) {
      const [[peerCount]] = await connection.query(
        `SELECT COUNT(DISTINCT u.id) AS total
         FROM users u
         INNER JOIN instructors i ON i.user_id = u.id
         LEFT JOIN departments d ON d.id = COALESCE(u.department_id, i.department_id)
         WHERE u.id <> ?
           AND LOWER(COALESCE(u.status, 'active')) = 'active'
           AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_'))
             IN ('lab_assistant', 'ara', 'labassistant')
           AND (u.college_id = ? OR d.college_id = ?)`,
        [evaluator.id, collegeId, collegeId],
      );
      const peersToCreate = Math.max(
        0,
        requiredPeerCount - Number(peerCount.total || 0),
      );
      console.log("Existing active college peers:", Number(peerCount.total || 0));
      console.log("Peers to create with --apply:", peersToCreate);
      return;
    }

    const passwordHash = await bcrypt.hash(seedPassword, 12);
    await connection.beginTransaction();
    transactionStarted = true;
    await connection.query(
      `UPDATE users
       SET department_id = ?, college_id = ?, role = 'lab_assistant',
           status = 'active'
       WHERE id = ?`,
      [departmentId, collegeId, evaluator.id],
    );

    if (evaluator.instructor_id) {
      await connection.query(
        "UPDATE instructors SET department_id = ? WHERE id = ?",
        [departmentId, evaluator.instructor_id],
      );
    } else {
      await connection.query(
        `INSERT INTO instructors (user_id, first_name, last_name, department_id)
         VALUES (?, ?, ?, ?)`,
        [evaluator.id, "Lab Assistant", "Evaluator", departmentId],
      );
    }

    const [[existingPeers]] = await connection.query(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       INNER JOIN instructors i ON i.user_id = u.id
       LEFT JOIN departments d ON d.id = COALESCE(u.department_id, i.department_id)
       WHERE u.id <> ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
         AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_'))
           IN ('lab_assistant', 'ara', 'labassistant')
         AND (u.college_id = ? OR d.college_id = ?)`,
      [evaluator.id, collegeId, collegeId],
    );
    let peerCount = Number(existingPeers.total || 0);
    let seedIndex = 1;
    while (peerCount < requiredPeerCount) {
      const username = `lab-peer-seed-${collegeId}-${seedIndex}`;
      seedIndex += 1;
      const [existingUsername] = await connection.query(
        "SELECT id FROM users WHERE username = ? LIMIT 1",
        [username],
      );
      if (existingUsername.length) continue;

      const [result] = await connection.query(
        `INSERT INTO users
           (username, password_hash, role, college_id, department_id, status, is_first_login)
         VALUES (?, ?, 'lab_assistant', ?, ?, 'active', TRUE)`,
        [username, passwordHash, collegeId, departmentId],
      );
      await connection.query(
        `INSERT INTO instructors (user_id, first_name, last_name, department_id)
         VALUES (?, 'Seed Lab', ?, ?)`,
        [result.insertId, `Assistant ${seedIndex - 1}`, departmentId],
      );
      peerCount += 1;
      console.log("Created active peer account:", username);
    }

    const [[verification]] = await connection.query(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       INNER JOIN instructors i ON i.user_id = u.id
       LEFT JOIN departments d ON d.id = COALESCE(u.department_id, i.department_id)
       WHERE u.id <> ?
         AND LOWER(COALESCE(u.status, 'active')) = 'active'
         AND LOWER(REPLACE(REPLACE(TRIM(COALESCE(u.role, '')), '-', '_'), ' ', '_'))
           IN ('lab_assistant', 'ara', 'labassistant')
         AND (u.college_id = ? OR d.college_id = ?)`,
      [evaluator.id, collegeId, collegeId],
    );
    if (Number(verification.total || 0) < requiredPeerCount) {
      throw new Error(
        `Seed verification found only ${verification.total} active college peers.`,
      );
    }

    await connection.commit();
    transactionStarted = false;
    console.log("Lab Assistant peer seed verified:", {
      activeCollegeId: collegeId,
      peersCount: Number(verification.total),
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Peer seed rollback failed:", rollbackError);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}

seedLabAssistantPeers()
  .catch((error) => {
    console.error("Lab Assistant peer seed failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
