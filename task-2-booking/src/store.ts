import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Booking, Master, Service } from './types.ts';

const dataDir = process.env.DATA_DIR ?? join(import.meta.dirname, '..', 'data');

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as T;
}

export const masters: Master[] = load('masters.json');
export const services: Service[] = load('services.json');

// Имитация сетевой задержки до БД. Не убирать: в проде запросы тоже не мгновенные.
const latency = () => new Promise((r) => setTimeout(r, 5 + Math.random() * 15));

export type BookingRepo = ReturnType<typeof createBookingRepo>;

// Фабрика нужна для тестов: у каждого теста своё хранилище с той же задержкой
export function createBookingRepo(bookings: Booking[]) {
  return {
    async listByMaster(masterId: string): Promise<Booking[]> {
      await latency();
      return bookings.filter((b) => b.masterId === masterId).map((b) => ({ ...b }));
    },

    async get(id: string): Promise<Booking | null> {
      await latency();
      const found = bookings.find((b) => b.id === id);
      return found ? { ...found } : null;
    },

    async insert(booking: Booking): Promise<void> {
      await latency();
      bookings.push({ ...booking });
    },

    async update(id: string, patch: Partial<Booking>): Promise<void> {
      await latency();
      const found = bookings.find((b) => b.id === id);
      if (found) Object.assign(found, patch);
    },
  };
}

export const bookingRepo = createBookingRepo(load('bookings.json'));