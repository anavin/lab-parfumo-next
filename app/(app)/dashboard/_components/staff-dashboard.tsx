/**
 * StaffDashboard — ภาพรวมระบบสำหรับ staff (non-admin)
 *
 * เน้น:
 *  - งานที่ "คุณ" ต้องทำ (PO ของคุณ + PO ที่กดรับได้ทั้งระบบ)
 *  - ลด data ที่ไม่เกี่ยวข้อง (charts, top suppliers, total org spend)
 *  - personalized hero + quick actions ที่กดได้ทันที
 *
 * Server Component
 */
import Link from "next/link";
import {
  Plus, FileText, Truck, Bell, Package, Clock, ArrowRight,
  AlertCircle, AlertTriangle, CheckCircle2, ClipboardEdit,
  ShoppingBag, PackageCheck, XCircle, PackageOpen, Sparkles,
  Calendar, Building2, type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { computeStats } from "@/lib/db/po";
import type { PoStatus, PurchaseOrder, User } from "@/lib/types/db";

const STATUS_ORDER: PoStatus[] = [
  "รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว", "กำลังขนส่ง",
  "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์", "ยกเลิก",
];

interface StatusVisual {
  icon: LucideIcon;
  label: string;
  tone: string;
  ring: string;
}

const STATUS_VISUAL: Record<PoStatus, StatusVisual> = {
  "รอจัดซื้อดำเนินการ": {
    icon: ClipboardEdit, label: "รอจัดซื้อ",
    tone: "bg-amber-100 text-amber-700", ring: "ring-amber-200/60",
  },
  "สั่งซื้อแล้ว": {
    icon: ShoppingBag, label: "สั่งซื้อแล้ว",
    tone: "bg-blue-100 text-blue-700", ring: "ring-blue-200/60",
  },
  "กำลังขนส่ง": {
    icon: Truck, label: "กำลังขนส่ง",
    tone: "bg-indigo-100 text-indigo-700", ring: "ring-indigo-200/60",
  },
  "รับของแล้ว": {
    icon: PackageCheck, label: "รับของแล้ว",
    tone: "bg-cyan-100 text-cyan-700", ring: "ring-cyan-200/60",
  },
  "มีปัญหา": {
    icon: AlertTriangle, label: "มีปัญหา",
    tone: "bg-red-100 text-red-600", ring: "ring-red-200/60",
  },
  "เสร็จสมบูรณ์": {
    icon: CheckCircle2, label: "เสร็จสมบูรณ์",
    tone: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-200/60",
  },
  "ยกเลิก": {
    icon: XCircle, label: "ยกเลิก",
    tone: "bg-slate-100 text-slate-500", ring: "ring-slate-200/60",
  },
};

function fmtNumber(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

/** ทักทายตามช่วงเวลา */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "อรุณสวัสดิ์";
  if (h < 17) return "สวัสดียามบ่าย";
  if (h < 20) return "สวัสดียามเย็น";
  return "สวัสดียามค่ำคืน";
}

export function StaffDashboard({
  user, myPos, readyToReceive,
}: {
  user: User;
  /** PO ที่ user สร้างเอง */
  myPos: PurchaseOrder[];
  /** PO ทั้งระบบที่อยู่ในสถานะ "กำลังขนส่ง" — กดรับได้ */
  readyToReceive: PurchaseOrder[];
}) {
  // === Empty state — ยังไม่เคยสร้าง PO ===
  if (!myPos.length && !readyToReceive.length) {
    return (
      <div className="space-y-6">
        <PageHeader user={user} />
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <div className="size-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
              <Sparkles className="size-10 text-primary" strokeWidth={2} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              ยินดีต้อนรับ, {user.full_name}!
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              ยังไม่มี PO ของคุณ — กดปุ่มด้านล่างเพื่อสร้างใบแรก
            </p>
            <Link href="/po/new">
              <Button size="lg">
                <Plus className="size-4" /> สร้างใบ PO ใหม่
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = computeStats(myPos);

  // เสร็จเดือนนี้ (เฉพาะของคุณ)
  const now = new Date();
  const completedThisMonth = myPos.filter((p) => {
    if (!["เสร็จสมบูรณ์", "รับของแล้ว"].includes(p.status)) return false;
    const d = p.received_date || p.ordered_date || p.created_at;
    if (!d) return false;
    const dt = new Date(d);
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  }).length;

  // PO ของคุณที่ต้องติดตาม
  const today = new Date().toISOString().slice(0, 10);
  const followUp: PurchaseOrder[] = [];
  for (const p of myPos) {
    if (p.status === "มีปัญหา" || p.status === "รับของแล้ว") {
      followUp.push(p);
      continue;
    }
    // ค้างนาน (รอจัดซื้อ > 3 วัน)
    if (p.status === "รอจัดซื้อดำเนินการ" && p.created_at) {
      const days = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400_000);
      if (days >= 3) followUp.push(p);
      continue;
    }
    // เลยกำหนดรับ
    if (p.expected_date && p.expected_date < today
        && ["สั่งซื้อแล้ว", "กำลังขนส่ง"].includes(p.status)) {
      followUp.push(p);
    }
  }
  const followUpItems = followUp.slice(0, 5);

  // PO ล่าสุด (ของคุณ)
  const recentPos = [...myPos]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-7">
      <PageHeader user={user} />

      {/* Alerts */}
      <div className="space-y-2.5">
        {stats.overdueCount > 0 && (
          <Alert tone="danger">
            <AlertDescription>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span>
                  <strong>PO ของคุณเลยกำหนด {stats.overdueCount} ใบ</strong>
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
                  <strong>PO ของคุณใกล้ครบกำหนด {stats.upcomingCount} ใบ</strong>
                  <span className="opacity-80"> (ภายใน 3 วัน)</span>
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

      {/* Personal hero — 3 mini stats */}
      <PersonalHero
        userName={user.full_name}
        total={stats.total}
        active={stats.pending}
        completedThisMonth={completedThisMonth}
      />

      {/* Quick actions — 4 cards */}
      <QuickActions
        readyCount={readyToReceive.length}
        followUpCount={followUpItems.length}
      />

      {/* Two-column: Ready to receive + Follow-up */}
      <div className="grid lg:grid-cols-2 gap-5">
        <ReadyToReceiveCard pos={readyToReceive} />
        <FollowUpCard pos={followUpItems} />
      </div>

      {/* Status grid (PO ของคุณ) */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground">
            PO ของคุณ — แยกตามสถานะ
          </h2>
          <Link
            href="/po"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            ดูทั้งหมด <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {STATUS_ORDER.map((status) => {
            const visual = STATUS_VISUAL[status];
            const Icon = visual.icon;
            const count = stats.byStatus[status] ?? 0;
            const isEmpty = count === 0;
            return (
              <Link
                key={status}
                href={`/po?status=${encodeURIComponent(status)}`}
                className={`group relative bg-card border border-border/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${
                  isEmpty ? "opacity-70 hover:opacity-100" : ""
                }`}
              >
                <div className={`size-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 ${visual.tone} ring-1 ${visual.ring}`}>
                  <Icon className="size-5" strokeWidth={2.25} />
                </div>
                <div className="text-2xl font-extrabold text-foreground leading-none tabular-nums">
                  {count}
                </div>
                <div className="text-xs text-muted-foreground font-semibold mt-2 leading-tight">
                  {visual.label}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="size-4" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">
                    PO ล่าสุดของคุณ
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {recentPos.length === 0
                      ? "ยังไม่มี PO"
                      : `${recentPos.length} ใบล่าสุด`}
                  </div>
                </div>
              </div>
              {recentPos.length > 0 && (
                <Link
                  href="/po"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  ดูทั้งหมด <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
            {recentPos.length === 0 ? (
              <EmptyMini message="ยังไม่มี PO" />
            ) : (
              <div className="space-y-0.5">
                {recentPos.map((po) => <RecentPoRow key={po.id} po={po} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ==================================================================
// Sub-components
// ==================================================================

function PageHeader({ user }: { user: User }) {
  const today = new Date().toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          ภาพรวมระบบ
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {greeting()}, <span className="font-semibold text-foreground">{user.full_name}</span> • {today}
        </p>
      </div>
    </div>
  );
}

function PersonalHero({
  userName, total, active, completedThisMonth,
}: {
  userName: string;
  total: number;
  active: number;
  completedThisMonth: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-primary to-brand-950 text-white p-6 sm:p-8 shadow-2xl ring-1 ring-white/10">
      {/* Decorative orbs */}
      <div className="absolute -top-32 -right-32 size-72 rounded-full bg-brand-400/25 blur-3xl animate-pulse" style={{ animationDuration: "5s" }} />
      <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-brand-500/15 blur-3xl animate-pulse" style={{ animationDuration: "7s", animationDelay: "1s" }} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Greeting */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/70 mb-1.5 inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            งานของคุณวันนี้
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {greeting()}, <span className="bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">{userName}</span> 👋
          </div>
          <div className="text-sm text-white/70 mt-1">
            ขอให้วันนี้เป็นวันที่ดี — มาดู PO ของคุณกัน
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:max-w-md sm:flex-shrink-0">
          <MiniStat
            href="/po"
            label="PO ของคุณ"
            value={total}
            unit="ใบ"
            tone="default"
          />
          <MiniStat
            href="/po?status=รอจัดซื้อดำเนินการ"
            label="กำลังดำเนินการ"
            value={active}
            unit="ใบ"
            tone={active > 0 ? "warn" : "default"}
          />
          <MiniStat
            href={`/po?status=${encodeURIComponent("เสร็จสมบูรณ์")}`}
            label="เสร็จเดือนนี้"
            value={completedThisMonth}
            unit="ใบ"
            tone="success"
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  href, label, value, unit, tone = "default",
}: {
  href: string;
  label: string;
  value: number;
  unit: string;
  tone?: "default" | "warn" | "success";
}) {
  const valueCls = tone === "warn"
    ? "bg-gradient-to-br from-white via-amber-100 to-amber-200 bg-clip-text text-transparent"
    : tone === "success"
      ? "bg-gradient-to-br from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent"
      : "text-white";

  return (
    <Link
      href={href}
      className="group rounded-2xl p-3 sm:p-4 bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/25 transition-all backdrop-blur-sm text-center"
    >
      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/70 mb-1.5 leading-tight">
        {label}
      </div>
      <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums leading-none ${valueCls}`}>
        {fmtNumber(value)}
      </div>
      <div className="text-[10px] sm:text-xs text-white/60 mt-1 font-semibold">{unit}</div>
    </Link>
  );
}

function QuickActions({
  readyCount, followUpCount,
}: {
  readyCount: number;
  followUpCount: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <ActionCard
        href="/po/new"
        icon={Plus}
        title="สร้างใบ PO ใหม่"
        description="เริ่มใบ PO ใหม่"
        primary
      />
      <ActionCard
        href="/po/pending-receipt"
        icon={Truck}
        title="พร้อมให้รับ"
        description={readyCount > 0 ? `${readyCount} ใบรอรับของ` : "ไม่มีของรอรับ"}
        badge={readyCount > 0 ? readyCount : undefined}
        tone={readyCount > 0 ? "indigo" : "muted"}
      />
      <ActionCard
        href="/po"
        icon={FileText}
        title="PO ของคุณ"
        description={followUpCount > 0 ? `${followUpCount} รายการต้องดู` : "ดูทั้งหมด"}
        tone={followUpCount > 0 ? "amber" : "muted"}
      />
      <ActionCard
        href="/notifications"
        icon={Bell}
        title="แจ้งเตือน"
        description="ดูข้อความใหม่"
        tone="muted"
      />
    </div>
  );
}

function ActionCard({
  href, icon: Icon, title, description, primary, tone = "muted", badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  primary?: boolean;
  tone?: "muted" | "indigo" | "amber";
  badge?: number;
}) {
  const cardCls = primary
    ? "bg-gradient-to-br from-primary to-brand-700 text-white shadow-lg shadow-brand/20 hover:shadow-xl hover:-translate-y-1"
    : "bg-card border border-border/80 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5";

  const iconBg = primary
    ? "bg-white/20 text-white ring-1 ring-white/30"
    : tone === "indigo"
      ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/60"
      : tone === "amber"
        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200/60"
        : "bg-muted text-muted-foreground ring-1 ring-border";

  const titleCls = primary ? "text-white" : "text-foreground";
  const descCls = primary ? "text-white/80" : "text-muted-foreground";

  return (
    <Link
      href={href}
      className={`group relative rounded-2xl p-4 transition-all duration-200 overflow-hidden ${cardCls}`}
    >
      {primary && (
        <div className="absolute -top-12 -right-12 size-32 rounded-full bg-white/10 blur-2xl group-hover:bg-white/15 transition-colors" />
      )}

      <div className="relative flex items-start gap-3">
        <div className={`flex-shrink-0 size-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${iconBg}`}>
          <Icon className="size-5" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className={`text-sm font-bold ${titleCls}`}>{title}</div>
            {badge != null && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
                {badge}
              </span>
            )}
          </div>
          <div className={`text-xs mt-0.5 ${descCls}`}>{description}</div>
        </div>
        <ArrowRight className={`size-4 flex-shrink-0 mt-1 transition-all ${
          primary ? "text-white/60 group-hover:text-white group-hover:translate-x-0.5" : "text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5"
        }`} />
      </div>
    </Link>
  );
}

function ReadyToReceiveCard({ pos }: { pos: PurchaseOrder[] }) {
  const items = pos.slice(0, 5);
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Truck className="size-5" strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">
                พร้อมให้รับ
              </div>
              <div className="text-[11px] text-muted-foreground">
                {pos.length === 0 ? "ไม่มีของรอรับ" : `${pos.length} ใบรอรับของ`}
              </div>
            </div>
          </div>
          {pos.length > 0 && (
            <Link
              href="/po/pending-receipt"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="size-3" />
            </Link>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyMini
            icon={CheckCircle2}
            message="ตอนนี้ไม่มีของรอรับ"
            sub="ของในระบบรับครบหมดแล้ว 🎉"
          />
        ) : (
          <div className="space-y-0.5">
            {items.map((po) => <ReadyRow key={po.id} po={po} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadyRow({ po }: { po: PurchaseOrder }) {
  const items = po.items ?? [];
  const totalQty = items.reduce((s, it) => s + (it.qty ?? 0), 0);

  return (
    <Link
      href={`/po/${po.id}`}
      className="group relative flex items-start gap-3 py-3 px-3 -mx-3 hover:bg-indigo-50/40 rounded-xl transition-all duration-200"
    >
      <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/60 flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110">
        <PackageOpen className="size-5" strokeWidth={2.25} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="font-bold text-sm text-foreground font-mono tracking-tight">
            {po.po_number}
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
            <Truck className="size-3" /> กำลังขนส่ง
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
          <Building2 className="size-3 flex-shrink-0" />
          <span className="truncate">{po.supplier_name ?? "—"}</span>
          <span className="text-muted-foreground/40">·</span>
          <Package className="size-3 flex-shrink-0" />
          <span>{items.length} รายการ</span>
          {totalQty > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="tabular-nums">{fmtNumber(totalQty)} ชิ้น</span>
            </>
          )}
        </div>
      </div>

      <Button size="xs" variant="primary" className="flex-shrink-0 mt-0.5 pointer-events-none">
        <PackageOpen className="size-3" /> รับของ
      </Button>
    </Link>
  );
}

function FollowUpCard({ pos }: { pos: PurchaseOrder[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-500/25">
              <Clock className="size-5" strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">
                ที่ต้องติดตาม
              </div>
              <div className="text-[11px] text-muted-foreground">
                {pos.length === 0
                  ? "ทุกอย่างเรียบร้อย"
                  : `${pos.length} ใบของคุณต้องดู`}
              </div>
            </div>
          </div>
          {pos.length > 0 && (
            <Link
              href="/po"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="size-3" />
            </Link>
          )}
        </div>

        {pos.length === 0 ? (
          <EmptyMini
            icon={CheckCircle2}
            message="ไม่มีงานค้างของคุณ"
            sub="ทำดีมาก! ทุกอย่างเรียบร้อย 🎉"
          />
        ) : (
          <div className="space-y-0.5">
            {pos.map((po) => <FollowUpRow key={po.id} po={po} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FollowUpRow({ po }: { po: PurchaseOrder }) {
  const isProblem = po.status === "มีปัญหา";
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = po.expected_date != null && po.expected_date < today
    && ["สั่งซื้อแล้ว", "กำลังขนส่ง"].includes(po.status);
  const ageDays = po.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(po.created_at).getTime()) / 86400_000))
    : 0;

  // Tone
  const tone = isProblem
    ? { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-200/60", icon: AlertCircle, label: "มีปัญหา" }
    : isOverdue
      ? { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-200/60", icon: AlertTriangle, label: "เลยกำหนด" }
      : po.status === "รับของแล้ว"
        ? { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200/60", icon: PackageCheck, label: "รับแล้ว — รอปิดงาน" }
        : { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200/60", icon: Clock, label: "ค้างนาน" };

  const Icon = tone.icon;

  return (
    <Link
      href={`/po/${po.id}`}
      className="group flex items-start gap-3 py-3 px-3 -mx-3 hover:bg-accent/40 rounded-xl transition-all duration-200"
    >
      <div className={`size-10 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110 ${tone.bg} ${tone.text} ${tone.ring}`}>
        <Icon className="size-5" strokeWidth={2.25} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="font-bold text-sm text-foreground font-mono tracking-tight">
            {po.po_number}
          </div>
          <div className={`text-[11px] font-semibold ${tone.text}`}>
            • {tone.label}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {po.supplier_name ?? "(ยังไม่ระบุ)"}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          {po.status}
          {!isProblem && !isOverdue && ageDays > 0 && (
            <>
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              สร้างเมื่อ {ageDays} วันก่อน
            </>
          )}
        </div>
      </div>

      <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
    </Link>
  );
}

function RecentPoRow({ po }: { po: PurchaseOrder }) {
  const visual = STATUS_VISUAL[po.status as PoStatus];
  const Icon = visual?.icon ?? FileText;
  const items = po.items ?? [];
  const dt = new Date(po.created_at);
  const dateLabel = dt.toLocaleDateString("th-TH", {
    day: "2-digit", month: "short",
  });

  return (
    <Link
      href={`/po/${po.id}`}
      className="group flex items-center gap-3 py-2.5 px-3 -mx-3 hover:bg-accent/40 rounded-xl transition-all duration-200"
    >
      <div className={`size-9 rounded-lg ring-1 flex items-center justify-center flex-shrink-0 ${visual?.tone ?? "bg-muted text-muted-foreground"} ${visual?.ring ?? "ring-border"}`}>
        <Icon className="size-4" strokeWidth={2.25} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="font-bold text-sm text-foreground font-mono tracking-tight">
            {po.po_number}
          </div>
          <div className="text-[11px] text-muted-foreground">
            • {visual?.label ?? po.status}
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {po.supplier_name ?? "—"}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          {items.length} รายการ
        </div>
      </div>

      <div className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
        {dateLabel}
      </div>
      <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  );
}

function EmptyMini({
  icon: Icon = CheckCircle2, message, sub,
}: {
  icon?: LucideIcon;
  message: string;
  sub?: string;
}) {
  return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
        <Icon className="size-6" strokeWidth={2.25} />
      </div>
      <div className="font-semibold text-foreground">{message}</div>
      {sub && <div className="text-xs mt-0.5">{sub}</div>}
    </div>
  );
}
