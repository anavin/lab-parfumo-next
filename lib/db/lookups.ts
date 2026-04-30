/**
 * Lookups queries — server-only
 *
 * Generic dropdown values (categories, banks, units, etc.)
 * เก็บใน table `lookups` แยกตาม `type`
 *
 * ⚡ React.cache() — dedupe ใน same request
 */
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Lookup, LookupType, LookupWithUsage } from "@/lib/types/db";

/** ดู lookup ทั้งหมดของ type ที่กำหนด (active เท่านั้น) — เรียงตาม sort_order + name */
export const getLookups = cache(async (
  type: LookupType, includeInactive = false,
): Promise<Lookup[]> => {
  const sb = getSupabaseAdmin();
  let q = sb.from("lookups" as never)
    .select("*")
    .eq("type", type)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!includeInactive) {
    q = q.eq("is_active", true);
  }
  const { data } = await q;
  return (data ?? []) as Lookup[];
});

/** ดู lookups ทั้งหมดทุก type — สำหรับ settings page */
export const getAllLookups = cache(async (): Promise<Lookup[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("lookups" as never)
    .select("*")
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as Lookup[];
});

/**
 * Lookups + usage count — นับว่ามีกี่แถวที่ใช้
 * ใช้ใน settings page เพื่อแสดงจำนวนการใช้งาน + ป้องกันลบ
 */
export const getLookupsWithUsage = cache(async (
  type: LookupType,
): Promise<LookupWithUsage[]> => {
  const lookups = await getLookups(type, true);
  if (!lookups.length) return [];

  const sb = getSupabaseAdmin();
  // ลบ map field per type → query columns ที่ต้องนับ
  const { table, column } = USAGE_COLUMN[type];
  if (!table || !column) {
    return lookups.map((l) => ({ ...l, usageCount: 0 }));
  }

  // นับ usage แบบ batch — query distinct values + count
  const { data: usages } = await sb
    .from(table as never)
    .select(column);

  const counts = new Map<string, number>();
  for (const row of (usages ?? []) as unknown as Array<Record<string, string | null>>) {
    const v = row[column];
    if (!v || !v.trim()) continue;
    const key = v.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return lookups.map((l) => ({
    ...l,
    usageCount: counts.get(l.name.trim().toLowerCase()) ?? 0,
  }));
});

/** ตาราง mapping: lookup type → ตาราง+คอลัมน์ที่เก็บค่าจริง (สำหรับนับ usage) */
const USAGE_COLUMN: Record<LookupType, { table: string; column: string }> = {
  supplier_category: { table: "suppliers", column: "category" },
  bank: { table: "suppliers", column: "bank_name" },
  equipment_unit: { table: "equipment", column: "unit" },
  payment_term: { table: "suppliers", column: "payment_terms" },
  withdrawal_purpose: { table: "withdrawals", column: "purpose" },
};

/** ดู lookup ตัวเดียวด้วย id */
export const getLookupById = cache(
  async (id: string): Promise<Lookup | null> => {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("lookups" as never)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as Lookup | null) ?? null;
  },
);
