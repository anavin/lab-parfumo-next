"use client";

/**
 * EditPoSupplierButton — admin เปลี่ยน Supplier ของ PO ทีละใบ
 *
 * Use case:
 *   - snapshot supplier_name drift (admin renamed Supplier แต่ PO นี้ไม่ sync)
 *   - PO ลิงก์ supplier ผิด → relink
 *   - ต้องการเปลี่ยน vendor หลังสั่งไปแล้ว
 *
 * Mechanism:
 *   - เปิด dialog → ใช้ SupplierCombobox (existing component) เลือกจาก register
 *     หรือพิมพ์ใหม่ (free-text)
 *   - กดบันทึก → setPoSupplierAction
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SupplierCombobox } from "@/components/ui/supplier-combobox";
import { toast } from "@/components/ui/sonner";
import type { SupplierOption } from "@/lib/types/db";
import { setPoSupplierAction } from "@/lib/actions/po";

export function EditPoSupplierButton({
  poId,
  poNumber,
  currentSupplierName,
  currentSupplierId,
  supplierOptions,
}: {
  poId: string;
  poNumber: string;
  currentSupplierName: string | null;
  currentSupplierId: string | null;
  supplierOptions: SupplierOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // โหมดเริ่มต้น: ถ้า PO มี supplier_id → pick mode; ถ้าไม่มี → free-text
  const [pickedName, setPickedName] = useState<string>(currentSupplierName ?? "");
  const [pickedOption, setPickedOption] = useState<SupplierOption | null>(() => {
    if (currentSupplierId) {
      return supplierOptions.find((o) => o.id === currentSupplierId) ?? null;
    }
    return null;
  });
  const [freeText, setFreeText] = useState<boolean>(!currentSupplierId);

  function handleSelect(name: string, opt: SupplierOption | null) {
    setPickedName(name);
    setPickedOption(opt);
    setFreeText(false);
  }
  function handleFreeText() {
    setFreeText(true);
    setPickedOption(null);
    setPickedName("");
  }
  function handleSave() {
    setError(null);
    if (!pickedName.trim()) {
      setError("กรุณาเลือกหรือกรอกชื่อ Supplier");
      return;
    }
    startTransition(async () => {
      // ถ้าโหมด pick + เลือก registered → ส่ง supplierId
      // ถ้าโหมด free-text → ส่ง freeTextName
      const args = pickedOption && pickedOption.source === "registered"
        ? { supplierId: pickedOption.id ?? null }
        : { supplierId: null, freeTextName: pickedName.trim() };
      const res = await setPoSupplierAction(poId, args);
      if (res.ok) {
        toast.success(`✅ เปลี่ยน Supplier ของ ${poNumber} แล้ว`);
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary font-semibold mt-1.5"
        title="เปลี่ยน Supplier ของ PO นี้"
      >
        <Pencil className="size-3" />
        เปลี่ยน Supplier
      </button>

      {open && (
        <Dialog open onOpenChange={(o) => !o && !pending && setOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>เปลี่ยน Supplier — {poNumber}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Supplier
                </label>
                {freeText ? (
                  <>
                    <Input
                      value={pickedName}
                      onChange={(e) => setPickedName(e.target.value)}
                      placeholder="พิมพ์ชื่อ Supplier"
                      disabled={pending}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setFreeText(false)}
                      disabled={pending}
                      className="mt-1.5 text-xs text-primary hover:underline"
                    >
                      ← กลับไปเลือกจากที่ register
                    </button>
                  </>
                ) : (
                  <SupplierCombobox
                    options={supplierOptions}
                    value={pickedName}
                    onChange={handleSelect}
                    onFreeText={handleFreeText}
                    disabled={pending}
                  />
                )}
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2">
                💡 เลือก Supplier ที่ register แล้ว → ชื่อ + supplier_id จะ sync
                อัตโนมัติ. พิมพ์ใหม่ → ไม่ link (snapshot อย่างเดียว)
              </div>

              {error && <Alert tone="danger">❌ {error}</Alert>}

              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSave} loading={pending}>
                  ✅ บันทึก
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
