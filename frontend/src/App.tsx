// import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import { ThemeProvider } from './context/ThemeContext';
// import { ToastProvider } from './context/ToastContext';
// import { AuthProvider, useAuth } from './context/AuthContext';
// import { ProtectedRoute } from './components/layout/ProtectedRoute';
// import { AppLayout } from './components/layout/AppLayout';
// import { LoginPage } from './pages/LoginPage';
// import { SignupPage } from './pages/SignupPage';
// import { DashboardPage } from './pages/DashboardPage';
// import { CustomersPage } from './pages/CustomersPage';
// import { BillingPage } from './pages/BillingPage';
// import { SubscriptionsPage } from './pages/SubscriptionsPage';
// import { ReferralsPage } from './pages/ReferralsPage';
// import { InventoryPage } from './pages/InventoryPage';
// import { PurchasesPage } from './pages/PurchasesPage';
// import { ReportsPage } from './pages/ReportsPage';
// import { AdminUsersPage } from './pages/AdminUsersPage';
// import { PortalAdminPage } from './pages/PortalAdminPage';
// import { PortalApp } from './pages/portal/PortalApp';

// /**
//  * Waits for AuthContext to finish verifying any stored token against the server
//  * before rendering routes. Without this gate, a page refresh with an expired
//  * token would flash the full dashboard shell for a frame before bouncing to
//  * /login — this renders a clean loader instead.
//  */
// function AppRoutes() {
//   const { bootstrapping } = useAuth();

//   if (bootstrapping) {
//     return (
//       <div className="boot-loader">
//         <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
//         <p className="text-muted" style={{ fontSize: 13 }}>Loading your workspace…</p>
//       </div>
//     );
//   }

//   return (
//     <Routes>
//       <Route path="/login" element={<LoginPage />} />
//       <Route path="/signup" element={<SignupPage />} />
//       {/* Customer portal — own session, own layout; nothing below this line is affected */}
//       <Route path="/portal/*" element={<PortalApp />} />
//       <Route
//         path="/"
//         element={
//           <ProtectedRoute>
//             <AppLayout />
//           </ProtectedRoute>
//         }
//       >
//         <Route index element={<DashboardPage />} />
//         <Route path="customers" element={<CustomersPage />} />
//         <Route path="billing" element={<BillingPage />} />
//         <Route path="subscriptions" element={<SubscriptionsPage />} />
//         <Route path="referrals" element={<ReferralsPage />} />
//         <Route path="inventory" element={<InventoryPage />} />
//         <Route path="purchases" element={<PurchasesPage />} />
//         <Route path="reports" element={<ReportsPage />} />
//         <Route
//           path="admin/users"
//           element={
//             <ProtectedRoute roles={['admin']}>
//               <AdminUsersPage />
//             </ProtectedRoute>
//           }
//         />
//         <Route
//           path="admin/portal"
//           element={
//             <ProtectedRoute roles={['admin']}>
//               <PortalAdminPage />
//             </ProtectedRoute>
//           }
//         />
//       </Route>
//     </Routes>
//   );
// }

// export default function App() {
//   return (
//     <ThemeProvider>
//       <ToastProvider>
//         <AuthProvider>
//           <BrowserRouter>
//             <AppRoutes />
//           </BrowserRouter>
//         </AuthProvider>
//       </ToastProvider>
//     </ThemeProvider>
//   );
// }

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth, Role } from './context/AuthContext';
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
import { PortalAdminPage } from './pages/PortalAdminPage';
import { PortalApp } from './pages/portal/PortalApp';
import { VendorsPage } from './pages/VendorsPage';
import { DealerOrdersPage } from './pages/DealerOrdersPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';

// Staff accounts only get Billing and Inventory. Every other module is wrapped in <OfficeOnly>
// (the server enforces the same rule, so this is just the friendly front door).
const OFFICE: Role[] = ['admin', 'user'];
function OfficeOnly({ children }: { children: JSX.Element }) {
  return <ProtectedRoute roles={OFFICE}>{children}</ProtectedRoute>;
}

/**
 * Waits for AuthContext to finish verifying any stored token against the server
 * before rendering routes. Without this gate, a page refresh with an expired
 * token would flash the full dashboard shell for a frame before bouncing to
 * /login — this renders a clean loader instead.
 */
function AppRoutes() {
  const { bootstrapping, user } = useAuth();

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
      {/* Customer portal — own session, own layout; nothing below this line is affected */}
      <Route path="/portal/*" element={<PortalApp />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Staff land on Billing; the dashboard (revenue, customers, …) is for admin/user only. */}
        <Route index element={user?.role === 'staff' ? <Navigate to="/billing" replace /> : <DashboardPage />} />
        <Route path="customers" element={<OfficeOnly><CustomersPage /></OfficeOnly>} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="subscriptions" element={<OfficeOnly><SubscriptionsPage /></OfficeOnly>} />
        <Route path="referrals" element={<OfficeOnly><ReferralsPage /></OfficeOnly>} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="vendors" element={<OfficeOnly><VendorsPage /></OfficeOnly>} />
        <Route path="purchases" element={<OfficeOnly><PurchasesPage /></OfficeOnly>} />
        <Route path="dealer-orders" element={<OfficeOnly><DealerOrdersPage /></OfficeOnly>} />
        <Route path="order-tracking" element={<OfficeOnly><OrderTrackingPage /></OfficeOnly>} />
        <Route path="reports" element={<OfficeOnly><ReportsPage /></OfficeOnly>} />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/portal"
          element={
            <ProtectedRoute roles={['admin']}>
              <PortalAdminPage />
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