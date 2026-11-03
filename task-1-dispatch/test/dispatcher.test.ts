import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDispatcher } from '../src/dispatcher.ts';
import { isValidDate } from '../src/time.ts';
import type { Branch, Order } from '../src/types.ts';

const branch = (over: Partial<Branch>): Branch => ({
  id: 'b-1',
  storeId: 's-1',
  name: 'Филиал',
  city: 'Алматы',
  lat: 43.24,
  lon: 76.91,
  active: true,
  pickupPointIds: [],
  dailyLimit: 100,
  ...over,
});

const order = (over: Partial<Order>): Order => ({
  id: 'o-1',
  storeId: 's-1',
  city: 'Алматы',
  lat: 43.25,
  lon: 76.92,
  pickupPointId: null,
  manualBranchId: null,
  createdAt: '2026-11-16T06:00:00Z',
  ...over,
});

// b-near ближе к заказам, но принимает только 1 заказ в сутки
const near = branch({ id: 'b-near', lat: 43.25, lon: 76.92, dailyLimit: 1 });
const far = branch({ id: 'b-far', lat: 43.2, lon: 76.85 });

test('assign: нет такого заказа', () => {
  const d = createDispatcher([near, far], []);
  assert.equal(d.assign('o-404'), null);
});

test('assign: повторный вызов возвращает то же распределение и не занимает лимит', () => {
  const d = createDispatcher([near, far], [order({ id: 'o-1' }), order({ id: 'o-2' })]);
  const first = d.assign('o-1');
  assert.deepEqual(d.assign('o-1'), first);
  assert.equal(d.load('b-near', '2026-11-16')?.assigned, 1);

  // лимит b-near занят первым заказом, второй уходит в b-far
  assert.deepEqual(d.assign('o-2'), { orderId: 'o-2', branchId: 'b-far', rule: 'geo' });
});

test('load: сутки считаются по Алматы', () => {
  // 19:30 UTC 15 ноября — это 00:30 16 ноября в Алматы
  const d = createDispatcher([near, far], [order({ id: 'o-1', createdAt: '2026-11-15T19:30:00Z' })]);
  d.assign('o-1');
  assert.deepEqual(d.load('b-near', '2026-11-16'), { branchId: 'b-near', date: '2026-11-16', assigned: 1, limit: 1 });
  assert.equal(d.load('b-near', '2026-11-15')?.assigned, 0);
});

test('load: нет такого филиала', () => {
  const d = createDispatcher([near], []);
  assert.equal(d.load('b-404', '2026-11-16'), null);
});

test('isValidDate: формат и существующая дата', () => {
  assert.equal(isValidDate('2026-11-16'), true);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('16.11.2026'), false);
  assert.equal(isValidDate(''), false);
  assert.equal(isValidDate(null), false);
});