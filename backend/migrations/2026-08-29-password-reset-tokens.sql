-- Secure, single-use password reset token storage.
SELECT COUNT(*) INTO @reset_token_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'reset_token';
SET @reset_token_sql = IF(@reset_token_exists = 0,
  'ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL',
  'SELECT 1');
PREPARE reset_token_stmt FROM @reset_token_sql;
EXECUTE reset_token_stmt;
DEALLOCATE PREPARE reset_token_stmt;

SELECT COUNT(*) INTO @token_expires_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'token_expires';
SET @token_expires_sql = IF(@token_expires_exists = 0,
  'ALTER TABLE users ADD COLUMN token_expires DATETIME NULL',
  'SELECT 1');
PREPARE token_expires_stmt FROM @token_expires_sql;
EXECUTE token_expires_stmt;
DEALLOCATE PREPARE token_expires_stmt;
