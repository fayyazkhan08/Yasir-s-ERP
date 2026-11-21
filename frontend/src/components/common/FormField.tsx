import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldWrapProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldWrap({ label, error, hint, required, children }: FieldWrapProps) {
  return (
    <div className="field">
      <label>{label}{required && <span style={{ color: 'var(--danger-600)' }}> *</span>}</label>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, required, className, ...rest }: TextFieldProps) {
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required}>
      <input className={`input ${error ? 'has-error' : ''} ${className || ''}`} {...rest} />
    </FieldWrap>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export function SelectField({ label, error, hint, required, options, placeholder, className, ...rest }: SelectFieldProps) {
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required}>
      <select className={`select ${error ? 'has-error' : ''} ${className || ''}`} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldWrap>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, required, className, ...rest }: TextAreaFieldProps) {
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required}>
      <textarea className={`textarea ${error ? 'has-error' : ''} ${className || ''}`} rows={3} {...rest} />
    </FieldWrap>
  );
}
