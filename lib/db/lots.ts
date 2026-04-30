/**
 * Lot/Batch queries (Phase E)
 *
 * lots ถูกสร้างอัตโนมัติเมื่อรับของ — 1 lot per equipment line per delivery
 * ดูได้ที่ /lots — admin/supervisor เท่านั้น
 */
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Lot, LotStatus, Withdrawal } from "@/lib/types/db";

export interface LotFilters {
  status?: LotStatus | "all";
  equipmentId?: string;
  /** lots ที่ใกล้หมดอายุภายใน N วัน */
  expiringWithinDays?: number;
  search?: string;
}

export const getLots = cache(async (filters: LotFilters = {}): Promise<Lot[]> => {
  const sb = getSupabaseAdmin();
  let q = sb.from("lots" as never).select("*");

  if (filters.status && filters.status !== "all") {
    q = q.eq("status", filters.status);
  }
  if (filters.equipmentId) {
    q = q.eq("equipment_id", filters.equipmentId);
  }
  if (filters.search) {
    const s = filters.search.trim();
    if (s) {
      q = q.or(
        `lot_no.ilike.%${s}%,equipment_name.ilike.%${s}%,supplier_lot_no.ilike.%${s}%`,
      );
    }
  }
  if (filters.expiringWithinDays && filters.expiringWithinDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + filters.expiringWithinDays);
    q = q
      .lte("expiry_date", cutoff.toISOString().slice(0, 10))
      .eq("status", "active");
  }

  const { data } = await q.order("received_date", { ascending: false }).limit(1000);
  return ((data ?? []) as unknown as Lot[]);
});

export const getLotById = cache(async (id: string): Promise<Lot | null> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("lots" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Lot) ?? null;
});

/** Withdrawals จาก lot นี้ */
export async function getWithdrawalsForLot(lotId: string): Promise<Withdrawal[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("withdrawals")
    .select("*")
    .eq("lot_id", lotId)
    .order("withdrawn_at", { ascending: false });
  return ((data ?? []) as unknown as Withdrawal[]);
}

/** active lots ของ equipment ตัวนี้ — เรียง FIFO (received_date ASC) */
export async function getActiveLotsForEquipment(
  equipmentId: string,
): Promise<Lot[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("lots" as never)
    .select("*")
    .eq("equipment_id", equipmentId)
    .eq("status", "active")
    .gt("qty_remaining", 0)
    .order("received_date", { ascending: true });
  return ((data ?? []) as unknown as Lot[]);
}

/** นับ lot ตาม status — ใช้ใน KPI */
export async function getLotStatusCounts(): Promise<Record<LotStatus, number>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("lots" as never).select("status");
  const counts: Record<LotStatus, number> = {
    active: 0, depleted: 0, expired: 0, discarded: 0,
  };
  for (const row of ((data ?? []) as Array<{ status: LotStatus }>)) {
    if (row.status in counts) counts[row.status]++;
  }
  return counts;
}

/** lots ที่ใกล้หมดอายุภายใน N วัน — ใช้ใน dashboard alert */
export async function getExpiringSoonCount(days = 30): Promise<number> {
  const sb = getSupabaseAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const { count } = await sb
    .from("lots" as never)
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .lte("expiry_date", cutoff.toISOString().slice(0, 10));
  return count ?? 0;
}
