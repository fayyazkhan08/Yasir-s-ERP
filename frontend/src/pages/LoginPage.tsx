import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/common/PasswordField';
import { apiErrorMessage } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
          <div className="mark">L</div>
          <h1 style={{ color: 'var(--on-primary)', fontSize: 32, marginTop: 28, maxWidth: 340 }}>
            Run your factory floor to your front office — in one place.
          </h1>
        </div>
        <div className="auth-brand-content" style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.7 }}>
          Customers, billing, inventory, purchases, and reporting —<br />
          unified in a single, secure workspace.
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div style={{ marginBottom: 32 }}>
            <h2>Welcome back</h2>
            <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>Sign in to your Yasir's Projectworkspace</p>
          </div>

          <form className="flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>Email {errors.email && <span className="visually-hidden">— {errors.email}</span>}</label>
              <input
                type="email"
                className={`input ${errors.email ? 'has-error' : ''}`}
                placeholder="you@company.com"
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
            Don't have an account? <Link to="/signup" style={{ fontWeight: 600 }}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
