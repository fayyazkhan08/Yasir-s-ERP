// import { NavLink } from 'react-router-dom';
// import { useAuth } from '../../context/AuthContext';

// interface SidebarProps {
//   mobileOpen: boolean;
//   onCloseMobile: () => void;
// }

// const NAV_ITEMS = [
//   { to: '/', label: 'Dashboard', icon: '▦', end: true },
//   { to: '/customers', label: 'Customers', icon: '◈' },
//   { to: '/billing', label: 'Billing & Invoices', icon: '🧾' },
//   { to: '/subscriptions', label: 'Subscriptions', icon: '★' },
//   { to: '/referrals', label: 'Referrals & Rewards', icon: '⇄' },
//   { to: '/inventory', label: 'Inventory', icon: '▤' },
//   { to: '/purchases', label: 'Purchases (Inward)', icon: '⇩' },
//   { to: '/reports', label: 'Reports & Export', icon: '⎘' },
// ];

// const ADMIN_ITEMS = [
//   { to: '/admin/users', label: 'Team Accounts', icon: '👤' },
//   { to: '/admin/portal', label: 'Customer Portal', icon: '🪪' },
// ];

// export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
//   const { hasRole } = useAuth();

//   return (
//     <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
//       <div className="sidebar-brand">
//         <div className="mark">Y</div>
//         <span className="name">Yasir'\s Project </span>
//       </div>
//       <nav className="sidebar-nav">
//         {NAV_ITEMS.map((item) => (
//           <NavLink
//             key={item.to}
//             to={item.to}
//             end={item.end}
//             onClick={onCloseMobile}
//             className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
//           >
//             <span aria-hidden="true">{item.icon}</span>
//             <span>{item.label}</span>
//           </NavLink>
//         ))}

//         {hasRole('admin') && (
//           <>
//             <div style={{ padding: '14px 12px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
//               Administration
//             </div>
//             {ADMIN_ITEMS.map((item) => (
//               <NavLink
//                 key={item.to}
//                 to={item.to}
//                 onClick={onCloseMobile}
//                 className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
//               >
//                 <span aria-hidden="true">{item.icon}</span>
//                 <span>{item.label}</span>
//               </NavLink>
//             ))}
//           </>
//         )}
//       </nav>
//     </aside>
//   );
// }

import { NavLink } from 'react-router-dom';
import { useAuth, Role } from '../../context/AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem { to: string; label: string; icon: string; end?: boolean; roles: Role[] }

const ALL: Role[] = ['admin', 'user', 'staff'];
const OFFICE: Role[] = ['admin', 'user']; // everything except Staff

// Staff accounts see only Billing & Inventory. Keep this list in step with the route guards in App.tsx
// and the server-side checks in backend/src/server.ts.
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true, roles: OFFICE },
  { to: '/customers', label: 'Customers', icon: '◈', roles: OFFICE },
  { to: '/billing', label: 'Billing & Invoices', icon: '🧾', roles: ALL },
  { to: '/subscriptions', label: 'Subscriptions', icon: '★', roles: OFFICE },
  { to: '/referrals', label: 'Referrals & Rewards', icon: '⇄', roles: OFFICE },
  { to: '/inventory', label: 'Inventory', icon: '▤', roles: ALL },
  { to: '/vendors', label: 'Vendors', icon: '🏭', roles: OFFICE },
  { to: '/purchases', label: 'Purchases (Inward)', icon: '⇩', roles: OFFICE },
  { to: '/dealer-orders', label: 'Dealers Order', icon: '📦', roles: OFFICE },
  { to: '/order-tracking', label: 'Order Tracking', icon: '🚚', roles: OFFICE },
  { to: '/reports', label: 'Reports & Export', icon: '⎘', roles: OFFICE },
];

const ADMIN_ITEMS = [
  { to: '/admin/users', label: 'Team Accounts', icon: '👤' },
  { to: '/admin/portal', label: 'Customer Portal', icon: '🪪' },
];

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { hasRole, user } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !!user && item.roles.includes(user.role));

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="mark">Y</div>
        <span className="name">Yasir'\s Project </span>
      </div>
      <nav className="sidebar-nav">
        {visibleItems.map((item) => (
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