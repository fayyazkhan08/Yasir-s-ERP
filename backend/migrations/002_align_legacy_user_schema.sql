-- Align legacy user rows and columns with the current auth flow.
USE erp_system;

-- Keep admin privileges; legacy manager/staff accounts become standard users.
ALTER TABLE users
  MODIFY role ENUM('admin','manager','staff','user') NOT NULL DEFAULT 'user';
UPDATE users SET role = 'user' WHERE role <> 'admin';
ALTER TABLE users
  MODIFY role ENUM('admin','user') NOT NULL DEFAULT 'user';

-- Add auth metadata only when it is missing from the existing database.
SET @add_last_login_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at') = 0,
  'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL',
  'SELECT 1'
);
PREPARE add_last_login_at_stmt FROM @add_last_login_at;
EXECUTE add_last_login_at_stmt;
DEALLOCATE PREPARE add_last_login_at_stmt;

SET @add_updated_at = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'updated_at') = 0,
  'ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE add_updated_at_stmt FROM @add_updated_at;
EXECUTE add_updated_at_stmt;
DEALLOCATE PREPARE add_updated_at_stmt;