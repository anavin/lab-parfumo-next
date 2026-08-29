/**
 * Status pill — render PO status เป็น chip สีตามสถานะ
 * (ใช้ class จาก app/globals.css → .lp-pill-*)
 *
 * Hover → tooltip อธิบายสถานะ + กระบวนการถัดไป
 * Icon per status → WCAG 1.4.1 (ไม่พึ่งสีอย่างเดียว)
 */
import {
  Clock, ShoppingCart, Truck, PackageCheck,
  CheckCircle2, AlertTriangle, Ban,
  type LucideIcon,
} from "lucide-react";
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

const PILL_ICON: Record<PoStatus, LucideIcon> = {
  "รอจัดซื้อดำเนินการ": Clock,
  "สั่งซื้อแล้ว": ShoppingCart,
  "กำลังขนส่ง": Truck,
  "รับของแล้ว": PackageCheck,   // cyan  — ของถึงแล้ว รอปิด
  "มีปัญหา": AlertTriangle,
  "เสร็จสมบูรณ์": CheckCircle2,  // green — final state
  "ยกเลิก": Ban,
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
  const Icon = PILL_ICON[status] ?? Clock;
  return (
    <span
      className={cn(
        "lp-pill inline-flex items-center gap-1",
        PILL_CLASS[status] ?? "lp-pill-cancel",
        className,
      )}
      title={PILL_TOOLTIP[status] ?? status}
      aria-label={`สถานะ: ${status}`}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {status}
    </span>
  );
}
