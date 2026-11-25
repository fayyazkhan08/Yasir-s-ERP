import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { asyncHandler, generateCode, HttpError } from '../utils/helpers';
import { generateReferralCode, passwordFingerprint, portalJwtSecret } from '../utils/portalHelpers';
import { PortalRequest } from '../middleware/portalAuth';

// A real bcrypt hash of a random string. Compared against when the email is unknown so
// "no such account" and "wrong password" take the same time (prevents account enumeration by timing).
const DUMMY_HASH = '$2a$12$Dl3aExkibHPOHkp3MCgVUu3cgexWI/80kHs3urt4MYxJAdmtnuwEm';

function signPortalToken(accountId: number, passwordHash: string): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: (process.env.PORTAL_JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '8h') as any,
  };
  return jwt.sign(
    { id: accountId, role: 'customer', typ: 'portal', ph: passwordFingerprint(passwordHash) },
    portalJwtSecret(),
    options
  );
}

/** The shape the frontend stores in its session. No password hash, no internal flags beyond what the UI needs. */
function sessionUser(row: RowDataPacket) {
  return {
    customer_id: row.customer_id,
    customer_code: row.customer_code,
    name: row.name,
    email: row.email,
    must_change_password: !!row.must_change_password,
  };
}

// POST /api/portal/auth/register
// Creates a NEW customer record + portal login in one transaction, and (optionally) attributes
// the signup to a referrer via their referral code.
//
// Deliberately does NOT attach to an existing CRM customer that happens to share the email or
// mobile: without email/SMS verification that would let anyone claim another person's
// subscription and wallet. Existing customers are linked by an admin instead.
export const register = asyncHandler(async (req: Request, res: Response) => {
  const name = String(req.body.name).trim();
  const mobile = String(req.body.mobile).trim();
  const email = String(req.body.email).toLowerCase().trim();
  const password = String(req.body.password);
  const refCode = req.body.referral_code ? String(req.body.referral_code).trim().toUpperCase() : '';

  const [acctDup] = await pool.query<RowDataPacket[]>('SELECT id FROM customer_accounts WHERE email = ?', [email]);
  if (acctDup.length) throw new HttpError(409, 'An account with this email already exists. Try signing in instead.');

  const [custDup] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM customers WHERE LOWER(email) = ? OR mobile = ? LIMIT 1',
    [email, mobile]
  );
  if (custDup.length) {
    throw new HttpError(
      409,
      "We already have a customer record with these details. If that's you, please contact us and we'll activate your portal login."
    );
  }

  let referrerId: number | null = null;
  if (refCode) {
    const [refRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM customers WHERE referral_code = ? AND status = 'active'`,
      [refCode]
    );
    if (!refRows.length) throw new HttpError(400, 'That referral code is not valid. Check it and try again, or leave it blank.');
    referrerId = refRows[0].id;
  }

  const hash = await bcrypt.hash(password, 12);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // The referral_code column is UNIQUE; retry on the (astronomically unlikely) collision.
    let customerId = 0;
    for (let attempt = 0; attempt < 5 && !customerId; attempt++) {
      try {
        const [ins] = await conn.query<ResultSetHeader>(
          `INSERT INTO customers (customer_code, referral_code, name, mobile, email, referred_by)
           VALUES ('TEMP', ?, ?, ?, ?, ?)`,
          [generateReferralCode(), name, mobile, email, referrerId]
        );
        customerId = ins.insertId;
      } catch (err: any) {
        if (err.code !== 'ER_DUP_ENTRY' || !String(err.sqlMessage).includes('referral_code')) throw err;
      }
    }
    if (!customerId) throw new HttpError(500, 'Could not complete registration. Please try again.');

    await conn.query('UPDATE customers SET customer_code = ? WHERE id = ?', [generateCode('CUST', customerId), customerId]);

    if (referrerId) {
      // Same record the admin "Add Customer → referred by" flow creates, so it shows up in the admin Referrals page.
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      await conn.query(
        `INSERT INTO referrals (referrer_id, referred_id, status, reward_valid_until) VALUES (?, ?, 'pending', ?)`,
        [referrerId, customerId, validUntil.toISOString().slice(0, 10)]
      );
    }

    const [acct] = await conn.query<ResultSetHeader>(
      `INSERT INTO customer_accounts (customer_id, email, password_hash) VALUES (?, ?, ?)`,
      [customerId, email, hash]
    );

    await conn.commit();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.customer_id, a.email, a.must_change_password, c.customer_code, c.name
         FROM customer_accounts a JOIN customers c ON c.id = a.customer_id WHERE a.id = ?`,
      [acct.insertId]
    );
    res.status(201).json({
      success: true,
      message: 'Account created',
      data: { token: signPortalToken(acct.insertId, hash), user: sessionUser(rows[0]) },
    });
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
});

// POST /api/portal/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body.email).toLowerCase().trim();
  const password = String(req.body.password);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.customer_id, a.email, a.password_hash, a.status, a.must_change_password,
            c.customer_code, c.name, c.status AS customer_status
       FROM customer_accounts a JOIN customers c ON c.id = a.customer_id
      WHERE a.email = ?`,
    [email]
  );
  const acct = rows[0];

  const valid = await bcrypt.compare(password, acct ? acct.password_hash : DUMMY_HASH);
  if (!acct || !valid) throw new HttpError(401, 'Invalid email or password');
  if (acct.status !== 'active' || acct.customer_status !== 'active') {
    throw new HttpError(403, 'This account is inactive. Please contact support.');
  }

  await pool.query('UPDATE customer_accounts SET last_login_at = NOW() WHERE id = ?', [acct.id]);
  res.json({ success: true, data: { token: signPortalToken(acct.id, acct.password_hash), user: sessionUser(acct) } });
});

// POST /api/portal/auth/logout — JWTs are stateless; the client discards the token. Kept for a symmetrical API.
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Signed out' });
});

// POST /api/portal/change-password  (requires a valid session; allowed even while a temp password is active)
export const changePassword = asyncHandler(async (req: PortalRequest, res: Response) => {
  const { current_password, new_password } = req.body;
  const accountId = req.portalUser!.accountId;

  const [rows] = await pool.query<RowDataPacket[]>('SELECT password_hash FROM customer_accounts WHERE id = ?', [accountId]);
  if (!rows.length) throw new HttpError(401, 'Account no longer exists.');

  if (!(await bcrypt.compare(String(current_password), rows[0].password_hash))) {
    throw new HttpError(400, 'Your current password is incorrect.');
  }
  if (String(current_password) === String(new_password)) {
    throw new HttpError(400, 'Choose a new password that is different from the current one.');
  }

  const hash = await bcrypt.hash(String(new_password), 12);
  await pool.query('UPDATE customer_accounts SET password_hash = ?, must_change_password = 0 WHERE id = ?', [hash, accountId]);

  // Old tokens are now invalid (password fingerprint changed) — hand back a fresh one so this session continues.
  res.json({ success: true, message: 'Password updated', data: { token: signPortalToken(accountId, hash) } });
});
