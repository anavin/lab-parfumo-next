"use client";

/**
 * Order form (admin) — กรอก supplier + ราคาแต่ละรายการ + VAT/discount
 */
import { useState, useTransition, useMemo } from "react";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { updateProcurementAction } from "@/lib/actions/po";
import type { PoItem } from "@/lib/types/db";
import type { SupplierEntry } from "@/lib/db/po";

const NEW_SUPPLIER = "+ พิมพ์ supplier ใหม่";

export function OrderForm({
  poId, poNumber, items, suppliers,
  initialSupplier, initialContact,
  onClose,
}: {
  poId: string;
  poNumber: string;
  items: PoItem[];
  suppliers: SupplierEntry[];
  initialSupplier: string | null;
  initialContact: string | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Supplier autocomplete
  const supNames = useMemo(() => suppliers.map((s) => s.name), [suppliers]);
  const [supChoice, setSupChoice] = useState<string>(() => {
    if (initialSupplier && supNames.includes(initialSupplier)) return initialSupplier;
    return NEW_SUPPLIER;
  });
  const [customSup, setCustomSup] = useState(
    initialSupplier && !supNames.includes(initialSupplier) ? initialSupplier : "",
  );
  const [supplierContact, setSupplierContact] = useState(initialContact ?? "");

  // Auto-fill contact เมื่อเลือก supplier เก่า
  function handleSupplierChange(v: string) {
    setSupChoice(v);
    if (v !== NEW_SUPPLIER) {
      const found = suppliers.find((s) => s.name === v);
      if (found && !supplierContact && found.lastContact) {
        setSupplierContact(found.lastContact);
      }
    }
  }

  const supplierName = supChoice === NEW_SUPPLIER ? customSup : supChoice;

  // Item prices
  const [prices, setPrices] = useState<number[]>(() =>
    items.map((it) => it.unit_price ?? 0),
  );
  function updatePrice(idx: number, value: number) {
    setPrices((cur) => cur.map((p, i) => (i === idx ? Math.max(0, value) : p)));
  }

  // Footer
  const [discount, setDiscount] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [vatPct, setVatPct] = useState<"none" | "7">("none");
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [procNotes, setProcNotes] = useState("");

  // Compute totals
  const subtotal = useMemo(
    () => items.reduce((s, it, i) => s + (it.qty ?? 0) * (prices[i] ?? 0), 0),
    [items, prices],
  );
  const vatRate = vatPct === "7" ? 0.07 : 0;
  const vat = subtotal * vatRate;
  const total = subtotal - discount + shippingFee + vat;

  function handleSubmit() {
    setError(null);
    if (!supplierName.trim()) {
      setError("กรุณากรอกชื่อ supplier");
      return;
    }
    startTransition(async () => {
      const res = await updateProcurementAction(poId, {
        supplierName,
        supplierContact,
        itemPrices: prices.map((p) => ({ unit_price: p })),
        discount,
        shippingFee,
        vatRate,
        expectedDate,
        procurementNotes: procNotes,
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onClose();
    });
  }

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 text-white p-4 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
          <ShoppingCart className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold">สั่งซื้อกับ Supplier — {poNumber}</div>
          <div className="text-xs text-white/85">
            กรอก supplier + ราคาแต่ละรายการ + วันที่คาดได้รับ
          </div>
        </div>
      </div>

      {/* Supplier selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          🏭 Supplier <span className="text-slate-400 text-xs">— เลือกจากประวัติ ({supNames.length}) หรือพิมพ์ใหม่</span>
        </label>
        <select
          className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          value={supChoice}
          onChange={(e) => handleSupplierChange(e.target.value)}
          disabled={pending}
        >
          <option value={NEW_SUPPLIER}>{NEW_SUPPLIER}</option>
          {supNames.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {supChoice === NEW_SUPPLIER && (
          <Input
            value={customSup}
            onChange={(e) => setCustomSup(e.target.value)}
            placeholder="ชื่อ Supplier *"
            className="mt-2"
            disabled={pending}
          />
        )}
      </div>

      {/* Two-column: contact + dates */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            ข้อมูลติดต่อ
          </label>
          <textarea
            value={supplierContact}
            onChange={(e) => setSupplierContact(e.target.value)}
            placeholder="เบอร์ / อีเมล / ที่อยู่"
            rows={3}
            disabled={pending}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
          />
          <div className="text-[11px] text-slate-400 mt-1">
            💡 autofill จากประวัติ — แก้ไขได้
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            🎯 วันที่คาดว่าได้รับ *
          </label>
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            disabled={pending}
            className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* Item prices */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          💰 ราคาต่อรายการ
        </label>
        <div className="space-y-2">
          {items.map((it, i) => {
            const lineTotal = (prices[i] ?? 0) * (it.qty ?? 0);
            return (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-2.5"
              >
                <div className="col-span-12 sm:col-span-5 text-sm font-semibold text-slate-900 truncate">
                  {it.name}
                </div>
                <div className="col-span-3 sm:col-span-2 text-xs text-slate-500">
                  {it.qty.toLocaleString("th-TH")} {it.unit}
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prices[i] ?? 0}
                    onChange={(e) => updatePrice(i, parseFloat(e.target.value) || 0)}
                    placeholder="ราคา/หน่วย"
                    disabled={pending}
                    className="h-9 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 text-right tabular-nums"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 text-right text-sm font-semibold text-brand-700 tabular-nums">
                  ฿{lineTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer (discount, shipping, vat) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">ส่วนลด (฿)</label>
          <input
            type="number" min="0" step="10"
            value={discount}
            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
            disabled={pending}
            className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">ค่าส่ง (฿)</label>
          <input
            type="number" min="0" step="10"
            value={shippingFee}
            onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
            disabled={pending}
            className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">VAT</label>
          <select
            value={vatPct}
            onChange={(e) => setVatPct(e.target.value as "none" | "7")}
            disabled={pending}
            className="h-10 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm"
          >
            <option value="none">ไม่มี</option>
            <option value="7">7%</option>
          </select>
        </div>
      </div>

      {/* Total summary */}
      <div className="bg-brand-50 border border-brand-300 rounded-xl p-3 space-y-1 text-sm">
        <div className="flex justify-between text-slate-700">
          <span>ยอดรวม:</span>
          <span className="tabular-nums">฿{subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>ส่วนลด:</span>
            <span className="tabular-nums">-฿{discount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {shippingFee > 0 && (
          <div className="flex justify-between text-slate-700">
            <span>ค่าส่ง:</span>
            <span className="tabular-nums">฿{shippingFee.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {vat > 0 && (
          <div className="flex justify-between text-slate-700">
            <span>VAT 7%:</span>
            <span className="tabular-nums">฿{vat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between pt-1.5 mt-1.5 border-t border-brand-200 text-base font-bold">
          <span className="text-slate-900">ยอดสุทธิ:</span>
          <span className="text-brand-700 tabular-nums">฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          📝 หมายเหตุจัดซื้อ
        </label>
        <textarea
          value={procNotes}
          onChange={(e) => setProcNotes(e.target.value)}
          placeholder="เช่น ตกลงราคาแล้ว / เงื่อนไขพิเศษ"
          rows={2}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 disabled:bg-slate-100"
        />
      </div>

      {error && <Alert tone="danger">❌ {error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSubmit} loading={pending}>
          ✅ ยืนยันสั่งซื้อ
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          <X className="h-4 w-4" /> ยกเลิก
        </Button>
        <p className="text-[11px] text-slate-400 italic flex items-center px-2">
          💡 แนบไฟล์ใบเสนอราคา — มาใน Phase 6
        </p>
      </div>
    </div>
  );
}
