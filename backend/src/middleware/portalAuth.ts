import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/db';
import { passwordFingerprint, portalJwtSecret } from '../utils/portalHelpers';

export interface PortalUser {
  accountId: number;
  /** The customers.id this login owns. Every portal query is scoped by THIS value. */
  customerId: number;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

export interface PortalRequest extends Request {
  portalUser?: PortalUser;
}

interface PortalTokenPayload {
  id: number;
  role: string;
  typ: string;
  ph: string;
}

/**
 * Authenticates a customer-portal request.
 *
 * 1. Verifies the token with the PORTAL secret (a staff token fails here).
 * 2. Re-reads the account from the database on every request, so deactivating an account,
 *    deactivating the customer, or changing the password takes effect immediately rather
 *    than when the token happens to expire.
 * 3. Takes `customerId` from the database row — never from the request body, query or URL.
 */
export async function requirePortalAuth(req: PortalRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  let payload: PortalTokenPayload;
  try {
    payload = jwt.verify(header.split(' ')[1], portalJwtSecret(), { algorithms: ['HS256'] }) as PortalTokenPayload;
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please sign in again.' });
  }
  if (payload.typ !== 'portal' || payload.role !== 'customer') {
    return res.status(401).json({ success: false, message: 'Invalid session.' });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.id, a.customer_id, a.email, a.status, a.password_hash, a.must_change_password,
              c.name, c.status AS customer_status
         FROM customer_accounts a
         JOIN customers c ON c.id = a.customer_id
        WHERE a.id = ?`,
      [payload.id]
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'Account no longer exists.' });

    const acct = rows[0];
    if (payload.ph !== passwordFingerprint(acct.password_hash)) {
      return res.status(401).json({ success: false, message: 'Your password was changed. Please sign in again.' });
    }
    if (acct.status !== 'active' || acct.customer_status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account is inactive. Please contact support.' });
    }

    req.portalUser = {
      accountId: acct.id,
      customerId: acct.customer_id,
      email: acct.email,
      name: acct.name,
      mustChangePassword: !!acct.must_change_password,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * When an admin issued a temporary password, the customer must set their own before using
 * anything else. Enforced here on the server — hiding the menu in the UI would not be enough.
 */
export function requirePasswordCurrent(req: PortalRequest, res: Response, next: NextFunction) {
  if (req.portalUser?.mustChangePassword) {
    return res.status(403).json({
      success: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Please change your temporary password before continuing.',
    });
  }
  next();
}
