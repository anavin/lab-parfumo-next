/**
 * Supplier queries — server-only
 *
 * ⚡ React.cache() — dedupe ใน same request
 * ⚠️ ห้าม import จาก client component
 */
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  Supplier, SupplierWithStats, PurchaseOrder, PoStatus,
} from "@/lib/types/db";

const COUNTED_FOR_SPEND: PoStatus[] = [
  "สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์",
];
const PENDING_STATUSES: PoStatus[] = [
  "รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว", "กำลังขนส่ง",
];

/** ทุก supplier (ทั้ง active + inactive) */
export const getAllSuppliers = cache(async (): Promise<Supplier[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("suppliers" as never)
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []) as Supplier[];
});

/** Supplier เดียวด้วย id */
export const getSupplierById = cache(
  async (id: string): Promise<Supplier | null> => {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("suppliers" as never)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as Supplier | null) ?? null;
  },
);

/**
 * ทุก supplier พร้อม stats (PO count + spend)
 * ใช้ใน /suppliers list page — คำนวณจาก PO data
 */
export const getSuppliersWithStats = cache(async (): Promise<SupplierWithStats[]> => {
  const sb = getSupabaseAdmin();
  const [suppliersRes, posRes] = await Promise.all([
    sb.from("suppliers" as never)
      .select("*")
      .order("name", { ascending: true }),
    sb.from("purchase_orders")
      .select("supplier_id, status, total, ordered_date, po_number, created_at")
      .not("supplier_id", "is", null),
  ]);

  const suppliers = (suppliersRes.data ?? []) as Supplier[];
  const pos = (posRes.data ?? []) as Array<{
    supplier_id: string;
    status: PoStatus;
    total: number | null;
    ordered_date: string | null;
    po_number: string;
    created_at: string;
  }>;

  // Aggregate per supplier
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const statsMap = new Map<string, {
    poCount: number;
    totalSpend: number;
    poCountThisYear: number;
    totalSpendThisYear: number;
    pendingPoCount: number;
    lastPoDate: string | null;
    lastPoNumber: string | null;
  }>();

  for (const p of pos) {
    if (!p.supplier_id) continue;
    const cur = statsMap.get(p.supplier_id) ?? {
      poCount: 0, totalSpend: 0,
      poCountThisYear: 0, totalSpendThisYear: 0,
      pendingPoCount: 0,
      lastPoDate: null as string | null,
      lastPoNumber: null as string | null,
    };

    cur.poCount += 1;

    const counted = COUNTED_FOR_SPEND.includes(p.status);
    if (counted && p.total) {
      cur.totalSpend += p.total;
    }

    const refDate = p.ordered_date || p.created_at;
    if (refDate >= yearStart) {
      cur.poCountThisYear += 1;
      if (counted && p.total) {
        cur.totalSpendThisYear += p.total;
      }
    }

    if (PENDING_STATUSES.includes(p.status)) {
      cur.pendingPoCount += 1;
    }

    if (!cur.lastPoDate || p.created_at > cur.lastPoDate) {
      cur.lastPoDate = p.created_at;
      cur.lastPoNumber = p.po_number;
    }

    statsMap.set(p.supplier_id, cur);
  }

  return suppliers.map((s) => {
    const stats = statsMap.get(s.id) ?? {
      poCount: 0, totalSpend: 0,
      poCountThisYear: 0, totalSpendThisYear: 0,
      pendingPoCount: 0, lastPoDate: null, lastPoNumber: null,
    };
    return { ...s, ...stats };
  });
});

/** Supplier + stats สำหรับ detail page */
export const getSupplierWithStats = cache(
  async (id: string): Promise<SupplierWithStats | null> => {
    const all = await getSuppliersWithStats();
    return all.find((s) => s.id === id) ?? null;
  },
);

/** ดู PO ทั้งหมดของ supplier */
export const getPosBySupplierId = cache(
  async (supplierId: string, limit = 100): Promise<PurchaseOrder[]> => {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("purchase_orders")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as PurchaseOrder[];
  },
);

/** Top สินค้าที่สั่งจาก supplier (จาก items JSON) */
export const getTopItemsForSupplier = cache(
  async (supplierId: string, n = 10): Promise<Array<{
    name: string;
    totalQty: number;
    poCount: number;
  }>> => {
    const pos = await getPosBySupplierId(supplierId, 500);
    const map = new Map<string, { totalQty: number; poCount: number }>();
    for (const p of pos) {
      const items = p.items ?? [];
      const seen = new Set<string>();
      for (const it of items) {
        if (!it.name) continue;
        const cur = map.get(it.name) ?? { totalQty: 0, poCount: 0 };
        cur.totalQty += it.qty ?? 0;
        if (!seen.has(it.name)) {
          cur.poCount += 1;
          seen.add(it.name);
        }
        map.set(it.name, cur);
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, n);
  },
);

/** ยอดรายเดือน 6 เดือนล่าสุดของ supplier */
export const getMonthlyTrendForSupplier = cache(
  async (supplierId: string, months = 6): Promise<Array<{
    month: string;       // "2026-04"
    monthLabel: string;  // "เม.ย."
    spend: number;
    poCount: number;
  }>> => {
    const pos = await getPosBySupplierId(supplierId, 500);
    const now = new Date();
    const buckets = new Map<string, { spend: number; poCount: number }>();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { spend: 0, poCount: 0 });
    }

    for (const p of pos) {
      const od = p.ordered_date || p.created_at;
      if (!od || !COUNTED_FOR_SPEND.includes(p.status)) continue;
      const key = od.slice(0, 7);
      const b = buckets.get(key);
      if (b) {
        b.spend += p.total ?? 0;
        b.poCount += 1;
      }
    }

    const TH_MONTHS = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
    ];
    return Array.from(buckets.entries()).map(([key, val]) => {
      const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
      return {
        month: key,
        monthLabel: TH_MONTHS[monthIdx] ?? key,
        spend: val.spend,
        poCount: val.poCount,
      };
    });
  },
);
