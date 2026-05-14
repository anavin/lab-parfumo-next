"use server";

/**
 * Equipment server actions — create, update, delete, approve, reject, bulk approve
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface ActionResult {
  ok: boolean;
  error?: string;
  equipmentId?: string;
}

// ==================================================================
// Create / Update / Delete
// ==================================================================
export interface NewEquipmentInput {
  name: string;
  category: string;
  sku?: string;
  unit?: string;
  description?: string;
  lastCost?: number;
  stock?: number;
  reorderLevel?: number;
  imageUrls?: string[];
}

export async function createEquipmentAction(
  input: NewEquipmentInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อ" };

  const sb = getSupabaseAdmin();
  const urls = input.imageUrls ?? [];
  const { data, error } = await sb
    .from("equipment")
    .insert({
      name: input.name.trim(),
      category: input.category || "อุปกรณ์อื่นๆ",
      sku: (input.sku ?? "").trim() || null,
      unit: input.unit || "ชิ้น",
      description: input.description ?? "",
      last_cost: Number(input.lastCost ?? 0),
      stock: Math.floor(input.stock ?? 0),
      reorder_level: Math.floor(input.reorderLevel ?? 0),
      image_url: urls[0] ?? null,
      image_urls: urls,
      is_active: true,
      approval_status: "approved",
    })
    .select()
    .maybeSingle();
  if (error || !data) {
    console.error("[equipment] create failed:", error);
    return { ok: false, error: "เพิ่มสินค้าไม่สำเร็จ" };
  }

  revalidatePath("/equipment");
  return { ok: true, equipmentId: data.id };
}

export async function updateEquipmentAction(
  equipmentId: string, patch: Partial<NewEquipmentInput>,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.sku !== undefined) update.sku = patch.sku.trim() || null;
  if (patch.unit !== undefined) update.unit = patch.unit;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.lastCost !== undefined) update.last_cost = Number(patch.lastCost);
  if (patch.stock !== undefined) update.stock = Math.floor(patch.stock);
  if (patch.reorderLevel !== undefined) {
    update.reorder_level = Math.floor(patch.reorderLevel);
  }
  if (patch.imageUrls !== undefined) {
    update.image_urls = patch.imageUrls;
    update.image_url = patch.imageUrls[0] ?? null;
  }

  const { error } = await sb.from("equipment").update(update).eq("id", equipmentId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };

  revalidatePath("/equipment");
  return { ok: true, equipmentId };
}

// ==================================================================
// Bulk import (Phase C — CSV)
// Insert ทีละ batch + skip duplicate name (case-insensitive)
// ==================================================================
export interface BulkRowInput {
  name: string;
  category?: string;
  sku?: string;
  unit?: string;
  description?: string;
  lastCost?: number;
  stock?: number;
  reorderLevel?: number;
}
export interface BulkResult {
  ok: boolean;
  error?: string;
  inserted: number;
  skipped: number;          // ซ้ำชื่อ
  failed: number;           // insert ผิดพลาด
  failedReasons?: string[]; // เก็บ 5 รายแรกพอ
}

export async function bulkCreateEquipmentAction(
  rows: BulkRowInput[],
): Promise<BulkResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor", inserted: 0, skipped: 0, failed: 0 };
  }
  if (!rows.length) {
    return { ok: false, error: "ไม่มีข้อมูล", inserted: 0, skipped: 0, failed: 0 };
  }
  if (rows.length > 5000) {
    return {
      ok: false,
      error: "เกิน limit 5,000 แถวต่อรอบ — ลอง split ไฟล์",
      inserted: 0, skipped: 0, failed: 0,
    };
  }

  const sb = getSupabaseAdmin();

  // 1. Pre-fetch existing names (case-insensitive dedupe)
  const { data: existing } = await sb
    .from("equipment")
    .select("name");
  const existingSet = new Set(
    ((existing ?? []) as Array<{ name: string }>).map((e) => e.name.trim().toLowerCase()),
  );

  // 2. Validation rules per row (Zod-like + formula injection guard)
  const NAME_MAX = 200;
  const TEXT_MAX = 80;
  const DESC_MAX = 1000;
  const NUM_MAX = 99_999_999;

  // กัน CSV formula injection (Excel/Sheets) — strip leading =,+,-,@ จาก text fields
  function safeText(s: string | undefined): string {
    if (!s) return "";
    const trimmed = s.trim();
    if (/^[=+\-@]/.test(trimmed)) return `'${trimmed}`;  // prepend quote → ปลอดภัย
    return trimmed;
  }

  // 3. Build payload + dedupe within input itself
  const seenInBatch = new Set<string>();
  const payload: Record<string, unknown>[] = [];
  const validationErrors: string[] = [];
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNo = i + 2; // +1 header, +1 1-indexed

    const name = safeText(r.name);
    if (!name) {
      skipped++;
      continue;
    }
    if (name.length > NAME_MAX) {
      validationErrors.push(`row ${rowNo}: name ยาวเกิน ${NAME_MAX} ตัวอักษร`);
      skipped++;
      continue;
    }
    const key = name.toLowerCase();
    if (existingSet.has(key) || seenInBatch.has(key)) {
      skipped++;
      continue;
    }
    // Validate other fields
    const category = safeText(r.category).slice(0, TEXT_MAX) || "อุปกรณ์อื่นๆ";
    const sku = safeText(r.sku).slice(0, 50) || null;
    const unit = safeText(r.unit).slice(0, 20) || "ชิ้น";
    const description = safeText(r.description).slice(0, DESC_MAX);
    const lastCost = Math.max(0, Math.min(NUM_MAX, Number(r.lastCost ?? 0) || 0));
    const stock = Math.max(0, Math.min(NUM_MAX, Math.floor(Number(r.stock ?? 0)) || 0));
    const reorderLevel = Math.max(0, Math.min(NUM_MAX, Math.floor(Number(r.reorderLevel ?? 0)) || 0));

    seenInBatch.add(key);
    payload.push({
      name,
      category,
      sku,
      unit,
      description,
      last_cost: lastCost,
      stock,
      reorder_level: reorderLevel,
      is_active: true,
      approval_status: "approved",
    });
  }

  if (!payload.length) {
    return {
      ok: true,
      inserted: 0,
      skipped,
      failed: 0,
    };
  }

  // 3. Insert in chunks of 100
  const CHUNK = 100;
  let inserted = 0;
  let failed = 0;
  const failedReasons: string[] = [];
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error, count } = await sb
      .from("equipment")
      .insert(slice as never, { count: "exact" });
    if (error) {
      failed += slice.length;
      if (failedReasons.length < 5) failedReasons.push(error.message);
    } else {
      inserted += count ?? slice.length;
    }
  }

  revalidatePath("/equipment");
  // Merge validation errors into failedReasons (deduplicate)
  const allReasons = [...validationErrors, ...failedReasons].slice(0, 10);
  return {
    ok: true,
    inserted,
    skipped,
    failed,
    failedReasons: allReasons.length ? allReasons : undefined,
  };
}

export async function deleteEquipmentAction(
  equipmentId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  // Soft-delete (เหมือน Streamlit)
  const { error } = await sb
    .from("equipment")
    .update({ is_active: false })
    .eq("id", equipmentId);
  if (error) return { ok: false, error: "ลบไม่สำเร็จ" };
  revalidatePath("/equipment");
  return { ok: true };
}

// ==================================================================
// Approve pending equipment (single, with full info)
// ==================================================================
export async function approveEquipmentAction(
  equipmentId: string, input: {
    sku: string;
    name: string;
    category: string;
    unit?: string;
    description?: string;
    lastCost?: number;
    stock?: number;
  },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!input.sku.trim()) return { ok: false, error: "กรุณากรอก SKU" };
  if (!input.name.trim()) return { ok: false, error: "กรุณากรอกชื่อ" };
  if (!input.category || input.category === "(รออนุมัติ)") {
    return { ok: false, error: "กรุณาเลือกหมวด" };
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("equipment")
    .update({
      sku: input.sku.trim(),
      name: input.name.trim(),
      category: input.category,
      unit: input.unit || "ชิ้น",
      description: input.description ?? "",
      last_cost: Number(input.lastCost ?? 0),
      stock: Math.floor(input.stock ?? 0),
      approval_status: "approved",
      approved_by_name: user.full_name,
      approved_at: new Date().toISOString(),
    })
    .eq("id", equipmentId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };

  revalidatePath("/equipment");
  return { ok: true, equipmentId };
}

// ==================================================================
// Bulk approve — ใช้ค่าที่มีอยู่ + default category
// ==================================================================
export async function bulkApproveEquipmentAction(
  equipmentIds: string[], defaultCategory = "อุปกรณ์อื่นๆ",
): Promise<{ ok: boolean; success: number; failed: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, success: 0, failed: 0, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (!equipmentIds.length) {
    return { ok: false, success: 0, failed: 0, error: "ไม่ได้เลือกรายการ" };
  }

  const sb = getSupabaseAdmin();
  let success = 0;
  let failed = 0;

  for (const eqId of equipmentIds) {
    try {
      const { data: eq } = await sb
        .from("equipment").select("*").eq("id", eqId).maybeSingle();
      if (!eq) { failed++; continue; }

      const sku = eq.sku || `AUTO-${eqId.slice(0, 8)}`;
      const { error } = await sb
        .from("equipment")
        .update({
          sku,
          category: defaultCategory,
          unit: eq.unit || "ชิ้น",
          description: eq.suggested_notes || eq.description || "",
          approval_status: "approved",
          approved_by_name: user.full_name,
          approved_at: new Date().toISOString(),
        })
        .eq("id", eqId);
      if (error) failed++;
      else success++;
    } catch {
      failed++;
    }
  }

  revalidatePath("/equipment");
  return { ok: success > 0, success, failed };
}

// ==================================================================
// Image management — add / remove
// ==================================================================
export async function addEquipmentImageAction(
  equipmentId: string, imageUrl: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  const { data: eq } = await sb
    .from("equipment")
    .select("image_url, image_urls")
    .eq("id", equipmentId)
    .maybeSingle();
  if (!eq) return { ok: false, error: "ไม่พบสินค้า" };

  const urls: string[] = Array.from(eq.image_urls ?? []);
  if (eq.image_url && !urls.includes(eq.image_url)) urls.unshift(eq.image_url);
  if (!urls.includes(imageUrl)) urls.push(imageUrl);

  const { error } = await sb
    .from("equipment")
    .update({
      image_urls: urls,
      image_url: urls[0] ?? null,
    })
    .eq("id", equipmentId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };

  revalidatePath("/equipment");
  return { ok: true, equipmentId };
}

export async function removeEquipmentImageAction(
  equipmentId: string, imageUrl: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  const { data: eq } = await sb
    .from("equipment")
    .select("image_url, image_urls")
    .eq("id", equipmentId)
    .maybeSingle();
  if (!eq) return { ok: false, error: "ไม่พบสินค้า" };

  let urls: string[] = Array.from(eq.image_urls ?? []);
  if (eq.image_url && !urls.includes(eq.image_url)) urls.unshift(eq.image_url);
  urls = urls.filter((u) => u !== imageUrl);

  const { error } = await sb
    .from("equipment")
    .update({
      image_urls: urls,
      image_url: urls[0] ?? null,
    })
    .eq("id", equipmentId);
  if (error) return { ok: false, error: "ลบรูปไม่สำเร็จ" };

  revalidatePath("/equipment");
  return { ok: true, equipmentId };
}

// ==================================================================
// Categories management
// ==================================================================
export async function addCategoryAction(
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "กรุณากรอกชื่อหมวด" };

  const sb = getSupabaseAdmin();
  // Find next display_order
  const { data: max } = await sb
    .from("equipment_categories")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((max as { display_order: number | null } | null)?.display_order ?? 0) + 1;

  const { error } = await sb
    .from("equipment_categories")
    .insert({ name: trimmed, display_order: nextOrder });
  if (error) {
    if (String(error.message ?? "").toLowerCase().includes("duplicate")) {
      return { ok: false, error: "มีหมวดนี้อยู่แล้ว" };
    }
    return { ok: false, error: "เพิ่มหมวดไม่สำเร็จ" };
  }
  revalidatePath("/equipment");
  revalidatePath("/po/new"); // category dropdown ใน equipment grid
  revalidateTag("categories");
  return { ok: true };
}

export async function updateCategoryAction(
  oldName: string, newName: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, error: "กรุณากรอกชื่อใหม่" };
  if (trimmed === oldName) return { ok: true };

  const sb = getSupabaseAdmin();
  await sb.from("equipment_categories").update({ name: trimmed }).eq("name", oldName);
  await sb.from("equipment").update({ category: trimmed }).eq("category", oldName);
  revalidatePath("/equipment");
  revalidatePath("/po/new"); // category dropdown ใน equipment grid
  revalidateTag("categories");
  return { ok: true };
}

export async function deleteCategoryAction(
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  // Check if equipment uses this category
  const { count } = await sb
    .from("equipment")
    .select("id", { count: "exact", head: true })
    .eq("category", name)
    .eq("is_active", true);
  if (count && count > 0) {
    return { ok: false, error: `มีสินค้า ${count} รายการในหมวดนี้ — ย้ายออกก่อน` };
  }
  await sb.from("equipment_categories").delete().eq("name", name);
  revalidatePath("/equipment");
  revalidatePath("/po/new"); // category dropdown ใน equipment grid
  revalidateTag("categories");
  return { ok: true };
}

export async function moveCategoryAction(
  name: string, direction: "up" | "down",
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  const { data: cats } = await sb
    .from("equipment_categories")
    .select("*")
    .order("display_order", { ascending: true });
  if (!cats) return { ok: false, error: "ไม่พบหมวด" };

  const idx = cats.findIndex((c: { name: string }) => c.name === name);
  if (idx < 0) return { ok: false, error: "ไม่พบหมวดนี้" };
  if (direction === "up" && idx === 0) return { ok: false, error: "อยู่บนสุดแล้ว" };
  if (direction === "down" && idx === cats.length - 1) {
    return { ok: false, error: "อยู่ล่างสุดแล้ว" };
  }

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  const a = cats[idx] as { id: string; display_order: number | null };
  const b = cats[targetIdx] as { id: string; display_order: number | null };
  const orderA = a.display_order ?? idx + 1;
  const orderB = b.display_order ?? targetIdx + 1;

  await sb.from("equipment_categories").update({ display_order: orderB }).eq("id", a.id);
  await sb.from("equipment_categories").update({ display_order: orderA }).eq("id", b.id);
  revalidatePath("/equipment");
  revalidatePath("/po/new"); // category dropdown ใน equipment grid
  revalidateTag("categories");
  return { ok: true };
}

// ==================================================================
// Reject (soft)
// ==================================================================
export async function rejectEquipmentAction(
  equipmentId: string, reason = "",
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("equipment")
    .update({
      approval_status: "rejected",
      rejected_reason: reason,
      rejected_by_name: user.full_name,
      rejected_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", equipmentId);
  if (error) return { ok: false, error: "ปฏิเสธไม่สำเร็จ" };
  revalidatePath("/equipment");
  return { ok: true };
}
