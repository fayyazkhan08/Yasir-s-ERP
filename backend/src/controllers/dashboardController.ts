import { Request, Response } from 'express';
import { pool } from '../config/db';
import { asyncHandler } from '../utils/helpers';
import { RowDataPacket } from 'mysql2';

// GET /api/dashboard/summary
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const [[customerCount]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total, SUM(status='active') AS active FROM customers`
  );
  const [[invoiceStats]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total, SUM(total_amount) AS revenue,
            SUM(status='unpaid') AS unpaid, SUM(status='paid') AS paid
     FROM invoices WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
  );
  const [[subCount]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS active FROM customer_subscriptions WHERE status = 'active'`
  );
  const [[lowStock]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM inventory_items WHERE current_stock <= reorder_level AND status='active'`
  );
  const [[referralStats]] = await pool.query<RowDataPacket[]>(
    `SELECT SUM(reward_status='issued') AS active_rewards, COUNT(*) AS total_referrals FROM referrals`
  );
  const [[purchaseStats]] = await pool.query<RowDataPacket[]>(
    `SELECT SUM(total_amount) AS total FROM purchases WHERE purchase_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
  );

  // Revenue trend, last 7 days
  const [revenueTrend] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(invoice_date) AS date, SUM(total_amount) AS revenue
     FROM invoices WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status != 'cancelled'
     GROUP BY DATE(invoice_date) ORDER BY date ASC`
  );

  const [expiringSubs] = await pool.query<RowDataPacket[]>(
    `SELECT cs.id, c.name AS customer_name, p.name AS plan_name, cs.end_date,
            DATEDIFF(cs.end_date, CURDATE()) AS days_remaining
     FROM customer_subscriptions cs
     JOIN customers c ON c.id = cs.customer_id
     JOIN subscription_plans p ON p.id = cs.plan_id
     WHERE cs.status = 'active' AND cs.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)
     ORDER BY cs.end_date ASC LIMIT 10`
  );

  res.json({
    success: true,
    data: {
      customers: { total: customerCount.total, active: customerCount.active || 0 },
      invoices_30d: {
        total: invoiceStats.total || 0,
        revenue: Number(invoiceStats.revenue || 0),
        unpaid: invoiceStats.unpaid || 0,
        paid: invoiceStats.paid || 0,
      },
      active_subscriptions: subCount.active || 0,
      low_stock_count: lowStock.total || 0,
      referrals: {
        active_rewards: referralStats.active_rewards || 0,
        total: referralStats.total_referrals || 0,
      },
      purchases_30d: Number(purchaseStats.total || 0),
      revenue_trend: revenueTrend,
      expiring_subscriptions: expiringSubs,
    },
  });
});
