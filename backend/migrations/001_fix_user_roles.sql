-- =====================================================================
-- Migration: align users.role with the app's Admin/User model
-- Safe to run against an existing erp_system database that was created
-- with the old ('admin','manager','staff') role enum.
-- =====================================================================
USE erp_system;

-- 1. Collapse 'manager' and 'staff' into 'user' before narrowing the enum
--    (running this against the old enum is safe — it's just an UPDATE).
UPDATE users SET role = 'staff' WHERE role NOT IN ('admin', 'manager', 'staff');
UPDATE users SET role = 'user_tmp' WHERE role IN ('manager', 'staff');

-- 2. Widen the enum temporarily so both old and new values are valid mid-migration
ALTER TABLE users MODIFY role ENUM('admin','manager','staff','user_tmp','user') NOT NULL DEFAULT 'user_tmp';
UPDATE users SET role = 'user' WHERE role = 'user_tmp';

-- 3. Narrow the enum to the final admin/user model
ALTER TABLE users MODIFY role ENUM('admin','user') NOT NULL DEFAULT 'user';

-- 4. New columns used by the fixed auth flow.
--    If you've already run this migration once, comment out lines that error
--    with "Duplicate column name" — they're safe to skip.
ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL;
ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
ALTER TABLE users MODIFY status ENUM('active','inactive') NOT NULL DEFAULT 'active';

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_status ON users (status);
