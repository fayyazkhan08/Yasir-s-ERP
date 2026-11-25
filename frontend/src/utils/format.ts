/**
 * Dates from the dealer-order API arrive as plain 'YYYY-MM-DD' strings (no time zone), so they are
 * split and formatted directly — building a Date from them would shift the day for some time zones.
 * Anything else (e.g. ISO timestamps from other modules) goes through Date as before.
 */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** 10.00 -> "10", 2.50 -> "2.5" */
export function formatQty(n: number | string): string {
  const v = Number(n);
  return Number.isFinite(v) ? String(parseFloat(v.toFixed(2))) : String(n);
}

export function formatMoney(n: number | string): string {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Today as YYYY-MM-DD in the user's own time zone (toISOString would give the UTC date). */
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Builds a WhatsApp chat link for an Indian mobile number (adds +91 for bare 10-digit numbers). */
export function whatsappLink(mobile: string, message: string): string {
  let digits = String(mobile).replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}