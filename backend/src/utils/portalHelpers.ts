import crypto from 'crypto';
import { RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';
import { pool } from '../config/db';

// ---------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------
/** Runs `fn` inside a transaction: commits on success, rolls back and rethrows on any error, always releases the connection. */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

// ---------------------------------------------------------------------
// Token secret
// ---------------------------------------------------------------------
/**
 * Customer-portal tokens are signed with a DIFFERENT secret from staff tokens.
 * That is what makes the two identities impossible to confuse: a customer's token
 * fails signature verification in the staff `requireAuth` middleware (and vice
 * versa), so a customer can never reach /api/customers, /api/invoices, etc.,
 * even if a future admin route forgets to check a role.
 */
export function portalJwtSecret(): string {
  if (process.env.PORTAL_JWT_SECRET) return process.env.PORTAL_JWT_SECRET;
  const base = process.env.JWT_SECRET;
  if (!base) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Set JWT_SECRET (or PORTAL_JWT_SECRET) before running in production.');
    }
    return 'dev_secret:portal';
  }
  return `${base}:portal`;
}

/** Binds a token to the current password: changing/resetting the password invalidates old tokens. */
export function passwordFingerprint(passwordHash: string): string {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------
// Business configuration (env-driven, validated)
// ---------------------------------------------------------------------
function numEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** % of the plan price credited to the referrer when the referred customer buys a subscription. 0 disables commissions. */
export const commissionPercent = () => numEnv('REFERRAL_COMMISSION_PERCENT', 10, 0, 100);
/** Smallest amount (₹) a customer may withdraw in one request. */
export const minWithdrawal = () => numEnv('MIN_WITHDRAWAL_AMOUNT', 500, 1, 10_000_000);

// ---------------------------------------------------------------------
// Money — integer paise arithmetic so we never compare floating-point rupees
// ---------------------------------------------------------------------
export const toPaise = (rupees: number | string): number => Math.round(Number(rupees) * 100);
export const fromPaise = (paise: number): number => paise / 100;

// ---------------------------------------------------------------------
// Referral codes
// ---------------------------------------------------------------------
// 32 symbols with no 0/O/1/I so codes survive being read aloud or typed from a screenshot.
// 256 is divisible by 32, so `byte % 32` is perfectly uniform (no modulo bias).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;

/**
 * Returns the customer's referral code, creating one if the customer (e.g. one added by
 * an admin after the migration ran) doesn't have it yet. Safe under concurrency: the
 * UPDATE only writes while the column is still NULL, and the UNIQUE key rejects collisions.
 */
export async function ensureReferralCode(customerId: number): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT referral_code FROM customers WHERE id = ?', [customerId]);
    if (!rows.length) throw new Error('Customer not found');
    if (rows[0].referral_code) return rows[0].referral_code;
    try {
      await pool.query('UPDATE customers SET referral_code = ? WHERE id = ? AND referral_code IS NULL', [
        generateReferralCode(),
        customerId,
      ]);
    } catch (err: any) {
      if (err.code !== 'ER_DUP_ENTRY') throw err; // collision on the unique key → retry with a new code
    }
  }
  throw new Error('Could not allocate a referral code');
}

// ---------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------
/** Random temporary password (12 chars, always contains letters and digits to satisfy the policy). */
export function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  const chars = [pick(letters), pick(letters), pick(digits), pick(digits)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ---------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------
/** 9876543210 → 98******10. Referrers see who they referred, but never a full phone number. */
export function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return '';
  if (mobile.length <= 4) return '*'.repeat(mobile.length);
  return `${mobile.slice(0, 2)}${'*'.repeat(mobile.length - 4)}${mobile.slice(-2)}`;
}
