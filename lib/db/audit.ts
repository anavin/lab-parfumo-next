/**
 * Audit log queries (Phase D)
 *
 * 2 sources:
 *  - po_activities: ทุก action บน PO (create/order/ship/receive/cancel/close/comment)
 *  - login_attempts: ทุก login (success + failed)
 *
 * Pagination: limit/offset (cursor ไม่จำเป็นเพราะเป็น admin tool)
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface AuditPoActivity {
  id: string;
  po_id: string;
  user_name: string;
  user_role: string;
  action: string;
  description: string | null;
  created_at: string;
  // joined
  po_number?: string | null;
}

export interface AuditLoginAttempt {
  id: string;
  username: string;
  success: boolean;
  created_at: string;
}

export interface AuditFilters {
  /** ISO date inclusive (YYYY-MM-DD) */
  from?: string;
  to?: string;
  user?: string;
  action?: string;
  /** for login: "all" | "success" | "failed" */
  status?: "all" | "success" | "failed";
}

const PAGE_SIZE = 100;

export async function getPoActivities(
  filters: AuditFilters = {},
  page = 0,
): Promise<{ rows: AuditPoActivity[]; total: number; hasMore: boolean }> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("po_activities" as never)
    .select("*, purchase_orders(po_number)" as never, { count: "exact" });

  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59.999Z`);
  if (filters.user) q = q.ilike("user_name", `%${filters.user}%`);
  if (filters.action) q = q.eq("action", filters.action);

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);

  // Flatten joined po_number
  type Raw = AuditPoActivity & { purchase_orders?: { po_number: string } | null };
  const rows: AuditPoActivity[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    po_id: r.po_id,
    user_name: r.user_name,
    user_role: r.user_role,
    action: r.action,
    description: r.description,
    created_at: r.created_at,
    po_number: r.purchase_orders?.po_number ?? null,
  }));

  const total = count ?? rows.length;
  return { rows, total, hasMore: total > from + rows.length };
}

export async function getLoginAttempts(
  filters: AuditFilters = {},
  page = 0,
): Promise<{ rows: AuditLoginAttempt[]; total: number; hasMore: boolean }> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("login_attempts")
    .select("*", { count: "exact" });

  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59.999Z`);
  if (filters.user) q = q.ilike("username", `%${filters.user}%`);
  if (filters.status === "success") q = q.eq("success", true);
  else if (filters.status === "failed") q = q.eq("success", false);

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await q
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = ((data ?? []) as unknown as AuditLoginAttempt[]);
  const total = count ?? rows.length;
  return { rows, total, hasMore: total > from + rows.length };
}

/** Distinct action types for filter dropdown */
export async function getDistinctActions(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("po_activities" as never)
    .select("action")
    .limit(1000);
  type Row = { action: string };
  const set = new Set(((data ?? []) as unknown as Row[]).map((r) => r.action));
  return Array.from(set).sort();
}
