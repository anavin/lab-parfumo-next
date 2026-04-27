import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";
import { getPos } from "@/lib/db/po";
import { ReportsClient } from "./_components/reports-client";

export const metadata: Metadata = {
  title: "รายงาน — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = (await getCurrentUser())!;
  if (user.role !== "admin") redirect("/dashboard");

  const allPos = await getPos({ role: "admin" });

  if (!allPos.length) {
    return (
      <div className="space-y-5">
        <Header />
        <EmptyState
          icon="📊"
          title="ยังไม่มีข้อมูลรายงาน"
          text="เมื่อเริ่มมี PO ในระบบ รายงานนี้จะแสดงสถิติ + กราฟ + Top supplier ให้อัตโนมัติ"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header />
      <ReportsClient pos={allPos} />
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">รายงาน + วิเคราะห์</h1>
      <p className="text-sm text-slate-500">
        ภาพรวมการสั่งซื้อ + Top supplier + Spending trends
      </p>
    </div>
  );
}
