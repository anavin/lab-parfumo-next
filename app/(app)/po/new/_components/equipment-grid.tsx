"use client";

import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Equipment } from "@/lib/types/db";

export function EquipmentGrid({
  items, selectedIds, onToggle,
}: {
  items: Equipment[];
  selectedIds: Set<string>;
  onToggle: (eq: Equipment) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((eq) => (
        <EquipmentCard
          key={eq.id}
          eq={eq}
          isSelected={selectedIds.has(eq.id)}
          onClick={() => onToggle(eq)}
        />
      ))}
    </div>
  );
}

function EquipmentCard({
  eq, isSelected, onClick,
}: {
  eq: Equipment;
  isSelected: boolean;
  onClick: () => void;
}) {
  // รวมรูป
  const images = [...(eq.image_urls ?? [])];
  if (eq.image_url && !images.includes(eq.image_url)) {
    images.unshift(eq.image_url);
  }
  const primary = images[0];

  // Stock badge
  const stock = eq.stock ?? 0;
  const rl = eq.reorder_level ?? 0;
  let stockChip: { bg: string; color: string; text: string };
  if (stock === 0) {
    stockChip = { bg: "bg-red-50 border-red-200", color: "text-red-700", text: `⚠️ หมด` };
  } else if (rl > 0 && stock <= rl) {
    stockChip = { bg: "bg-red-50 border-red-200", color: "text-red-700", text: `🔴 ต้องสั่ง! เหลือ ${stock}` };
  } else if (stock < 10) {
    stockChip = { bg: "bg-amber-50 border-amber-200", color: "text-amber-700", text: `⚠️ ${stock} ${eq.unit ?? ""} (ต่ำ)` };
  } else {
    stockChip = { bg: "bg-emerald-50 border-emerald-200", color: "text-emerald-700", text: `📦 ${stock} ${eq.unit ?? ""}` };
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left bg-white border rounded-xl p-3 transition-all",
        "hover:border-brand-300 hover:shadow-sm",
        isSelected
          ? "border-brand-600 ring-2 ring-brand-100"
          : "border-slate-200",
      )}
    >
      {/* Image */}
      <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 mb-2 flex items-center justify-center">
        {primary ? (
          <img
            src={primary}
            alt={eq.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl">🧴</span>
        )}
      </div>

      {/* Name */}
      <div className="font-semibold text-sm text-slate-900 truncate" title={eq.name}>
        {eq.name}
      </div>
      <div className="text-[11px] text-slate-500 truncate">
        SKU: {eq.sku || "-"}
      </div>
      <div className="text-[11px] text-slate-500 truncate">
        📂 {eq.category || "-"}
      </div>

      {/* Stock chip */}
      <div className="mt-2">
        <span
          className={cn(
            "inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border",
            stockChip.bg, stockChip.color,
          )}
        >
          {stockChip.text}
        </span>
      </div>

      {/* Action */}
      <div
        className={cn(
          "mt-3 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors",
          isSelected
            ? "bg-gradient-to-br from-brand-600 to-brand-800 text-white"
            : "bg-slate-50 text-slate-700 group-hover:bg-brand-100 group-hover:text-brand-700",
        )}
      >
        {isSelected ? (
          <>
            <Check className="h-3.5 w-3.5" /> เลือกแล้ว
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" /> เพิ่ม
          </>
        )}
      </div>
    </button>
  );
}
