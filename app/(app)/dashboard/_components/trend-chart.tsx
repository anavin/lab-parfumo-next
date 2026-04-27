"use client";

/**
 * Trend chart — ยอดซื้อย้อนหลัง 6 เดือน
 * (Bar chart, brand color)
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";

interface TrendData {
  monthLabel: string;
  spend: number;
  poCount: number;
}

export function TrendChart({ data }: { data: TrendData[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            cursor={{ fill: "#F4F7FB" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`,
              "ยอดซื้อ",
            ]}
          />
          <Bar
            dataKey="spend"
            fill="url(#brandGrad)"
            radius={[6, 6, 0, 0]}
          />
          <defs>
            <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4A6FA5" />
              <stop offset="100%" stopColor="#3A5A8C" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
