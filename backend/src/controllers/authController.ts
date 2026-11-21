import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { pool } from '../config/db';
import { asyncHandler, HttpError } from '../utils/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthedRequest } from '../middleware/auth';

function signToken(user: RowDataPacket) {
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any };
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'dev_secret',
    options
  );
}

function publicUser(u: RowDataPacket) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
}

// POST /api/auth/login
export const login = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { email, password } = req.body;

  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
  // Same generic message whether the email doesn't exist or the password is wrong —
  // avoids leaking which emails are registered.
  if (!rows.length) throw new HttpError(401, 'Invalid email or password');

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new HttpError(401, 'Invalid email or password');
  if (user.status !== 'active') throw new HttpError(403, 'This account has been deactivated. Contact your administrator.');

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = signToken(user);
  res.json({ success: true, data: { token, user: publicUser(user) } });
});

// POST /api/auth/register — PUBLIC signup. Always creates a 'user' role account.
// Admins are created only via /api/auth/users (requires an existing admin), never
// through the public endpoint — this closes the privilege-escalation hole where a
// client could previously pass role:"admin" straight into their own signup request.
export const register = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email).toLowerCase().trim();

  const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing.length) throw new HttpError(409, 'An account with this email already exists.');

  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'user', 'active')`,
    [name.trim(), normalizedEmail, hash]
  );

  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [result.insertId]);
  const user = rows[0];
  const token = signToken(user);

  res.status(201).json({ success: true, message: 'Account created', data: { token, user: publicUser(user) } });
});

// POST /api/auth/logout
// JWTs are stateless, so "logout" is primarily a client-side action (discard the token).
// This endpoint exists for a consistent API contract and as the hook point if a token
// blacklist / refresh-token store is added later.
export const logout = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/auth/me — returns the DB-verified user attached by requireAuth (never stale).
export const me = asyncHandler(async (req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: req.user });
});

// ---------------------------------------------------------------------
// Admin-only user management (all routes behind requireAuth + requireRole('admin'))
// ---------------------------------------------------------------------

// GET /api/auth/users
export const listUsers = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, email, role, status, last_login_at, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ success: true, data: rows });
});

// POST /api/auth/users — admin explicitly creates an admin or user account
export const adminCreateUser = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, email, password, role } = req.body;
  const normalizedEmail = String(email).toLowerCase().trim();
  const finalRole = role === 'admin' ? 'admin' : 'user';

  const [existing] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing.length) throw new HttpError(409, 'An account with this email already exists.');

  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')`,
    [name.trim(), normalizedEmail, hash, finalRole]
  );
  res.status(201).json({ success: true, message: 'User created', data: { id: result.insertId } });
});

// PATCH /api/auth/users/:id/role
export const updateUserRole = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) throw new HttpError(400, 'Role must be either "admin" or "user"');
  if (Number(req.params.id) === req.user!.id) throw new HttpError(400, 'You cannot change your own role');

  const [result] = await pool.query<ResultSetHeader>('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'User not found');
  res.json({ success: true, message: 'Role updated' });
});

// PATCH /api/auth/users/:id/status
export const updateUserStatus = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) throw new HttpError(400, 'Status must be either "active" or "inactive"');
  if (Number(req.params.id) === req.user!.id) throw new HttpError(400, 'You cannot deactivate your own account');

  const [result] = await pool.query<ResultSetHeader>('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'User not found');
  res.json({ success: true, message: 'Status updated' });
});
