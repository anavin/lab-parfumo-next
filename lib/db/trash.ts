/**
 * Trash queries — รวม PO + Supplier ที่ deleted_at IS NOT NULL
 */
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PurchaseOrder, Supplier } from "@/lib/types/db";

export interface TrashedPo extends PurchaseOrder {
  deleted_at: string;
  deleted_by_name: string | null;
}

export interface TrashedSupplier extends Supplier {
  deleted_at: string;
  deleted_by_name: string | null;
}

export const getTrashedPos = cache(async (): Promise<TrashedPo[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("purchase_orders")
    .select(
      "id, po_number, status, items, supplier_name, supplier_id, total, " +
        "created_by_name, created_at, deleted_at, deleted_by_name",
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as TrashedPo[]);
});

export const getTrashedSuppliers = cache(async (): Promise<TrashedSupplier[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("suppliers" as never)
    .select(
      "id, name, code, tax_id, category, contact_person, phone, email, address, " +
        "bank_name, bank_account, payment_terms, notes, is_active, " +
        "created_at, updated_at, created_by_name, updated_by_name, " +
        "deleted_at, deleted_by_name",
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as TrashedSupplier[]);
});
