// import { Request, Response } from 'express';
// import { pool } from '../config/db';
// import { asyncHandler, parsePagination, buildPaginatedResponse, generateCode, HttpError } from '../utils/helpers';
// import { RowDataPacket, ResultSetHeader } from 'mysql2';

// const ALLOWED_SORT = ['id', 'name', 'current_stock', 'reorder_level', 'category', 'updated_at'];

// // GET /api/inventory?search=&category=&lowStockOnly=
// export const listInventory = asyncHandler(async (req: Request, res: Response) => {
//   const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'name');
//   const { search, category, lowStockOnly } = req.query as Record<string, string>;

//   const where: string[] = [];
//   const params: any[] = [];
//   if (search) { where.push('(i.name LIKE ? OR i.item_code LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
//   if (category) { where.push('i.category = ?'); params.push(category); }
//   if (lowStockOnly === 'true') { where.push('i.current_stock <= i.reorder_level'); }
//   const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

//   const [rows] = await pool.query<RowDataPacket[]>(
//     `SELECT i.*, s.name AS supplier_name,
//             (i.current_stock <= i.reorder_level) AS is_low_stock
//      FROM inventory_items i
//      LEFT JOIN suppliers s ON s.id = i.supplier_id
//      ${whereClause}
//      ORDER BY i.${sortBy} ${sortDir}
//      LIMIT ? OFFSET ?`,
//     [...params, limit, offset]
//   );
//   const [countRows] = await pool.query<RowDataPacket[]>(
//     `SELECT COUNT(*) AS total FROM inventory_items i ${whereClause}`,
//     params
//   );
//   res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
// });

// // GET /api/inventory/low-stock  — dashboard alert feed
// export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
//   const [rows] = await pool.query<RowDataPacket[]>(
//     `SELECT id, item_code, name, category, unit, current_stock, reorder_level
//      FROM inventory_items WHERE current_stock <= reorder_level AND status = 'active'
//      ORDER BY (current_stock / NULLIF(reorder_level,0)) ASC`
//   );
//   res.json({ success: true, data: rows, count: rows.length });
// });

// // GET /api/inventory/:id  (includes recent stock movement history)
// export const getInventoryItem = asyncHandler(async (req: Request, res: Response) => {
//   const [rows] = await pool.query<RowDataPacket[]>(
//     `SELECT i.*, s.name AS supplier_name FROM inventory_items i
//      LEFT JOIN suppliers s ON s.id = i.supplier_id WHERE i.id = ?`,
//     [req.params.id]
//   );
//   if (!rows.length) throw new HttpError(404, 'Inventory item not found');

//   const [movements] = await pool.query<RowDataPacket[]>(
//     `SELECT sm.*, c.name AS customer_name FROM stock_movements sm
//      LEFT JOIN customers c ON c.id = sm.customer_id
//      WHERE sm.item_id = ? ORDER BY sm.created_at DESC LIMIT 50`,
//     [req.params.id]
//   );
//   res.json({ success: true, data: { ...rows[0], movements } });
// });

// // POST /api/inventory
// export const createInventoryItem = asyncHandler(async (req: Request, res: Response) => {
//   const { name, category, unit, current_stock, reorder_level, unit_price, supplier_id } = req.body;
//   if (!name || !unit) throw new HttpError(400, 'name and unit are required');

//   const [result] = await pool.query<ResultSetHeader>(
//     `INSERT INTO inventory_items (item_code, name, category, unit, current_stock, reorder_level, unit_price, supplier_id)
//      VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?)`,
//     [name, category || 'raw_material', unit, current_stock || 0, reorder_level || 0, unit_price || 0, supplier_id || null]
//   );
//   const prefix = category === 'finished_product' ? 'FP' : category === 'packaging' ? 'PK' : 'RM';
//   const code = generateCode(prefix, result.insertId);
//   await pool.query('UPDATE inventory_items SET item_code = ? WHERE id = ?', [code, result.insertId]);

//   const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ?', [result.insertId]);
//   res.status(201).json({ success: true, message: 'Inventory item created', data: rows[0] });
// });

// // PUT /api/inventory/:id
// export const updateInventoryItem = asyncHandler(async (req: Request, res: Response) => {
//   const fields = ['name', 'category', 'unit', 'reorder_level', 'unit_price', 'supplier_id', 'status'];
//   const updates: string[] = [];
//   const params: any[] = [];
//   for (const f of fields) {
//     if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
//   }
//   if (!updates.length) throw new HttpError(400, 'No fields to update');
//   params.push(req.params.id);

