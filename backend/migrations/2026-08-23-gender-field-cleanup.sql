-- Run against ipes_db in phpMyAdmin.
-- Existing registration_date values are preserved for student-history compatibility;
-- new registrations use created_at automatically and no longer accept manual dates.

SELECT COUNT(*) INTO @users_gender_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'gender';
SET @users_gender_sql = IF(@users_gender_exists = 0,
  'ALTER TABLE users ADD COLUMN gender VARCHAR(10) NULL',
  'SELECT 1');
PREPARE users_gender_stmt FROM @users_gender_sql;
EXECUTE users_gender_stmt;
DEALLOCATE PREPARE users_gender_stmt;

SELECT COUNT(*) INTO @students_gender_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'students'
  AND COLUMN_NAME = 'gender';
SET @students_gender_sql = IF(@students_gender_exists = 0,
  'ALTER TABLE students ADD COLUMN gender VARCHAR(10) NULL',
  'SELECT 1');
PREPARE students_gender_stmt FROM @students_gender_sql;
EXECUTE students_gender_stmt;
DEALLOCATE PREPARE students_gender_stmt;

SELECT COUNT(*) INTO @instructors_gender_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'instructors'
  AND COLUMN_NAME = 'gender';
SET @instructors_gender_sql = IF(@instructors_gender_exists = 0,
  'ALTER TABLE instructors ADD COLUMN gender VARCHAR(10) NULL',
  'SELECT 1');
PREPARE instructors_gender_stmt FROM @instructors_gender_sql;
EXECUTE instructors_gender_stmt;
DEALLOCATE PREPARE instructors_gender_stmt;

SELECT COUNT(*) INTO @program_type_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'instructors'
  AND COLUMN_NAME = 'program_type';
SET @program_type_sql = IF(@program_type_exists > 0,
  'ALTER TABLE instructors DROP COLUMN program_type',
  'SELECT 1');
PREPARE program_type_stmt FROM @program_type_sql;
EXECUTE program_type_stmt;
DEALLOCATE PREPARE program_type_stmt;

SELECT COUNT(*) INTO @registration_date_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'instructors'
  AND COLUMN_NAME = 'registration_date';
SET @registration_date_sql = IF(@registration_date_exists > 0,
  'ALTER TABLE instructors DROP COLUMN registration_date',
  'SELECT 1');
PREPARE registration_date_stmt FROM @registration_date_sql;
EXECUTE registration_date_stmt;
DEALLOCATE PREPARE registration_date_stmt;
