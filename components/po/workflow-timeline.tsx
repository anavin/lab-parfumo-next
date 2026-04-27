/**
 * Workflow timeline — 5 dots + connecting lines
 * แสดงตำแหน่งของ PO ใน flow: สร้าง → สั่ง → ขนส่ง → รับ → เสร็จ
 *
 * Render-only (Server Component compatible)
 */
import type { PoStatus } from "@/lib/types/db";

const MAIN_STEPS: Array<{ label: string; status: PoStatus }> = [
  { label: "สร้าง PO", status: "รอจัดซื้อดำเนินการ" },
  { label: "สั่งซื้อ", status: "สั่งซื้อแล้ว" },
  { label: "ขนส่ง", status: "กำลังขนส่ง" },
  { label: "รับของ", status: "รับของแล้ว" },
  { label: "เสร็จสมบูรณ์", status: "เสร็จสมบูรณ์" },
];

export function WorkflowTimeline({ status }: { status: PoStatus }) {
  // Special states: ยกเลิก, มีปัญหา → แสดง banner แทน
  if (status === "ยกเลิก") {
    return (
      <div className="my-3 px-5 py-3 bg-slate-100 border-l-4 border-slate-400 rounded-lg text-sm text-slate-600 font-semibold">
        ❌ ยกเลิก
      </div>
    );
  }
  if (status === "มีปัญหา") {
    return (
      <div className="my-3 px-5 py-3 bg-red-50 border-l-4 border-red-600 rounded-lg text-sm text-red-700 font-semibold">
        ⚠️ มีปัญหา — กำลังตรวจสอบ
      </div>
    );
  }

  const curIdx = MAIN_STEPS.findIndex((s) => s.status === status);
  const activeIdx = curIdx < 0 ? 0 : curIdx;

  return (
    <div className="my-3 flex items-start gap-0 bg-slate-50 px-5 py-4 rounded-xl">
      {MAIN_STEPS.map((step, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        const isLast = i === MAIN_STEPS.length - 1;
        return (
          <div
            key={step.status}
            className="flex-1 flex flex-col items-center relative min-w-0"
          >
            {/* Connecting line */}
            {!isLast && (
              <div
                className={`absolute top-3.5 left-1/2 w-full h-0.5 ${
                  isDone || isActive ? "bg-brand-600" : "bg-slate-300"
                }`}
                style={{ zIndex: 0 }}
              />
            )}
            {/* Dot */}
            <div
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isDone
                  ? "bg-brand-600 border-brand-600 text-white"
                  : isActive
                    ? "bg-brand-600 border-brand-600 text-white ring-4 ring-brand-100"
                    : "bg-white border-slate-300 text-slate-400"
              }`}
            >
              {isDone ? "✓" : i + 1}
            </div>
            {/* Label */}
            <div
              className={`text-[11px] mt-1.5 text-center leading-tight px-1 ${
                isDone || isActive
                  ? "font-semibold text-slate-900"
                  : "text-slate-500"
              } ${isActive ? "text-brand-700" : ""}`}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
