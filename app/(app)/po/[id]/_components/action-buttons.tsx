"use client";

/**
 * Action buttons + form mounting
 * รองรับ: ดาวน์โหลด PDF, สั่งซื้อ, อัปเดตขนส่ง, รับของ, ปิดงาน, คัดลอก, ยกเลิก
 */
import { useState, useTransition } from "react";
import {
  Copy, X, CheckCircle2, AlertTriangle,
  ShoppingCart, Truck, PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  closePoAction, cancelPoAction, clonePoAction,
} from "@/lib/actions/po";
import type { PoStatus, PoItem } from "@/lib/types/db";
import type { SupplierEntry } from "@/lib/types/db";
import { OrderForm } from "./order-form";
import { ShipForm } from "./ship-form";
import { ReceiveForm } from "./receive-form";

type FormMode = null | "order" | "ship" | "receive";

interface PoSummary {
  id: string;
  po_number: string;
  status: PoStatus;
  items: PoItem[];
  supplier_name: string | null;
  supplier_contact: string | null;
  tracking_number: string | null;
  expected_date: string | null;
}

export function ActionButtons({
  po, isAdmin, canCancel, suppliers,
}: {
  po: PoSummary;
  isAdmin: boolean;
  canCancel: boolean;
  suppliers: SupplierEntry[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [formMode, setFormMode] = useState<FormMode>(null);

  const canClose = ["รับของแล้ว", "มีปัญหา"].includes(po.status);
  const canOrder = isAdmin && po.status === "รอจัดซื้อดำเนินการ";
  const canShip = isAdmin && po.status === "สั่งซื้อแล้ว";
  const canReceive = ["สั่งซื้อแล้ว", "กำลังขนส่ง"].includes(po.status);
  const showCancelBtn = canCancel && !["เสร็จสมบูรณ์", "ยกเลิก"].includes(po.status);

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const res = await closePoAction(po.id);
      if (!res.ok) setError(res.error ?? "ปิดงานไม่สำเร็จ");
      setConfirmClose(false);
    });
  }

  function handleCancel() {
    if (!cancelReason.trim()) {
      setError("กรุณากรอกเหตุผล");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelPoAction(po.id, cancelReason);
      if (!res.ok) setError(res.error ?? "ยกเลิกไม่สำเร็จ");
      else setShowCancel(false);
    });
  }

  function handleClone() {
    setError(null);
    startTransition(async () => {
      try {
        await clonePoAction(po.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("NEXT_REDIRECT")) setError("คัดลอกไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* PDF download */}
        {po.status !== "รอจัดซื้อดำเนินการ" && (
          <a
            href={`/api/po/${po.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-9 px-3 text-xs font-semibold rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm hover:shadow-brand hover:-translate-y-px transition-all"
          >
            📥 ดาวน์โหลด PDF
          </a>
        )}

        {/* Order */}
        {canOrder && (
          <Button
            variant="primary" size="sm"
            onClick={() => setFormMode(formMode === "order" ? null : "order")}
            disabled={pending}
          >
            <ShoppingCart className="h-3.5 w-3.5" /> สั่งซื้อ
          </Button>
        )}

        {/* Ship */}
        {canShip && (
          <Button
            variant="secondary" size="sm"
            onClick={() => setFormMode(formMode === "ship" ? null : "ship")}
            disabled={pending}
          >
            <Truck className="h-3.5 w-3.5" /> อัปเดตขนส่ง
          </Button>
        )}

        {/* Receive */}
        {canReceive && (
          <Button
            variant="secondary" size="sm"
            onClick={() => setFormMode(formMode === "receive" ? null : "receive")}
            disabled={pending}
          >
            <PackageOpen className="h-3.5 w-3.5" /> รับของ
          </Button>
        )}

        {/* Close */}
        {canClose && (
          confirmClose ? (
            <Button variant="primary" size="sm" loading={pending} onClick={handleClose}>
              ⚠️ ยืนยันปิดงาน
            </Button>
          ) : (
            <Button
              variant="secondary" size="sm"
              onClick={() => setConfirmClose(true)}
              disabled={pending}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> ปิดงาน
            </Button>
          )
        )}

        {/* Clone */}
        <Button
          variant="secondary" size="sm"
          onClick={handleClone}
          loading={pending}
        >
          <Copy className="h-3.5 w-3.5" /> คัดลอก
        </Button>

        {/* Cancel */}
        {showCancelBtn && (
          <Button
            variant="secondary" size="sm"
            onClick={() => setShowCancel(true)}
            disabled={pending}
            className="!text-red-600 hover:!bg-red-50 hover:!border-red-300"
          >
            <X className="h-3.5 w-3.5" /> ยกเลิก
          </Button>
        )}
      </div>

      {/* Confirm close note */}
      {confirmClose && !pending && (
        <Alert tone="warning" className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>ยืนยันปิดงาน {po.po_number}?</strong>
            <div className="text-xs mt-0.5">สถานะจะเปลี่ยนเป็น "เสร็จสมบูรณ์"</div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClose(false)}
            className="text-xs underline hover:no-underline flex-shrink-0"
          >
            ยกเลิก
          </button>
        </Alert>
      )}

      {/* Cancel form */}
      {showCancel && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-700">ยกเลิกใบ PO {po.po_number}</div>
              <div className="text-xs text-red-700">การยกเลิกจะไม่สามารถเรียกคืนได้</div>
            </div>
          </div>
          <textarea
            placeholder="เหตุผล * (เช่น Supplier แจ้งของหมด)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={pending}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="primary" size="sm"
              loading={pending}
              onClick={handleCancel}
              className="!from-red-600 !to-red-700 hover:!from-red-700 hover:!to-red-800"
            >
              ⚠️ ยืนยันยกเลิก
            </Button>
            <Button
              variant="secondary" size="sm"
              onClick={() => { setShowCancel(false); setCancelReason(""); setError(null); }}
              disabled={pending}
            >
              กลับ
            </Button>
          </div>
        </div>
      )}

      {/* Inline forms */}
      {formMode === "order" && (
        <OrderForm
          poId={po.id}
          poNumber={po.po_number}
          items={po.items}
          suppliers={suppliers}
          initialSupplier={po.supplier_name}
          initialContact={po.supplier_contact}
          onClose={() => setFormMode(null)}
        />
      )}
      {formMode === "ship" && (
        <ShipForm
          poId={po.id}
          poNumber={po.po_number}
          initialTracking={po.tracking_number}
          onClose={() => setFormMode(null)}
        />
      )}
      {formMode === "receive" && (
        <ReceiveForm
          poId={po.id}
          poNumber={po.po_number}
          supplier={po.supplier_name}
          tracking={po.tracking_number}
          expectedDate={po.expected_date}
          items={po.items}
          onClose={() => setFormMode(null)}
        />
      )}

      {/* Error (top-level) */}
      {error && <Alert tone="danger">❌ {error}</Alert>}
    </div>
  );
}
