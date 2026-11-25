// import { Request, Response } from 'express';
// import { pool } from '../config/db';
// import { asyncHandler, parsePagination, buildPaginatedResponse, generateCode, HttpError } from '../utils/helpers';
// import { streamInvoicePdf } from '../utils/pdfInvoice';
// import { RowDataPacket, ResultSetHeader } from 'mysql2';

// const ALLOWED_SORT = ['id', 'invoice_no', 'invoice_date', 'total_amount', 'status'];

// interface IncomingItem {
//   item_id?: number | null;
//   description: string;
//   hsn_code?: string;
//   quantity: number;
//   unit_price: number;
//   gst_rate?: number; // percentage, ignored for non_gst invoices
// }

// // GET /api/invoices
// export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
//   const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'invoice_date');
//   const { search, status, invoice_type, from_date, to_date, customer_id } = req.query as Record<string, string>;

//   const where: string[] = [];
//   const params: any[] = [];

//   if (search) {
//     where.push('(i.invoice_no LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?)');
//     const term = `%${search}%`;
//     params.push(term, term, term);
//   }
//   if (status) { where.push('i.status = ?'); params.push(status); }
//   if (invoice_type) { where.push('i.invoice_type = ?'); params.push(invoice_type); }
//   if (customer_id) { where.push('i.customer_id = ?'); params.push(customer_id); }
//   if (from_date) { where.push('i.invoice_date >= ?'); params.push(from_date); }
//   if (to_date) { where.push('i.invoice_date <= ?'); params.push(to_date); }

//   const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

//   const [rows] = await pool.query<RowDataPacket[]>(
//     `SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile
//      FROM invoices i JOIN customers c ON c.id = i.customer_id
//      ${whereClause}
//      ORDER BY ${sortBy === 'id' ? 'i.id' : `i.${sortBy}`} ${sortDir}
//      LIMIT ? OFFSET ?`,
//     [...params, limit, offset]
//   );
//   const [countRows] = await pool.query<RowDataPacket[]>(
//     `SELECT COUNT(*) AS total FROM invoices i JOIN customers c ON c.id = i.customer_id ${whereClause}`,
//     params
//   );

//   res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
// });

// // GET /api/invoices/:id
// export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
//   const [invRows] = await pool.query<RowDataPacket[]>(
//     `SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
//             c.gstin AS customer_gstin, c.address AS customer_address
//      FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
//     [req.params.id]
//   );
//   if (!invRows.length) throw new HttpError(404, 'Invoice not found');

//   const [items] = await pool.query<RowDataPacket[]>('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
//   res.json({ success: true, data: { ...invRows[0], items } });
// });

// /** Core calculation used by both create + preview. Server always recomputes — never trusts client totals. */
// function calculateTotals(items: IncomingItem[], invoiceType: 'gst' | 'non_gst', discount = 0, reward = 0) {
//   let subtotal = 0;
//   let cgst = 0;
//   let sgst = 0;
//   const computedItems = items.map((it) => {
//     const lineBase = Number(it.quantity) * Number(it.unit_price);
//     subtotal += lineBase;
//     let gstRate = 0;
//     let lineTotal = lineBase;
//     if (invoiceType === 'gst') {
//       gstRate = Number(it.gst_rate) || 0;
//       const gstAmount = (lineBase * gstRate) / 100;
//       cgst += gstAmount / 2;
//       sgst += gstAmount / 2;
//       lineTotal = lineBase + gstAmount;
//     }
//     return { ...it, gst_rate: gstRate, line_total: Number(lineTotal.toFixed(2)) };
//   });

//   const total = subtotal + cgst + sgst - Number(discount) - Number(reward);
//   return {
//     items: computedItems,
//     subtotal: Number(subtotal.toFixed(2)),
//     cgst_amount: Number(cgst.toFixed(2)),
//     sgst_amount: Number(sgst.toFixed(2)),
//     igst_amount: 0,
//     total_amount: Number(Math.max(0, total).toFixed(2)),
//   };
// }

// // POST /api/invoices/preview  — compute totals without saving (for live UI preview)
// export const previewInvoice = asyncHandler(async (req: Request, res: Response) => {
//   const { items, invoice_type, discount_amount, reward_applied } = req.body;
//   if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'At least one line item is required');
//   const result = calculateTotals(items, invoice_type === 'gst' ? 'gst' : 'non_gst', discount_amount || 0, reward_applied || 0);
//   res.json({ success: true, data: result });
// });

// // POST /api/invoices
// export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
//   const {
//     customer_id, invoice_type, invoice_date, due_date,
//     items, discount_amount, reward_applied, referral_id,
//     payment_mode, status, notes,
//   } = req.body;

