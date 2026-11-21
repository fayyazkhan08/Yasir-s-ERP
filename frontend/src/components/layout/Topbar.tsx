import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  title: string;
  onToggleMobile: () => void;
}

export function Topbar({ title, onToggleMobile }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost btn-icon hamburger" onClick={onToggleMobile} aria-label="Toggle menu">☰</button>
        <h1 className="topbar-title">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <span className={`toggle-icon ${theme === 'light' ? 'active' : ''}`} aria-hidden="true">☀</span>
          <span className={`toggle-icon ${theme === 'dark' ? 'active' : ''}`} aria-hidden="true">☾</span>
          <span className="toggle-knob" aria-hidden="true" />
        </button>

        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              className="flex items-center gap-2 btn btn-ghost"
              style={{ padding: '4px 8px 4px 4px' }}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--brand-gradient)', color: 'var(--on-primary)',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name.split(' ')[0]}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
            </button>

            {menuOpen && (
              <div
                className="card"
                style={{ position: 'absolute', right: 0, top: '110%', minWidth: 220, zIndex: 200, padding: 8 }}
              >
                <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{user.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{user.email}</div>
                  <span className={`role-badge ${user.role}`} style={{ marginTop: 6 }}>{user.role}</span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger-600)' }}
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? <span className="spinner" /> : '⎋ Sign out'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
