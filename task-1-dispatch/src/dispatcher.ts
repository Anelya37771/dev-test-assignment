import type { Assignment, Branch, Order } from './types.ts';
import { assignBranch } from './router.ts';
import { almatyDate } from './time.ts';

export type BranchLoad = { branchId: string; date: string; assigned: number; limit: number };

export function createDispatcher(branches: Branch[], orders: Order[], assignments = new Map<string, Assignment>()) {
  const orderById = new Map(orders.map((o) => [o.id, o]));

  // Сколько заказов закреплено за филиалом в эти сутки по Алматы
  function countAssigned(branchId: string, date: string): number {
    let count = 0;
    for (const a of assignments.values()) {
      const order = orderById.get(a.orderId);
      if (a.branchId === branchId && order && almatyDate(order.createdAt) === date) count++;
    }
    return count;
  }

  return {
    // null — такого заказа нет
    assign(orderId: string): Assignment | null {
      const order = orderById.get(orderId);
      if (!order) return null;

      // Повторный вызов возвращает сохранённое распределение и не занимает лимит ещё раз
      const existing = assignments.get(orderId);
      if (existing) return existing;

      const date = almatyDate(order.createdAt);
      const result = assignBranch(order, branches, (branchId) => countAssigned(branchId, date));
      assignments.set(orderId, result);
      return result;
    },

    // null — такого филиала нет
    load(branchId: string, date: string): BranchLoad | null {
      const branch = branches.find((b) => b.id === branchId);
      if (!branch) return null;
      return { branchId, date, assigned: countAssigned(branchId, date), limit: branch.dailyLimit };
    },
  };
}