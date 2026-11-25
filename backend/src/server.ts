// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import compression from 'compression';
// import dotenv from 'dotenv';

// import { testConnection } from './config/db';
// import { notFoundHandler, errorHandler } from './middleware/errorHandler';
// import { requireAuth, requireRole } from './middleware/auth';

// import authRoutes from './routes/authRoutes';
// import customerRoutes from './routes/customerRoutes';
// import invoiceRoutes from './routes/invoiceRoutes';
// import subscriptionRoutes from './routes/subscriptionRoutes';
// import referralRoutes from './routes/referralRoutes';
// import inventoryRoutes from './routes/inventoryRoutes';
// import purchaseRoutes from './routes/purchaseRoutes';
// import dashboardRoutes from './routes/dashboardRoutes';
// import reportRoutes from './routes/reportRoutes';
// import portalAuthRoutes from './routes/portalAuthRoutes';
// import portalRoutes from './routes/portalRoutes';
// import portalAdminRoutes from './routes/portalAdminRoutes';

// import { autoExpireSubscriptions } from './controllers/subscriptionController';
// import { autoExpireRewards } from './controllers/referralController';

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// // --- Global middleware ---
// app.use(helmet());
// // NOTE: credentials:true + origin:'*' is an invalid combination per the Fetch spec —
// // browsers silently reject it, which breaks every authenticated request (including
// // login) the moment the frontend and API are on different origins. We authenticate
// // with a Bearer token (not cookies), so credentials aren't needed at all here.
// const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
// app.use(cors({ origin: corsOrigins }));
// app.use(compression());
// app.use(express.json({ limit: '2mb' }));
// app.use(express.urlencoded({ extended: true }));
// if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() }));

// // --- API routes ---
// // auth routes are intentionally NOT behind requireAuth as a whole — login/register/logout
// // must be reachable while logged out; the /users management endpoints inside authRoutes
// // apply their own requireAuth + requireRole('admin') per-route.
// app.use('/api/auth', authRoutes);

// // Every business module requires a valid, active session. These were previously mounted
// // with no authentication at all — any client that knew the API path could read and write
// // customers, invoices, inventory, etc. without ever logging in.
// app.use('/api/customers', requireAuth, customerRoutes);
// app.use('/api/invoices', requireAuth, invoiceRoutes);
// app.use('/api/subscriptions', requireAuth, subscriptionRoutes);
// app.use('/api/referrals', requireAuth, referralRoutes);
// app.use('/api/inventory', requireAuth, inventoryRoutes);
// app.use('/api/purchases', requireAuth, purchaseRoutes);
// app.use('/api/dashboard', requireAuth, dashboardRoutes);
// app.use('/api/reports', requireAuth, reportRoutes);

// // --- Customer portal ---
// // Customers authenticate with their own token type (signed with a different secret from staff
// // tokens), so a customer token can never pass the staff `requireAuth` above and vice versa.
// // Order matters: the public /auth routes must be mounted BEFORE the authenticated /api/portal router.
// app.use('/api/portal/auth', portalAuthRoutes);
// app.use('/api/portal', portalRoutes);
// // Admin-side tools for the portal (process withdrawals, issue customer logins). Admin role only.
// app.use('/api/admin/portal', requireAuth, requireRole('admin'), portalAdminRoutes);

// app.use(notFoundHandler);
// app.use(errorHandler);

// async function start() {
//   try {
//     await testConnection();
//     app.listen(PORT, () => {
//       console.log(`🚀 ERP API server running on http://localhost:${PORT}`);
//     });

//     // Daily housekeeping: expire subscriptions/rewards past their validity window
//     setInterval(() => {
//       autoExpireSubscriptions().catch((e) => console.error('Subscription expiry job failed:', e));
//       autoExpireRewards().catch((e) => console.error('Reward expiry job failed:', e));
//     }, 24 * 60 * 60 * 1000);
//   } catch (err) {
//     console.error('❌ Failed to start server:', err);
//     process.exit(1);
//   }
// }

// start();

// export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

import { testConnection } from './config/db';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { requireAuth, requireRole, blockStaff, staffAllowOnly } from './middleware/auth';

import authRoutes from './routes/authRoutes';
import customerRoutes from './routes/customerRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import referralRoutes from './routes/referralRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import reportRoutes from './routes/reportRoutes';
import portalAuthRoutes from './routes/portalAuthRoutes';
import portalRoutes from './routes/portalRoutes';
import portalAdminRoutes from './routes/portalAdminRoutes';
import vendorRoutes from './routes/vendorRoutes';
import dealerOrderRoutes from './routes/dealerOrderRoutes';

import { autoExpireSubscriptions } from './controllers/subscriptionController';
import { autoExpireRewards } from './controllers/referralController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Global middleware ---
app.use(helmet());
// NOTE: credentials:true + origin:'*' is an invalid combination per the Fetch spec —
// browsers silently reject it, which breaks every authenticated request (including
// login) the moment the frontend and API are on different origins. We authenticate
// with a Bearer token (not cookies), so credentials aren't needed at all here.
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({ origin: corsOrigins }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() }));

// --- API routes ---
// auth routes are intentionally NOT behind requireAuth as a whole — login/register/logout
// must be reachable while logged out; the /users management endpoints inside authRoutes
// apply their own requireAuth + requireRole('admin') per-route.
app.use('/api/auth', authRoutes);

// Every business module requires a valid, active session. These were previously mounted
// with no authentication at all — any client that knew the API path could read and write
// customers, invoices, inventory, etc. without ever logging in.
// Role model:
//   admin / user -> everything below
//   staff        -> Inventory + Billing only. Billing needs to LOOK UP customers and available
//                   referral rewards, so those two are read-only for staff; every other module is blocked.
app.use('/api/customers', requireAuth, staffAllowOnly('GET /'), customerRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);
app.use('/api/subscriptions', requireAuth, blockStaff, subscriptionRoutes);
app.use('/api/referrals', requireAuth, staffAllowOnly('GET /rewards/available'), referralRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/purchases', requireAuth, blockStaff, purchaseRoutes);
app.use('/api/dashboard', requireAuth, blockStaff, dashboardRoutes);
app.use('/api/reports', requireAuth, blockStaff, reportRoutes);
app.use('/api/vendors', requireAuth, blockStaff, vendorRoutes);
app.use('/api/dealer-orders', requireAuth, blockStaff, dealerOrderRoutes);

// --- Customer portal ---
// Customers authenticate with their own token type (signed with a different secret from staff
// tokens), so a customer token can never pass the staff `requireAuth` above and vice versa.
// Order matters: the public /auth routes must be mounted BEFORE the authenticated /api/portal router.
app.use('/api/portal/auth', portalAuthRoutes);
app.use('/api/portal', portalRoutes);
// Admin-side tools for the portal (process withdrawals, issue customer logins). Admin role only.
app.use('/api/admin/portal', requireAuth, requireRole('admin'), portalAdminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`🚀 ERP API server running on http://localhost:${PORT}`);
    });

    // Daily housekeeping: expire subscriptions/rewards past their validity window
    setInterval(() => {
      autoExpireSubscriptions().catch((e) => console.error('Subscription expiry job failed:', e));
      autoExpireRewards().catch((e) => console.error('Reward expiry job failed:', e));
    }, 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;