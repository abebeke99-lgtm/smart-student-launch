const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const standardInstructorCriteria = require("../data/standardInstructorCriteria");

dotenv.config();

const connectionConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ipes_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const expectedSchema = {
  colleges: {
    name: "varchar(255)",
    code: "varchar(64)",
    description: "varchar(1000)",
  },
  users: {
    username: "varchar(128)",
    password_hash: "varchar(255)",
    role: "enum('admin','dept_head','instructor','student')",
    status: "varchar(32)",
    college_id: "int(10) unsigned",
    department_id: "int(10) unsigned",
    is_first_login: "tinyint(1)",
  },
  user_profile_settings: {
    user_id: "int(10) unsigned",
    full_name: "varchar(255)",
    phone_number: "varchar(64)",
    profile_picture: "varchar(255)",
    profile_picture_data: "mediumblob",
    profile_picture_mime_type: "varchar(100)",
    updated_at: "timestamp",
  },
  instructors: {
    user_id: "int(10) unsigned",
    phone_number: "varchar(10)",
    first_name: "varchar(128)",
    last_name: "varchar(128)",
    department_id: "int(10) unsigned",
    gender: "varchar(10)",
  },
  students: {
    user_id: "int(10) unsigned",
    student_id: "varchar(64)",
    phone_number: "varchar(10)",
    first_name: "varchar(128)",
    last_name: "varchar(128)",
    gender: "varchar(10)",
    department_id: "int(10) unsigned",
    semester: "varchar(32)",
    year_level: "varchar(64)",
    section: "varchar(64)",
    program_type: "varchar(64)",
    registration_date: "varchar(64)",
  },
  departments: {
    college_id: "int(10) unsigned",
    department_name: "varchar(100)",
    department_code: "varchar(20)",
    name: "varchar(255)",
    code: "varchar(64)",
  },
  evaluation_criteria: {
    evaluator_type:
      "enum('student','peer','dept_head','dean','ara_student','ara_peer','ara_dept_head')",
    target_role: "varchar(32)",
    criterion_text: "varchar(255)",
    criterion_text_am: "varchar(255)",
    category: "varchar(100)",
    weight: "int(11)",
    is_active: "tinyint(1)",
  },
  peer_evaluations: {
    course_id: "int(10) unsigned",
    is_published: "tinyint(1)",
  },
  course_assignments: {
    cycle_id: "int(10) unsigned",
  },
  courses: {
    code: "varchar(100)",
    name: "varchar(255)",
    credit_hours: "int(11)",
    is_lab: "tinyint(1)",
    year_level: "varchar(32)",
    semester: "varchar(32)",
    section: "varchar(32)",
    department_id: "int(10) unsigned",
  },
  lab_classes: {
    course_id: "int(10) unsigned",
    section: "varchar(32)",
    created_at: "timestamp",
  },
  evaluation_dispatches: {
    assignment_id: "int(10) unsigned",
    cycle_id: "int(10) unsigned",
    department_id: "int(10) unsigned",
    program_type: "varchar(64)",
    template_id: "int(10) unsigned",
    student_id: "int(10) unsigned",
    student_identifier: "varchar(255)",
    course_id: "int(10) unsigned",
    course_name: "varchar(255)",
    academic_year: "varchar(64)",
    semester: "varchar(64)",
    year_level: "varchar(64)",
    is_student_published: "tinyint(1)",
    student_group: "varchar(255)",
    created_by: "int(10) unsigned",
    payload: "json",
    status: "enum('pending','submitted','closed')",
  },
  evaluation_criteria: {
    evaluator_type: "enum('student','peer','dept_head','dean')",
    criterion_text: "varchar(255)",
    criterion_text_am: "varchar(255)",
    category: "varchar(100)",
    weight: "int(11)",
    is_active: "tinyint(1)",
  },
  student_evaluation_submissions: {
    dispatch_id: "int(10) unsigned",
    student_id: "int(10) unsigned",
    student_name: "varchar(255)",
    score: "decimal(5,2)",
    feedback: "text",
    responses: "json",
    status: "varchar(32)",
  },
  notifications: {
    user_id: "int(10) unsigned",
    title: "varchar(255)",
    message: "text",
    type: "varchar(50)",
    is_read: "tinyint(1)",
    created_at: "timestamp",
  },
  password_resets: {
    user_id: "int(10) unsigned",
    code_hash: "varchar(255)",
    expires_at: "datetime",
    created_at: "timestamp",
  },
};

