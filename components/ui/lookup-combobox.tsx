"use client";

/**
 * LookupCombobox — searchable dropdown with inline create
 *
 * Features:
 *  - Search filter (case-insensitive, match name + code)
 *  - Click outside = close
 *  - Esc = close
 *  - Inline "+ create XXX" if no match found
 *  - Optional "🔧 จัดการ" link (e.g., link to /settings)
 *  - Loading state when creating
 *
 * Usage:
 *   <LookupCombobox
 *     type="bank"
 *     options={banks}
 *     value={bankName}
 *     onChange={setBankName}
 *     placeholder="เลือกธนาคาร..."
 *     allowCreate
 *     manageHref="/settings?tab=lookups"
 *   />
 */
import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ChevronDown, Check, Plus, Search, Settings, X, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { createLookupAction } from "@/lib/actions/lookups";
import type { Lookup, LookupType } from "@/lib/types/db";

export interface LookupOption {
  name: string;
  code?: string | null;
}

export function LookupCombobox({
  type, options, value, onChange,
  placeholder = "เลือก...",
  allowCreate = false,
  manageHref,
  disabled,
  className,
}: {
  type: LookupType;
  options: LookupOption[] | Lookup[];
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
  manageHref?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, startCreating] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch("");
    }
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) =>
        o.name.toLowerCase().includes(q) ||
        (o.code ?? "").toLowerCase().includes(q),
      )
    : options;

  const exactMatch = options.some(
    (o) => o.name.trim().toLowerCase() === q,
  );
  const showCreate = allowCreate && q.length > 0 && !exactMatch;

  function handleSelect(name: string) {
    onChange(name);
    setOpen(false);
  }

  function handleCreate() {
    const newName = search.trim();
    if (!newName) return;
    startCreating(async () => {
      const res = await createLookupAction({ type, name: newName });
      if (res.ok && res.name) {
        toast.success(`✅ เพิ่ม "${res.name}" สำเร็จ`);
        onChange(res.name);
        setOpen(false);
      } else {
        toast.error(res.error ?? "เพิ่มไม่สำเร็จ");
      }
    });
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "h-10 w-full px-3 rounded-lg border bg-background text-sm text-left",
          "flex items-center justify-between gap-2",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          open ? "border-primary ring-2 ring-primary/30" : "border-input hover:border-primary/40",
        )}
      >
        <span className={cn(
          "truncate",
          value ? "text-foreground" : "text-muted-foreground",
        )}>
          {value || placeholder}
        </span>
        <ChevronDown className={cn(
          "size-4 text-muted-foreground flex-shrink-0 transition-transform",
          open && "rotate-180",
        )} />
      </button>

      {/* Clear button (when has value) */}
      {value && !disabled && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(""); }}
          className="absolute right-9 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="ล้าง"
          tabIndex={-1}
        >
          <X className="size-3.5" />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
          {/* Search */}
          <div className="p-2 border-b border-border bg-muted/30">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && showCreate) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder="พิมพ์เพื่อค้นหา..."
                className="w-full h-8 pl-7 pr-2 text-sm bg-background border border-input rounded focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && !showCreate && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                ไม่พบรายการ
              </div>
            )}

            {filtered.map((o, i) => (
              <button
                key={`${o.name}-${i}`}
                type="button"
                onClick={() => handleSelect(o.name)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2",
                  "hover:bg-accent transition-colors",
                  o.name === value && "bg-primary/10 text-primary font-semibold",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{o.name}</span>
                  {o.code && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({o.code})
                    </span>
                  )}
                </span>
                {o.name === value && (
                  <Check className="size-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}

            {/* Inline create */}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm border-t border-border",
                  "hover:bg-accent transition-colors text-primary font-semibold",
                  "flex items-center gap-2",
                )}
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                <span>สร้าง <strong>"{search.trim()}"</strong></span>
              </button>
            )}
          </div>

          {/* Footer: manage link */}
          {manageHref && (
            <Link
              href={manageHref}
              className="block px-3 py-2 text-xs text-muted-foreground hover:text-primary border-t border-border bg-muted/30 transition-colors"
            >
              <Settings className="size-3 inline mr-1" />
              จัดการรายการทั้งหมด
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
