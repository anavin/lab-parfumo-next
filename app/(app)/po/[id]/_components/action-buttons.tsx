"use client";

/**
 * Action buttons + form mounting
 * รองรับ: ดาวน์โหลด PDF, สั่งซื้อ, อัปเดตขนส่ง, รับของ, ปิดงาน, คัดลอก, ยกเลิก
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy, X, CheckCircle2,
  ShoppingCart, Truck, PackageOpen, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import {
  closePoAction, cancelPoAction,
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [formMode, setFormMode] = useState<FormMode>(null);

  const canClose = ["รับของแล้ว", "มีปัญหา"].includes(po.status);
  const canOrder = isAdmin && po.status === "รอจัดซื้อดำเนินการ";
  const canShip = isAdmin && po.status === "สั่งซื้อแล้ว";
  const canReceive = ["สั่งซื้อแล้ว", "กำลังขนส่ง"].includes(po.status);
  const showCancelBtn = canCancel && !["เสร็จสมบูรณ์", "ยกเลิก"].includes(po.status);

  function handleClose() {
    startTransition(async () => {
      const res = await closePoAction(po.id);
      if (res.ok) {
        toast.success(`✅ ปิดงาน ${po.po_number} สำเร็จ`);
        setConfirmCloseOpen(false);
      } else {
        toast.error(res.error ?? "ปิดงานไม่สำเร็จ");
      }
    });
  }

  function handleCancel() {
    if (!cancelReason.trim()) {
      toast.error("กรุณากรอกเหตุผล");
      return;
    }
    startTransition(async () => {
      const res = await cancelPoAction(po.id, cancelReason);
      if (res.ok) {
        toast.success(`✅ ยกเลิก ${po.po_number} สำเร็จ`);
        setConfirmCancelOpen(false);
        setCancelReason("");
      } else {
        toast.error(res.error ?? "ยกเลิกไม่สำเร็จ");
      }
    });
  }

  function handleClone() {
    // Navigate to /po/new with clone source — user can edit items before submit
    router.push(`/po/new?clone=${po.id}`);
  }

  return (
    <div className="space-y-3">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        {/* PDF download */}
        {po.status !== "รอจัดซื้อดำเนินการ" && (
          <a
            href={`/api/po/${po.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-10 px-3 text-xs font-semibold rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm hover:shadow-brand hover:-translate-y-px transition-all"
          >
            <Download className="h-3.5 w-3.5" /> ดาวน์โหลด PDF
          </a>
        )}

        {/* Order */}
        {canOrder && (
          <Button
            variant="primary" size="sm" fullWidth
            className="h-10"
            onClick={() => setFormMode(formMode === "order" ? null : "order")}
            disabled={pending}
          >
            <ShoppingCart className="h-3.5 w-3.5" /> สั่งซื้อ
          </Button>
        )}

        {/* Ship */}
        {canShip && (
          <Button
            variant="secondary" size="sm" fullWidth
            className="h-10"
            onClick={() => setFormMode(formMode === "ship" ? null : "ship")}
            disabled={pending}
          >
            <Truck className="h-3.5 w-3.5" /> อัปเดตขนส่ง
          </Button>
        )}

        {/* Receive */}
        {canReceive && (
          <Button
            variant="secondary" size="sm" fullWidth
            className="h-10"
            onClick={() => setFormMode(formMode === "receive" ? null : "receive")}
            disabled={pending}
          >
            <PackageOpen className="h-3.5 w-3.5" /> รับของ
          </Button>
        )}

        {/* Close */}
        {canClose && (
          <Button
            variant="secondary" size="sm" fullWidth
            className="h-10"
            onClick={() => setConfirmCloseOpen(true)}
            disabled={pending}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> ปิดงาน
          </Button>
        )}

        {/* Clone — navigate to /po/new?clone=ID, edit before save */}
        <Button
          variant="secondary" size="sm" fullWidth
          className="h-10"
          onClick={handleClone}
          disabled={pending}
          title="คัดลอกใบนี้ — แก้ไขรายการก่อนบันทึก"
        >
          <Copy className="h-3.5 w-3.5" /> คัดลอก
        </Button>

        {/* Cancel */}
        {showCancelBtn && (
          <Button
            variant="secondary" size="sm" fullWidth
            onClick={() => setConfirmCancelOpen(true)}
            disabled={pending}
            className="h-10 !text-red-600 hover:!bg-red-50 hover:!border-red-300"
          >
            <X className="h-3.5 w-3.5" /> ยกเลิก
          </Button>
        )}
      </div>

      {/* Confirm close dialog */}
      <ConfirmDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        title={`ปิดงาน ${po.po_number}?`}
        description="สถานะจะเปลี่ยนเป็น &quot;เสร็จสมบูรณ์&quot; — ปิดงานแล้วจะไม่กลับไปแก้สถานะอื่นได้"
        confirmText="ปิดงาน"
        variant="warning"
        loading={pending}
        onConfirm={handleClose}
      />

      {/* Confirm cancel dialog */}
      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={(o) => {
          setConfirmCancelOpen(o);
          if (!o) setCancelReason("");
        }}
        title={`ยกเลิกใบ PO ${po.po_number}?`}
        description="การยกเลิกจะไม่สามารถเรียกคืนได้ — กรุณาระบุเหตุผล"
        confirmText="ยืนยันยกเลิก"
        variant="danger"
        loading={pending}
        requireReason
        reasonPlaceholder="เช่น: Supplier แจ้งของหมด / ของไม่ตรงสเปก / ลูกค้าเปลี่ยนใจ"
        reasonValue={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={handleCancel}
      />

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

    </div>
  );
}
