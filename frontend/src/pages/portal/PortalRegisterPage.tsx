import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortalAuth } from '../../context/PortalAuthContext';
import { PasswordField } from '../../components/common/PasswordField';
import { apiErrorMessage } from '../../api/client';

interface FormErrors { name?: string; mobile?: string; email?: string; password?: string; confirmPassword?: string; referral_code?: string; }

export function PortalRegisterPage() {
  const { user, register } = usePortalAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState((params.get('ref') || '').toUpperCase());
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/portal" replace />;

  const clear = () => setFormError('');

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) e.mobile = 'Enter a valid 10-digit mobile number';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Must be at least 8 characters';
    else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) e.password = 'Must include a letter and a number';
    if (confirmPassword !== password) e.confirmPassword = 'Passwords do not match';
    if (referralCode && !/^[A-Za-z0-9]{6,12}$/.test(referralCode)) e.referral_code = 'This code looks invalid';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        password,
        ...(referralCode ? { referral_code: referralCode.trim() } : {}),
      });
      navigate('/portal', { replace: true });
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
            Join, share your link, and earn from every referral.
          </h1>
        </div>
        <div className="auth-brand-content" style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.7 }}>
          Every account gets a personal referral link.<br />
          Earn a commission when people you refer subscribe.
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div style={{ marginBottom: 24 }}>
            <h2>Create your account</h2>
            <p className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>It only takes a minute</p>
          </div>

          <form className="flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>Full Name</label>
              <input className={`input ${errors.name ? 'has-error' : ''}`} value={name} autoComplete="name" onChange={(e) => { setName(e.target.value); clear(); }} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="field">
              <label>Mobile</label>
              <input className={`input ${errors.mobile ? 'has-error' : ''}`} inputMode="numeric" maxLength={10} placeholder="10-digit number" value={mobile} autoComplete="tel-national" onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '')); clear(); }} />
              {errors.mobile && <span className="field-error">{errors.mobile}</span>}
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" className={`input ${errors.email ? 'has-error' : ''}`} value={email} autoComplete="email" onChange={(e) => { setEmail(e.target.value); clear(); }} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
            <PasswordField label="Password" placeholder="At least 8 characters" value={password} autoComplete="new-password" error={errors.password} showStrength onChange={(e) => { setPassword(e.target.value); clear(); }} />
            <PasswordField label="Confirm Password" placeholder="Re-enter your password" value={confirmPassword} autoComplete="new-password" error={errors.confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); clear(); }} />
            <div className="field">
              <label>Referral Code (optional)</label>
              <input className={`input mono ${errors.referral_code ? 'has-error' : ''}`} placeholder="Got a code from a friend?" value={referralCode} onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); clear(); }} />
              {errors.referral_code && <span className="field-error">{errors.referral_code}</span>}
            </div>

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
            Already have an account? <Link to="/portal/login" style={{ fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}