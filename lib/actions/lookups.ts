"use server";

/**
 * Lookup Server Actions
 *
 * ใครใช้ได้: Privileged (Admin + Supervisor)
 *   → จัดการ dropdown ทุกประเภท (categories, banks, units, ฯลฯ)
 *
 * Inline create จากฟอร์มต่างๆ ใช้ createLookupAction
 * Bulk management จาก /settings → tab Lookups
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { LookupType } from "@/lib/types/db";
import { LOOKUP_TYPES } from "@/lib/types/db";
import { formatZodError } from "./schemas";

interface ActionResult {
  ok: boolean;
  error?: string;
  lookupId?: string;
}

const createSchema = z.object({
  type: z.enum(LOOKUP_TYPES),
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(120),
  code: z.string().trim().max(40).optional().or(z.literal("")),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().max(40).optional().or(z.literal("")),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

function checkPrivileged(role: string | undefined): string | null {
  if (role !== "admin" && role !== "supervisor") {
    return "เฉพาะแอดมินหรือ Supervisor";
  }
  return null;
}

// ==================================================================
// Create — รับ inline จาก dropdown ฟอร์ม + จากหน้า settings
// ==================================================================
export async function createLookupAction(input: {
  type: LookupType;
  name: string;
  code?: string;
  sort_order?: number;
}): Promise<ActionResult & { name?: string }> {
  const me = await getCurrentUser();
  const err = checkPrivileged(me?.role);
  if (err || !me) return { ok: false, error: err ?? "ไม่ได้เข้าสู่ระบบ" };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("lookups" as never)
    .insert({
      type: input.type,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      sort_order: input.sort_order ?? 0,
      is_active: true,
      created_by_name: me.full_name,
      updated_by_name: me.full_name,
    } as never)
    .select()
    .maybeSingle();

  if (error || !data) {
    const msg = String(error?.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "ค่านี้มีอยู่แล้ว" };
    }
    console.error("[lookups] create failed:", error);
    return { ok: false, error: "เพิ่มไม่สำเร็จ" };
  }

  // Revalidate ทุกหน้าที่อาจใช้ lookup + invalidate unstable_cache
  revalidatePath("/settings");
  revalidatePath("/suppliers");
  revalidatePath("/equipment");
  revalidatePath("/withdraw");
  revalidatePath("/po/new");
  revalidateTag("lookups");

  const row = data as { id: string; name: string };
  return { ok: true, lookupId: row.id, name: row.name };
}

// ==================================================================
// Update
// ==================================================================
export async function updateLookupAction(
  id: string,
  input: {
    name?: string;
    code?: string;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<ActionResult> {
  const me = await getCurrentUser();
  const err = checkPrivileged(me?.role);
  if (err || !me) return { ok: false, error: err ?? "ไม่ได้เข้าสู่ระบบ" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = {
    updated_by_name: me.full_name,
  };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.code !== undefined) update.code = input.code.trim() || null;
  if (input.sort_order !== undefined) update.sort_order = input.sort_order;
  if (input.is_active !== undefined) update.is_active = input.is_active;

  const { error } = await sb
    .from("lookups" as never)
    .update(update as never)
    .eq("id", id);

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "ค่านี้ถูกใช้ไปแล้ว" };
    }
    console.error("[lookups] update failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  revalidatePath("/settings");
  revalidatePath("/suppliers");
  revalidatePath("/equipment");
  revalidatePath("/withdraw");
  revalidateTag("lookups");
  return { ok: true, lookupId: id };
}

// ==================================================================
// Delete (hard delete — only if not used)
//
// Server-side usage check — ก่อน: UI enforce only → curl call ลบได้
// referenced rows (suppliers.category, equipment.unit, ฯลฯ) กลายเป็น orphan
// ==================================================================

/** Map LookupType → table/column ที่ reference lookup.name */
const USAGE_COLUMN: Record<string, { table: string; column: string }> = {
  supplier_category: { table: "suppliers", column: "category" },
  bank:              { table: "suppliers", column: "bank_name" },
  equipment_unit:    { table: "equipment", column: "unit" },
  payment_term:      { table: "suppliers", column: "payment_terms" },
  withdrawal_purpose:{ table: "withdrawals", column: "purpose" },
};

export async function deleteLookupAction(id: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  const err = checkPrivileged(me?.role);
  if (err || !me) return { ok: false, error: err ?? "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();

  // Fetch lookup type + name first — need for usage check
  const { data: lookup } = await sb
    .from("lookups" as never)
    .select("type, name")
    .eq("id", id)
    .maybeSingle();
  const lk = lookup as { type?: string; name?: string } | null;
  if (!lk?.name) {
    return { ok: false, error: "ไม่พบ lookup" };
  }

  // Check usage count
  const usage = USAGE_COLUMN[lk.type ?? ""];
  if (usage) {
    try {
      const { count } = await sb
        .from(usage.table as never)
        .select("id", { count: "exact", head: true })
        .eq(usage.column, lk.name);
      if ((count ?? 0) > 0) {
        return {
          ok: false,
          error:
            `ลบไม่ได้ — มี ${count} ${usage.table} ที่ใช้ค่า "${lk.name}" อยู่. ` +
            `เปลี่ยน/ลบ record ที่ใช้ก่อน หรือปิดใช้งาน (is_active=false) แทน`,
        };
      }
    } catch (e) {
      console.warn("[lookups delete] usage check failed:", e);
      // Don't block on check failure — but log
    }
  }

  const { error } = await sb
    .from("lookups" as never)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[lookups] delete failed:", error);
    return { ok: false, error: "ลบไม่สำเร็จ" };
  }

  revalidatePath("/settings");
  revalidateTag("lookups");
  return { ok: true, lookupId: id };
}
