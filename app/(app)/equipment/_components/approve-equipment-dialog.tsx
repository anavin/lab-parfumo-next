"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { Equipment } from "@/lib/types/db";
import { approveEquipmentAction } from "@/lib/actions/equipment";

export function ApproveEquipmentDialog({
  eq, categories, onClose,
}: {
  eq: Equipment;
  categories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [sku, setSku] = useState("");
  const [name, setName] = useState(eq.name ?? "");
  const [category, setCategory] = useState(categories[0] ?? "อุปกรณ์อื่นๆ");
  const [unit, setUnit] = useState(eq.unit ?? "ชิ้น");
  const [lastCost, setLastCost] = useState(eq.last_cost ?? 0);
  const [stock, setStock] = useState(0);
  const [description, setDescription] = useState(
    eq.description ?? eq.suggested_notes ?? "",
  );

  const images = [...(eq.image_urls ?? [])];
  if (eq.image_url && !images.includes(eq.image_url)) images.unshift(eq.image_url);

  function handleSubmit() {
    setError(null);
    if (!sku.trim()) { setError("กรุณากรอก SKU"); return; }
    if (!name.trim()) { setError("กรุณากรอกชื่อ"); return; }
    if (!category) { setError("กรุณาเลือกหมวด"); return; }

    startTransition(async () => {
      const res = await approveEquipmentAction(eq.id, {
        sku, name, category, unit, description, lastCost, stock,
      });
      if (!res.ok) {
        setError(res.error ?? "อนุมัติไม่สำเร็จ");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl my-8 shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">✅ อนุมัติเพิ่มเข้า Catalog</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {eq.name} • เสนอโดย: {eq.suggested_by_name ?? "—"}
            </p>
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

        <div className="p-5 space-y-4">
          {/* Image preview */}
          {images.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1.5">📷 รูปที่ user upload</div>
              <div className="grid grid-cols-4 gap-2">
                {images.slice(0, 4).map((url, i) => (
                  <div key={i} className="aspect-square bg-slate-100 rounded-lg overflow-hidden">
                    <img src={url} alt="" loading="lazy"
                         className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {eq.suggested_notes && (
            <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              💬 หมายเหตุจาก user: {eq.suggested_notes}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)}
                     placeholder="เช่น B30-001" disabled={pending} />
              <div className="text-[10px] text-slate-400 mt-0.5">
                ต่างจาก SKU ชั่วคราว ที่ระบบสร้างให้
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หมวด *</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">หน่วย</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} disabled={pending} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ราคาล่าสุด (฿)</label>
              <input type="number" min="0" step="1"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={lastCost}
                     onChange={(e) => setLastCost(parseFloat(e.target.value) || 0)}
                     disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สต็อกเริ่มต้น</label>
              <input type="number" min="0" step="1"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={stock}
                     onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                     disabled={pending} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียด</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={pending}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600"
            />
          </div>

          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <div className="flex gap-2 p-5 pt-3 border-t border-slate-200">
          <Button onClick={handleSubmit} loading={pending}>
            <Check className="h-4 w-4" /> อนุมัติเพิ่มเข้า Catalog
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  );
}
