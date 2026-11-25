import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../context/PortalAuthContext';
import { PasswordField } from '../../components/common/PasswordField';
import { apiErrorMessage } from '../../api/client';

export function PortalLoginPage() {
  const { user, login } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/portal';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/portal" replace />;

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="mark">Y</div>
          <h1 style={{ color: 'var(--on-primary)', fontSize: 32, marginTop: 28, maxWidth: 340 }}>
            Your subscription, referrals and earnings — all in one place.
          </h1>
        </div>
        <div className="auth-brand-content" style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.7 }}>
          Track your plan, share your referral link,<br />
          and withdraw what you earn.
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div style={{ marginBottom: 32 }}>
            <h2>Customer sign in</h2>
            <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>Welcome back — sign in to your portal</p>
          </div>

          <form className="flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                className={`input ${errors.email ? 'has-error' : ''}`}
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
            <PasswordField
              label="Password"
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              error={errors.password}
              onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
            />
            {formError && (
              <div className="flex items-center gap-2" style={{ background: 'var(--danger-100)', color: 'var(--danger-600)', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
                <span>⚠</span><span>{formError}</span>
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, height: 42 }}>
              {loading ? <span className="spinner" /> : 'Sign in'}
            </button>
          </form>

          <p className="text-muted" style={{ fontSize: 13, marginTop: 24, textAlign: 'center' }}>
            New here? <Link to="/portal/register" style={{ fontWeight: 600 }}>Create an account</Link>
          </p>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            Team member? <Link to="/login" style={{ fontWeight: 600 }}>Staff sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}