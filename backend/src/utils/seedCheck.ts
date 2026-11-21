/**
 * Run with: npx ts-node src/utils/seedCheck.ts
 * Creates a default admin user (admin@company.com / admin123) if none exists yet.
 * IMPORTANT: change the password immediately after first login in production.
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../config/db';

dotenv.config();

async function seed() {
  const [rows]: any = await pool.query('SELECT COUNT(*) AS total FROM users');
  if (rows[0].total > 0) {
    console.log('Users already exist — skipping seed.');
    process.exit(0);
  }

  const hash = await bcrypt.hash('admin123', 12);
  await pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Admin', 'admin@company.com', hash, 'admin']
  );
  console.log('✅ Default admin created: admin@company.com / admin123 (change this password immediately)');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
