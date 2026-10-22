-- IPES Complete Database Schema & Initial Data
CREATE DATABASE IF NOT EXISTS ipes_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ipes_db;

-- --------------------------------------------------------
-- 1. Colleges Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS colleges (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(64) NOT NULL UNIQUE,
  description VARCHAR(1000) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 2. Departments Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  college_id INT UNSIGNED NOT NULL,
  department_name VARCHAR(100) NOT NULL,
  department_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(64) NULL,
  CONSTRAINT fk_departments_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 2. Base Users Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'dept_head', 'instructor', 'student', 'lab_assistant', 'college_dean', 'academic_directorate', 'vice_president') NOT NULL,
    college_id INT UNSIGNED NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    department_id INT UNSIGNED NULL,
    is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
    reset_token VARCHAR(255) NULL,
    token_expires DATETIME NULL,
    reset_otp VARCHAR(255) NULL,
    otp_expiry DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id INT UNSIGNED PRIMARY KEY,
  full_name VARCHAR(255) DEFAULT NULL,
  phone_number VARCHAR(64) DEFAULT NULL,
  profile_picture VARCHAR(255) DEFAULT NULL,
  profile_picture_data MEDIUMBLOB DEFAULT NULL,
  profile_picture_mime_type VARCHAR(100) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profile_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id INT UNSIGNED PRIMARY KEY,
  evaluation_deadlines TINYINT(1) NOT NULL DEFAULT 1,
  system_announcements TINYINT(1) NOT NULL DEFAULT 1,
  security_alerts TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 3. Instructors & Department Heads Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    phone_number VARCHAR(10) NULL UNIQUE,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    department_id INT UNSIGNED NOT NULL,
    gender VARCHAR(10) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_instructors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_instructors_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 4. Students Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    student_id VARCHAR(64) NOT NULL UNIQUE,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
      phone_number VARCHAR(10) DEFAULT NULL UNIQUE,
    department_id INT UNSIGNED NOT NULL,
    semester VARCHAR(32) NOT NULL,
    year_level VARCHAR(32) NOT NULL,
    section VARCHAR(32) NOT NULL,
    gender VARCHAR(10) NULL,
    program_type VARCHAR(64) DEFAULT 'Regular',
    requires_profile_update TINYINT(1) NOT NULL DEFAULT 0,
    registration_date VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 5. Courses Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    year_level VARCHAR(32) DEFAULT NULL,
    semester VARCHAR(32) DEFAULT NULL,
    credit_hours INT NOT NULL DEFAULT 3,
    is_lab TINYINT(1) NOT NULL DEFAULT 0,
    section VARCHAR(32) DEFAULT NULL,
    department_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lab_classes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id INT UNSIGNED NOT NULL UNIQUE,
    section VARCHAR(32) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action_title VARCHAR(255) NOT NULL,
  description TEXT,
  performed_by VARCHAR(255),
  ip_address VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  audience VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_by VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_broadcasts_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(128) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 6. Evaluation Templates Table (id Fixed to INT UNSIGNED)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_data JSON NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_evaluation_templates_updated_at (updated_at),
  CONSTRAINT fk_templates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 7. Dynamic Evaluation Criteria Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  evaluator_type ENUM('student', 'peer', 'dept_head', 'ara_student', 'ara_peer', 'ara_dept_head') NOT NULL,
  target_role VARCHAR(32) NOT NULL DEFAULT 'instructor',
  criterion_text VARCHAR(255) NOT NULL,
  criterion_text_am VARCHAR(255) DEFAULT NULL,
  category VARCHAR(100) DEFAULT 'General',
  weight INT DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE KEY uk_evaluation_criteria_mapping (evaluator_type, target_role, criterion_text),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE evaluation_criteria
SET criterion_text_am = CONCAT('የግምገማ መስፈርት፦ ', criterion_text)
WHERE criterion_text_am IS NULL OR TRIM(criterion_text_am) = '';

