import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

import { testConnection } from './config/db';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';

import authRoutes from './routes/authRoutes';
import customerRoutes from './routes/customerRoutes';
import invoiceRoutes from './routes/invoiceRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import referralRoutes from './routes/referralRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import reportRoutes from './routes/reportRoutes';

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
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);
app.use('/api/subscriptions', requireAuth, subscriptionRoutes);
app.use('/api/referrals', requireAuth, referralRoutes);
app.use('/api/inventory', requireAuth, inventoryRoutes);
app.use('/api/purchases', requireAuth, purchaseRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

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
