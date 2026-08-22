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

  // อ่านชื่อเดิมไว้ก่อน — ถ้าเปลี่ยน → sync ไปยัง purchase_orders.supplier_name
  // (denormalized snapshot — ถ้าไม่ sync หน้าอื่นจะโชว์ชื่อเดิม)
  const { data: before } = await sb
    .from("suppliers" as never)
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const oldName = (before as { name?: string } | null)?.name ?? null;
  console.log(`[suppliers update] id=${id} oldName="${oldName}" input.name="${input.name}"`);

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

  // Sync snapshot: ถ้าชื่อเปลี่ยน → update purchase_orders.supplier_name
  //   (1) PO ที่ link supplier_id นี้แล้ว → 100% sure
  //   (2) PO เก่า (supplier_id IS NULL) ที่ supplier_name ตรงกับชื่อเก่า
  //       (normalize trim+case) — ใช้ fetch+filter+update เพราะ .eq()
  //       ไม่จัดการ whitespace/case
  const newName = typeof payload.name === "string" ? payload.name : null;
  const namesChanged =
    !!newName && !!oldName && newName.trim() !== oldName.trim();
  console.log(
    `[suppliers update] newName="${newName}" namesChanged=${namesChanged}`,
  );

  if (namesChanged && newName && oldName) {
    // (1) Linked POs — เร็ว, ตรง 100%
    const linkedRes = await sb
      .from("purchase_orders")
      .update(
        { supplier_name: newName, updated_at: new Date().toISOString() },
        { count: "exact" },
      )
      .eq("supplier_id", id);
    if (linkedRes.error) {
      console.error("[suppliers] linked PO snapshot sync failed:", linkedRes.error);
    }

    // (2) Legacy unlinked POs — match by trimmed+lowercased name in app code
    //     (Supabase .eq()/.ilike() don't auto-trim → manual loop for safety)
    const oldNorm = oldName.trim().toLowerCase();
    const { data: candidates, error: legacySelErr } = await sb
      .from("purchase_orders")
      .select("id, supplier_name")
      .is("supplier_id", null)
      .not("supplier_name", "is", null);
    if (legacySelErr) {
      console.error("[suppliers] legacy candidate select failed:", legacySelErr);
    }
    type LegacyRow = { id: string; supplier_name: string | null };
    const matching = ((candidates ?? []) as LegacyRow[]).filter(
      (p) => (p.supplier_name ?? "").trim().toLowerCase() === oldNorm,
    );
    let legacyCount = 0;
    if (matching.length > 0) {
      const ids = matching.map((p) => p.id);
      const legacyRes = await sb
        .from("purchase_orders")
        .update(
          { supplier_name: newName, updated_at: new Date().toISOString() },
          { count: "exact" },
        )
        .in("id", ids);
      if (legacyRes.error) {
        console.error("[suppliers] legacy PO update failed:", legacyRes.error);
      } else {
        legacyCount = legacyRes.count ?? matching.length;
      }
    }

    const linkedCount = linkedRes.count ?? 0;
    console.log(
      `[suppliers] synced supplier_name ("${oldName}" → "${newName}") — ` +
        `linked=${linkedCount}, legacy=${legacyCount} (candidates=${candidates?.length ?? 0})`,
    );

    // Invalidate PO-related caches เพื่อให้หน้าอื่นเห็นชื่อใหม่
    revalidatePath("/po");
    revalidatePath("/po/[id]", "page");  // ทุก PO detail page (dynamic route)
    revalidatePath("/po/pending-receipt");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/audit");
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  revalidateTag("suppliers");
  return { ok: true, supplierId: id };
}

// ==================================================================
// Backfill: sync supplier_name on ALL POs to match suppliers table
//
// Run as one-shot from /suppliers page when historical data is drifted.
// แก้ไขทุก PO ที่ supplier_id link แล้วแต่ supplier_name ใน snapshot ผิด
// หรือ PO เก่า (supplier_id IS NULL) ที่ supplier_name ตรงกับ Supplier ใด ๆ
// (normalize trim+case)
// ==================================================================
export interface SyncAllResult {
  ok: boolean;
  error?: string;
  /** จำนวน PO ที่ snapshot ตรง supplier_id แต่ชื่อผิด → fix */
  linkedFixed?: number;
  /** จำนวน PO เก่า (supplier_id=null) ที่ map กับ Supplier ในระบบได้ → fix ชื่อ + link */
  legacyFixed?: number;
  /** total ที่ตรวจ */
  totalChecked?: number;
  /** ชื่อ supplier ที่ normalized ชนกัน (case/whitespace) — ต้องแก้ก่อน */
  collisionWarnings?: string[];
}

