"use client";

/**
 * PO Create — main client component (state management for cart)
 */
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Save, X, ShoppingCart, FolderOpen, ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { createPoAction } from "@/lib/actions/po";
import type { Equipment, PoItem, Lookup } from "@/lib/types/db";
import { EquipmentGrid } from "./equipment-grid";
import { CustomItemForm } from "./custom-item-form";
import { CartItems } from "./cart-items";

export function PoCreateClient({
  equipment, categories, units,
  initialItems, initialNotes,
}: {
  equipment: Equipment[];
  categories: string[];
  units?: Lookup[];
  initialItems?: PoItem[];
  initialNotes?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<PoItem[]>(initialItems ?? []);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ทั้งหมด");

  // ===== Filter equipment =====
  const filteredEq = useMemo(() => {
    let out = equipment;
    if (category !== "ทั้งหมด") {
      out = out.filter((e) => e.category === category);
    }
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((e) =>
        (e.name ?? "").toLowerCase().includes(s) ||
        (e.sku ?? "").toLowerCase().includes(s) ||
        (e.description ?? "").toLowerCase().includes(s),
      );
    }
    return out;
  }, [equipment, category, search]);

  // ===== Group filtered items by category =====
  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, Equipment[]>();
    for (const c of categories) groups.set(c, []);
    const noCategory: Equipment[] = [];
    for (const eq of filteredEq) {
      const c = (eq.category ?? "").trim();
      if (c) {
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push(eq);
      } else {
        noCategory.push(eq);
      }
    }
    const result: Array<{ name: string; items: Equipment[] }> = [];
    for (const [name, items] of groups) {
      if (items.length > 0) result.push({ name, items });
    }
    if (noCategory.length > 0) {
      result.push({ name: "ไม่ระบุหมวดหมู่", items: noCategory });
    }
    return result;
  }, [filteredEq, categories]);

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
    if (allCollapsed) setCollapsed(new Set());
    else setCollapsed(new Set(groupedByCategory.map((g) => g.name)));
  }

  // ===== Cart actions =====
  const selectedEqIds = useMemo(
    () => new Set(items.filter((it) => it.equipment_id).map((it) => it.equipment_id!)),
    [items],
  );

  function toggleEquipment(eq: Equipment) {
    setItems((cur) => {
      if (selectedEqIds.has(eq.id)) {
        return cur.filter((it) => it.equipment_id !== eq.id);
      }
      return [...cur, {
        equipment_id: eq.id,
        name: eq.name,
        unit: eq.unit ?? "ชิ้น",
        qty: 1,
        notes: "",
      }];
    });
  }

  function addCustomItem(
    name: string, qty: number, unit: string, itemNotes: string,
    imageUrls: string[] = [],
  ) {
    setItems((cur) => [
      ...cur,
      {
        equipment_id: null,
        name, qty, unit, notes: itemNotes,
        image_urls: imageUrls,
      },
    ]);
  }

  function updateQty(idx: number, qty: number) {
    setItems((cur) => cur.map((it, i) =>
      i === idx ? { ...it, qty: Math.max(1, qty) } : it,
    ));
  }

  function removeItem(idx: number) {
    setItems((cur) => cur.filter((_, i) => i !== idx));
  }

  function clearCart() {
    setItems([]);
    setNotes("");
  }

  // ===== Submit =====
  function handleSubmit() {
    setError(null);
    if (!items.length) {
      setError("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
      return;
    }
    startTransition(async () => {
      const res = await createPoAction(items, notes);
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      router.push(`/po/${res.poId}`);
    });
  }

  return (
    <div className="space-y-5">
      {/* ===== Cart (TOP — visible whenever items exist) ===== */}
      {items.length > 0 && (
        <Card className="bg-brand-50/60 border-brand-300 ring-1 ring-brand-200/40 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-brand-700" />
                <h2 className="text-base font-bold text-slate-900">
                  รายการในใบ PO ({items.length})
                </h2>
              </div>
              <div className="text-[11px] text-muted-foreground">
                เลือก / แก้จำนวน → กดบันทึกด้านล่าง
              </div>
            </div>

            <CartItems
              items={items}
              equipment={equipment}
              onUpdateQty={updateQty}
              onRemove={removeItem}
            />

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                📝 หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น ต้องการให้ส่งเร็ว"
                rows={2}
                disabled={pending}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
              />
            </div>

            {error && <Alert tone="danger">❌ {error}</Alert>}

            {/* Submit */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                onClick={handleSubmit}
                loading={pending}
              >
                <Save className="h-4 w-4" />
                {pending ? "กำลังบันทึก..." : "บันทึกใบ PO"}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={clearCart}
                disabled={pending}
              >
                <X className="h-4 w-4" /> ล้างทั้งหมด
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Search + Filter ===== */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            📦 {items.length > 0 ? "เพิ่มรายการเพิ่มเติม" : "เลือกรายการที่ต้องการ"}
          </h2>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input
              type="search"
              placeholder="🔍 ชื่อสินค้า / SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:col-span-2"
            />
            <select
              className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ทั้งหมด">📂 ทั้งหมด</option>
              {categories.map((c) => (
                <option key={c} value={c}>📂 {c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
            <span className="text-slate-500">
              พบ <strong>{filteredEq.length}</strong> รายการ ใน <strong>{groupedByCategory.length}</strong> หมวด — คลิกการ์ดเพื่อเพิ่ม
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
          </div>
        </CardContent>
      </Card>

      {/* ===== Equipment grouped by category ===== */}
      {filteredEq.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            ไม่พบรายการที่ตรงกับเงื่อนไข — ลองเปลี่ยนคำค้นหา หรือใช้ &quot;พิมพ์ชื่อเอง&quot; ด้านล่าง
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByCategory.map((group) => {
            const isCollapsed = collapsed.has(group.name);
            return (
              <section
                key={group.name}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(group.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                  aria-expanded={!isCollapsed}
                >
                  <span className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="size-4" strokeWidth={2.25} />
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

                {!isCollapsed && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/40">
                    <EquipmentGrid
                      items={group.items}
                      selectedIds={selectedEqIds}
                      onToggle={toggleEquipment}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ===== Custom item form ===== */}
      <CustomItemForm onAdd={addCustomItem} units={units} />

      {/* Empty hint at bottom (only when no items) */}
      {items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            👆 คลิกการ์ดสินค้าด้านบน หรือกด &quot;พิมพ์ชื่อเอง&quot; เพื่อเริ่มเพิ่มรายการ
          </CardContent>
        </Card>
      )}
    </div>
  );
}