UPDATE evaluation_criteria
SET target_role = CASE WHEN evaluator_type LIKE 'ara_%' THEN 'lab_assistant' ELSE 'instructor' END
WHERE target_role IS NULL OR TRIM(target_role) = '';

INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'student', 'The instructor communicates clearly and supports learning.', 'መምህሩ በግልጽ ይገልጻል እና ትምህርትን ይደግፋል።', 'Teaching', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'student');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'peer', 'The instructor demonstrates professional competence.', 'መምህሩ ሙያዊ ብቃት ያሳያል።', 'Professional Competency', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'peer');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'dept_head', 'The instructor fulfills departmental responsibilities.', 'መምህሩ የዲፓርትመንቱን ኃላፊነቶች ይወጣል።', 'Departmental Responsibility', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'dept_head');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, criterion_text_am, category, weight, is_active)
SELECT 'dept_head', 'The instructor contributes to college goals.', 'መምህሩ ለኮሌጁ ግቦች አስተዋጽኦ ያደርጋል።', 'College Contribution', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'dept_head');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Explains detailed session objectives and expected learning outcomes clearly.', 'Session Objectives', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Explains detailed session objectives and expected learning outcomes clearly.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Prepares well for practical sessions and organizes required materials and equipment.', 'Practical Preparation', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Prepares well for practical sessions and organizes required materials and equipment.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Uses student-centered approaches and encourages active participation.', 'Student-Centered Support', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Uses student-centered approaches and encourages active participation.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Listens attentively to students'' problems, questions, and learning needs.', 'Listening to Students', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Listens attentively to students'' problems, questions, and learning needs.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Uses laboratory and instructional time appropriately.', 'Time Utilization', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Uses laboratory and instructional time appropriately.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Solves or refers students'' academic and practical problems on time.', 'Academic Problem Solving', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Solves or refers students'' academic and practical problems on time.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Explains and reinforces appropriate laboratory safety precautions.', 'Safety Guidance', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Explains and reinforces appropriate laboratory safety precautions.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Assists students with sample preparation, analysis, and interpretation of results.', 'Sample Analysis Assistance', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Assists students with sample preparation, analysis, and interpretation of results.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Guides students in proper instrument operation and equipment handling.', 'Instrument and Equipment Support', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Guides students in proper instrument operation and equipment handling.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_student', 'Communicates clearly and demonstrates respectful, reliable professional conduct.', 'Communication and Professionalism', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_student' AND criterion_text = 'Communicates clearly and demonstrates respectful, reliable professional conduct.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Keeps knowledge of laboratory subject matter, methods, and procedures up to date.', 'Subject Matter Knowledge', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Keeps knowledge of laboratory subject matter, methods, and procedures up to date.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Follows safety precautions and promptly reports hazards, incidents, or unsafe conditions.', 'Safety Precaution Reporting', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Follows safety precautions and promptly reports hazards, incidents, or unsafe conditions.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Assists with sample preparation, analysis, handling, and accurate reporting of results.', 'Sample Analysis Assistance', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Assists with sample preparation, analysis, handling, and accurate reporting of results.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Supports proper instrument operation, routine maintenance, and calibration.', 'Instrument Maintenance', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Supports proper instrument operation, routine maintenance, and calibration.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Handles laboratory equipment, materials, and chemicals carefully and responsibly.', 'Equipment Handling', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Handles laboratory equipment, materials, and chemicals carefully and responsibly.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Uses laboratory time effectively and supports colleagues in completing activities on schedule.', 'Time Utilization', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Uses laboratory time effectively and supports colleagues in completing activities on schedule.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Provides dependable technical assistance and collaborates effectively with colleagues.', 'Technical Cooperation', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Provides dependable technical assistance and collaborates effectively with colleagues.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Maintains complete and accurate laboratory records and documentation.', 'Record Keeping', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Maintains complete and accurate laboratory records and documentation.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Communicates laboratory information, instructions, and results clearly.', 'Communication', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Communicates laboratory information, instructions, and results clearly.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_peer', 'Demonstrates reliability, teamwork, respect, and professional responsibility.', 'Professional Conduct', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_peer' AND criterion_text = 'Demonstrates reliability, teamwork, respect, and professional responsibility.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Demonstrates adequate knowledge of laboratory subject matter and procedures.', 'Subject Matter Knowledge', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Demonstrates adequate knowledge of laboratory subject matter and procedures.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Follows laboratory safety precautions and promotes safe working practices.', 'Safety Precautions', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Follows laboratory safety precautions and promotes safe working practices.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Performs sample preparation, analysis, and handling accurately.', 'Sample Analysis', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Performs sample preparation, analysis, and handling accurately.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Operates laboratory instruments correctly and responsibly.', 'Instrument Operation', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Operates laboratory instruments correctly and responsibly.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Performs or supports routine instrument maintenance and calibration.', 'Instrument Maintenance', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Performs or supports routine instrument maintenance and calibration.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Handles laboratory equipment, materials, and chemicals with care.', 'Equipment Handling', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Handles laboratory equipment, materials, and chemicals with care.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Uses laboratory time efficiently and completes assigned activities on schedule.', 'Time Utilization', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Uses laboratory time efficiently and completes assigned activities on schedule.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Maintains accurate laboratory records, results, and documentation.', 'Record Keeping', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Maintains accurate laboratory records, results, and documentation.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Provides effective technical support to students, instructors, and researchers.', 'Technical Support', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Provides effective technical support to students, instructors, and researchers.');
INSERT INTO evaluation_criteria (evaluator_type, criterion_text, category, weight, is_active)
SELECT 'ara_dept_head', 'Demonstrates reliability, teamwork, communication, and professional conduct.', 'Professional Responsibility', 5, 1
WHERE NOT EXISTS (SELECT 1 FROM evaluation_criteria WHERE evaluator_type = 'ara_dept_head' AND criterion_text = 'Demonstrates reliability, teamwork, communication, and professional conduct.');

