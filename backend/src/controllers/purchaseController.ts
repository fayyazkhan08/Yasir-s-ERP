import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, generateCode, HttpError } from '../utils/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ---------------- Suppliers ----------------

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query as Record<string, string>;
  const where = search ? 'WHERE name LIKE ? OR mobile LIKE ?' : '';
  const params = search ? [`%${search}%`, `%${search}%`] : [];
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM suppliers ${where} ORDER BY name ASC`, params);
  res.json({ success: true, data: rows });
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const { name, contact_person, mobile, email, address, gstin } = req.body;
  if (!name) throw new HttpError(400, 'Supplier name is required');
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO suppliers (name, contact_person, mobile, email, address, gstin) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, contact_person || null, mobile || null, email || null, address || null, gstin || null]
  );
  res.status(201).json({ success: true, message: 'Supplier created', data: { id: result.insertId } });
});

// ---------------- Purchases (Inward) ----------------

const ALLOWED_SORT = ['id', 'purchase_date', 'total_amount', 'purchase_no'];

// GET /api/purchases?search=&supplier_id=&from_date=&to_date=
export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'purchase_date');
  const { search, supplier_id, from_date, to_date } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];
  if (search) { where.push('(p.purchase_no LIKE ? OR s.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (supplier_id) { where.push('p.supplier_id = ?'); params.push(supplier_id); }
  if (from_date) { where.push('p.purchase_date >= ?'); params.push(from_date); }
  if (to_date) { where.push('p.purchase_date <= ?'); params.push(to_date); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*, s.name AS supplier_name
     FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
     ${whereClause}
     ORDER BY p.${sortBy} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM purchases p JOIN suppliers s ON s.id = p.supplier_id ${whereClause}`,
    params
  );
  res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
});

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.*, s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`,
    [req.params.id]
  );
  if (!rows.length) throw new HttpError(404, 'Purchase not found');
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT pi.*, i.name AS item_name, i.unit FROM purchase_items pi
     JOIN inventory_items i ON i.id = pi.item_id WHERE pi.purchase_id = ?`,
    [req.params.id]
  );
  res.json({ success: true, data: { ...rows[0], items } });
});

// POST /api/purchases  — records inward stock, increments inventory, logs stock movement
export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  const { supplier_id, purchase_date, items, notes } = req.body;
  if (!supplier_id || !Array.isArray(items) || !items.length) {
    throw new HttpError(400, 'supplier_id and at least one item are required');
  }

  const total = items.reduce((sum: number, it: any) => sum + Number(it.quantity) * Number(it.unit_price), 0);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO purchases (purchase_no, supplier_id, purchase_date, total_amount, notes)
       VALUES ('TEMP', ?, ?, ?, ?)`,
      [supplier_id, purchase_date, total.toFixed(2), notes || null]
    );
    const purchaseId = result.insertId;
    const purchaseNo = generateCode('PO', purchaseId);
    await conn.query('UPDATE purchases SET purchase_no = ? WHERE id = ?', [purchaseNo, purchaseId]);

    for (const item of items) {
      const lineTotal = Number(item.quantity) * Number(item.unit_price);
      await conn.query(
        `INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, item.item_id, item.quantity, item.unit_price, lineTotal.toFixed(2)]
      );

      const [stockRows] = await conn.query<RowDataPacket[]>(
        'SELECT current_stock FROM inventory_items WHERE id = ? FOR UPDATE', [item.item_id]
      );
      if (!stockRows.length) throw new HttpError(400, `Inventory item ${item.item_id} not found`);
      const newStock = Number(stockRows[0].current_stock) + Number(item.quantity);
      await conn.query('UPDATE inventory_items SET current_stock = ?, unit_price = ? WHERE id = ?', [newStock, item.unit_price, item.item_id]);

      await conn.query(
        `INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, notes)
         VALUES (?, 'in', ?, 'purchase', ?, 'Inward stock purchase')`,
        [item.item_id, item.quantity, purchaseId]
      );
    }

    await conn.commit();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
    res.status(201).json({ success: true, message: 'Purchase recorded and stock updated', data: rows[0] });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});
