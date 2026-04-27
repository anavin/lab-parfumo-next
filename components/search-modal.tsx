"use client";

/**
 * Global search modal — เปิดด้วย Cmd+K หรือคลิกไอคอน 🔍
 */
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, X, FileText, Package, Truck, Loader2,
} from "lucide-react";
import { searchAction } from "@/lib/actions/search";
import { StatusPill } from "@/components/ui/status-pill";
import type { SearchResult } from "@/lib/db/search";

export function SearchModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({
    pos: [], equipment: [], suppliers: [],
  });

  // Debounce query → action
  useEffect(() => {
    if (!query.trim()) {
      setResults({ pos: [], equipment: [], suppliers: [] });
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchAction(query);
        setResults(r);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function navigateAndClose(url: string) {
    onClose();
    setQuery("");
    router.push(url);
  }

  if (!open) return null;

  const total = results.pos.length + results.equipment.length + results.suppliers.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-200">
          <Search className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="ค้นหา PO / สินค้า / supplier..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-base focus:outline-none placeholder:text-slate-400"
          />
          {pending && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
          <kbd className="hidden sm:inline-block text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
            Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="p-8 text-center text-sm text-slate-400">
              💡 พิมพ์เพื่อค้นหา — เลข PO, ชื่อสินค้า, SKU, supplier
              <div className="mt-3 text-xs">
                <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  ⌘ K
                </kbd> เปิดค้นหา
              </div>
            </div>
          ) : pending && total === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              กำลังค้นหา...
            </div>
          ) : total === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              ไม่พบรายการที่ตรงกับ "<strong>{query}</strong>"
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {results.pos.length > 0 && (
                <Section title={`📝 ใบ PO (${results.pos.length})`}>
                  {results.pos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigateAndClose(`/po/${p.id}`)}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-brand-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold font-mono text-sm text-brand-700">
                            {p.po_number}
                          </span>
                          <StatusPill status={p.status} />
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {p.supplier_name || "(ยังไม่ระบุ)"} • {p.items?.length ?? 0} รายการ
                          • {p.created_by_name}
                        </div>
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {results.equipment.length > 0 && (
                <Section title={`📦 สินค้า (${results.equipment.length})`}>
                  {results.equipment.map((e) => {
                    const stock = e.stock ?? 0;
                    const indicator = stock === 0 ? "🔴" : stock < 10 ? "🟡" : "🟢";
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => navigateAndClose("/equipment")}
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Package className="h-4 w-4 text-brand-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900">
                            {indicator} {e.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            SKU: {e.sku || "-"} • {e.category || "-"} • คงเหลือ: {stock} {e.unit}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </Section>
              )}

              {results.suppliers.length > 0 && (
                <Section title={`🏭 Supplier (${results.suppliers.length})`}>
                  {results.suppliers.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => navigateAndClose(`/po?search=${encodeURIComponent(s.name)}`)}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Truck className="h-4 w-4 text-brand-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {s.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.poCount} ใบ PO
                        </div>
                      </div>
                    </button>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 px-2 mb-1">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
