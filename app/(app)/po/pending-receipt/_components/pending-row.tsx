"use client";

/**
 * PendingReceiptRow — optimized for "รอรับของ" context
 *
 * Emphasizes the dates that matter for receiving:
 * - Expected delivery date (BIG, color-coded by urgency)
 * - Days until/past (clear text, no math required)
 * - Tracking number (admin only)
 * - Order date (small, contextual)
 */
import Link from "next/link";
import {
  ChevronRight, Calendar, User, Package as PackageIcon,
  Building2, Clock, AlertTriangle, Truck, PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PurchaseOrder } from "@/lib/types/db";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}

function fmtDateLong(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

/** ชื่อเต็มวันในสัปดาห์ภาษาไทย เช่น "วันอาทิตย์" */
function fmtWeekday(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { weekday: "long" });
}

interface UrgencyState {
  // visual tone
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  iconColor: string;
  ringColor: string;
  borderColor: string;
  // copy
  bigText: string;          // "วันนี้" / "เลยกำหนด 3 วัน" / "อีก 5 วัน"
  bigTextColor: string;
  contextLabel: string;     // "ครบกำหนดวันนี้" / "ควรมาถึงเมื่อ" / "คาดว่าจะได้รับ"
}

function urgencyState(expectedDate: string | null): UrgencyState {
  if (!expectedDate) {
    return {
      badgeBg: "bg-slate-100 text-slate-600",
      badgeText: "ไม่ระบุกำหนด",
      iconBg: "bg-slate-100",
      iconColor: "text-slate-500",
      ringColor: "ring-slate-200/60",
      borderColor: "border-border",
      bigText: "—",
      bigTextColor: "text-muted-foreground",
      contextLabel: "ยังไม่กรอกวันที่คาดว่าจะได้รับ",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expected = new Date(expectedDate);
  expected.setHours(0, 0, 0, 0);
  const diffDays = Math.round((expected.getTime() - today.getTime()) / 86400_000);

  if (diffDays < 0) {
    // OVERDUE
    const days = Math.abs(diffDays);
    return {
      badgeBg: "bg-red-100 text-red-700 ring-red-300",
      badgeText: `เลยกำหนด ${days} วัน`,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      ringColor: "ring-red-200/60",
      borderColor: "border-red-200",
      bigText: `เลยกำหนด ${days} วัน`,
      bigTextColor: "text-red-700",
      contextLabel: "ควรมาถึงเมื่อ",
    };
  }

  if (diffDays === 0) {
    // TODAY
    return {
      badgeBg: "bg-amber-100 text-amber-800 ring-amber-300",
      badgeText: "ครบกำหนดวันนี้",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      ringColor: "ring-amber-200/60",
      borderColor: "border-amber-200",
      bigText: "วันนี้",
      bigTextColor: "text-amber-700",
      contextLabel: "ครบกำหนดวันนี้",
    };
  }

  if (diffDays <= 3) {
    // UPCOMING (1-3 days)
    return {
      badgeBg: "bg-amber-100 text-amber-700 ring-amber-300",
      badgeText: `อีก ${diffDays} วัน`,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      ringColor: "ring-amber-200/60",
      borderColor: "border-amber-200",
      bigText: `อีก ${diffDays} วัน`,
      bigTextColor: "text-amber-700",
      contextLabel: "คาดว่าจะได้รับ",
    };
  }

  // LATER (>3 days)
  return {
    badgeBg: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    badgeText: `อีก ${diffDays} วัน`,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-700",
    ringColor: "ring-emerald-200/60",
    borderColor: "border-border",
    bigText: `อีก ${diffDays} วัน`,
    bigTextColor: "text-emerald-700",
    contextLabel: "คาดว่าจะได้รับ",
  };
}

export function PendingRow({
  po, isAdmin,
}: {
  po: PurchaseOrder;
  isAdmin: boolean;
}) {
  const u = urgencyState(po.expected_date);
  const items = po.items ?? [];
  const totalQty = items.reduce((s, it) => s + (it.qty ?? 0), 0);
  const supplier = po.supplier_name ?? "(ยังไม่ระบุ supplier)";
  const noSupplier = !po.supplier_name;
  const isShipping = po.status === "กำลังขนส่ง";

  const amountStr = isAdmin && po.total
    ? `฿${po.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
    : null;

  return (
    <div
      className={`group bg-card border rounded-2xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${u.borderColor} ${u.borderColor.includes("red") || u.borderColor.includes("amber") ? "" : "hover:border-primary/40"}`}
    >
      <div className="p-4 flex items-start gap-4">
        {/* LEFT: Icon + identity + items */}
        <div
          className={`flex-shrink-0 size-12 rounded-2xl flex items-center justify-center ring-1 ${u.iconBg} ${u.iconColor} ${u.ringColor}`}
        >
          {isShipping ? (
            <Truck className="size-6" strokeWidth={2.25} />
          ) : (
            <PackageOpen className="size-6" strokeWidth={2.25} />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Row 1: PO# + supplier */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/po/${po.id}`}
              className="font-extrabold text-sm font-mono text-foreground hover:text-primary tracking-tight"
            >
              {po.po_number}
            </Link>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1.5 text-sm min-w-0">
              <Building2 className={`size-3.5 flex-shrink-0 ${noSupplier ? "text-muted-foreground/40" : "text-primary"}`} />
              <span className={`truncate font-semibold ${noSupplier ? "text-muted-foreground italic" : "text-foreground"}`} title={supplier}>
                {supplier}
              </span>
            </span>
          </div>

          {/* Row 2: Item chips */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {items.slice(0, 3).map((it, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 max-w-[200px] bg-muted/60 text-foreground/80 text-[11px] font-medium rounded-md px-2 py-0.5"
                  title={`${it.name} ×${it.qty} ${it.unit ?? ""}`}
                >
                  <PackageIcon className="size-3 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{it.name}</span>
                  <span className="font-bold text-primary tabular-nums flex-shrink-0">×{it.qty}</span>
                </span>
              ))}
              {items.length > 3 && (
                <span className="inline-flex items-center bg-muted/40 text-muted-foreground text-[11px] font-medium rounded-md px-2 py-0.5">
                  +{items.length - 3} เพิ่มเติม
                </span>
              )}
            </div>
          )}

          {/* Row 3: meta line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <PackageIcon className="size-3" />
              {items.length} รายการ
              {totalQty > 0 && <> · รวม <span className="font-semibold text-foreground tabular-nums">{totalQty.toLocaleString("th-TH")}</span> ชิ้น</>}
            </span>
            {po.ordered_date && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  สั่งเมื่อ {fmtDate(po.ordered_date)}
                </span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
              <User className="size-3" />
              <span className="truncate">{po.created_by_name ?? "—"}</span>
            </span>
          </div>

          {/* Row 4: tracking (admin) */}
          {isAdmin && po.tracking_number && (
            <div className="text-[11px] inline-flex items-center gap-1.5">
              <Truck className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">Tracking</span>
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {po.tracking_number}
              </code>
            </div>
          )}
        </div>

        {/* RIGHT: BIG urgency display */}
        <div className="flex-shrink-0 text-right min-w-[140px] space-y-1">
          {/* Mini context label */}
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {u.contextLabel}
          </div>
          {/* Expected date — BIG */}
          {po.expected_date ? (
            <>
              <div className={`text-base font-extrabold tabular-nums ${u.bigTextColor}`}>
                {fmtDate(po.expected_date)}
              </div>
              <div className={`text-[11px] font-bold inline-flex items-center gap-1 ${u.bigTextColor}`}>
                {u.bigText.includes("เลย") && <AlertTriangle className="size-3" />}
                {u.bigText.includes("วันนี้") && <Clock className="size-3 animate-pulse" />}
                {u.bigText.includes("อีก") && <Clock className="size-3" />}
                {u.bigText}
              </div>
              <div className="text-[10px] text-muted-foreground" title={fmtDateLong(po.expected_date)}>
                {fmtWeekday(po.expected_date)}
              </div>
            </>
          ) : (
            <div className="text-sm font-semibold text-muted-foreground italic">
              ยังไม่กรอก
            </div>
          )}

          {/* Amount */}
          {amountStr && (
            <div className="pt-2 border-t border-border/50">
              <div className="text-base font-extrabold tabular-nums text-foreground">
                {amountStr}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action footer — compact */}
      <div className="flex items-center gap-1.5 px-4 pb-3 pt-1 border-t border-border/40">
        {isShipping ? (
          <Link href={`/po/${po.id}`}>
            <Button size="xs" variant="primary">
              <PackageOpen className="size-3" /> รับของ
            </Button>
          </Link>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 font-semibold"
            title="ต้องรอแอดมินอัปเดตสถานะขนส่งก่อน ถึงจะกดรับของได้"
          >
            <Truck className="size-3" /> รอขนส่งก่อน
          </span>
        )}
        <Link href={`/po/${po.id}`}>
          <Button size="xs" variant="outline">
            ดูรายละเอียด
            <ChevronRight className="size-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
