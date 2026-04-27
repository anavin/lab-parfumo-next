"use server";

/**
 * Withdrawal server actions — atomic stock decrement via Postgres RPC
 * (มี fallback ถ้า RPC ยังไม่ deploy)
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface WithdrawResult {
  ok: boolean;
  error?: string;
  withdrawalId?: string;
}

interface WithdrawStockRpc {
  success: boolean;
  error?: string;
  current_stock?: number;
  name?: string;
  unit?: string;
}

export async function createWithdrawalAction(input: {
  equipmentId: string;
  qty: number;
  purpose: string;
  withdrawnAt?: string;   // ISO date หรือ datetime
  notes?: string;
}): Promise<WithdrawResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  if (!input.equipmentId) return { ok: false, error: "ไม่ได้ระบุสินค้า" };
  if (!input.qty || input.qty <= 0) return { ok: false, error: "จำนวนต้องมากกว่า 0" };
  if (!input.purpose.trim()) return { ok: false, error: "กรุณากรอกใช้ทำอะไร" };

  const sb = getSupabaseAdmin();

  // 1) Atomic check + decrement via RPC
  let eqName = "";
  let eqUnit = "ชิ้น";
  try {
    const { data: rpcData, error: rpcErr } = await sb.rpc("withdraw_stock", {
      p_equipment_id: input.equipmentId,
      p_qty: input.qty,
    });
    if (rpcErr) throw rpcErr;
    const result = (typeof rpcData === "string"
      ? JSON.parse(rpcData)
      : rpcData) as WithdrawStockRpc;
    if (!result?.success) {
      const err = result?.error ?? "unknown";
      if (err === "insufficient_stock") {
        return { ok: false, error: `สต็อกไม่พอ — เหลือ ${result.current_stock ?? 0}` };
      }
      if (err === "not_found") {
        return { ok: false, error: "ไม่พบสินค้านี้ในระบบ" };
      }
      return { ok: false, error: err };
    }
    eqName = result.name ?? "";
    eqUnit = result.unit ?? "ชิ้น";
  } catch {
    // Fallback (non-atomic — มี race condition แต่ใช้งานได้ระหว่าง migrate)
    console.warn("[withdraw] RPC fallback — non-atomic");
    const { data: eq } = await sb
      .from("equipment")
      .select("name, unit, stock")
      .eq("id", input.equipmentId)
      .maybeSingle();
    if (!eq) return { ok: false, error: "ไม่พบสินค้านี้ในระบบ" };
    const currentStock = eq.stock ?? 0;
    if (input.qty > currentStock) {
      return { ok: false, error: `สต็อกไม่พอ — เหลือ ${currentStock}` };
    }
    await sb
      .from("equipment")
      .update({ stock: currentStock - input.qty })
      .eq("id", input.equipmentId);
    eqName = eq.name ?? "";
    eqUnit = eq.unit ?? "ชิ้น";
  }

  // 2) Insert withdrawal record
  const withdrawnAt = input.withdrawnAt
    ? new Date(input.withdrawnAt).toISOString()
    : new Date().toISOString();
  const { data, error } = await sb
    .from("withdrawals")
    .insert({
      equipment_id: input.equipmentId,
      equipment_name: eqName,
      qty: input.qty,
      unit: eqUnit,
      purpose: input.purpose.trim(),
      withdrawn_by: user.id,
      withdrawn_by_name: user.full_name,
      withdrawn_at: withdrawnAt,
      notes: input.notes?.trim() ?? "",
    })
    .select()
    .maybeSingle();
  if (error || !data) {
    console.error("[withdraw] insert failed:", error);
    return { ok: false, error: "บันทึกการเบิกไม่สำเร็จ" };
  }

  revalidatePath("/withdraw");
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
  return { ok: true, withdrawalId: data.id };
}

export async function deleteWithdrawalAction(
  withdrawalId: string, restoreStock = true,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }

  const sb = getSupabaseAdmin();
  if (restoreStock) {
    const { data: w } = await sb
      .from("withdrawals")
      .select("equipment_id, qty")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (w?.equipment_id) {
      const { data: eq } = await sb
        .from("equipment")
        .select("stock")
        .eq("id", w.equipment_id)
        .maybeSingle();
      const cur = eq?.stock ?? 0;
      await sb
        .from("equipment")
        .update({ stock: cur + (w.qty ?? 0) })
        .eq("id", w.equipment_id);
    }
  }
  await sb.from("withdrawals").delete().eq("id", withdrawalId);
  revalidatePath("/withdraw");
  revalidatePath("/equipment");
  return { ok: true };
}
