"use client";

/**
 * TotalsCard — แสดง "ยอดสุทธิ" + ปุ่ม "แก้ราคา" (admin only)
 *
 * แสดงเสมอสำหรับ admin ในสถานะที่แก้ราคาได้ (post-order, non-cancelled)
 * แม้ total = 0 → แสดง "ยังไม่มีราคา" + ปุ่มให้เพิ่ม
 */
import { useState } from "react";
import { Pencil, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PoItem, PoStatus } from "@/lib/types/db";
import { EditPricesDialog } from "./edit-prices-dialog";

function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TotalsCard({
  poId,
  poNumber,
  status,
  items,
  subtotal,
  discount,
  shippingFee,
  vat,
  total,
  canEdit,
}: {
  poId: string;
  poNumber: string;
  status: PoStatus;
  items: PoItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  vat: number;
  total: number;
  /** admin/supervisor + status post-order + non-cancelled */
  canEdit: boolean;
}) {
  const [showEdit, setShowEdit] = useState(false);

  const hasPrice = total > 0;
  const emptyPrice = !hasPrice && items.length > 0;

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              💰 ยอดสุทธิ
            </h2>
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowEdit(true)}
                className="!text-xs"
                title="แก้ราคาต่อรายการ + discount + shipping + VAT"
              >
                <Pencil className="size-3.5" /> แก้ราคา
              </Button>
            )}
          </div>

          {emptyPrice ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              ⚠️ PO นี้ยังไม่มีราคา — {canEdit ? "กด \"แก้ราคา\" เพื่อกรอกราคา" : "รอ admin กรอกราคา"}
            </div>
          ) : (
            <dl className="space-y-1.5 text-sm">
              <SumRow label="ยอดรวม" value={subtotal} />
              {discount > 0 && <SumRow label="ส่วนลด" value={-discount} />}
              {shippingFee > 0 && <SumRow label="ค่าส่ง" value={shippingFee} />}
              {vat > 0 && <SumRow label="VAT" value={vat} />}
              <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">รวมสุทธิ</span>
                <span className="text-2xl font-bold text-brand-700 tabular-nums">
                  ฿{fmtMoney(total)}
                </span>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {showEdit && (
        <EditPricesDialog
          poId={poId}
          poNumber={poNumber}
          items={items}
          initialDiscount={discount}
          initialShippingFee={shippingFee}
          initialVat={vat}
          initialSubtotal={subtotal}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}

function SumRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-slate-600">{label}:</dt>
      <dd className="text-slate-800 tabular-nums">
        {value < 0 ? "−" : ""}฿{fmtMoney(Math.abs(value))}
      </dd>
    </div>
  );
}
