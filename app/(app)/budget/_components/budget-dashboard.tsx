"use client";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { BudgetStatus } from "@/lib/types/db";

const STATUS_LABEL: Record<BudgetStatus["status"], string> = {
  ok: "✅ ปกติ",
  warning: "⚠️ ใกล้ครบ",
  critical: "🔴 วิกฤต",
  over: "🚨 เกินงบ!",
};

const STATUS_CLS: Record<BudgetStatus["status"], string> = {
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  warning: "text-amber-700 bg-amber-50 border-amber-200",
  critical: "text-orange-700 bg-orange-50 border-orange-200",
  over: "text-red-700 bg-red-50 border-red-200",
};

const PERIOD_LABEL = {
  monthly: "รายเดือน",
  quarterly: "รายไตรมาส",
  yearly: "รายปี",
} as const;

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
        text={`ตั้งงบใน tab "ตั้งงบ" ก่อน — ระบบจะคำนวณ % ใช้ไป + เตือนเมื่อใกล้เกิน\nเดือน ${month}/${year}`}
      />
    );
  }

  // Summary numbers
  const totalBudget = statuses.reduce((s, b) => s + b.amount, 0);
  const totalActual = statuses.reduce((s, b) => s + b.actual, 0);
  const overallPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const overCount = statuses.filter((s) => s.status === "over").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">
            ภาพรวมเดือน {month}/{year}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryStat label="งบทั้งหมด" value={fmtMoney(totalBudget)} />
            <SummaryStat label="ใช้ไปจริง" value={fmtMoney(totalActual)} />
            <SummaryStat label="คงเหลือ"
                         value={fmtMoney(totalBudget - totalActual)}
                         tone={totalActual > totalBudget ? "danger" : undefined} />
            <SummaryStat label="% ใช้ไป"
                         value={`${overallPct.toFixed(1)}%`}
                         tone={overallPct >= 100 ? "danger" : overallPct >= 80 ? "warning" : undefined} />
          </div>
          {overCount > 0 && (
            <div className="mt-3 px-3 py-2 bg-red-50 border-l-4 border-red-600 text-xs text-red-700 rounded-r">
              🚨 มี <strong>{overCount}</strong> หมวดที่ใช้เกินงบ — ตรวจสอบด่วน
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-budget cards */}
      <div className="space-y-3">
        {statuses.map((s) => (
          <BudgetCard key={s.id} status={s} />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "danger";
}) {
  const cls = tone === "danger" ? "text-red-600"
    : tone === "warning" ? "text-amber-600"
      : "text-slate-900";
  return (
    <div>
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums", cls)}>{value}</div>
    </div>
  );
}

function BudgetCard({ status: s }: { status: BudgetStatus }) {
  const periodLabel = s.period_type === "monthly"
    ? `เดือน ${s.period_month}/${s.period_year}`
    : s.period_type === "quarterly"
      ? `Q${Math.floor(((s.period_month ?? 1) - 1) / 3) + 1} ปี ${s.period_year}`
      : `ปี ${s.period_year}`;
  const categoryLabel = s.category ?? "รวมทั้งหมด";
  const cappedPct = Math.min(100, s.percent);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
          <div>
            <div className="font-bold text-slate-900">
              📂 {categoryLabel}
            </div>
            <div className="text-xs text-slate-500">
              {PERIOD_LABEL[s.period_type]} • {periodLabel}
            </div>
          </div>
          <span className={cn(
            "inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full border",
            STATUS_CLS[s.status],
          )}>
            {STATUS_LABEL[s.status]}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all rounded-full",
                s.status === "over" ? "bg-red-600"
                  : s.status === "critical" ? "bg-orange-500"
                    : s.status === "warning" ? "bg-amber-500"
                      : "bg-emerald-600",
              )}
              style={{ width: `${cappedPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-700">
              <span className="font-bold tabular-nums">{fmtMoney(s.actual)}</span>
              <span className="text-slate-500"> / {fmtMoney(s.amount)}</span>
            </span>
            <span className={cn(
              "font-bold tabular-nums",
              s.status === "over" ? "text-red-600"
                : s.status === "critical" ? "text-orange-600"
                  : s.status === "warning" ? "text-amber-600"
                    : "text-slate-700",
            )}>
              {s.percent.toFixed(1)}%
            </span>
          </div>
          <div className="text-xs text-slate-500">
            คงเหลือ: <strong className={s.remaining < 0 ? "text-red-600" : "text-slate-900"}>
              {fmtMoney(s.remaining)}
            </strong>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtMoney(n: number): string {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}
