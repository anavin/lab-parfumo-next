/**
 * Status pill — render PO status เป็น chip สีตามสถานะ
 * (ใช้ class จาก app/globals.css → .lp-pill-*)
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

export function StatusPill({
  status, className,
}: {
  status: PoStatus;
  className?: string;
}) {
  return (
    <span className={cn("lp-pill", PILL_CLASS[status] ?? "lp-pill-cancel", className)}>
      {status}
    </span>
  );
}
