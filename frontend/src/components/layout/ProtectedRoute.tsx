import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, Role } from '../../context/AuthContext';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="flex-col items-center justify-center gap-3" style={{ minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2>Access restricted</h2>
        <p className="text-muted" style={{ maxWidth: 360 }}>
          This page is only available to {roles.join(' or ')} accounts. Contact your administrator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
