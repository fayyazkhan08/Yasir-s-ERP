import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, HttpError } from '../utils/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Vendors are the existing `suppliers` table — so everything already linked to a supplier
 * (inventory items, purchase records) keeps working and shows up here automatically.
 */
const ALLOWED_SORT = ['id', 'name', 'contact_person', 'created_at', 'status'];

const MOBILE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(body: any, partial = false) {
  const out: Record<string, any> = {};
  const str = (k: string, max: number) => {
    if (body[k] === undefined) return;
    const v = String(body[k] ?? '').trim();
    out[k] = v === '' ? null : v.slice(0, max);
  };
  str('name', 150); str('contact_person', 100); str('mobile', 15);
  str('email', 150); str('address', 255); str('gstin', 20);
  if (out.gstin) out.gstin = String(out.gstin).toUpperCase();
  if (body.status !== undefined) out.status = body.status;

  if (!partial && !out.name) throw new HttpError(400, 'Vendor name is required');
  if ('name' in out && !out.name) throw new HttpError(400, 'Vendor name cannot be empty');
  if (!partial && !out.mobile) throw new HttpError(400, 'Mobile number is required (it is used to place orders)');
  if ('mobile' in out && (!out.mobile || !MOBILE_RE.test(out.mobile))) throw new HttpError(400, 'Enter a valid 10-digit mobile number');
  if (out.email && !EMAIL_RE.test(out.email)) throw new HttpError(400, 'Enter a valid email address');
  if (out.gstin && !GSTIN_RE.test(out.gstin)) throw new HttpError(400, 'Enter a valid GSTIN');
  if (out.status && !['active', 'inactive'].includes(out.status)) throw new HttpError(400, 'Invalid status');
  return out;
}

// GET /api/vendors?search=&status=
export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'name');
  const { search, status } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];
  if (search) {
    where.push('(s.name LIKE ? OR s.contact_person LIKE ? OR s.mobile LIKE ? OR s.email LIKE ?)');
    const t = `%${search}%`;
    params.push(t, t, t, t);
  }
  if (status) { where.push('s.status = ?'); params.push(status); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM inventory_items i WHERE i.supplier_id = s.id) AS item_count,
            (SELECT COUNT(*) FROM inventory_items i WHERE i.supplier_id = s.id AND i.status = 'active' AND i.current_stock <= i.reorder_level) AS low_stock_count,
            (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS purchase_count
       FROM suppliers s ${whereClause}
      ORDER BY s.${sortBy} ${sortDir}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [count] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM suppliers s ${whereClause}`, params);
  res.json({ success: true, ...buildPaginatedResponse(rows, count[0].total, page, limit) });
});

// GET /api/vendors/:id
export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!rows.length) throw new HttpError(404, 'Vendor not found');
  res.json({ success: true, data: rows[0] });
});

// GET /api/vendors/:id/low-stock — this vendor's items at/below reorder level (pre-fills the order message)
export const getVendorLowStock = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, item_code, name, unit, current_stock, reorder_level
       FROM inventory_items
      WHERE supplier_id = ? AND status = 'active' AND current_stock <= reorder_level
      ORDER BY name ASC`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
});

// POST /api/vendors
export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const v = clean(req.body);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO suppliers (name, contact_person, mobile, email, address, gstin, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [v.name, v.contact_person ?? null, v.mobile, v.email ?? null, v.address ?? null, v.gstin ?? null, v.status || 'active']
  );
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, message: 'Vendor created', data: rows[0] });
});

// PUT /api/vendors/:id
export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const v = clean(req.body, true);
  const keys = Object.keys(v);
  if (!keys.length) throw new HttpError(400, 'No fields to update');
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE suppliers SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    [...keys.map((k) => v[k]), req.params.id]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Vendor not found');
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Vendor updated', data: rows[0] });
});

// DELETE /api/vendors/:id
// A vendor with purchase history is protected by a foreign key — suggest deactivating instead of failing cryptically.
export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'Vendor not found');
    res.json({ success: true, message: 'Vendor deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new HttpError(409, 'This vendor has purchase records and cannot be deleted. Edit it and set Status to "Inactive" instead.');
    }
    throw err;
  }
});