//   if (!customer_id) throw new HttpError(400, 'customer_id is required');
//   if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'At least one line item is required');

//   const type = invoice_type === 'gst' ? 'gst' : 'non_gst';
//   const calc = calculateTotals(items, type, discount_amount || 0, reward_applied || 0);

//   const conn = await pool.getConnection();
//   try {
//     await conn.beginTransaction();

//     const [result] = await conn.query<ResultSetHeader>(
//       `INSERT INTO invoices
//         (invoice_no, customer_id, invoice_type, invoice_date, due_date, subtotal, cgst_amount, sgst_amount,
//          igst_amount, discount_amount, reward_applied, total_amount, status, payment_mode, notes)
//        VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         customer_id, type, invoice_date, due_date || null,
//         calc.subtotal, calc.cgst_amount, calc.sgst_amount, calc.igst_amount,
//         discount_amount || 0, reward_applied || 0, calc.total_amount,
//         status || 'unpaid', payment_mode || null, notes || null,
//       ]
//     );
//     const invoiceId = result.insertId;
//     const invoiceNo = generateCode('INV', invoiceId);
//     await conn.query('UPDATE invoices SET invoice_no = ? WHERE id = ?', [invoiceNo, invoiceId]);

//     for (const item of calc.items) {
//       await conn.query(
//         `INSERT INTO invoice_items (invoice_id, item_id, description, hsn_code, quantity, unit_price, gst_rate, line_total)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//         [invoiceId, item.item_id || null, item.description, item.hsn_code || null, item.quantity, item.unit_price, item.gst_rate, item.line_total]
//       );

//       // Deduct inventory stock if this line item is linked to an inventory item
//       if (item.item_id) {
//         const [stockRows] = await conn.query<RowDataPacket[]>(
//           'SELECT current_stock FROM inventory_items WHERE id = ? FOR UPDATE',
//           [item.item_id]
//         );
//         if (!stockRows.length) throw new HttpError(400, `Inventory item ${item.item_id} not found`);
//         const newStock = Number(stockRows[0].current_stock) - Number(item.quantity);
//         await conn.query('UPDATE inventory_items SET current_stock = ? WHERE id = ?', [newStock, item.item_id]);
//         await conn.query(
//           `INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, customer_id, notes)
//            VALUES (?, 'out', ?, 'invoice', ?, ?, 'Consumed via invoice')`,
//           [item.item_id, item.quantity, invoiceId, customer_id]
//         );
//       }
//     }

//     // Mark referral reward as used, if applied
//     if (referral_id && reward_applied) {
//       await conn.query(
//         `UPDATE referrals SET reward_status = 'used', used_on_invoice_id = ? WHERE id = ? AND reward_status = 'issued'`,
//         [invoiceId, referral_id]
//       );
//     }

//     await conn.commit();

//     const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
//     res.status(201).json({ success: true, message: 'Invoice created', data: rows[0] });
//   } catch (err) {
//     await conn.rollback();
//     throw err;
//   } finally {
//     conn.release();
//   }
// });

// // PATCH /api/invoices/:id/status
// export const updateInvoiceStatus = asyncHandler(async (req: Request, res: Response) => {
//   const { status, payment_mode } = req.body;
//   const allowed = ['draft', 'unpaid', 'paid', 'partially_paid', 'cancelled'];
//   if (!allowed.includes(status)) throw new HttpError(400, 'Invalid status');

//   const [result] = await pool.query<ResultSetHeader>(
//     'UPDATE invoices SET status = ?, payment_mode = COALESCE(?, payment_mode) WHERE id = ?',
//     [status, payment_mode || null, req.params.id]
//   );
//   if (!result.affectedRows) throw new HttpError(404, 'Invoice not found');
//   res.json({ success: true, message: 'Invoice status updated' });
// });

// // GET /api/invoices/:id/pdf
// export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
//   const [invRows] = await pool.query<RowDataPacket[]>(
//     `SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
//             c.gstin AS customer_gstin, c.address AS customer_address
//      FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
//     [req.params.id]
//   );
//   if (!invRows.length) throw new HttpError(404, 'Invoice not found');
//   const [items] = await pool.query<RowDataPacket[]>('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);

