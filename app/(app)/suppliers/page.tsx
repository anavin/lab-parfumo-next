import type { Metadata } from "next";
import { requirePrivileged } from "@/lib/auth/require-user";
import { getSuppliersWithStats } from "@/lib/db/suppliers";
import { SuppliersClient } from "./_components/suppliers-client";

export const metadata: Metadata = {
  title: "Supplier — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const me = await requirePrivileged();
  const suppliers = await getSuppliersWithStats();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการ Supplier</h1>
        <p className="text-sm text-slate-500">
          รายชื่อผู้ผลิต/ผู้ขาย — ใช้ตอนสั่งซื้อ + ดูประวัติ + ยอดสะสม
        </p>
      </div>
      <SuppliersClient suppliers={suppliers} myRole={me.role} />
    </div>
  );
}
