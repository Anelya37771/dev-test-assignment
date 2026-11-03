// Сутки для лимита считаются по Алматы (UTC+5)
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

// '2026-11-15T19:30:00Z' -> '2026-11-16' (в Алматы уже 00:30 следующего дня)
export function almatyDate(iso: string): string {
  return new Date(new Date(iso).getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}


export function isValidDate(date: string | null): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}