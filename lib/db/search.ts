/**
 * Global search — รวม PO + Equipment + Suppliers
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PurchaseOrder, Equipment } from "@/lib/types/db";

export interface SearchResult {
  pos: PurchaseOrder[];
  equipment: Equipment[];
  suppliers: Array<{ name: string; poCount: number }>;
}

export async function globalSearch(
  query: string, opts: { userId?: string; isAdmin?: boolean } = {},
): Promise<SearchResult> {
  const q = query.trim().toLowerCase();
  if (!q) return { pos: [], equipment: [], suppliers: [] };

  const sb = getSupabaseAdmin();

  // === POs ===
  let pq = sb.from("purchase_orders").select("*").limit(200);
  if (!opts.isAdmin && opts.userId) pq = pq.eq("created_by", opts.userId);
  const { data: posData } = await pq.order("created_at", { ascending: false });
  const allPos = (posData ?? []) as PurchaseOrder[];
  const matchedPos = allPos.filter((p) =>
    (p.po_number ?? "").toLowerCase().includes(q) ||
    (p.supplier_name ?? "").toLowerCase().includes(q) ||
    (p.created_by_name ?? "").toLowerCase().includes(q) ||
    (p.notes ?? "").toLowerCase().includes(q) ||
    (p.items ?? []).some((it) => (it.name ?? "").toLowerCase().includes(q)),
  ).slice(0, 10);

  // === Equipment (admin only) ===
  let matchedEq: Equipment[] = [];
  if (opts.isAdmin) {
    const { data: eqData } = await sb
      .from("equipment")
      .select("*")
      .eq("is_active", true)
      .limit(500);
    matchedEq = ((eqData ?? []) as Equipment[]).filter((e) =>
      (e.name ?? "").toLowerCase().includes(q) ||
      (e.sku ?? "").toLowerCase().includes(q) ||
      (e.category ?? "").toLowerCase().includes(q),
    ).slice(0, 10);
  }

  // === Suppliers ===
  const supplierMap = new Map<string, number>();
  for (const p of allPos) {
    if (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) {
      supplierMap.set(p.supplier_name, (supplierMap.get(p.supplier_name) ?? 0) + 1);
    }
  }
  const suppliers = Array.from(supplierMap.entries())
    .map(([name, poCount]) => ({ name, poCount }))
    .sort((a, b) => b.poCount - a.poCount)
    .slice(0, 5);

  return { pos: matchedPos, equipment: matchedEq, suppliers };
}
