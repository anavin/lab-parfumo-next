"use client";

/**
 * PO Create — main client component (state management for cart)
 */
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Save, X, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { createPoAction } from "@/lib/actions/po";
import type { Equipment, PoItem } from "@/lib/types/db";
import { EquipmentGrid } from "./equipment-grid";
import { CustomItemForm } from "./custom-item-form";
import { CartItems } from "./cart-items";

export function PoCreateClient({
  equipment, categories,
}: {
  equipment: Equipment[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<PoItem[]>([]);
  const [notes, setNotes] = useState("");
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
      {/* ===== Search + Filter ===== */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">📦 รายการที่ต้องการ</h2>
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
          <div className="text-xs text-slate-500">
            พบ <strong>{filteredEq.length}</strong> รายการ — คลิกการ์ดเพื่อเพิ่ม
          </div>
        </CardContent>
      </Card>

      {/* ===== Equipment grid ===== */}
      {filteredEq.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            ไม่พบรายการที่ตรงกับเงื่อนไข — ลองเปลี่ยนคำค้นหา หรือใช้ "พิมพ์ชื่อเอง" ด้านล่าง
          </CardContent>
        </Card>
      ) : (
        <EquipmentGrid
          items={filteredEq}
          selectedIds={selectedEqIds}
          onToggle={toggleEquipment}
        />
      )}

      {/* ===== Custom item form ===== */}
      <CustomItemForm onAdd={addCustomItem} />

      {/* ===== Cart ===== */}
      {items.length > 0 ? (
        <Card className="bg-brand-50 border-brand-300">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-brand-700" />
              <h2 className="text-base font-bold text-slate-900">
                รายการในใบ PO ({items.length})
              </h2>
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
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            👆 คลิกการ์ดสินค้าด้านบน หรือกด "พิมพ์ชื่อเอง" เพื่อเริ่มเพิ่มรายการ
          </CardContent>
        </Card>
      )}
    </div>
  );
}
