import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, Clock, Plus, FileText, Package,
  TrendingUp, TrendingDown, Trophy, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getPos, computeStats, pickActionItems,
  buildMonthlyTrend, topSuppliers,
} from "@/lib/db/po";
import { TrendChart } from "./_components/trend-chart";
import { SuppliersChart } from "./_components/suppliers-chart";
import type { PoStatus, PurchaseOrder } from "@/lib/types/db";

export const metadata: Metadata = {
  title: "Dashboard — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

const STATUS_ORDER: PoStatus[] = [
  "รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว", "กำลังขนส่ง",
  "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์", "ยกเลิก",
];

const STATUS_EMOJI: Record<PoStatus, string> = {
  "รอจัดซื้อดำเนินการ": "📝",
  "สั่งซื้อแล้ว": "✅",
  "กำลังขนส่ง": "🚚",
  "รับของแล้ว": "📦",
  "มีปัญหา": "⚠️",
  "เสร็จสมบูรณ์": "✓",
  "ยกเลิก": "❌",
};

function fmtMoney(n: number): string {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function daysAgo(iso: string): string {
  try {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
    if (days === 0) return "วันนี้";
    if (days < 7) return `${days} วันที่แล้ว`;
    return `${days} วัน`;
  } catch {
    return "";
  }
}

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const isAdmin = user.role === "admin";
  const pos = await getPos({ userId: user.id, role: user.role });

  // === Empty state ===
  if (!pos.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ภาพรวมระบบ</h1>
          <p className="text-sm text-slate-500">{todayLabel()}</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="text-5xl mb-3">{isAdmin ? "📦" : "📝"}</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              {isAdmin ? "ยินดีต้อนรับสู่ Lab Parfumo PO Pro!" : "ยินดีต้อนรับ!"}
            </h2>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              {isAdmin
                ? "เริ่มต้นใช้งานง่ายๆ — เพิ่มอุปกรณ์ในระบบก่อน แล้วทีมจะสร้าง PO ได้"
                : "ยังไม่มี PO — กดปุ่มด้านล่างเพื่อสร้างใบแรก"}
            </p>
            <Link href={isAdmin ? "/equipment" : "/po/new"}>
              <Button>
                <Plus className="h-4 w-4" />
                {isAdmin ? "เพิ่มอุปกรณ์" : "สร้างใบ PO ใหม่"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = computeStats(pos);
  const actionItems = pickActionItems(pos, isAdmin).slice(0, 5);
  const trendData = isAdmin ? buildMonthlyTrend(pos, 6) : [];
  const supplierData = isAdmin ? topSuppliers(pos, 5) : [];

  // === Render ===
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ภาพรวมระบบ</h1>
        <p className="text-sm text-slate-500">วันนี้ • {todayLabel()}</p>
      </div>

      {/* Alerts */}
      {stats.overdueCount > 0 && (
        <Alert tone="danger" className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>🚨 เลยกำหนดรับของ {stats.overdueCount} ใบ</strong>
            <Link
              href="/po/pending-receipt"
              className="ml-2 underline hover:no-underline"
            >
              ดูรายการ →
            </Link>
          </div>
        </Alert>
      )}
      {stats.upcomingCount > 0 && (
        <Alert tone="warning" className="flex items-start gap-2">
          <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>⏰ ใกล้ครบกำหนด {stats.upcomingCount} ใบ</strong>{" "}
            <span className="text-amber-700">(ภายใน 3 วัน)</span>
            <Link
              href="/po/pending-receipt"
              className="ml-2 underline hover:no-underline"
            >
              ดูรายการ →
            </Link>
          </div>
        </Alert>
      )}

      {/* KPI Hero (admin) */}
      {isAdmin && <KpiHero stats={stats} />}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/po/new">
          <Button>
            <Plus className="h-4 w-4" />
            สร้างใบ PO ใหม่
          </Button>
        </Link>
        <Link href="/po">
          <Button variant="secondary">
            <FileText className="h-4 w-4" />
            ดู PO ทั้งหมด
          </Button>
        </Link>
        {isAdmin && (
          <Link href="/equipment">
            <Button variant="secondary">
              <Package className="h-4 w-4" />
              จัดการ Catalog
            </Button>
          </Link>
        )}
      </div>

      {/* Status grid (clickable filters) */}
      <section>
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
          📊 ภาพรวมสถานะ
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {STATUS_ORDER.map((status) => {
            const count = stats.byStatus[status] ?? 0;
            const warn = status === "รอจัดซื้อดำเนินการ" && count > 0;
            const short = status.length > 10 ? `${status.slice(0, 9)}…` : status;
            return (
              <Link
                key={status}
                href={`/po?status=${encodeURIComponent(status)}`}
                className={`relative bg-white border border-slate-200 rounded-xl p-3 hover:border-brand-600 hover:shadow-sm hover:-translate-y-px transition-all ${
                  warn ? "ring-1 ring-amber-200" : ""
                }`}
              >
                {warn && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-600 ring-4 ring-amber-50" />
                )}
                <div className="text-sm mb-1">{STATUS_EMOJI[status]}</div>
                <div className="text-xl font-bold text-slate-900 leading-none">
                  {count}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  {short}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Action items + Insights */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* LEFT: Action items */}
        <div className={isAdmin ? "lg:col-span-3" : "lg:col-span-5"}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-xs uppercase tracking-wider font-bold text-slate-700">
                  ⚡ ที่ต้องดำเนินการ
                </div>
                {actionItems.length > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {actionItems.length}
                  </span>
                )}
              </div>
              {actionItems.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  🎉 ไม่มีงานค้าง — ทำดีมาก!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {actionItems.map((po) => (
                    <ActionRow key={po.id} po={po} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Insight cards (admin only) */}
        {isAdmin && (
          <div className="lg:col-span-2 space-y-3">
            <InsightCards stats={stats} pos={pos} />
          </div>
        )}
      </div>

      {/* Charts (admin only) */}
      {isAdmin && (
        <div className="grid lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3">
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
                📈 ยอดสั่งซื้อ 6 เดือนล่าสุด
              </div>
              <TrendChart data={trendData} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
                🏆 Top 5 Suppliers
              </div>
              <SuppliersChart data={supplierData} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ==================================================================
// Sub-components
// ==================================================================

function KpiHero({ stats }: { stats: ReturnType<typeof computeStats> }) {
  const trendUp = stats.spendGrowth >= 0;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-900 to-brand-700 text-white p-6 sm:p-8 relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/70 font-semibold mb-1">
            💰 ใช้จ่ายเดือนนี้
          </div>
          <div className="text-3xl font-bold">{fmtMoney(stats.thisMonthSpend)}</div>
          {stats.lastMonthSpend > 0 && (
            <span
              className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                trendUp
                  ? "bg-emerald-400/20 text-emerald-200"
                  : "bg-red-400/20 text-red-200"
              }`}
            >
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(stats.spendGrowth).toFixed(1)}% จากเดือนก่อน
            </span>
          )}
        </div>
        <div className="sm:border-l sm:border-white/15 sm:pl-6">
          <div className="text-xs uppercase tracking-wider text-white/70 font-semibold mb-1">
            PO ทั้งหมด
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-white/60 mt-1">
            +{stats.newThisWeek} ใบใหม่สัปดาห์นี้
          </div>
        </div>
        <div className="sm:border-l sm:border-white/15 sm:pl-6">
          <div className="text-xs uppercase tracking-wider text-white/70 font-semibold mb-1">
            รอดำเนินการ
          </div>
          <div className="text-2xl font-bold">{stats.pending}</div>
          {stats.staleCount > 0 && (
            <div className="text-xs text-amber-200 mt-1">
              ⚠️ {stats.staleCount} ใบค้างเกิน 3 วัน
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ po }: { po: PurchaseOrder }) {
  const isProblem = po.status === "มีปัญหา";
  return (
    <Link
      href={`/po/${po.id}`}
      className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
    >
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isProblem ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
        }`}
      >
        {isProblem ? <AlertCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-semibold text-sm text-slate-900">{po.po_number}</div>
          <StatusPill status={po.status} />
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {po.created_by_name ?? "—"} • {(po.items?.length ?? 0)} รายการ
        </div>
      </div>
      <div className="text-xs text-slate-400 flex-shrink-0">{daysAgo(po.created_at)}</div>
    </Link>
  );
}

function InsightCards({
  stats, pos,
}: {
  stats: ReturnType<typeof computeStats>;
  pos: PurchaseOrder[];
}) {
  // Top supplier
  const sup = topSuppliers(pos, 1)[0];
  const totalSpend = pos
    .filter((p) => p.supplier_name && p.total)
    .reduce((s, p) => s + (p.total ?? 0), 0);
  const supPct = sup && totalSpend ? (sup.spend / totalSpend) * 100 : 0;

  return (
    <>
      {sup && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Top Supplier
          </div>
          <div className="text-base font-bold text-slate-900 truncate" title={sup.name}>
            {sup.name}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {fmtMoney(sup.spend)} • {supPct.toFixed(0)}% ของยอดรวม
          </div>
        </div>
      )}

      {stats.longestPendingDays > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> PO ค้างนานสุด
          </div>
          <div
            className={`text-2xl font-bold ${
              stats.longestPendingDays > 14
                ? "text-red-600"
                : stats.longestPendingDays > 7
                  ? "text-amber-600"
                  : "text-brand-700"
            }`}
          >
            {stats.longestPendingDays} วัน
          </div>
          <div className="text-xs text-slate-500 mt-0.5">รอดำเนินการ</div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1.5">
          📈 เทียบเดือนก่อน
        </div>
        <div className="text-base font-bold text-slate-900">
          {fmtMoney(stats.thisMonthSpend - stats.lastMonthSpend)}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {stats.spendGrowth >= 0 ? "เพิ่มขึ้น" : "ลดลง"}{" "}
          {Math.abs(stats.spendGrowth).toFixed(1)}%
        </div>
      </div>
    </>
  );
}

function todayLabel(): string {
  return new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
