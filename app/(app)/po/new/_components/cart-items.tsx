"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import type { Equipment, PoItem } from "@/lib/types/db";

export function CartItems({
  items, equipment, onUpdateQty, onRemove,
}: {
  items: PoItem[];
  equipment: Equipment[];
  onUpdateQty: (idx: number, qty: number) => void;
  onRemove: (idx: number) => void;
}) {
  const eqMap = new Map(equipment.map((e) => [e.id, e]));

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const eq = item.equipment_id ? eqMap.get(item.equipment_id) : undefined;
        const thumb = eq?.image_url ?? eq?.image_urls?.[0] ?? null;

        return (
          <div
            key={idx}
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3"
          >
            {/* Thumbnail */}
            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {thumb ? (
                <img
                  src={thumb} alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl">{item.equipment_id ? "🧴" : "✏️"}</span>
              )}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-900 truncate">
                {item.name}
              </div>
              {item.equipment_id && eq ? (
                <div className="text-xs text-slate-500">
                  SKU: {eq.sku || "-"} • {eq.category}
                </div>
              ) : (
                <div className="text-xs text-amber-700">✏️ พิมพ์เอง (รออนุมัติ)</div>
              )}
              {item.notes && (
                <div className="text-xs text-slate-500 mt-0.5">💬 {item.notes}</div>
              )}
            </div>

            {/* Qty controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateQty(idx, item.qty - 1)}
                disabled={item.qty <= 1}
                className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="ลด"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min="1"
                value={item.qty}
                onChange={(e) => onUpdateQty(idx, Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="h-9 w-14 text-center text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-brand-600"
              />
              <button
                type="button"
                onClick={() => onUpdateQty(idx, item.qty + 1)}
                className="h-9 w-9 rounded-lg border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100"
                aria-label="เพิ่ม"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-slate-500 ml-1.5 min-w-[2rem]">
                {item.unit}
              </span>
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="h-9 w-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center flex-shrink-0"
              aria-label="ลบ"
              title="ลบรายการ"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
