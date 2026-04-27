"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PurchaseOrder } from "@/lib/types/db";

type Period = "7" | "30" | "month" | "year" | "all" | "custom";

const STATUS_COLORS: Record<string, string> = {
  "รอจัดซื้อดำเนินการ": "#94A3B8",
  "สั่งซื้อแล้ว": "#0F6E56",
  "กำลังขนส่ง": "#BA7517",
  "รับของแล้ว": "#1D9E75",
  "มีปัญหา": "#A32D2D",
  "เสร็จสมบูรณ์": "#27500A",
  "ยกเลิก": "#666666",
};

const PIE_COLORS = ["#3A5A8C", "#4A6FA5", "#6388B7", "#8FA8C9", "#A8C0E0",
                    "#1E3A5F", "#2E4D78", "#5C7BA2"];

export function ReportsClient({ pos }: { pos: PurchaseOrder[] }) {
  const [period, setPeriod] = useState<Period>("30");
  const today = new Date();
  const [from, setFrom] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  // Resolve actual date range
  const { start, end } = useMemo(() => {
    const t = today.toISOString().slice(0, 10);
    if (period === "7") {
      const d = new Date(today); d.setDate(d.getDate() - 7);
      return { start: d.toISOString().slice(0, 10), end: t };
    }
    if (period === "30") {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      return { start: d.toISOString().slice(0, 10), end: t };
    }
    if (period === "month") {
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
        end: t,
      };
    }
    if (period === "year") {
      return {
        start: new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10),
        end: t,
      };
    }
    if (period === "all") return { start: "2000-01-01", end: t };
    return { start: from, end: to };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, from, to]);

  const filtered = useMemo(
    () => pos.filter((p) => {
      const d = (p.created_at ?? "").slice(0, 10);
      return d >= start && d <= end;
    }),
    [pos, start, end],
  );

  const valid = filtered.filter((p) => p.status !== "ยกเลิก");

  // Stats
  const totalOrders = filtered.length;
  const completedCount = valid.filter((p) => p.status === "เสร็จสมบูรณ์").length;
  const totalSpend = valid.reduce((s, p) => s + (p.total ?? 0), 0);
  const avgPerOrder = valid.length ? totalSpend / valid.length : 0;

  // Status breakdown
  const statusCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of filtered) m[p.status] = (m[p.status] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Suppliers
  const supplierData = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const p of valid) {
      const s = p.supplier_name || "—";
      const cur = m.get(s) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += p.total ?? 0;
      m.set(s, cur);
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [valid]);

  // Top items
  const topItems = useMemo(() => {
    const m = new Map<string, { qty: number; total: number }>();
    for (const p of valid) {
      for (const it of p.items ?? []) {
        const cur = m.get(it.name) ?? { qty: 0, total: 0 };
        cur.qty += it.qty ?? 0;
        cur.total += it.subtotal ?? 0;
        m.set(it.name, cur);
      }
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [valid]);

  // Daily trend (if range > 7 days)
  const daysInRange = Math.ceil(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400_000,
  );
  const dailyData = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of valid) {
      const d = (p.created_at ?? "").slice(0, 10);
      if (d) m.set(d, (m.get(d) ?? 0) + (p.total ?? 0));
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date: date.slice(5), total }));
  }, [valid]);

  // Export CSV
  function downloadCsv() {
    const headers = [
      "PO", "วันสร้าง", "ผู้สร้าง", "Supplier", "รายการ",
      "ยอดรวม", "ส่วนลด", "ค่าส่ง", "VAT", "รวมสุทธิ",
      "สถานะ", "คาดได้รับ", "ได้รับจริง",
    ];
    const rows = filtered.map((p) => [
      p.po_number,
      (p.created_at ?? "").slice(0, 10),
      p.created_by_name ?? "",
      p.supplier_name ?? "",
      String(p.items?.length ?? 0),
      String(p.subtotal ?? 0),
      String(p.discount ?? 0),
      String(p.shipping_fee ?? 0),
      String(p.vat ?? 0),
      String(p.total ?? 0),
      p.status,
      p.expected_date ?? "",
      p.received_date ?? "",
    ]);
    // BOM + CSV with quote escaping
    const lines = [headers, ...rows].map((row) =>
      row.map((v) => {
        const s = String(v ?? "");
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","),
    );
    const csv = "﻿" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `po_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Filter row */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
            >
              <option value="7">📅 7 วัน</option>
              <option value="30">📅 30 วัน</option>
              <option value="month">📅 เดือนนี้</option>
              <option value="year">📅 ปีนี้</option>
              <option value="all">📅 ทั้งหมด</option>
              <option value="custom">📅 กำหนดเอง</option>
            </select>
            {period === "custom" && (
              <>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                       className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                       className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="📝 PO" value={totalOrders.toLocaleString("th-TH")} />
        <Kpi label="✅ เสร็จสิ้น" value={completedCount.toLocaleString("th-TH")} />
        <Kpi label="💰 ยอดรวม" value={`฿${totalSpend.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`} />
        <Kpi label="📊 เฉลี่ย/ใบ" value={`฿${avgPerOrder.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`} />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              สถานะ PO
            </h3>
            {statusCount.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={statusCount} margin={{ top: 5, right: 5, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {statusCount.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] ?? "#94A3B8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              ยอดสั่งซื้อแยก Supplier (top 8)
            </h3>
            {supplierData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={supplierData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={90}
                      label={(e) => e.name && e.name.length > 12 ? e.name.slice(0, 11) + "…" : e.name}
                      labelLine={false}
                    >
                      {supplierData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => `฿${v.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* Daily trend (if range > 7 days) */}
      {daysInRange > 7 && dailyData.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              📅 ยอดสั่งซื้อรายวัน
            </h3>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: number) => `฿${v.toLocaleString("th-TH")}`}
                  />
                  <Line type="monotone" dataKey="total" stroke="#3A5A8C" strokeWidth={2}
                        dot={{ r: 3, fill: "#3A5A8C" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top suppliers + items table */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              🏭 ตาม Supplier
            </h3>
            {supplierData.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2">Supplier</th>
                    <th className="text-right py-2">จำนวน</th>
                    <th className="text-right py-2">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierData.map((s) => (
                    <tr key={s.name} className="border-b border-slate-100">
                      <td className="py-2 truncate">{s.name}</td>
                      <td className="text-right tabular-nums">{s.count}</td>
                      <td className="text-right tabular-nums font-semibold">
                        ฿{s.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
              📦 Top Items
            </h3>
            {topItems.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-2">รายการ</th>
                    <th className="text-right py-2">จำนวน</th>
                    <th className="text-right py-2">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((it, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 truncate" title={it.name}>{it.name}</td>
                      <td className="text-right tabular-nums">{it.qty.toLocaleString("th-TH")}</td>
                      <td className="text-right tabular-nums font-semibold">
                        ฿{it.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
            📥 Export
          </h3>
          <Button onClick={downloadCsv}>
            <Download className="h-4 w-4" /> ดาวน์โหลด CSV ({filtered.length} ใบ)
          </Button>
          <p className="text-xs text-slate-500 mt-2">
            UTF-8 with BOM — เปิดด้วย Excel ภาษาไทยถูกต้อง
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className="text-xl font-bold text-slate-900 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-72 flex items-center justify-center text-sm text-slate-400">
      ไม่มีข้อมูลในช่วงเวลานี้
    </div>
  );
}
