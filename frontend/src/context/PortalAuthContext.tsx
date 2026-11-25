import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { portalApi } from '../api/portalClient';
import { PortalSessionUser } from '../types/portal';

interface RegisterInput { name: string; mobile: string; email: string; password: string; referral_code?: string; }

interface PortalAuthValue {
  user: PortalSessionUser | null;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** After a password change: store the fresh token and clear the "must change password" flag. */
  passwordChanged: (token: string) => void;
}

const PortalAuthContext = createContext<PortalAuthValue | undefined>(undefined);

/**
 * Customer session. Independent of the staff AuthContext (own token key, own endpoints).
 * Only mounted under /portal/*, so staff pages never pay for it.
 */
export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalSessionUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) { setBootstrapping(false); return; }
    portalApi.get('/me')
      .then((res) => {
        const d = res.data.data;
        setUser({ customer_id: d.customer_id, customer_code: d.customer_code, name: d.name, email: d.email, must_change_password: d.must_change_password });
      })
      .catch(() => { localStorage.removeItem('portal_token'); setUser(null); })
      .finally(() => setBootstrapping(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('portal:session-expired', onExpired);
    return () => window.removeEventListener('portal:session-expired', onExpired);
  }, []);

  const start = (token: string, u: PortalSessionUser) => {
    localStorage.setItem('portal_token', token);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const res = await portalApi.post('/auth/login', { email, password });
    start(res.data.data.token, res.data.data.user);
  };

  const register = async (input: RegisterInput) => {
    const res = await portalApi.post('/auth/register', input);
    start(res.data.data.token, res.data.data.user);
  };

  const logout = async () => {
    try { await portalApi.post('/auth/logout'); } catch { /* stateless JWT — clearing it locally is what matters */ }
    localStorage.removeItem('portal_token');
    setUser(null);
  };

  const passwordChanged = useCallback((token: string) => {
    localStorage.setItem('portal_token', token);
    setUser((u) => (u ? { ...u, must_change_password: false } : u));
  }, []);

  return (
    <PortalAuthContext.Provider value={{ user, bootstrapping, login, register, logout, passwordChanged }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
  return ctx;
}