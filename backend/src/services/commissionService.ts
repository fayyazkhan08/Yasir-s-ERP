import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/db';
import { commissionPercent, fromPaise, toPaise } from '../utils/portalHelpers';

/**
 * Credits the referrer's wallet when a referred customer buys (or renews) a subscription.
 *
 *   commission = plan price × REFERRAL_COMMISSION_PERCENT / 100
 *
 * Properties worth knowing:
 *  - IDEMPOTENT. `referral_commissions.subscription_id` is UNIQUE, so calling this twice for
 *    the same subscription can never pay twice — the second call is a silent no-op.
 *  - ATOMIC. The commission row and its ledger credit are written in one transaction.
 *  - A no-op (not an error) when the customer wasn't referred, was referred by themselves,
 *    the referral was rejected, the price is zero, or commissions are disabled (percent = 0).
 *
 * Returns the credited amount in rupees, or 0 if nothing was credited.
 */
export async function creditReferralCommission(subscriptionId: number): Promise<number> {
  const percent = commissionPercent();
  if (percent <= 0) return 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [subs] = await conn.query<RowDataPacket[]>(
      `SELECT cs.id, cs.customer_id, p.price, p.name AS plan_name, c.name AS customer_name
         FROM customer_subscriptions cs
         JOIN subscription_plans p ON p.id = cs.plan_id
         JOIN customers c ON c.id = cs.customer_id
        WHERE cs.id = ?`,
      [subscriptionId]
    );
    if (!subs.length) {
      await conn.rollback();
      return 0;
    }
    const sub = subs[0];

    // A customer has at most one referrer; if the admin logged duplicates, the earliest valid one wins.
    const [refs] = await conn.query<RowDataPacket[]>(
      `SELECT id, referrer_id FROM referrals
        WHERE referred_id = ? AND status <> 'rejected' AND referrer_id <> referred_id
        ORDER BY id ASC LIMIT 1`,
      [sub.customer_id]
    );
    if (!refs.length) {
      await conn.rollback();
      return 0;
    }
    const referral = refs[0];

    const commissionPaise = Math.round((toPaise(sub.price) * percent) / 100);
    if (commissionPaise <= 0) {
      await conn.rollback();
      return 0;
    }
    const commission = fromPaise(commissionPaise);

    let commissionId: number;
    try {
      const [ins] = await conn.query<ResultSetHeader>(
        `INSERT INTO referral_commissions
           (referral_id, referrer_id, referred_id, subscription_id, base_amount, rate_percent, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [referral.id, referral.referrer_id, sub.customer_id, sub.id, sub.price, percent, commission]
      );
      commissionId = ins.insertId;
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        await conn.rollback(); // already credited for this subscription — nothing to do
        return 0;
      }
      throw err;
    }

    await conn.query(
      `INSERT INTO wallet_transactions (customer_id, type, direction, amount, description, commission_id)
       VALUES (?, 'commission', 'credit', ?, ?, ?)`,
      [
        referral.referrer_id,
        commission,
        `Referral commission (${percent}%) — ${sub.customer_name}'s ${sub.plan_name} plan`,
        commissionId,
      ]
    );

    await conn.commit();
    return commission;
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}
