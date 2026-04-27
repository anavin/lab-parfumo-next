/**
 * PO query helpers — server-side
 *
 * ใช้ใน Server Components / Server Actions เท่านั้น
 * ห้าม import จาก client component
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PurchaseOrder, PoStatus, Role } from "@/lib/types/db";

const ACTIVE_STATUSES: PoStatus[] = [
  "รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว", "กำลังขนส่ง",
];
const PENDING_RECEIPT: PoStatus[] = ["สั่งซื้อแล้ว", "กำลังขนส่ง"];
const COUNTED_FOR_SPEND: PoStatus[] = [
  "สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์",
];

interface GetPosOpts {
  userId?: string;
  role?: Role;
  status?: PoStatus | "ทั้งหมด";
  limit?: number;
}

export async function getPos({
  userId, role = "requester", status, limit = 500,
}: GetPosOpts = {}): Promise<PurchaseOrder[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("purchase_orders").select("*");
  if (role === "requester" && userId) {
    q = q.eq("created_by", userId);
  }
  if (status && status !== "ทั้งหมด") {
    q = q.eq("status", status);
  }
  const { data } = await q
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PurchaseOrder[];
}

export interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
  pending: number;
  newThisWeek: number;
  thisMonthSpend: number;
  lastMonthSpend: number;
  spendGrowth: number; // %
  longestPendingDays: number;
  staleCount: number;        // PO ค้าง > 3 วัน
  overdueCount: number;
  upcomingCount: number;     // ใกล้ครบกำหนด ≤3 วัน
}

export function computeStats(pos: PurchaseOrder[]): DashboardStats {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString().slice(0, 10);
  const upcomingCutoff = new Date(now.getTime() + 3 * 86400_000).toISOString().slice(0, 10);

  const byStatus: Record<string, number> = {};
  let pending = 0;
  let newThisWeek = 0;
  let staleCount = 0;
  let overdueCount = 0;
  let upcomingCount = 0;
  let longestPendingDays = 0;

  let thisMonthSpend = 0;
  let lastMonthSpend = 0;
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  for (const p of pos) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;

    if (ACTIVE_STATUSES.includes(p.status)) {
      pending++;
      // longest pending
      if (p.created_at) {
        const days = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86400_000);
        if (days > longestPendingDays) longestPendingDays = days;
        if (p.status === "รอจัดซื้อดำเนินการ" && days > 3) staleCount++;
      }
    }

    // new this week
    if (p.created_at && p.created_at.slice(0, 10) >= weekAgo) newThisWeek++;

    // overdue / upcoming
    if (p.expected_date && PENDING_RECEIPT.includes(p.status)) {
      if (p.expected_date < today) overdueCount++;
      else if (p.expected_date <= upcomingCutoff) upcomingCount++;
    }

    // spending — count by ordered_date (เหมือน Streamlit เดิม)
    if (COUNTED_FOR_SPEND.includes(p.status) && p.ordered_date && p.total) {
      const od = new Date(p.ordered_date);
      if (od.getMonth() === now.getMonth() && od.getFullYear() === now.getFullYear()) {
        thisMonthSpend += p.total;
      } else if (od.getMonth() === lastMonth.getMonth() && od.getFullYear() === lastMonth.getFullYear()) {
        lastMonthSpend += p.total;
      }
    }
  }

  const spendGrowth = lastMonthSpend
    ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100
    : 0;

  return {
    total: pos.length,
    byStatus,
    pending,
    newThisWeek,
    thisMonthSpend,
    lastMonthSpend,
    spendGrowth,
    longestPendingDays,
    staleCount,
    overdueCount,
    upcomingCount,
  };
}

/** PO ที่ admin ต้องดำเนินการ (or ผู้สร้างต้องตรวจสอบ) — top 5 */
export function pickActionItems(
  pos: PurchaseOrder[], isAdmin: boolean,
): PurchaseOrder[] {
  const today = new Date().toISOString().slice(0, 10);
  const upcomingCutoff = new Date(Date.now() + 3 * 86400_000)
    .toISOString().slice(0, 10);

  const items: PurchaseOrder[] = [];

  if (isAdmin) {
    // 1) รอจัดซื้อ + มีปัญหา
    items.push(...pos.filter((p) =>
      ["รอจัดซื้อดำเนินการ", "มีปัญหา"].includes(p.status),
    ));
    // 2) เลยกำหนด
    items.push(...pos.filter((p) =>
      p.expected_date && p.expected_date < today &&
      PENDING_RECEIPT.includes(p.status),
    ));
  } else {
    // requester: รับของแล้ว + มีปัญหา + ใกล้ครบกำหนด
    items.push(...pos.filter((p) =>
      ["รับของแล้ว", "มีปัญหา"].includes(p.status),
    ));
    items.push(...pos.filter((p) =>
      p.expected_date && p.expected_date >= today &&
      p.expected_date <= upcomingCutoff &&
      PENDING_RECEIPT.includes(p.status),
    ));
  }

  // dedupe
  const seen = new Set<string>();
  return items.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/** เดือนล่าสุด N เดือน (เก่าสุดก่อน) — สำหรับ trend chart */
export function buildMonthlyTrend(pos: PurchaseOrder[], months = 6): Array<{
  month: string;        // "2026-04"
  monthLabel: string;   // "เม.ย."
  spend: number;
  poCount: number;
}> {
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
}

/** Top N suppliers ตาม spending */
export function topSuppliers(pos: PurchaseOrder[], n = 5): Array<{
  name: string;
  spend: number;
  poCount: number;
}> {
  const map = new Map<string, { spend: number; poCount: number }>();
  for (const p of pos) {
    if (!COUNTED_FOR_SPEND.includes(p.status) || !p.supplier_name || !p.total) continue;
    const cur = map.get(p.supplier_name) ?? { spend: 0, poCount: 0 };
    cur.spend += p.total;
    cur.poCount += 1;
    map.set(p.supplier_name, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, n);
}

// ==================================================================
// Single PO + related (activities, comments, deliveries)
// ==================================================================
export async function getPoById(id: string): Promise<PurchaseOrder | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as PurchaseOrder) ?? null;
}

