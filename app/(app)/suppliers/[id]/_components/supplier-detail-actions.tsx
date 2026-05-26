"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Trash2, RotateCcw, Trash, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import type { Supplier, Lookup } from "@/lib/types/db";
import {
  deleteSupplierAction, restoreSupplierAction,
  hardDeleteSupplierAction, previewSupplierDeleteAction,
} from "@/lib/actions/suppliers";
import { SupplierDialog } from "../../_components/supplier-dialog";

export function SupplierDetailActions({
  supplier, categories, banks, paymentTerms,
}: {
  supplier: Supplier;
  categories: Lookup[];
  banks: Lookup[];
  paymentTerms: Lookup[];
}) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmHardDel, setConfirmHardDel] = useState(false);
  const [hardDelPoCount, setHardDelPoCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [hardDelPending, startHardDelTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteSupplierAction(supplier.id);
      if (res.ok) {
        toast.success(`✅ ปิดใช้งาน ${supplier.name}`);
        setConfirmDel(false);
      } else {
        toast.error(res.error ?? "ปิดใช้งานไม่สำเร็จ");
      }
      router.refresh();
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const res = await restoreSupplierAction(supplier.id);
      if (res.ok) {
        toast.success(`✅ เปิดใช้งาน ${supplier.name}`);
      } else {
        toast.error(res.error ?? "เปิดใช้งานไม่สำเร็จ");
      }
      router.refresh();
    });
  }

  async function openHardDelete() {
    setConfirmHardDel(true);
    setHardDelPoCount(null);
    const preview = await previewSupplierDeleteAction(supplier.id);
    if (preview.ok) setHardDelPoCount(preview.linkedPoCount ?? 0);
  }
  function handleHardDelete() {
    startHardDelTransition(async () => {
      const res = await hardDeleteSupplierAction(supplier.id);
      if (res.ok) {
        toast.success(
          `🗑️ ย้าย ${supplier.name} ไปถังขยะแล้ว — กู้คืนได้ที่ /trash`,
        );
        setConfirmHardDel(false);
        // กลับไปหน้า list (supplier นี้หายจาก list active แล้ว)
        router.push("/suppliers");
        router.refresh();
      } else {
        toast.error(res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)} disabled={pending}>
          <Edit2 className="size-3.5" /> แก้ไข
        </Button>
        {supplier.is_active ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDel(true)}
            disabled={pending}
            className="!text-red-600 hover:!bg-red-50"
          >
            <Trash2 className="size-3.5" /> ปิดใช้งาน
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRestore}
            disabled={pending}
            className="!text-emerald-700 hover:!bg-emerald-50"
          >
            <RotateCcw className="size-3.5" /> เปิดใช้งาน
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={openHardDelete}
          disabled={pending || hardDelPending}
          className="!text-red-700 !bg-red-50 hover:!bg-red-100 !border-red-200"
          title="ลบ — ย้ายไปถังขยะ (กู้คืนได้ที่ /trash)"
        >
          <Trash className="size-3.5" /> ลบ
        </Button>
      </div>

      {showEdit && (
        <SupplierDialog
          mode="edit"
          supplier={supplier}
          categories={categories}
          banks={banks}
          paymentTerms={paymentTerms}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`ปิดใช้งาน ${supplier.name}?`}
        description={
          <>
            Supplier จะไม่ปรากฏใน dropdown ตอนสั่ง PO ใหม่ —
            ประวัติ PO เก่ายังเก็บไว้.
            <br />
            สามารถเปิดใช้งานใหม่ได้ภายหลัง
          </>
        }
        confirmText="ปิดใช้งาน"
        variant="warning"
        loading={pending}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmHardDel}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmHardDel(false);
            setHardDelPoCount(null);
          }
        }}
        title={`🗑️ ลบ ${supplier.name}?`}
        description={
          <div className="space-y-2 text-sm">
            <div>
              Supplier นี้จะถูกย้ายไป <strong>ถังขยะ</strong> — กู้คืนได้ที่ /trash
            </div>
            {hardDelPoCount === null ? (
              <div className="text-muted-foreground italic">กำลังตรวจ PO ที่เชื่อมโยง…</div>
            ) : hardDelPoCount > 0 ? (
              <div className="p-2.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                <div className="font-bold inline-flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> มี PO {hardDelPoCount} ใบ link Supplier นี้
                </div>
                <div className="mt-1">
                  PO เหล่านั้นยัง <strong>link Supplier นี้</strong> ไว้ตามปกติ —
                  ไม่กระทบจนกว่าจะกด &ldquo;ลบถาวร&rdquo; จากถังขยะ
                </div>
              </div>
            ) : (
              <div className="text-emerald-700 text-xs">
                ✓ ไม่มี PO ที่ link Supplier นี้
              </div>
            )}
            <div className="text-xs text-muted-foreground pt-1">
              💡 ถ้าต้องการเก็บประวัติแต่ซ่อนจาก dropdown ใช้ &ldquo;ปิดใช้งาน&rdquo; แทน
            </div>
          </div>
        }
        confirmText="ลบ (ไปถังขยะ)"
        variant="warning"
        loading={hardDelPending}
        onConfirm={handleHardDelete}
      />
    </>
  );
}
