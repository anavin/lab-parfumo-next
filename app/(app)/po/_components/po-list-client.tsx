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
import { Trash2, X, AlertTriangle } from "lucide-react";
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
  const [forceMode, setForceMode] = useState(false);
  const [pending, start] = useTransition();

  // Feature flag — ปิดไว้ default — เปิดด้วย NEXT_PUBLIC_FORCE_DELETE_ENABLED=true
  // เปิดเมื่อจำเป็น (เช่น cleanup test data) แล้วปิดกลับ
  const forceDeleteEnabled =
    process.env.NEXT_PUBLIC_FORCE_DELETE_ENABLED === "true";

  // Staff view: plain list (no checkbox)
  if (!isPrivileged) {
    return (
      <div className="space-y-2">
        {pos.map((po) => <PoRow key={po.id} po={po} isAdmin={isAdmin} />)}
      </div>
    );
  }

  // Force mode → ทุก PO ลบได้ (สำหรับล้าง test data)
  // Normal mode → เฉพาะ DELETABLE_STATUSES
  const selectablePos = forceMode
    ? pos
    : pos.filter((p) => DELETABLE_STATUSES.includes(p.status));
  const allOnPageSelected =
    selectablePos.length > 0 &&
    selectablePos.every((p) => selected.has(p.id));
  const someOnPageSelected =
    selectablePos.some((p) => selected.has(p.id)) && !allOnPageSelected;

  function handleToggleForceMode(checked: boolean) {
    setForceMode(checked);
    // ถ้าปิด force → เคลียร์ PO ที่เลือกซึ่ง status ไม่ deletable ออก
    if (!checked) {
      setSelected((s) => {
        const next = new Set<string>();
        for (const id of s) {
          const po = pos.find((p) => p.id === id);
          if (po && DELETABLE_STATUSES.includes(po.status)) next.add(id);
        }
        return next;
      });
    }
  }

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
      const r = await bulkDeletePoAction(ids, { force: forceMode });
      if (r.ok) {
        let msg = `ลบ ${r.deleted} ใบเรียบร้อย`;
        if (r.blocked > 0) {
          msg += ` (ข้าม ${r.blocked} ใบที่อยู่ใน workflow active)`;
        }
        if (forceMode) msg = `🧹 ${msg} (force mode)`;
        toast.success(msg);
        setSelected(new Set());
        setConfirmOpen(false);
        setForceMode(false); // reset หลังลบเสร็จ
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
      {/* Select-all + Force-mode toggle row — แสดงเมื่อ:
            (1) มี PO ที่ normally deletable, หรือ
            (2) force-delete flag เปิด (admin จะได้กดเข้าใช้)
            ไม่แสดงเลยถ้าทั้งสองข้อไม่ใช่ → ไม่มี toolbar ว่างเปล่า */}
      {(selectablePos.length > 0 || forceDeleteEnabled) && (
      <div className="flex items-center gap-3 px-1 py-1 text-xs text-muted-foreground flex-wrap">
        {selectablePos.length > 0 && (
          <div className="inline-flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allOnPageSelected ? true : (someOnPageSelected ? "indeterminate" : false)}
              onCheckedChange={toggleAllOnPage}
              disabled={pending}
            />
            <label htmlFor="select-all" className="cursor-pointer select-none">
              เลือกทั้งหมดในหน้านี้ ({selectablePos.length} ใบ
              {forceMode ? "" : "ที่ลบได้"})
            </label>
          </div>
        )}

        {/* Force mode toggle — admin/supervisor only (สำหรับล้าง test data)
            ปิดด้วย feature flag NEXT_PUBLIC_FORCE_DELETE_ENABLED — เปิดเฉพาะตอนต้องใช้ */}
        {forceDeleteEnabled && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-50 border border-red-200">
            <Checkbox
              id="force-mode"
              checked={forceMode}
              onCheckedChange={(c) => handleToggleForceMode(c === true)}
              disabled={pending}
            />
            <label
              htmlFor="force-mode"
              className="cursor-pointer select-none text-red-700 font-semibold inline-flex items-center gap-1"
              title="ลบ PO ได้ทุกสถานะ (รวมที่กำลังดำเนินการ/เสร็จสมบูรณ์) — สำหรับล้างข้อมูลทดสอบ"
            >
              <AlertTriangle className="size-3" />
              บังคับลบทุกสถานะ
            </label>
          </div>
        )}

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
        // ใน force mode ทุก PO เลือกได้
        const isDeletable = forceMode || DELETABLE_STATUSES.includes(po.status);
        const isSelected = selected.has(po.id);
        const isForceTarget = forceMode && !DELETABLE_STATUSES.includes(po.status);
        return (
          <div
            key={po.id}
            className={`flex items-stretch gap-2 rounded-2xl transition-colors ${
              isSelected
                ? isForceTarget
                  ? "bg-red-50/60 ring-1 ring-red-300 ring-offset-2 ring-offset-background"
                  : "bg-primary/5 ring-1 ring-primary/30 ring-offset-2 ring-offset-background"
                : ""
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
                  title="ลบไม่ได้ — PO อยู่ใน workflow active (เปิด 'บังคับลบ' ถ้าต้องการ)"
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
            เลิกเลือก
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
        title={
          forceMode
            ? `🧹 บังคับลบ ${selected.size} ใบ PO (force mode)?`
            : `ลบ ${selected.size} ใบ PO ?`
        }
        description={
          <div className="space-y-1.5">
            <div>
              จะลบ <strong>{selected.size}</strong> ใบ PO ที่เลือก รวมถึงข้อมูลที่เกี่ยวข้อง:
            </div>
            <ul className="text-xs list-disc pl-5 space-y-0.5 text-muted-foreground">
              <li>กิจกรรม + ความคิดเห็น</li>
              <li>ประวัติการรับของ + รูปภาพ</li>
              <li>การแจ้งเตือนที่อ้างถึง PO นี้</li>
              {forceMode && (
                <>
                  <li className="text-red-600 font-semibold">Lots ที่สร้างจาก PO เหล่านี้</li>
                  <li className="text-red-600 font-semibold">withdrawal_lot_usage rows ที่อ้าง lots</li>
                </>
              )}
            </ul>
            {forceMode && (
              <div className="mt-2 p-2 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs space-y-1">
                <div className="font-bold inline-flex items-center gap-1">
                  <AlertTriangle className="size-3.5" />
                  คำเตือน Force Mode
                </div>
                <div>
                  จะลบ PO ทุกสถานะรวมที่ <strong>สั่งซื้อแล้ว / กำลังขนส่ง / รับของแล้ว / มีปัญหา / เสร็จสมบูรณ์</strong>
                </div>
                <div>
                  ❗ <strong>ไม่</strong> rollback stock ของ equipment ที่ deliveries ลด/เพิ่ม — แก้ stock ด้วยตนเองหากจำเป็น
                </div>
              </div>
            )}
            <div className="text-destructive font-semibold mt-2">
              ⚠️ ไม่สามารถ undo ได้
            </div>
          </div>
        }
        confirmText={
          pending
            ? "กำลังลบ..."
            : forceMode
              ? `🧹 บังคับลบ ${selected.size} ใบ`
              : `ลบ ${selected.size} ใบ`
        }
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
