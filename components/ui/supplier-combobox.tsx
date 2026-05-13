"use client";

/**
 * SupplierCombobox — searchable supplier picker for OrderForm
 *
 * Features:
 *  - Search filter (case-insensitive, match name)
 *  - Group/badge: registered (มีข้อมูลครบ) vs history (เคยใช้ใน PO)
 *  - Show metadata: PO count, last used, bank icon (if registered)
 *  - Click outside / Esc = close
 *  - Free-text mode: คลิก "+ พิมพ์ Supplier ใหม่"
 *  - Link "🔧 จัดการ Supplier" → /suppliers
 *
 * Usage:
 *   <SupplierCombobox
 *     options={supplierOptions}
 *     value={supplierName}
 *     onChange={(name, option) => { setSupplier(name); if (option) autofillContact(option); }}
 *     onFreeText={() => setCustomMode(true)}
 *   />
 */
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronDown, Check, Plus, Search, Settings, X, Building2, Landmark,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupplierOption } from "@/lib/types/db";

export function SupplierCombobox({
  options,
  value,
  onChange,
  onFreeText,
  placeholder = "เลือก Supplier...",
  disabled,
  className,
  manageHref = "/suppliers",
}: {
  options: SupplierOption[];
  value: string;
  onChange: (name: string, option: SupplierOption | null) => void;
  /** เรียกเมื่อ user เลือกพิมพ์ Supplier ใหม่ (free text mode) */
  onFreeText?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  manageHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch("");
    }
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q))
    : options;

  function handleSelect(opt: SupplierOption) {
    onChange(opt.name, opt);
    setOpen(false);
  }

  function handleFreeText() {
    setOpen(false);
    onFreeText?.();
  }

  // Group display: registered first, then history
  const registered = filtered.filter((o) => o.source === "registered");
  const history = filtered.filter((o) => o.source === "history");

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "h-11 w-full px-3 rounded-lg border bg-background text-sm text-left",
          "flex items-center justify-between gap-2",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          open ? "border-primary ring-2 ring-primary/30" : "border-input hover:border-primary/40",
        )}
      >
        <span className={cn(
          "truncate flex items-center gap-2",
          value ? "text-foreground" : "text-muted-foreground",
        )}>
          {value ? <Building2 className="size-4 text-primary flex-shrink-0" /> : null}
          <span className="truncate">{value || placeholder}</span>
        </span>
        <ChevronDown className={cn(
          "size-4 text-muted-foreground flex-shrink-0 transition-transform",
          open && "rotate-180",
        )} />
      </button>

      {/* Clear button */}
      {value && !disabled && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange("", null); }}
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
          {/* Search input */}
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
                }}
                placeholder="พิมพ์ชื่อ supplier เพื่อค้นหา..."
                className="w-full h-8 pl-7 pr-2 text-sm bg-background border border-input rounded focus:outline-none focus:border-primary"
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 px-1">
              พบ {filtered.length} ราย ({registered.length} registered, {history.length} จาก history)
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                ไม่พบ supplier ตรงกับ &quot;{search}&quot;
              </div>
            )}

            {/* Registered group */}
            {registered.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/20 sticky top-0">
                  Registered ({registered.length})
                </div>
                {registered.map((o) => (
                  <SupplierRow key={`r-${o.id}`} option={o} selected={o.name === value} onSelect={handleSelect} />
                ))}
              </>
            )}

            {/* History group */}
            {history.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/20 sticky top-0">
                  จาก PO ประวัติ ({history.length})
                </div>
                {history.map((o) => (
                  <SupplierRow key={`h-${o.name}`} option={o} selected={o.name === value} onSelect={handleSelect} />
                ))}
              </>
            )}
          </div>

          {/* Footer: actions */}
          <div className="border-t border-border bg-muted/20 divide-y divide-border">
            {onFreeText && (
              <button
                type="button"
                onClick={handleFreeText}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary font-semibold"
              >
                <Plus className="size-4" />
                <span>พิมพ์ Supplier ใหม่ (ยังไม่ register)</span>
              </button>
            )}
            <Link
              href={manageHref}
              className="block px-3 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Settings className="size-3 inline mr-1" />
              จัดการ Supplier ทั้งหมด →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierRow({
  option, selected, onSelect,
}: {
  option: SupplierOption;
  selected: boolean;
  onSelect: (opt: SupplierOption) => void;
}) {
  const hasBank = !!(option.bank_name || option.bank_account);
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={cn(
        "w-full px-3 py-2 text-left text-sm flex items-start justify-between gap-2",
        "hover:bg-accent transition-colors border-b border-border/40",
        selected && "bg-primary/10 text-primary",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("truncate", selected && "font-semibold")}>{option.name}</span>
          {option.source === "registered" && (
            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex-shrink-0">
              registered
            </span>
          )}
          {hasBank && (
            <span title="มีข้อมูลธนาคาร" className="text-emerald-600 flex-shrink-0">
              <Landmark className="size-3" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          {option.poCount > 0 && (
            <span>{option.poCount} PO</span>
          )}
          {option.lastUsed && (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="size-2.5" />
              {fmtDate(option.lastUsed)}
            </span>
          )}
          {option.category && (
            <span className="text-muted-foreground/70">• {option.category}</span>
          )}
          {option.payment_terms && (
            <span className="text-muted-foreground/70">• {option.payment_terms}</span>
          )}
        </div>
      </div>
      {selected && <Check className="size-4 text-primary flex-shrink-0 mt-0.5" />}
    </button>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}
