import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, HttpError } from '../utils/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET /api/subscription-plans
export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY tier_level ASC'
  );
  res.json({ success: true, data: rows });
});

// GET /api/subscriptions?customer_id=&status=
export const listSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ['id', 'end_date', 'status'], 'end_date');
  const { customer_id, status, search } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];
  if (customer_id) { where.push('cs.customer_id = ?'); params.push(customer_id); }
  if (status) { where.push('cs.status = ?'); params.push(status); }
  if (search) { where.push('(c.name LIKE ? OR c.mobile LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cs.*, c.name AS customer_name, c.mobile AS customer_mobile, p.name AS plan_name, p.tier_level, p.benefits,
            DATEDIFF(cs.end_date, CURDATE()) AS days_remaining
     FROM customer_subscriptions cs
     JOIN customers c ON c.id = cs.customer_id
     JOIN subscription_plans p ON p.id = cs.plan_id
     ${whereClause}
     ORDER BY cs.${sortBy} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM customer_subscriptions cs JOIN customers c ON c.id = cs.customer_id ${whereClause}`,
    params
  );
  res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
});

// POST /api/subscriptions  — create new subscription (or upgrade/renew by passing existing_id)
export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { customer_id, plan_id, auto_renew, existing_id } = req.body;
  if (!customer_id || !plan_id) throw new HttpError(400, 'customer_id and plan_id are required');

  const [planRows] = await pool.query<RowDataPacket[]>('SELECT * FROM subscription_plans WHERE id = ?', [plan_id]);
  if (!planRows.length) throw new HttpError(404, 'Plan not found');
  const plan = planRows[0];

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.duration_days);

  if (existing_id) {
    // Renewal/upgrade: mark old as cancelled, create fresh record
    await pool.query(`UPDATE customer_subscriptions SET status = 'cancelled' WHERE id = ?`, [existing_id]);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO customer_subscriptions (customer_id, plan_id, start_date, end_date, status, auto_renew)
     VALUES (?, ?, ?, ?, 'active', ?)`,
    [customer_id, plan_id, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), auto_renew ? 1 : 0]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cs.*, p.name AS plan_name FROM customer_subscriptions cs
     JOIN subscription_plans p ON p.id = cs.plan_id WHERE cs.id = ?`,
    [result.insertId]
  );
  res.status(201).json({ success: true, message: existing_id ? 'Subscription renewed/upgraded' : 'Subscription created', data: rows[0] });
});

// PATCH /api/subscriptions/:id/cancel
export const cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE customer_subscriptions SET status = 'cancelled' WHERE id = ?`,
    [req.params.id]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Subscription not found');
  res.json({ success: true, message: 'Subscription cancelled' });
});

/** Utility used by a scheduled job / dashboard to auto-expire subscriptions past end_date. */
export async function autoExpireSubscriptions() {
  await pool.query(`UPDATE customer_subscriptions SET status = 'expired' WHERE status = 'active' AND end_date < CURDATE()`);
}
