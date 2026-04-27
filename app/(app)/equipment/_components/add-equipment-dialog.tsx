"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { createEquipmentAction } from "@/lib/actions/equipment";

export function AddEquipmentDialog({
  categories, onClose,
}: {
  categories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "อุปกรณ์อื่นๆ");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("ชิ้น");
  const [lastCost, setLastCost] = useState(0);
  const [stock, setStock] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [description, setDescription] = useState("");

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    startTransition(async () => {
      const res = await createEquipmentAction({
        name, category, sku, unit, description,
        lastCost, stock, reorderLevel,
      });
      if (!res.ok) {
        setError(res.error ?? "เพิ่มไม่สำเร็จ");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">➕ เพิ่มสินค้าใหม่</h2>
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

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="เช่น ขวดแก้ว 30ml" disabled={pending} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หมวด</label>
              <select
                className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={pending}
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)}
                     placeholder="LP-BTL-30" disabled={pending} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หน่วย</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)}
                     placeholder="ชิ้น" disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ราคาต้นทุน (฿)</label>
              <input type="number" min="0" step="1"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={lastCost}
                     onChange={(e) => setLastCost(parseFloat(e.target.value) || 0)}
                     disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สต็อก</label>
              <input type="number" min="0" step="1"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={stock}
                     onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                     disabled={pending} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              🔴 Reorder Level
              <span className="text-slate-400 text-xs ml-1">(เมื่อ stock ≤ ค่านี้ จะเตือน)</span>
            </label>
            <input type="number" min="0" step="1"
                   className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                   value={reorderLevel}
                   onChange={(e) => setReorderLevel(parseInt(e.target.value, 10) || 0)}
                   disabled={pending} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียด / สเปค</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={pending}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600"
              placeholder="ขนาด / สี / Made in..."
            />
          </div>
          <p className="text-[11px] text-slate-400 italic">
            💡 อัปโหลดรูป — มาใน Phase 7
          </p>
          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <div className="flex gap-2 p-5 pt-3 border-t border-slate-200">
          <Button onClick={handleSubmit} loading={pending}>
            ✅ เพิ่มสินค้า
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  );
}
