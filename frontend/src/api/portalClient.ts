import axios from 'axios';

/**
 * Axios instance for the CUSTOMER portal. Deliberately separate from the staff `api` client:
 * it uses its own token (`portal_token`) and its own session-expiry event, so a customer session
 * and a staff session can never leak into each other.
 */
export const portalApi = axios.create({
  baseURL: '/api/portal',
  headers: { 'Content-Type': 'application/json' },
});

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

portalApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register');
    if (err.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem('portal_token');
      window.dispatchEvent(new CustomEvent('portal:session-expired'));
    }
    return Promise.reject(err);
  }
);