import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { getEquipmentList, getCategories } from "@/lib/db/equipment";
import { getPoById } from "@/lib/db/po";
import type { PoItem } from "@/lib/types/db";
import { PoCreateClient } from "./_components/po-create-client";

export const metadata: Metadata = {
  title: "สร้างใบ PO ใหม่ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

interface SearchParams {
  clone?: string;
}

export default async function PoCreatePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cloneFromId = sp.clone;

  // Pre-fetch equipment, categories, and (optionally) source PO for cloning
  const [equipment, categories, sourcePo] = await Promise.all([
    getEquipmentList({ activeOnly: true }),
    getCategories(),
    cloneFromId ? getPoById(cloneFromId) : Promise.resolve(null),
  ]);

  // Build initial items + notes from source PO (strip prices)
  let initialItems: PoItem[] = [];
  let initialNotes = "";
  let clonedFromPoNumber: string | null = null;

  if (sourcePo) {
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

      <PoCreateClient
        equipment={equipment}
        categories={categories}
        initialItems={initialItems}
        initialNotes={initialNotes}
      />
    </div>
  );
}
