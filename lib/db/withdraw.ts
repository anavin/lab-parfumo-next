/**
 * Withdrawal queries — server-side
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Withdrawal } from "@/lib/types/db";

export interface WithdrawalListOpts {
  userId?: string;          // ถ้ามี → filter เฉพาะของ user นี้
  equipmentId?: string;
  startDate?: string;       // ISO
  limit?: number;
}

export async function getWithdrawals(
  opts: WithdrawalListOpts = {},
): Promise<Withdrawal[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("withdrawals").select("*")
    .order("withdrawn_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.userId) q = q.eq("withdrawn_by", opts.userId);
  if (opts.equipmentId) q = q.eq("equipment_id", opts.equipmentId);
  if (opts.startDate) q = q.gte("withdrawn_at", opts.startDate);
  const { data } = await q;
  return (data ?? []) as Withdrawal[];
}
