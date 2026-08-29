"use client";

/**
 * Global search modal — เปิดด้วย Cmd+K หรือคลิกไอคอน 🔍
 *
 * Uses Radix Dialog primitive → focus trap + return-focus + Esc + aria-modal
 * ก่อน: plain div → Tab หลุด background, no focus trap, no SR announcement
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search, FileText, Package, Truck, Loader2,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { searchAction } from "@/lib/actions/search";
import { StatusPill } from "@/components/ui/status-pill";
import type { SearchResult } from "@/lib/types/db";

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

  // Reset query when closed
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function navigateAndClose(url: string) {
    onClose();
    setQuery("");
    router.push(url);
  }

  const total = results.pos.length + results.equipment.length + results.suppliers.length;

  // ⌘/Ctrl glyph ตาม platform — Mac = ⌘, Win/Linux = Ctrl
  const modKey = useMemo(() => {
    if (typeof navigator === "undefined") return "⌘";
    return /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘" : "Ctrl";
  }, []);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[10vh] z-50 w-[calc(100vw-2rem)] max-w-xl translate-x-[-50%] bg-white rounded-2xl shadow-2xl overflow-hidden focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            ค้นหา
          </DialogPrimitive.Title>

          {/* Search input */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-200">
            <Search className="h-5 w-5 text-slate-400 flex-shrink-0" aria-hidden="true" />
            <label className="sr-only" htmlFor="global-search-input">
              ค้นหา PO / สินค้า / supplier
            </label>
            <input
              id="global-search-input"
              type="text"
              placeholder="ค้นหา PO / สินค้า / supplier..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent text-base focus:outline-none focus-visible:outline-none placeholder:text-slate-400"
              aria-label="ค้นหา"
            />
            {pending && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" aria-hidden="true" />}
            <kbd className="hidden sm:inline-block text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
              Esc
            </kbd>
            <DialogPrimitive.Close
              className="text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 rounded"
              aria-label="ปิดค้นหา"
            >
              <span aria-hidden="true">✕</span>
            </DialogPrimitive.Close>
          </div>

          {/* Results — announce updates for SR */}
          <div
            className="max-h-[60vh] overflow-y-auto"
            role="region"
            aria-live="polite"
            aria-atomic="false"
          >
            {!query.trim() ? (
              <div className="p-8 text-center text-sm text-slate-400">
                💡 พิมพ์เพื่อค้นหา — เลข PO, ชื่อสินค้า, SKU, supplier
                <div className="mt-3 text-xs">
                  <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {modKey} K
                  </kbd> เปิดค้นหา
                </div>
              </div>
            ) : pending && total === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" aria-hidden="true" />
                กำลังค้นหา...
              </div>
            ) : total === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                ไม่พบรายการที่ตรงกับ &ldquo;<strong>{query}</strong>&rdquo;
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
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-brand-600 flex-shrink-0" aria-hidden="true" />
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
                          className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 transition-colors"
                        >
                          <Package className="h-4 w-4 text-brand-600 flex-shrink-0" aria-hidden="true" />
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
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 transition-colors"
                      >
                        <Truck className="h-4 w-4 text-brand-600 flex-shrink-0" aria-hidden="true" />
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