//   const [result] = await pool.query<ResultSetHeader>(
//     `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`, params
//   );
//   if (!result.affectedRows) throw new HttpError(404, 'Inventory item not found');
//   const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
//   res.json({ success: true, message: 'Inventory item updated', data: rows[0] });
// });

// // POST /api/inventory/:id/adjust  — manual stock adjustment (stock take, damage, correction)
// export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
//   const { quantity, notes } = req.body; // signed: positive to add, negative to remove
//   if (quantity === undefined) throw new HttpError(400, 'quantity is required');

//   const conn = await pool.getConnection();
//   try {
//     await conn.beginTransaction();
//     const [rows] = await conn.query<RowDataPacket[]>('SELECT current_stock FROM inventory_items WHERE id = ? FOR UPDATE', [req.params.id]);
//     if (!rows.length) throw new HttpError(404, 'Inventory item not found');

//     const newStock = Number(rows[0].current_stock) + Number(quantity);
//     if (newStock < 0) throw new HttpError(400, 'Resulting stock cannot be negative');

//     await conn.query('UPDATE inventory_items SET current_stock = ? WHERE id = ?', [newStock, req.params.id]);
//     await conn.query(
//       `INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, notes)
//        VALUES (?, 'adjustment', ?, 'manual', ?)`,
//       [req.params.id, Math.abs(quantity), notes || 'Manual stock adjustment']
//     );
//     await conn.commit();
//     res.json({ success: true, message: 'Stock adjusted', data: { current_stock: newStock } });
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// });

// // DELETE /api/inventory/:id
// export const deleteInventoryItem = asyncHandler(async (req: Request, res: Response) => {
//   const [result] = await pool.query<ResultSetHeader>('DELETE FROM inventory_items WHERE id = ?', [req.params.id]);
//   if (!result.affectedRows) throw new HttpError(404, 'Inventory item not found');
//   res.json({ success: true, message: 'Inventory item deleted' });
// });


import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, generateCode, HttpError } from '../utils/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const ALLOWED_SORT = ['id', 'name', 'current_stock', 'reorder_level', 'category', 'updated_at'];

// GET /api/inventory?search=&category=&lowStockOnly=
export const listInventory = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'name');
  const { search, category, lowStockOnly } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];
  if (search) { where.push('(i.name LIKE ? OR i.item_code LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category) { where.push('i.category = ?'); params.push(category); }
  if (lowStockOnly === 'true') { where.push('i.current_stock <= i.reorder_level'); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, s.name AS supplier_name,
            (i.current_stock <= i.reorder_level) AS is_low_stock
     FROM inventory_items i
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     ${whereClause}
     ORDER BY i.${sortBy} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM inventory_items i ${whereClause}`,
    params
  );
  res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
});

// GET /api/inventory/low-stock  — dashboard alert feed
export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, item_code, name, category, unit, current_stock, reorder_level, supplier_id
     FROM inventory_items WHERE current_stock <= reorder_level AND status = 'active'
     ORDER BY (current_stock / NULLIF(reorder_level,0)) ASC`
  );
  res.json({ success: true, data: rows, count: rows.length });
});

// GET /api/inventory/suppliers — id + name only, for the "Supplier" dropdown in the item form.
// Lives here (not under /vendors) so Staff, who can manage inventory but not the Vendors module, can still pick one.
export const listSupplierOptions = asyncHandler(async (_req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name FROM suppliers WHERE status = 'active' ORDER BY name ASC`
  );
  res.json({ success: true, data: rows });
});

// GET /api/inventory/:id  (includes recent stock movement history)
export const getInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, s.name AS supplier_name FROM inventory_items i
     LEFT JOIN suppliers s ON s.id = i.supplier_id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!rows.length) throw new HttpError(404, 'Inventory item not found');

  const [movements] = await pool.query<RowDataPacket[]>(
    `SELECT sm.*, c.name AS customer_name FROM stock_movements sm
     LEFT JOIN customers c ON c.id = sm.customer_id
     WHERE sm.item_id = ? ORDER BY sm.created_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json({ success: true, data: { ...rows[0], movements } });
});

