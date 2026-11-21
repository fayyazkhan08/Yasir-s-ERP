import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/customers', label: 'Customers', icon: '◈' },
  { to: '/billing', label: 'Billing & Invoices', icon: '🧾' },
  { to: '/subscriptions', label: 'Subscriptions', icon: '★' },
  { to: '/referrals', label: 'Referrals & Rewards', icon: '⇄' },
  { to: '/inventory', label: 'Inventory', icon: '▤' },
  { to: '/purchases', label: 'Purchases (Inward)', icon: '⇩' },
  { to: '/reports', label: 'Reports & Export', icon: '⎘' },
];

const ADMIN_ITEMS = [
  { to: '/admin/users', label: 'Team Accounts', icon: '👤' },
];

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { hasRole } = useAuth();

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="mark">Y</div>
        <span className="name">Yasir'\s Project </span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onCloseMobile}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        {hasRole('admin') && (
          <>
            <div style={{ padding: '14px 12px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Administration
            </div>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
