"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download, CheckCircle2, AlertTriangle, ExternalLink, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { markReimbursedAction, unmarkReimbursedAction } from "@/lib/actions/po-payments";
import type { MyPaymentRow, PayerAging } from "@/lib/db/po-payments";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit", calendar: "gregory",
  });
}
function fmtBaht(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Group payments by payment_group_id (null = own group) */
function groupPayments(payments: MyPaymentRow[]) {
  const map = new Map<string, MyPaymentRow[]>();
  for (const p of payments) {
    const key = p.payment_group_id ?? `single:${p.id}`;
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([groupKey, group]) => ({
    groupKey,
    isGroup: !groupKey.startsWith("single:"),
    payments: group,
    paidDate: group[0].paid_date,
    card: group[0].card_display,
    totalAmount: group.reduce((s, p) => s + Number(p.amount), 0),
  }));
}

export function MyPaymentsClient({
  payments,
  isAdmin,
  targetUserId,
  targetUserName,
  currentReimbursedFilter,
  currentFrom,
  currentTo,
  allUsers,
  aging,
}: {
  payments: MyPaymentRow[];
  isAdmin: boolean;
  targetUserId: string;
  targetUserName: string;
  currentReimbursedFilter: string;
  currentFrom: string;
  currentTo: string;
  allUsers: Array<{ id: string; full_name: string }>;
  aging: PayerAging[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markingBulk, setMarkingBulk] = useState(false);
  const [markDate, setMarkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markRef, setMarkRef] = useState("");

  const groups = useMemo(() => groupPayments(payments), [payments]);
  const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPayments = payments.length;
  const selectedAmount = payments
    .filter((p) => selected.has(p.id))
    .reduce((s, p) => s + Number(p.amount), 0);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(ids: string[]) {
    setSelected((cur) => {
      const next = new Set(cur);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === payments.length) setSelected(new Set());
    else setSelected(new Set(payments.map((p) => p.id)));
  }

  function pushFilter(patch: Partial<{ reimbursed: string; from: string; to: string; user: string }>) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "") url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    // Clear selected — stale IDs after filter change would apply to invisible rows
    setSelected(new Set());
    router.push(url.pathname + url.search, { scroll: false });
  }

  function handleMarkBulk() {
    if (selected.size === 0) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(markDate)) {
      toast.error("รูปแบบวันที่ไม่ถูกต้อง");
      return;
    }
    start(async () => {
      const r = await markReimbursedAction({
        paymentIds: Array.from(selected),
        reimbursedDate: markDate,
        reimbursementRef: markRef.trim() || undefined,
      });
      if (r.ok) {
        toast.success(`✅ Mark เบิกแล้ว ${r.count} รายการ`);
        setSelected(new Set());
        setMarkingBulk(false);
        setMarkRef("");
        router.refresh();
      } else toast.error(r.error ?? "Mark ไม่สำเร็จ");
    });
  }

  function handleUnmarkBulk() {
    if (selected.size === 0) return;
    if (typeof window !== "undefined" && !window.confirm(`Undo mark ${selected.size} รายการ?`)) return;
    start(async () => {
      const r = await unmarkReimbursedAction({ paymentIds: Array.from(selected) });
      if (r.ok) {
        toast.success(`↩️ Undo แล้ว ${r.count} รายการ`);
        setSelected(new Set());
        router.refresh();
      } else toast.error(r.error ?? "Undo ไม่สำเร็จ");
    });
  }

  function exportCsv() {
    if (payments.length === 0) {
      toast.warning("ไม่มีข้อมูลให้ export");
      return;
    }
    const header = [
      "รอบ_group",
      "วันที่รูด",
      "บัตร",
      "คนจ่าย",              // added — เผื่อ admin export หลายคน
      "PO",
      "supplier",
      "จำนวน",
      "reimbursed",
      "reimbursed_date",
      "reimbursement_ref",
      "notes",
    ];
    // formula-injection guard (matches /api/po/export pattern)
    const safeCell = (v: unknown): string => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = payments.map((p) => [
      p.payment_group_id ?? "(single)",
      p.paid_date,
      p.card_display ?? "",
      p.paid_by_name,
      p.po_number,
      p.po_supplier_name ?? "",
      p.amount,
      p.reimbursed ? "yes" : "no",
      p.reimbursed_date ?? "",
      p.reimbursement_ref ?? "",
      p.notes ?? "",
    ]);
    const csv = "﻿" + [header, ...rows].map((r) => r.map(safeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${targetUserName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`📥 Export ${payments.length} รายการเรียบร้อย`);
  }

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="รายการทั้งหมด (ตาม filter)"
          value={totalPayments.toString()}
          unit="รายการ"
        />
        <StatCard
          label="ยอดรวม"
          value={`฿${fmtBaht(totalAmount)}`}
        />
        <StatCard
          label={selected.size > 0 ? `เลือกไว้ ${selected.size}` : "เลือกเพื่อ export/mark"}
          value={selected.size > 0 ? `฿${fmtBaht(selectedAmount)}` : "—"}
          tone={selected.size > 0 ? "brand" : "muted"}
        />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          {isAdmin && (
            <select
              value={targetUserId}
              onChange={(e) => pushFilter({ user: e.target.value })}
              className="px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          )}
          <select
            value={currentReimbursedFilter}
            onChange={(e) => pushFilter({ reimbursed: e.target.value })}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
          >
            <option value="no">ยังไม่เบิก</option>
            <option value="yes">เบิกแล้ว</option>
            <option value="all">ทั้งหมด</option>
          </select>
          <div className="flex items-center gap-1 text-sm">
            <input
              type="date"
              value={currentFrom}
              onChange={(e) => pushFilter({ from: e.target.value })}
              className="px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={currentTo}
              onChange={(e) => pushFilter({ to: e.target.value })}
              className="px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
          {(currentFrom || currentTo || currentReimbursedFilter !== "no") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pushFilter({ reimbursed: "no", from: "", to: "" })}
            >
              ล้าง filter
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={payments.length === 0}>
              <Download className="size-3.5" /> Export CSV
            </Button>
            {isAdmin && selected.size > 0 && (
              <>
                {payments.filter((p) => selected.has(p.id)).some((p) => !p.reimbursed) && (
                  <Button size="sm" onClick={() => setMarkingBulk(true)}>
                    <CheckCircle2 className="size-3.5" /> Mark เบิกแล้ว ({selected.size})
                  </Button>
                )}
                {payments.filter((p) => selected.has(p.id)).some((p) => p.reimbursed) && (
                  <Button variant="outline" size="sm" onClick={handleUnmarkBulk}>
                    ↩️ Undo ({selected.size})
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aging (admin only, when viewing own or general) */}
      {isAdmin && aging.length > 0 && (
        <Card className="border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2 inline-flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> Aging — ยอดค้างเบิกต่อพนักงาน
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              {aging.slice(0, 12).map((a) => (
                <button
                  key={a.paid_by_user_id}
                  onClick={() => pushFilter({ user: a.paid_by_user_id, reimbursed: "no" })}
                  className="text-left border border-slate-200 rounded px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-medium">{a.paid_by_name}</span>
                    <span className="font-mono font-bold text-red-700">฿{fmtBaht(a.total_amount)}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {a.count} รายการ · ค้างสุด {a.days_oldest} วัน
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups list */}
      {payments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            <p className="text-4xl mb-2">💳</p>
            <p className="text-sm">ไม่พบ payments ตาม filter — ลองเปลี่ยนช่วงวันที่</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 text-sm">
              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === payments.length}
                  onChange={toggleAll}
                />
                เลือกทั้งหมด ({payments.length})
              </label>
              <span className="text-xs text-slate-500">
                จัดกลุ่มตามการรูด (payment_group)
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {groups.map((g) => (
                <div key={g.groupKey} className="p-4">
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <input
                      type="checkbox"
                      checked={g.payments.every((p) => selected.has(p.id))}
                      onChange={() => toggleGroup(g.payments.map((p) => p.id))}
                    />
                    <span className="font-mono font-semibold text-slate-500">
                      📅 {fmtDate(g.paidDate)}
                    </span>
                    <span className="text-slate-700">· {g.card ?? "-"}</span>
                    {g.isGroup ? (
                      <span className="text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        🔗 รูดครั้งเดียว · {g.payments.length} PO
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">รูดเดี่ยว</span>
                    )}
                    <span className="ml-auto font-mono font-bold">฿{fmtBaht(g.totalAmount)}</span>
                  </div>
                  <div className="pl-6 space-y-1.5">
                    {g.payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                        />
                        <Link
                          href={`/po/${p.po_id}`}
                          className="font-mono text-brand-700 hover:underline font-semibold"
                        >
                          {p.po_number}
                        </Link>
                        <span className="text-slate-600 truncate max-w-[300px]">
                          · {p.po_supplier_name ?? "-"}
                        </span>
                        <span className="ml-auto font-mono">฿{fmtBaht(Number(p.amount))}</span>
                        {p.reimbursed ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> เบิก {p.reimbursed_date && fmtDate(p.reimbursed_date)}
                          </span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                            รอเบิก
                          </span>
                        )}
                        {p.slip_url && (
                          <a
                            href={p.slip_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-brand-700"
                            title="ดูสลิป"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal: Bulk mark */}
      {markingBulk && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          onClick={() => setMarkingBulk(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold">Mark เบิกแล้ว · {selected.size} รายการ</h3>
              <button onClick={() => setMarkingBulk(false)} className="text-slate-400">
                <X className="size-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              ยอดรวม ฿{fmtBaht(selectedAmount)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">วันที่โอนคืน *</label>
                <input
                  type="date"
                  value={markDate}
                  onChange={(e) => setMarkDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">เลขอ้างอิง / หมายเหตุ</label>
                <input
                  value={markRef}
                  onChange={(e) => setMarkRef(e.target.value)}
                  placeholder="เช่น สลิปโอน 20260908-1234 (แสดงกับทุก payment ที่เลือก)"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setMarkingBulk(false)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button onClick={handleMarkBulk} disabled={pending}>
                {pending ? "กำลังบันทึก..." : `ยืนยัน · ${selected.size} รายการ`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  label, value, unit, tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "brand" | "muted";
}) {
  const toneClass =
    tone === "brand" ? "text-brand-700"
      : tone === "muted" ? "text-slate-400"
        : "text-slate-900";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`font-mono text-2xl font-bold mt-1 ${toneClass}`}>
          {value}
          {unit && <span className="text-slate-500 text-xs font-normal ml-1">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  );
}
