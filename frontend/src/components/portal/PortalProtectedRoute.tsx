import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePortalAuth } from '../../context/PortalAuthContext';

/**
 * Gate for the signed-in customer area. Sends signed-out visitors to the portal login, and sends a
 * customer who still has an admin-issued temporary password to the profile page to replace it
 * (the API enforces this too — this is just the friendly half).
 */
export function PortalProtectedRoute({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = usePortalAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="boot-loader">
        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/portal/login" state={{ from: location.pathname }} replace />;
  if (user.must_change_password && location.pathname !== '/portal/profile') {
    return <Navigate to="/portal/profile" replace />;
  }
  return <>{children}</>;
}