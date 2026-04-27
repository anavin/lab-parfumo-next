import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getEquipmentList, getCategories, getPendingEquipment,
} from "@/lib/db/equipment";
import { EquipmentClient } from "./_components/equipment-client";

export const metadata: Metadata = {
  title: "Catalog — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const user = (await getCurrentUser())!;
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

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
