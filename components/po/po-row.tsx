/**
 * PO list row — premium B2B feel, clear hierarchy, full info
 */
import Link from "next/link";
import {
  ChevronRight, Calendar, User, Package as PackageIcon,
  Building2, ShoppingBag, Truck, PackageCheck, AlertTriangle,
  CheckCircle2, XCircle, ClipboardEdit, type LucideIcon, Clock,
} from "lucide-react";
import type { PurchaseOrder, PoStatus } from "@/lib/types/db";

interface StatusVisual {
  icon: LucideIcon;
  label: string;
  pillClass: string;
  iconBg: string;
  iconColor: string;
  ringColor: string;
}

const STATUS_VISUAL: Record<PoStatus, StatusVisual> = {
  "รอจัดซื้อดำเนินการ": {
    icon: ClipboardEdit,
    label: "รอจัดซื้อ",
    pillClass: "bg-amber-50 text-amber-700 ring-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    ringColor: "ring-amber-200/60",
  },
  "สั่งซื้อแล้ว": {
    icon: ShoppingBag,
    label: "สั่งซื้อแล้ว",
    pillClass: "bg-blue-50 text-blue-700 ring-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
    ringColor: "ring-blue-200/60",
  },
  "กำลังขนส่ง": {
    icon: Truck,
    label: "กำลังขนส่ง",
    pillClass: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
    ringColor: "ring-indigo-200/60",
  },
  "รับของแล้ว": {
    icon: PackageCheck,
    label: "รับของแล้ว",
    pillClass: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-700",
    ringColor: "ring-cyan-200/60",
  },
  "มีปัญหา": {
    icon: AlertTriangle,
    label: "มีปัญหา",
    pillClass: "bg-red-50 text-red-700 ring-red-200",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
    ringColor: "ring-red-200/60",
  },
  "เสร็จสมบูรณ์": {
    icon: CheckCircle2,
    label: "เสร็จสมบูรณ์",
    pillClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    ringColor: "ring-emerald-200/60",
  },
  "ยกเลิก": {
    icon: XCircle,
    label: "ยกเลิก",
    pillClass: "bg-slate-100 text-slate-500 ring-slate-200",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    ringColor: "ring-slate-200/60",
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

function ageDays(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
}

function ageLabel(days: number): string {
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันก่อน`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
  return `${Math.floor(days / 30)} เดือนก่อน`;
}

export function PoRow({
  po, isAdmin,
}: {
  po: PurchaseOrder;
  isAdmin: boolean;
}) {
  const items = po.items ?? [];
  const visual = STATUS_VISUAL[po.status];
  const StatusIcon = visual.icon;
  const totalQty = items.reduce((s, it) => s + (it.qty ?? 0), 0);

  const supplier = po.supplier_name ?? "(ยังไม่ระบุ supplier)";
  const noSupplier = !po.supplier_name;

  const amountStr =
    isAdmin && po.total
      ? `฿${po.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
      : null;

  const days = ageDays(po.created_at);
  const isStale = po.status === "รอจัดซื้อดำเนินการ" && days >= 3;
  const isProblem = po.status === "มีปัญหา";

  // Overdue detection (only for in-progress shipments)
  const isOverdue =
    po.expected_date &&
    !["รับของแล้ว", "เสร็จสมบูรณ์", "ยกเลิก"].includes(po.status) &&
    new Date(po.expected_date) < new Date();

  return (
    <Link
      href={`/po/${po.id}`}
      className={`group block bg-card border rounded-2xl p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
        isProblem
          ? "border-red-200 hover:border-red-300"
          : isOverdue
            ? "border-red-200 hover:border-red-300"
            : isStale
              ? "border-amber-200 hover:border-amber-300"
              : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Status icon badge */}
        <div className={`relative flex-shrink-0 size-12 rounded-2xl flex items-center justify-center ring-1 ${visual.iconBg} ${visual.iconColor} ${visual.ringColor} transition-transform duration-200 group-hover:scale-105`}>
          <StatusIcon className="size-6" strokeWidth={2.25} />
          {isProblem && (
            <span className="absolute inset-0 rounded-2xl bg-red-400 animate-ping opacity-20" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: PO# + status pill + amount */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-extrabold text-sm font-mono text-foreground tracking-tight">
              {po.po_number}
            </div>
            <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ${visual.pillClass}`}>
              <span className="size-1.5 rounded-full bg-current opacity-70" />
              {visual.label}
            </div>
            {isOverdue && (
              <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 ring-1 ring-red-300">
                <Clock className="size-3" /> เลยกำหนด
              </div>
            )}
            {isStale && !isProblem && !isOverdue && (
              <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300">
                <Clock className="size-3" /> ค้าง {days} วัน
              </div>
            )}
            {amountStr && (
              <div className="ml-auto text-base font-extrabold tabular-nums text-foreground">
                {amountStr}
              </div>
            )}
          </div>

          {/* Row 2: Supplier */}
          <div className="flex items-center gap-1.5 mt-1.5 text-sm">
            <Building2 className={`size-3.5 flex-shrink-0 ${noSupplier ? "text-muted-foreground/40" : "text-primary"}`} />
            <span
              className={`truncate font-semibold ${noSupplier ? "text-muted-foreground italic" : "text-foreground"}`}
              title={supplier}
            >
              {supplier}
            </span>
          </div>

          {/* Row 3: Items as chips (max 3) */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {items.slice(0, 3).map((it, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 max-w-[200px] bg-muted/60 text-foreground/80 text-[11px] font-medium rounded-md px-2 py-0.5"
                  title={`${it.name} ×${it.qty} ${it.unit ?? ""}`}
                >
                  <PackageIcon className="size-3 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{it.name}</span>
                  <span className="font-bold text-primary tabular-nums flex-shrink-0">
                    ×{it.qty}
                  </span>
                </span>
              ))}
              {items.length > 3 && (
                <span className="inline-flex items-center bg-muted/40 text-muted-foreground text-[11px] font-medium rounded-md px-2 py-0.5">
                  +{items.length - 3} เพิ่มเติม
                </span>
              )}
            </div>
          )}

          {/* Row 4: meta — item count + total qty + date + creator */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <PackageIcon className="size-3" />
              {items.length} รายการ
              {totalQty > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>รวม <span className="font-semibold text-foreground tabular-nums">{totalQty.toLocaleString("th-TH")}</span> ชิ้น</span>
                </>
              )}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1" title={fmtDate(po.created_at)}>
              <Calendar className="size-3" />
              {ageLabel(days)}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
              <User className="size-3" />
              <span className="truncate">{po.created_by_name ?? "—"}</span>
            </span>
            {po.expected_date && !["เสร็จสมบูรณ์", "ยกเลิก"].includes(po.status) && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : ""}`}>
                  <Calendar className="size-3" />
                  ครบกำหนด {fmtDate(po.expected_date)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="size-5 flex-shrink-0 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}
