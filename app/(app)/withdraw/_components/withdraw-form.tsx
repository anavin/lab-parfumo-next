"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import type { Equipment } from "@/lib/types/db";
import { createWithdrawalAction } from "@/lib/actions/withdraw";

export function WithdrawForm({
  equipment, categories,
}: {
  equipment: Equipment[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ทั้งหมด");
  const [showZero, setShowZero] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "stock_low" | "stock_high">("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter & sort
  const filtered = useMemo(() => {
    let out = equipment;
    if (category !== "ทั้งหมด") out = out.filter((e) => e.category === category);
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((e) =>
        (e.name ?? "").toLowerCase().includes(s) ||
        (e.sku ?? "").toLowerCase().includes(s),
      );
    }
    if (!showZero) out = out.filter((e) => (e.stock ?? 0) > 0);
    if (sortBy === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "stock_low") out = [...out].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    else if (sortBy === "stock_high") out = [...out].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
    return out;
  }, [equipment, category, search, showZero, sortBy]);

  const selectedEq = useMemo(
    () => equipment.find((e) => e.id === selectedId) ?? null,
    [equipment, selectedId],
  );

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="🔍 ชื่อสินค้า / SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>ทั้งหมด</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600 items-center">
            <select
              className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="name">🔃 เรียงตามชื่อ</option>
              <option value="stock_low">🔃 สต็อกน้อย→มาก</option>
              <option value="stock_high">🔃 สต็อกมาก→น้อย</option>
            </select>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showZero}
                onChange={(e) => setShowZero(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              แสดงสินค้าที่หมดด้วย
            </label>
            <span className="ml-auto">
              พบ <strong>{filtered.length}</strong> รายการ
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Equipment grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            ไม่พบสินค้าตามที่ค้นหา
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((eq) => (
            <EqCard
              key={eq.id}
              eq={eq}
              isSelected={selectedId === eq.id}
              onClick={() => setSelectedId(selectedId === eq.id ? null : eq.id)}
            />
          ))}
        </div>
      )}

      {/* Withdraw form (sticky bottom) */}
      {selectedEq && (
        <SelectedItemForm
          eq={selectedEq}
          onClose={() => setSelectedId(null)}
          onSuccess={() => {
            setSelectedId(null);
            router.refresh();
          }}
          startTransition={startTransition}
          pending={pending}
        />
      )}
    </div>
  );
}

function EqCard({
  eq, isSelected, onClick,
}: {
  eq: Equipment;
  isSelected: boolean;
  onClick: () => void;
}) {
  const stock = eq.stock ?? 0;
  const rl = eq.reorder_level ?? 0;
  const images = [...(eq.image_urls ?? [])];
  if (eq.image_url && !images.includes(eq.image_url)) images.unshift(eq.image_url);
  const thumb = images[0];

  let stockChip: { bg: string; color: string; label: string };
  if (stock === 0) {
    stockChip = { bg: "bg-red-50", color: "text-red-700", label: "หมด" };
  } else if (rl > 0 && stock <= rl) {
    stockChip = { bg: "bg-red-50", color: "text-red-700", label: `🔴 ต้องสั่ง! ${stock}/${rl}` };
  } else if (stock < 10) {
    stockChip = { bg: "bg-amber-50", color: "text-amber-700", label: `เหลือ ${stock}` };
  } else {
    stockChip = { bg: "bg-emerald-50", color: "text-emerald-700", label: `${stock} ${eq.unit ?? ""}` };
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={stock === 0}
      className={cn(
        "group text-left bg-white border rounded-xl p-3 transition-all",
        "hover:border-brand-300 hover:shadow-sm",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isSelected ? "border-brand-600 ring-2 ring-brand-100" : "border-slate-200",
      )}
    >
      <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt={eq.name} loading="lazy"
               className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">🧴</span>
        )}
      </div>
      <div className="font-semibold text-sm text-slate-900 truncate">{eq.name}</div>
      <div className="text-[11px] text-slate-500 truncate">SKU: {eq.sku ?? "-"} • {eq.category}</div>
      <div className="mt-1.5">
        <span className={cn("inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full",
          stockChip.bg, stockChip.color)}>
          📦 {stockChip.label}
        </span>
      </div>
      <div className={cn(
        "mt-2 text-xs font-semibold rounded-lg py-1.5 text-center transition-colors",
        stock === 0 ? "text-slate-400" :
        isSelected ? "bg-brand-700 text-white" :
        "bg-slate-50 text-slate-700 group-hover:bg-brand-100 group-hover:text-brand-700",
      )}>
        {stock === 0 ? "❌ หมด" : isSelected ? "✓ กำลังเบิก" : "📤 เบิกสินค้า"}
      </div>
    </button>
  );
}

function SelectedItemForm({
  eq, onClose, onSuccess, startTransition, pending,
}: {
  eq: Equipment;
  onClose: () => void;
  onSuccess: () => void;
  startTransition: React.TransitionStartFunction;
  pending: boolean;
}) {
  const stock = eq.stock ?? 0;
  const [qty, setQty] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    if (qty < 1 || qty > stock) {
      setError(`จำนวนต้องอยู่ระหว่าง 1-${stock}`);
      return;
    }
    if (!purpose.trim()) {
      setError("กรุณากรอกใช้ทำอะไร");
      return;
    }
    startTransition(async () => {
      const res = await createWithdrawalAction({
        equipmentId: eq.id,
        qty,
        purpose,
        withdrawnAt: new Date(date).toISOString(),
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onSuccess();
    });
  }

  return (
    <Card className="bg-brand-50 border-brand-300 sticky bottom-2 shadow-lg z-10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-brand-700 mb-0.5">📤 กำลังเบิก</div>
            <div className="font-bold text-slate-900">{eq.name}</div>
            <div className="text-xs text-slate-600">
              สต็อก: <strong>{stock}</strong> {eq.unit}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-slate-400 hover:text-slate-700"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">จำนวน *</label>
            <input
              type="number" min="1" max={stock}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(stock, parseInt(e.target.value, 10) || 1)))}
              disabled={pending}
              className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums focus:outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">วันที่ใช้</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
              className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">หน่วย</label>
            <Input value={eq.unit ?? "ชิ้น"} disabled />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            ใช้ทำอะไร / ใช้ที่ไหน *
          </label>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="เช่น ผลิต CELEB lot 24, ตัวอย่างลูกค้า"
            disabled={pending}
          />
        </div>

        {error && <Alert tone="danger" className="text-sm">❌ {error}</Alert>}

        <div className="flex gap-2">
          <Button onClick={handleSubmit} loading={pending}>
            <Send className="h-4 w-4" /> บันทึกเบิก
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
