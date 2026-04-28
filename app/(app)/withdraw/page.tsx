import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { getEquipmentList, getCategories } from "@/lib/db/equipment";
import { getWithdrawals } from "@/lib/db/withdraw";
import { WithdrawClient } from "./_components/withdraw-client";

export const metadata: Metadata = {
  title: "เบิกของ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

interface SearchParams {
  tab?: string;
}

export default async function WithdrawPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : "form";

  const [equipment, categories, withdrawals] = await Promise.all([
    getEquipmentList({ activeOnly: true }),
    getCategories(),
    getWithdrawals({
      userId: user.role === "admin" ? undefined : user.id,
      limit: 200,
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">เบิกของ</h1>
        <p className="text-sm text-slate-500">
          บันทึกการใช้สินค้าจากสต็อก + ดูประวัติ
        </p>
      </div>

      <WithdrawClient
        initialTab={tab}
        equipment={equipment}
        categories={categories}
        withdrawals={withdrawals}
        currentUserId={user.id}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