//   const inv = invRows[0];
//   streamInvoicePdf(res, {
//     invoice_no: inv.invoice_no,
//     invoice_date: new Date(inv.invoice_date).toISOString().slice(0, 10),
//     invoice_type: inv.invoice_type,
//     status: inv.status,
//     customer_name: inv.customer_name,
//     customer_mobile: inv.customer_mobile,
//     customer_email: inv.customer_email,
//     customer_gstin: inv.customer_gstin,
//     customer_address: inv.customer_address,
//     subtotal: Number(inv.subtotal),
//     cgst_amount: Number(inv.cgst_amount),
//     sgst_amount: Number(inv.sgst_amount),
//     igst_amount: Number(inv.igst_amount),
//     discount_amount: Number(inv.discount_amount),
//     reward_applied: Number(inv.reward_applied),
//     total_amount: Number(inv.total_amount),
//     items: items.map((it) => ({
//       description: it.description,
//       hsn_code: it.hsn_code,
//       quantity: Number(it.quantity),
//       unit_price: Number(it.unit_price),
//       gst_rate: Number(it.gst_rate),
//       line_total: Number(it.line_total),
//     })),
//   });
// });

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler, parsePagination, buildPaginatedResponse, generateCode, HttpError } from '../utils/helpers';
import { streamInvoicePdf } from '../utils/pdfInvoice';
import { companyInfo } from '../utils/company';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const ALLOWED_SORT = ['id', 'invoice_no', 'invoice_date', 'total_amount', 'status'];

interface IncomingItem {
  item_id?: number | null;
  description: string;
  comment?: string;
  hsn_code?: string;
  quantity: number;
  unit?: string; // Liters / KGS / NOS / PCS / SQ FT. / QTY, or any text typed manually
  unit_price: number;
  gst_rate?: number; // percentage, ignored for non_gst invoices
}

