/**
 * Budget queries — งบประมาณรายเดือน/ไตรมาส/ปี
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface Budget {
  id: string;
  period_type: "monthly" | "quarterly" | "yearly";
  period_year: number;
  period_month: number | null;   // 1-12 monthly, 1/4/7/10 quarterly, null yearly
  category: string | null;       // null = รวมทุกหมวด
  amount: number;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

export async function listBudgets(year?: number): Promise<Budget[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("budget_periods" as never).select("*");
  if (year) q = q.eq("period_year", year);
  const { data } = await q
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: true });
  return (data ?? []) as unknown as Budget[];
}

/** คำนวณยอดใช้จริงในช่วงเวลา */
export async function calculateActualSpending(
  year: number,
  month: number | null = null,
  category: string | null = null,
): Promise<number> {
  const sb = getSupabaseAdmin();
  const start = month != null
    ? new Date(year, month - 1, 1).toISOString().slice(0, 10)
    : new Date(year, 0, 1).toISOString().slice(0, 10);
  const end = month != null
    ? (month === 12
        ? new Date(year + 1, 0, 1)
        : new Date(year, month, 1)).toISOString().slice(0, 10)
    : new Date(year + 1, 0, 1).toISOString().slice(0, 10);

  const { data } = await sb
    .from("purchase_orders")
    .select("total, items, ordered_date, status")
    .gte("ordered_date", start)
    .lt("ordered_date", end)
    .in("status", ["สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์"]);

  let total = 0;
  if (!category) {
    for (const p of (data ?? []) as Array<{ total: number | null }>) {
      total += p.total ?? 0;
    }
    return total;
  }

  // Filter by category — must JOIN with equipment.category
  const eqIds = new Set<string>();
  for (const p of (data ?? []) as Array<{ items: Array<{ equipment_id: string | null }> | null }>) {
    for (const it of p.items ?? []) {
      if (it.equipment_id) eqIds.add(it.equipment_id);
    }
  }
  if (eqIds.size === 0) return 0;

  const { data: eqs } = await sb
    .from("equipment")
    .select("id, category")
    .in("id", Array.from(eqIds));
  const catMap = new Map(((eqs ?? []) as Array<{ id: string; category: string | null }>)
    .map((e) => [e.id, e.category]));

  for (const p of (data ?? []) as Array<{
    items: Array<{ equipment_id: string | null; subtotal: number | null }> | null;
  }>) {
    for (const it of p.items ?? []) {
      if (it.equipment_id && catMap.get(it.equipment_id) === category) {
        total += it.subtotal ?? 0;
      }
    }
  }
  return total;
}

export interface BudgetStatus extends Budget {
  actual: number;
  remaining: number;
  percent: number;
  status: "ok" | "warning" | "critical" | "over";
}

export async function getBudgetStatusForMonth(
  year: number, month: number,
): Promise<BudgetStatus[]> {
  const budgets = (await listBudgets(year)).filter((b) => {
    if (b.period_type === "monthly" && b.period_month === month) return true;
    if (b.period_type === "yearly") return true;
    if (b.period_type === "quarterly" && b.period_month) {
      return Math.floor((b.period_month - 1) / 3) === Math.floor((month - 1) / 3);
    }
    return false;
  });

  const results: BudgetStatus[] = [];
  for (const b of budgets) {
    let actual: number;
    if (b.period_type === "monthly") {
      actual = await calculateActualSpending(year, b.period_month, b.category);
    } else if (b.period_type === "yearly") {
      actual = await calculateActualSpending(year, null, b.category);
    } else {
      // quarterly — รวม 3 เดือน
      actual = 0;
      if (b.period_month) {
        const qStart = Math.floor((b.period_month - 1) / 3) * 3 + 1;
        for (let m = qStart; m < qStart + 3; m++) {
          actual += await calculateActualSpending(year, m, b.category);
        }
      }
    }
    const pct = b.amount > 0 ? (actual / b.amount) * 100 : 0;
    const status: BudgetStatus["status"] =
      pct >= 100 ? "over" : pct >= 95 ? "critical" : pct >= 80 ? "warning" : "ok";
    results.push({
      ...b,
      actual,
      remaining: b.amount - actual,
      percent: pct,
      status,
    });
  }
  return results;
}
