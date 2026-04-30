import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Building2, FileText, DollarSign, Calendar, Truck,
  CreditCard, MapPin, Phone, Mail, User as UserIcon, Tag,
  Trophy, Edit2, Hash, ExternalLink, type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { requirePrivileged } from "@/lib/auth/require-user";
import {
  getSupplierWithStats, getPosBySupplierId,
  getTopItemsForSupplier, getMonthlyTrendForSupplier,
} from "@/lib/db/suppliers";
import { SupplierDetailActions } from "./_components/supplier-detail-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = await getSupplierWithStats(id);
  return {
    title: s ? `${s.name} — Supplier` : "ไม่พบ Supplier",
  };
}

function fmtMoney(n: number): string {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}

function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePrivileged();
  const { id } = await params;

  const s = await getSupplierWithStats(id);
  if (!s) notFound();

  const [pos, topItems, trend] = await Promise.all([
    getPosBySupplierId(id, 50),
    getTopItemsForSupplier(id, 10),
    getMonthlyTrendForSupplier(id, 6),
  ]);

  const initials = (s.name || "?").trim().slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3.5" /> Suppliers
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className={`size-16 rounded-2xl flex items-center justify-center font-extrabold text-xl text-white ring-2 shadow-md ${
                s.is_active
                  ? "bg-gradient-to-br from-indigo-500 to-violet-600 ring-indigo-200"
                  : "bg-gradient-to-br from-slate-300 to-slate-400 ring-slate-200"
              }`}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground truncate">
                  {s.name}
                </h1>
                {s.is_active ? (
                  <Badge variant="soft" className="!bg-emerald-100 !text-emerald-700">
                    🟢 Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="!text-red-600 !border-red-300">
                    ปิดใช้งาน
                  </Badge>
                )}
                {s.totalSpend > 0 && (
                  <Badge variant="soft" className="!bg-amber-100 !text-amber-700 inline-flex items-center gap-0.5">
                    <Trophy className="size-3" /> Total {fmtMoney(s.totalSpend)}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-2 flex-wrap">
                {s.code && (
                  <span className="inline-flex items-center gap-0.5">
                    <Hash className="size-3" />
                    <span className="font-mono">{s.code}</span>
                  </span>
                )}
                {s.code && s.tax_id && <span>•</span>}
                {s.tax_id && <span>{s.tax_id}</span>}
                {s.category && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Tag className="size-3" /> {s.category}
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground/80 mt-1">
                สมัครเมื่อ {fmtDateLong(s.created_at)}
                {s.updated_at !== s.created_at && (
                  <> • อัปเดต {fmtDate(s.updated_at)}</>
                )}
              </div>
            </div>
            <SupplierDetailActions supplier={s} />
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={FileText}
          label="PO ทั้งหมด"
          value={s.poCount}
          unit="ใบ"
          color="primary"
        />
        <KpiCard
          icon={DollarSign}
          label="ยอดสะสม"
          value={s.totalSpend}
          unit="บาท"
          color="emerald"
          isMoney
        />
        <KpiCard
          icon={Calendar}
          label="PO ปีนี้"
          value={s.poCountThisYear}
          unit="ใบ"
          color="amber"
          subtitle={s.totalSpendThisYear > 0 ? fmtMoney(s.totalSpendThisYear) : undefined}
        />
        <KpiCard
          icon={Truck}
          label="รอจัดการ"
          value={s.pendingPoCount}
          unit="ใบ"
          color={s.pendingPoCount > 0 ? "indigo" : "slate"}
        />
      </div>

      {/* Two-column: Info + PO history */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Left: Info */}
        <div className="space-y-5">
          {/* Contact */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle icon={Phone}>ข้อมูลติดต่อ</SectionTitle>
              <div className="space-y-2 text-sm">
                <InfoRow icon={UserIcon} label="ผู้ติดต่อ" value={s.contact_person} />
                <InfoRow icon={Phone} label="โทรศัพท์" value={s.phone} />
                <InfoRow icon={Mail} label="อีเมล" value={s.email} />
                <InfoRow icon={MapPin} label="ที่อยู่" value={s.address} />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle icon={CreditCard}>ข้อมูลชำระเงิน</SectionTitle>
              <div className="space-y-2 text-sm">
                <InfoRow icon={Building2} label="ธนาคาร" value={s.bank_name} />
                <InfoRow icon={Hash} label="เลขบัญชี" value={s.bank_account} mono />
                <InfoRow icon={Calendar} label="เครดิตเทอม" value={s.payment_terms} />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {s.notes && (
            <Card>
              <CardContent className="p-5">
                <SectionTitle>📝 หมายเหตุภายใน</SectionTitle>
                <div className="text-sm text-foreground bg-blue-50/50 border border-blue-200/50 rounded-lg p-3 whitespace-pre-line">
                  {s.notes}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top products */}
          {topItems.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <SectionTitle>🏆 สินค้าที่สั่งบ่อย</SectionTitle>
                <div className="space-y-1.5 text-sm">
                  {topItems.slice(0, 5).map((it, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5">
                          {i + 1}.
                        </span>
                        <span className="truncate font-medium">{it.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                        <span className="tabular-nums font-semibold text-foreground">
                          {it.totalQty.toLocaleString("th-TH")}
                        </span>
                        <span>×</span>
                        <span>{it.poCount} ครั้ง</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: PO history */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-border/40">
              <SectionTitle>📋 PO ล่าสุด ({pos.length})</SectionTitle>
              {pos.length > 0 && (
                <Link
                  href={`/po?search=${encodeURIComponent(s.name)}`}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  ดูทั้งหมด <ExternalLink className="size-3" />
                </Link>
              )}
            </div>

            {pos.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <FileText className="size-10 mx-auto mb-2 text-muted-foreground/40" />
                ยังไม่มี PO กับ supplier นี้
              </div>
            ) : (
              <div className="space-y-1.5">
                {pos.slice(0, 20).map((p) => (
                  <Link
                    key={p.id}
                    href={`/po/${p.id}`}
                    className="block p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-accent/40 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-sm font-mono text-foreground">
                          {p.po_number}
                        </span>
                        <StatusPill status={p.status} />
                      </div>
                      {p.total != null && p.total > 0 && (
                        <span className="text-sm font-bold tabular-nums text-foreground">
                          {fmtMoney(p.total)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {p.items?.length ?? 0} รายการ • สร้างเมื่อ {fmtDate(p.created_at)}
                      {p.created_by_name && <> • โดย {p.created_by_name}</>}
                    </div>
                  </Link>
                ))}
                {pos.length > 20 && (
                  <div className="text-center text-xs text-muted-foreground pt-2">
                    + อีก {pos.length - 20} ใบ
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend */}
      {trend.some((t) => t.spend > 0) && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle>📊 ยอดสั่งซื้อ 6 เดือนล่าสุด</SectionTitle>
            <MonthlyTrendChart data={trend} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================================================================
// Sub-components
// ==================================================================

function SectionTitle({
  icon: Icon, children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <h2 className="text-sm font-bold text-foreground mb-3 inline-flex items-center gap-1.5">
      {Icon && <Icon className="size-4 text-primary" />}
      {children}
    </h2>
  );
}

function InfoRow({
  icon: Icon, label, value, mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-3.5 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {value ? (
          <div className={`text-foreground ${mono ? "font-mono" : ""}`}>
            {value.split("\n").map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground/60 italic">— ไม่ระบุ —</div>
        )}
      </div>
    </div>
  );
}

const KPI_TONE: Record<string, { gradient: string; ring: string }> = {
  primary: { gradient: "bg-gradient-to-br from-blue-500 to-blue-700", ring: "ring-blue-200" },
  amber: { gradient: "bg-gradient-to-br from-amber-400 to-orange-500", ring: "ring-amber-200" },
  emerald: { gradient: "bg-gradient-to-br from-emerald-500 to-emerald-700", ring: "ring-emerald-200" },
  indigo: { gradient: "bg-gradient-to-br from-indigo-500 to-violet-600", ring: "ring-indigo-200" },
  slate: { gradient: "bg-gradient-to-br from-slate-300 to-slate-400", ring: "ring-slate-200" },
};

function KpiCard({
  icon: Icon, label, value, unit, color, isMoney, subtitle,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  color: keyof typeof KPI_TONE;
  isMoney?: boolean;
  subtitle?: string;
}) {
  const tone = KPI_TONE[color];
  const display = isMoney
    ? `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
    : value.toLocaleString("th-TH");

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-2 shadow-md text-white ${tone.gradient} ${tone.ring}`}>
          <Icon className="size-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className={`${isMoney ? "text-base" : "text-xl"} font-extrabold tabular-nums text-foreground leading-none`}>
              {display}
            </span>
            {!isMoney && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple SSR bar chart (no recharts — lightweight)
function MonthlyTrendChart({ data }: { data: Array<{ monthLabel: string; spend: number; poCount: number }> }) {
  const maxSpend = Math.max(...data.map((d) => d.spend), 1);
  return (
    <div className="grid grid-cols-6 gap-2">
      {data.map((d, i) => {
        const heightPct = (d.spend / maxSpend) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="w-full h-32 flex flex-col justify-end">
              <div
                className="w-full bg-gradient-to-t from-indigo-500 to-violet-500 rounded-t-md transition-all"
                style={{ height: `${heightPct}%`, minHeight: d.spend > 0 ? "4px" : "0" }}
                title={`${d.monthLabel}: ${fmtMoney(d.spend)} • ${d.poCount} PO`}
              />
            </div>
            <div className="text-[10px] font-semibold text-foreground tabular-nums">
              {d.spend > 0 ? `${(d.spend / 1000).toFixed(0)}k` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">{d.monthLabel}</div>
          </div>
        );
      })}
    </div>
  );
}
