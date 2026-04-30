"use client";

import { useMemo, useState } from "react";
import {
  Plus, Search, ChevronDown, ChevronRight, FolderOpen, Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import type { Equipment } from "@/lib/types/db";
import { PendingApproval } from "./pending-approval";
import { EquipmentGrid } from "./equipment-grid";
import { AddEquipmentDialog } from "./add-equipment-dialog";
import { BulkImportDialog } from "./bulk-import-dialog";
import { CategoryManager } from "./category-manager";
import type { Lookup } from "@/lib/types/db";

export function EquipmentClient({
  equipment, categories, pending, units,
}: {
  equipment: Equipment[];
  categories: string[];
  pending: Equipment[];
  units: Lookup[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ทั้งหมด");
  const [sortBy, setSortBy] = useState<"name" | "stock_low" | "reorder">("name");
  const [showLowOnly, setShowLowOnly] = useState(false);

  const filtered = useMemo(() => {
    let out = equipment;
    if (category !== "ทั้งหมด") out = out.filter((e) => e.category === category);
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((e) =>
        (e.name ?? "").toLowerCase().includes(s) ||
        (e.sku ?? "").toLowerCase().includes(s),
      );
    }
    if (showLowOnly) {
      out = out.filter((e) =>
        (e.reorder_level ?? 0) > 0 && (e.stock ?? 0) <= (e.reorder_level ?? 0),
      );
    }
    if (sortBy === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "stock_low") out = [...out].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    else if (sortBy === "reorder") {
      out = [...out].sort((a, b) => {
        const aRl = a.reorder_level ?? 0;
        const bRl = b.reorder_level ?? 0;
        // มี reorder + ใกล้/เลย ขึ้นก่อน
        if (aRl > 0 && bRl > 0) return ((a.stock ?? 0) - aRl) - ((b.stock ?? 0) - bRl);
        if (aRl > 0) return -1;
        if (bRl > 0) return 1;
        return (a.stock ?? 0) - (b.stock ?? 0);
      });
    }
    return out;
  }, [equipment, category, search, sortBy, showLowOnly]);

  // Count equipment per category
  const equipmentByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of equipment) {
      if (e.category) m[e.category] = (m[e.category] ?? 0) + 1;
    }
    return m;
  }, [equipment]);

  // Group filtered items by category — for category-grouped display
  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, Equipment[]>();
    // Preserve category order from `categories` prop
    for (const c of categories) groups.set(c, []);
    const noCategory: Equipment[] = [];

    for (const eq of filtered) {
      const c = (eq.category ?? "").trim();
      if (c && groups.has(c)) {
        groups.get(c)!.push(eq);
      } else if (c) {
        // Category exists on item but not in categories list (rare)
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push(eq);
      } else {
        noCategory.push(eq);
      }
    }
    // Strip empty categories, append "ไม่ระบุหมวดหมู่" if any
    const result: Array<{ name: string; items: Equipment[] }> = [];
    for (const [name, items] of groups) {
      if (items.length > 0) result.push({ name, items });
    }
    if (noCategory.length > 0) {
      result.push({ name: "ไม่ระบุหมวดหมู่", items: noCategory });
    }
    return result;
  }, [filtered, categories]);

  // Collapsed state per category (default: all expanded)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allCollapsed = collapsed.size > 0 && collapsed.size === groupedByCategory.length;
  function toggleCategory(name: string) {
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function toggleAll() {
    if (allCollapsed) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(groupedByCategory.map((g) => g.name)));
    }
  }

  return (
    <div className="space-y-5">
      {/* Pending approval */}
      {pending.length > 0 && (
        <PendingApproval pending={pending} categories={categories} />
      )}

      {/* Category manager (collapsible) */}
      <CategoryManager
        categories={categories}
        equipmentByCategory={equipmentByCategory}
      />

      {/* Filter row */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select
              className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>ทั้งหมด</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="ชื่อ / SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="name">🔃 ชื่อ A→Z</option>
              <option value="stock_low">🔃 สต็อกน้อย→มาก</option>
              <option value="reorder">🔃 ใกล้ต้องสั่ง 🔴</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5 text-slate-700">
              <input
                type="checkbox"
                checked={showLowOnly}
                onChange={(e) => setShowLowOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              🔴 แสดงเฉพาะที่ stock ≤ reorder level
            </label>
            <span className="ml-auto text-slate-600">
              พบ <strong>{filtered.length}</strong> รายการ ใน <strong>{groupedByCategory.length}</strong> หมวด
            </span>
            {groupedByCategory.length > 1 && (
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {allCollapsed ? (
                  <><ChevronDown className="size-3.5" /> ขยายทั้งหมด</>
                ) : (
                  <><ChevronRight className="size-3.5" /> ย่อทั้งหมด</>
                )}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" /> เพิ่มสินค้าใหม่
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Equipment list — grouped by category, collapsible */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="🧴"
          title="ไม่พบสินค้า"
          text="ลองเปลี่ยนคำค้นหา หรือเพิ่มสินค้าใหม่"
          action={
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> เพิ่มสินค้าใหม่
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {groupedByCategory.map((group) => {
            const isCollapsed = collapsed.has(group.name);
            return (
              <section
                key={group.name}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Category header — clickable to toggle */}
                <button
                  type="button"
                  onClick={() => toggleCategory(group.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                  aria-expanded={!isCollapsed}
                >
                  <span className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="size-4.5" strokeWidth={2.25} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base text-foreground">
                      {group.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {group.items.length} รายการ
                    </div>
                  </div>
                  <span
                    className={`size-7 rounded-md text-muted-foreground flex items-center justify-center transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                    aria-hidden
                  >
                    <ChevronDown className="size-4" />
                  </span>
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/40">
                    <EquipmentGrid items={group.items} categories={categories} units={units} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      {showAdd && (
        <AddEquipmentDialog
          categories={categories}
          units={units}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Bulk import CSV */}
      {showImport && (
        <BulkImportDialog onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
