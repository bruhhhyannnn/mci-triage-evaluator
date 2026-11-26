export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Parses "3:05", "03:05", "185" (seconds) into milliseconds; null if invalid. */
export function parseClock(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  const mmss = /^(\d{1,3}):([0-5]?\d)$/.exec(value);
  if (mmss) return (Number(mmss[1]) * 60 + Number(mmss[2])) * 1000;
  if (/^\d{1,5}$/.test(value)) return Number(value) * 1000;
  return null;
}

export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || 'No date';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function newId(prefix = 'id'): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Lowercase, accents removed, punctuation collapsed: used to match names. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * True when every word typed matches the start of a word in the name,
 * so "dela" and "cruz juan" both find "Juan Dela Cruz".
 */
export function nameMatches(name: string, query: string): boolean {
  const q = normalizeName(query);
  if (!q) return true;
  const words = normalizeName(name).split(' ');
  return q.split(' ').every((part) => words.some((w) => w.startsWith(part)));
}
