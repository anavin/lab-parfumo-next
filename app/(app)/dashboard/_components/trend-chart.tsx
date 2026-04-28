"use client";

/**
 * Trend chart — ยอดซื้อย้อนหลัง 6 เดือน
 *
 * Area chart with gradient fill + smooth curve.
 * Clicking a month navigates to /po filtered by that month's date range.
 */
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface TrendData {
  monthLabel: string;
  /** Month key in YYYY-MM format — used for navigation filter */
  month?: string;
  spend: number;
  poCount: number;
}

export function TrendChart({ data }: { data: TrendData[] }) {
  const router = useRouter();
  const hasAnyData = data.some((d) => d.spend > 0);

  if (!hasAnyData) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center">
        <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
          <TrendingUp className="size-6 text-muted-foreground" />
        </div>
        <div className="text-sm font-semibold text-foreground">
          ยังไม่มีข้อมูลการสั่งซื้อ
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          เริ่มสร้าง PO + สั่งซื้อ ระบบจะแสดง trend ที่นี่
        </div>
      </div>
    );
  }

  function handleClick(payload: { activePayload?: Array<{ payload: TrendData }> }) {
    const point = payload?.activePayload?.[0]?.payload;
    if (!point) return;
    const params = new URLSearchParams();
    if (point.month) {
      // month = "2026-04" → first/last day of that month
      const [y, m] = point.month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      params.set("from", start);
      params.set("to", end);
    }
    router.push(`/po?${params.toString()}`);
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 14, right: 14, left: 0, bottom: 0 }}
          onClick={handleClick}
          style={{ cursor: "pointer" }}
        >
          <defs>
            <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3A5A8C" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3A5A8C" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4A6FA5" />
              <stop offset="100%" stopColor="#1E3A5F" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCompact(v)}
            width={50}
          />
          <Tooltip
            cursor={{ stroke: "#3A5A8C", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={<CustomTooltip />}
          />
          <Area
            type="monotone"
            dataKey="spend"
            stroke="url(#trendStroke)"
            strokeWidth={2.5}
            fill="url(#trendArea)"
            dot={{ r: 4, fill: "#fff", stroke: "#3A5A8C", strokeWidth: 2 }}
            activeDot={{
              r: 6, fill: "#3A5A8C", stroke: "#fff", strokeWidth: 2,
              style: { cursor: "pointer" },
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="text-[10px] text-muted-foreground text-center mt-1">
        💡 คลิกที่กราฟเพื่อดู PO ของเดือนนั้น
      </div>
    </div>
  );
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: TrendData }>;
}

function CustomTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-xl shadow-lg p-3 min-w-[160px]">
      <div className="text-[10px] tracking-wider font-bold text-muted-foreground uppercase mb-1.5">
        {d.monthLabel}
      </div>
      <div className="text-base font-extrabold text-foreground tabular-nums">
        ฿{d.spend.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        <span className="font-semibold text-foreground">{d.poCount}</span> ใบ PO
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
