import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Copy, Plus } from "lucide-react";
import {
  getEquipmentList, getCategories, getLowStockEquipment,
} from "@/lib/db/equipment";
import { getPoById } from "@/lib/db/po";
import { getLookups } from "@/lib/db/lookups";
import type { PoItem } from "@/lib/types/db";
import { PoCreateClient } from "./_components/po-create-client";

export const metadata: Metadata = {
  title: "สร้างใบ PO ใหม่ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

interface SearchParams {
  clone?: string;
  from?: string;          // "low-stock" → prefill low-stock items
}

export default async function PoCreatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cloneFromId = sp.clone;
  const fromLowStock = sp.from === "low-stock";

  // Pre-fetch equipment, categories, units, and (optionally) source PO for cloning
  const [equipment, categories, sourcePo, units, lowStock] = await Promise.all([
    getEquipmentList({ activeOnly: true }),
    getCategories(),
    cloneFromId ? getPoById(cloneFromId) : Promise.resolve(null),
    getLookups("equipment_unit"),
    fromLowStock ? getLowStockEquipment() : Promise.resolve([]),
  ]);

  // Build initial items + notes
  let initialItems: PoItem[] = [];
  let initialNotes = "";
  let clonedFromPoNumber: string | null = null;
  let lowStockBanner: string | null = null;

  if (sourcePo) {
    // === Clone PO ===
    initialItems = (sourcePo.items ?? []).map((it) => ({
      equipment_id: it.equipment_id,
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      notes: it.notes,
      image_urls: it.image_urls,
    }));
    initialNotes = `[คัดลอกจาก ${sourcePo.po_number}] ${sourcePo.notes ?? ""}`.trim();
    clonedFromPoNumber = sourcePo.po_number;
  } else if (fromLowStock && lowStock.length > 0) {
    // === Low stock — prefill ===
    initialItems = lowStock.map((eq) => ({
      equipment_id: eq.id,
      name: eq.name,
      qty: Math.max(((eq.reorder_level ?? 10) - (eq.stock ?? 0)), 1),
      unit: eq.unit ?? "ชิ้น",
      notes: "",
      image_urls: [],
    }));
    initialNotes = `เติม stock — ${lowStock.length} รายการที่ต่ำกว่า reorder level`;
    lowStockBanner = `${lowStock.length} รายการ`;
  }

  return (
    <div className="space-y-5">
      <Link
        href="/po"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> ใบ PO
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {clonedFromPoNumber ? "คัดลอกใบสั่งซื้อ" : "สร้างใบสั่งซื้อใหม่"}
        </h1>
        <p className="text-sm text-slate-500">
          {clonedFromPoNumber
            ? "ปรับแก้รายการก่อนบันทึก — ไม่กระทบใบเดิม"
            : "เลือกสินค้าจาก catalog หรือพิมพ์ชื่อเอง"}
        </p>
      </div>

      {/* Clone source banner */}
      {clonedFromPoNumber && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex-shrink-0 size-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Copy className="size-4" strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-900">
              กำลังคัดลอกจาก {clonedFromPoNumber}
            </div>
            <div className="text-xs text-amber-800 mt-0.5">
              รายการ {initialItems.length} รายการ ถูก prefill ให้แล้ว —
              แก้ไขจำนวน / ลบ / เพิ่มได้ ก่อนกด &quot;บันทึกใบ PO&quot;
            </div>
          </div>
          <Link
            href="/po/new"
            className="text-xs font-semibold text-amber-700 hover:underline flex-shrink-0"
          >
            เริ่มใหม่
          </Link>
        </div>
      )}

      {/* Low-stock prefill banner */}
      {lowStockBanner && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex-shrink-0 size-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
            <Plus className="size-4" strokeWidth={2.25} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-red-900">
              ⚠️ Auto-fill จาก Stock ใกล้หมด — {lowStockBanner}
            </div>
            <div className="text-xs text-red-800 mt-0.5">
              ระบบเติมจำนวน = (reorder level − stock ปัจจุบัน) ให้แล้ว —
              แก้ไข / ลบ / เพิ่มได้ ก่อนบันทึก
            </div>
          </div>
          <Link
            href="/po/new"
            className="text-xs font-semibold text-red-700 hover:underline flex-shrink-0"
          >
            เริ่มใหม่
          </Link>
        </div>
      )}

      <PoCreateClient
        equipment={equipment}
        categories={categories}
        units={units}
        initialItems={initialItems}
        initialNotes={initialNotes}
      />
    </div>
  );
}
