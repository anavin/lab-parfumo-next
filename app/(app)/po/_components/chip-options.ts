/**
 * Pure helper — buildChipOptions
 *
 * แยกออกจาก filter-chips.tsx (client component) เพื่อให้
 * server component (po/page.tsx) เรียกใช้ได้โดยตรง
 *
 * ⚠️ Server/Client component boundary: ห้ามใส่ "use client" ในไฟล์นี้
 */
import { PO_STATUSES } from "@/lib/types/db";

export interface ChipOption {
  value: string;       // status value or "ทั้งหมด"
  label: string;
  count: number;
}

export function buildChipOptions(
  byStatus: Record<string, number>, total: number,
): ChipOption[] {
  const opts: ChipOption[] = [
    { value: "ทั้งหมด", label: "ทั้งหมด", count: total },
  ];
  for (const s of PO_STATUSES) {
    const count = byStatus[s] ?? 0;
    if (count > 0) opts.push({ value: s, label: s, count });
  }
  return opts;
}
