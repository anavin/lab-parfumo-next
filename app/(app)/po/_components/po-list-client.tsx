"use client";

/**
 * Po List Client — wraps PO list with bulk-select + bulk-delete
 *
 * - Privileged users (admin/supervisor): checkbox column + sticky action bar
 * - Staff: plain list (no selection)
 *
 * Only POs with status in {รอจัดซื้อ, เสร็จสมบูรณ์, ยกเลิก} can be selected/deleted.
 * Active workflow POs (สั่งซื้อแล้ว / กำลังขนส่ง / รับของแล้ว / มีปัญหา) are protected.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PoRow } from "@/components/po/po-row";
import { bulkDeletePoAction } from "@/lib/actions/po";
import type { PurchaseOrder, PoStatus } from "@/lib/types/db";

const DELETABLE_STATUSES: PoStatus[] = ["รอจัดซื้อดำเนินการ", "ยกเลิก"];

export function PoListClient({
  pos,
  isPrivileged,
  isAdmin,
}: {
  pos: PurchaseOrder[];
  isPrivileged: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  // Staff view: plain list (no checkbox)
  if (!isPrivileged) {
    return (
      <div className="space-y-2">
        {pos.map((po) => <PoRow key={po.id} po={po} isAdmin={isAdmin} />)}
      </div>
    );
  }

  const selectablePos = pos.filter((p) => DELETABLE_STATUSES.includes(p.status));
  const allOnPageSelected =
    selectablePos.length > 0 &&
    selectablePos.every((p) => selected.has(p.id));
  const someOnPageSelected =
    selectablePos.some((p) => selected.has(p.id)) && !allOnPageSelected;

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPageSelected) {
        for (const p of selectablePos) next.delete(p.id);
      } else {
        for (const p of selectablePos) next.add(p.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleDelete() {
    start(async () => {
      const ids = Array.from(selected);
      const r = await bulkDeletePoAction(ids);
      if (r.ok) {
        let msg = `ลบ ${r.deleted} ใบเรียบร้อย`;
        if (r.blocked > 0) {
          msg += ` (ข้าม ${r.blocked} ใบที่อยู่ใน workflow active)`;
        }
        toast.success(msg);
        setSelected(new Set());
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(r.error ?? "ลบไม่สำเร็จ");
        if (r.blockedDetails?.length) {
          console.warn("[bulkDelete] blocked:", r.blockedDetails);
        }
      }
    });
  }

  return (
    <div className="space-y-2">
      {/* Select-all toggle */}
      {selectablePos.length > 0 && (
        <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
          <Checkbox
            id="select-all"
            checked={allOnPageSelected ? true : (someOnPageSelected ? "indeterminate" : false)}
            onCheckedChange={toggleAllOnPage}
            disabled={pending}
          />
          <label htmlFor="select-all" className="cursor-pointer select-none">
            เลือกทั้งหมดในหน้านี้ ({selectablePos.length} ใบที่ลบได้)
          </label>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-primary hover:underline text-xs font-medium"
              disabled={pending}
            >
              ล้างที่เลือก ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* List */}
      {pos.map((po) => {
        const isDeletable = DELETABLE_STATUSES.includes(po.status);
        const isSelected = selected.has(po.id);
        return (
          <div
            key={po.id}
            className={`flex items-stretch gap-2 rounded-2xl transition-colors ${
              isSelected ? "bg-primary/5 ring-1 ring-primary/30 ring-offset-2 ring-offset-background" : ""
            }`}
          >
            <div className="flex-shrink-0 flex items-center pl-1.5">
              {isDeletable ? (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOne(po.id)}
                  disabled={pending}
                  aria-label={`เลือก ${po.po_number}`}
                />
              ) : (
                <span
                  title="ลบไม่ได้ — PO อยู่ใน workflow active"
                  className="size-4 inline-block opacity-0"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <PoRow po={po} isAdmin={isAdmin} />
            </div>
          </div>
        );
      })}

      {/* Sticky bottom action bar — appears when selection */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-2xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-150"
        >
          <span className="text-sm font-medium">
            เลือก <strong className="text-primary tabular-nums">{selected.size}</strong> ใบ
          </span>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="outline"
            onClick={clearSelection}
            disabled={pending}
          >
            <X className="size-3.5" />
            ยกเลิก
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={pending}
          >
            <Trash2 className="size-3.5" />
            ลบ
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`ลบ ${selected.size} ใบ PO ?`}
        description={
          <div className="space-y-1.5">
            <div>
              จะลบ <strong>{selected.size}</strong> ใบ PO ที่เลือก รวมถึงข้อมูลที่เกี่ยวข้อง:
            </div>
            <ul className="text-xs list-disc pl-5 space-y-0.5 text-muted-foreground">
              <li>กิจกรรม + ความคิดเห็น</li>
              <li>ประวัติการรับของ + รูปภาพ</li>
              <li>การแจ้งเตือนที่อ้างถึง PO นี้</li>
            </ul>
            <div className="text-destructive font-semibold mt-2">
              ⚠️ ไม่สามารถ undo ได้
            </div>
          </div>
        }
        confirmText={pending ? "กำลังลบ..." : `ลบ ${selected.size} ใบ`}
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