// POST /api/inventory
export const createInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const { name, category, unit, current_stock, reorder_level, unit_price, supplier_id } = req.body;
  if (!name || !String(name).trim() || !unit || !String(unit).trim()) throw new HttpError(400, 'name and unit are required');
  for (const [k, v] of Object.entries({ current_stock, reorder_level, unit_price })) {
    if (v !== undefined && (Number.isNaN(Number(v)) || Number(v) < 0)) throw new HttpError(400, `${k.replace('_', ' ')} must be 0 or more`);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory_items (item_code, name, category, unit, current_stock, reorder_level, unit_price, supplier_id)
     VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?)`,
    [String(name).trim(), category || 'raw_material', String(unit).trim(), current_stock || 0, reorder_level || 0, unit_price || 0, supplier_id || null]
  );
  const prefix = category === 'finished_product' ? 'FP' : category === 'packaging' ? 'PK' : 'RM';
  const code = generateCode(prefix, result.insertId);
  await pool.query('UPDATE inventory_items SET item_code = ? WHERE id = ?', [code, result.insertId]);

  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, message: 'Inventory item created', data: rows[0] });
});

// PUT /api/inventory/:id
// Stock level is deliberately NOT editable here — it changes only through purchases, invoices and
// "Adjust Stock", so every change leaves a stock_movements record.
export const updateInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const fields = ['name', 'category', 'unit', 'reorder_level', 'unit_price', 'supplier_id', 'status'];
  const body = { ...req.body };

  if (body.supplier_id === '' || body.supplier_id === 0 || body.supplier_id === '0') body.supplier_id = null;
  if (body.name !== undefined && !String(body.name).trim()) throw new HttpError(400, 'Item name cannot be empty');
  if (body.unit !== undefined && !String(body.unit).trim()) throw new HttpError(400, 'Unit cannot be empty');
  if (body.category !== undefined && !['raw_material', 'finished_product', 'packaging', 'other'].includes(body.category)) {
    throw new HttpError(400, 'Invalid category');
  }
  if (body.status !== undefined && !['active', 'discontinued'].includes(body.status)) throw new HttpError(400, 'Invalid status');
  for (const n of ['reorder_level', 'unit_price']) {
    if (body[n] !== undefined && (Number.isNaN(Number(body[n])) || Number(body[n]) < 0)) throw new HttpError(400, `${n.replace('_', ' ')} must be 0 or more`);
  }

  const updates: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (body[f] !== undefined) { updates.push(`${f} = ?`); params.push(typeof body[f] === 'string' ? body[f].trim() : body[f]); }
  }
  if (!updates.length) throw new HttpError(400, 'No fields to update');
  params.push(req.params.id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`, params
  );
  if (!result.affectedRows) throw new HttpError(404, 'Inventory item not found');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, s.name AS supplier_name FROM inventory_items i LEFT JOIN suppliers s ON s.id = i.supplier_id WHERE i.id = ?`,
    [req.params.id]
  );
  res.json({ success: true, message: 'Inventory item updated', data: rows[0] });
});

// POST /api/inventory/:id/adjust  — manual stock adjustment (stock take, damage, correction)
export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const { quantity, notes } = req.body; // signed: positive to add, negative to remove
  if (quantity === undefined) throw new HttpError(400, 'quantity is required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>('SELECT current_stock FROM inventory_items WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) throw new HttpError(404, 'Inventory item not found');

    const newStock = Number(rows[0].current_stock) + Number(quantity);
    if (newStock < 0) throw new HttpError(400, 'Resulting stock cannot be negative');

    await conn.query('UPDATE inventory_items SET current_stock = ? WHERE id = ?', [newStock, req.params.id]);
    await conn.query(
      `INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, notes)
       VALUES (?, 'adjustment', ?, 'manual', ?)`,
      [req.params.id, Math.abs(quantity), notes || 'Manual stock adjustment']
    );
    await conn.commit();
    res.json({ success: true, message: 'Stock adjusted', data: { current_stock: newStock } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// DELETE /api/inventory/:id
// An item that already appears on a purchase can't be hard-deleted (purchase_items keeps a foreign key to it,
// which protects your purchase history). In that case tell the user to mark it Discontinued instead.
export const deleteInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM inventory_items WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) throw new HttpError(404, 'Inventory item not found');
    res.json({ success: true, message: 'Inventory item deleted' });
  } catch (err: any) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      throw new HttpError(
        409,
        'This item is used in purchase records and cannot be deleted. Edit it and set Status to "Discontinued" to hide it instead.'
      );
    }
    throw err;
  }
});