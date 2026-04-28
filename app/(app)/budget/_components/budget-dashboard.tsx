"use client";

import {
  AlertTriangle, CheckCircle2, Wallet, TrendingDown, FolderOpen,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { BudgetStatus } from "@/lib/types/db";

const STATUS_VISUAL: Record<BudgetStatus["status"], {
  label: string;
  bg: string;
  ring: string;
  bar: string;
  text: string;
}> = {
  ok: {
    label: "ปกติ",
    bg: "bg-emerald-50 text-emerald-700",
    ring: "ring-emerald-200",
    bar: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    text: "text-emerald-700",
  },
  warning: {
    label: "ใกล้ครบ",
    bg: "bg-amber-50 text-amber-700",
    ring: "ring-amber-200",
    bar: "bg-gradient-to-r from-amber-400 to-amber-500",
    text: "text-amber-700",
  },
  critical: {
    label: "วิกฤต",
    bg: "bg-orange-50 text-orange-700",
    ring: "ring-orange-200",
    bar: "bg-gradient-to-r from-orange-500 to-orange-600",
    text: "text-orange-700",
  },
  over: {
    label: "เกินงบ",
    bg: "bg-red-50 text-red-700",
    ring: "ring-red-200",
    bar: "bg-gradient-to-r from-red-500 to-red-700",
    text: "text-red-700",
  },
};

const PERIOD_LABEL = {
  monthly: "รายเดือน",
  quarterly: "รายไตรมาส",
  yearly: "รายปี",
} as const;

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function BudgetDashboard({
  year, month, statuses,
}: {
  year: number;
  month: number;
  statuses: BudgetStatus[];
}) {
  if (statuses.length === 0) {
    return (
      <EmptyState
        icon="💰"
        title="ยังไม่มีงบประมาณ"
        text={`ตั้งงบใน tab "ตั้งงบประมาณ" ก่อน — ระบบจะคำนวณ % ใช้ไป + เตือนเมื่อใกล้เกิน\nเดือน ${TH_MONTHS[month - 1]} ${year}`}
      />
    );
  }

  const totalBudget = statuses.reduce((s, b) => s + b.amount, 0);
  const totalActual = statuses.reduce((s, b) => s + b.actual, 0);
  const totalRemaining = totalBudget - totalActual;
  const overallPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const overCount = statuses.filter((s) => s.status === "over").length;
  const cappedOverall = Math.min(100, overallPct);

  const overallTone =
    overallPct >= 100 ? STATUS_VISUAL.over :
    overallPct >= 95 ? STATUS_VISUAL.critical :
    overallPct >= 80 ? STATUS_VISUAL.warning :
    STATUS_VISUAL.ok;

  return (
    <div className="space-y-5">
      {/* Overview hero */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Calendar className="size-3.5" />
            ภาพรวม {TH_MONTHS[month - 1]} {year}
          </div>

          {/* Big numbers grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={Wallet}
              label="งบทั้งหมด"
              value={fmtMoney(totalBudget)}
              unit="บาท"
              color="primary"
            />
            <KpiCard
              icon={TrendingDown}
              label="ใช้ไปจริง"
              value={fmtMoney(totalActual)}
              unit="บาท"
              color="amber"
              subtitle={`${overallPct.toFixed(1)}% ของงบ`}
            />
            <KpiCard
              icon={CheckCircle2}
              label="คงเหลือ"
              value={fmtMoney(Math.abs(totalRemaining))}
              unit={totalRemaining < 0 ? "บาท (ติดลบ)" : "บาท"}
              color={totalRemaining < 0 ? "red" : "emerald"}
            />
            <KpiCard
              icon={overCount > 0 ? AlertTriangle : CheckCircle2}
              label={overCount > 0 ? "หมวดเกินงบ" : "ภายใต้งบ"}
              value={overCount > 0 ? overCount.toLocaleString("th-TH") : statuses.length.toLocaleString("th-TH")}
              unit="หมวด"
              color={overCount > 0 ? "red" : "emerald"}
            />
          </div>

          {/* Overall progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">การใช้งบรวม</span>
              <span className={`font-bold tabular-nums ${overallTone.text}`}>
                {overallPct.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden ring-1 ring-border">
              <div
                className={`h-full transition-all duration-500 rounded-full ${overallTone.bar}`}
                style={{ width: `${cappedOverall}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span><strong className="text-foreground">{fmtMoney(totalActual)}</strong> ใช้ไป</span>
              <span><strong className="text-foreground">{fmtMoney(totalBudget)}</strong> งบ</span>
            </div>
          </div>

          {/* Over budget alert */}
          {overCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border-l-4 border-red-600 rounded-r-lg">
              <AlertTriangle className="size-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <strong>{overCount} หมวด</strong> ใช้เกินงบประมาณ — ต้องตรวจสอบและพิจารณาเพิ่มงบหรือลด spending
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-category cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
          <FolderOpen className="size-3.5" />
          งบประมาณรายหมวด ({statuses.length})
        </div>
        {statuses.map((s) => (
          <BudgetCard key={s.id} status={s} />
        ))}
      </div>
    </div>
  );
}

// ==================================================================
// KPI Card
// ==================================================================
const KPI_TONE: Record<string, { gradient: string; ring: string }> = {
  primary: { gradient: "bg-gradient-to-br from-blue-500 to-blue-700", ring: "ring-blue-200" },
  emerald: { gradient: "bg-gradient-to-br from-emerald-500 to-emerald-700", ring: "ring-emerald-200" },
  amber: { gradient: "bg-gradient-to-br from-amber-400 to-orange-500", ring: "ring-amber-200" },
  red: { gradient: "bg-gradient-to-br from-red-500 to-rose-600", ring: "ring-red-200" },
};

function KpiCard({
  icon: Icon, label, value, unit, color, subtitle,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  unit: string;
  color: keyof typeof KPI_TONE;
  subtitle?: string;
}) {
  const tone = KPI_TONE[color];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all">
      <div className="flex items-center justify-center gap-3">
        <div className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-2 shadow-md text-white ${tone.gradient} ${tone.ring}`}>
          <Icon className="size-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-extrabold tabular-nums text-foreground leading-none">
              {value}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">{unit}</span>
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// Per-category card
// ==================================================================
function BudgetCard({ status: s }: { status: BudgetStatus }) {
  const periodLabel = s.period_type === "monthly"
    ? `${TH_MONTHS[(s.period_month ?? 1) - 1]} ${s.period_year}`
    : s.period_type === "quarterly"
      ? `Q${Math.floor(((s.period_month ?? 1) - 1) / 3) + 1} ปี ${s.period_year}`
      : `ปี ${s.period_year}`;
  const categoryLabel = s.category ?? "รวมทุกหมวด";
  const cappedPct = Math.min(100, s.percent);
  const tone = STATUS_VISUAL[s.status];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        {/* Icon badge */}
        <div className={`flex-shrink-0 size-10 rounded-xl flex items-center justify-center ring-1 ${tone.bg} ${tone.ring}`}>
          <FolderOpen className="size-5" strokeWidth={2.25} />
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold text-foreground truncate">
                {categoryLabel}
              </div>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
                <Calendar className="size-3" />
                {PERIOD_LABEL[s.period_type]} · {periodLabel}
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ring-1 ${tone.bg} ${tone.ring}`}>
              <span className="size-1.5 rounded-full bg-current opacity-70" />
              {tone.label}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2.5 bg-muted rounded-full overflow-hidden ring-1 ring-border/50">
              <div
                className={`h-full transition-all duration-500 rounded-full ${tone.bar}`}
                style={{ width: `${cappedPct}%` }}
              />
            </div>
            <div className="flex justify-between items-baseline text-xs">
              <span className="tabular-nums">
                <span className="font-bold text-foreground">{fmtMoney(s.actual)}</span>
                <span className="text-muted-foreground"> / {fmtMoney(s.amount)}</span>
              </span>
              <span className={`font-bold tabular-nums ${tone.text}`}>
                {s.percent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Footer: remaining */}
          <div className="text-xs text-muted-foreground pt-1 border-t border-border/40 inline-flex items-center gap-2">
            คงเหลือ:{" "}
            <strong className={`tabular-nums ${s.remaining < 0 ? "text-red-600" : "text-foreground"}`}>
              {s.remaining < 0 ? "−" : ""}{fmtMoney(Math.abs(s.remaining))}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtMoney(n: number): string {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}
