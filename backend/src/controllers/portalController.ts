import { Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { asyncHandler, buildPaginatedResponse, HttpError, parsePagination } from '../utils/helpers';
import {
  commissionPercent,
  ensureReferralCode,
  fromPaise,
  maskMobile,
  minWithdrawal,
  toPaise,
  withTransaction,
} from '../utils/portalHelpers';
import { PortalRequest } from '../middleware/portalAuth';

/**
 * SECURITY MODEL — read this before adding an endpoint.
 * Every handler here reads `req.portalUser.customerId`, which requirePortalAuth loads from the
 * database. No handler accepts a customer id from the client, and every query that touches
 * customer data filters on that id (or, for a record fetched by URL id, on id AND customer_id).
 * A customer therefore has no way to even *name* another customer's data.
 */
const cid = (req: PortalRequest) => req.portalUser!.customerId;

// A subscription whose end_date has passed is "expired" even if the nightly job hasn't flipped the flag yet.
const EFFECTIVE_SUB_STATUS = `CASE WHEN cs.status = 'active' AND cs.end_date < CURDATE() THEN 'expired' ELSE cs.status END`;

const SUB_SELECT = `
  SELECT cs.id, cs.plan_id, p.name AS plan_name, p.tier_level, p.price, p.duration_days, p.benefits,
         cs.start_date, cs.end_date, cs.auto_renew, ${EFFECTIVE_SUB_STATUS} AS status,
         DATEDIFF(cs.end_date, CURDATE()) AS days_remaining
    FROM customer_subscriptions cs
    JOIN subscription_plans p ON p.id = cs.plan_id`;

async function walletSummary(customerId: number) {
  const [[w]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance,
            COALESCE(SUM(CASE WHEN type = 'commission' THEN amount ELSE 0 END), 0) AS total_earned
       FROM wallet_transactions WHERE customer_id = ?`,
    [customerId]
  );
  const [[wd]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_withdrawn,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_withdrawals
       FROM withdrawal_requests WHERE customer_id = ?`,
    [customerId]
  );
  return {
    balance: Number(w.balance),
    total_earned: Number(w.total_earned),
    total_withdrawn: Number(wd.total_withdrawn),
    pending_withdrawals: Number(wd.pending_withdrawals),
  };
}

// GET /api/portal/me
export const getMe = asyncHandler(async (req: PortalRequest, res: Response) => {
  const referralCode = await ensureReferralCode(cid(req));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id AS customer_id, c.customer_code, c.name, c.mobile, c.email, c.address, c.city, c.state, c.pincode,
            c.created_at, a.must_change_password, a.last_login_at
       FROM customer_accounts a JOIN customers c ON c.id = a.customer_id
      WHERE a.id = ?`,
    [req.portalUser!.accountId]
  );
  if (!rows.length) throw new HttpError(404, 'Profile not found');
  res.json({
    success: true,
    data: {
      ...rows[0],
      must_change_password: !!rows[0].must_change_password,
      referral_code: referralCode,
      config: { commission_percent: commissionPercent(), min_withdrawal: minWithdrawal() },
    },
  });
});

// GET /api/portal/dashboard
export const getDashboard = asyncHandler(async (req: PortalRequest, res: Response) => {
  const customerId = cid(req);
  const referralCode = await ensureReferralCode(customerId);

  const [wallet, subRows, refStats, monthly, recent] = await Promise.all([
    walletSummary(customerId),
    pool.query<RowDataPacket[]>(
      `${SUB_SELECT}
        WHERE cs.customer_id = ?
        ORDER BY (cs.status = 'active' AND cs.end_date >= CURDATE()) DESC, cs.end_date DESC, cs.id DESC
        LIMIT 1`,
      [customerId]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(r.status = 'successful'), 0) AS successful,
              COUNT(DISTINCT CASE WHEN EXISTS (
                SELECT 1 FROM customer_subscriptions s
                 WHERE s.customer_id = r.referred_id AND s.status = 'active' AND s.end_date >= CURDATE()
              ) THEN r.referred_id END) AS with_active_subscription
         FROM referrals r WHERE r.referrer_id = ?`,
      [customerId]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(amount) AS income
         FROM referral_commissions
        WHERE referrer_id = ? AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')`,
      [customerId]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT id, type, direction, amount, description, created_at
         FROM wallet_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 5`,
      [customerId]
    ),
  ]);

  // Always return exactly 6 months (oldest → newest), zero-filled, so the chart never has gaps.
  const incomeByMonth = new Map<string, number>(monthly[0].map((m) => [m.month as string, Number(m.income)]));
  const income_trend: { month: string; income: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    income_trend.push({ month: key, income: incomeByMonth.get(key) ?? 0 });
  }

  const rs = refStats[0][0];
  res.json({
    success: true,
    data: {
      referral_code: referralCode,
      wallet,
      subscription: subRows[0][0] || null,
      referrals: {
        total: Number(rs.total),
        successful: Number(rs.successful),
        with_active_subscription: Number(rs.with_active_subscription),
      },
      income_trend,
      recent_transactions: recent[0],
      config: { commission_percent: commissionPercent(), min_withdrawal: minWithdrawal() },
    },
  });
});

// GET /api/portal/subscription
export const getSubscription = asyncHandler(async (req: PortalRequest, res: Response) => {
  const [history] = await pool.query<RowDataPacket[]>(
    `${SUB_SELECT} WHERE cs.customer_id = ? ORDER BY cs.id DESC`,
    [cid(req)]
  );
  const current =
    history.find((s) => s.status === 'active') ||
    // otherwise the most recently ending one, so an expired customer still sees what they had
    [...history].sort((a, b) => +new Date(b.end_date) - +new Date(a.end_date))[0] ||
    null;
  res.json({ success: true, data: { current, history } });
});

// GET /api/portal/referrals — the customers THIS customer referred
export const listReferrals = asyncHandler(async (req: PortalRequest, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ['id', 'created_at', 'status'], 'created_at');
  const customerId = cid(req);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, c.name AS referred_name, c.mobile AS referred_mobile, r.status,
            r.reward_amount, r.reward_status, r.reward_valid_until, r.created_at,
            (SELECT p.name FROM customer_subscriptions cs JOIN subscription_plans p ON p.id = cs.plan_id
              WHERE cs.customer_id = r.referred_id ORDER BY cs.id DESC LIMIT 1) AS plan_name,
            (SELECT ${EFFECTIVE_SUB_STATUS} FROM customer_subscriptions cs
              WHERE cs.customer_id = r.referred_id ORDER BY cs.id DESC LIMIT 1) AS subscription_status,
            (SELECT COALESCE(SUM(rc.amount), 0) FROM referral_commissions rc WHERE rc.referral_id = r.id) AS commission_earned
       FROM referrals r
       JOIN customers c ON c.id = r.referred_id
      WHERE r.referrer_id = ?
      ORDER BY r.${sortBy} ${sortDir}
      LIMIT ? OFFSET ?`,
    [customerId, limit, offset]
  );
  const [[count]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM referrals WHERE referrer_id = ?', [customerId]);

  const data = rows.map(({ referred_mobile, ...r }) => ({
    ...r,
    commission_earned: Number(r.commission_earned),
    // privacy: a referrer sees who they referred, but never their full phone number or email
    referred_mobile: maskMobile(referred_mobile),
  }));
  res.json({ success: true, ...buildPaginatedResponse(data, count.total, page, limit) });
});

// GET /api/portal/commissions
export const listCommissions = asyncHandler(async (req: PortalRequest, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ['id', 'created_at', 'amount'], 'created_at');
  const customerId = cid(req);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT rc.id, rc.created_at, rc.base_amount, rc.rate_percent, rc.amount,
            c.name AS referred_name, p.name AS plan_name, cs.start_date, cs.end_date
       FROM referral_commissions rc
       JOIN customers c ON c.id = rc.referred_id
       JOIN customer_subscriptions cs ON cs.id = rc.subscription_id
       JOIN subscription_plans p ON p.id = cs.plan_id
      WHERE rc.referrer_id = ?
      ORDER BY rc.${sortBy} ${sortDir}
      LIMIT ? OFFSET ?`,
    [customerId, limit, offset]
  );
  const [[sum]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS total_amount FROM referral_commissions WHERE referrer_id = ?',
    [customerId]
  );
  res.json({
    success: true,
    ...buildPaginatedResponse(rows, sum.total, page, limit),
    summary: { total_earned: Number(sum.total_amount), count: Number(sum.total), rate_percent: commissionPercent() },
  });
});

// GET /api/portal/transactions?type=
const TX_TYPES = ['commission', 'withdrawal', 'withdrawal_refund'];
export const listTransactions = asyncHandler(async (req: PortalRequest, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ['id', 'created_at', 'amount'], 'id');
  const customerId = cid(req);
  const type = typeof req.query.type === 'string' && TX_TYPES.includes(req.query.type) ? req.query.type : null;

  const where = type ? 'WHERE customer_id = ? AND type = ?' : 'WHERE customer_id = ?';
  const params: any[] = type ? [customerId, type] : [customerId];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, type, direction, amount, description, created_at
       FROM wallet_transactions ${where} ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM wallet_transactions ${where}`, params);

  res.json({
    success: true,
    ...buildPaginatedResponse(rows, count.total, page, limit),
    summary: await walletSummary(customerId),
  });
});

