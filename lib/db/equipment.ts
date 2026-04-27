/**
 * Equipment + categories queries — server-side
 *
 * ⚡ ใช้ React.cache() เพื่อ dedupe ใน same request
 *    + unstable_cache สำหรับ data ที่ไม่ค่อยเปลี่ยน (categories)
 */
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Equipment } from "@/lib/types/db";

export const getEquipmentList = cache(async (opts: {
  activeOnly?: boolean;
  includePending?: boolean;
} = {}): Promise<Equipment[]> => {
  const sb = getSupabaseAdmin();
  let q = sb.from("equipment").select("*");
  if (opts.activeOnly !== false) {
    q = q.eq("is_active", true);
  }
  // Approval filter: เฉพาะ approved (หรือ null = legacy ก่อน migration)
  if (opts.includePending) {
    q = q.or(
      "approval_status.eq.approved,approval_status.eq.pending,approval_status.is.null",
    );
  } else {
    q = q.or("approval_status.eq.approved,approval_status.is.null");
  }
  const { data } = await q.order("created_at", { ascending: false });
  return (data ?? []) as Equipment[];
});

export const getEquipmentById = cache(
  async (id: string): Promise<Equipment | null> => {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("equipment")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as Equipment) ?? null;
  },
);

/**
 * Categories — เปลี่ยนน้อยมาก → cache 5 นาทีบน server
 * (revalidate ผ่าน revalidateTag ใน mutator)
 */
export const getCategories = unstable_cache(
  async (): Promise<string[]> => {
    const sb = getSupabaseAdmin();
    try {
      const { data, error } = await sb
        .from("equipment_categories")
        .select("name")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!error && data) return data.map((r: { name: string }) => r.name);
    } catch {
      // fallthrough
    }
    const { data } = await sb
      .from("equipment_categories")
      .select("name")
      .order("created_at", { ascending: true });
    return (data ?? []).map((r: { name: string }) => r.name);
  },
  ["categories-list"],
  { revalidate: 300, tags: ["categories"] },
);

export const getPendingEquipment = cache(
  async (): Promise<Equipment[]> => {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("equipment")
      .select("*")
      .eq("approval_status", "pending")
      .order("suggested_at", { ascending: false });
    return (data ?? []) as Equipment[];
  },
);

/** Suggest pending equipment from PO custom item (matches Streamlit behavior) */
export async function suggestEquipmentFromPo(opts: {
  name: string;
  unit?: string;
  notes?: string;
  imageUrls?: string[];
  suggestedBy: string;
  suggestedByName: string;
  suggestedFromPo: string;
}): Promise<Equipment | null> {
  const sb = getSupabaseAdmin();
  const tempSku = `PENDING-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}`;
  const { data } = await sb
    .from("equipment")
    .insert({
      sku: tempSku,
      name: opts.name,
      category: "(รออนุมัติ)",
      unit: opts.unit ?? "ชิ้น",
      description: opts.notes ?? "",
      last_cost: 0,
      stock: 0,
      image_url: opts.imageUrls?.[0] ?? null,
      image_urls: opts.imageUrls ?? [],
      is_active: true,
      approval_status: "pending",
      suggested_by: opts.suggestedBy,
      suggested_by_name: opts.suggestedByName,
      suggested_at: new Date().toISOString(),
      suggested_from_po: opts.suggestedFromPo,
      suggested_notes: opts.notes ?? "",
    })
    .select()
    .maybeSingle();
  return (data as Equipment) ?? null;
}
