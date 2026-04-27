/**
 * Render รายการสินค้าใน PO
 */
import type { PoItem } from "@/lib/types/db";

export function ItemsList({
  items, isAdmin,
}: {
  items: PoItem[];
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:border-brand-300 transition-colors"
        >
          {/* Image / icon */}
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
            {(it.image_urls && it.image_urls.length > 0)
              ? <img src={it.image_urls[0]} alt={it.name} loading="lazy"
                     className="w-full h-full object-cover" />
              : <span>{it.equipment_id ? "🧴" : "✏️"}</span>}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 text-sm">{it.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {it.equipment_id
                ? "📦 จาก catalog"
                : "✏️ พิมพ์เอง (ไม่ได้อยู่ใน catalog)"}
            </div>
            {it.notes && (
              <div className="text-xs text-slate-600 mt-1">💬 {it.notes}</div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-sm font-bold text-slate-900 tabular-nums">
              {it.qty.toLocaleString("th-TH")} <span className="text-xs font-normal text-slate-500">{it.unit}</span>
            </div>
            {isAdmin && it.unit_price != null && it.unit_price > 0 && (
              <div className="text-xs text-slate-500 mt-0.5">
                @฿{it.unit_price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                <div className="text-sm font-bold text-brand-700 tabular-nums">
                  ฿{(it.subtotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