UPDATE evaluation_criteria
SET target_role = CASE WHEN evaluator_type LIKE 'ara_%' THEN 'lab_assistant' ELSE target_role END
WHERE evaluator_type LIKE 'ara_%';

UPDATE evaluation_criteria SET evaluator_type = 'dept_head' WHERE evaluator_type = 'dean';
ALTER TABLE evaluation_criteria MODIFY COLUMN evaluator_type ENUM('student', 'peer', 'dept_head', 'ara_student', 'ara_peer', 'ara_dept_head') NOT NULL;
UPDATE evaluation_criteria SET target_role = CASE WHEN evaluator_type LIKE 'ara_%' THEN 'lab_assistant' ELSE 'instructor' END;
DELETE duplicate_row FROM evaluation_criteria duplicate_row
INNER JOIN evaluation_criteria retained_row
  ON duplicate_row.id > retained_row.id
 AND duplicate_row.evaluator_type = retained_row.evaluator_type
 AND duplicate_row.target_role = retained_row.target_role
 AND duplicate_row.criterion_text = retained_row.criterion_text;
DELETE FROM evaluation_criteria WHERE evaluator_type = 'dept_head' AND target_role = 'instructor';
INSERT INTO evaluation_criteria (evaluator_type, target_role, criterion_text, category, weight, is_active) VALUES
('dept_head', 'instructor', 'Efforts of self-development in his/her specialization', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Adequacy of subject matter knowledge', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Professional Skill / Teaching Methodology', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Willingness to accept additional teaching assignments when compelling situation arises in the department', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Effectiveness as a mentor in cooperative learning, internship etc...', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Active participation in improvement of teaching-learning process, seminars, workshop, symposia and reviewing of teaching materials (curriculum)', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Participation in community service affairs and volunteer activities and willingness to participate in activities other than regular teaching (mentorship)', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Identifying priority areas in one''s discipline and pursuing research in that area', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Participation in research project and project proposal development', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Performance as an academic advisor', 'Core Competency', 5, 1),
('dept_head', 'instructor', 'Participation in problem identification and solving at department/college/institution', 'Professional Competence', 5, 1),
('dept_head', 'instructor', 'Participation in Comprehensive Professional Development / CCPD, HDP, ELIP', 'Professional Competence', 5, 1),
('dept_head', 'instructor', 'Continuous assessment implementation', 'Professional Competence', 5, 1),
('dept_head', 'instructor', 'Providing and reporting tutorial activities designed for the students', 'Professional Competence', 5, 1),
('dept_head', 'instructor', 'Executing assigned classes/invigilation on time', 'Time Management', 5, 1),
('dept_head', 'instructor', 'Notifying and implementing consultation timely and Giving timely feedback to students', 'Time Management', 5, 1),
('dept_head', 'instructor', 'Meeting deadlines (in reporting, SIMS result feeding, submission of grade/documents...etc...)', 'Time Management', 5, 1),
('dept_head', 'instructor', 'Showing concern for the use of resources of the department and the University', 'Ethical Competence', 5, 1),
('dept_head', 'instructor', 'Willingness and participation in committee works at department/University level and Having positive attitude to work with others, team spirit', 'Ethical Competence', 5, 1),
('dept_head', 'instructor', 'His/her professional ethics and being a role model (dressing, hair style, personality, addiction...)', 'Ethical Competence', 5, 1);

-- --------------------------------------------------------
-- 8. Template Criteria Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS template_criteria (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED NOT NULL,
  category VARCHAR(255) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  criteria_key VARCHAR(255) NULL,
  text_en TEXT NULL,
  text_am TEXT NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_template_criteria_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  INDEX idx_template_criteria_template_id (template_id),
  INDEX idx_template_criteria_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 8. Course Assignments Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_assignments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    department_id INT UNSIGNED NOT NULL,
    course_id INT UNSIGNED NOT NULL,
    instructor_id INT UNSIGNED NOT NULL,
    program_type VARCHAR(32) DEFAULT NULL,
    year_level VARCHAR(32) NOT NULL,
    semester VARCHAR(32) NOT NULL,
    section VARCHAR(32) NOT NULL,
    academic_year VARCHAR(32) NOT NULL DEFAULT '2026',
    cycle_id INT UNSIGNED DEFAULT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    is_student_published TINYINT(1) NOT NULL DEFAULT 0,
    is_peer_published TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_assign_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 9. Evaluation Dispatches Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_dispatches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id INT UNSIGNED DEFAULT NULL,
  student_id INT UNSIGNED DEFAULT NULL,
  student_identifier VARCHAR(255) DEFAULT NULL,
  course_id INT UNSIGNED DEFAULT NULL,
  assignment_id INT UNSIGNED DEFAULT NULL,
  cycle_id INT UNSIGNED DEFAULT NULL,
  course_code VARCHAR(64) DEFAULT NULL,
  course_name VARCHAR(255) DEFAULT NULL,
  academic_year VARCHAR(64) DEFAULT NULL,
  semester VARCHAR(64) DEFAULT NULL,
  year_level VARCHAR(64) DEFAULT NULL,
  student_group VARCHAR(255) DEFAULT NULL,
  student_identifier_text VARCHAR(255) DEFAULT NULL,
  department_id INT UNSIGNED DEFAULT NULL,
  program_type VARCHAR(64) DEFAULT NULL,
  is_student_published TINYINT(1) DEFAULT 0,
  created_by INT UNSIGNED DEFAULT NULL,
  payload JSON DEFAULT NULL,
  status ENUM('pending', 'submitted', 'closed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evaluation_dispatches_template FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_evaluation_dispatches_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  CONSTRAINT fk_evaluation_dispatches_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_evaluation_dispatches_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lab_assignment_evaluations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  section_id INT UNSIGNED NOT NULL,
  year_level VARCHAR(64) NOT NULL,
  semester VARCHAR(64) NOT NULL,
  lab_assistant_id INT UNSIGNED NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_lab_assignment_evaluation (course_id, section_id, year_level, semester),
  CONSTRAINT fk_lab_assignment_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_lab_assignment_section FOREIGN KEY (section_id) REFERENCES course_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_lab_assignment_assistant FOREIGN KEY (lab_assistant_id) REFERENCES instructors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 10. Student Evaluation Submissions Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_evaluation_submissions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 11. Legacy Evaluation Submissions Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_submissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT UNSIGNED NOT NULL,
    student_id INT UNSIGNED NOT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    feedback TEXT NULL,
    responses JSON NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sub_assignment FOREIGN KEY (assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 12. Contact Messages Table
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_contact_messages_status (status),
    INDEX idx_contact_messages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Initial Seed Data
-- --------------------------------------------------------

-- Seed colleges before departments so every department has an explicit parent.
INSERT INTO colleges (id, name, code) VALUES
  (1, 'College of Health Sciences', 'HS'),
  (2, 'College of Education', 'EDU'),
  (3, 'College of Natural and Computational Sciences', 'CNCS')
ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code);

INSERT INTO departments (id, college_id, department_name, department_code, name, code) VALUES
  (1, 1, 'Department of Medicine', 'MED', 'Department of Medicine', 'MED'),
  (2, 1, 'Department of Nursing', 'NUR', 'Department of Nursing', 'NUR'),
  (3, 2, 'Department of Education', 'EDU', 'Department of Education', 'EDU'),
  (4, 3, 'Department of Information Technology', 'IT', 'Department of Information Technology', 'IT')
ON DUPLICATE KEY UPDATE
  college_id = VALUES(college_id),
  department_name = VALUES(department_name),
  department_code = VALUES(department_code),
  name = VALUES(name),
  code = VALUES(code);

INSERT INTO users (id, username, password_hash, role) VALUES
  (1, 'admin@ipes.edu.et', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'admin'),
  (2, 'depthead@ipes.edu.et', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'dept_head'),
  (3, 'instructor@ipes.edu.et', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'instructor'),
  (4, 'STU1212', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'student'),
  (5, 'STU2002', '$2a$12$mTKhkjb./.xV2BRtCJR8.OWjLzpUYrj.unZ7ZtK37u5aSigeYZCZS', 'student')
ON DUPLICATE KEY UPDATE username = VALUES(username), password_hash = VALUES(password_hash), role = VALUES(role);

-- Instructors
INSERT INTO instructors (id, user_id, phone_number, first_name, last_name, department_id) VALUES
  (1, 2, '0910000001', 'Department', 'Head', 1),
  (2, 3, '0910000002', 'Abebe', 'Tolossa', 1)
ON DUPLICATE KEY UPDATE phone_number = VALUES(phone_number), first_name = VALUES(first_name), last_name = VALUES(last_name), department_id = VALUES(department_id);

-- Students
INSERT INTO students (id, user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, registration_date) VALUES
  (1, 4, 'STU1212', 'Chala', 'Bekele', 2, 'I', '3rd Year', 'H', 'Extension', '08/07/2026'),
  (2, 5, 'STU2002', 'Abel', 'Kefe', 1, 'I', '2nd Year', 'B', 'Regular', '08/07/2026')
ON DUPLICATE KEY UPDATE student_id = VALUES(student_id), first_name = VALUES(first_name), last_name = VALUES(last_name), department_id = VALUES(department_id);

-- Courses
INSERT INTO courses (id, code, name, department_id) VALUES
  (1, 'CS101', 'Introduction to Computing', 3)
ON DUPLICATE KEY UPDATE code = VALUES(code);