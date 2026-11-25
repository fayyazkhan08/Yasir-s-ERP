import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { asyncHandler, buildPaginatedResponse, HttpError, parsePagination } from '../utils/helpers';
import { ensureReferralCode, generateTempPassword, withTransaction } from '../utils/portalHelpers';
import { AuthedRequest } from '../middleware/auth';

/**
 * All handlers in this file are mounted behind `requireAuth` + `requireRole('admin')` in server.ts.
 * Paying out money is deliberately admin-only (not the broader 'user' staff role).
 */

// ---------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------

// GET /api/admin/portal/withdrawals?status=&search=
export const listWithdrawals = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ['id', 'created_at', 'amount', 'status'], 'created_at');
  const { status, search } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];
  if (status && ['pending', 'paid', 'rejected', 'cancelled'].includes(status)) {
    where.push('w.status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(c.name LIKE ? OR c.mobile LIKE ? OR c.customer_code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT w.id, w.customer_id, c.customer_code, c.name AS customer_name, c.mobile AS customer_mobile,
            w.amount, w.payout_method, w.upi_id, w.bank_account_name, w.bank_account_number, w.bank_ifsc,
            w.status, w.payout_reference, w.admin_note, w.processed_at, u.name AS processed_by_name, w.created_at
       FROM withdrawal_requests w
       JOIN customers c ON c.id = w.customer_id
       LEFT JOIN users u ON u.id = w.processed_by
       ${whereClause}
      ORDER BY w.${sortBy} ${sortDir}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[count]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM withdrawal_requests w JOIN customers c ON c.id = w.customer_id ${whereClause}`,
    params
  );
  const [[pending]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM withdrawal_requests WHERE status = 'pending'`
  );

  res.json({
    success: true,
    ...buildPaginatedResponse(rows, count.total, page, limit),
    summary: { pending_count: Number(pending.n), pending_amount: Number(pending.total) },
  });
});

/**
 * Shared by pay + reject. Locks the customer row first (same order the customer-side code uses,
 * so there is no deadlock), then flips the status ONLY if it is still 'pending'. If the customer
 * cancelled a moment earlier, or another admin already processed it, affectedRows is 0 and we
 * report that instead of double-processing.
 */
async function processWithdrawal(
  id: number,
  adminId: number,
  next: 'paid' | 'rejected',
  fields: { payout_reference: string | null; admin_note: string | null }
) {
  await withTransaction(async (conn) => {
    const [found] = await conn.query<RowDataPacket[]>('SELECT customer_id, amount FROM withdrawal_requests WHERE id = ?', [id]);
    if (!found.length) throw new HttpError(404, 'Withdrawal request not found');
    const { customer_id: customerId, amount } = found[0];

    await conn.query('SELECT id FROM customers WHERE id = ? FOR UPDATE', [customerId]);

    const [upd] = await conn.query<ResultSetHeader>(
      `UPDATE withdrawal_requests
          SET status = ?, payout_reference = ?, admin_note = ?, processed_by = ?, processed_at = NOW()
        WHERE id = ? AND status = 'pending'`,
      [next, fields.payout_reference, fields.admin_note, adminId, id]
    );
    if (!upd.affectedRows) {
      const [cur] = await conn.query<RowDataPacket[]>('SELECT status FROM withdrawal_requests WHERE id = ?', [id]);
      throw new HttpError(409, `This request is already ${cur[0].status}. Refresh the list.`);
    }

    if (next === 'rejected') {
      // The amount was held at request time — give it back.
      await conn.query(
        `INSERT INTO wallet_transactions (customer_id, type, direction, amount, description, withdrawal_id)
         VALUES (?, 'withdrawal_refund', 'credit', ?, ?, ?)`,
        [customerId, amount, `Withdrawal request #${id} rejected — amount returned`, id]
      );
    }
  });
}

// PATCH /api/admin/portal/withdrawals/:id/pay   { payout_reference, admin_note? }
export const markWithdrawalPaid = asyncHandler(async (req: AuthedRequest, res: Response) => {
  await processWithdrawal(Number(req.params.id), req.user!.id, 'paid', {
    payout_reference: String(req.body.payout_reference).trim(),
    admin_note: req.body.admin_note ? String(req.body.admin_note).trim() : null,
  });
  res.json({ success: true, message: 'Withdrawal marked as paid' });
});

