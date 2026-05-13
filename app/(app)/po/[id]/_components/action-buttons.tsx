"use client";

/**
 * Action buttons + form mounting
 * รองรับ: ดาวน์โหลด PDF, สั่งซื้อ, อัปเดตขนส่ง, รับของ, ปิดงาน, คัดลอก, ยกเลิก
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy, X, CheckCircle2, Undo2,
  ShoppingCart, Truck, PackageOpen, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import {
  closePoAction, cancelPoAction, revertStatusAction,
} from "@/lib/actions/po";
import type { PoStatus, PoItem } from "@/lib/types/db";
import type { SupplierOption } from "@/lib/types/db";
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
  po, isAdmin, canCancel, supplierOptions, deliveries = [],
}: {
  po: PoSummary;
  isAdmin: boolean;
  canCancel: boolean;
  supplierOptions: SupplierOption[];
  /** ประวัติการรับของ — ใช้คำนวณจำนวนคงเหลือใน ReceiveForm */
  deliveries?: import("@/lib/types/db").PoDelivery[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmRevertOpen, setConfirmRevertOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [revertReason, setRevertReason] = useState("");
  const [formMode, setFormMode] = useState<FormMode>(null);

  const canClose = ["รับของแล้ว", "มีปัญหา"].includes(po.status);
  const canOrder = isAdmin && po.status === "รอจัดซื้อดำเนินการ";
  const canShip = isAdmin && po.status === "สั่งซื้อแล้ว";
  // รับของได้:
  //  - "กำลังขนส่ง"  → รับครั้งแรก
  //  - "รับของแล้ว"  → supplier ส่งของแยกหลายรอบ — รับเพิ่มได้
  //  - "มีปัญหา"      → ของยังมาไม่ครบ/ของเสีย → รับเพิ่มเพื่อ resolve ได้
  const canReceive = ["กำลังขนส่ง", "รับของแล้ว", "มีปัญหา"].includes(po.status);
  // แสดง hint เมื่อยังกดรับไม่ได้ (status ยังเป็น "สั่งซื้อแล้ว")
  const receiveBlockedHint = po.status === "สั่งซื้อแล้ว";
  const showCancelBtn = canCancel && !["เสร็จสมบูรณ์", "ยกเลิก"].includes(po.status);

  // ย้อนสถานะ (admin/supervisor) — แสดงเฉพาะ status ที่ revert ได้
  const REVERTIBLE: PoStatus[] = ["สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์"];
  const canRevert = isAdmin && REVERTIBLE.includes(po.status);
  const REVERT_TARGET: Partial<Record<PoStatus, PoStatus>> = {
    "สั่งซื้อแล้ว": "รอจัดซื้อดำเนินการ",
    "กำลังขนส่ง": "สั่งซื้อแล้ว",
    "รับของแล้ว": "กำลังขนส่ง",
    "มีปัญหา": "กำลังขนส่ง",
    "เสร็จสมบูรณ์": "รับของแล้ว",
  };
  const revertTarget = REVERT_TARGET[po.status];

  function handleClose() {
    startTransition(async () => {
      const res = await closePoAction(po.id);
      if (res.ok) {
        toast.success(`✅ ปิดงาน ${po.po_number} สำเร็จ`);
        setConfirmCloseOpen(false);
        router.refresh();
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
        router.refresh();
      } else {
        toast.error(res.error ?? "ยกเลิกไม่สำเร็จ");
      }
    });
  }

  function handleRevert() {
    if (!revertReason.trim()) {
      toast.error("กรุณากรอกเหตุผลที่ย้อน");
      return;
    }
    startTransition(async () => {
      const res = await revertStatusAction(po.id, revertReason);
      if (res.ok) {
        toast.success(`↩️ ย้อนสถานะ ${po.po_number} → ${revertTarget}`);
        setConfirmRevertOpen(false);
        setRevertReason("");
        router.refresh();
      } else {
        toast.error(res.error ?? "ย้อนไม่สำเร็จ");
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
            <PackageOpen className="h-3.5 w-3.5" />
            {po.status === "กำลังขนส่ง" ? "รับของ" : "รับของเพิ่ม"}
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

        {/* Revert (admin only) — ย้อนสถานะ 1 step */}
        {canRevert && revertTarget && (
          <Button
            variant="secondary" size="sm" fullWidth
            onClick={() => setConfirmRevertOpen(true)}
            disabled={pending}
            className="h-10 !text-amber-700 hover:!bg-amber-50 hover:!border-amber-300"
            title={`ย้อนกลับเป็น "${revertTarget}"`}
          >
            <Undo2 className="h-3.5 w-3.5" /> ย้อนสถานะ
          </Button>
        )}
      </div>

      {/* Hint when receive is blocked (status is สั่งซื้อแล้ว — needs admin to ship first) */}
      {receiveBlockedHint && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <Truck className="size-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="leading-snug">
            <span className="font-bold">ยังกดรับของไม่ได้</span> —
            กรุณารอแอดมินกด <strong>"อัปเดตขนส่ง"</strong> เพื่อเปลี่ยนสถานะเป็น
            <strong> "กำลังขนส่ง"</strong> ก่อน
          </div>
        </div>
      )}

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

      <ConfirmDialog
        open={confirmRevertOpen}
        onOpenChange={(o) => {
          setConfirmRevertOpen(o);
          if (!o) setRevertReason("");
        }}
        title={`ย้อนสถานะ ${po.po_number}?`}
        description={
          <div className="space-y-1.5">
            <div>
              ย้อนจาก <strong className="text-amber-700">{po.status}</strong>
              {" → "}
              <strong className="text-amber-700">{revertTarget}</strong>
            </div>
            {po.status === "สั่งซื้อแล้ว" && (
              <div className="text-xs text-muted-foreground">
                ⚠️ จะล้างข้อมูล supplier + ราคา + วันที่ทั้งหมด
              </div>
            )}
            {po.status === "กำลังขนส่ง" && (
              <div className="text-xs text-muted-foreground">
                ⚠️ จะล้าง tracking number
              </div>
            )}
            {(po.status === "รับของแล้ว" || po.status === "มีปัญหา") && (
              <div className="text-xs text-muted-foreground">
                ⚠️ จะลบ delivery รอบล่าสุด + ถอย stock กลับ (block ถ้ามีการเบิก lot นี้แล้ว)
              </div>
            )}
            {po.status === "เสร็จสมบูรณ์" && (
              <div className="text-xs text-muted-foreground">
                ↩️ เปิดงานใหม่ — รับของเพิ่ม / ปิดงานอีกครั้งได้
              </div>
            )}
          </div>
        }
        confirmText="ยืนยันย้อนสถานะ"
        variant="warning"
        loading={pending}
        requireReason
        reasonPlaceholder="เช่น: กดผิด / ต้องแก้ข้อมูล / supplier โทรกลับ"
        reasonValue={revertReason}
        onReasonChange={setRevertReason}
        onConfirm={handleRevert}
      />

      {/* Inline forms */}
      {formMode === "order" && (
        <OrderForm
          poId={po.id}
          poNumber={po.po_number}
          items={po.items}
          supplierOptions={supplierOptions}
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
          deliveries={deliveries}
          onClose={() => setFormMode(null)}
        />
      )}

    </div>
  );
}
