import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/common/PasswordField';
import { apiErrorMessage } from '../api/client';

interface FormErrors { name?: string; email?: string; password?: string; confirmPassword?: string; }

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!name.trim()) e.name = 'Name is required';

    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';

    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Must be at least 8 characters';
    else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) e.password = 'Must include a letter and a number';

    if (confirmPassword !== password) e.confirmPassword = 'Passwords do not match';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
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
            Set up your workspace in under a minute.
          </h1>
        </div>
        <div className="auth-brand-content" style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.7 }}>
          New accounts start with standard access.<br />
          An administrator can grant admin permissions later.
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div style={{ marginBottom: 28 }}>
            <h2>Create your account</h2>
            <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>Get started with Yasir's Project </p>
          </div>

          <form className="flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>Full Name</label>
              <input
                className={`input ${errors.name ? 'has-error' : ''}`}
                placeholder="Jane Doe"
                value={name}
                autoComplete="name"
                onChange={(e) => { setName(e.target.value); setFormError(''); }}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="field">
              <label>Email</label>
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
              placeholder="At least 8 characters"
              value={password}
              autoComplete="new-password"
              error={errors.password}
              showStrength
              onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
            />

            <PasswordField
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              autoComplete="new-password"
              error={errors.confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setFormError(''); }}
            />

            {formError && (
              <div className="flex items-center gap-2" style={{ background: 'var(--danger-100)', color: 'var(--danger-600)', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
                <span>⚠</span><span>{formError}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, height: 42 }}>
              {loading ? <span className="spinner" /> : 'Create account'}
            </button>
          </form>

          <p className="text-muted" style={{ fontSize: 13, marginTop: 24, textAlign: 'center' }}>
            Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
