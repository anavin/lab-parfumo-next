/**
 * Budget queries — งบประมาณรายเดือน/ไตรมาส/ปี
 *
 * ⚡ React.cache() — dedupe ใน same request
 *
 * Performance design:
 *   - Spending breakdown is fetched ONCE per (year, monthStart, monthEnd) tuple
 *     and bucketed by category in memory — multiple budgets sharing the same
 *     date range share one DB query.
 *   - Each budget then reads its month/quarter/year sum from the breakdown.
 */
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Budget, BudgetStatus } from "@/lib/types/db";

// Re-export for backwards compat (callers can still use lib/db/budget paths)
export type { Budget, BudgetStatus };

export const listBudgets = cache(async (year?: number): Promise<Budget[]> => {
  const sb = getSupabaseAdmin();
  let q = sb.from("budget_periods" as never).select("*");
  if (year) q = q.eq("period_year", year);
  const { data } = await q
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: true });
  return (data ?? []) as unknown as Budget[];
});

interface SpendingBreakdown {
  total: number;
  byCategory: Map<string, number>; // category → ยอด
}

/**
 * Aggregate PO spending in a date range — 1 query สำหรับ POs + 1 สำหรับ equipment category
 *
 * Cache key: (year, monthFrom, monthTo) → ถ้า 2 budget category ต่างกันแต่ช่วงเวลาเหมือนกัน
 * จะ share DB query (React.cache memoize ภายใน request)
 */
const getSpendingBreakdown = cache(
  async (year: number, monthFrom: number, monthTo: number): Promise<SpendingBreakdown> => {
    const sb = getSupabaseAdmin();
    // monthFrom..monthTo (1-indexed, inclusive)
    const startDate = new Date(year, monthFrom - 1, 1).toISOString().slice(0, 10);
    const endDate = (monthTo === 12
      ? new Date(year + 1, 0, 1)
      : new Date(year, monthTo, 1)
    ).toISOString().slice(0, 10);

    type PoRow = {
      total: number | null;
      items: Array<{
        equipment_id: string | null;
        subtotal: number | null;
        qty: number | null;
        unit_price: number | null;
      }> | null;
    };

    // Explicit cols — items JSONB ใช้สำหรับ category breakdown เท่านั้น
    const { data } = await sb
      .from("purchase_orders")
      .select("total, items")
      .gte("ordered_date", startDate)
      .lt("ordered_date", endDate)
      .in("status", ["สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์"])
      .is("deleted_at", null);

    const pos = (data ?? []) as PoRow[];

    // รวมยอดทั้งหมด — ใช้ po.total (เร็วสุด)
    let total = 0;
    for (const p of pos) total += p.total ?? 0;

    // รวบรวม equipment_ids ที่ต้อง lookup category
    const eqIds = new Set<string>();
    for (const p of pos) {
      for (const it of p.items ?? []) {
        if (it.equipment_id) eqIds.add(it.equipment_id);
      }
    }

    const byCategory = new Map<string, number>();
    if (eqIds.size === 0) {
      return { total, byCategory };
    }

    // 1 query — fetch ทุก equipment categories ที่เกี่ยวข้อง
    const { data: eqs } = await sb
      .from("equipment")
      .select("id, category")
      .in("id", Array.from(eqIds));
    const catMap = new Map<string, string | null>(
      ((eqs ?? []) as Array<{ id: string; category: string | null }>)
        .map((e) => [e.id, e.category]),
    );

    // bucket by category — subtotal ของแต่ละ item ที่มี equipment_id + category รู้จัก
    for (const p of pos) {
      for (const it of p.items ?? []) {
        if (!it.equipment_id) continue;
        const cat = catMap.get(it.equipment_id);
        if (!cat) continue;
        const amount = it.subtotal ?? ((it.qty ?? 0) * (it.unit_price ?? 0));
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + amount);
      }
    }

    return { total, byCategory };
  },
);

/** คำนวณยอดใช้จริงในช่วงเวลา — backward compat wrapper รอบ getSpendingBreakdown */
export const calculateActualSpending = cache(async (
  year: number,
  month: number | null = null,
  category: string | null = null,
): Promise<number> => {
  const monthFrom = month ?? 1;
  const monthTo = month ?? 12;
  const breakdown = await getSpendingBreakdown(year, monthFrom, monthTo);
  if (!category) return breakdown.total;
  return breakdown.byCategory.get(category) ?? 0;
});

export const getBudgetStatusForMonth = cache(async (
  year: number, month: number,
): Promise<BudgetStatus[]> => {
  const budgets = (await listBudgets(year)).filter((b) => {
    if (b.period_type === "monthly" && b.period_month === month) return true;
    if (b.period_type === "yearly") return true;
    if (b.period_type === "quarterly" && b.period_month) {
      return Math.floor((b.period_month - 1) / 3) === Math.floor((month - 1) / 3);
    }
    return false;
  });

  // Pre-fetch breakdowns ที่ใช้ — แต่ละ unique date range = 1 query
  // (React.cache จะ dedupe ระหว่าง budget ที่ใช้ range เดียวกัน)
  // - monthly → (month..month)
  // - quarterly → (qStart..qStart+2)  ทุก budget Q เดียวกันใช้ key เดียว
  // - yearly → (1..12)
  const uniqueRanges = new Set<string>();
  for (const b of budgets) {
    if (b.period_type === "monthly" && b.period_month) {
      uniqueRanges.add(`${b.period_month}-${b.period_month}`);
    } else if (b.period_type === "yearly") {
      uniqueRanges.add("1-12");
    } else if (b.period_type === "quarterly" && b.period_month) {
      const qStart = Math.floor((b.period_month - 1) / 3) * 3 + 1;
      uniqueRanges.add(`${qStart}-${qStart + 2}`);
    }
  }
  await Promise.all(
    Array.from(uniqueRanges).map((key) => {
      const [from, to] = key.split("-").map(Number);
      return getSpendingBreakdown(year, from, to);
    }),
  );

  const results = await Promise.all(budgets.map(async (b) => {
    let actual: number;
    if (b.period_type === "monthly" && b.period_month) {
      const bd = await getSpendingBreakdown(year, b.period_month, b.period_month);
      actual = b.category ? (bd.byCategory.get(b.category) ?? 0) : bd.total;
    } else if (b.period_type === "yearly") {
      const bd = await getSpendingBreakdown(year, 1, 12);
      actual = b.category ? (bd.byCategory.get(b.category) ?? 0) : bd.total;
    } else if (b.period_type === "quarterly" && b.period_month) {
      const qStart = Math.floor((b.period_month - 1) / 3) * 3 + 1;
      const bd = await getSpendingBreakdown(year, qStart, qStart + 2);
      actual = b.category ? (bd.byCategory.get(b.category) ?? 0) : bd.total;
    } else {
      actual = 0;
    }
    const pct = b.amount > 0 ? (actual / b.amount) * 100 : 0;
    const status: BudgetStatus["status"] =
      pct >= 100 ? "over" : pct >= 95 ? "critical" : pct >= 80 ? "warning" : "ok";
    return {
      ...b,
      actual,
      remaining: b.amount - actual,
      percent: pct,
      status,
    } as BudgetStatus;
  }));
  return results;
});