export interface PoActivity {
  id: string;
  po_id: string;
  user_name: string | null;
  user_role: string | null;
  action: string;
  description: string | null;
  created_at: string;
}

export async function getPoActivities(poId: string): Promise<PoActivity[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("po_activities" as never)
    .select("*")
    .eq("po_id", poId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as PoActivity[];
}

export interface PoComment {
  id: string;
  po_id: string;
  user_name: string;
  user_role: string;
  message: string;
  created_at: string;
}

export async function getPoComments(poId: string): Promise<PoComment[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("po_comments" as never)
    .select("*")
    .eq("po_id", poId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as PoComment[];
}

export interface PoDelivery {
  id: string;
  po_id: string;
  delivery_no: number;
  received_date: string;
  received_by_name: string | null;
  items_received: Array<{
    equipment_id: string | null;
    name: string;
    qty_ordered: number;
    qty_received: number;
    qty_damaged: number;
    notes?: string;
  }>;
  overall_condition: string;
  issue_description: string | null;
  notes: string | null;
  image_urls: string[] | null;
}

export async function getPoDeliveries(poId: string): Promise<PoDelivery[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("po_deliveries" as never)
    .select("*")
    .eq("po_id", poId)
    .order("delivery_no", { ascending: true });
  return (data ?? []) as unknown as PoDelivery[];
}

// ==================================================================
// Filters / sorts สำหรับ PO list
// ==================================================================
export type PoSortKey =
  | "newest" | "oldest"
  | "total_desc" | "total_asc"
  | "supplier_asc" | "expected_asc";

export const SORT_LABELS: Record<PoSortKey, string> = {
  newest: "ใหม่สุด",
  oldest: "เก่าสุด",
  total_desc: "ยอดเงินสูง→ต่ำ",
  total_asc: "ยอดเงินต่ำ→สูง",
  supplier_asc: "Supplier A→Z",
  expected_asc: "ใกล้ครบกำหนด",
};

export interface PoFilters {
  status?: PoStatus | "ทั้งหมด";
  search?: string;
  fromDate?: string;     // ISO YYYY-MM-DD
  toDate?: string;
  minAmount?: number;
  sort?: PoSortKey;
}

export function applyPoFilters(
  pos: PurchaseOrder[], filters: PoFilters,
): PurchaseOrder[] {
  let out = pos;
  const { status, search, fromDate, toDate, minAmount, sort = "newest" } = filters;

  if (status && status !== "ทั้งหมด") {
    out = out.filter((p) => p.status === status);
  }
  if (search) {
    const s = search.toLowerCase();
    out = out.filter((p) =>
      (p.po_number ?? "").toLowerCase().includes(s) ||
      (p.notes ?? "").toLowerCase().includes(s) ||
      (p.supplier_name ?? "").toLowerCase().includes(s) ||
      (p.created_by_name ?? "").toLowerCase().includes(s) ||
      (p.items ?? []).some((it) =>
        (it.name ?? "").toLowerCase().includes(s),
      ),
    );
  }
  if (fromDate) {
    out = out.filter((p) =>
      (p.created_at ?? "").slice(0, 10) >= fromDate,
    );
  }
  if (toDate) {
    out = out.filter((p) =>
      (p.created_at ?? "").slice(0, 10) <= toDate,
    );
  }
  if (minAmount && minAmount > 0) {
    out = out.filter((p) => (p.total ?? 0) >= minAmount);
  }

  // sort
  switch (sort) {
    case "newest":
      out = [...out].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      break;
    case "oldest":
      out = [...out].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      break;
    case "total_desc":
      out = [...out].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
      break;
    case "total_asc":
      out = [...out].sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
      break;
    case "supplier_asc":
      out = [...out].sort((a, b) =>
        (a.supplier_name ?? "zzz").localeCompare(b.supplier_name ?? "zzz"),
      );
      break;
    case "expected_asc":
      out = [...out].sort((a, b) =>
        (a.expected_date ?? "9999-12-31").localeCompare(b.expected_date ?? "9999-12-31"),
      );
      break;
  }
  return out;
}

/** PO ที่รอรับของ (status ใน PENDING_RECEIPT) */
export async function getPosPendingReceipt(): Promise<PurchaseOrder[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("purchase_orders")
    .select("*")
    .in("status", PENDING_RECEIPT as readonly string[])
    .order("expected_date", { ascending: true })
    .limit(500);
  return (data ?? []) as PurchaseOrder[];
}

/** Supplier ที่เคยใช้ — สำหรับ autocomplete ในฟอร์มจัดซื้อ */
export interface SupplierEntry {
  name: string;
  lastContact: string;
  lastUsed: string;     // ISO date
  poCount: number;
  lastPo: string;
}

export async function getSupplierHistory(): Promise<SupplierEntry[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("purchase_orders")
    .select("supplier_name, supplier_contact, ordered_date, po_number")
    .not("supplier_name", "is", null)
    .order("ordered_date", { ascending: false })
    .limit(1000);

  const map = new Map<string, SupplierEntry>();
  for (const row of (data ?? []) as Array<{
    supplier_name: string | null;
    supplier_contact: string | null;
    ordered_date: string | null;
    po_number: string | null;
  }>) {
    const name = (row.supplier_name ?? "").trim();
    if (!name) continue;
    const cur = map.get(name);
    if (!cur) {
      map.set(name, {
        name,
        lastContact: row.supplier_contact ?? "",
        lastUsed: row.ordered_date ?? "",
        lastPo: row.po_number ?? "",
        poCount: 1,
      });
    } else {
      cur.poCount += 1;
      if (row.supplier_contact && !cur.lastContact) {
        cur.lastContact = row.supplier_contact;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.poCount - a.poCount);
}

/** จัดกลุ่ม PO ตามความเร่งด่วน (สำหรับหน้า pending-receipt) */
export interface UrgencyBuckets {
  overdue: PurchaseOrder[];
  today: PurchaseOrder[];
  upcoming: PurchaseOrder[]; // 1-3 วัน
  later: PurchaseOrder[];    // > 3 วัน
  noDate: PurchaseOrder[];
}

export function bucketByUrgency(pos: PurchaseOrder[]): UrgencyBuckets {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff3 = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const buckets: UrgencyBuckets = {
    overdue: [], today: [], upcoming: [], later: [], noDate: [],
  };
  for (const p of pos) {
    if (!p.expected_date) buckets.noDate.push(p);
    else if (p.expected_date < today) buckets.overdue.push(p);
    else if (p.expected_date === today) buckets.today.push(p);
    else if (p.expected_date <= cutoff3) buckets.upcoming.push(p);
    else buckets.later.push(p);
  }
  return buckets;
}
