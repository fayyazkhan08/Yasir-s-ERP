# Yasir's Project — ERP / CRM / POS / Inventory System

A production-ready full-stack business management system built with **React + TypeScript** (frontend) and **Node.js + Express + TypeScript + MySQL** (backend).

## Auth fixes in this revision

This pass audited and fixed the signup/login flow end to end. If you're upgrading an existing install, see **Section 2b** below.

| Root cause found | Fix |
|---|---|
| No signup page existed in the frontend at all — the API endpoint was there, but nothing in the UI called it | Added a full `/signup` page wired to `POST /api/auth/register` |
| Public register endpoint accepted a client-supplied `role`, so anyone could self-register as `admin` | Public signup now always creates a `user` account; admin accounts can only be created by an existing admin via the new Team Accounts page |
| `requireAuth` trusted the JWT payload forever and never re-checked the database | It now re-fetches the user on every request, so a deactivated account or role change takes effect immediately instead of waiting for the token to expire |
| Every business-module API route (`/api/customers`, `/api/invoices`, etc.) had **no authentication at all** | All of them now require a valid session via `requireAuth` |
| No role-based protected pages existed anywhere in the frontend | Added `roles` support to `ProtectedRoute` and a real example: `/admin/users`, visible only to admins |
| `cors({ origin: '*', credentials: true })` — an invalid combination that browsers silently reject the moment frontend and API are on different origins | Fixed to a configurable origin list with `credentials` dropped (we use Bearer tokens, not cookies, so it was never needed) |
| Auth routes had no server-side validation (email format, password strength) | Added `express-validator` chains matching the rest of the API |
| The frontend trusted a locally stored token/user blindly on page load | `AuthContext` now verifies the token against `/api/auth/me` before rendering protected routes, with a clean loading state instead of a flash of stale UI |
| `role` schema was `admin/manager/staff`, inconsistent with the product's actual Admin/User model | Simplified to `admin`/`user` (see migration below) |

## Modules

- **Customer Management** — search, filter, edit, delete, referral tracking
- **Billing & Invoicing** — GST and non-GST invoices, auto tax calculation, PDF download
- **Subscriptions** — Platinum/Gold/Silver plans, renewal, upgrade, expiry tracking
- **Referrals & Rewards** — 1-year reward validity, usage tracking
- **Factory Inventory** — raw materials & finished goods, stock ledger, consumption linked to invoices
- **Low Stock Alerts** — dashboard notifications and highlighted warnings
- **Purchases (Inward)** — supplier tracking, stock intake, purchase history
- **Reports & Export** — Excel export with filters for every module
- **Team Accounts** (admin only) — create accounts, promote/demote roles, activate/deactivate
- Light/dark mode, fully responsive, JWT-secured API with DB-verified sessions

---

## 1. Prerequisites

- Node.js 18+
- MySQL 8+

## 2. Database setup (fresh install)

```bash
mysql -u root -p < backend/schema.sql
```

This creates the `erp_system` database, all tables (now with the corrected `admin`/`user` role model), and seed data.

## 2b. Upgrading an existing database

If you already have an `erp_system` database from before this fix (with the old `admin/manager/staff` roles), run the migration instead of the full schema:

```bash
mysql -u root -p < backend/migrations/001_fix_user_roles.sql
```

This safely collapses `manager`/`staff` into `user` and narrows the role column, without touching any other data.

## 3. Backend setup

```bash
cd backend
cp .env.example .env      # edit DB credentials, JWT secret, CORS_ORIGIN, company details
npm install
npm run dev                # starts on http://localhost:5000
```


Create your first admin login (admin@company.com / admin123 — **change immediately**):

```bash
npm run seed
```

Everyone else signs up from the UI at `/signup`, which always creates a standard `user` account. To create additional admins, sign in as an admin and use **Team Accounts** in the sidebar (or `POST /api/auth/users` with an admin's token):

```bash
curl -X POST http://localhost:5000/api/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -d '{"name":"Jane Doe","email":"jane@company.com","password":"SecurePass123","role":"admin"}'
```

## 4. Frontend setup

```bash
cd frontend
npm install
npm run dev                # starts on http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000` (see `vite.config.ts`).

## 5. Production build

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build   # outputs static files to frontend/dist — serve with any static host/nginx
```

---

## Folder structure

```
backend/
  src/
    config/       # DB pool
    controllers/  # business logic per module
    routes/       # Express routers
    middleware/   # auth, validation, error handling
    utils/        # helpers, PDF generator, pagination
    types/        # shared TS types
    server.ts     # app entry point
  schema.sql

frontend/
  src/
    api/          # axios client
    components/
      common/     # DataTable, Modal, ConfirmDialog, FormField, StatusBadge
      layout/     # Sidebar, Topbar, AppLayout, ProtectedRoute
      billing/    # Invoice-specific components
    context/      # Theme, Toast, Auth providers
    hooks/        # usePaginatedList, useDebounce
    pages/        # one page per module
    styles/       # design tokens, global styles, component styles
    types/        # shared TS types matching backend entities
```

## Key architectural notes

- **Server-side totals**: invoice/GST totals are always recomputed on the backend from raw line items — the frontend preview is for UX only and is never trusted for the final amount.
- **Transactions**: invoice creation, purchase intake, and stock adjustments run inside MySQL transactions with row locks (`FOR UPDATE`) to prevent stock race conditions.
- **Stock ledger**: every inward/outward/adjustment movement is logged in `stock_movements`, giving a full audit trail per item.
- **Referral rewards**: automatically expire 1 year after being issued via a daily housekeeping job (`autoExpireRewards`, `autoExpireSubscriptions` in `server.ts`).
- **Pagination/sorting/search**: handled generically via `parsePagination` (backend) and `usePaginatedList` (frontend) — reused across every module.
- **Design system**: all colors, spacing, and typography are CSS custom properties in `styles/tokens.css`, so light/dark theming and rebranding only require editing one file.

## Extending

- Add a new module by: (1) adding a table to `schema.sql`, (2) a controller + route file on the backend, (3) a page + types entry on the frontend, (4) a sidebar link in `Sidebar.tsx`.
- Auth is JWT-based with roles (`admin`, `manager`, `staff`) — use `requireAuth` / `requireRole()` middleware to lock down routes as needed (currently most routes are open for easier local development; add these before deploying).
