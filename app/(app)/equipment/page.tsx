import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-user";
import {
  getEquipmentList, getCategories, getPendingEquipment,
} from "@/lib/db/equipment";
import { EquipmentClient } from "./_components/equipment-client";

export const metadata: Metadata = {
  title: "Catalog — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  await requireAdmin();

  const [equipment, categories, pending] = await Promise.all([
    getEquipmentList({ activeOnly: false }),
    getCategories(),
    getPendingEquipment(),
  ]);

  // active + approved (ไม่รวม pending/rejected) สำหรับ list หลัก
  const main = equipment.filter((e) =>
    e.is_active && e.approval_status !== "pending" && e.approval_status !== "rejected",
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการ Catalog</h1>
        <p className="text-sm text-slate-500">
          เพิ่ม / แก้ไข / อนุมัติ สินค้าทั้งหมด
        </p>
      </div>

      <EquipmentClient
        equipment={main}
        categories={categories}
        pending={pending}
      />
    </div>
  );
}
