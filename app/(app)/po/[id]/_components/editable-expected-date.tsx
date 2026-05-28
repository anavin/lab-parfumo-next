"use client";

/**
 * EditableExpectedDate — แก้ "วันที่คาดว่าจะได้รับ" inline บนหน้า PO detail
 *
 * แสดงเฉพาะ admin/supervisor + PO ที่ "สั่งซื้อแล้ว"/"กำลังขนส่ง"
 * กด ✏️ → date input + save/cancel → updateExpectedDateAction
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { updateExpectedDateAction } from "@/lib/actions/po";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function EditableExpectedDate({
  poId,
  initialDate,
  canEdit,
  highlight,
}: {
  poId: string;
  initialDate: string | null;
  /** privileged + status สั่งซื้อแล้ว/กำลังขนส่ง */
  canEdit: boolean;
  highlight?: "danger" | "warning";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialDate ?? "");
  const [pending, startTransition] = useTransition();

  const valueCls =
    highlight === "danger" ? "text-red-600 font-semibold"
      : highlight === "warning" ? "text-amber-600 font-semibold"
        : "text-slate-700";

  function handleSave() {
    if (!value) {
      toast.error("กรุณาเลือกวันที่");
      return;
    }
    startTransition(async () => {
      const res = await updateExpectedDateAction(poId, value);
      if (res.ok) {
        toast.success("✅ อัปเดตวันที่คาดว่าจะได้รับแล้ว");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }
  function handleCancel() {
    setValue(initialDate ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex justify-between items-center gap-2">
        <dt className="text-slate-500">คาดว่าจะได้รับ:</dt>
        <dd className="flex items-center gap-1.5">
          <input
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            autoFocus
            className="h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="size-7 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center hover:opacity-90 disabled:opacity-50"
            aria-label="บันทึก"
          >
            <Check className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="size-7 rounded-md bg-muted text-muted-foreground inline-flex items-center justify-center hover:bg-muted/70"
            aria-label="ยกเลิก"
          >
            <X className="size-4" />
          </button>
        </dd>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center group">
      <dt className="text-slate-500">คาดว่าจะได้รับ:</dt>
      <dd className={`inline-flex items-center gap-1.5 ${valueCls}`}>
        {fmtDate(initialDate)}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            title="แก้วันที่คาดว่าจะได้รับ"
            aria-label="แก้วันที่"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </dd>
    </div>
  );
}
