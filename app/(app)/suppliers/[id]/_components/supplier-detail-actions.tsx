"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import type { Supplier, Lookup } from "@/lib/types/db";
import {
  deleteSupplierAction, restoreSupplierAction,
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
  const [pending, startTransition] = useTransition();

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

  return (
    <>
      <div className="flex gap-1.5 flex-shrink-0">
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
    </>
  );
}
