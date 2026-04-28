"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Search, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Withdrawal } from "@/lib/types/db";
import { deleteWithdrawalAction } from "@/lib/actions/withdraw";

export function WithdrawHistory({
  withdrawals, isAdmin, currentUserId,
}: {
  withdrawals: Withdrawal[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let out = withdrawals;
    if (scope === "mine") {
      out = out.filter((w) => w.withdrawn_by === currentUserId);
    }
    if (period !== "all") {
      const days = parseInt(period, 10);
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      out = out.filter((w) => (w.withdrawn_at ?? "") >= cutoff);
    }
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((w) =>
        (w.equipment_name ?? "").toLowerCase().includes(s) ||
        (w.purpose ?? "").toLowerCase().includes(s) ||
        (w.withdrawn_by_name ?? "").toLowerCase().includes(s),
      );
    }
    return out;
  }, [withdrawals, period, scope, search, currentUserId]);

  // Summary
  const totalQty = filtered.reduce((s, w) => s + (w.qty ?? 0), 0);
  const uniqueEq = new Set(filtered.map((w) => w.equipment_id)).size;

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteWithdrawalAction(id, true);
      if (res.ok) {
        setConfirmDel(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          {isAdmin && (
            <select
              className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
            >
              <option value="mine">👤 ของฉัน</option>
              <option value="all">👥 ทุกคน</option>
            </select>
          )}
          <select
            className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="7">📅 7 วันล่าสุด</option>
            <option value="30">📅 30 วันล่าสุด</option>
            <option value="90">📅 90 วันล่าสุด</option>
            <option value="all">📅 ทั้งหมด</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="ค้นหาชื่อสินค้า / วัตถุประสงค์ / ผู้เบิก"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="ครั้ง" value={filtered.length.toLocaleString("th-TH")} />
          <SummaryCard label="รวมจำนวน" value={totalQty.toLocaleString("th-TH")} />
          <SummaryCard label="สินค้าที่เบิก" value={uniqueEq.toLocaleString("th-TH")} />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📦"
          title="ยังไม่มีประวัติการเบิก"
          text="ลองเปลี่ยนช่วงเวลา หรือเริ่มเบิกของจาก tab 'เบิกใหม่'"
        />
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-600">พบ <strong>{filtered.length}</strong> รายการ</div>
          {filtered.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-3">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-4">
                    <div className="font-semibold text-sm text-slate-900">📦 {w.equipment_name}</div>
                    {w.purpose && (
                      <div className="text-xs text-slate-500 mt-0.5">📝 {w.purpose}</div>
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-2 text-right text-brand-700 font-semibold tabular-nums">
                    ➖ {w.qty.toLocaleString("th-TH")} {w.unit}
                  </div>
                  <div className="col-span-4 sm:col-span-2 text-xs text-slate-500">
                    <Calendar className="inline h-3 w-3 mr-1" />
                    {fmtDate(w.withdrawn_at)}
                  </div>
                  <div className="col-span-3 sm:col-span-3 text-xs text-slate-500 truncate">
                    👤 {w.withdrawn_by_name}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {isAdmin && (
                      confirmDel === w.id ? (
                        <Button
                          variant="primary" size="sm"
                          loading={pending}
                          onClick={() => handleDelete(w.id)}
                          className="!from-red-600 !to-red-700"
                          title="ยืนยันลบ + คืนสต็อก"
                        >
                          ⚠️
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDel(w.id)}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 inline-flex items-center justify-center"
                          aria-label="ลบ"
                          title="ลบ + คืนสต็อก"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className="text-xl font-bold text-slate-900 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit", month: "short", year: "2-digit",
    });
  } catch {
    return String(d).slice(0, 10);
  }
}
