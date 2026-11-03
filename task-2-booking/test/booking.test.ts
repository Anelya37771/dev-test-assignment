import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBookingService } from '../src/booking.ts';
import { createBookingRepo } from '../src/store.ts';
import { normalizePhone } from '../src/phone.ts';
import type { Booking, Master, Service } from '../src/types.ts';

const day = { from: '10:00', to: '13:00', breaks: [] };
const master: Master = {
  id: 'm-1',
  name: 'Тест',
  schedule: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: null, sun: null },
};
const cut: Service = { id: 's-cut', name: 'Стрижка', durationMin: 60, masterIds: ['m-1'] };
const brows: Service = { id: 's-brows', name: 'Брови', durationMin: 30, masterIds: ['m-2'] };

// «Сейчас» — 2030-11-18 08:00 по Алматы (понедельник), до начала рабочего дня
const NOW = new Date('2030-11-18T03:00:00Z');

function setup(bookings: Booking[] = []) {
  const repo = createBookingRepo(bookings);
  const service = createBookingService({ repo, masters: [master], services: [cut, brows], now: () => NOW });
  return { repo, service };
}

const request = (over: Record<string, unknown> = {}) => ({
  masterId: 'm-1',
  serviceId: 's-cut',
  start: '2030-11-18T11:00:00+05:00',
  clientPhone: '8 (701) 234-56-78',
  ...over,
});

test('normalizePhone: разные форматы казахстанского мобильного', () => {
  for (const raw of ['+7 701 234 56 78', '87012345678', '8 (701) 234-56-78', '+7(701)234-56-78', '77012345678']) {
    assert.equal(normalizePhone(raw), '+77012345678', raw);
  }
});

test('normalizePhone: не мобильный или не казахстанский — null', () => {
  for (const raw of ['+7 727 234 56 78', '+8 701 234 56 78', '8701234567', '+7 701 234 56 789', '8-701-abc-56-78', '', 87012345678]) {
    assert.equal(normalizePhone(raw), null, String(raw));
  }
});

test('slots: 400, 404 и успешный ответ', async () => {
  const { service } = setup();
  assert.equal((await service.slots('m-1', null, '2030-11-18')).status, 400);
  assert.equal((await service.slots('m-1', 's-cut', '2030-13-01')).status, 400);
  assert.equal((await service.slots('m-1', 's-brows', '2030-11-18')).status, 400);
  assert.equal((await service.slots('m-404', 's-cut', '2030-11-18')).status, 404);
  assert.equal((await service.slots('m-1', 's-404', '2030-11-18')).status, 404);

  const ok = await service.slots('m-1', 's-cut', '2030-11-18');
  assert.equal(ok.status, 200);
  assert.deepEqual((ok.body as { slots: string[] }).slots.slice(0, 2), ['10:00', '10:15']);
});

test('create: запись создаётся, время в UTC, телефон нормализован', async () => {
  const { service } = setup();
  const res = await service.create(request());
  assert.equal(res.status, 201);
  const b = res.body as Booking;
  assert.equal(b.start, '2030-11-18T06:00:00.000Z');
  assert.equal(b.end, '2030-11-18T07:00:00.000Z');
  assert.equal(b.clientPhone, '+77012345678');
  assert.equal(b.status, 'active');

  // это время теперь занято
  const again = await service.create(request({ clientPhone: '+7 702 000 00 00' }));
  assert.deepEqual(again, { status: 409, body: { error: 'slot_unavailable' } });
});

test('create: start в другом часовом поясе — тот же слот', async () => {
  const { service } = setup();
  const res = await service.create(request({ start: '2030-11-18T06:00:00Z' }));
  assert.equal(res.status, 201);
});

test('create: ошибки ввода и недоступное время', async () => {
  const { service } = setup();
  assert.equal((await service.create(request({ clientPhone: '12345' }))).status, 400);
  assert.equal((await service.create(request({ start: '2030-11-18T11:00:00' }))).status, 400); // без пояса
  assert.equal((await service.create(null)).status, 400);
  assert.equal((await service.create(request({ start: '2030-11-18T11:05:00+05:00' }))).status, 409); // не на сетке
  assert.equal((await service.create(request({ start: '2030-11-18T12:30:00+05:00' }))).status, 409); // не влезает
});

test('create: при одновременном бронировании создаётся только одна запись', async () => {
  const { repo, service } = setup();
  const results = await Promise.all([
    service.create(request({ clientPhone: '+7 701 111 11 11' })),
    service.create(request({ clientPhone: '+7 702 222 22 22' })),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await repo.listByMaster('m-1')).length, 1);
});

const existing: Booking = {
  id: 'bk-1',
  masterId: 'm-1',
  serviceId: 's-cut',
  start: '2030-11-18T06:00:00.000Z', // 11:00 по Алматы, через 3 часа после NOW
  end: '2030-11-18T07:00:00.000Z',
  clientPhone: '+77012345678',
  status: 'active',
};

test('cancel: отмена и повторная отмена', async () => {
  const { service } = setup([{ ...existing }]);
  const first = await service.cancel('bk-1');
  assert.equal(first.status, 200);
  assert.equal((first.body as Booking).status, 'cancelled');
  assert.equal((await service.cancel('bk-1')).status, 200);
  assert.equal((await service.cancel('bk-404')).status, 404);
});

test('cancel: меньше чем за 2 часа — too_late', async () => {
  // начало через 1 час 59 минут
  const soon = { ...existing, start: '2030-11-18T04:59:00.000Z', end: '2030-11-18T05:59:00.000Z' };
  const { service } = setup([soon]);
  assert.deepEqual(await service.cancel('bk-1'), { status: 409, body: { error: 'too_late' } });
});

test('cancel: отменённое время снова доступно', async () => {
  const { service } = setup([{ ...existing }]);
  await service.cancel('bk-1');
  assert.equal((await service.create(request())).status, 201);
});