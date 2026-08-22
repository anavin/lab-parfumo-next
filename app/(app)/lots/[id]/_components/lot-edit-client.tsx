"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, AlertTriangle, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  updateLotAction,
  markLotStatusAction,
} from "@/lib/actions/lots";
import type { Lot, LotStatus } from "@/lib/types/db";

const STATUS_LABEL: Record<LotStatus, string> = {
  active: "ใช้งานอยู่",
  depleted: "หมด",
  expired: "หมดอายุ",
  discarded: "ทิ้ง/ทำลาย",
};

export function LotEditClient({ lot }: { lot: Lot }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [confirmStatus, setConfirmStatus] = useState<LotStatus | null>(null);
  const [reason, setReason] = useState("");

  const [supplierLotNo, setSupplierLotNo] = useState(lot.supplier_lot_no ?? "");
  const [manufacturedDate, setManufacturedDate] = useState(lot.manufactured_date ?? "");
  const [expiryDate, setExpiryDate] = useState(lot.expiry_date ?? "");
  const [notes, setNotes] = useState(lot.notes ?? "");

  function save() {
    start(async () => {
      const r = await updateLotAction(lot.id, {
        supplierLotNo,
        manufacturedDate: manufacturedDate || null,
        expiryDate: expiryDate || null,
        notes,
      });
      if (r.ok) {
        toast.success("บันทึกแล้ว");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(r.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }

  function askMarkStatus(status: LotStatus) {
    setReason("");
    setConfirmStatus(status);
  }

  function doMarkStatus() {
    if (!confirmStatus) return;
    const target = confirmStatus;
    start(async () => {
      const r = await markLotStatusAction(lot.id, target, reason || undefined);
      if (r.ok) {
        toast.success("อัปเดตแล้ว");
        setConfirmStatus(null);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(r.error ?? "ทำเครื่องหมายไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5 mr-1.5" />
        แก้ไข
      </Button>

      <ConfirmDialog
        open={!!confirmStatus}
        onOpenChange={(o) => !o && setConfirmStatus(null)}
        title={confirmStatus
          ? `ยืนยันทำเครื่องหมาย "${STATUS_LABEL[confirmStatus]}"?`
          : ""}
        description={
          <div className="space-y-2">
            <p className="text-sm">
              Lot &quot;{lot.lot_no}&quot; จะถูกเปลี่ยนสถานะเป็น{" "}
              <strong>{confirmStatus ? STATUS_LABEL[confirmStatus] : ""}</strong>.
              เหตุผลจะถูกเก็บใน audit trail (notes ต่อท้าย).
            </p>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เหตุผล (ทางเลือก)"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
        }
        variant={confirmStatus === "discarded" ? "danger" : "warning"}
        loading={pending}
        onConfirm={doMarkStatus}
        confirmText="ยืนยัน"
      />

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-8 shadow-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">แก้ไข Lot</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-slate-400 hover:text-slate-700"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lot ผู้ผลิต (เลข lot ที่พิมพ์ข้างกล่อง)
                </label>
                <Input
                  type="text"
                  value={supplierLotNo}
                  onChange={(e) => setSupplierLotNo(e.target.value)}
                  placeholder="เช่น L240315A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  วันผลิต (MFG)
                </label>
                <Input
                  type="date"
                  value={manufacturedDate}
                  onChange={(e) => setManufacturedDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  วันหมดอายุ (EXP)
                </label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  หมายเหตุ
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {lot.status === "active" && (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    ทำเครื่องหมาย Lot นี้:
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => askMarkStatus("expired")}
                      disabled={pending}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <AlertTriangle className="size-3.5 mr-1.5" />
                      หมดอายุ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => askMarkStatus("discarded")}
                      disabled={pending}
                      className="text-amber-700 border-amber-200 hover:bg-amber-50"
                    >
                      <Trash2 className="size-3.5 mr-1.5" />
                      ทิ้ง/ทำลาย
                    </Button>
                  </div>
                </div>
              )}
              {lot.status === "discarded" && (
                <div className="border-t pt-3 mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Lot นี้ถูกทำเครื่องหมายทิ้ง — สามารถกู้กลับได้:
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => askMarkStatus("active")}
                    disabled={pending || lot.qty_remaining <= 0}
                    className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    title={lot.qty_remaining <= 0 ? "qty_remaining = 0 → trigger จะ set depleted" : ""}
                  >
                    <RotateCcw className="size-3.5 mr-1.5" />
                    กลับเป็น active
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  ยกเลิก
                </Button>
                <Button onClick={save} disabled={pending}>
                  {pending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
