"use client";

/**
 * Status filter chips — URL-driven (preserves other params)
 *
 * Note: buildChipOptions + type ChipOption ย้ายไป ./chip-options.ts
 * เพื่อให้ server component import ได้โดยตรง (ไม่ผ่าน client boundary)
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { ChipOption } from "./chip-options";

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
    <div
      className="grid gap-2 py-0.5"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
      }}
    >
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-xs font-semibold transition-all",
              isActive
                ? "bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-brand-50 hover:border-brand-600 hover:-translate-y-0.5 hover:shadow-sm",
            )}
          >
            <span className="truncate">{opt.label}</span>
            <span
              className={cn(
                "flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full tabular-nums",
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
