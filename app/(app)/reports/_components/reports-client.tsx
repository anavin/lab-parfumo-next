"use client";

/**
 * Reports — premium B2B redesign
 * Filter pills + colored KPI hero + clean charts + sortable tables
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Download, FileText, CheckCircle2, Banknote, BarChart3,
  Calendar, TrendingUp, TrendingDown, Building2, Package,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PurchaseOrder, PoStatus } from "@/lib/types/db";

type Period = "7" | "30" | "month" | "year" | "all" | "custom";

const PERIOD_LABEL: Record<Period, string> = {
  "7": "7 วันล่าสุด",
  "30": "30 วันล่าสุด",
  "month": "เดือนนี้",
  "year": "ปีนี้",
  "all": "ทั้งหมด",
  "custom": "กำหนดเอง",
};

const STATUS_COLORS: Record<PoStatus, string> = {
  "รอจัดซื้อดำเนินการ": "#F59E0B",  // amber
  "สั่งซื้อแล้ว":      "#3B82F6",  // blue
  "กำลังขนส่ง":         "#6366F1",  // indigo
  "รับของแล้ว":         "#06B6D4",  // cyan
  "มีปัญหา":            "#DC2626",  // red
  "เสร็จสมบูรณ์":       "#059669",  // emerald
  "ยกเลิก":             "#94A3B8",  // slate
};

const PIE_COLORS = [
  "#3A5A8C", "#2563EB", "#7C3AED", "#0891B2", "#059669",
  "#D97706", "#DC2626", "#94A3B8",
];

export function ReportsClient({ pos }: { pos: PurchaseOrder[] }) {
  const today = new Date();
  const [period, setPeriod] = useState<Period>("30");
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

  // Previous period (for comparison)
  const prevRange = useMemo(() => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400_000));
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days);
    return {
      start: prevStart.toISOString().slice(0, 10),
      end: prevEnd.toISOString().slice(0, 10),
    };
  }, [start, end]);

  const filtered = useMemo(
    () => pos.filter((p) => {
      const d = (p.created_at ?? "").slice(0, 10);
      return d >= start && d <= end;
    }),
    [pos, start, end],
  );

  const valid = filtered.filter((p) => p.status !== "ยกเลิก");

  // Previous period stats for trend
  const prevValid = useMemo(() => {
    return pos
      .filter((p) => {
        const d = (p.created_at ?? "").slice(0, 10);
        return d >= prevRange.start && d <= prevRange.end;
      })
      .filter((p) => p.status !== "ยกเลิก");
  }, [pos, prevRange]);

  const totalOrders = filtered.length;
  const completedCount = valid.filter((p) => p.status === "เสร็จสมบูรณ์").length;
  const problemCount = filtered.filter((p) => p.status === "มีปัญหา").length;
  const totalSpend = valid.reduce((s, p) => s + (p.total ?? 0), 0);
  const avgPerOrder = valid.length ? totalSpend / valid.length : 0;

  const prevSpend = prevValid.reduce((s, p) => s + (p.total ?? 0), 0);
  const spendDelta = prevSpend > 0 ? ((totalSpend - prevSpend) / prevSpend) * 100 : 0;

  const prevOrders = prevValid.length;
  const ordersDelta = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

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

  // Daily trend
  const daysInRange = Math.ceil(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400_000,
  );
  const dailyData = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const p of valid) {
      const d = (p.created_at ?? "").slice(0, 10);
      if (d) {
        const cur = m.get(d) ?? { total: 0, count: 0 };
        cur.total += p.total ?? 0;
        cur.count += 1;
        m.set(d, cur);
      }
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: date.slice(5),
        total: v.total,
        count: v.count,
      }));
  }, [valid]);

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
      {/* Period filter — equal-width pills */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              ช่วงเวลา
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {start} → {end} · <strong className="text-foreground">{filtered.length}</strong> ใบ
            </div>
          </div>

          {/* Pills — equal width via grid */}
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            }}
          >
            {(["7", "30", "month", "year", "all", "custom"] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold transition-all ${
                  period === p
                    ? "bg-gradient-to-br from-primary to-brand-900 text-white shadow-sm"
                    : "bg-card border border-border text-foreground hover:bg-accent hover:-translate-y-0.5 hover:shadow-sm"
                }`}
              >
                <span className="truncate">{PERIOD_LABEL[p]}</span>
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {period === "custom" && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground">จาก</span>
              <input
                type="date" value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-xs text-muted-foreground">ถึง</span>
              <input
                type="date" value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI hero — 4 colored cards with delta vs previous period */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={FileText}
          label="PO ทั้งหมด"
          value={totalOrders.toLocaleString("th-TH")}
          unit="ใบ"
          delta={ordersDelta}
          color="primary"
        />
        <KpiCard
          icon={CheckCircle2}
          label="เสร็จสมบูรณ์"
          value={completedCount.toLocaleString("th-TH")}
          unit="ใบ"
          subtitle={totalOrders > 0 ? `${((completedCount / totalOrders) * 100).toFixed(0)}% ของทั้งหมด` : undefined}
          color="emerald"
        />
        <KpiCard
          icon={Banknote}
          label="ยอดรวม"
          value={fmtMoney(totalSpend)}
          unit="บาท"
          delta={spendDelta}
          color="amber"
        />
        <KpiCard
          icon={BarChart3}
          label="เฉลี่ยต่อใบ"
          value={fmtMoney(avgPerOrder)}
          unit="บาท"
          subtitle={problemCount > 0 ? `⚠️ มีปัญหา ${problemCount} ใบ` : undefined}
          color={problemCount > 0 ? "red" : "indigo"}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Status — 3 cols */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <SectionHeader
              icon={<BarChart3 className="size-4" />}
              title="สถานะ PO"
              subtitle="แยกตามสถานะปัจจุบัน"
            />
            {statusCount.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={statusCount} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} angle={-25} textAnchor="end" height={60} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<StatusTooltip />} cursor={{ fill: "#F1F5F9" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {statusCount.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name as PoStatus] ?? "#94A3B8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Top suppliers donut — 2 cols */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <SectionHeader
              icon={<Building2 className="size-4" />}
              title="Top Suppliers"
              subtitle="สัดส่วนยอดสั่งซื้อ"
            />
            {supplierData.length > 0 ? (
              <div className="h-72 relative">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={supplierData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius="55%"
                      outerRadius="88%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {supplierData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} className="hover:opacity-80 transition-opacity" />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip total={totalSpend} />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[10px] tracking-wider font-bold text-muted-foreground uppercase">
                    ยอดรวม
                  </div>
                  <div className="text-base font-extrabold text-foreground tabular-nums">
                    {fmtMoneyCompact(totalSpend)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {supplierData.length} ราย
                  </div>
                </div>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* Daily trend (area chart) */}
      {daysInRange > 7 && dailyData.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <SectionHeader
              icon={<TrendingUp className="size-4" />}
              title="ยอดสั่งซื้อรายวัน"
              subtitle={`${daysInRange} วัน`}
            />
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3A5A8C" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3A5A8C" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoneyCompact(v)} />
                  <Tooltip content={<DailyTooltip />} cursor={{ stroke: "#3A5A8C", strokeWidth: 1, strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="total" stroke="#3A5A8C" strokeWidth={2.5} fill="url(#reportArea)" dot={{ r: 3, fill: "#fff", stroke: "#3A5A8C", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tables row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Suppliers table */}
        <Card>
          <CardContent className="p-5">
            <SectionHeader
              icon={<Building2 className="size-4" />}
              title="Supplier ทั้งหมด"
              subtitle={`${supplierData.length} ราย`}
            />
            {supplierData.length > 0 ? (
              <div className="space-y-1.5">
                {supplierData.map((s, i) => {
                  const pct = totalSpend > 0 ? (s.total / totalSpend) * 100 : 0;
                  return (
                    <Link
                      key={s.name}
                      href={`/po?search=${encodeURIComponent(s.name)}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                      title={`ดู PO ทั้งหมดของ ${s.name}`}
                    >
                      <span
                        className="size-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors" title={s.name}>
                          {s.name}
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold tabular-nums text-foreground">
                          ฿{s.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {pct.toFixed(0)}% · {s.count} ใบ
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : <EmptyChart small />}
          </CardContent>
        </Card>

        {/* Top items table */}
        <Card>
          <CardContent className="p-5">
            <SectionHeader
              icon={<Package className="size-4" />}
              title="Top สินค้าที่สั่ง"
              subtitle={`${topItems.length} รายการแรก`}
            />
            {topItems.length > 0 ? (
              <div className="space-y-1.5">
                {topItems.map((it, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate" title={it.name}>
                        {it.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                        จำนวน <span className="font-semibold text-foreground">{it.qty.toLocaleString("th-TH")}</span> ชิ้น
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold tabular-nums text-foreground">
                        ฿{it.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyChart small />}
          </CardContent>
        </Card>
      </div>

      {/* Export */}
      <Card className="bg-gradient-to-br from-brand-50/30 to-blue-50/20 border-primary/20">
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="size-12 rounded-2xl bg-gradient-to-br from-primary to-brand-900 text-white flex items-center justify-center shadow-md">
            <Download className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground">
              ดาวน์โหลดข้อมูลดิบ (CSV)
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              ไฟล์ Excel-compatible พร้อม UTF-8 BOM — รองรับภาษาไทย
            </div>
          </div>
          <Button onClick={downloadCsv}>
            <Download className="size-4" /> CSV ({filtered.length} ใบ)
          </Button>
        </CardContent>
      </Card>
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
  indigo: { gradient: "bg-gradient-to-br from-indigo-500 to-violet-600", ring: "ring-indigo-200" },
};

function KpiCard({
  icon: Icon, label, value, unit, delta, subtitle, color,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  subtitle?: string;
  color: keyof typeof KPI_TONE;
}) {
  const tone = KPI_TONE[color];
  const showDelta = delta !== undefined && Number.isFinite(delta) && delta !== 0;
  const isUp = (delta ?? 0) > 0;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-2 shadow-md text-white ${tone.gradient} ${tone.ring}`}>
          <Icon className="size-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
            {label}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold tabular-nums text-foreground leading-none">
              {value}
            </span>
            {unit && (
              <span className="text-[11px] font-medium text-muted-foreground">{unit}</span>
            )}
          </div>
          {showDelta && (
            <div className={`inline-flex items-center gap-0.5 text-[10px] font-bold mt-0.5 ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
              {isUp ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
              <span className="tabular-nums">
                {isUp ? "+" : ""}{delta!.toFixed(1)}% เทียบช่วงก่อน
              </span>
            </div>
          )}
          {subtitle && !showDelta && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// Helpers
// ==================================================================
function SectionHeader({
  icon, title, subtitle, action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-border/40">
      <div className="flex items-center gap-2.5">
        <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyChart({ small }: { small?: boolean } = {}) {
  return (
    <div className={`${small ? "py-8" : "h-72"} flex flex-col items-center justify-center text-center text-sm text-muted-foreground`}>
      <AlertTriangle className="size-8 text-muted-foreground/50 mb-2" />
      <div>ไม่มีข้อมูลในช่วงเวลานี้</div>
      <div className="text-xs mt-1">ลองเปลี่ยนช่วงเวลาด้านบน</div>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name?: string; value?: number; date?: string; total?: number; count?: number } }>;
}

function StatusTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
      <div className="text-xs font-bold text-foreground">{d.name}</div>
      <div className="text-base font-extrabold tabular-nums mt-1">
        {(d.value ?? 0).toLocaleString("th-TH")} ใบ
      </div>
    </div>
  );
}

function DailyTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
      <div className="text-xs text-muted-foreground">{d.date}</div>
      <div className="text-base font-extrabold tabular-nums mt-1">
        ฿{(d.total ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        <span className="font-semibold text-foreground">{d.count}</span> ใบ
      </div>
    </div>
  );
}

interface DonutTipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; total: number; count: number } }>;
  total: number;
}

function DonutTooltip({ active, payload, total }: DonutTipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total > 0 ? (d.total / total) * 100 : 0;
  return (
    <div className="bg-popover border border-border rounded-xl shadow-lg p-3 min-w-[180px]">
      <div className="text-sm font-bold text-foreground truncate">{d.name}</div>
      <div className="text-base font-extrabold tabular-nums mt-1">
        ฿{d.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
      </div>
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
        <span className="font-semibold tabular-nums">{pct.toFixed(1)}%</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="tabular-nums">{d.count} ใบ</span>
      </div>
    </div>
  );
}

function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}
