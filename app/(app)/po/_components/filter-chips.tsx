"use client";

/**
 * Status filter chips — URL-driven (preserves other params)
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PO_STATUSES } from "@/lib/types/db";

interface ChipOption {
  value: string;       // status value or "ทั้งหมด"
  label: string;
  count: number;
}

export function FilterChips({
  active, options,
}: {
  active: string;
  options: ChipOption[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  function setStatus(s: string) {
    const usp = new URLSearchParams(params);
    if (s === "ทั้งหมด") {
      usp.delete("status");
    } else {
      usp.set("status", s);
    }
    usp.delete("page"); // reset pagination
    router.push(`${pathname}?${usp.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={cn(
              "flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-colors",
              isActive
                ? "bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-brand-50 hover:border-brand-600",
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-bold rounded-full",
                isActive ? "bg-white/20" : "bg-slate-100 text-slate-600",
              )}
            >
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function buildChipOptions(byStatus: Record<string, number>, total: number): ChipOption[] {
  const opts: ChipOption[] = [{ value: "ทั้งหมด", label: "ทั้งหมด", count: total }];
  for (const s of PO_STATUSES) {
    const count = byStatus[s] ?? 0;
    if (count > 0) opts.push({ value: s, label: s, count });
  }
  return opts;
}
