"use server";

/**
 * PO Server Actions — close, cancel, clone, comment, status update
 *
 * ทุก action:
 * 1. ตรวจ session (current user)
 * 2. ตรวจสิทธิ์ (ตาม role + เจ้าของ)
 * 3. ทำงานกับ DB
 * 4. log_activity
 * 5. revalidatePath เพื่อ refresh UI
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { suggestEquipmentFromPo } from "@/lib/db/equipment";
import type {
  PoStatus, PoItem, PurchaseOrder, PoAttachment,
} from "@/lib/types/db";
import { createPoSchema, cancelPoSchema, formatZodError } from "./schemas";

interface ActionResult {
  ok: boolean;
  error?: string;
  poId?: string;
  poNumber?: string;
}

// ==================================================================
// Activity log + notifications (helpers)
// ==================================================================
async function logActivity(
  poId: string, userName: string, userRole: string,
  action: string, description: string,
) {
  const sb = getSupabaseAdmin();
  await sb.from("po_activities" as never).insert({
    po_id: poId, user_name: userName, user_role: userRole,
    action, description,
  } as never);
}

async function notifyAdmins(
  poId: string, title: string, message: string,
) {
  const sb = getSupabaseAdmin();
  const { data: admins } = await sb
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  if (!admins?.length) return;
  await sb.from("notifications").insert(
    admins.map((a: { id: string }) => ({
      user_id: a.id, po_id: poId, title, message,
    })),
  );
}

async function notifyUser(
  userId: string, poId: string, title: string, message: string,
) {
  const sb = getSupabaseAdmin();
  await sb.from("notifications").insert({
    user_id: userId, po_id: poId, title, message,
  });
}

// ==================================================================
// Status updates: close, cancel, ship
// ==================================================================
async function _updateStatus(
  poId: string, newStatus: PoStatus, note: string, trackingNumber?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (trackingNumber !== undefined) update.tracking_number = trackingNumber;
  if (newStatus === "เสร็จสมบูรณ์" && !po.received_date) {
    update.received_date = new Date().toISOString().slice(0, 10);
  }

  const { error } = await sb.from("purchase_orders").update(update).eq("id", poId);
  if (error) return { ok: false, error: "บันทึกไม่สำเร็จ" };

  await logActivity(
    poId, user.full_name, user.role, "status_changed",
    `${po.status} → ${newStatus}${note ? ` | ${note}` : ""}`,
  );

  // Notifications (ตาม Streamlit เดิม)
  try {
    if (newStatus === "กำลังขนส่ง" && po.created_by) {
      const tk = trackingNumber ? ` • Tracking: ${trackingNumber}` : "";
      await notifyUser(
        po.created_by, poId,
        `🚚 ${po.po_number} กำลังขนส่ง`,
        `Supplier ส่งของแล้ว${tk} — เตรียมรับของได้`,
      );
    } else if (newStatus === "เสร็จสมบูรณ์" && po.created_by) {
      await notifyUser(
        po.created_by, poId,
        `🎉 ${po.po_number} เสร็จสมบูรณ์`,
        "ปิดงานเรียบร้อย",
      );
    } else if (newStatus === "ยกเลิก") {
      if (po.created_by) {
        await notifyUser(
          po.created_by, poId,
          `❌ ${po.po_number} ถูกยกเลิก`,
          `โดย ${user.full_name}${note ? ` • ${note}` : ""}`,
        );
      }
      await notifyAdmins(
        poId, `❌ ${po.po_number} ถูกยกเลิก`, `โดย ${user.full_name}`,
      );
    }
  } catch {
    // notification ล้มเหลวไม่ควร block action
  }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/dashboard");
  return { ok: true, poId, poNumber: po.po_number };
}

// ==================================================================
// Close PO
// ==================================================================
export async function closePoAction(poId: string): Promise<ActionResult> {
  return _updateStatus(poId, "เสร็จสมบูรณ์", "ปิดงาน");
}

// ==================================================================
// Cancel PO (with reason)
// ==================================================================
export async function cancelPoAction(
  poId: string, reason: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const parsed = cancelPoSchema.safeParse({ poId, reason });
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  // Permission: requester ยกเลิกได้เฉพาะของตัวเอง
  if (user.role === "requester") {
    const sb = getSupabaseAdmin();
    const { data: po } = await sb
      .from("purchase_orders")
      .select("created_by")
      .eq("id", poId)
      .maybeSingle();
    if (!po || po.created_by !== user.id) {
      return { ok: false, error: "ไม่มีสิทธิ์ยกเลิก PO นี้" };
    }
  }

  return _updateStatus(poId, "ยกเลิก", reason);
}

// ==================================================================
// Ship (admin) — update tracking + status to กำลังขนส่ง
// ==================================================================
export async function shipPoAction(
  poId: string, trackingNumber: string, note: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }
  return _updateStatus(poId, "กำลังขนส่ง", note, trackingNumber);
}

// ==================================================================
// Clone PO — copy items → create new draft PO
// ==================================================================
export async function clonePoAction(sourcePoId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sb = getSupabaseAdmin();
  const { data: source } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", sourcePoId)
    .maybeSingle();
  if (!source) {
    redirect("/po");
  }

  // สร้าง items ใหม่ (clone โดยตัด price/subtotal ออก)
  const sourcePo = source as PurchaseOrder;
  const newItems: PoItem[] = (sourcePo.items ?? []).map((it) => ({
    equipment_id: it.equipment_id,
    name: it.name,
    qty: it.qty,
    unit: it.unit,
    notes: it.notes,
    image_urls: it.image_urls,
  }));

  const newPoNumber = await generatePoNumber();
  const { data: newPo } = await sb
    .from("purchase_orders")
    .insert({
      po_number: newPoNumber,
      items: newItems,
      purpose: "",
      notes: `[คัดลอกจาก ${sourcePo.po_number}] ${sourcePo.notes ?? ""}`.trim(),
      status: "รอจัดซื้อดำเนินการ",
      created_by: user.id,
      created_by_name: user.full_name,
    })
    .select()
    .maybeSingle();

  if (!newPo) {
    redirect("/po");
  }

  await logActivity(
    newPo!.id, user.full_name, user.role, "cloned",
    `คัดลอกจาก ${sourcePo.po_number}`,
  );
  revalidatePath("/po");
  revalidatePath("/dashboard");
  redirect(`/po/${newPo!.id}`);
}

// ==================================================================
// Add Comment
// ==================================================================
export async function addCommentAction(
  poId: string, message: string,
): Promise<ActionResult> {
  if (!message.trim()) {
    return { ok: false, error: "ข้อความว่าง — กรุณาพิมพ์ข้อความ" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("po_comments" as never).insert({
    po_id: poId,
    user_name: user.full_name,
    user_role: user.role,
    message: message.trim(),
  } as never);
  if (error) return { ok: false, error: "บันทึก comment ไม่สำเร็จ" };

  await logActivity(
    poId, user.full_name, user.role, "commented",
    message.trim().slice(0, 100),
  );
  revalidatePath(`/po/${poId}`);
  return { ok: true, poId };
}

// ==================================================================
// PO Attachments — add / remove
// ==================================================================

export async function addPoAttachmentsAction(
  poId: string,
  newAttachments: PoAttachment[],
  category: "order" | "shipping" | "general" = "general",
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };
  if (!newAttachments.length) return { ok: false, error: "ไม่มีไฟล์" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("attachment_urls, po_number")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const existing: PoAttachment[] = (po.attachment_urls ?? []) as PoAttachment[];
  const enriched = newAttachments.map((a) => ({
    ...a,
    category,
    uploaded_by: user.full_name,
  }));
  const merged = [...existing, ...enriched];

  await sb
    .from("purchase_orders")
    .update({
      attachment_urls: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  await logActivity(
    poId, user.full_name, user.role, "attached",
    `แนบไฟล์ ${newAttachments.length} ไฟล์`,
  );

  revalidatePath(`/po/${poId}`);
  return { ok: true, poId };
}

export async function removePoAttachmentAction(
  poId: string, attachmentUrl: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("attachment_urls")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const existing: PoAttachment[] = (po.attachment_urls ?? []) as PoAttachment[];
  const removed = existing.find((a) => a.url === attachmentUrl);
  const newList = existing.filter((a) => a.url !== attachmentUrl);

  await sb
    .from("purchase_orders")
    .update({
      attachment_urls: newList,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  if (removed) {
    await logActivity(
      poId, user.full_name, user.role, "attachment_removed",
      `ลบไฟล์: ${removed.name}`,
    );
  }
  revalidatePath(`/po/${poId}`);
  return { ok: true, poId };
}

// ==================================================================
// PO number generator — ใช้ RPC ถ้ามี (atomic), fallback ถ้าไม่มี
//
// ⚠️ RPC คือ source of truth — Postgres `next_po_number()` atomic
// Fallback (read-modify-write) มี race condition:
//   user A read 5 → user B read 5 → ทั้งคู่ +1 = 6 → ออก PO ซ้ำ!
// แก้โดยใช้ MAX(po_number) บน table จริง (last-resort, ยังไม่ atomic
// แต่กันชน RPC fail ได้ปกติ + ตรวจซ้ำหลังสร้างแล้ว throw ถ้า dup)
// ==================================================================
export async function generatePoNumber(): Promise<string> {
  const sb = getSupabaseAdmin();
  const year = new Date().getFullYear();
  // Primary: RPC (atomic via Postgres function จาก migration_atomic_counter.sql)
  try {
    const { data, error } = await sb.rpc("next_po_number", { year_int: year });
    if (!error && data) return String(data);
  } catch {
    // fallthrough
  }

  // Fallback: read MAX(po_number) จาก table จริง (มี race condition แต่ดีกว่า counter row)
  const prefix = `PO-${year}-`;
  const { data: rows, error: maxErr } = await sb
    .from("purchase_orders")
    .select("po_number")
    .like("po_number", `${prefix}%`)
    .order("po_number", { ascending: false })
    .limit(1);
  if (maxErr) {
    throw new Error(`ไม่สามารถสร้างเลข PO: ${maxErr.message}`);
  }
  let next = 1;
  if (rows?.length) {
    const last = rows[0].po_number as string;
    const match = last.match(/PO-\d{4}-(\d+)/);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ==================================================================
// Create PO
// ==================================================================
export async function createPoAction(
  items: PoItem[], notes: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  // Validate input
  const parsed = createPoSchema.safeParse({ items, notes });
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }

  const sb = getSupabaseAdmin();

  // Sanitize items
  const cleanItems: PoItem[] = items.map((it) => ({
    equipment_id: it.equipment_id ?? null,
    name: it.name,
    qty: Math.max(1, Math.floor(it.qty ?? 0)),
    unit: it.unit ?? "ชิ้น",
    unit_price: 0,
    subtotal: 0,
    notes: it.notes ?? "",
    image_urls: it.image_urls ?? [],
  }));

  // Retry on duplicate po_number — กัน race ตอน RPC fallback ใช้
  let newPo: { id: string; po_number: string } | null = null;
  let lastErr: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const poNumber = await generatePoNumber();
    const { data, error } = await sb
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        items: cleanItems,
        purpose: "",
        notes,
        status: "รอจัดซื้อดำเนินการ",
        created_by: user.id,
        created_by_name: user.full_name,
      })
      .select()
      .maybeSingle();
    if (data) {
      newPo = data as { id: string; po_number: string };
      break;
    }
    lastErr = error ?? null;
    // 23505 = unique_violation — เลข PO ซ้ำ → ลอง gen ใหม่
    if (error?.code !== "23505") break;
  }
  if (!newPo) {
    return {
      ok: false,
      error: `สร้าง PO ไม่สำเร็จ — ${lastErr?.message ?? "ลองใหม่อีกครั้ง"}`,
    };
  }

  await logActivity(
    newPo.id, user.full_name, user.role, "created",
    `สร้าง PO มี ${items.length} รายการ`,
  );

  // Suggest pending equipment สำหรับ custom items
  let anyLinked = false;
  for (let i = 0; i < cleanItems.length; i++) {
    const it = cleanItems[i];
    if (!it.equipment_id && it.name) {
      const pending = await suggestEquipmentFromPo({
        name: it.name,
        unit: it.unit,
        notes: it.notes ?? "",
        imageUrls: it.image_urls ?? [],
        suggestedBy: user.id,
        suggestedByName: user.full_name,
        suggestedFromPo: newPo.id,
      });
      if (pending) {
        cleanItems[i].equipment_id = pending.id;
        anyLinked = true;
      }
    }
  }
  if (anyLinked) {
    await sb
      .from("purchase_orders")
      .update({ items: cleanItems })
      .eq("id", newPo.id);
  }

  // Notify admins
  try {
    const nCustom = items.filter((it) => !it.equipment_id).length;
    const msg = `${newPo.po_number} • ${items.length} รายการ${
      nCustom > 0 ? ` (มี ${nCustom} รายการใหม่ที่รออนุมัติ)` : ""
    }`;
    await notifyAdmins(newPo.id, `📥 PO ใหม่จาก ${user.full_name}`, msg);
  } catch {
    // ok ถ้าแจ้งไม่ได้
  }

  revalidatePath("/po");
  revalidatePath("/dashboard");
  return { ok: true, poId: newPo.id, poNumber: newPo.po_number };
}

// ==================================================================
// Procurement: Admin → กรอก supplier + ราคา → status = สั่งซื้อแล้ว
// ==================================================================
export interface ProcurementInput {
  supplierName: string;
  supplierContact: string;
  itemPrices: Array<{ unit_price: number }>;  // ตรงตำแหน่งกับ po.items
  discount: number;
  shippingFee: number;
  vatRate: number;          // 0 หรือ 0.07
  expectedDate: string;     // YYYY-MM-DD
  procurementNotes: string;
  /** Set to true when admin acknowledged a budget warning */
  acknowledgeOverBudget?: boolean;
}

