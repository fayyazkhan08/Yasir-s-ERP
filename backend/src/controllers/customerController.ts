import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, generateCode, HttpError } from '../utils/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const ALLOWED_SORT = ['id', 'name', 'mobile', 'email', 'created_at', 'status'];

// GET /api/customers?search=&status=&page=&limit=&sortBy=&sortDir=
export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'created_at');
  const { search, status } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    where.push('(c.name LIKE ? OR c.mobile LIKE ? OR c.email LIKE ? OR c.customer_code LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (status) {
    where.push('c.status = ?');
    params.push(status);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, r.name AS referred_by_name,
            (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) AS invoice_count,
            (SELECT cs.status FROM customer_subscriptions cs WHERE cs.customer_id = c.id
              ORDER BY cs.end_date DESC LIMIT 1) AS subscription_status
     FROM customers c
     LEFT JOIN customers r ON r.id = c.referred_by
     ${whereClause}
     ORDER BY ${sortBy === 'id' ? 'c.id' : `c.${sortBy}`} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM customers c ${whereClause}`,
    params
  );

  res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
});

// GET /api/customers/:id
export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, r.name AS referred_by_name FROM customers c
     LEFT JOIN customers r ON r.id = c.referred_by WHERE c.id = ?`,
    [req.params.id]
  );
  if (!rows.length) throw new HttpError(404, 'Customer not found');
  res.json({ success: true, data: rows[0] });
});

// POST /api/customers
export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { name, mobile, email, gstin, address, city, state, pincode, referred_by, notes } = req.body;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO customers (customer_code, name, mobile, email, gstin, address, city, state, pincode, referred_by, notes)
     VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, mobile, email || null, gstin || null, address || null, city || null, state || null, pincode || null, referred_by || null, notes || null]
  );
  const code = generateCode('CUST', result.insertId);
  await pool.query('UPDATE customers SET customer_code = ? WHERE id = ?', [code, result.insertId]);

  // If this customer was referred, log a referral record valid for 1 year
  if (referred_by) {
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);
    await pool.query(
      `INSERT INTO referrals (referrer_id, referred_id, status, reward_valid_until)
       VALUES (?, ?, 'pending', ?)`,
      [referred_by, result.insertId, validUntil.toISOString().slice(0, 10)]
    );
  }

  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM customers WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, message: 'Customer created', data: rows[0] });
});

// PUT /api/customers/:id
export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const fields = ['name', 'mobile', 'email', 'gstin', 'address', 'city', 'state', 'pincode', 'status', 'notes'];
  const updates: string[] = [];
  const params: any[] = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (!updates.length) throw new HttpError(400, 'No fields to update');
  params.push(id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
  if (!result.affectedRows) throw new HttpError(404, 'Customer not found');

  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM customers WHERE id = ?', [id]);
  res.json({ success: true, message: 'Customer updated', data: rows[0] });
});

// DELETE /api/customers/:id
export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM customers WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'Customer not found');
  res.json({ success: true, message: 'Customer deleted' });
});
