import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { usePortalAuth } from '../../context/PortalAuthContext';

const NAV = [
  { to: '/portal', label: 'Dashboard', icon: '▦', end: true },
  { to: '/portal/subscription', label: 'My Subscription', icon: '★' },
  { to: '/portal/referrals', label: 'Referrals', icon: '⇄' },
  { to: '/portal/commissions', label: 'Commissions', icon: '％' },
  { to: '/portal/transactions', label: 'Transactions', icon: '🧾' },
  { to: '/portal/withdrawals', label: 'Withdrawals', icon: '⇧' },
  { to: '/portal/profile', label: 'Profile', icon: '👤' },
];

const TITLES: Record<string, string> = {
  '/portal': 'My Dashboard',
  '/portal/subscription': 'My Subscription',
  '/portal/referrals': 'Referrals',
  '/portal/commissions': 'Referral Commissions',
  '/portal/transactions': 'Transaction History',
  '/portal/withdrawals': 'Withdrawals',
  '/portal/profile': 'My Profile',
};

export function PortalLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locked = !!user?.must_change_password;

  const handleLogout = async () => {
    await logout();
    navigate('/portal/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="mark">Y</div>
          <span className="name">Customer Portal</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={locked && item.to !== '/portal/profile' ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90 }} />
      )}

      <div className="main-content">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-icon hamburger" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">☰</button>
            <h1 className="topbar-title">{TITLES[location.pathname] || 'Customer Portal'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              role="switch"
              aria-checked={theme === 'dark'}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span className={`toggle-icon ${theme === 'light' ? 'active' : ''}`} aria-hidden="true">☀</span>
              <span className={`toggle-icon ${theme === 'dark' ? 'active' : ''}`} aria-hidden="true">☾</span>
              <span className="toggle-knob" aria-hidden="true" />
            </button>

            {user && (
              <div style={{ position: 'relative' }}>
                <button className="flex items-center gap-2 btn btn-ghost" style={{ padding: '4px 8px 4px 4px' }} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="true" aria-expanded={menuOpen}>
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-gradient)', color: 'var(--on-primary)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
                </button>
                {menuOpen && (
                  <div className="card" style={{ position: 'absolute', right: 0, top: '110%', minWidth: 220, zIndex: 200, padding: 8 }}>
                    <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{user.name}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{user.email}</div>
                      <div className="text-muted mono" style={{ fontSize: 11.5, marginTop: 4 }}>{user.customer_code}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleLogout}>⎋ Sign out</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}