export interface ProcurementResult extends ActionResult {
  /** When set, server is asking for budget confirmation */
  budgetWarning?: {
    budgetName: string;
    budgetAmount: number;
    actualBefore: number;
    poTotal: number;
    actualAfter: number;
    overBy: number;
  };
}

export async function updateProcurementAction(
  poId: string, input: ProcurementInput,
): Promise<ProcurementResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { ok: false, error: "เฉพาะแอดมิน" };
  }
  if (!input.supplierName.trim()) {
    return { ok: false, error: "กรุณากรอกชื่อ supplier" };
  }
  if (!input.expectedDate) {
    return { ok: false, error: "กรุณาเลือกวันที่คาดว่าจะได้รับ" };
  }

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  const items = (po.items ?? []) as PoItem[];
  if (input.itemPrices.length !== items.length) {
    return { ok: false, error: "จำนวน items ไม่ตรงกับฟอร์ม" };
  }

  // Build new items with prices
  const newItems = items.map((it, idx) => {
    const unitPrice = Math.max(0, input.itemPrices[idx]?.unit_price ?? 0);
    return {
      ...it,
      unit_price: unitPrice,
      subtotal: unitPrice * (it.qty ?? 0),
    };
  });

  const subtotal = newItems.reduce((s, it) => s + (it.subtotal ?? 0), 0);
  const vat = subtotal * input.vatRate;
  const total = subtotal - input.discount + input.shippingFee + vat;

  // Budget check — warn if this PO pushes spending over any active budget
  if (!input.acknowledgeOverBudget) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    try {
      const { getBudgetStatusForMonth } = await import("@/lib/db/budget");
      const statuses = await getBudgetStatusForMonth(year, month);
      // Find any active budget that would go over after this PO
      for (const b of statuses) {
        // Skip category-specific budgets (would need category match)
        if (b.category) continue;
        const newActual = b.actual + total;
        if (newActual > b.amount && b.actual <= b.amount) {
          // Crossing the threshold
          return {
            ok: false,
            budgetWarning: {
              budgetName: b.period_type === "monthly"
                ? `งบเดือน ${month}/${year}`
                : b.period_type === "yearly"
                  ? `งบปี ${year}`
                  : `งบไตรมาส ${year}`,
              budgetAmount: b.amount,
              actualBefore: b.actual,
              poTotal: total,
              actualAfter: newActual,
              overBy: newActual - b.amount,
            },
          };
        }
      }
    } catch {
      // budget check ล้มเหลว — ปล่อยให้ทำงานต่อ (don't block)
    }
  }

  const { error } = await sb
    .from("purchase_orders")
    .update({
      supplier_name: input.supplierName.trim(),
      supplier_contact: input.supplierContact.trim(),
      items: newItems,
      subtotal,
      discount: input.discount,
      shipping_fee: input.shippingFee,
      vat,
      total,
      expected_date: input.expectedDate,
      ordered_date: new Date().toISOString().slice(0, 10),
      procurement_notes: input.procurementNotes.trim(),
      status: "สั่งซื้อแล้ว",
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);
  if (error) {
    console.error("[procurement] update failed:", error);
    return { ok: false, error: "บันทึกไม่สำเร็จ" };
  }

  // Update last_cost ของ equipment
  for (const it of newItems) {
    if (it.equipment_id && (it.unit_price ?? 0) > 0) {
      await sb
        .from("equipment")
        .update({ last_cost: it.unit_price })
        .eq("id", it.equipment_id);
    }
  }

  await logActivity(
    poId, user.full_name, user.role, "ordered",
    `สั่งกับ ${input.supplierName} | คาดได้ ${input.expectedDate}`,
  );

  if (po.created_by) {
    try {
      await notifyUser(
        po.created_by, poId,
        `✅ ${po.po_number} สั่งซื้อแล้ว`,
        `แอดมินสั่งกับ ${input.supplierName} • คาดว่าจะได้รับ ${input.expectedDate}`,
      );
    } catch { /* ok */ }
  }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/dashboard");
  return { ok: true, poId, poNumber: po.po_number };
}

