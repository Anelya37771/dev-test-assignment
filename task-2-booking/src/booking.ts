import { randomUUID } from 'node:crypto';
import type { Booking, Master, Service } from './types.ts';
import type { BookingRepo } from './store.ts';
import { getSlots } from './slots.ts';
import { isValidDate, toLocal } from './time.ts';
import { normalizePhone } from './phone.ts';
import { createKeyedLock } from './lock.ts';
import { now as systemNow } from './clock.ts';

export type Reply = { status: number; body: unknown };

const CANCEL_DEADLINE_MS = 2 * 60 * 60 * 1000;
// ISO-строка обязательно с часовым поясом: Z или ±HH:MM
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

type Deps = { repo: BookingRepo; masters: Master[]; services: Service[]; now?: () => Date };

export function createBookingService({ repo, masters, services, now = systemNow }: Deps) {
  const withLock = createKeyedLock();
  const error = (status: number, code: string): Reply => ({ status, body: { error: code } });

  // Общие проверки мастера и услуги: 404 — нет такого, 400 — мастер не оказывает услугу
  function find(masterId: unknown, serviceId: unknown) {
    const master = masters.find((m) => m.id === masterId);
    const service = services.find((s) => s.id === serviceId);
    if (!master) return error(404, 'master_not_found');
    if (!service) return error(404, 'service_not_found');
    if (!service.masterIds.includes(master.id)) return error(400, 'service_not_offered');
    return { master, service };
  }

  return {
    async slots(masterId: string, serviceId: string | null, date: string | null): Promise<Reply> {
      if (!serviceId || !isValidDate(date)) return error(400, 'invalid_params');
      const found = find(masterId, serviceId);
      if ('status' in found) return found;

      const bookings = await repo.listByMaster(masterId);
      const slots = getSlots(found.master, found.service, date, bookings, now());
      return { status: 200, body: { masterId, serviceId, date, slots } };
    },

    async create(input: unknown): Promise<Reply> {
      const body = (input ?? {}) as Record<string, unknown>;
      const { masterId, serviceId, start } = body;
      if (typeof masterId !== 'string' || typeof serviceId !== 'string') return error(400, 'invalid_params');
      if (typeof start !== 'string' || !ISO_WITH_TZ.test(start) || Number.isNaN(Date.parse(start))) {
        return error(400, 'invalid_start');
      }
      const clientPhone = normalizePhone(body.clientPhone);
      if (!clientPhone) return error(400, 'invalid_phone');

      const found = find(masterId, serviceId);
      if ('status' in found) return found;
      const { master, service } = found;

      const startMs = Date.parse(start);
      const local = toLocal(startMs);

      // Проверка слота и запись — под одной блокировкой на мастера,
      // иначе два одновременных запроса оба увидят слот свободным
      return withLock(master.id, async () => {
        const bookings = await repo.listByMaster(master.id);
        const free = getSlots(master, service, local.date, bookings, now());
        if (startMs % 60_000 !== 0 || !free.includes(local.time)) return error(409, 'slot_unavailable');

        const booking: Booking = {
          id: `bk-${randomUUID()}`,
          masterId: master.id,
          serviceId: service.id,
          start: new Date(startMs).toISOString(),
          end: new Date(startMs + service.durationMin * 60_000).toISOString(),
          clientPhone,
          status: 'active',
        };
        await repo.insert(booking);
        return { status: 201, body: booking };
      });
    },

    async cancel(id: string): Promise<Reply> {
      const booking = await repo.get(id);
      if (!booking) return error(404, 'booking_not_found');
      // повторная отмена — не ошибка
      if (booking.status === 'cancelled') return { status: 200, body: booking };
      if (Date.parse(booking.start) - now().getTime() < CANCEL_DEADLINE_MS) return error(409, 'too_late');

      await repo.update(id, { status: 'cancelled' });
      return { status: 200, body: { ...booking, status: 'cancelled' } };
    },
  };
}