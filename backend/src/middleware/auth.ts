// import { Response, NextFunction, Request } from 'express';
// import jwt from 'jsonwebtoken';
// import { pool } from '../config/db';
// import { RowDataPacket } from 'mysql2';

// export interface AuthedRequest extends Request {
//   user?: { id: number; email: string; role: 'admin' | 'user'; name: string };
// }

// interface TokenPayload {
//   id: number;
//   email: string;
//   role: string;
// }

// /**
//  * Verifies the JWT AND re-checks the user against the database on every request.
//  * This matters because a JWT is only proof of "who was valid at login time" —
//  * without the DB check, a deactivated account or a role change (e.g. admin -> user)
//  * would not take effect until the old token naturally expires.
//  */
// export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
//   const header = req.headers.authorization;
//   if (!header || !header.startsWith('Bearer ')) {
//     return res.status(401).json({ success: false, message: 'Authentication required' });
//   }

//   const token = header.split(' ')[1];
//   let payload: TokenPayload;
//   try {
//     payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as TokenPayload;
//   } catch {
//     return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
//   }

//   try {
//     const [rows] = await pool.query<RowDataPacket[]>(
//       'SELECT id, name, email, role, status FROM users WHERE id = ?',
//       [payload.id]
//     );
//     if (!rows.length) {
//       return res.status(401).json({ success: false, message: 'Account no longer exists.' });
//     }
//     const dbUser = rows[0];
//     if (dbUser.status !== 'active') {
//       return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
//     }

//     // Always trust the DB's current role/name, never the (possibly stale) token payload.
//     req.user = { id: dbUser.id, email: dbUser.email, role: dbUser.role, name: dbUser.name };
//     next();
//   } catch (err) {
//     next(err);
//   }
// }

// export function requireRole(...roles: Array<'admin' | 'user'>) {
//   return (req: AuthedRequest, res: Response, next: NextFunction) => {
//     if (!req.user || !roles.includes(req.user.role)) {
//       return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
//     }
//     next();
//   };
// }


import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { RowDataPacket } from 'mysql2';

export type Role = 'admin' | 'user' | 'staff';

export interface AuthedRequest extends Request {
  user?: { id: number; email: string; role: Role; name: string };
}

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

/**
 * Verifies the JWT AND re-checks the user against the database on every request.
 * This matters because a JWT is only proof of "who was valid at login time" —
 * without the DB check, a deactivated account or a role change (e.g. admin -> user)
 * would not take effect until the old token naturally expires.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = header.split(' ')[1];
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as TokenPayload;
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, email, role, status FROM users WHERE id = ?',
      [payload.id]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    }
    const dbUser = rows[0];
    if (dbUser.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account has been deactivated.' });
    }

    // Always trust the DB's current role/name, never the (possibly stale) token payload.
    req.user = { id: dbUser.id, email: dbUser.email, role: dbUser.role, name: dbUser.name };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

const DENIED = { success: false, message: 'Your Staff account does not have access to this module.' };

/** Staff accounts are blocked entirely. Use on modules that are for admin/user only. */
export function blockStaff(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role === 'staff') return res.status(403).json(DENIED);
  next();
}

/**
 * Staff accounts may only make the listed requests; everyone else passes through untouched.
 * Each rule is an exact "METHOD /path" relative to where the router is mounted, e.g. 'GET /'
 * (so 'GET /' allows the list/search endpoint but NOT 'GET /5').
 * Used so Billing keeps working for staff (they need to *look up* customers and rewards)
 * without giving them the Customers or Referrals modules.
 */
export function staffAllowOnly(...rules: string[]) {
  const parsed = rules.map((r) => {
    const [method, path] = r.split(' ');
    return { method, prefix: path };
  });
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'staff') return next();
    const ok = parsed.some((r) => r.method === req.method && req.path === r.prefix);
    if (!ok) return res.status(403).json(DENIED);
    next();
  };
}