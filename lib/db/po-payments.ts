/**
 * po_payments queries — server-side (React.cache)
 */
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PoPayment } from "@/lib/types/db";

/**
 * Payments for a single PO — เรียงล่าสุดก่อน
 */
export const getPaymentsForPo = cache(async (
  poId: string,
): Promise<PoPayment[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("po_payments" as never)
    .select("*")
    .eq("po_id", poId)
    .order("paid_date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as PoPayment[];
});

/**
 * ถ้า payment_group_id ตรงกัน = รูดครั้งเดียวจ่ายหลาย PO
 * → return sibling payments (PO อื่น ๆ ในกลุ่ม)
 */
export async function getSiblingPayments(
  paymentGroupId: string,
  excludePaymentId?: string,
): Promise<Array<PoPayment & { po_number?: string; supplier_name?: string }>> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("po_payments" as never)
    .select("*, purchase_orders!inner(po_number, supplier_name)")
    .eq("payment_group_id", paymentGroupId);
  if (excludePaymentId) q = q.neq("id", excludePaymentId);
  const { data } = await q;
  type Row = PoPayment & {
    purchase_orders?: { po_number?: string; supplier_name?: string };
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    po_number: r.purchase_orders?.po_number,
    supplier_name: r.purchase_orders?.supplier_name,
  }));
}

export interface MyPaymentsFilters {
  userId: string;
  reimbursed?: boolean | "all";
  from?: string;      // YYYY-MM-DD
  to?: string;
}

export interface MyPaymentRow extends PoPayment {
  po_number: string;
  po_supplier_name: string | null;
}

/**
 * Payments ของ user นี้ (พนักงาน view / admin filter)
 * Join กับ purchase_orders เพื่อดึง po_number + supplier_name
 */
export const getMyPayments = cache(async (
  filters: MyPaymentsFilters,
): Promise<MyPaymentRow[]> => {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("po_payments" as never)
    .select("*, purchase_orders!inner(po_number, supplier_name)")
    .eq("paid_by_user_id", filters.userId);

  if (filters.reimbursed === true) q = q.eq("reimbursed", true);
  else if (filters.reimbursed === false) q = q.eq("reimbursed", false);
  // "all" = ไม่ filter

  if (filters.from) q = q.gte("paid_date", filters.from);
  if (filters.to) q = q.lte("paid_date", filters.to);

  const { data } = await q
    .order("paid_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  type Row = PoPayment & {
    purchase_orders?: { po_number: string; supplier_name: string | null };
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    po_number: r.purchase_orders?.po_number ?? "",
    po_supplier_name: r.purchase_orders?.supplier_name ?? null,
  }));
});

/**
 * KPI aging — ยอดค้างเบิก per user (admin dashboard)
 */
export interface PayerAging {
  paid_by_user_id: string;
  paid_by_name: string;
  count: number;
  total_amount: number;
  oldest_paid_date: string;
  days_oldest: number;
}

export const getPayerAging = cache(async (): Promise<PayerAging[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("po_payments" as never)
    .select("paid_by_user_id, paid_by_name, amount, paid_date")
    .eq("reimbursed", false)
    .order("paid_date", { ascending: true })
    .limit(2000);

  type Row = {
    paid_by_user_id: string;
    paid_by_name: string;
    amount: number;
    paid_date: string;
  };
  const rows = (data ?? []) as Row[];

  // Aggregate ใน JS (ไม่มี group by function ใน supabase-js query ตรงๆ)
  const map = new Map<string, PayerAging>();
  const today = new Date().toISOString().slice(0, 10);
  for (const r of rows) {
    let cur = map.get(r.paid_by_user_id);
    if (!cur) {
      cur = {
        paid_by_user_id: r.paid_by_user_id,
        paid_by_name: r.paid_by_name,
        count: 0,
        total_amount: 0,
        oldest_paid_date: r.paid_date,
        days_oldest: 0,
      };
      map.set(r.paid_by_user_id, cur);
    }
    cur.count++;
    cur.total_amount += Number(r.amount);
    if (r.paid_date < cur.oldest_paid_date) cur.oldest_paid_date = r.paid_date;
  }

  // Compute days_oldest
  for (const cur of map.values()) {
    const oldest = new Date(cur.oldest_paid_date).getTime();
    const now = new Date(today).getTime();
    cur.days_oldest = Math.floor((now - oldest) / 86_400_000);
  }

  return Array.from(map.values()).sort((a, b) => b.days_oldest - a.days_oldest);
});

/**
 * บัตรที่ user เคยใช้ล่าสุด — dropdown auto-suggest
 * ไม่ต้องมี credit_cards table
 */
export const getRecentCardsForUser = cache(async (
  userId: string,
  limit = 5,
): Promise<string[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("po_payments" as never)
    .select("card_display, created_at")
    .eq("paid_by_user_id", userId)
    .not("card_display", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = { card_display: string | null; created_at: string };
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of ((data ?? []) as Row[])) {
    if (!r.card_display) continue;
    const key = r.card_display.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
});
