"use server";

/**
 * Supplier Server Actions — create, update, soft-delete
 *
 * ใครใช้ได้: Privileged (Admin + Supervisor)
 *   → admin/supervisor จัดการ catalog ของ supplier
 *   → staff ดูได้แต่ไม่จัดการ
 *
 * ทุก action:
 *   1. ตรวจ session + role
 *   2. Validate ผ่าน Zod
 *   3. Update DB
 *   4. revalidatePath
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  createSupplierSchema, updateSupplierSchema, formatZodError,
} from "./schemas";

interface ActionResult {
  ok: boolean;
  error?: string;
  supplierId?: string;
}

type CreateInput = {
  name: string;
  code?: string;
  tax_id?: string;
  category?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  bank_name?: string;
  bank_account?: string;
  payment_terms?: string;
  notes?: string;
  is_active?: boolean;
};

/** Helper: trim + null fallback (ถ้าว่าง → ใช้ค่า default ของ DB) */
function cleanInput(input: CreateInput) {
  const out: Record<string, unknown> = {
    name: input.name.trim(),
  };
  // Optional text fields
  if (input.code !== undefined) out.code = input.code.trim() || null;
  if (input.tax_id !== undefined) out.tax_id = input.tax_id.trim() || null;
  if (input.category !== undefined) out.category = input.category.trim();
  if (input.contact_person !== undefined) out.contact_person = input.contact_person.trim();
  if (input.phone !== undefined) out.phone = input.phone.trim();
  if (input.email !== undefined) out.email = input.email.trim();
  if (input.address !== undefined) out.address = input.address.trim();
  if (input.bank_name !== undefined) out.bank_name = input.bank_name.trim();
  if (input.bank_account !== undefined) out.bank_account = input.bank_account.trim();
  if (input.payment_terms !== undefined) out.payment_terms = input.payment_terms.trim();
  if (input.notes !== undefined) out.notes = input.notes.trim();
  if (input.is_active !== undefined) out.is_active = input.is_active;
  return out;
}

// ==================================================================
// Create
// ==================================================================
export async function createSupplierAction(input: CreateInput): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }

  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();
  const payload = cleanInput(input);
  payload.created_by_name = me.full_name;
  payload.updated_by_name = me.full_name;

  const { data, error } = await sb
    .from("suppliers" as never)
    .insert(payload as never)
    .select()
    .maybeSingle();

  if (error || !data) {
    const msg = String(error?.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      // ดูว่าซ้ำที่ name หรือ code
      if (msg.includes("name")) {
        return { ok: false, error: "มี Supplier ชื่อนี้อยู่แล้ว" };
      }
      if (msg.includes("code")) {
        return { ok: false, error: "รหัสนี้ถูกใช้ไปแล้ว" };
      }
      return { ok: false, error: "ข้อมูลซ้ำกับที่มีอยู่ — ตรวจชื่อ/รหัส" };
    }
    console.error("[suppliers] create failed:", error);
    return { ok: false, error: "เพิ่มไม่สำเร็จ" };
  }

  revalidatePath("/suppliers");
  revalidateTag("suppliers");
  return { ok: true, supplierId: (data as { id: string }).id };
}

// ==================================================================
// Update
// ==================================================================
export async function updateSupplierAction(
  id: string,
  input: Partial<CreateInput>,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }

  const parsed = updateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();
  // Cast Partial → CreateInput-compatible (cleanInput ตรวจ undefined ทุก field)
  const payload = cleanInput(input as CreateInput);
  payload.updated_by_name = me.full_name;

  const { error } = await sb
    .from("suppliers" as never)
    .update(payload as never)
    .eq("id", id);

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      if (msg.includes("name")) {
        return { ok: false, error: "มี Supplier ชื่อนี้อยู่แล้ว" };
      }
      if (msg.includes("code")) {
        return { ok: false, error: "รหัสนี้ถูกใช้ไปแล้ว" };
      }
    }
    console.error("[suppliers] update failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  revalidateTag("suppliers");
  return { ok: true, supplierId: id };
}

// ==================================================================
// Delete (soft — set is_active=false)
// ==================================================================
export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("suppliers" as never)
    .update({ is_active: false, updated_by_name: me.full_name } as never)
    .eq("id", id);

  if (error) {
    console.error("[suppliers] delete failed:", error);
    return { ok: false, error: "ปิดใช้งานไม่สำเร็จ" };
  }

  revalidatePath("/suppliers");
  revalidateTag("suppliers");
  return { ok: true, supplierId: id };
}

// ==================================================================
// Restore (reactivate)
// ==================================================================
export async function restoreSupplierAction(id: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("suppliers" as never)
    .update({ is_active: true, updated_by_name: me.full_name } as never)
    .eq("id", id);

  if (error) {
    console.error("[suppliers] restore failed:", error);
    return { ok: false, error: "เปิดใช้งานไม่สำเร็จ" };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  revalidateTag("suppliers");
  return { ok: true, supplierId: id };
}
