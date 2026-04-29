import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, Clock, Plus, FileText, Package,
  TrendingUp, TrendingDown, Trophy, AlertCircle, ArrowRight,
  ClipboardEdit, ShoppingBag, Truck, PackageCheck,
  CheckCircle2, XCircle, type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPos, getPosPendingReceipt, computeStats, pickActionItems,
  buildMonthlyTrend, topSuppliers,
} from "@/lib/db/po";
import { TrendChart, SuppliersChart } from "./_components/lazy-charts";
import { StaffDashboard } from "./_components/staff-dashboard";
import type { PoStatus, PurchaseOrder } from "@/lib/types/db";

export const metadata: Metadata = {
  title: "Dashboard — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

const STATUS_ORDER: PoStatus[] = [
  "รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว", "กำลังขนส่ง",
  "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์", "ยกเลิก",
];

interface StatusVisual {
  icon: LucideIcon;
  label: string;
  /** Tailwind classes for the icon background + text */
  tone: string;
  ring: string;
}

const STATUS_VISUAL: Record<PoStatus, StatusVisual> = {
  "รอจัดซื้อดำเนินการ": {
    icon: ClipboardEdit,
    label: "รอจัดซื้อ",
    tone: "bg-amber-100 text-amber-700",
    ring: "ring-amber-200/60",
  },
  "สั่งซื้อแล้ว": {
    icon: ShoppingBag,
    label: "สั่งซื้อแล้ว",
    tone: "bg-blue-100 text-blue-700",
    ring: "ring-blue-200/60",
  },
  "กำลังขนส่ง": {
    icon: Truck,
    label: "กำลังขนส่ง",
    tone: "bg-indigo-100 text-indigo-700",
    ring: "ring-indigo-200/60",
  },
  "รับของแล้ว": {
    icon: PackageCheck,
    label: "รับของแล้ว",
    tone: "bg-cyan-100 text-cyan-700",
    ring: "ring-cyan-200/60",
  },
  "มีปัญหา": {
    icon: AlertTriangle,
    label: "มีปัญหา",
    tone: "bg-red-100 text-red-600",
    ring: "ring-red-200/60",
  },
  "เสร็จสมบูรณ์": {
    icon: CheckCircle2,
    label: "เสร็จสมบูรณ์",
    tone: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-200/60",
  },
  "ยกเลิก": {
    icon: XCircle,
    label: "ยกเลิก",
    tone: "bg-slate-100 text-slate-500",
    ring: "ring-slate-200/60",
  },
};

function fmtMoney(n: number): string {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin" || user.role === "supervisor";

  // === Staff (non-admin) — render personalized dashboard ===
  if (!isAdmin) {
    const [myPos, pendingReceipt] = await Promise.all([
      getPos({ userId: user.id, role: user.role }),
      getPosPendingReceipt(),
    ]);
    // ทุก user รับของได้ — แต่กดได้เฉพาะ "กำลังขนส่ง" (ตาม workflow gate)
    const readyToReceive = pendingReceipt.filter(
      (p) => p.status === "กำลังขนส่ง",
    );
    return (
      <StaffDashboard
        user={user}
        myPos={myPos}
        readyToReceive={readyToReceive}
      />
    );
  }

  // === Admin path ===
  const pos = await getPos({ userId: user.id, role: user.role });

  // === Empty state ===
  if (!pos.length) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              ยินดีต้อนรับสู่ Lab Parfumo PO Pro!
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              เริ่มต้นใช้งานง่ายๆ — เพิ่มอุปกรณ์ในระบบก่อน แล้วทีมจะสร้าง PO ได้
            </p>
            <Link href="/equipment">
              <Button size="lg">
                <Plus className="size-4" /> เพิ่มอุปกรณ์
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
        <h2 className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-3">
          ภาพรวมสถานะ
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {STATUS_ORDER.map((status) => {
            const visual = STATUS_VISUAL[status];
            const Icon = visual.icon;
            const count = stats.byStatus[status] ?? 0;
            const warn = status === "รอจัดซื้อดำเนินการ" && count > 0;
            const isEmpty = count === 0;
            return (
              <Link
                key={status}
                href={`/po?status=${encodeURIComponent(status)}`}
                className={`group relative bg-card border border-border/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${
                  warn ? `ring-1 ${visual.ring}` : ""
                } ${isEmpty ? "opacity-70 hover:opacity-100" : ""}`}
              >
                {/* Warning pulse dot */}
                {warn && (
                  <span className="absolute top-3 right-3 size-2 rounded-full bg-amber-500 ring-4 ring-amber-200/60 animate-pulse" />
                )}

                {/* Icon badge */}
                <div className={`size-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 ${visual.tone} ring-1 ${visual.ring}`}>
                  <Icon className="size-5" strokeWidth={2.25} />
                </div>

                {/* Count */}
                <div className="text-2xl font-extrabold text-foreground leading-none tabular-nums">
                  {count}
                </div>

                {/* Label — full text, no truncation */}
                <div className="text-xs text-muted-foreground font-semibold mt-2 leading-tight">
                  {visual.label}
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
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Clock className="size-4" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">
                    ที่ต้องดำเนินการ
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {actionItems.length > 0
                      ? `${actionItems.length} ใบรอจัดการ`
                      : "ไม่มีงานค้าง"}
                  </div>
                </div>
              </div>
              {actionItems.length > 0 && (
                <Link
                  href="/po?status=รอจัดซื้อดำเนินการ"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  ดูทั้งหมด
                  <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
            {actionItems.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="size-6" strokeWidth={2.25} />
                </div>
                <div className="font-semibold text-foreground">ไม่มีงานค้าง</div>
                <div className="text-xs mt-0.5">ทำดีมาก! ทุกอย่างเรียบร้อย 🎉</div>
              </div>
            ) : (
              <div className="space-y-0.5">
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
              <div className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-4">
                ยอดสั่งซื้อ 6 เดือนล่าสุด
              </div>
              <TrendChart data={trendData} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground mb-4">
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
  // Build "this month" date range for spend filter
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const spendHref = `/po?from=${monthStart}&to=${monthEnd}`;
  const allHref = "/po";
  const pendingHref = "/po?status=" + encodeURIComponent("รอจัดซื้อดำเนินการ");
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-primary to-brand-950 text-white p-8 sm:p-10 lg:p-12 shadow-2xl ring-1 ring-white/10">
      {/* Decorative orbs */}
      <div className="absolute -top-32 -right-32 size-80 rounded-full bg-brand-400/25 blur-3xl animate-pulse" style={{ animationDuration: "5s" }} />
      <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-brand-500/15 blur-3xl animate-pulse" style={{ animationDuration: "7s", animationDelay: "1s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-72 rounded-full bg-cyan-400/10 blur-3xl" />

      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* Top-left highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />

      {/* Shimmer line */}
      <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 text-center">
        {/* Spend this month — clickable */}
        <Link
          href={spendHref}
          className="group relative rounded-2xl px-3 py-3 -mx-3 -my-3 hover:bg-white/5 transition-colors"
          title="ดู PO ของเดือนนี้"
        >
          <ArrowRight className="absolute top-3 right-3 size-4 text-white/0 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
          <div className="text-sm text-white/80 font-bold mb-4 flex items-center justify-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ใช้จ่ายเดือนนี้
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight bg-gradient-to-br from-white via-white to-cyan-100 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)] leading-none">
            {fmtNumber(stats.thisMonthSpend)}
          </div>
          <div className="text-sm font-semibold text-white/70 mt-2">บาท</div>
          {stats.lastMonthSpend > 0 && (
            <div className="flex justify-center mt-3">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm ring-1 ${
                  trendUp
                    ? "bg-emerald-400/20 text-emerald-200 ring-emerald-300/30"
                    : "bg-red-400/20 text-red-200 ring-red-300/30"
                }`}
              >
                {trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {Math.abs(stats.spendGrowth).toFixed(1)}% จากเดือนก่อน
              </span>
            </div>
          )}
        </Link>

        {/* PO total — clickable */}
        <Link
          href={allHref}
          className="group relative rounded-2xl px-3 py-3 -mx-3 -my-3 hover:bg-white/5 transition-colors sm:before:content-[''] sm:before:absolute sm:before:top-4 sm:before:bottom-4 sm:before:left-0 sm:before:w-px sm:before:bg-gradient-to-b sm:before:from-transparent sm:before:via-white/20 sm:before:to-transparent"
          title="ดู PO ทั้งหมด"
        >
          <ArrowRight className="absolute top-3 right-3 size-4 text-white/0 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
          <div className="text-sm text-white/80 font-bold mb-4">
            PO ทั้งหมด
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.1)] leading-none">
            {stats.total}
          </div>
          <div className="text-sm font-semibold text-white/70 mt-2">ใบ</div>
          <div className="text-sm text-white/70 mt-2 font-medium">
            <span className="text-emerald-300 font-bold">+{stats.newThisWeek}</span> ใบใหม่สัปดาห์นี้
          </div>
        </Link>

        {/* Pending — clickable */}
        <Link
          href={pendingHref}
          className="group relative rounded-2xl px-3 py-3 -mx-3 -my-3 hover:bg-white/5 transition-colors sm:before:content-[''] sm:before:absolute sm:before:top-4 sm:before:bottom-4 sm:before:left-0 sm:before:w-px sm:before:bg-gradient-to-b sm:before:from-transparent sm:before:via-white/20 sm:before:to-transparent"
          title="ดู PO ที่รอจัดซื้อดำเนินการ"
        >
          <ArrowRight className="absolute top-3 right-3 size-4 text-white/0 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
          <div className="text-sm text-white/80 font-bold mb-4 flex items-center justify-center gap-2">
            {stats.staleCount > 0 && (
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
            รอดำเนินการ
          </div>
          <div className={`text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight drop-shadow-[0_2px_12px_rgba(255,255,255,0.1)] leading-none ${
            stats.staleCount > 0 ? "bg-gradient-to-br from-white via-amber-100 to-amber-200 bg-clip-text text-transparent" : "text-white"
          }`}>
            {stats.pending}
          </div>
          <div className="text-sm font-semibold text-white/70 mt-2">ใบ</div>
          {stats.staleCount > 0 && (
            <div className="text-sm text-amber-200 mt-2 font-semibold">
              ⚠️ {stats.staleCount} ใบค้างเกิน 3 วัน
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}

function ActionRow({ po }: { po: PurchaseOrder }) {
  const isProblem = po.status === "มีปัญหา";
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(po.created_at).getTime()) / 86400_000));
  const ageLabel = ageDays === 0 ? "วันนี้" : ageDays < 7 ? `${ageDays} วัน` : `${ageDays}+ วัน`;
  const isStale = ageDays >= 3;
  const items = po.items ?? [];

  return (
    <Link
      href={`/po/${po.id}`}
      className="group relative flex items-start gap-3.5 py-3 px-3 -mx-3 hover:bg-accent/40 rounded-xl transition-all duration-200"
    >
      {/* Status icon */}
      <div
        className={`relative size-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110 ${
          isProblem
            ? "bg-red-50 text-red-600 ring-1 ring-red-200/60"
            : isStale
              ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200/60"
              : "bg-blue-50 text-blue-600 ring-1 ring-blue-200/60"
        }`}
      >
        {isProblem
          ? <AlertCircle className="size-5" strokeWidth={2.25} />
          : <Clock className="size-5" strokeWidth={2.25} />
        }
        {/* Pulse for problems */}
        {isProblem && (
          <span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-20" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: PO# + status */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="font-bold text-sm text-foreground font-mono tracking-tight">
            {po.po_number}
          </div>
          <div className={`text-[11px] font-semibold ${
            isProblem ? "text-red-600" : isStale ? "text-amber-600" : "text-blue-600"
          }`}>
            • {po.status}
          </div>
        </div>

        {/* Row 2: requester · total qty */}
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {po.created_by_name ?? "—"}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          {items.length} รายการ
          {items.length > 0 && (
            <>
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              รวม <span className="font-semibold text-foreground tabular-nums">
                {items.reduce((s, it) => s + (it.qty ?? 0), 0).toLocaleString("th-TH")}
              </span> ชิ้น
            </>
          )}
        </div>

        {/* Row 3: item chips (max 3 + "+N more") */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {items.slice(0, 3).map((it, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 max-w-[180px] bg-muted/60 text-foreground/80 text-[11px] font-medium rounded-md px-2 py-0.5"
                title={`${it.name} ×${it.qty} ${it.unit ?? ""}`}
              >
                <span className="truncate">{it.name}</span>
                <span className="font-bold text-primary tabular-nums flex-shrink-0">
                  ×{it.qty}
                </span>
              </span>
            ))}
            {items.length > 3 && (
              <span className="inline-flex items-center bg-muted/40 text-muted-foreground text-[11px] font-medium rounded-md px-2 py-0.5">
                +{items.length - 3} เพิ่มเติม
              </span>
            )}
          </div>
        )}
      </div>

      {/* Age + arrow */}
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <div className={`text-xs font-semibold tabular-nums ${
          isStale ? "text-amber-600" : "text-muted-foreground"
        }`}>
          {ageLabel}
        </div>
        <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
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

  const trendUp = stats.spendGrowth >= 0;
  const diff = stats.thisMonthSpend - stats.lastMonthSpend;
  const longTone = stats.longestPendingDays > 14
    ? { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-200/60" }
    : stats.longestPendingDays > 7
      ? { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200/60" }
      : { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200/60" };

  // Find the actual longest-pending PO so we can deep-link to it
  const ACTIVE = ["รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว", "กำลังขนส่ง"] as const;
  let longestPo: PurchaseOrder | null = null;
  let longestDays = 0;
  for (const p of pos) {
    if (!ACTIVE.includes(p.status as typeof ACTIVE[number])) continue;
    if (!p.created_at) continue;
    const d = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400_000);
    if (d > longestDays) {
      longestDays = d;
      longestPo = p;
    }
  }

  return (
    <>
      {sup && (
        <Link
          href={`/po?search=${encodeURIComponent(sup.name)}`}
          className="block group"
          title={`ดู PO ทั้งหมดของ ${sup.name}`}
        >
          <Card className="overflow-hidden border-amber-200/50 bg-gradient-to-br from-amber-50/70 via-amber-50/40 to-orange-50/30 shadow-sm group-hover:shadow-md group-hover:border-amber-300 group-hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4 relative">
              {/* Decorative orb */}
              <div className="absolute -top-6 -right-6 size-20 rounded-full bg-amber-200/30 blur-2xl" />

              {/* Hover arrow */}
              <ArrowRight className="absolute top-3 right-3 size-3.5 text-amber-600/0 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />

              <div className="relative flex items-center justify-center gap-3.5">
                <div className="flex-shrink-0 inline-flex items-center justify-center size-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-2 ring-amber-100">
                  <Trophy className="size-6" strokeWidth={2.25} />
                </div>

                <div className="min-w-0 max-w-[180px]">
                  <div className="text-[10px] tracking-wider font-bold text-amber-700 uppercase">
                    Top Supplier
                  </div>
                  <div className="text-base font-extrabold text-foreground truncate" title={sup.name}>
                    {sup.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="font-semibold tabular-nums text-foreground">
                      {fmtMoney(sup.spend)}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold tabular-nums text-[10px]">
                      {supPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {stats.longestPendingDays > 0 && (
        <Link
          href={longestPo ? `/po/${longestPo.id}` : "/po?status=รอจัดซื้อดำเนินการ"}
          className="block group"
          title={longestPo ? `ดูใบ ${longestPo.po_number}` : "ดู PO ที่รออยู่"}
        >
          <Card className="group-hover:shadow-md group-hover:border-primary/40 group-hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-4 relative">
              <ArrowRight className="absolute top-3 right-3 size-3.5 text-muted-foreground/0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />

              <div className="flex items-center justify-center gap-3.5">
                <div className={`flex-shrink-0 inline-flex items-center justify-center size-12 rounded-2xl ring-1 ${longTone.bg} ${longTone.text} ${longTone.ring}`}>
                  <Clock className="size-6" strokeWidth={2.25} />
                </div>

                <div className="min-w-0">
                  <div className="text-[10px] tracking-wider font-bold text-muted-foreground uppercase">
                    PO ค้างนานสุด
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-extrabold tabular-nums leading-none ${longTone.text}`}>
                      {stats.longestPendingDays}
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">วัน</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {longestPo ? longestPo.po_number : "รอดำเนินการ"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      <Link
        href="/reports"
        className="block group"
        title="เปิดหน้ารายงาน + วิเคราะห์เพิ่มเติม"
      >
        <Card className="group-hover:shadow-md group-hover:border-primary/40 group-hover:-translate-y-0.5 transition-all duration-200">
          <CardContent className="p-4 relative">
            <ArrowRight className="absolute top-3 right-3 size-3.5 text-muted-foreground/0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />

            <div className="flex items-center justify-center gap-3.5">
              <div className={`flex-shrink-0 inline-flex items-center justify-center size-12 rounded-2xl ring-1 ${
                trendUp
                  ? "bg-emerald-50 text-emerald-600 ring-emerald-200/60"
                  : "bg-rose-50 text-rose-600 ring-rose-200/60"
              }`}>
                {trendUp ? <TrendingUp className="size-6" strokeWidth={2.25} /> : <TrendingDown className="size-6" strokeWidth={2.25} />}
              </div>

              <div className="min-w-0">
                <div className="text-[10px] tracking-wider font-bold text-muted-foreground uppercase">
                  เทียบเดือนก่อน
                </div>
                <div className={`text-xl font-extrabold tabular-nums leading-none mt-0.5 ${
                  trendUp ? "text-emerald-700" : "text-rose-700"
                }`}>
                  {trendUp ? "+" : ""}{fmtMoney(diff)}
                </div>
                <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${
                  trendUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}>
                  {trendUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                  {trendUp ? "+" : ""}{stats.spendGrowth.toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </>
  );
}
