import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { getMyPayments, getPayerAging } from "@/lib/db/po-payments";
import { getActiveUsers } from "@/lib/db/users";
import { MyPaymentsClient } from "./_components/my-payments-client";

export const metadata: Metadata = {
  title: "เบิกคืนบัตรเครดิต — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

interface Sp {
  user?: string;         // admin only — view someone else's
  reimbursed?: string;   // "all" | "no" (default) | "yes"
  from?: string;
  to?: string;
}

export default async function MyPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Sp>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "admin" || user.role === "supervisor";

  // Determine target user (admin can view anyone's; others = self)
  const targetUserId = isAdmin && sp.user ? sp.user : user.id;

  const reimbursedFilter: boolean | "all" =
    sp.reimbursed === "yes" ? true
      : sp.reimbursed === "all" ? "all"
        : false;

  const [payments, allUsers, aging] = await Promise.all([
    getMyPayments({
      userId: targetUserId,
      reimbursed: reimbursedFilter,
      from: sp.from,
      to: sp.to,
    }),
    isAdmin ? getActiveUsers() : Promise.resolve([]),
    isAdmin ? getPayerAging() : Promise.resolve([]),
  ]);

  const targetUser = allUsers.find((u) => u.id === targetUserId) ?? user;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            เบิกคืนบัตรเครดิต
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin && sp.user
              ? `กำลังดู payments ของ ${targetUser?.full_name ?? "-"}`
              : "การรูดบัตรของคุณ · รวบสิ้นรอบ · admin mark เมื่อโอนคืน"}
          </p>
        </div>
      </div>

      <MyPaymentsClient
        payments={payments}
        isAdmin={isAdmin}
        targetUserId={targetUserId}
        targetUserName={targetUser?.full_name ?? user.full_name}
        currentReimbursedFilter={sp.reimbursed ?? "no"}
        currentFrom={sp.from ?? ""}
        currentTo={sp.to ?? ""}
        allUsers={isAdmin ? allUsers.map((u) => ({ id: u.id, full_name: u.full_name })) : []}
        aging={aging}
      />
    </div>
  );
}
