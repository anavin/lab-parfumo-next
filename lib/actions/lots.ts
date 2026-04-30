"use server";

/**
 * Lot/Batch server actions (Phase E)
 *
 * - createLotsForDelivery: เรียกอัตโนมัติจาก receivePoAction (ภายใน)
 * - updateLotAction: privileged แก้ supplier_lot_no/วันผลิต/หมดอายุ
 * - markLotAction: ทำเครื่องหมาย expired/discarded
 */
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LotStatus } from "@/lib/types/db";

interface ActionResult {
  ok: boolean;
  error?: string;
  lotId?: string;
}

/**
 * Generate next lot_no — ลองเรียก RPC ก่อน, fallback เป็น timestamp ถ้า migration ยังไม่รัน
 */
async function nextLotNo(): Promise<string> {
  const sb = getSupabaseAdmin();
  try {
    const { data, error } = await sb.rpc("next_lot_no" as never);
    if (!error && typeof data === "string") return data;
  } catch { /* fallback */ }
  // Fallback: timestamp-based (โอกาสซ้ำต่ำมาก)
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const ms = now.getTime() % 100000;
  return `LOT-${yyyy}-${String(ms).padStart(5, "0")}`;
}

/**
 * สร้าง lots สำหรับ delivery — เรียกจาก receivePoAction
 *
 * Note: best-effort — ถ้า lot สร้างไม่ได้ก็ไม่ block delivery
 * เก็บ silently log ไว้ดูทีหลัง
 */
export async function createLotsForDelivery(input: {
  poId: string;
  poNumber: string;
  poDeliveryId: string;
  supplierName: string | null;
  receivedByName: string;
  receivedDate: string;
  items: Array<{
    equipment_id: string | null;
    name: string;
    qty_received: number;
    unit?: string;
  }>;
}): Promise<{ created: number; failed: number }> {
  const sb = getSupabaseAdmin();
  let created = 0;
  let failed = 0;

  for (const it of input.items) {
    if (!it.equipment_id) continue; // skip custom items
    if (!it.qty_received || it.qty_received <= 0) continue;

    try {
      const lotNo = await nextLotNo();
      const { error } = await sb.from("lots" as never).insert({
        lot_no: lotNo,
        equipment_id: it.equipment_id,
        equipment_name: it.name,
        unit: it.unit ?? null,
        qty_initial: it.qty_received,
        qty_remaining: it.qty_received,
        po_id: input.poId,
        po_number: input.poNumber,
        po_delivery_id: input.poDeliveryId,
        supplier_name: input.supplierName,
        received_date: input.receivedDate,
        status: "active",
        created_by_name: input.receivedByName,
      } as never);
      if (error) {
        console.warn("[lots] insert failed:", error.message);
        failed++;
      } else {
        created++;
      }
    } catch (e) {
      console.warn("[lots] insert exception:", e);
      failed++;
    }
  }

  return { created, failed };
}

/**
 * Update lot metadata — แก้ supplier_lot_no, วันผลิต, หมดอายุ, notes
 * (ห้ามแก้ qty — qty มาจาก delivery + withdrawals เท่านั้น)
 */
export async function updateLotAction(
  lotId: string,
  patch: {
    supplierLotNo?: string;
    manufacturedDate?: string | null;
    expiryDate?: string | null;
    notes?: string;
  },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = {};
  if (patch.supplierLotNo !== undefined) {
    update.supplier_lot_no = patch.supplierLotNo.trim() || null;
  }
  if (patch.manufacturedDate !== undefined) {
    update.manufactured_date = patch.manufacturedDate || null;
  }
  if (patch.expiryDate !== undefined) {
    update.expiry_date = patch.expiryDate || null;
  }
  if (patch.notes !== undefined) {
    update.notes = patch.notes;
  }
  const { error } = await sb
    .from("lots" as never)
    .update(update as never)
    .eq("id", lotId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };
  revalidatePath("/lots");
  revalidatePath(`/lots/${lotId}`);
  return { ok: true, lotId };
}

/**
 * เปลี่ยน status ของ lot — expired / discarded
 */
export async function markLotStatusAction(
  lotId: string,
  status: Exclude<LotStatus, "active">,
  reason?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = { status };
  if (reason) update.notes = reason;
  const { error } = await sb
    .from("lots" as never)
    .update(update as never)
    .eq("id", lotId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };
  revalidatePath("/lots");
  revalidatePath(`/lots/${lotId}`);
  return { ok: true, lotId };
}
