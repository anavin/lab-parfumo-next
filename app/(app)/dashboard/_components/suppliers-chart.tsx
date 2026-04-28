"use client";

/**
 * Top suppliers — donut chart with center total + clickable legend
 *
 * Each segment & each legend row clickable → /po?search=<supplier name>
 */
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from "recharts";
import { Building2 } from "lucide-react";

interface SupplierData {
  name: string;
  spend: number;
  poCount: number;
}

const COLORS = ["#3A5A8C", "#2563EB", "#7C3AED", "#0891B2", "#059669"];

export function SuppliersChart({ data }: { data: SupplierData[] }) {
  const router = useRouter();

  if (!data.length) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center">
        <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
          <Building2 className="size-6 text-muted-foreground" />
        </div>
        <div className="text-sm font-semibold text-foreground">
          ยังไม่มี supplier
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          เริ่มสั่งซื้อจาก supplier ระบบจะ rank ที่นี่
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.spend, 0);

  function go(name: string) {
    router.push(`/po?search=${encodeURIComponent(name)}`);
  }

  return (
    <div className="h-64 w-full grid grid-cols-2 gap-3 items-center">
      {/* Donut */}
      <div className="relative h-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="spend"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              onClick={(d) => go(d.name)}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] tracking-wider font-bold text-muted-foreground uppercase">
            ยอดรวม
          </div>
          <div className="text-base font-extrabold text-foreground tabular-nums">
            {formatCompact(total)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {data.length} ราย
          </div>
        </div>
      </div>

      {/* Legend (clickable) */}
      <div className="space-y-1.5 overflow-y-auto max-h-full pr-1">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.spend / total) * 100 : 0;
          return (
            <button
              key={d.name}
              type="button"
              onClick={() => go(d.name)}
              className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
              title={`ดู PO ของ ${d.name}`}
            >
              <span
                className="size-2.5 rounded-full mt-1 flex-shrink-0 ring-2 ring-background"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors" title={d.name}>
                  {d.name}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  ฿{formatCompact(d.spend)} · {pct.toFixed(0)}% · {d.poCount} ใบ
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SupplierData; value: number }>;
}

function DonutTooltip({ active, payload, total }: TooltipProps & { total: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total > 0 ? (d.spend / total) * 100 : 0;
  return (
    <div className="bg-popover border border-border rounded-xl shadow-lg p-3 min-w-[180px]">
      <div className="text-sm font-bold text-foreground truncate">{d.name}</div>
      <div className="text-base font-extrabold text-foreground tabular-nums mt-1">
        ฿{d.spend.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
      </div>
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
        <span className="font-semibold tabular-nums">{pct.toFixed(1)}%</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="tabular-nums">{d.poCount} ใบ</span>
      </div>
      <div className="text-[10px] text-primary mt-2 font-semibold">
        คลิกเพื่อดู PO →
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
