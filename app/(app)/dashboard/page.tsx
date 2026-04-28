import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, Clock, Plus, FileText, Package,
  TrendingUp, TrendingDown, Trophy, AlertCircle, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPos, computeStats, pickActionItems,
  buildMonthlyTrend, topSuppliers,
} from "@/lib/db/po";
import { TrendChart, SuppliersChart } from "./_components/lazy-charts";
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
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const pos = await getPos({ userId: user.id, role: user.role });

  // === Empty state ===
  if (!pos.length) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <div className="text-6xl mb-4">{isAdmin ? "📦" : "📝"}</div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {isAdmin ? "ยินดีต้อนรับสู่ Lab Parfumo PO Pro!" : "ยินดีต้อนรับ!"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {isAdmin
                ? "เริ่มต้นใช้งานง่ายๆ — เพิ่มอุปกรณ์ในระบบก่อน แล้วทีมจะสร้าง PO ได้"
                : "ยังไม่มี PO — กดปุ่มด้านล่างเพื่อสร้างใบแรก"}
            </p>
            <Link href={isAdmin ? "/equipment" : "/po/new"}>
              <Button size="lg">
                <Plus className="size-4" />
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

  return (
    <div className="space-y-7">
      <PageHeader />

      {/* Alerts */}
      <div className="space-y-2.5">
        {stats.overdueCount > 0 && (
          <Alert tone="danger">
            <AlertDescription>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span>
                  <strong>เลยกำหนดรับของ {stats.overdueCount} ใบ</strong>
                </span>
                <Link
                  href="/po/pending-receipt"
                  className="font-semibold underline-offset-2 hover:underline inline-flex items-center gap-1"
                >
                  ดูรายการ <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {stats.upcomingCount > 0 && (
          <Alert tone="warning">
            <AlertDescription>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span>
                  <strong>ใกล้ครบกำหนด {stats.upcomingCount} ใบ</strong>{" "}
                  <span className="opacity-80">(ภายใน 3 วัน)</span>
                </span>
                <Link
                  href="/po/pending-receipt"
                  className="font-semibold underline-offset-2 hover:underline inline-flex items-center gap-1"
                >
                  ดูรายการ <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* KPI Hero (admin) */}
      {isAdmin && <KpiHero stats={stats} />}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2.5">
        <Link href="/po/new">
          <Button>
            <Plus className="size-4" />
            สร้างใบ PO ใหม่
          </Button>
        </Link>
        <Link href="/po">
          <Button variant="outline">
            <FileText className="size-4" />
            ดู PO ทั้งหมด
          </Button>
        </Link>
        {isAdmin && (
          <Link href="/equipment">
            <Button variant="outline">
              <Package className="size-4" />
              จัดการ Catalog
            </Button>
          </Link>
        )}
      </div>

      {/* Status grid (clickable filters) */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.15em] font-bold text-muted-foreground mb-3">
          ภาพรวมสถานะ
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {STATUS_ORDER.map((status) => {
            const count = stats.byStatus[status] ?? 0;
            const warn = status === "รอจัดซื้อดำเนินการ" && count > 0;
            const short = status.length > 10 ? `${status.slice(0, 9)}…` : status;
            return (
              <Link
                key={status}
                href={`/po?status=${encodeURIComponent(status)}`}
                className={`group relative bg-card border border-border rounded-xl p-3.5 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all ${
                  warn ? "ring-1 ring-warning/30" : ""
                }`}
              >
                {warn && (
                  <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-warning ring-4 ring-warning/20" />
                )}
                <div className="text-base mb-1">{STATUS_EMOJI[status]}</div>
                <div className="text-xl font-bold text-foreground leading-none tabular-nums">
                  {count}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-1.5 truncate">
                  {short}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Action items + Insights */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* LEFT: Action items */}
        <Card className={isAdmin ? "lg:col-span-3" : "lg:col-span-5"}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-foreground">
                ที่ต้องดำเนินการ
              </div>
              {actionItems.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {actionItems.length}
                </Badge>
              )}
            </div>
            {actionItems.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <div className="text-2xl mb-2">🎉</div>
                ไม่มีงานค้าง — ทำดีมาก!
              </div>
            ) : (
              <div className="divide-y divide-border/50 -my-1">
                {actionItems.map((po) => (
                  <ActionRow key={po.id} po={po} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Insight cards (admin only) */}
        {isAdmin && (
          <div className="lg:col-span-2 space-y-3">
            <InsightCards stats={stats} pos={pos} />
          </div>
        )}
      </div>

      {/* Charts (admin only) */}
      {isAdmin && (
        <div className="grid lg:grid-cols-5 gap-5">
          <Card className="lg:col-span-3">
            <CardContent className="p-5">
              <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-muted-foreground mb-4">
                ยอดสั่งซื้อ 6 เดือนล่าสุด
              </div>
              <TrendChart data={trendData} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-muted-foreground mb-4">
                Top 5 Suppliers
              </div>
              <SuppliersChart data={supplierData} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PageHeader() {
  const today = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          ภาพรวมระบบ
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
      </div>
    </div>
  );
}

// ==================================================================
// Sub-components
// ==================================================================

function KpiHero({ stats }: { stats: ReturnType<typeof computeStats> }) {
  const trendUp = stats.spendGrowth >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-primary to-brand-950 text-white p-7 sm:p-8 shadow-xl">
      {/* Decorative orbs */}
      <div className="absolute -top-24 -right-24 size-64 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 size-72 rounded-full bg-brand-500/10 blur-3xl" />
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1.5">
            ใช้จ่ายเดือนนี้
          </div>
          <div className="text-3xl sm:text-4xl font-bold tabular-nums">
            {fmtMoney(stats.thisMonthSpend)}
          </div>
          {stats.lastMonthSpend > 0 && (
            <span
              className={`mt-2 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                trendUp
                  ? "bg-emerald-400/20 text-emerald-200"
                  : "bg-red-400/20 text-red-200"
              }`}
            >
              {trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(stats.spendGrowth).toFixed(1)}% จากเดือนก่อน
            </span>
          )}
        </div>
        <div className="sm:border-l sm:border-white/10 sm:pl-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1.5">
            PO ทั้งหมด
          </div>
          <div className="text-3xl font-bold tabular-nums">{stats.total}</div>
          <div className="text-xs text-white/60 mt-1.5">
            +{stats.newThisWeek} ใบใหม่สัปดาห์นี้
          </div>
        </div>
        <div className="sm:border-l sm:border-white/10 sm:pl-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold mb-1.5">
            รอดำเนินการ
          </div>
          <div className="text-3xl font-bold tabular-nums">{stats.pending}</div>
          {stats.staleCount > 0 && (
            <div className="text-xs text-amber-200 mt-1.5">
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
      className="flex items-center gap-3 py-3 px-2 -mx-2 hover:bg-accent/50 rounded-lg transition-colors"
    >
      <div
        className={`size-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isProblem
            ? "bg-destructive/10 text-destructive"
            : "bg-warning/10 text-warning-foreground/100 [color:hsl(var(--warning))]"
        }`}
      >
        {isProblem ? <AlertCircle className="size-5" /> : <Clock className="size-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-bold text-sm text-foreground font-mono">
            {po.po_number}
          </div>
          <StatusPill status={po.status} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {po.created_by_name ?? "—"} • {(po.items?.length ?? 0)} รายการ
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex-shrink-0">
        {daysAgo(po.created_at)}
      </div>
      <ArrowRight className="size-4 text-muted-foreground/40 flex-shrink-0" />
    </Link>
  );
}

function InsightCards({
  stats, pos,
}: {
  stats: ReturnType<typeof computeStats>;
  pos: PurchaseOrder[];
}) {
  const sup = topSuppliers(pos, 1)[0];
  const totalSpend = pos
    .filter((p) => p.supplier_name && p.total)
    .reduce((s, p) => s + (p.total ?? 0), 0);
  const supPct = sup && totalSpend ? (sup.spend / totalSpend) * 100 : 0;

  return (
    <>
      {sup && (
        <Card className="bg-gradient-to-br from-amber-50/50 to-amber-100/30 border-amber-200/50">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-amber-800 mb-2 flex items-center gap-1.5">
              <Trophy className="size-3.5" /> Top Supplier
            </div>
            <div className="text-base font-bold text-foreground truncate" title={sup.name}>
              {sup.name}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
              {fmtMoney(sup.spend)} • {supPct.toFixed(0)}% ของยอดรวม
            </div>
          </CardContent>
        </Card>
      )}

      {stats.longestPendingDays > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="size-3.5" /> PO ค้างนานสุด
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${
                stats.longestPendingDays > 14
                  ? "text-destructive"
                  : stats.longestPendingDays > 7
                    ? "[color:hsl(var(--warning))]"
                    : "text-primary"
              }`}
            >
              {stats.longestPendingDays} <span className="text-sm font-medium opacity-70">วัน</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">รอดำเนินการ</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="size-3.5" /> เทียบเดือนก่อน
          </div>
          <div className="text-base font-bold text-foreground tabular-nums">
            {fmtMoney(stats.thisMonthSpend - stats.lastMonthSpend)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {stats.spendGrowth >= 0 ? "เพิ่มขึ้น" : "ลดลง"}{" "}
            {Math.abs(stats.spendGrowth).toFixed(1)}%
          </div>
        </CardContent>
      </Card>
    </>
  );
}