export async function syncAllSupplierSnapshotsAction(
  opts: { confirmCollisions?: boolean } = {},
): Promise<SyncAllResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }

  const sb = getSupabaseAdmin();

  // 1. ดึง suppliers ทุกตัว
  const { data: suppliersRaw, error: sErr } = await sb
    .from("suppliers" as never)
    .select("id, name")
    .is("deleted_at", null);
  if (sErr || !suppliersRaw) {
    console.error("[sync-all] fetch suppliers failed:", sErr);
    return { ok: false, error: "อ่านข้อมูล Supplier ไม่สำเร็จ" };
  }
  type SupRow = { id: string; name: string };
  const suppliers = (suppliersRaw as SupRow[]).filter((s) => !!s.name);
  // Map: lowercased trimmed name → { id, canonicalName }
  // ก่อน: 2 suppliers ชื่อคล้าย (case/whitespace ต่าง) → 1 arbitrarily wins
  // หลัง: เก็บ collision + require confirmCollisions=true เพื่อรัน
  const nameToSupplier = new Map<string, { id: string; name: string }>();
  const collisions = new Map<string, string[]>(); // normalized → [canonical names]
  for (const s of suppliers) {
    const norm = s.name.trim().toLowerCase();
    const existing = nameToSupplier.get(norm);
    if (existing && existing.id !== s.id) {
      const arr = collisions.get(norm) ?? [existing.name];
      if (!arr.includes(s.name)) arr.push(s.name);
      collisions.set(norm, arr);
    }
    nameToSupplier.set(norm, { id: s.id, name: s.name });
  }

  if (collisions.size > 0 && !opts.confirmCollisions) {
    const warnings = Array.from(collisions.values()).map(
      (names) => `[${names.join(" | ")}]`,
    );
    return {
      ok: false,
      error:
        `พบชื่อ Supplier ที่ normalized ชนกัน ${collisions.size} กลุ่ม — ` +
        `sync จะเลือก supplier ตัวใดตัวหนึ่งแบบ arbitrary. ` +
        `กรุณาแก้ชื่อให้ต่างกันก่อน หรือกดยืนยันเพื่อ sync ต่อ`,
      collisionWarnings: warnings,
    };
  }

  // 2. ดึง PO ทุกใบที่มี supplier_name (เปล่า → ข้าม)
  const { data: posRaw, error: pErr } = await sb
    .from("purchase_orders")
    .select("id, supplier_id, supplier_name")
    .not("supplier_name", "is", null);
  if (pErr || !posRaw) {
    console.error("[sync-all] fetch POs failed:", pErr);
    return { ok: false, error: "อ่านข้อมูล PO ไม่สำเร็จ" };
  }
  type PoRow = { id: string; supplier_id: string | null; supplier_name: string | null };
  const pos = posRaw as PoRow[];
  const idToSupplier = new Map<string, { id: string; name: string }>();
  for (const s of suppliers) idToSupplier.set(s.id, { id: s.id, name: s.name });

  // 3. ตรวจแต่ละ PO
  //    (a) linked: supplier_id matches a real supplier but snapshot name differs
  //    (b) legacy: supplier_id is null, supplier_name normalized matches a known supplier
  const linkedToFix: Array<{ id: string; newName: string }> = [];
  const legacyToFix: Array<{ id: string; supplierId: string; newName: string }> = [];

  for (const p of pos) {
    if (!p.supplier_name) continue;
    const snapName = p.supplier_name.trim();
    if (p.supplier_id) {
      const sup = idToSupplier.get(p.supplier_id);
      if (sup && sup.name.trim() !== snapName) {
        linkedToFix.push({ id: p.id, newName: sup.name });
      }
    } else {
      const sup = nameToSupplier.get(snapName.toLowerCase());
      if (sup && sup.name !== snapName) {
        // Sync ชื่อ + link supplier_id ให้
        legacyToFix.push({ id: p.id, supplierId: sup.id, newName: sup.name });
      } else if (sup && sup.name === snapName) {
        // ชื่อตรง 100% อยู่แล้ว → แค่ link supplier_id ให้
        legacyToFix.push({ id: p.id, supplierId: sup.id, newName: sup.name });
      }
    }
  }

  console.log(
    `[sync-all] candidates: linked=${linkedToFix.length} legacy=${legacyToFix.length} total POs checked=${pos.length}`,
  );

  // 4. รัน UPDATE ทีละ batch
  let linkedFixed = 0;
  let legacyFixed = 0;
  const nowIso = new Date().toISOString();

  // Group linkedToFix by newName เพื่อ batch UPDATE WHERE id IN (...)
  const byName = new Map<string, string[]>();
  for (const f of linkedToFix) {
    const arr = byName.get(f.newName) ?? [];
    arr.push(f.id);
    byName.set(f.newName, arr);
  }
  for (const [name, ids] of byName) {
    const { error, count } = await sb
      .from("purchase_orders")
      .update({ supplier_name: name, updated_at: nowIso }, { count: "exact" })
      .in("id", ids);
    if (error) {
      console.error("[sync-all] linked fix failed:", error);
    } else {
      linkedFixed += count ?? ids.length;
    }
  }

  // Legacy: ต้อง update ชื่อ + supplier_id ต่อ supplier — batch ตาม supplier
  const bySupId = new Map<string, { name: string; ids: string[] }>();
  for (const f of legacyToFix) {
    const cur = bySupId.get(f.supplierId) ?? { name: f.newName, ids: [] };
    cur.ids.push(f.id);
    bySupId.set(f.supplierId, cur);
  }
  for (const [supId, group] of bySupId) {
    const { error, count } = await sb
      .from("purchase_orders")
      .update(
        { supplier_id: supId, supplier_name: group.name, updated_at: nowIso },
        { count: "exact" },
      )
      .in("id", group.ids);
    if (error) {
      console.error("[sync-all] legacy fix failed:", error);
    } else {
      legacyFixed += count ?? group.ids.length;
    }
  }

  console.log(
    `[sync-all] DONE: linked fixed=${linkedFixed}, legacy fixed=${legacyFixed}, checked=${pos.length}`,
  );

  // Invalidate caches
  revalidatePath("/suppliers");
  revalidatePath("/po");
  revalidatePath("/po/[id]", "page");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/audit");
  revalidateTag("suppliers");

  return { ok: true, linkedFixed, legacyFixed, totalChecked: pos.length };
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

