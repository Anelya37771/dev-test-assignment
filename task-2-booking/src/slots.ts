import type { Booking, Master, Service } from './types.ts';
import { fromMinutes, localToUtcMs, overlaps, toMinutes, weekday } from './time.ts';
import { now } from './clock.ts';

export const SLOT_STEP_MIN = 15;

// Свободные слоты мастера на дату, 'HH:mm' по Алматы
export function getSlots(
  master: Master,
  service: Service,
  date: string,
  bookings: Booking[],
  at: Date = now(),
): string[] {
  const day = master.schedule[weekday(date)];
  if (!day) return [];

  // Перерывы — в минутах от начала суток, записи — в мс UTC
  const breaks = day.breaks.map((br) => ({ start: toMinutes(br.from), end: toMinutes(br.to) }));
  const busy = bookings
    .filter((b) => b.masterId === master.id && b.status === 'active')
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  const nowMs = at.getTime();

  const result: string[] = [];
  const end = toMinutes(day.to);
  for (let t = toMinutes(day.from); t + service.durationMin <= end; t += SLOT_STEP_MIN) {
    if (breaks.some((br) => overlaps({ start: t, end: t + service.durationMin }, br))) continue;

    const startMs = localToUtcMs(date, fromMinutes(t));
    if (startMs <= nowMs) continue;

    const slot = { start: startMs, end: startMs + service.durationMin * 60_000 };
    if (busy.some((b) => overlaps(slot, b))) continue;

    result.push(fromMinutes(t));
  }
  return result;
}