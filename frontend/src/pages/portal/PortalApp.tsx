import { Navigate, Route, Routes } from 'react-router-dom';
import '../../styles/portal.css';
import { PortalAuthProvider } from '../../context/PortalAuthContext';
import { PortalProtectedRoute } from '../../components/portal/PortalProtectedRoute';
import { PortalLayout } from '../../components/portal/PortalLayout';
import { PortalLoginPage } from './PortalLoginPage';
import { PortalRegisterPage } from './PortalRegisterPage';
import { PortalDashboardPage } from './PortalDashboardPage';
import { PortalSubscriptionPage } from './PortalSubscriptionPage';
import { PortalReferralsPage } from './PortalReferralsPage';
import { PortalCommissionsPage } from './PortalCommissionsPage';
import { PortalTransactionsPage } from './PortalTransactionsPage';
import { PortalWithdrawalsPage } from './PortalWithdrawalsPage';
import { PortalProfilePage } from './PortalProfilePage';

/**
 * Mounted at /portal/* from App.tsx. Owns its own auth provider so the customer session is
 * completely separate from the staff session used by the rest of the app.
 */
export function PortalApp() {
  return (
    <PortalAuthProvider>
      <Routes>
        <Route path="login" element={<PortalLoginPage />} />
        <Route path="register" element={<PortalRegisterPage />} />
        <Route element={<PortalProtectedRoute><PortalLayout /></PortalProtectedRoute>}>
          <Route index element={<PortalDashboardPage />} />
          <Route path="subscription" element={<PortalSubscriptionPage />} />
          <Route path="referrals" element={<PortalReferralsPage />} />
          <Route path="commissions" element={<PortalCommissionsPage />} />
          <Route path="transactions" element={<PortalTransactionsPage />} />
          <Route path="withdrawals" element={<PortalWithdrawalsPage />} />
          <Route path="profile" element={<PortalProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </PortalAuthProvider>
  );
}