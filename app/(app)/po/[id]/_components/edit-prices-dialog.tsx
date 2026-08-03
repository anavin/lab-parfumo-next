"use client";

/**
 * EditPricesDialog — แก้ราคาต่อรายการ + discount/shipping/vat หลังสั่งไปแล้ว
 *
 * Use case: admin กรอกราคาผิด หรือได้ราคาใหม่จาก supplier
 * Only privileged, non-cancelled, non-draft
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { updatePoPricesAction } from "@/lib/actions/po";
import type { PoItem } from "@/lib/types/db";

function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function EditPricesDialog({
  poId,
  poNumber,
  items,
  initialDiscount,
  initialShippingFee,
  initialVat,
  initialSubtotal,
  onClose,
}: {
  poId: string;
  poNumber: string;
  items: PoItem[];
  initialDiscount: number;
  initialShippingFee: number;
  initialVat: number;
  initialSubtotal: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [prices, setPrices] = useState<number[]>(() =>
    items.map((it) => it.unit_price ?? 0),
  );
  const [discount, setDiscount] = useState(initialDiscount);
  const [shippingFee, setShippingFee] = useState(initialShippingFee);
  // Infer initial VAT rate จาก vat/subtotal ที่มี (ถ้า subtotal>0 และ vat>0 → 7%)
  const [vatPct, setVatPct] = useState<"none" | "7">(() => {
    if (initialSubtotal > 0 && initialVat > 0) {
      const inferred = initialVat / initialSubtotal;
      return inferred > 0.05 ? "7" : "none";
    }
    return "none";
  });

  const subtotal = useMemo(
    () => prices.reduce((s, p, i) => s + p * (items[i]?.qty ?? 0), 0),
    [prices, items],
  );
  const vatRate = vatPct === "7" ? 0.07 : 0;
  const vat = subtotal * vatRate;
  const total = subtotal - discount + shippingFee + vat;

  function updatePrice(idx: number, value: number) {
    setPrices((cur) => cur.map((p, i) => (i === idx ? Math.max(0, value) : p)));
  }

  function handleSave() {
    setError(null);
    if (subtotal <= 0) {
      setError("ยอดรวมต้อง > 0 — กรุณากรอกราคาอย่างน้อย 1 รายการ");
      return;
    }
    // Debug — log what's being sent (visible in browser DevTools)
    console.log("[EditPricesDialog] SAVE", {
      poId, poNumber,
      itemsLength: items.length,
      pricesLength: prices.length,
      prices,
      discount, shippingFee, vatRate,
      computedSubtotal: subtotal, computedTotal: total,
    });
    startTransition(async () => {
      const res = await updatePoPricesAction(poId, {
        itemPrices: prices,
        discount,
        shippingFee,
        vatRate,
      });
      console.log("[EditPricesDialog] RESPONSE", res);
      if (res.ok) {
        toast.success(`✅ แก้ราคา ${poNumber} แล้ว — ยอดรวม ฿${fmtMoney(total)}`);
        // Refresh first, then close — matches OrderForm pattern
        router.refresh();
        onClose();
      } else {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="size-4" strokeWidth={2.5} />
            </span>
            แก้ราคา — {poNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items — ราคา per line */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              💰 ราคาต่อรายการ
            </label>
            <div className="space-y-2">
              {items.map((it, i) => {
                const qty = it.qty ?? 0;
                const lineTotal = (prices[i] ?? 0) * qty;
                return (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center border border-slate-200 rounded-lg p-2.5 bg-slate-50"
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {it.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {qty.toLocaleString("th-TH")} {it.unit ?? "ชิ้น"}
                      </div>
                    </div>
                    <div className="col-span-4">
                      <label className="block text-[10px] text-muted-foreground mb-0.5">ราคา/หน่วย</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={prices[i] === 0 ? "" : prices[i]}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          updatePrice(i, Number.isFinite(v) && v >= 0 ? v : 0);
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        placeholder="0.00"
                        disabled={pending}
                        className="h-9 w-full px-2 rounded-md border border-input bg-white text-sm tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="col-span-3 text-right">
                      <div className="text-[10px] text-muted-foreground">ยอดรวม</div>
                      <div className="text-sm font-bold tabular-nums text-slate-900">
                        ฿{fmtMoney(lineTotal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discount + shipping + VAT */}
          <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ส่วนลด (฿)
              </label>
              <input
                type="number" min="0" step="0.01"
                value={discount === 0 ? "" : discount}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setDiscount(Number.isFinite(v) && v >= 0 ? v : 0);
                }}
                onFocus={(e) => e.currentTarget.select()}
                placeholder="0.00"
                disabled={pending}
                className="h-9 w-full px-3 rounded-md border border-input bg-white text-sm tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ค่าจัดส่ง (฿)
              </label>
              <input
                type="number" min="0" step="0.01"
                value={shippingFee === 0 ? "" : shippingFee}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setShippingFee(Number.isFinite(v) && v >= 0 ? v : 0);
                }}
                onFocus={(e) => e.currentTarget.select()}
                placeholder="0.00"
                disabled={pending}
                className="h-9 w-full px-3 rounded-md border border-input bg-white text-sm tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                VAT
              </label>
              <select
                value={vatPct}
                onChange={(e) => setVatPct(e.target.value as "none" | "7")}
                disabled={pending}
                className="h-9 w-full px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              >
                <option value="none">ไม่มี VAT</option>
                <option value="7">VAT 7%</option>
              </select>
            </div>
          </div>

          {/* Totals summary */}
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">ยอดรวม:</span>
              <span className="tabular-nums">฿{fmtMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-700">
                <span>ส่วนลด:</span>
                <span className="tabular-nums">-฿{fmtMoney(discount)}</span>
              </div>
            )}
            {shippingFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">ค่าจัดส่ง:</span>
                <span className="tabular-nums">฿{fmtMoney(shippingFee)}</span>
              </div>
            )}
            {vat > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">VAT:</span>
                <span className="tabular-nums">฿{fmtMoney(vat)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-emerald-300 font-bold text-base">
              <span>รวมทั้งสิ้น:</span>
              <span className="tabular-nums text-emerald-800">฿{fmtMoney(total)}</span>
            </div>
          </div>

          {error && <Alert tone="danger">❌ {error}</Alert>}

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} loading={pending}>
              ✅ บันทึกราคา
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
