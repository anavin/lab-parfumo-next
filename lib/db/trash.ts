/**
 * Trash queries — รวม PO + Supplier ที่ deleted_at IS NOT NULL
 * รองรับ offset+limit pagination + total count
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

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

export const getTrashedPos = cache(async (
  { page = 0, pageSize = DEFAULT_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<Paginated<TrashedPo>> => {
  const sb = getSupabaseAdmin();
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await sb
    .from("purchase_orders")
    .select(
      "id, po_number, status, items, supplier_name, supplier_id, total, " +
        "created_by_name, created_at, deleted_at, deleted_by_name",
      { count: "exact" },
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .range(from, to);
  const rows = (data ?? []) as unknown as TrashedPo[];
  const total = count ?? rows.length;
  return {
    rows,
    total,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < total,
  };
});

export const getTrashedSuppliers = cache(async (
  { page = 0, pageSize = DEFAULT_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<Paginated<TrashedSupplier>> => {
  const sb = getSupabaseAdmin();
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await sb
    .from("suppliers" as never)
    .select(
      "id, name, code, tax_id, category, contact_person, phone, email, address, " +
        "bank_name, bank_account, payment_terms, notes, is_active, " +
        "created_at, updated_at, created_by_name, updated_by_name, " +
        "deleted_at, deleted_by_name",
      { count: "exact" },
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .range(from, to);
  const rows = (data ?? []) as unknown as TrashedSupplier[];
  const total = count ?? rows.length;
  return {
    rows,
    total,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < total,
  };
});
