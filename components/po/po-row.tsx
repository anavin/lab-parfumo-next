/**
 * Compact PO row — ใช้ในหน้า list
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { PurchaseOrder } from "@/lib/types/db";

export function PoRow({
  po, isAdmin,
}: {
  po: PurchaseOrder;
  isAdmin: boolean;
}) {
  const items = po.items ?? [];
  const itemsPreview = items.slice(0, 2).map((it) => it.name).filter(Boolean).join(", ");
  const moreItems = items.length > 2 ? `, +${items.length - 2}` : "";

  const supplier = isAdmin
    ? po.supplier_name ?? "(ยังไม่ระบุ supplier)"
    : po.supplier_name ?? "—";

  const amountStr =
    isAdmin && po.total ? `฿${po.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}` : "—";

  const dateStr = po.created_at
    ? new Date(po.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short" })
    : "";

  return (
    <Link
      href={`/po/${po.id}`}
      className="group block bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all"
    >
      <div className="grid grid-cols-12 gap-3 items-center">
        {/* PO Number */}
        <div className="col-span-12 sm:col-span-2 flex items-center gap-2">
          <span className="font-bold font-mono text-brand-700 text-sm">
            {po.po_number}
          </span>
          <span className="sm:hidden">
            <StatusPill status={po.status} />
          </span>
        </div>

        {/* Supplier + items */}
        <div className="col-span-12 sm:col-span-4 min-w-0">
          <div className="font-semibold text-sm text-slate-800 truncate">
            {supplier}
          </div>
          <div className="text-xs text-slate-500 truncate">
            📦 {items.length} รายการ
            {itemsPreview && ` • ${itemsPreview}${moreItems}`}
          </div>
        </div>

        {/* Status (desktop) */}
        <div className="hidden sm:flex sm:col-span-2">
          <StatusPill status={po.status} />
        </div>

        {/* Total */}
        <div className="col-span-6 sm:col-span-2 text-right">
          <div
            className={`text-sm font-bold tabular-nums ${
              amountStr !== "—" ? "text-slate-900" : "text-slate-400"
            }`}
          >
            {amountStr}
          </div>
        </div>

        {/* Date + creator */}
        <div className="col-span-5 sm:col-span-1 text-xs text-slate-500 leading-tight">
          <div>📅 {dateStr}</div>
          <div className="truncate">👤 {po.created_by_name ?? "—"}</div>
        </div>

        {/* Arrow */}
        <div className="col-span-1 flex justify-end text-slate-400 group-hover:text-brand-600 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}
