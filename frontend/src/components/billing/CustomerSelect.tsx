import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useDebounce } from '../../hooks/useDebounce';
import { Customer } from '../../types';

interface CustomerSelectProps {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  error?: string;
  label?: string;
}

export function CustomerSelect({ value, onChange, error, label = 'Customer' }: CustomerSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 300);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    api.get('/customers', { params: { search: debounced, limit: 8 } }).then((res) => setResults(res.data.data));
  }, [debounced]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="field" ref={wrapRef} style={{ position: 'relative' }}>
      <label>{label} <span style={{ color: 'var(--danger-600)' }}>*</span></label>
      {value ? (
        <div className="flex items-center justify-between" style={{ border: '1px solid var(--border-strong)', borderRadius: 6, padding: '10px 12px' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{value.name}</div>
            <div className="text-muted mono" style={{ fontSize: 11.5 }}>{value.mobile}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Change</button>
        </div>
      ) : (
        <>
          <input
            className={`input ${error ? 'has-error' : ''}`}
            placeholder="Search by name or mobile…"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          />
          {open && results.length > 0 && (
            <div
              className="card"
              style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, maxHeight: 220, overflowY: 'auto' }}
            >
              {results.map((c) => (
                <div
                  key={c.id}
                  onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
                  style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-sunken)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                  <div className="text-muted mono" style={{ fontSize: 11.5 }}>{c.mobile} · {c.customer_code}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
