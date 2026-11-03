import type { Assignment, Branch, Order, Rule } from './types.ts';
import { distanceKm } from './geo.ts';

// Сколько заказов уже закреплено за филиалом в сутки этого заказа (по Алматы)
export type AssignedCount = (branchId: string) => number;

export function assignBranch(order: Order, branches: Branch[], assignedCount: AssignedCount = () => 0): Assignment {
  const own = branches.filter((b) => b.storeId === order.storeId && b.active);

  // manual лимит не проверяет: менеджер решил сам
  if (order.manualBranchId) {
    const manual = own.find((b) => b.id === order.manualBranchId);
    if (manual) return { orderId: order.id, branchId: manual.id, rule: 'manual' };
  }

  const picked = pickByRules(order, own);
  if (!picked) return { orderId: order.id, branchId: null, rule: 'unassigned' };

  const isFull = (b: Branch) => assignedCount(b.id) >= b.dailyLimit;
  if (!isFull(picked.branch)) {
    return { orderId: order.id, branchId: picked.branch.id, rule: picked.rule };
  }

  // Выбранный филиал заполнен: ближайший незаполненный филиал магазина
  const fallback = findNearest(order, own.filter((b) => !isFull(b)));
  if (fallback) return { orderId: order.id, branchId: fallback.id, rule: 'geo' };

  return { orderId: order.id, branchId: null, rule: 'unassigned' };
}

// Правила single, pickup_point, city, geo по порядку, без учёта лимита
function pickByRules(order: Order, own: Branch[]): { branch: Branch; rule: Rule } | null {
  if (own.length === 1) return { branch: own[0], rule: 'single' };

  const pickupPointId = order.pickupPointId;
  if (pickupPointId) {
    const byPickup = own.find((b) => b.pickupPointIds.includes(pickupPointId));
    if (byPickup) return { branch: byPickup, rule: 'pickup_point' };
  }

  const inCity = own.filter((b) => b.city === order.city);
  if (inCity.length === 1) return { branch: inCity[0], rule: 'city' };

  // Если в городе заказа несколько филиалов — ищем среди них, иначе среди всех
  const nearest = findNearest(order, inCity.length > 1 ? inCity : own);
  if (nearest) return { branch: nearest, rule: 'geo' };

  return null;
}

function findNearest(order: Order, branches: Branch[]): Branch | null {
  if (order.lat === null || order.lon === null) return null;

  let best: Branch | null = null;
  let bestDist = Infinity;
  for (const b of branches) {
    const d = distanceKm(order.lat, order.lon, b.lat, b.lon);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}