// ==================================================================
// Hard delete — ลบ Supplier ออกจาก DB ถาวร
//
// ⚠️ ใช้เมื่อ admin มั่นใจว่าไม่ต้องการ record นี้แล้ว (เช่น duplicate, ข้อมูลผิด)
// - FK: purchase_orders.supplier_id → ON DELETE SET NULL
//   PO ที่ link supplier นี้ → supplier_id = null (supplier_name snapshot คงเดิม)
// - Audit: ใช้ console.log (DB log ไม่มีเพราะ row หายแล้ว)
// ==================================================================
export interface HardDeleteResult extends ActionResult {
  /** จำนวน PO ที่ supplier_id ถูก SET NULL หลังลบ */
  unlinkedPoCount?: number;
}

/**
 * Preview — เช็คก่อนลบว่าจะกระทบกี่ PO (อ่านอย่างเดียว ไม่แก้ DB)
 * ใช้ใน UI confirm dialog เพื่อแสดง warning ที่ถูกต้อง
 *
 * นับเฉพาะ PO ที่ยังไม่อยู่ในถังขยะ + แยก count ของ PO ที่อยู่ใน active workflow
 * (สั่งซื้อแล้ว/กำลังขนส่ง/รับของแล้ว/มีปัญหา) → warn admin ก่อน move to trash
 */
export async function previewSupplierDeleteAction(
  id: string,
): Promise<{
  ok: boolean;
  error?: string;
  supplierName?: string;
  linkedPoCount?: number;
  activeWorkflowPoCount?: number;
}> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!id) return { ok: false, error: "ข้อมูลไม่ครบ" };

  const sb = getSupabaseAdmin();

  const { data: sup } = await sb
    .from("suppliers" as never)
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const supName = (sup as { name?: string } | null)?.name;
  if (!supName) return { ok: false, error: "ไม่พบ Supplier" };

  // ก่อน: count ไม่ filter deleted_at → PO ในถังขยะถูกนับด้วย (warning overstates)
  // หลัง: filter เอา trashed PO ออก, แยกนับ active workflow แจ้ง admin
  const ACTIVE_WORKFLOW = ["สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา"];
  const [{ count: totalCount }, { count: activeCount }] = await Promise.all([
    sb
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", id)
      .is("deleted_at", null),
    sb
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", id)
      .is("deleted_at", null)
      .in("status", ACTIVE_WORKFLOW),
  ]);

  return {
    ok: true,
    supplierName: supName,
    linkedPoCount: totalCount ?? 0,
    activeWorkflowPoCount: activeCount ?? 0,
  };
}

/**
 * "ลบถาวร" → ตอนนี้คือ "ย้ายไปถังขยะ" (soft delete with recovery)
 * Set deleted_at = NOW() — แสดงใน /trash → กู้คืน หรือลบจริงจากที่นั่นได้
 */
