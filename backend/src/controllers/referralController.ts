import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, HttpError } from '../utils/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const DEFAULT_REWARD_AMOUNT = 200; // flat reward per successful referral; adjust as needed

// GET /api/referrals?customer_id=&status=
export const listReferrals = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ['id', 'created_at', 'reward_valid_until'], 'created_at');
  const { customer_id, reward_status, search } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];
  if (customer_id) { where.push('r.referrer_id = ?'); params.push(customer_id); }
  if (reward_status) { where.push('r.reward_status = ?'); params.push(reward_status); }
  if (search) { where.push('(ref.name LIKE ? OR red.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.*, ref.name AS referrer_name, ref.mobile AS referrer_mobile,
            red.name AS referred_name, red.mobile AS referred_mobile,
            DATEDIFF(r.reward_valid_until, CURDATE()) AS days_until_expiry
     FROM referrals r
     JOIN customers ref ON ref.id = r.referrer_id
     JOIN customers red ON red.id = r.referred_id
     ${whereClause}
     ORDER BY r.${sortBy} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM referrals r
     JOIN customers ref ON ref.id = r.referrer_id JOIN customers red ON red.id = r.referred_id ${whereClause}`,
    params
  );
  res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
});

// POST /api/referrals  — manually log a referral (normally auto-created when a referred customer signs up)
export const createReferral = asyncHandler(async (req: Request, res: Response) => {
  const { referrer_id, referred_id } = req.body;
  if (!referrer_id || !referred_id) throw new HttpError(400, 'referrer_id and referred_id are required');
  if (referrer_id === referred_id) throw new HttpError(400, 'A customer cannot refer themselves');

  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO referrals (referrer_id, referred_id, status, reward_valid_until) VALUES (?, ?, 'pending', ?)`,
    [referrer_id, referred_id, validUntil.toISOString().slice(0, 10)]
  );
  res.status(201).json({ success: true, message: 'Referral recorded', data: { id: result.insertId } });
});

// PATCH /api/referrals/:id/mark-successful — issues the reward, valid for 1 year from issue date
export const markReferralSuccessful = asyncHandler(async (req: Request, res: Response) => {
  const { reward_amount } = req.body;
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE referrals
     SET status = 'successful', reward_status = 'issued',
         reward_amount = ?, reward_valid_until = ?
     WHERE id = ? AND status = 'pending'`,
    [reward_amount || DEFAULT_REWARD_AMOUNT, validUntil.toISOString().slice(0, 10), req.params.id]
  );
  if (!result.affectedRows) throw new HttpError(400, 'Referral not found or already processed');
  res.json({ success: true, message: 'Referral marked successful — reward issued (valid 1 year)' });
});

// GET /api/referrals/rewards/available?customer_id=  — usable, non-expired rewards for a customer (for invoice discount)
export const getAvailableRewards = asyncHandler(async (req: Request, res: Response) => {
  const { customer_id } = req.query;
  if (!customer_id) throw new HttpError(400, 'customer_id is required');

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM referrals
     WHERE referrer_id = ? AND reward_status = 'issued' AND reward_valid_until >= CURDATE()
     ORDER BY reward_valid_until ASC`,
    [customer_id]
  );
  res.json({ success: true, data: rows });
});

/** Scheduled/dashboard utility: expire rewards past their 1-year validity window. */
export async function autoExpireRewards() {
  await pool.query(
    `UPDATE referrals SET reward_status = 'expired' WHERE reward_status = 'issued' AND reward_valid_until < CURDATE()`
  );
}
