"use client";

/**
 * ProcurementNotesCard — admin/supervisor แก้ไข "หมายเหตุจัดซื้อ"
 * หลังจากสั่งซื้อไปแล้วได้ inline (กดปุ่ม ✏️ → textarea + save/cancel)
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { updateProcurementNotesAction } from "@/lib/actions/po";

const MAX_LEN = 5000;

export function ProcurementNotesCard({
  poId,
  initialNotes,
  canEdit,
}: {
  poId: string;
  initialNotes: string | null;
  /** privileged + non-terminal status (ปิดได้สำหรับ PO ยกเลิก) */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();
  const trimmed = (initialNotes ?? "").trim();

  // ถ้าไม่มี note + แก้ไม่ได้ → ไม่ render การ์ดเลย
  if (!trimmed && !canEdit) return null;

  function handleSave() {
    startTransition(async () => {
      const res = await updateProcurementNotesAction(poId, value);
      if (res.ok) {
        toast.success("✅ บันทึกหมายเหตุแล้ว");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }
  function handleCancel() {
    setValue(initialNotes ?? "");
    setEditing(false);
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
            📝 หมายเหตุจัดซื้อ
          </h2>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-semibold"
              title="แก้ไขหมายเหตุ"
            >
              <Pencil className="size-3.5" />
              แก้ไข
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
              rows={4}
              maxLength={MAX_LEN}
              disabled={pending}
              autoFocus
              placeholder="เช่น เลขใบเสนอราคา, เงื่อนไขพิเศษ, ข้อตกลงเพิ่มเติม..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {value.length} / {MAX_LEN}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={pending}
                >
                  <X className="size-3.5" />
                  ยกเลิก
                </Button>
                <Button size="sm" onClick={handleSave} loading={pending}>
                  <Check className="size-3.5" />
                  บันทึก
                </Button>
              </div>
            </div>
          </div>
        ) : trimmed ? (
          <div className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-3 whitespace-pre-line">
            {trimmed}
          </div>
        ) : (
          <div className="text-sm text-slate-400 italic">
            ยังไม่มีหมายเหตุ — กด &ldquo;แก้ไข&rdquo; เพื่อเพิ่ม
          </div>
        )}
      </CardContent>
    </Card>
  );
}
