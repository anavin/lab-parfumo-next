/**
 * Status pill — render PO status เป็น chip สีตามสถานะ
 * (ใช้ class จาก app/globals.css → .lp-pill-*)
 *
 * Hover → tooltip อธิบายสถานะ + กระบวนการถัดไป
 */
import { cn } from "@/lib/utils";
import type { PoStatus } from "@/lib/types/db";

const PILL_CLASS: Record<PoStatus, string> = {
  "รอจัดซื้อดำเนินการ": "lp-pill-pending",
  "สั่งซื้อแล้ว": "lp-pill-ordered",
  "กำลังขนส่ง": "lp-pill-shipping",
  "รับของแล้ว": "lp-pill-received",
  "มีปัญหา": "lp-pill-problem",
  "เสร็จสมบูรณ์": "lp-pill-done",
  "ยกเลิก": "lp-pill-cancel",
};

const PILL_TOOLTIP: Record<PoStatus, string> = {
  "รอจัดซื้อดำเนินการ": "ยังไม่ได้สั่งซื้อ — รอแอดมิน/ฝ่ายจัดซื้อดำเนินการ",
  "สั่งซื้อแล้ว": "ส่งคำสั่งซื้อไปยัง supplier แล้ว — รอจัดส่ง",
  "กำลังขนส่ง": "ของกำลังเดินทางมา — มี tracking number แล้ว",
  "รับของแล้ว": "ของถึงคลังแล้ว — รอปิดงาน",
  "มีปัญหา": "พบปัญหา (เช่นของเสีย/ขาด) — ต้องตรวจสอบเพิ่มเติม",
  "เสร็จสมบูรณ์": "ปิดงานเรียบร้อย — flow จบแล้ว",
  "ยกเลิก": "ใบ PO นี้ถูกยกเลิก",
};

export function StatusPill({
  status, className,
}: {
  status: PoStatus;
  className?: string;
}) {
  return (
    <span
      className={cn("lp-pill", PILL_CLASS[status] ?? "lp-pill-cancel", className)}
      title={PILL_TOOLTIP[status] ?? status}
    >
      {status}
    </span>
  );
}
