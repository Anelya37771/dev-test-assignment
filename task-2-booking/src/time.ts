import type { Weekday } from './types.ts';

// Казахстан живёт в одном часовом поясе
export const TZ_OFFSET = '+05:00';

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// date: 'YYYY-MM-DD'
export function weekday(date: string): Weekday {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export type Range = { start: number; end: number };

export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

// Местное время Алматы на дату -> момент времени в мс (UTC)
export function localToUtcMs(date: string, hhmm: string): number {
  return Date.parse(`${date}T${hhmm}:00${TZ_OFFSET}`);
}


// 'YYYY-MM-DD' и такая дата реально существует (2030-02-30 — нет)
export function isValidDate(date: string | null): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

// Момент времени (мс UTC) -> дата и время по Алматы: { date: '2030-11-18', time: '15:00' }
export function toLocal(ms: number): { date: string; time: string } {
  const iso = new Date(ms + 5 * 60 * 60 * 1000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}