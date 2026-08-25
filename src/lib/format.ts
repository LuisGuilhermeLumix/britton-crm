const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const FMT_LONG = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
const FMT_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const FMT_TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

export function money(value: number): string {
  return USD.format(value);
}

/** Abbreviated home value, as in the demo: $685k / $1.2M */
export function shortValue(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return USD.format(value);
}

export function longDate(iso: string): string {
  return FMT_LONG.format(new Date(iso));
}
export function shortDate(iso: string | Date): string {
  return FMT_SHORT.format(typeof iso === 'string' ? new Date(iso) : iso);
}
export function timeOfDay(iso: string): string {
  return FMT_TIME.format(new Date(iso));
}

/**
 * "Aug 25 · 3:41 PM" — several pulls can land on the same day, so the hour
 * is what tells them apart on a card.
 */
export function dateTime(iso: string): string {
  return `${shortDate(iso)} · ${timeOfDay(iso)}`;
}

/** US phone display: (801) 555-1234 when we get 10 digits, otherwise as stored. */
export function phoneDisplay(phone: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length === 10) return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  return phone;
}

/** tel: href — digits only, keeps a leading + if present. */
export function phoneHref(phone: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/* ---- local-date helpers (never use toISOString for calendar days) ---- */

export function ymd(date: Date): string {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

export function parseYMD(value: string): Date | null {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}
