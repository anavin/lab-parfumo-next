"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Wallet, FolderOpen, Calendar, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import type { Budget } from "@/lib/types/db";
import { upsertBudgetAction, deleteBudgetAction } from "@/lib/actions/budget";

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const PERIOD_VISUAL: Record<Budget["period_type"], {
  label: string;
  bg: string;
  text: string;
  ring: string;
}> = {
  monthly: { label: "รายเดือน", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  quarterly: { label: "รายไตรมาส", bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
  yearly: { label: "รายปี", bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
};

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
  const [delTarget, setDelTarget] = useState<Budget | null>(null);

  function handleDelete() {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteBudgetAction(delTarget.id);
      if (res.ok) {
        toast.success(`✅ ลบงบประมาณแล้ว`);
        setDelTarget(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-foreground">
              งบประมาณที่ตั้งไว้
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allBudgets.length} รายการ · ปี {year}
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="size-4" /> ตั้งงบใหม่
          </Button>
        </div>

        {/* List */}
        {allBudgets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="size-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3">
                <Wallet className="size-6" />
              </div>
              <div className="font-semibold text-foreground">
                ยังไม่มีงบประมาณสำหรับปี {year}
              </div>
              <div className="text-xs text-muted-foreground mt-1 mb-4">
                ตั้งงบเพื่อให้ระบบช่วยติดตาม spending vs budget แต่ละเดือน
              </div>
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="size-4" /> ตั้งงบใหม่
              </Button>
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
              const visual = PERIOD_VISUAL[b.period_type];

              return (
                <div
                  key={b.id}
                  className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Icon badge */}
                    <div className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-1 ${visual.bg} ${visual.text} ${visual.ring}`}>
                      <FolderOpen className="size-5" strokeWidth={2.25} />
                    </div>

                    {/* Main */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-bold text-sm text-foreground">
                          {b.category ? b.category : "รวมทุกหมวด"}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ${visual.bg} ${visual.text} ${visual.ring}`}>
                          {visual.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                        <Calendar className="size-3" />
                        {periodLabel}
                      </div>
                      {b.notes && (
                        <div className="text-xs text-muted-foreground mt-1 inline-flex items-start gap-1 max-w-md">
                          <MessageSquare className="size-3 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{b.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-extrabold text-foreground tabular-nums">
                        ฿{b.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">บาท</div>
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setDelTarget(b)}
                      disabled={pending}
                      className="size-9 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 inline-flex items-center justify-center transition-colors disabled:opacity-50"
                      aria-label="ลบงบประมาณ"
                      title="ลบงบประมาณ"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
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
          />
        )}
      </div>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="ลบงบประมาณ?"
        description={
          delTarget ? (
            <>
              <strong>{delTarget.category || "รวมทุกหมวด"}</strong>{" "}
              · {PERIOD_VISUAL[delTarget.period_type].label}{" "}
              · ฿{delTarget.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
              <br />
              ลบแล้วจะไม่กระทบการคำนวณย้อนหลัง แต่ระบบจะหยุด track งบนี้ไป
            </>
          ) : null
        }
        confirmText="ลบ"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ==================================================================
// Add Budget Dialog
// ==================================================================
function AddBudgetDialog({
  year, categories, onClose,
}: {
  year: number;
  categories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [periodType, setPeriodType] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [yearVal, setYearVal] = useState(year);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState(100000);
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    setError(null);
    if (amount <= 0) {
      setError("กรอกจำนวนงบมากกว่า 0");
      return;
    }
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
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success(`✅ ตั้งงบ ฿${amount.toLocaleString("th-TH")} แล้ว`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="size-4" strokeWidth={2.25} />
            </span>
            ตั้งงบประมาณใหม่
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Period type — segmented */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              ประเภทงบ
            </label>
            <div className="grid grid-cols-3 gap-1 bg-muted rounded-lg p-1">
              {(["monthly", "quarterly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodType(p)}
                  className={`h-9 rounded-md text-xs font-semibold transition-all ${
                    periodType === p
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "monthly" ? "รายเดือน" : p === "quarterly" ? "รายไตรมาส" : "รายปี"}
                </button>
              ))}
            </div>
          </div>

          {/* Year + period detail */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">ปี</label>
              <input
                type="number" min="2020" max="2099"
                value={yearVal}
                onChange={(e) => setYearVal(parseInt(e.target.value, 10) || year)}
                onFocus={(e) => e.currentTarget.select()}
                disabled={pending}
                className="h-10 w-full px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {periodType === "monthly" && (
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">เดือน</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                  disabled={pending}
                  className="h-10 w-full px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary"
                >
                  {MONTH_NAMES.map((n, i) => (
                    <option key={i} value={i + 1}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            {periodType === "quarterly" && (
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">ไตรมาส</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(parseInt(e.target.value, 10))}
                  disabled={pending}
                  className="h-10 w-full px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary"
                >
                  <option value="1">Q1 (ม.ค.–มี.ค.)</option>
                  <option value="2">Q2 (เม.ย.–มิ.ย.)</option>
                  <option value="3">Q3 (ก.ค.–ก.ย.)</option>
                  <option value="4">Q4 (ต.ค.–ธ.ค.)</option>
                </select>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">หมวดสินค้า</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={pending}
              className="h-10 w-full px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary"
            >
              <option value="">📂 รวมทุกหมวด</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="text-[11px] text-muted-foreground mt-1">
              เลือกหมวดเฉพาะ → ระบบเช็คเฉพาะ PO ที่ใช้สินค้าหมวดนี้
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">งบประมาณ (บาท)</label>
            <input
              type="number" min="0" step="1000"
              value={amount === 0 ? "" : amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0"
              disabled={pending}
              className="h-12 w-full px-4 rounded-lg border border-input bg-background text-lg font-extrabold tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">หมายเหตุ (ถ้ามี)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น งบหลักของฝ่ายผลิต"
              disabled={pending}
            />
          </div>

          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} loading={pending}>
            <Wallet className="size-4" /> บันทึกงบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
