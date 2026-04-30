import type { Metadata } from "next";
import { requirePrivileged } from "@/lib/auth/require-user";
import { getLots, getLotStatusCounts } from "@/lib/db/lots";
import type { LotStatus } from "@/lib/types/db";
import { LotsClient } from "./_components/lots-client";

export const metadata: Metadata = {
  title: "Lot/Batch — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  q?: string;
  expiring?: string;
}

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePrivileged();
  const sp = await searchParams;

  const status: LotStatus | "all" =
    sp.status === "depleted" || sp.status === "expired" ||
    sp.status === "discarded" || sp.status === "active"
      ? sp.status
      : "all";
  const expiringDays = sp.expiring === "30" ? 30 : sp.expiring === "7" ? 7 : 0;

  const [lots, counts] = await Promise.all([
    getLots({
      status: expiringDays > 0 ? "active" : status,
      search: sp.q,
      expiringWithinDays: expiringDays || undefined,
    }),
    getLotStatusCounts(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lot/Batch Tracking</h1>
        <p className="text-sm text-slate-500">
          ทุกการรับของจะถูกบันทึกเป็น lot — ติดตามที่มา + วันหมดอายุได้
        </p>
      </div>
      <LotsClient
        lots={lots}
        counts={counts}
        currentStatus={status}
        currentSearch={sp.q ?? ""}
        currentExpiring={expiringDays}
      />
    </div>
  );
}
