/**
 * ImageCompressProgress — UI สำหรับแสดงสถานะบีบรูป
 * ใช้คู่กับ lib/utils/image.ts
 */
"use client";

import { Loader2, CheckCircle2 } from "lucide-react";
import { formatBytes } from "@/lib/utils/image";
import { cn } from "@/lib/utils";

export interface CompressionProgress {
  /** ถ้ากำลังบีบอยู่ */
  active: boolean;
  /** ไฟล์ที่กำลังประมวลผล (1-based) */
  current: number;
  /** จำนวนไฟล์ทั้งหมด */
  total: number;
  /** ชื่อไฟล์ปัจจุบัน */
  fileName?: string;
  /** สรุปขนาดเก่ารวม (bytes) */
  totalOriginal?: number;
  /** สรุปขนาดใหม่รวม (bytes) */
  totalCompressed?: number;
}

/**
 * แสดงสถานะกำลังบีบ — ใช้เมื่อ progress.active = true
 */
export function ImageCompressProgress({ progress }: { progress: CompressionProgress }) {
  if (!progress.active) return null;
  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
      <div className="flex items-start gap-2.5">
        <Loader2 className="size-4 animate-spin text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-blue-900">
            🔄 กำลังเตรียมรูป... {progress.current} / {progress.total}
          </div>
          {progress.fileName && (
            <div className="text-[11px] text-blue-700 mt-0.5 truncate" title={progress.fileName}>
              {progress.fileName}
            </div>
          )}
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[11px] text-blue-700/80 mt-1.5">
            💡 บีบรูปขนาดใหญ่ใน browser — ภาพยังชัดเหมือนเดิม
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * แสดงสรุปหลังบีบเสร็จ — savings %
 */
export function ImageCompressSummary({
  originalTotal, compressedTotal, count, className,
}: {
  originalTotal: number;
  compressedTotal: number;
  count: number;
  className?: string;
}) {
  if (originalTotal <= 0 || compressedTotal <= 0) return null;
  const savedPct = Math.round((1 - compressedTotal / originalTotal) * 100);

  // ถ้าบีบไม่ได้ savings เยอะ — ไม่ต้องแสดง (ดูเลอะ)
  if (savedPct < 5) return null;

  return (
    <div className={cn(
      "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs",
      className,
    )}>
      <div className="inline-flex items-center gap-1.5 text-emerald-800">
        <CheckCircle2 className="size-3.5 flex-shrink-0" />
        <span className="font-semibold">
          ประหยัด {formatBytes(originalTotal)} → {formatBytes(compressedTotal)} ({savedPct}%)
        </span>
        <span className="text-emerald-600">• {count} รูป</span>
      </div>
    </div>
  );
}
