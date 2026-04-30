import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/require-user";
import {
  getPoActivities,
  getLoginAttempts,
  getDistinctActions,
} from "@/lib/db/audit";
import { AuditClient } from "./_components/audit-client";

export const metadata: Metadata = {
  title: "Audit Log — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

interface SearchParams {
  tab?: string;
  from?: string;
  to?: string;
  user?: string;
  action?: string;
  status?: string;
  page?: string;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab === "login" ? "login" : "po";
  const page = Math.max(0, Number(sp.page ?? 0));

  const filters = {
    from: sp.from || undefined,
    to: sp.to || undefined,
    user: sp.user || undefined,
    action: sp.action || undefined,
    status:
      sp.status === "success" || sp.status === "failed"
        ? (sp.status as "success" | "failed")
        : "all" as const,
  };

  const [actions, poData, loginData] = await Promise.all([
    getDistinctActions(),
    tab === "po" ? getPoActivities(filters, page) : Promise.resolve({ rows: [], total: 0, hasMore: false }),
    tab === "login" ? getLoginAttempts(filters, page) : Promise.resolve({ rows: [], total: 0, hasMore: false }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">
          ประวัติการใช้งานระบบ — PO activities + Login attempts
        </p>
      </div>
      <AuditClient
        tab={tab}
        page={page}
        filters={filters}
        actions={actions}
        poData={poData}
        loginData={loginData}
      />
    </div>
  );
}
