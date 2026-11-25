import { useState } from 'react';
import { UNIT_OPTIONS } from '../../constants/units';

interface UnitSelectProps {
  value: string;
  onChange: (unit: string) => void;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

const CUSTOM = '__custom__';

/**
 * Dropdown of the standard units (Liters, KGS, NOS, PCS, SQ FT., QTY) with an
 * "Other…" choice that turns it into a text box so any unit can be typed manually.
 * A value that isn't in the list (e.g. loaded from an older record) opens in manual mode automatically.
 */
export function UnitSelect({ value, onChange, style, ariaLabel = 'Unit' }: UnitSelectProps) {
  const [manual, setManual] = useState(false);
  const isManual = manual || (!!value && !(UNIT_OPTIONS as readonly string[]).includes(value));

  if (isManual) {
    return (
      <div className="flex items-center gap-1" style={style}>
        <input
          className="input" style={{ minWidth: 0, flex: 1 }} placeholder="Type unit" maxLength={20} autoFocus={manual}
          aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button" className="btn btn-ghost btn-icon" title="Pick from the list"
          onClick={() => { setManual(false); onChange(''); }}
        >↩</button>
      </div>
    );
  }

  return (
    <select
      className="select" style={style} aria-label={ariaLabel} value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM) { setManual(true); onChange(''); }
        else onChange(e.target.value);
      }}
    >
      <option value="">Unit…</option>
      {UNIT_OPTIONS.map((u : any) => <option key={u} value={u}>{u}</option>)}
      <option value={CUSTOM}>Other (type manually)…</option>
    </select>
  );
}