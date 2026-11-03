import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSlots } from '../src/slots.ts';
import { overlaps, toMinutes } from '../src/time.ts';
import type { Booking, Master, Service } from '../src/types.ts';

const day = { from: '10:00', to: '13:00', breaks: [] };

const master: Master = {
  id: 'm-1',
  name: 'Тест',
  schedule: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: null, sun: null },
};

const cut: Service = { id: 's-cut', name: 'Стрижка', durationMin: 60, masterIds: ['m-1'] };

const range = (from: string, to: string) => ({ start: toMinutes(from), end: toMinutes(to) });

// «Сейчас» для тестов: задолго до 2030-11-18, чтобы прошедшее время не влияло на результат
const EARLIER = new Date('2030-11-01T00:00:00Z');

test('overlaps: пересекающиеся интервалы', () => {
  assert.equal(overlaps(range('10:00', '11:00'), range('10:30', '11:30')), true);
});

test('overlaps: запись сразу после другой не пересекается', () => {
  assert.equal(overlaps(range('10:00', '11:00'), range('11:00', '12:00')), false);
});

test('getSlots: свободный день', () => {
  // 2030-11-18 — понедельник
  const slots = getSlots(master, cut, '2030-11-18', [], EARLIER);
  assert.deepEqual(slots, ['10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00']);
});

test('getSlots: выходной', () => {
  assert.deepEqual(getSlots(master, cut, '2030-11-23', [], EARLIER), []);
});

const booking = (over: Partial<Booking>): Booking => ({
  id: 'bk-1',
  masterId: 'm-1',
  serviceId: 's-cut',
  start: '2030-11-18T05:00:00.000Z',
  end: '2030-11-18T06:00:00.000Z',
  clientPhone: '+77012345678',
  status: 'active',
  ...over,
});

test('getSlots: слот не пересекает перерыв', () => {
  const withBreak = { from: '10:00', to: '13:00', breaks: [{ from: '11:00', to: '11:30' }] };
  const m: Master = { ...master, schedule: { ...master.schedule, mon: withBreak } };
  // 10:00–11:00 заканчивается ровно к перерыву, 11:30 начинается сразу после него
  assert.deepEqual(getSlots(m, cut, '2030-11-18', [], EARLIER), ['10:00', '11:30', '11:45', '12:00']);
});

test('getSlots: занятое время не выдаётся, отменённые записи не мешают', () => {
  const bookings = [
    // 10:30–11:30 по Алматы
    booking({ start: '2030-11-18T05:30:00.000Z', end: '2030-11-18T06:30:00.000Z' }),
    // отменённая 12:00–13:00 не мешает
    booking({ id: 'bk-2', start: '2030-11-18T07:00:00.000Z', end: '2030-11-18T08:00:00.000Z', status: 'cancelled' }),
    // запись другого мастера не мешает
    booking({ id: 'bk-3', masterId: 'm-2', start: '2030-11-18T06:30:00.000Z', end: '2030-11-18T07:30:00.000Z' }),
  ];
  assert.deepEqual(getSlots(master, cut, '2030-11-18', bookings, EARLIER), ['11:30', '11:45', '12:00']);
});

test('getSlots: прошедшее время не выдаётся', () => {
  // сейчас 10:30 по Алматы: слот 10:30 уже начался, первый подходящий — 10:45
  const at = new Date('2030-11-18T05:30:00Z');
  assert.deepEqual(getSlots(master, cut, '2030-11-18', [], at), ['10:45', '11:00', '11:15', '11:30', '11:45', '12:00']);
});