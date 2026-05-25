"use client";

/**
 * LinkSupplierButton — inline "เพิ่ม Supplier ใหม่" บนหน้า PO detail
 *
 * แสดงเมื่อ PO มี supplier_name แต่ยังไม่ได้ link supplier_id ใน DB
 * กดแล้วเปิด SupplierDialog แบบ inline (pre-fill ชื่อ + contact จาก PO เดิม)
 * หลังบันทึก → call linkSupplierToPoAction → refresh page
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { SupplierDialog } from "@/app/(app)/suppliers/_components/supplier-dialog";
import { toast } from "@/components/ui/sonner";
import type { Lookup } from "@/lib/types/db";
import { linkSupplierToPoAction } from "@/lib/actions/po";

export function LinkSupplierButton({
  poId,
  poNumber,
  supplierName,
  supplierContact,
  categories,
  banks,
  paymentTerms,
}: {
  poId: string;
  poNumber: string;
  supplierName: string;
  supplierContact: string | null;
  categories: Lookup[];
  banks: Lookup[];
  paymentTerms: Lookup[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [linking, startLinking] = useTransition();

  function handleSaved(newSupplierId?: string) {
    setOpen(false);
    if (!newSupplierId) {
      // เผื่อ edge case: create แล้ว action ไม่ return id (ปกติไม่เกิด)
      router.refresh();
      return;
    }
    startLinking(async () => {
      const res = await linkSupplierToPoAction(poId, newSupplierId);
      if (res.ok) {
        toast.success(`🔗 เชื่อมโยง ${poNumber} กับ Supplier ใหม่แล้ว`);
        router.refresh();
      } else {
        toast.error(res.error ?? "เชื่อมโยงไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      <div className="text-[11px] text-amber-600 mt-1.5 inline-flex items-center gap-1 flex-wrap">
        ⚠️ ยังไม่ link กับ Supplier ใน DB —
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={linking}
          className="inline-flex items-center gap-1 underline hover:text-amber-800 disabled:opacity-60"
        >
          <Plus className="size-3" />
          เพิ่ม Supplier ใหม่
        </button>
        {linking && <span className="text-muted-foreground">(กำลังเชื่อมโยง…)</span>}
      </div>

      {open && (
        <SupplierDialog
          mode="create"
          categories={categories}
          banks={banks}
          paymentTerms={paymentTerms}
          prefillName={supplierName}
          prefillAddress={supplierContact ?? ""}
          onClose={() => setOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
