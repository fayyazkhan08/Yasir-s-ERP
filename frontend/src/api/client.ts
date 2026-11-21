import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401 (expired/invalid/deactivated session), clear local auth state and let the
// app react to it — no hard `window.location` reload, which used to blow away any
// in-progress form state and felt jarring. AuthContext listens for this event and
// ProtectedRoute takes care of navigating back to /login via React Router.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login') && !err.config?.url?.includes('/auth/register')) {
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      window.dispatchEvent(new CustomEvent('erp:session-expired'));
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (data?.errors?.length) {
    return data.errors.map((e: any) => e.message).join(' · ');
  }
  return data?.message || err?.message || 'Something went wrong. Please try again.';
}
