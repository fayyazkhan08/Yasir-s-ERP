import { InputHTMLAttributes, useMemo, useState } from 'react';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  showStrength?: boolean;
}

function scorePassword(pw: string): { score: number; label: string; className: string } {
  if (!pw) return { score: 0, label: '', className: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { score, label: 'Weak', className: 'filled-weak' };
  if (score <= 3) return { score, label: 'Fair', className: 'filled-fair' };
  return { score, label: 'Strong', className: 'filled-strong' };
}

export function PasswordField({ label, error, hint, required, showStrength, value, className, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = useMemo(() => scorePassword(String(value || '')), [value]);

  return (
    <div className="field">
      <label>{label}{required && <span style={{ color: 'var(--danger-600)' }}> *</span>}</label>
      <div className="password-field">
        <input
          type={visible ? 'text' : 'password'}
          className={`input ${error ? 'has-error' : ''} ${className || ''}`}
          value={value}
          {...rest}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
      {showStrength && value ? (
        <div>
          <div className="strength-meter">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`strength-bar ${i < strength.score ? strength.className : ''}`} />
            ))}
          </div>
          <span
            className="strength-label"
            style={{ color: strength.className === 'filled-weak' ? 'var(--danger-600)' : strength.className === 'filled-fair' ? 'var(--accent-600)' : 'var(--success-600)' }}
          >
            {strength.label}
          </span>
        </div>
      ) : error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