const getColumns = async (conn, table) => {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return rows.reduce((acc, row) => {
    acc[row.COLUMN_NAME] = row;
    return acc;
  }, {});
};

const dropForeignKeysForColumn = async (conn, table, column) => {
  const [rows] = await conn.query(
    `SELECT DISTINCT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [table, column],
  );
  for (const { CONSTRAINT_NAME: constraintName } of rows) {
    const escapedName = String(constraintName).replace(/`/g, "``");
    await conn.query(
      `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${escapedName}\``,
    );
  }
};

const tableExists = async (conn, table) => {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return rows.length > 0;
};

const addMissingColumn = async (conn, table, column, type) => {
  console.log(`Adding missing column \`${column}\` to table \`${table}\``);
  if (table === "courses" && column === "is_lab") {
    await conn.query(
      "ALTER TABLE `courses` ADD COLUMN `is_lab` TINYINT(1) NOT NULL DEFAULT 0",
    );
    return;
  }
  if (table === "courses" && column === "section") {
    await conn.query(
      "ALTER TABLE `courses` ADD COLUMN `section` VARCHAR(32) DEFAULT NULL",
    );
    return;
  }
  await conn.query(
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type} DEFAULT NULL`,
  );
};

const createTable = async (conn, table) => {
  switch (table) {
    case "users":
      await conn.query(`CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(128) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','dept_head','instructor','student','lab_assistant','college_dean','academic_directorate','vice_president') NOT NULL DEFAULT 'student',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        department_id INT UNSIGNED DEFAULT NULL,
        is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "user_profile_settings":
      await conn.query(`CREATE TABLE user_profile_settings (
        user_id INT UNSIGNED PRIMARY KEY,
        full_name VARCHAR(255) DEFAULT NULL,
        phone_number VARCHAR(64) DEFAULT NULL,
        profile_picture VARCHAR(255) DEFAULT NULL,
        profile_picture_data MEDIUMBLOB DEFAULT NULL,
        profile_picture_mime_type VARCHAR(100) DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_profile_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "departments":
      await conn.query(`CREATE TABLE departments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        college_id INT UNSIGNED NOT NULL,
        department_name VARCHAR(100) NOT NULL,
        department_code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(64) NULL,
        CONSTRAINT fk_departments_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "colleges":
      await conn.query(`CREATE TABLE colleges (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(64) NOT NULL UNIQUE,
        description VARCHAR(1000) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "courses":
      await conn.query(`CREATE TABLE courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        credit_hours INT NOT NULL DEFAULT 3,
        is_lab TINYINT(1) NOT NULL DEFAULT 0,
        section VARCHAR(32) DEFAULT NULL,
        department_id INT(10) unsigned DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "lab_classes":
      await conn.query(`CREATE TABLE lab_classes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        course_id INT(10) unsigned NOT NULL UNIQUE,
        section VARCHAR(32) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "instructors":
      await conn.query(`CREATE TABLE instructors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT(10) unsigned NOT NULL,
        phone_number VARCHAR(10) DEFAULT NULL,
        first_name VARCHAR(128) DEFAULT NULL,
        last_name VARCHAR(128) DEFAULT NULL,
        department_id INT(10) unsigned DEFAULT NULL,
        gender VARCHAR(10) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_instructor_user (user_id),
        CONSTRAINT fk_instructors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_instructors_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "students":
      await conn.query(`CREATE TABLE students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT(10) unsigned NOT NULL,
        student_id VARCHAR(64) DEFAULT NULL,
        first_name VARCHAR(128) DEFAULT NULL,
        last_name VARCHAR(128) DEFAULT NULL,
        phone_number VARCHAR(10) DEFAULT NULL UNIQUE,
        gender VARCHAR(10) DEFAULT NULL,
        department_id INT(10) unsigned DEFAULT NULL,
        semester VARCHAR(32) DEFAULT NULL,
        year_level VARCHAR(64) DEFAULT NULL,
        section VARCHAR(64) DEFAULT NULL,
        program_type VARCHAR(64) DEFAULT NULL,
        registration_date VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_student_user (user_id),
        CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "evaluation_dispatches":
      await conn.query(`CREATE TABLE evaluation_dispatches (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        template_id INT UNSIGNED DEFAULT NULL,
        student_id INT UNSIGNED DEFAULT NULL,
        student_identifier VARCHAR(255) DEFAULT NULL,
        course_id INT UNSIGNED DEFAULT NULL,
        course_name VARCHAR(255) DEFAULT NULL,
        academic_year VARCHAR(64) DEFAULT NULL,
        semester VARCHAR(64) DEFAULT NULL,
        year_level VARCHAR(64) DEFAULT NULL,
        student_group VARCHAR(255) DEFAULT NULL,
        created_by INT UNSIGNED DEFAULT NULL,
        payload JSON DEFAULT NULL,
        status ENUM('pending','submitted','closed') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_evaluation_dispatches_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE SET NULL,
        CONSTRAINT fk_evaluation_dispatches_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
        CONSTRAINT fk_evaluation_dispatches_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_evaluation_dispatches_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "evaluation_criteria":
      await conn.query(`CREATE TABLE evaluation_criteria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        evaluator_type ENUM('student', 'peer', 'dept_head', 'dean', 'ara_student', 'ara_peer', 'ara_dept_head') NOT NULL,
        target_role VARCHAR(32) NOT NULL DEFAULT 'instructor',
        criterion_text VARCHAR(255) NOT NULL,
        criterion_text_am VARCHAR(255) DEFAULT NULL,
        category VARCHAR(100) DEFAULT 'General',
        weight INT DEFAULT 5,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await conn.query(
        "UPDATE evaluation_criteria SET target_role = CASE WHEN evaluator_type LIKE 'ara_%' THEN 'lab_assistant' ELSE 'instructor' END WHERE target_role IS NULL OR TRIM(target_role) = ''",
      );
      await conn.query(
        "ALTER TABLE evaluation_criteria MODIFY COLUMN target_role VARCHAR(32) NOT NULL DEFAULT 'instructor'",
      );
      break;
    case "student_evaluation_submissions":
      await conn.query(`CREATE TABLE student_evaluation_submissions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        dispatch_id INT UNSIGNED NOT NULL,
        student_id INT UNSIGNED DEFAULT NULL,
        student_name VARCHAR(255) DEFAULT NULL,
        score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        feedback TEXT DEFAULT NULL,
        responses JSON DEFAULT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'submitted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_student_evaluation_submissions_dispatch FOREIGN KEY (dispatch_id) REFERENCES evaluation_dispatches(id) ON DELETE CASCADE,
        CONSTRAINT fk_student_evaluation_submissions_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "user_profile_settings":
      await conn.query(`CREATE TABLE user_profile_settings (
        user_id INT UNSIGNED PRIMARY KEY,
        phone_number VARCHAR(64) DEFAULT NULL,
        profile_picture VARCHAR(255) DEFAULT NULL,
        profile_picture_data MEDIUMBLOB DEFAULT NULL,
        profile_picture_mime_type VARCHAR(100) DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_profile_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "notifications":
      await conn.query(`CREATE TABLE notifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'reminder',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notifications_user_read (user_id, is_read, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    case "password_resets":
      await conn.query(`CREATE TABLE password_resets (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_password_resets_user (user_id, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      break;
    default:
      throw new Error(`Unhandled schema creation for table: ${table}`);
  }
};

const run = async () => {
  const conn = await mysql.createConnection(connectionConfig);
  try {
    console.log("Connected to", connectionConfig.database);

    for (const [table, columns] of Object.entries(expectedSchema)) {
      if (!(await tableExists(conn, table))) {
        console.log(`Creating missing table: ${table}`);
        await createTable(conn, table);
        continue;
      }

      const existingColumns = await getColumns(conn, table);
      for (const [column, expectedType] of Object.entries(columns)) {
        const existing = existingColumns[column];
        if (!existing) {
          await addMissingColumn(conn, table, column, expectedType);
          continue;
        }

        const actualType = existing.COLUMN_TYPE.toLowerCase();
        if (!actualType.includes(expectedType.toLowerCase())) {
          console.warn(
            `Column type mismatch for ${table}.${column}: actual=${actualType} expected=${expectedType}. Skipping automatic ALTER TABLE.`,
          );
        }
      }
    }

    await conn.query(`CREATE TABLE IF NOT EXISTS department_evaluation_windows (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const normalizeScheduleTextColumn = async (columnName) => {
      const columns = await getColumns(conn, "department_evaluation_windows");
      const dataType = String(columns[columnName]?.COLUMN_TYPE || "")
        .toLowerCase()
        .split("(")[0];
      if (["char", "varchar", "tinytext", "text", "mediumtext", "longtext"].includes(dataType)) {
        return;
      }

      const normalizedColumn = `${columnName}_text`;
      if (!columns[normalizedColumn]) {
        await conn.query(
          `ALTER TABLE department_evaluation_windows
           ADD COLUMN ${normalizedColumn} VARCHAR(40) DEFAULT NULL`,
        );
      }
      const valueExpression = ["date", "datetime", "timestamp"].includes(dataType)
        ? `DATE_FORMAT(${columnName}, '%Y-%m-%dT%H:%i:%s.000Z')`
        : `CAST(${columnName} AS CHAR)`;
      await conn.query(
        `UPDATE department_evaluation_windows
         SET ${normalizedColumn} = ${valueExpression}
         WHERE ${columnName} IS NOT NULL`,
      );
      await conn.query(
        `ALTER TABLE department_evaluation_windows
         DROP COLUMN ${columnName},
         CHANGE COLUMN ${normalizedColumn} ${columnName} VARCHAR(40) DEFAULT NULL`,
      );
    };

    await normalizeScheduleTextColumn("start_at");
    await normalizeScheduleTextColumn("end_at");

    const normalizeScheduleDateColumn = async (columnName, sourceColumn) => {
      const columns = await getColumns(conn, "department_evaluation_windows");
      if (String(columns[columnName]?.COLUMN_TYPE || "").toLowerCase().startsWith("datetime")) {
        return;
      }

      const normalizedColumn = `${columnName}_normalized`;
      if (!columns[normalizedColumn]) {
        await conn.query(
          `ALTER TABLE department_evaluation_windows
           ADD COLUMN ${normalizedColumn} DATETIME DEFAULT NULL`,
        );
      }
      await conn.query(
        `UPDATE department_evaluation_windows
         SET ${normalizedColumn} = CAST(
           NULLIF(REPLACE(REPLACE(${sourceColumn}, 'T', ' '), 'Z', ''), '')
           AS DATETIME
         )
         WHERE ${sourceColumn} IS NOT NULL
           AND ${sourceColumn} <> ''`,
      );
      await conn.query(
        `ALTER TABLE department_evaluation_windows
         DROP COLUMN ${columnName},
         CHANGE COLUMN ${normalizedColumn} ${columnName} DATETIME DEFAULT NULL`,
      );
    };

    await normalizeScheduleDateColumn("start_date", "start_at");
    await normalizeScheduleDateColumn("expiry_date", "end_at");

    if (await tableExists(conn, "courses") && await tableExists(conn, "lab_classes")) {
      await conn.query(
        `INSERT INTO lab_classes (course_id, section)
         SELECT id, section FROM courses WHERE is_lab = 1
         ON DUPLICATE KEY UPDATE section = COALESCE(lab_classes.section, VALUES(section))`,
      );
    }

    if (await tableExists(conn, "instructors")) {
      let instructorColumns = await getColumns(conn, "instructors");
      if (!instructorColumns.phone_number) {
        await conn.query(
          "ALTER TABLE instructors ADD COLUMN phone_number VARCHAR(10) NULL UNIQUE",
        );
        instructorColumns = await getColumns(conn, "instructors");
      }
      if (instructorColumns.employee_id) {
        await conn.query(
          "UPDATE instructors SET phone_number = employee_id WHERE phone_number IS NULL AND employee_id REGEXP '^09[0-9]{8}$'",
        );
        await conn.query("ALTER TABLE instructors DROP COLUMN employee_id");
      }
    }

    const userColumns = await getColumns(conn, "users");
    if (userColumns.student_id) {
      await conn.query(
        "UPDATE users u LEFT JOIN students s ON s.user_id = u.id SET u.username = COALESCE(NULLIF(u.username, ''), NULLIF(s.student_id, ''), CONCAT('user_', u.id)) WHERE u.username IS NULL OR u.username = ''",
      );
    }
    await conn.query(
      "UPDATE users SET username = COALESCE(NULLIF(username, ''), CONCAT('user_', id)) WHERE username IS NULL OR username = ''",
    );
    await conn.query(
      "ALTER TABLE users MODIFY COLUMN username VARCHAR(255) NOT NULL",
    );
    for (const column of [
      "email",
      "student_id",
      "profile_picture",
      "phone_number",
      "gender",
    ]) {
      if (userColumns[column]) {
        await dropForeignKeysForColumn(conn, "users", column);
        await conn.query(`ALTER TABLE users DROP COLUMN \`${column}\``);
      }
    }

    const instructorColumns = await getColumns(conn, "instructors");
    for (const column of ["program_type", "registration_date"]) {
      if (instructorColumns[column]) {
        await conn.query(`ALTER TABLE instructors DROP COLUMN \`${column}\``);
      }
    }

    await conn.query(
      "UPDATE evaluation_criteria SET criterion_text_am = CONCAT('የግምገማ መስፈርት፦ ', criterion_text) WHERE criterion_text_am IS NULL OR TRIM(criterion_text_am) = ''",
    );
    await conn.query(
      "UPDATE evaluation_criteria SET evaluator_type = 'dept_head' WHERE evaluator_type = 'dean'",
    );
    await conn.query(
      "ALTER TABLE evaluation_criteria MODIFY COLUMN evaluator_type ENUM('student', 'peer', 'dept_head', 'ara_student', 'ara_peer', 'ara_dept_head') NOT NULL",
    );
    await conn.query(
      "UPDATE evaluation_criteria SET target_role = CASE WHEN evaluator_type LIKE 'ara_%' THEN 'lab_assistant' ELSE 'instructor' END",
    );
    await conn.query(
      "ALTER TABLE evaluation_criteria MODIFY COLUMN target_role VARCHAR(32) NOT NULL DEFAULT 'instructor'",
    );
    await conn.query(
      "DELETE duplicate_row FROM evaluation_criteria duplicate_row INNER JOIN evaluation_criteria retained_row ON duplicate_row.id > retained_row.id AND duplicate_row.evaluator_type = retained_row.evaluator_type AND duplicate_row.target_role = retained_row.target_role AND duplicate_row.criterion_text = retained_row.criterion_text",
    );
    await conn.query(
      "DELETE FROM evaluation_criteria WHERE evaluator_type = 'dept_head' AND target_role = 'instructor'",
    );
    for (const [category, englishText] of standardInstructorCriteria) {
      await conn.query(
        "INSERT INTO evaluation_criteria (evaluator_type, target_role, criterion_text, category, weight, is_active) VALUES ('dept_head', 'instructor', ?, ?, 5, 1)",
        [englishText, category],
      );
    }
    const baselineCriteria = [
      [
        "student",
        "The instructor communicates clearly and supports learning.",
        "Teaching",
      ],
      [
        "peer",
        "The instructor demonstrates professional competence.",
        "Professional Competency",
      ],
    ];
    for (const [evaluatorType, englishText, category] of baselineCriteria) {
      await conn.query(
        "INSERT INTO evaluation_criteria (evaluator_type, target_role, criterion_text, category, weight, is_active) SELECT ?, 'instructor', ?, ?, 5, 1 WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = ? AND target_role = 'instructor')",
        [evaluatorType, englishText, category, evaluatorType],
      );
    }
    try {
      await conn.query(
        "ALTER TABLE evaluation_criteria ADD UNIQUE KEY uk_evaluation_criteria_mapping (evaluator_type, target_role, criterion_text)",
      );
    } catch (error) {
      if (!String(error.message || "").includes("Duplicate key name"))
        throw error;
    }

    if (await tableExists(conn, "course_assignments")) {
      await conn.query(`DELETE duplicate FROM course_assignments duplicate
        INNER JOIN (
          SELECT MIN(id) AS keep_id, department_id, course_id, program_type, year_level, semester, section
          FROM course_assignments
          GROUP BY department_id, course_id, program_type, year_level, semester, section
        ) grouped ON grouped.department_id <=> duplicate.department_id
          AND grouped.course_id <=> duplicate.course_id
          AND grouped.program_type <=> duplicate.program_type
          AND grouped.year_level <=> duplicate.year_level
          AND grouped.semester <=> duplicate.semester
          AND grouped.section <=> duplicate.section
          AND duplicate.id > grouped.keep_id`);
      try {
        await conn.query(
          "ALTER TABLE course_assignments ADD UNIQUE KEY uk_course_assignment_slot (department_id, course_id, program_type, year_level, semester, section)",
        );
      } catch (error) {
        if (!String(error.message || "").includes("Duplicate key name"))
          throw error;
      }
    }

    console.log("Schema migration completed successfully.");
  } catch (error) {
    console.error("Schema migration failed:", error);
    process.exit(1);
  } finally {
    await conn.end();
  }
};

run().catch((error) => {
  console.error("Migration execution error:", error);
  process.exit(1);
});
