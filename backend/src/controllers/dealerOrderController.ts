import { Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, generateCode, HttpError } from '../utils/helpers';
import { AuthedRequest } from '../middleware/auth';
import { companyInfo } from '../utils/company';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

export const ORDER_STATUSES = ['placed', 'confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'cancelled'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const ALLOWED_SORT = ['id', 'order_no', 'dealer_name', 'order_date', 'delivery_date', 'status', 'updated_at'];

// Dates are returned as plain 'YYYY-MM-DD' strings so they never shift a day between server and browser time zones.
const DATE_COLS = `DATE_FORMAT(o.order_date, '%Y-%m-%d') AS order_date, DATE_FORMAT(o.delivery_date, '%Y-%m-%d') AS delivery_date`;
const OVERDUE = `(o.delivery_date IS NOT NULL AND o.delivery_date < CURDATE() AND o.status NOT IN ('delivered','cancelled'))`;

interface IncomingItem { product?: string; quantity?: number | string; unit?: string; unit_price?: number | string | null; }

/** Validates + normalises line items. Price is OPTIONAL: blank/missing/null -> NULL, which the UI and print view show as "--". */
function cleanItems(items: any): { product: string; quantity: number; unit: string | null; unit_price: number | null }[] {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Add at least one product');
  return items.map((it: IncomingItem, i: number) => {
    const product = String(it.product ?? '').trim();
    const quantity = Number(it.quantity);
    if (!product) throw new HttpError(400, `Line ${i + 1}: product is required`);
    if (!(quantity > 0)) throw new HttpError(400, `Line ${i + 1}: quantity must be greater than 0`);
    let unit_price: number | null = null;
    if (it.unit_price !== undefined && it.unit_price !== null && String(it.unit_price).trim() !== '') {
      unit_price = Number(it.unit_price);
      if (Number.isNaN(unit_price) || unit_price < 0) throw new HttpError(400, `Line ${i + 1}: price must be 0 or more (or leave it blank)`);
    }
    const unit = String(it.unit ?? '').trim();
    return { product: product.slice(0, 255), quantity, unit: unit ? unit.slice(0, 20) : null, unit_price };
  });
}

function cleanHeader(body: any) {
  const dealer_name = String(body.dealer_name ?? '').trim();
  if (!dealer_name) throw new HttpError(400, 'Dealer name is required');
  const dealer_mobile = String(body.dealer_mobile ?? '').trim();
  if (dealer_mobile && !/^[6-9]\d{9}$/.test(dealer_mobile)) throw new HttpError(400, 'Enter a valid 10-digit dealer mobile number');
  const order_date = String(body.order_date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(order_date)) throw new HttpError(400, 'Order date is required');
  const delivery_date = body.delivery_date ? String(body.delivery_date).slice(0, 10) : null;
  if (delivery_date && !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)) throw new HttpError(400, 'Invalid delivery date');
  if (delivery_date && delivery_date < order_date) throw new HttpError(400, 'Delivery date cannot be before the order date');
  const addr = String(body.dealer_address ?? '').trim();
  const notes = String(body.notes ?? '').trim();
  return {
    dealer_name: dealer_name.slice(0, 150),
    dealer_mobile: dealer_mobile || null,
    dealer_address: addr ? addr.slice(0, 255) : null,
    order_date,
    delivery_date,
    notes: notes ? notes.slice(0, 255) : null,
  };
}

async function loadOrder(id: number | string) {
  const [orders] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no, o.dealer_name, o.dealer_mobile, o.dealer_address, ${DATE_COLS},
            o.status, o.notes, o.created_by_name, o.created_at, o.updated_at, ${OVERDUE} AS is_overdue
       FROM dealer_orders o WHERE o.id = ?`,
    [id]
  );
  if (!orders.length) throw new HttpError(404, 'Dealer order not found');
  const [items] = await pool.query<RowDataPacket[]>('SELECT * FROM dealer_order_items WHERE order_id = ? ORDER BY id ASC', [id]);
  const [tracking] = await pool.query<RowDataPacket[]>('SELECT * FROM dealer_order_tracking WHERE order_id = ? ORDER BY id ASC', [id]);
  return { ...orders[0], items, tracking, company: companyInfo() };
}

async function writeItems(conn: PoolConnection, orderId: number, items: ReturnType<typeof cleanItems>) {
  for (const it of items) {
    await conn.query(
      'INSERT INTO dealer_order_items (order_id, product, quantity, unit, unit_price) VALUES (?, ?, ?, ?, ?)',
      [orderId, it.product, it.quantity, it.unit, it.unit_price]
    );
  }
}

// GET /api/dealer-orders?search=&status=&from_date=&to_date=&overdue=true
export const listDealerOrders = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'id');
  const { search, status, from_date, to_date, overdue } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];
  if (search) {
    where.push('(o.order_no LIKE ? OR o.dealer_name LIKE ? OR o.dealer_mobile LIKE ?)');
    const t = `%${search}%`;
    params.push(t, t, t);
  }
  if (status) {
    if (status === 'open') where.push(`o.status NOT IN ('delivered','cancelled')`);
    else if ((ORDER_STATUSES as readonly string[]).includes(status)) { where.push('o.status = ?'); params.push(status); }
  }
  if (from_date) { where.push('o.order_date >= ?'); params.push(from_date); }
  if (to_date) { where.push('o.order_date <= ?'); params.push(to_date); }
  if (overdue === 'true') where.push(OVERDUE);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no, o.dealer_name, o.dealer_mobile, ${DATE_COLS}, o.status, o.notes, ${OVERDUE} AS is_overdue,
            (SELECT COUNT(*) FROM dealer_order_items i WHERE i.order_id = o.id) AS item_count,
            (SELECT COALESCE(SUM(i.quantity * i.unit_price), 0) FROM dealer_order_items i WHERE i.order_id = o.id AND i.unit_price IS NOT NULL) AS priced_total,
            (SELECT COUNT(*) FROM dealer_order_items i WHERE i.order_id = o.id AND i.unit_price IS NULL) AS unpriced_count,
            (SELECT GROUP_CONCAT(CONCAT(i.product, ' ×', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM i.quantity)), IFNULL(CONCAT(' ', i.unit), '')) ORDER BY i.id SEPARATOR ', ')
               FROM dealer_order_items i WHERE i.order_id = o.id) AS products_summary
       FROM dealer_orders o ${whereClause}
      ORDER BY o.${sortBy} ${sortDir}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [count] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM dealer_orders o ${whereClause}`, params);
  res.json({ success: true, ...buildPaginatedResponse(rows, count[0].total, page, limit) });
});

