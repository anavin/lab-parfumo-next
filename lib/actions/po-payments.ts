"use server";

/**
 * Credit-card payment server actions
 *
 * Model: 1 การรูดบัตร → N po_payments rows (1 ต่อ PO). ถ้ารูดพร้อมกันหลาย PO
 * ทุก row share payment_group_id เดียวกัน (UUID). จ่ายเดี่ยว = payment_group_id null.
 *
 * Auth: บันทึกจ่าย → creator/privileged ของ PO นั้น
 *       Mark reimbursed → admin/supervisor เท่านั้น
 *       Void payment → admin/supervisor เท่านั้น
 */
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  recordPaymentSchema,
  markReimbursedSchema,
  unmarkReimbursedSchema,
  voidPaymentSchema,
  formatZodError,
} from "./schemas";

/**
 * Count confirmed po_payments ผูกกับ PO — สำหรับใช้ block cancel/revert
 * ที่จะทำให้ payment record ค้างระบบ
 *
 * Return null = query failed (transient) — caller ควร treat as "cannot verify"
 * แล้ว block operation ดีกว่าปล่อย proceed (mirror countWithdrawalsAgainstPoLots)
 */
export async function countPaymentsForPo(poId: string): Promise<number | null> {
  const sb = getSupabaseAdmin();
  try {
    const { count, error } = await sb
      .from("po_payments" as never)
      .select("id", { count: "exact", head: true })
      .eq("po_id", poId);
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      const msg = (error.message ?? "").toLowerCase();
      // Table missing (migration ยังไม่รัน) → treat as 0 = safe
      if (code === "42P01" || code.startsWith("PGRST") || msg.includes("does not exist")) {
        return 0;
      }
      console.error("[countPaymentsForPo] query failed:", error);
      return null;
    }
    return count ?? 0;
  } catch (e) {
    console.error("[countPaymentsForPo] threw:", e);
    return null;
  }
}

interface ActionResult {
  ok: boolean;
  error?: string;
  paymentGroupId?: string | null;
  count?: number;
}

interface RecordPaymentInput {
  /** จ่ายให้ PO ไหนบ้าง — ยอดต่อ PO */
  allocations: Array<{ poId: string; amount: number }>;
  paidDate: string;                 // YYYY-MM-DD
  cardDisplay: string;              // free-text
  approvalCode?: string;
  slipUrl?: string;
  notes?: string;
}

/**
 * Recompute PO.paid_amount + payment_status from po_payments
 * (ทดแทน trigger — call ทุกครั้งที่ payments เปลี่ยน)
 *
 * Uses tolerance (< 0.005 THB, i.e. half สตางค์) for float-safe comparison —
 * float SUM ใน JS drift ได้ (33.33 × 3 vs 100.00)
 */
