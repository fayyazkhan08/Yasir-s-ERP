import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { BillingPage } from './pages/BillingPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { InventoryPage } from './pages/InventoryPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';

/**
 * Waits for AuthContext to finish verifying any stored token against the server
 * before rendering routes. Without this gate, a page refresh with an expired
 * token would flash the full dashboard shell for a frame before bouncing to
 * /login — this renders a clean loader instead.
 */
function AppRoutes() {
  const { bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <div className="boot-loader">
        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        <p className="text-muted" style={{ fontSize: 13 }}>Loading your workspace…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="referrals" element={<ReferralsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