// ---------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------
const maskAccount = (n: string | null) => (n ? `${'X'.repeat(Math.max(0, n.length - 4))}${n.slice(-4)}` : null);

// GET /api/portal/withdrawals
export const listWithdrawals = asyncHandler(async (req: PortalRequest, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ['id', 'created_at', 'amount', 'status'], 'created_at');
  const customerId = cid(req);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, amount, payout_method, upi_id, bank_account_name, bank_account_number, bank_ifsc,
            status, payout_reference, admin_note, processed_at, created_at
       FROM withdrawal_requests WHERE customer_id = ? ORDER BY ${sortBy} ${sortDir} LIMIT ? OFFSET ?`,
    [customerId, limit, offset]
  );
  const [[count]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM withdrawal_requests WHERE customer_id = ?', [customerId]);

  const data = rows.map((r) => ({ ...r, bank_account_number: maskAccount(r.bank_account_number) }));
  res.json({
    success: true,
    ...buildPaginatedResponse(data, count.total, page, limit),
    summary: { ...(await walletSummary(customerId)), min_withdrawal: minWithdrawal() },
  });
});

// POST /api/portal/withdrawals
// The amount is debited from the wallet AT REQUEST TIME (held), so the same money can't be requested twice.
// It is refunded to the wallet if the request is rejected or cancelled.
export const createWithdrawal = asyncHandler(async (req: PortalRequest, res: Response) => {
  const customerId = cid(req);
  const { amount, payout_method, upi_id, bank_account_name, bank_account_number, bank_ifsc } = req.body;

  const amountPaise = toPaise(amount);
  if (amountPaise < toPaise(minWithdrawal())) {
    throw new HttpError(400, `The minimum withdrawal is ₹${minWithdrawal().toLocaleString('en-IN')}.`);
  }

  const created = await withTransaction(async (conn) => {
    // Serialise every money movement for this customer. Two simultaneous requests queue up here,
    // so the balance check below can never be satisfied twice by the same money.
    await conn.query('SELECT id FROM customers WHERE id = ? FOR UPDATE', [customerId]);

    const [[bal]] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance
         FROM wallet_transactions WHERE customer_id = ?`,
      [customerId]
    );
    if (amountPaise > toPaise(bal.balance)) {
      throw new HttpError(400, `Insufficient balance. You can withdraw up to ₹${Number(bal.balance).toLocaleString('en-IN')}.`);
    }

    const isUpi = payout_method === 'upi';
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO withdrawal_requests
         (customer_id, amount, payout_method, upi_id, bank_account_name, bank_account_number, bank_ifsc)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        fromPaise(amountPaise),
        payout_method,
        isUpi ? String(upi_id).trim() : null,
        isUpi ? null : String(bank_account_name).trim(),
        isUpi ? null : String(bank_account_number).trim(),
        isUpi ? null : String(bank_ifsc).trim().toUpperCase(),
      ]
    );
    await conn.query(
      `INSERT INTO wallet_transactions (customer_id, type, direction, amount, description, withdrawal_id)
       VALUES (?, 'withdrawal', 'debit', ?, ?, ?)`,
      [customerId, fromPaise(amountPaise), `Withdrawal request #${ins.insertId}`, ins.insertId]
    );
    return ins.insertId;
  });

  res.status(201).json({ success: true, message: 'Withdrawal request submitted', data: { id: created } });
});