export async function refreshPoPaymentStatus(poId: string): Promise<void> {
  const sb = getSupabaseAdmin();

  const { data: sumRow } = await sb
    .from("po_payments" as never)
    .select("amount")
    .eq("po_id", poId);
  const total = ((sumRow ?? []) as Array<{ amount: number }>)
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalRounded = Math.round(total * 100) / 100;

  const { data: po } = await sb
    .from("purchase_orders")
    .select("total")
    .eq("id", poId)
    .maybeSingle();
  const rawPoTotal = po?.total;

  // Guard: PO ยังไม่มี total (draft — total = null) → skip refresh
  // ก่อน: Number(null) = 0 → status = "overpaid" ทุกที่ที่มี payment
  // (แต่ปกติ record payment เรียก guard ว่า status ≥ "สั่งซื้อแล้ว" → มี total อยู่แล้ว)
  if (rawPoTotal === null || rawPoTotal === undefined) {
    await sb
      .from("purchase_orders")
      .update({
        paid_amount: totalRounded,
        payment_status: totalRounded > 0.005 ? "overpaid" : "unpaid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", poId);
    return;
  }
  const poTotal = Math.round(Number(rawPoTotal) * 100) / 100;

  // Tolerance-based compare — กัน float drift
  const TOL = 0.005;
  let status: "unpaid" | "partial" | "paid" | "overpaid" = "unpaid";
  if (totalRounded < TOL) status = "unpaid";
  else if (totalRounded < poTotal - TOL) status = "partial";
  else if (Math.abs(totalRounded - poTotal) < TOL) status = "paid";
  else status = "overpaid";

  await sb
    .from("purchase_orders")
    .update({
      paid_amount: totalRounded,
      payment_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);
}

/**
 * บันทึกการรูดบัตร 1 ครั้ง — insert N rows (1 ต่อ PO ที่เลือก) share payment_group_id
 */
export async function recordPaymentAction(
  input: RecordPaymentInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  // Validate input via Zod (field caps + cent precision + shape)
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  const validated = parsed.data;
  const cardDisplay = validated.cardDisplay;

  const sb = getSupabaseAdmin();

  // Permission gate — creator หรือ privileged ของ **ทุก PO** ที่ผูก
  const poIds = validated.allocations.map((a) => a.poId);
  const { data: pos } = await sb
    .from("purchase_orders")
    .select("id, po_number, created_by, status, deleted_at, total, paid_amount")
    .in("id", poIds);
  const poRows = (pos ?? []) as Array<{
    id: string;
    po_number: string;
    created_by: string | null;
    status: string;
    deleted_at: string | null;
    total: number | null;
    paid_amount: number | null;
  }>;

  if (poRows.length !== poIds.length) {
    return { ok: false, error: "ไม่พบ PO บางใบ" };
  }
  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  for (const po of poRows) {
    if (po.deleted_at) {
      return { ok: false, error: `PO ${po.po_number} อยู่ในถังขยะ` };
    }
    if (!isPrivileged && po.created_by !== user.id) {
      return { ok: false, error: `คุณไม่ใช่เจ้าของ PO ${po.po_number}` };
    }
    // Payment ทำได้ตั้งแต่ status "สั่งซื้อแล้ว" ขึ้นไป (มีค่าใช้จ่ายจริง)
    if (po.status === "รอจัดซื้อดำเนินการ" || po.status === "ยกเลิก") {
      return {
        ok: false,
        error: `PO ${po.po_number} สถานะ "${po.status}" ยังไม่พร้อมจ่าย`,
      };
    }
    // Guard overpay — allow up to 110% (fee ปกติ 1-3%, duplicate slip ปกติ = 100% ซ้ำ)
    // ก่อน: 150% ผ่อนเกิน → duplicate charge ผ่านได้
    // หลัง: 110% + message ชัด
    const alloc = validated.allocations.find((a) => a.poId === po.id)!;
    const existing = Number(po.paid_amount ?? 0);
    const poTotal = Number(po.total ?? 0);
    if (poTotal > 0 && existing + alloc.amount > poTotal * 1.10) {
      return {
        ok: false,
        error:
          `PO ${po.po_number}: ยอดจ่าย ${(existing + alloc.amount).toLocaleString()} ` +
          `เกินยอด PO ${poTotal.toLocaleString()} > 10% — ตรวจก่อน (อาจเป็น duplicate slip)`,
      };
    }
  }

  // Generate payment_group_id ถ้ามี > 1 PO
  const groupId = validated.allocations.length > 1 ? randomUUID() : null;

  // Insert รายละ 1 PO
  const rows = validated.allocations.map((a) => ({
    po_id: a.poId,
    payment_group_id: groupId,
    amount: a.amount,
    paid_date: validated.paidDate,
    paid_by_user_id: user.id,
    paid_by_name: user.full_name,
    card_display: cardDisplay,
    approval_code: validated.approvalCode ?? null,
    slip_url: validated.slipUrl ?? null,
    notes: validated.notes ?? null,
    created_by: user.id,
  }));

  const { error } = await sb.from("po_payments" as never).insert(rows as never);
  if (error) {
    console.error("[po-payments recordPayment] insert failed:", error);
    return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }

  // Refresh PO payment_status สำหรับทุก PO ที่กระทบ (parallel)
  // — log rejected rejections so we notice stale statuses
  const refreshResults = await Promise.allSettled(
    poIds.map((id) => refreshPoPaymentStatus(id)),
  );
  const refreshErrors = refreshResults
    .map((r, i) => r.status === "rejected" ? { poId: poIds[i], err: r.reason } : null)
    .filter(Boolean);
  if (refreshErrors.length > 0) {
    console.error("[po-payments] refresh failed for some POs — status stale:", refreshErrors);
  }

  // Revalidate — ทุก PO detail + list + my-payments dashboard
  for (const id of poIds) revalidatePath(`/po/${id}`);
  revalidatePath("/po");
  revalidatePath("/my-payments");
  revalidatePath("/dashboard");

  console.log(
    `[po-payments] user=${user.full_name} recorded ${rows.length} payment(s), group=${groupId ?? "(single)"}`,
  );
  return { ok: true, paymentGroupId: groupId, count: rows.length };
}

/**
 * Mark reimbursed — bulk (admin)
 */
export async function markReimbursedAction(input: {
  paymentIds: string[];
  reimbursedDate: string;
  reimbursementRef?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const parsed = markReimbursedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  const v = parsed.data;

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("po_payments" as never)
    .update({
      reimbursed: true,
      reimbursed_date: v.reimbursedDate,
      reimbursement_ref: v.reimbursementRef ?? null,
      reimbursed_by: user.id,
      reimbursed_by_name: user.full_name,
    } as never)
    .in("id", v.paymentIds);

  if (error) {
    console.error("[po-payments markReimbursed] failed:", error);
    return { ok: false, error: `Mark ไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/my-payments");
  revalidatePath("/po");
  console.log(
    `[po-payments] user=${user.full_name} marked ${v.paymentIds.length} payment(s) reimbursed`,
  );
  return { ok: true, count: v.paymentIds.length };
}

/**
 * Undo mark reimbursed (admin — เผื่อกดผิด)
 */
export async function unmarkReimbursedAction(input: {
  paymentIds: string[];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const parsed = unmarkReimbursedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  const v = parsed.data;

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("po_payments" as never)
    .update({
      reimbursed: false,
      reimbursed_date: null,
      reimbursement_ref: null,
      reimbursed_by: null,
      reimbursed_by_name: null,
    } as never)
    .in("id", v.paymentIds);

  if (error) return { ok: false, error: `Undo ไม่สำเร็จ: ${error.message}` };

  revalidatePath("/my-payments");
  revalidatePath("/po");
  return { ok: true, count: v.paymentIds.length };
}

/**
 * Void (ลบ) payment — admin only
 * ไม่มี soft-delete — payment ทำผิด = ลบทิ้งเลย (มี log)
 */
export async function voidPaymentAction(
  paymentId: string,
  reason: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const parsed = voidPaymentSchema.safeParse({ paymentId, reason });
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();

  // Get PO ID first (for refresh + block ถ้าเบิกไปแล้ว)
  const { data: p } = await sb
    .from("po_payments" as never)
    .select("po_id, amount, reimbursed, paid_by_name, card_display")
    .eq("id", paymentId)
    .maybeSingle();
  const pRow = p as {
    po_id: string;
    amount: number;
    reimbursed: boolean;
    paid_by_name: string;
    card_display: string | null;
  } | null;
  if (!pRow) return { ok: false, error: "ไม่พบ payment" };

  if (pRow.reimbursed) {
    return {
      ok: false,
      error: "Payment นี้ mark เบิกแล้ว — undo mark ก่อน หรือปรึกษาบัญชี",
    };
  }

  // Race-safe delete — WHERE reimbursed = false — กัน race กับ markReimbursed
  //   ก่อน: delete without check → concurrent mark wins → reimbursed record ถูกลบเงียบๆ
  //   หลัง: delete only if still !reimbursed → 0 rows deleted = something changed → reject
  const { error, count } = await sb
    .from("po_payments" as never)
    .delete({ count: "exact" })
    .eq("id", paymentId)
    .eq("reimbursed", false);
  if (error) return { ok: false, error: `ลบไม่สำเร็จ: ${error.message}` };
  if (count === 0) {
    return {
      ok: false,
      error:
        "Payment เพิ่งถูก mark reimbursed ระหว่างกำลังลบ — refresh หน้าและตรวจก่อนลองใหม่",
    };
  }

  await refreshPoPaymentStatus(pRow.po_id);

  revalidatePath(`/po/${pRow.po_id}`);
  revalidatePath("/po");
  revalidatePath("/my-payments");
  console.log(
    `[po-payments VOID] user=${user.full_name} voided payment ${paymentId} ` +
    `(฿${pRow.amount}, ${pRow.card_display ?? "-"}, ${pRow.paid_by_name}) reason="${reason}"`,
  );
  return { ok: true };
}