// GET /api/dealer-orders/summary — counts per status for the Order Tracking board
export const trackingSummary = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT status, COUNT(*) AS n FROM dealer_orders GROUP BY status`);
  const [[od]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM dealer_orders o WHERE ${OVERDUE}`);
  const counts: Record<string, number> = {};
  ORDER_STATUSES.forEach((s) => (counts[s] = 0));
  rows.forEach((r) => (counts[r.status] = Number(r.n)));
  res.json({ success: true, data: { counts, overdue: Number(od.n) } });
});

// GET /api/dealer-orders/dealers — previously used dealers, to auto-fill the form
export const listKnownDealers = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.dealer_name, o.dealer_mobile, o.dealer_address
       FROM dealer_orders o
       JOIN (SELECT dealer_name, MAX(id) AS last_id FROM dealer_orders GROUP BY dealer_name) l ON l.last_id = o.id
      ORDER BY o.dealer_name ASC LIMIT 500`
  );
  res.json({ success: true, data: rows });
});

// GET /api/dealer-orders/:id
export const getDealerOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await loadOrder(req.params.id) });
});

// POST /api/dealer-orders
export const createDealerOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const h = cleanHeader(req.body);
  const items = cleanItems(req.body.items);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO dealer_orders (order_no, dealer_name, dealer_mobile, dealer_address, order_date, delivery_date, notes, status, created_by_name)
       VALUES ('TEMP', ?, ?, ?, ?, ?, ?, 'placed', ?)`,
      [h.dealer_name, h.dealer_mobile, h.dealer_address, h.order_date, h.delivery_date, h.notes, req.user?.name || null]
    );
    const id = ins.insertId;
    await conn.query('UPDATE dealer_orders SET order_no = ? WHERE id = ?', [generateCode('DO', id), id]);
    await writeItems(conn, id, items);
    await conn.query(
      `INSERT INTO dealer_order_tracking (order_id, status, note, created_by_name) VALUES (?, 'placed', 'Order placed', ?)`,
      [id, req.user?.name || null]
    );
    await conn.commit();
    res.status(201).json({ success: true, message: 'Dealer order created', data: await loadOrder(id) });
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
});

// PUT /api/dealer-orders/:id — edits the header and replaces the product lines
export const updateDealerOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const h = cleanHeader(req.body);
  const items = cleanItems(req.body.items);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [upd] = await conn.query<ResultSetHeader>(
      `UPDATE dealer_orders SET dealer_name = ?, dealer_mobile = ?, dealer_address = ?, order_date = ?, delivery_date = ?, notes = ? WHERE id = ?`,
      [h.dealer_name, h.dealer_mobile, h.dealer_address, h.order_date, h.delivery_date, h.notes, req.params.id]
    );
    if (!upd.affectedRows) {
      // affectedRows is 0 both for "no such row" and, rarely, "nothing changed" — check which.
      const [exists] = await conn.query<RowDataPacket[]>('SELECT id FROM dealer_orders WHERE id = ?', [req.params.id]);
      if (!exists.length) throw new HttpError(404, 'Dealer order not found');
    }
    await conn.query('DELETE FROM dealer_order_items WHERE order_id = ?', [req.params.id]);
    await writeItems(conn, Number(req.params.id), items);
    await conn.query('UPDATE dealer_orders SET updated_at = NOW() WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'Dealer order updated', data: await loadOrder(req.params.id) });
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
});

// DELETE /api/dealer-orders/:id  (items and tracking history are removed with it)
export const deleteDealerOrder = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM dealer_orders WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) throw new HttpError(404, 'Dealer order not found');
  res.json({ success: true, message: 'Dealer order deleted' });
});

// POST /api/dealer-orders/:id/tracking — move the order to a new stage (adds a timeline entry)
export const addTrackingEvent = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const status = req.body.status as OrderStatus;
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, 'Invalid status');
  const note = String(req.body.note ?? '').trim().slice(0, 255) || null;
  const reference = String(req.body.reference ?? '').trim().slice(0, 100) || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>('SELECT status FROM dealer_orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) throw new HttpError(404, 'Dealer order not found');
    if (rows[0].status === status && !note && !reference) {
      throw new HttpError(400, `The order is already "${status.replace(/_/g, ' ')}". Add a note or reference to log an update.`);
    }
    await conn.query(
      'INSERT INTO dealer_order_tracking (order_id, status, note, reference, created_by_name) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, status, note, reference, req.user?.name || null]
    );
    await conn.query('UPDATE dealer_orders SET status = ? WHERE id = ?', [status, req.params.id]);
    await conn.commit();
    res.status(201).json({ success: true, message: 'Tracking updated', data: await loadOrder(req.params.id) });
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
});