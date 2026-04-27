"use client";

/**
 * Top suppliers chart — แท่งแนวนอน (horizontal bar)
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";

interface SupplierData {
  name: string;
  spend: number;
  poCount: number;
}

const COLORS = ["#1E3A5F", "#2E4D78", "#3A5A8C", "#4A6FA5", "#6388B7"];

export function SuppliersChart({ data }: { data: SupplierData[] }) {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400">
        ยังไม่มีข้อมูล supplier
      </div>
    );
  }

  // ตัดชื่อยาวให้สั้น
  const truncated = data.map((d) => ({
    ...d,
    short: d.name.length > 18 ? `${d.name.slice(0, 17)}…` : d.name,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart
          data={truncated}
          layout="vertical"
          margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCompact(v)}
          />
          <YAxis
            dataKey="short"
            type="category"
            tick={{ fontSize: 11, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "#F4F7FB" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              fontSize: 12,
            }}
            formatter={(value: number, _name, item) => [
              `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })} • ${item.payload.poCount} ใบ`,
              item.payload.name,
            ]}
            labelFormatter={() => ""}
          />
          <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
            {truncated.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
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