// ==================================================================
// Add Delivery (รับของ) — staff หรือ admin
// ==================================================================
export interface DeliveryItem {
  equipment_id: string | null;
  name: string;
  qty_ordered: number;
  qty_received: number;
  qty_damaged: number;
  notes?: string;
}

export interface DeliveryInput {
  itemsReceived: DeliveryItem[];
  overallCondition: string;     // ปกติ / มีของเสียหาย / ขาดจำนวน / ส่งผิด / อื่นๆ
  issueDescription: string;
  notes: string;
  imageUrls: string[];          // ที่อัปโหลดเสร็จแล้ว
}

export async function addDeliveryAction(
  poId: string, input: DeliveryInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const sb = getSupabaseAdmin();
  const { data: po } = await sb
    .from("purchase_orders")
    .select("*")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { ok: false, error: "ไม่พบใบ PO" };

  // Permission: requester รับของได้เฉพาะ PO ที่ตัวเองสร้าง
  if (user.role === "requester" && po.created_by !== user.id) {
    return { ok: false, error: "ไม่มีสิทธิ์รับของ PO นี้" };
  }

  // หา delivery_no ใหม่
  const { data: existingDeliveries } = await sb
    .from("po_deliveries" as never)
    .select("delivery_no")
    .eq("po_id", poId);
  const maxNo = ((existingDeliveries ?? []) as Array<{ delivery_no: number }>)
    .reduce((m, d) => Math.max(m, d.delivery_no ?? 0), 0);
  const newNo = maxNo + 1;

  // Insert delivery record
  const { error: deliveryErr } = await sb
    .from("po_deliveries" as never)
    .insert({
      po_id: poId,
      delivery_no: newNo,
      received_date: new Date().toISOString().slice(0, 10),
      received_by_name: user.full_name,
      items_received: input.itemsReceived,
      overall_condition: input.overallCondition,
      issue_description: input.issueDescription,
      notes: input.notes,
      image_urls: input.imageUrls,
    } as never);
  if (deliveryErr) {
    console.error("[delivery] insert failed:", deliveryErr);
    return { ok: false, error: "บันทึกการรับของไม่สำเร็จ" };
  }

  // เพิ่ม stock ของ equipment ที่รับ
  for (const it of input.itemsReceived) {
    if (it.equipment_id && it.qty_received > 0) {
      const { data: eq } = await sb
        .from("equipment")
        .select("stock")
        .eq("id", it.equipment_id)
        .maybeSingle();
      const cur = (eq?.stock ?? 0) as number;
      await sb
        .from("equipment")
        .update({ stock: cur + Math.floor(it.qty_received) })
        .eq("id", it.equipment_id);
    }
  }

  // Update PO status + received_date
  const newStatus: PoStatus = input.overallCondition === "ปกติ" ? "รับของแล้ว" : "มีปัญหา";
  await sb
    .from("purchase_orders")
    .update({
      status: newStatus,
      received_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  await logActivity(
    poId, user.full_name, user.role, "received",
    `รับของ #${newNo} | สภาพ: ${input.overallCondition}`,
  );

  // Notify admins
  try {
    if (newStatus === "มีปัญหา") {
      await notifyAdmins(
        poId,
        `⚠️ ${po.po_number} มีปัญหา`,
        `${user.full_name} แจ้ง: ${input.issueDescription || "ของไม่ครบ"}`,
      );
    } else {
      await notifyAdmins(
        poId,
        `📦 ${po.po_number} รับของแล้ว`,
        `${user.full_name} รับของเรียบร้อย`,
      );
    }
  } catch { /* ok */ }

  revalidatePath(`/po/${poId}`);
  revalidatePath("/po");
  revalidatePath("/po/pending-receipt");
  revalidatePath("/dashboard");
  return { ok: true, poId, poNumber: po.po_number };
}
