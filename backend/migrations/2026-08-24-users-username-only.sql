-- Existing users are backfilled by runMigrations.js before these columns are removed.
SET @drop_users_student_id_fks = (
  SELECT IFNULL(
    CONCAT(
      'ALTER TABLE `users` ',
      GROUP_CONCAT(
        CONCAT(
          'DROP FOREIGN KEY `',
          REPLACE(CONSTRAINT_NAME, '`', '``'),
          '`'
        )
        SEPARATOR ', '
      )
    ),
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'student_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);
PREPARE drop_users_student_id_fks FROM @drop_users_student_id_fks;
EXECUTE drop_users_student_id_fks;
DEALLOCATE PREPARE drop_users_student_id_fks;

ALTER TABLE users
  MODIFY COLUMN username VARCHAR(255) NOT NULL,
  DROP COLUMN email,
  DROP COLUMN student_id,
  DROP COLUMN profile_picture,
  DROP COLUMN phone_number,
  DROP COLUMN gender;