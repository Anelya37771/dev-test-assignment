// Сутки для лимита считаются по Алматы (UTC+5)
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

// '2026-11-15T19:30:00Z' -> '2026-11-16' (в Алматы уже 00:30 следующего дня)
export function almatyDate(iso: string): string {
  return new Date(new Date(iso).getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}