// POST /api/portal/withdrawals/:id/cancel
export const cancelWithdrawal = asyncHandler(async (req: PortalRequest, res: Response) => {
  const customerId = cid(req);
  const withdrawalId = Number(req.params.id);

  await withTransaction(async (conn) => {
    await conn.query('SELECT id FROM customers WHERE id = ? FOR UPDATE', [customerId]);

    // Both conditions in the WHERE matter: `customer_id` stops a customer cancelling someone else's
    // request (IDOR), and `status = 'pending'` makes cancel vs. an admin paying it a clean either/or.
    const [upd] = await conn.query<ResultSetHeader>(
      `UPDATE withdrawal_requests SET status = 'cancelled' WHERE id = ? AND customer_id = ? AND status = 'pending'`,
      [withdrawalId, customerId]
    );
    if (!upd.affectedRows) {
      const [exists] = await conn.query<RowDataPacket[]>(
        'SELECT status FROM withdrawal_requests WHERE id = ? AND customer_id = ?',
        [withdrawalId, customerId]
      );
      if (!exists.length) throw new HttpError(404, 'Withdrawal request not found');
      throw new HttpError(409, `This request is already ${exists[0].status} and can no longer be cancelled.`);
    }

    const [[wd]] = await conn.query<RowDataPacket[]>('SELECT amount FROM withdrawal_requests WHERE id = ?', [withdrawalId]);
    await conn.query(
      `INSERT INTO wallet_transactions (customer_id, type, direction, amount, description, withdrawal_id)
       VALUES (?, 'withdrawal_refund', 'credit', ?, ?, ?)`,
      [customerId, wd.amount, `Withdrawal request #${withdrawalId} cancelled — amount returned`, withdrawalId]
    );
  });

  res.json({ success: true, message: 'Withdrawal cancelled and the amount was returned to your wallet' });
});

