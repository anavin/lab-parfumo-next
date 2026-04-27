import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEquipmentList, getCategories } from "@/lib/db/equipment";
import { PoCreateClient } from "./_components/po-create-client";

export const metadata: Metadata = {
  title: "สร้างใบ PO ใหม่ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function PoCreatePage() {
  const [equipment, categories] = await Promise.all([
    getEquipmentList({ activeOnly: true }),
    getCategories(),
  ]);

  return (
    <div className="space-y-5">
      <Link
        href="/po"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> ใบ PO
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">สร้างใบสั่งซื้อใหม่</h1>
        <p className="text-sm text-slate-500">
          เลือกสินค้าจาก catalog หรือพิมพ์ชื่อเอง
        </p>
      </div>

      <PoCreateClient
        equipment={equipment}
        categories={categories}
      />
    </div>
  );
}