// GET /api/invoices
export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, offset, sortBy, sortDir } = parsePagination(req.query, ALLOWED_SORT, 'invoice_date');
  const { search, status, invoice_type, from_date, to_date, customer_id } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];

  if (search) {
    where.push('(i.invoice_no LIKE ? OR c.name LIKE ? OR c.mobile LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (status) { where.push('i.status = ?'); params.push(status); }
  if (invoice_type) { where.push('i.invoice_type = ?'); params.push(invoice_type); }
  if (customer_id) { where.push('i.customer_id = ?'); params.push(customer_id); }
  if (from_date) { where.push('i.invoice_date >= ?'); params.push(from_date); }
  if (to_date) { where.push('i.invoice_date <= ?'); params.push(to_date); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile
     FROM invoices i JOIN customers c ON c.id = i.customer_id
     ${whereClause}
     ORDER BY ${sortBy === 'id' ? 'i.id' : `i.${sortBy}`} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM invoices i JOIN customers c ON c.id = i.customer_id ${whereClause}`,
    params
  );

  res.json({ success: true, ...buildPaginatedResponse(rows, countRows[0].total, page, limit) });
});

// GET /api/invoices/:id
export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
            c.gstin AS customer_gstin, c.address AS customer_address
     FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!invRows.length) throw new HttpError(404, 'Invoice not found');

  const [items] = await pool.query<RowDataPacket[]>('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
  res.json({ success: true, data: { ...invRows[0], items, company: companyInfo() } });
});

/** Core calculation used by both create + preview. Server always recomputes — never trusts client totals. */
function calculateTotals(items: IncomingItem[], invoiceType: 'gst' | 'non_gst', discount = 0, reward = 0) {
  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  const computedItems = items.map((it) => {
    const lineBase = Number(it.quantity) * Number(it.unit_price);
    subtotal += lineBase;
    let gstRate = 0;
    let lineTotal = lineBase;
    if (invoiceType === 'gst') {
      gstRate = Number(it.gst_rate) || 0;
      const gstAmount = (lineBase * gstRate) / 100;
      cgst += gstAmount / 2;
      sgst += gstAmount / 2;
      lineTotal = lineBase + gstAmount;
    }
    return { ...it, gst_rate: gstRate, line_total: Number(lineTotal.toFixed(2)) };
  });

  const total = subtotal + cgst + sgst - Number(discount) - Number(reward);
  return {
    items: computedItems,
    subtotal: Number(subtotal.toFixed(2)),
    cgst_amount: Number(cgst.toFixed(2)),
    sgst_amount: Number(sgst.toFixed(2)),
    igst_amount: 0,
    total_amount: Number(Math.max(0, total).toFixed(2)),
  };
}

// POST /api/invoices/preview  — compute totals without saving (for live UI preview)
export const previewInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { items, invoice_type, discount_amount, reward_applied } = req.body;
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'At least one line item is required');
  const result = calculateTotals(items, invoice_type === 'gst' ? 'gst' : 'non_gst', discount_amount || 0, reward_applied || 0);
  res.json({ success: true, data: result });
});

// POST /api/invoices
export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const {
    customer_id, invoice_type, invoice_date, due_date,
    items, discount_amount, reward_applied, referral_id,
    payment_mode, status, notes,
  } = req.body;

  if (!customer_id) throw new HttpError(400, 'customer_id is required');
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'At least one line item is required');

  if (items.some((it: IncomingItem) => !String(it.description || '').trim() || !(Number(it.quantity) > 0) || Number(it.unit_price) < 0 || Number.isNaN(Number(it.unit_price)))) {
    throw new HttpError(400, 'Every line item needs a description, a quantity above 0 and a valid price');
  }

  const type = invoice_type === 'gst' ? 'gst' : 'non_gst';
  const calc = calculateTotals(items, type, discount_amount || 0, reward_applied || 0);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO invoices
        (invoice_no, customer_id, invoice_type, invoice_date, due_date, subtotal, cgst_amount, sgst_amount,
         igst_amount, discount_amount, reward_applied, total_amount, status, payment_mode, notes)
       VALUES ('TEMP', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id, type, invoice_date, due_date || null,
        calc.subtotal, calc.cgst_amount, calc.sgst_amount, calc.igst_amount,
        discount_amount || 0, reward_applied || 0, calc.total_amount,
        status || 'unpaid', payment_mode || null, notes || null,
      ]
    );
    const invoiceId = result.insertId;
    const invoiceNo = generateCode('INV', invoiceId);
    await conn.query('UPDATE invoices SET invoice_no = ? WHERE id = ?', [invoiceNo, invoiceId]);

    for (const item of calc.items) {
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, comment, hsn_code, quantity, unit, unit_price, gst_rate, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId, item.item_id || null, item.description,
          item.comment ? String(item.comment).trim().slice(0, 255) : null,
          item.hsn_code || null, item.quantity,
          item.unit ? String(item.unit).trim().slice(0, 20) : null,
          item.unit_price, item.gst_rate, item.line_total,
        ]
      );

      // Deduct inventory stock if this line item is linked to an inventory item
      if (item.item_id) {
        const [stockRows] = await conn.query<RowDataPacket[]>(
          'SELECT current_stock FROM inventory_items WHERE id = ? FOR UPDATE',
          [item.item_id]
        );
        if (!stockRows.length) throw new HttpError(400, `Inventory item ${item.item_id} not found`);
        const newStock = Number(stockRows[0].current_stock) - Number(item.quantity);
        await conn.query('UPDATE inventory_items SET current_stock = ? WHERE id = ?', [newStock, item.item_id]);
        await conn.query(
          `INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, customer_id, notes)
           VALUES (?, 'out', ?, 'invoice', ?, ?, 'Consumed via invoice')`,
          [item.item_id, item.quantity, invoiceId, customer_id]
        );
      }
    }

    // Mark referral reward as used, if applied
    if (referral_id && reward_applied) {
      await conn.query(
        `UPDATE referrals SET reward_status = 'used', used_on_invoice_id = ? WHERE id = ? AND reward_status = 'issued'`,
        [invoiceId, referral_id]
      );
    }

    await conn.commit();

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    res.status(201).json({ success: true, message: 'Invoice created', data: rows[0] });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// PATCH /api/invoices/:id/status
export const updateInvoiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, payment_mode } = req.body;
  const allowed = ['draft', 'unpaid', 'paid', 'partially_paid', 'cancelled'];
  if (!allowed.includes(status)) throw new HttpError(400, 'Invalid status');

  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE invoices SET status = ?, payment_mode = COALESCE(?, payment_mode) WHERE id = ?',
    [status, payment_mode || null, req.params.id]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Invoice not found');
  res.json({ success: true, message: 'Invoice status updated' });
});

// GET /api/invoices/:id/pdf
export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const [invRows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email,
            c.gstin AS customer_gstin, c.address AS customer_address
     FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!invRows.length) throw new HttpError(404, 'Invoice not found');
  const [items] = await pool.query<RowDataPacket[]>('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);

  const inv = invRows[0];
  streamInvoicePdf(res, {
    invoice_no: inv.invoice_no,
    invoice_date: new Date(inv.invoice_date).toISOString().slice(0, 10),
    invoice_type: inv.invoice_type,
    status: inv.status,
    customer_name: inv.customer_name,
    customer_mobile: inv.customer_mobile,
    customer_email: inv.customer_email,
    customer_gstin: inv.customer_gstin,
    customer_address: inv.customer_address,
    subtotal: Number(inv.subtotal),
    cgst_amount: Number(inv.cgst_amount),
    sgst_amount: Number(inv.sgst_amount),
    igst_amount: Number(inv.igst_amount),
    discount_amount: Number(inv.discount_amount),
    reward_applied: Number(inv.reward_applied),
    total_amount: Number(inv.total_amount),
    items: items.map((it) => ({
      description: it.description,
      comment: it.comment,
      hsn_code: it.hsn_code,
      quantity: Number(it.quantity),
      unit: it.unit,
      unit_price: Number(it.unit_price),
      gst_rate: Number(it.gst_rate),
      line_total: Number(it.line_total),
    })),
  });
});