// PATCH /api/admin/portal/withdrawals/:id/reject   { admin_note }
export const rejectWithdrawal = asyncHandler(async (req: AuthedRequest, res: Response) => {
  await processWithdrawal(Number(req.params.id), req.user!.id, 'rejected', {
    payout_reference: null,
    admin_note: String(req.body.admin_note).trim(),
  });
  res.json({ success: true, message: 'Withdrawal rejected and the amount returned to the customer' });
});

// ---------------------------------------------------------------------
// Portal logins for existing customers
// ---------------------------------------------------------------------

// GET /api/admin/portal/accounts?search=
export const listPortalAccounts = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { page, limit, offset } = parsePagination(req.query, ['id'], 'id');
  const search = typeof req.query.search === 'string' ? req.query.search : '';

  const where: string[] = [];
  const params: any[] = [];
  if (search) {
    where.push('(c.name LIKE ? OR c.mobile LIKE ? OR c.email LIKE ? OR c.customer_code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.customer_code, c.name, c.mobile, c.email AS customer_email, c.status AS customer_status,
            a.id AS account_id, a.email AS login_email, a.status AS login_status, a.last_login_at, a.must_change_password
       FROM customers c
       LEFT JOIN customer_accounts a ON a.customer_id = c.id
       ${whereClause}
      ORDER BY (a.id IS NULL) ASC, c.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM customers c ${whereClause}`, params);
  res.json({ success: true, ...buildPaginatedResponse(rows, count.total, page, limit) });
});

// POST /api/admin/portal/customers/:customerId/account   { email? }
// Creates a portal login for an EXISTING customer and returns a one-time temporary password.
// This is the safe way to onboard customers who already exist in the CRM: the admin vouches for
// identity, rather than the portal trusting whoever types a matching email.
export const createPortalAccount = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const customerId = Number(req.params.customerId);
  const [custRows] = await pool.query<RowDataPacket[]>('SELECT id, email FROM customers WHERE id = ?', [customerId]);
  if (!custRows.length) throw new HttpError(404, 'Customer not found');

  const email = String(req.body.email || custRows[0].email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(422, 'A valid email is required — this is what the customer will sign in with.');
  }

  const [hasAcct] = await pool.query<RowDataPacket[]>('SELECT id FROM customer_accounts WHERE customer_id = ?', [customerId]);
  if (hasAcct.length) throw new HttpError(409, 'This customer already has a portal login. Use "Reset password" instead.');
  const [emailTaken] = await pool.query<RowDataPacket[]>('SELECT id FROM customer_accounts WHERE email = ?', [email]);
  if (emailTaken.length) throw new HttpError(409, 'That email is already used by another portal login.');

  await ensureReferralCode(customerId);
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);
  await pool.query(
    'INSERT INTO customer_accounts (customer_id, email, password_hash, must_change_password) VALUES (?, ?, ?, 1)',
    [customerId, email, hash]
  );

  // Shown to the admin exactly once and never stored in plain text.
  res.status(201).json({ success: true, message: 'Portal login created', data: { email, temp_password: tempPassword } });
});

// POST /api/admin/portal/customers/:customerId/reset-password
export const resetPortalPassword = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const customerId = Number(req.params.customerId);
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, 12);

  // Changing the hash also invalidates every token the customer currently holds.
  const [upd] = await pool.query<ResultSetHeader>(
    'UPDATE customer_accounts SET password_hash = ?, must_change_password = 1 WHERE customer_id = ?',
    [hash, customerId]
  );
  if (!upd.affectedRows) throw new HttpError(404, 'This customer has no portal login yet.');

  const [rows] = await pool.query<RowDataPacket[]>('SELECT email FROM customer_accounts WHERE customer_id = ?', [customerId]);
  res.json({ success: true, message: 'Password reset', data: { email: rows[0].email, temp_password: tempPassword } });
});

// PATCH /api/admin/portal/customers/:customerId/account-status   { status }
export const setPortalAccountStatus = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const [upd] = await pool.query<ResultSetHeader>('UPDATE customer_accounts SET status = ? WHERE customer_id = ?', [
    req.body.status,
    Number(req.params.customerId),
  ]);
  if (!upd.affectedRows) throw new HttpError(404, 'This customer has no portal login yet.');
  res.json({ success: true, message: 'Portal login updated' });
});
