-- =====================================================================
-- ERP / CRM / POS / Inventory System — MySQL Schema
-- =====================================================================
CREATE DATABASE IF NOT EXISTS erp_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erp_system;

-- ---------------------------------------------------------------------
-- CUSTOMERS
-- ---------------------------------------------------------------------
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  email VARCHAR(150),
  gstin VARCHAR(20) NULL,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  referred_by INT NULL,                 -- customers.id of referrer
  status ENUM('active','inactive') DEFAULT 'active',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES customers(id) ON DELETE SET NULL,
  INDEX idx_customers_mobile (mobile),
  INDEX idx_customers_email (email),
  INDEX idx_customers_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SUBSCRIPTION PLANS + CUSTOMER SUBSCRIPTIONS
-- ---------------------------------------------------------------------
CREATE TABLE subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,             -- Platinum / Gold / Silver
  tier_level INT NOT NULL,               -- for ordering / upgrade comparisons
  price DECIMAL(10,2) NOT NULL,
  duration_days INT NOT NULL DEFAULT 365,
  benefits TEXT,                         -- comma separated or JSON string
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE customer_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  plan_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active','expired','cancelled') DEFAULT 'active',
  auto_renew TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  INDEX idx_sub_customer (customer_id),
  INDEX idx_sub_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REFERRALS & REWARDS
-- ---------------------------------------------------------------------
CREATE TABLE referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,              -- customer who referred
  referred_id INT NOT NULL,              -- new customer who was referred
  status ENUM('pending','successful','rejected') DEFAULT 'pending',
  reward_amount DECIMAL(10,2) DEFAULT 0,
  reward_valid_until DATE,               -- valid for 1 year from issue
  reward_status ENUM('not_issued','issued','used','expired') DEFAULT 'not_issued',
  used_on_invoice_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_ref_referrer (referrer_id),
  INDEX idx_ref_status (reward_status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- INVENTORY (raw materials + finished products)
-- ---------------------------------------------------------------------
CREATE TABLE inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category ENUM('raw_material','finished_product','packaging','other') DEFAULT 'raw_material',
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',   -- kg, ltr, pcs, box...
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(12,2) NOT NULL DEFAULT 0,   -- low stock threshold
  unit_price DECIMAL(10,2) DEFAULT 0,
  supplier_id INT NULL,
  status ENUM('active','discontinued') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inv_category (category),
  INDEX idx_inv_name (name)
) ENGINE=InnoDB;

-- Stock ledger: every inward/outward movement
CREATE TABLE stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  movement_type ENUM('in','out','adjustment') NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  reference_type ENUM('purchase','invoice','work_order','manual') NOT NULL,
  reference_id INT NULL,                 -- purchase_id / invoice_id / etc.
  customer_id INT NULL,                  -- if consumption tied to a customer requirement
  notes VARCHAR(255),
  created_by VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  INDEX idx_mov_item (item_id),
  INDEX idx_mov_type (movement_type),
  INDEX idx_mov_date (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SUPPLIERS & PURCHASES (Inward stock)
-- ---------------------------------------------------------------------
CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  mobile VARCHAR(15),
  email VARCHAR(150),
  address VARCHAR(255),
  gstin VARCHAR(20),
  status ENUM('active','inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE inventory_items
  ADD CONSTRAINT fk_inv_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE TABLE purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_no VARCHAR(30) UNIQUE NOT NULL,
  supplier_id INT NOT NULL,
  purchase_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('pending','received','cancelled') DEFAULT 'received',
  notes VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  INDEX idx_purchase_date (purchase_date),
  INDEX idx_purchase_supplier (supplier_id)
) ENGINE=InnoDB;

CREATE TABLE purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- BILLING / INVOICES
-- ---------------------------------------------------------------------
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(30) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  invoice_type ENUM('gst','non_gst') NOT NULL DEFAULT 'non_gst',
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  cgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  reward_applied DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('draft','unpaid','paid','partially_paid','cancelled') DEFAULT 'unpaid',
  payment_mode ENUM('cash','card','upi','bank_transfer','other') NULL,
  notes VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_inv_customer (customer_id),
  INDEX idx_inv_date (invoice_date),
  INDEX idx_inv_status (status)
) ENGINE=InnoDB;

CREATE TABLE invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  item_id INT NULL,                      -- optional link to inventory_items
  description VARCHAR(255) NOT NULL,
  hsn_code VARCHAR(20),
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  gst_rate DECIMAL(5,2) DEFAULT 0,        -- e.g. 18.00
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- USERS (basic auth for the app itself)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SEED DATA
-- ---------------------------------------------------------------------
INSERT INTO subscription_plans (name, tier_level, price, duration_days, benefits) VALUES
('Silver', 1, 999.00, 365, 'Priority support,5% discount on invoices'),
('Gold', 2, 2499.00, 365, 'Priority support,10% discount on invoices,Free delivery'),
('Platinum', 3, 4999.00, 365, 'Dedicated account manager,15% discount on invoices,Free delivery,Early access to new stock');

INSERT INTO suppliers (name, contact_person, mobile, email, gstin) VALUES
('Shree Raw Materials Pvt Ltd', 'Rajesh Kumar', '9876543210', 'sales@shreeraw.com', '27ABCDE1234F1Z5'),
('National Packaging Co.', 'Anita Sharma', '9123456780', 'contact@natpack.in', '27PQRXY5678G1Z2');

INSERT INTO inventory_items (item_code, name, category, unit, current_stock, reorder_level, unit_price, supplier_id) VALUES
('RM-001', 'Cotton Yarn', 'raw_material', 'kg', 120.00, 50.00, 210.00, 1),
('RM-002', 'Polyester Thread', 'raw_material', 'kg', 18.00, 25.00, 340.00, 1),
('PK-001', 'Corrugated Box - Medium', 'packaging', 'pcs', 400.00, 100.00, 22.50, 2),
('FP-001', 'Finished Fabric Roll', 'finished_product', 'roll', 8.00, 10.00, 1850.00, NULL);
