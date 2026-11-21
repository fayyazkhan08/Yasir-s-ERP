import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/customers': 'Customer Management',
  '/billing': 'Billing & Invoices',
  '/subscriptions': 'Subscriptions',
  '/referrals': 'Referrals & Rewards',
  '/inventory': 'Factory Inventory',
  '/purchases': 'Purchases (Inward Stock)',
  '/reports': 'Reports & Export',
  '/admin/users': 'Team Accounts',
};

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title = TITLES[location.pathname] || "Yasir's Project ";

  return (
    <div className="app-shell">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90 }}
        />
      )}
      <div className="main-content">
        <Topbar title={title} onToggleMobile={() => setMobileOpen((v) => !v)} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
