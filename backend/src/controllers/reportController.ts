import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../config/db';
import { asyncHandler, HttpError } from '../utils/helpers';
import { RowDataPacket } from 'mysql2';

type ExportType = 'customers' | 'invoices' | 'inventory' | 'purchases' | 'subscriptions' | 'referrals';

const EXPORT_QUERIES: Record<ExportType, (params: any) => { sql: string; args: any[] }> = {
  customers: ({ status, from_date, to_date }) => {
    const where: string[] = [];
    const args: any[] = [];
    if (status) { where.push('status = ?'); args.push(status); }
    if (from_date) { where.push('created_at >= ?'); args.push(from_date); }
    if (to_date) { where.push('created_at <= ?'); args.push(to_date); }
    return {
      sql: `SELECT customer_code, name, mobile, email, gstin, city, state, status, created_at
            FROM customers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`,
      args,
    };
  },
  invoices: ({ status, invoice_type, from_date, to_date }) => {
    const where: string[] = [];
    const args: any[] = [];
    if (status) { where.push('i.status = ?'); args.push(status); }
    if (invoice_type) { where.push('i.invoice_type = ?'); args.push(invoice_type); }
    if (from_date) { where.push('i.invoice_date >= ?'); args.push(from_date); }
    if (to_date) { where.push('i.invoice_date <= ?'); args.push(to_date); }
    return {
      sql: `SELECT i.invoice_no, c.name AS customer, i.invoice_type, i.invoice_date, i.subtotal,
                   i.cgst_amount, i.sgst_amount, i.discount_amount, i.total_amount, i.status
            FROM invoices i JOIN customers c ON c.id = i.customer_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.invoice_date DESC`,
      args,
    };
  },
  inventory: ({ category, lowStockOnly }) => {
    const where: string[] = [];
    const args: any[] = [];
    if (category) { where.push('category = ?'); args.push(category); }
    if (lowStockOnly === 'true') { where.push('current_stock <= reorder_level'); }
    return {
      sql: `SELECT item_code, name, category, unit, current_stock, reorder_level, unit_price, status
            FROM inventory_items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name ASC`,
      args,
    };
  },
  purchases: ({ from_date, to_date, supplier_id }) => {
    const where: string[] = [];
    const args: any[] = [];
    if (from_date) { where.push('p.purchase_date >= ?'); args.push(from_date); }
    if (to_date) { where.push('p.purchase_date <= ?'); args.push(to_date); }
    if (supplier_id) { where.push('p.supplier_id = ?'); args.push(supplier_id); }
    return {
      sql: `SELECT p.purchase_no, s.name AS supplier, p.purchase_date, p.total_amount, p.status
            FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.purchase_date DESC`,
      args,
    };
  },
  subscriptions: ({ status }) => {
    const where: string[] = [];
    const args: any[] = [];
    if (status) { where.push('cs.status = ?'); args.push(status); }
    return {
      sql: `SELECT c.name AS customer, p.name AS plan, cs.start_date, cs.end_date, cs.status
            FROM customer_subscriptions cs
            JOIN customers c ON c.id = cs.customer_id
            JOIN subscription_plans p ON p.id = cs.plan_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY cs.end_date DESC`,
      args,
    };
  },
  referrals: ({ reward_status }) => {
    const where: string[] = [];
    const args: any[] = [];
    if (reward_status) { where.push('r.reward_status = ?'); args.push(reward_status); }
    return {
      sql: `SELECT ref.name AS referrer, red.name AS referred, r.status, r.reward_amount,
                   r.reward_valid_until, r.reward_status, r.created_at
            FROM referrals r
            JOIN customers ref ON ref.id = r.referrer_id
            JOIN customers red ON red.id = r.referred_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.created_at DESC`,
      args,
    };
  },
};

// GET /api/reports/export/:type?...filters
export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as ExportType;
  const builder = EXPORT_QUERIES[type];
  if (!builder) throw new HttpError(400, `Unsupported export type: ${type}`);

  const { sql, args } = builder(req.query);
  const [rows] = await pool.query<RowDataPacket[]>(sql, args);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP System';
  const sheet = workbook.addWorksheet(type.charAt(0).toUpperCase() + type.slice(1));

  if (rows.length) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      key,
      width: 20,
    }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6B5C' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  } else {
    sheet.addRow(['No data found for the selected filters']);
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
});

// GET /api/reports/summary/:type — quick aggregate numbers before exporting
export const getReportSummary = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as ExportType;
  const builder = EXPORT_QUERIES[type];
  if (!builder) throw new HttpError(400, `Unsupported report type: ${type}`);
  const { sql, args } = builder(req.query);
  const [rows] = await pool.query<RowDataPacket[]>(sql, args);
  res.json({ success: true, count: rows.length, data: rows.slice(0, 20) });
});
