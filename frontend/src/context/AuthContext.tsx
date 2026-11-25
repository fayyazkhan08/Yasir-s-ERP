// import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// import { api } from '../api/client';

// export type Role = 'admin' | 'user';
// export interface User { id: number; name: string; email: string; role: Role; }

// interface AuthContextValue {
//   user: User | null;
//   bootstrapping: boolean;
//   login: (email: string, password: string) => Promise<void>;
//   signup: (name: string, email: string, password: string) => Promise<void>;
//   logout: () => Promise<void>;
//   isAuthenticated: boolean;
//   hasRole: (...roles: Role[]) => boolean;
// }

// const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<User | null>(null);
//   // True while we verify any locally-stored token against the server on first load.
//   // Without this, an expired/invalid token would leave the UI showing a "logged in"
//   // shell that 401s on the very first real request.
//   const [bootstrapping, setBootstrapping] = useState(true);

//   useEffect(() => {
//     const token = localStorage.getItem('erp_token');
//     if (!token) {
//       setBootstrapping(false);
//       return;
//     }
//     api.get('/auth/me')
//       .then((res) => setUser(res.data.data))
//       .catch(() => {
//         localStorage.removeItem('erp_token');
//         localStorage.removeItem('erp_user');
//         setUser(null);
//       })
//       .finally(() => setBootstrapping(false));
//   }, []);

//   useEffect(() => {
//     const onSessionExpired = () => setUser(null);
//     window.addEventListener('erp:session-expired', onSessionExpired);
//     return () => window.removeEventListener('erp:session-expired', onSessionExpired);
//   }, []);

//   const persistSession = (token: string, u: User) => {
//     localStorage.setItem('erp_token', token);
//     localStorage.setItem('erp_user', JSON.stringify(u));
//     setUser(u);
//   };

//   const login = async (email: string, password: string) => {
//     const res = await api.post('/auth/login', { email, password });
//     const { token, user: u } = res.data.data;
//     persistSession(token, u);
//   };

//   const signup = async (name: string, email: string, password: string) => {
//     const res = await api.post('/auth/register', { name, email, password });
//     const { token, user: u } = res.data.data;
//     persistSession(token, u);
//   };

//   const logout = async () => {
//     try {
//       await api.post('/auth/logout');
//     } catch {
//       // Best-effort — the JWT is stateless, so clearing it client-side is what actually matters.
//     } finally {
//       localStorage.removeItem('erp_token');
//       localStorage.removeItem('erp_user');
//       setUser(null);
//     }
//   };

//   const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

//   return (
//     <AuthContext.Provider value={{ user, bootstrapping, login, signup, logout, isAuthenticated: !!user, hasRole }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// }


import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';

export type Role = 'admin' | 'user' | 'staff';
export interface User { id: number; name: string; email: string; role: Role; }

interface AuthContextValue {
  user: User | null;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // True while we verify any locally-stored token against the server on first load.
  // Without this, an expired/invalid token would leave the UI showing a "logged in"
  // shell that 401s on the very first real request.
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('erp_token');
    if (!token) {
      setBootstrapping(false);
      return;
    }
    api.get('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => {
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_user');
        setUser(null);
      })
      .finally(() => setBootstrapping(false));
  }, []);

  useEffect(() => {
    const onSessionExpired = () => setUser(null);
    window.addEventListener('erp:session-expired', onSessionExpired);
    return () => window.removeEventListener('erp:session-expired', onSessionExpired);
  }, []);

  const persistSession = (token: string, u: User) => {
    localStorage.setItem('erp_token', token);
    localStorage.setItem('erp_user', JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: u } = res.data.data;
    persistSession(token, u);
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await api.post('/auth/register', { name, email, password });
    const { token, user: u } = res.data.data;
    persistSession(token, u);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort — the JWT is stateless, so clearing it client-side is what actually matters.
    } finally {
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      setUser(null);
    }
  };

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, bootstrapping, login, signup, logout, isAuthenticated: !!user, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}