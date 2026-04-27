"use client";

/**
 * List controls — search input + sort dropdown + advanced filters
 * URL-driven: ทุกการเปลี่ยน → router.push พร้อม searchParams ใหม่
 */
import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SORT_LABELS, type PoSortKey } from "@/lib/types/db";

const SORT_OPTIONS: PoSortKey[] = [
  "newest", "oldest", "total_desc", "total_asc",
  "supplier_asc", "expected_asc",
];

export function ListControls({
  initialSearch, initialSort,
  initialFromDate, initialToDate, initialMinAmount,
  showAdvanced,
}: {
  initialSearch?: string;
  initialSort?: PoSortKey;
  initialFromDate?: string;
  initialToDate?: string;
  initialMinAmount?: string;
  showAdvanced?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch ?? "");
  const [advOpen, setAdvOpen] = useState(false);

  // Debounce search → URL update
  useEffect(() => {
    if (search === (initialSearch ?? "")) return;
    const t = setTimeout(() => {
      const usp = new URLSearchParams(params);
      if (search) usp.set("search", search);
      else usp.delete("search");
      usp.delete("page");
      startTransition(() => router.push(`${pathname}?${usp.toString()}`));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updateParam(key: string, value: string | undefined) {
    const usp = new URLSearchParams(params);
    if (value) usp.set(key, value);
    else usp.delete(key);
    usp.delete("page");
    router.push(`${pathname}?${usp.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="🔍 เลข PO / supplier / สินค้า / ผู้สร้าง..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 sm:w-56"
          value={initialSort ?? "newest"}
          onChange={(e) => updateParam("sort", e.target.value === "newest" ? undefined : e.target.value)}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s} value={s}>🔃 {SORT_LABELS[s]}</option>
          ))}
        </select>
        {showAdvanced && (
          <button
            type="button"
            onClick={() => setAdvOpen(!advOpen)}
            className="h-11 px-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-brand-50 hover:border-brand-600 hover:text-brand-700"
          >
            ตัวกรองขั้นสูง
            <ChevronDown className={`h-4 w-4 transition-transform ${advOpen ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {showAdvanced && advOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              📅 ตั้งแต่
            </label>
            <input
              type="date"
              defaultValue={initialFromDate}
              onChange={(e) => updateParam("from", e.target.value || undefined)}
              className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              📅 ถึง
            </label>
            <input
              type="date"
              defaultValue={initialToDate}
              onChange={(e) => updateParam("to", e.target.value || undefined)}
              className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              💰 ยอดขั้นต่ำ (฿)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              defaultValue={initialMinAmount}
              onChange={(e) => updateParam("min", e.target.value || undefined)}
              placeholder="0 = ไม่กรอง"
              className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
