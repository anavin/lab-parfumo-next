"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { Budget } from "@/lib/types/db";
import { upsertBudgetAction, deleteBudgetAction } from "@/lib/actions/budget";

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function BudgetSettings({
  year, allBudgets, categories,
}: {
  year: number;
  allBudgets: Budget[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteBudgetAction(id);
      setConfirmDel(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Add button */}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" /> ตั้งงบใหม่
        </Button>
      </div>

      {error && <Alert tone="danger">❌ {error}</Alert>}

      {/* List */}
      {allBudgets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            ยังไม่มีงบประมาณสำหรับปี {year} — กดปุ่ม "ตั้งงบใหม่"
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {allBudgets.map((b) => {
            const periodLabel = b.period_type === "monthly"
              ? `${MONTH_NAMES[(b.period_month ?? 1) - 1]} ${b.period_year}`
              : b.period_type === "quarterly"
                ? `Q${Math.floor(((b.period_month ?? 1) - 1) / 3) + 1} ปี ${b.period_year}`
                : `ปี ${b.period_year}`;
            return (
              <Card key={b.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-900">
                        {b.category ? `📂 ${b.category}` : "📂 รวมทั้งหมด"}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {b.period_type === "monthly" ? "📅 รายเดือน" :
                         b.period_type === "quarterly" ? "📅 รายไตรมาส" : "📅 รายปี"}
                        {" • "} {periodLabel}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-brand-700 tabular-nums">
                        ฿{b.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    {confirmDel === b.id ? (
                      <Button variant="primary" size="sm" loading={pending}
                              onClick={() => handleDelete(b.id)}
                              className="!from-red-600 !to-red-700">
                        ⚠️ ยืนยัน
                      </Button>
                    ) : (
                      <button type="button"
                              onClick={() => setConfirmDel(b.id)}
                              disabled={pending}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 inline-flex items-center justify-center"
                              aria-label="ลบ">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      {showAdd && (
        <AddBudgetDialog
          year={year}
          categories={categories}
          onClose={() => setShowAdd(false)}
          onError={setError}
        />
      )}
    </div>
  );
}

function AddBudgetDialog({
  year, categories, onClose, onError,
}: {
  year: number;
  categories: string[];
  onClose: () => void;
  onError: (e: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [periodType, setPeriodType] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [yearVal, setYearVal] = useState(year);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState(1);
  const [category, setCategory] = useState<string>("");  // "" = ทั้งหมด
  const [amount, setAmount] = useState(100000);
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    startTransition(async () => {
      const monthVal = periodType === "monthly" ? month
        : periodType === "quarterly" ? (quarter - 1) * 3 + 1
          : null;
      const res = await upsertBudgetAction({
        periodType,
        year: yearVal,
        month: monthVal,
        category: category || null,
        amount,
        notes,
      });
      if (!res.ok) {
        onError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">💰 ตั้งงบประมาณ</h2>
          <button type="button" onClick={onClose} disabled={pending}
                  className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ประเภท</label>
            <select value={periodType}
                    onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
                    className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm">
              <option value="monthly">📅 รายเดือน</option>
              <option value="quarterly">📅 รายไตรมาส</option>
              <option value="yearly">📅 รายปี</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ปี</label>
              <input type="number" min="2020" max="2099"
                     value={yearVal}
                     onChange={(e) => setYearVal(parseInt(e.target.value, 10) || year)}
                     disabled={pending}
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums" />
            </div>
            {periodType === "monthly" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">เดือน</label>
                <select value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm">
                  {MONTH_NAMES.map((n, i) => (
                    <option key={i} value={i + 1}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            {periodType === "quarterly" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ไตรมาส</label>
                <select value={quarter}
                        onChange={(e) => setQuarter(parseInt(e.target.value, 10))}
                        className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm">
                  <option value="1">Q1 (ม.ค.-มี.ค.)</option>
                  <option value="2">Q2 (เม.ย.-มิ.ย.)</option>
                  <option value="3">Q3 (ก.ค.-ก.ย.)</option>
                  <option value="4">Q4 (ต.ค.-ธ.ค.)</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">หมวด</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm">
              <option value="">📂 รวมทั้งหมด</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">งบประมาณ (฿)</label>
            <input type="number" min="0" step="1000"
                   value={amount === 0 ? "" : amount}
                   onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                   onFocus={(e) => e.currentTarget.select()}
                   placeholder="0"
                   disabled={pending}
                   className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-base font-bold tabular-nums" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุ</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)}
                   placeholder="(ถ้ามี)" disabled={pending} />
          </div>
        </div>

        <div className="flex gap-2 p-5 pt-3 border-t border-slate-200">
          <Button onClick={handleSubmit} loading={pending}>
            💾 บันทึก
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  );
}
