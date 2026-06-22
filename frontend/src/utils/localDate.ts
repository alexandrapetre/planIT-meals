/** Calendar date as YYYY-MM-DD in the user's local timezone (not UTC). */
export function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalDateKey(key: string): Date {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

export function shiftLocalDateKey(key: string, deltaDays: number): string {
  const d = parseLocalDateKey(key);
  d.setDate(d.getDate() + deltaDays);
  return formatLocalDateKey(d);
}

export function todayLocalDateKey(): string {
  return formatLocalDateKey(new Date());
}