export async function hardDeleteSupplierAction(id: string): Promise<HardDeleteResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!id) return { ok: false, error: "ข้อมูลไม่ครบ" };

  const sb = getSupabaseAdmin();

  const { data: sup } = await sb
    .from("suppliers" as never)
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const supName = (sup as { name?: string } | null)?.name ?? "(ไม่ทราบชื่อ)";

  // นับ PO ที่ link (สำหรับ feedback — ไม่ unlink ตอนนี้ เพราะยังกู้คืนได้)
  const { count: linkedPoCount } = await sb
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id)
    .is("deleted_at", null);

  const { error } = await sb
    .from("suppliers" as never)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_name: me.full_name,
    } as never)
    .eq("id", id);

  if (error) {
    console.error("[suppliers] move to trash failed:", error);
    return { ok: false, error: `ลบไม่สำเร็จ: ${error.message ?? "unknown"}` };
  }

  console.log(
    `[suppliers TRASH] user=${me.full_name} moved "${supName}" (${id}) to trash` +
      ` — ${linkedPoCount ?? 0} linked PO(s) yet to be unlinked (จะ unlink ตอน permanent delete จาก /trash)`,
  );

  revalidatePath("/suppliers");
  revalidatePath("/po");
  revalidatePath("/po/[id]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/trash");
  revalidateTag("suppliers");

  return {
    ok: true,
    supplierId: id,
    unlinkedPoCount: linkedPoCount ?? 0,
  };
}

/**
 * Restore Supplier จากถังขยะ → set deleted_at = NULL
 */
export async function restoreSupplierFromTrashAction(id: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!id) return { ok: false, error: "ข้อมูลไม่ครบ" };

  const sb = getSupabaseAdmin();

  // Race protection — ตรวจก่อนว่ายังอยู่ในถังขยะจริง
  const { data: sup } = await sb
    .from("suppliers" as never)
    .select("name, deleted_at")
    .eq("id", id)
    .maybeSingle();
  type SupRow = { name: string; deleted_at: string | null };
  const supRow = sup as SupRow | null;
  if (!supRow) return { ok: false, error: "ไม่พบ Supplier" };
  if (!supRow.deleted_at) {
    return {
      ok: false,
      error: "Supplier ถูกกู้คืนโดยผู้ใช้คนอื่นแล้ว — refresh หน้าเพื่อดูข้อมูลล่าสุด",
    };
  }

  const { error, count } = await sb
    .from("suppliers" as never)
    .update({ deleted_at: null, deleted_by_name: null } as never, { count: "exact" })
    .eq("id", id);
  if (error) {
    console.error("[suppliers] restore from trash failed:", error);
    return { ok: false, error: "กู้คืนไม่สำเร็จ" };
  }
  if (!count) {
    return { ok: false, error: "ไม่พบ Supplier ที่กู้คืน" };
  }
  console.log(`[suppliers RESTORE] user=${me.full_name} restored "${supRow.name}" (${id}) from trash`);

  // Comprehensive cache invalidation — supplier กลับมาแสดงในหน้าอื่นๆ
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/po");
  revalidatePath("/po/[id]", "page");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/trash");
  revalidateTag("suppliers");
  return { ok: true, supplierId: id };
}

/**
 * Permanent delete จากถังขยะ → DELETE จริง + unlink PO
 */
export async function permanentDeleteSupplierAction(id: string): Promise<HardDeleteResult> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!id) return { ok: false, error: "ข้อมูลไม่ครบ" };

  const sb = getSupabaseAdmin();

  // ตรวจว่าอยู่ในถังขยะจริง — กันลบ supplier ที่ active โดยไม่ตั้งใจ
  const { data: sup } = await sb
    .from("suppliers" as never)
    .select("name, deleted_at")
    .eq("id", id)
    .maybeSingle();
  type SupRow = { name: string; deleted_at: string | null };
  const supRow = sup as SupRow | null;
  if (!supRow) return { ok: false, error: "ไม่พบ Supplier" };
  if (!supRow.deleted_at) {
    return {
      ok: false,
      error: "Supplier ยังไม่อยู่ในถังขยะ — กดลบก่อนแล้วค่อยลบถาวร",
    };
  }

  const { count: linkedPoCount } = await sb
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id);

  const { error } = await sb.from("suppliers" as never).delete().eq("id", id);
  if (error) {
    console.error("[suppliers] permanent delete failed:", error);
    return { ok: false, error: `ลบไม่สำเร็จ: ${error.message ?? "unknown"}` };
  }

  console.log(
    `[suppliers PERMANENT-DELETE] user=${me.full_name} deleted "${supRow.name}" (${id})` +
      ` — unlinked ${linkedPoCount ?? 0} PO(s) — supplier_id → null`,
  );

  revalidatePath("/suppliers");
  revalidatePath("/trash");
  revalidatePath("/po");
  revalidatePath("/po/[id]", "page");
  revalidateTag("suppliers");

  return {
    ok: true,
    supplierId: id,
    unlinkedPoCount: linkedPoCount ?? 0,
  };
}
