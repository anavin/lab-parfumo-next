/**
 * Status visual tokens — single source of truth
 *
 * Before M3: 4+ files defined their own STATUS_VISUAL / STATUS_STYLE map
 * with copy-pasted Tailwind class strings. Changing "สั่งซื้อแล้ว" from blue
 * to emerald took edits in po-row.tsx, dashboard/page.tsx,
 * staff-dashboard.tsx, reports-client.tsx, and po-document.tsx (PDF).
 *
 * After M3: each status has ONE hue declared here. Component-specific
 * adapters derive the exact classes they need from this base.
 *
 * UI consumers:
 *   - po-row.tsx               (PO list row)
 *   - dashboard/page.tsx       (admin action items + KPI status grid)
 *   - staff-dashboard.tsx      (staff "my POs" grid + row)
 *   - reports-client.tsx       (chart cell color — hex for recharts)
 *   - pdf/po-document.tsx      (PDF rendering — hex)
 *
 * @see STATUS_HUE for the canonical color mapping
 */
import {
  ClipboardEdit, ShoppingBag, Truck, PackageCheck,
  AlertTriangle, CheckCircle2, XCircle, type LucideIcon,
} from "lucide-react";
import type { PoStatus } from "@/lib/types/db";

/** Tailwind color family per status — change here = all UIs follow */
export type StatusHue = "amber" | "emerald" | "indigo" | "cyan" | "red" | "green" | "slate";

export const STATUS_HUE: Record<PoStatus, StatusHue> = {
  "รอจัดซื้อดำเนินการ": "amber",
  "สั่งซื้อแล้ว":       "emerald",    // เขียวอ่อน — admin ดำเนินการแล้ว
  "กำลังขนส่ง":         "indigo",
  "รับของแล้ว":         "cyan",
  "มีปัญหา":            "red",
  "เสร็จสมบูรณ์":       "green",      // เขียวเข้ม — แยกจาก "สั่งซื้อแล้ว"
  "ยกเลิก":             "slate",
};

export const STATUS_ICON: Record<PoStatus, LucideIcon> = {
  "รอจัดซื้อดำเนินการ": ClipboardEdit,
  "สั่งซื้อแล้ว":       ShoppingBag,
  "กำลังขนส่ง":         Truck,
  "รับของแล้ว":         PackageCheck,
  "มีปัญหา":            AlertTriangle,
  "เสร็จสมบูรณ์":       CheckCircle2,
  "ยกเลิก":             XCircle,
};

/** Short labels — used when full status name is too long for the UI cell */
export const STATUS_SHORT_LABEL: Record<PoStatus, string> = {
  "รอจัดซื้อดำเนินการ": "รอจัดซื้อ",
  "สั่งซื้อแล้ว":       "สั่งซื้อแล้ว",
  "กำลังขนส่ง":         "กำลังขนส่ง",
  "รับของแล้ว":         "รับของแล้ว",
  "มีปัญหา":            "มีปัญหา",
  "เสร็จสมบูรณ์":       "เสร็จสมบูรณ์",
  "ยกเลิก":             "ยกเลิก",
};

// =====================================================================
// Hex palette for non-Tailwind consumers (PDF, recharts)
// =====================================================================
interface HexShade { c50: string; c100: string; c200: string; c500: string; c600: string; c700: string; c800: string; }
const HEX: Record<StatusHue, HexShade> = {
  amber:   { c50: "#FFFBEB", c100: "#FEF3C7", c200: "#FDE68A", c500: "#F59E0B", c600: "#D97706", c700: "#B45309", c800: "#92400E" },
  emerald: { c50: "#ECFDF5", c100: "#D1FAE5", c200: "#A7F3D0", c500: "#10B981", c600: "#059669", c700: "#047857", c800: "#065F46" },
  indigo:  { c50: "#EEF2FF", c100: "#E0E7FF", c200: "#C7D2FE", c500: "#6366F1", c600: "#4F46E5", c700: "#4338CA", c800: "#3730A3" },
  cyan:    { c50: "#ECFEFF", c100: "#CFFAFE", c200: "#A5F3FC", c500: "#06B6D4", c600: "#0891B2", c700: "#0E7490", c800: "#155E75" },
  red:     { c50: "#FEF2F2", c100: "#FEE2E2", c200: "#FECACA", c500: "#EF4444", c600: "#DC2626", c700: "#B91C1C", c800: "#991B1B" },
  green:   { c50: "#F0FDF4", c100: "#DCFCE7", c200: "#BBF7D0", c500: "#22C55E", c600: "#16A34A", c700: "#15803D", c800: "#166534" },
  slate:   { c50: "#F8FAFC", c100: "#F1F5F9", c200: "#E2E8F0", c500: "#64748B", c600: "#475569", c700: "#334155", c800: "#1E293B" },
};

/** Hex map for recharts Cell + PDF rendering */
export const STATUS_HEX = {
  pill:    (s: PoStatus) => HEX[STATUS_HUE[s]].c500,
  pillBg:  (s: PoStatus) => HEX[STATUS_HUE[s]].c50,
  pillFg:  (s: PoStatus) => HEX[STATUS_HUE[s]].c700,
};

// =====================================================================
// Tailwind class adapters — one per component-shape
// =====================================================================
//
// Each adapter returns the exact class strings the component expects.
// Centralizing keeps the same hue used consistently across surfaces.
// Note: full class strings (not template-built) — Tailwind JIT requires
// literal class names to be visible in source.

interface PillBundle {
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  /** Used as compact pill — e.g. "<status name>" badge */
  pillClass: string;
  /** Background for a circular icon container */
  iconBg: string;
  /** Foreground icon color */
  iconColor: string;
  /** Combined "bg + text" — convenience for callers that want one class string */
  iconTone: string;
  /** Ring color modifier for the icon container */
  ringColor: string;
  /** Heading text color when status is the page accent */
  textColor: string;
}

// Pre-built class strings per hue. Tailwind JIT scans these literals at build.
const HUE_CLASSES: Record<StatusHue, Omit<PillBundle, "icon" | "label" | "shortLabel">> = {
  amber: {
    pillClass: "bg-amber-50 text-amber-700 ring-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    iconTone: "bg-amber-100 text-amber-700",
    ringColor: "ring-amber-200/60",
    textColor: "text-amber-700",
  },
  emerald: {
    pillClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    iconTone: "bg-emerald-100 text-emerald-700",
    ringColor: "ring-emerald-200/60",
    textColor: "text-emerald-700",
  },
  indigo: {
    pillClass: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
    iconTone: "bg-indigo-100 text-indigo-700",
    ringColor: "ring-indigo-200/60",
    textColor: "text-indigo-700",
  },
  cyan: {
    pillClass: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-700",
    iconTone: "bg-cyan-100 text-cyan-700",
    ringColor: "ring-cyan-200/60",
    textColor: "text-cyan-700",
  },
  red: {
    pillClass: "bg-red-50 text-red-700 ring-red-200",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
    iconTone: "bg-red-100 text-red-700",
    ringColor: "ring-red-200/60",
    textColor: "text-red-700",
  },
  green: {
    // เขียวเข้ม — แยกจาก emerald
    pillClass: "bg-green-100 text-green-800 ring-green-300",
    iconBg: "bg-green-200",
    iconColor: "text-green-800",
    iconTone: "bg-green-200 text-green-800",
    ringColor: "ring-green-300/60",
    textColor: "text-green-800",
  },
  slate: {
    pillClass: "bg-slate-100 text-slate-500 ring-slate-200",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    iconTone: "bg-slate-100 text-slate-500",
    ringColor: "ring-slate-200/60",
    textColor: "text-slate-700",
  },
};

/** Derive the visual bundle for any PO status — used by po-row, dashboards, etc. */
export function getStatusVisual(status: PoStatus): PillBundle {
  const hue = STATUS_HUE[status];
  return {
    ...HUE_CLASSES[hue],
    icon: STATUS_ICON[status],
    label: status,
    shortLabel: STATUS_SHORT_LABEL[status],
  };
}

/**
 * Softer variant — bg-50 + text-600 — used by dashboard ActionRow where
 * the icon needs to read more like a row decoration than a pill badge.
 */
interface SoftBundle {
  icon: LucideIcon;
  iconBg: string;     // bg-{hue}-50
  iconColor: string;  // text-{hue}-600 — slightly darker on the lighter bg
  ringColor: string;
  textColor: string;
}

const HUE_SOFT: Record<StatusHue, Omit<SoftBundle, "icon">> = {
  amber:   { iconBg: "bg-amber-50",   iconColor: "text-amber-600",   ringColor: "ring-amber-200/60",   textColor: "text-amber-700"   },
  emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", ringColor: "ring-emerald-200/60", textColor: "text-emerald-700" },
  indigo:  { iconBg: "bg-indigo-50",  iconColor: "text-indigo-600",  ringColor: "ring-indigo-200/60",  textColor: "text-indigo-700"  },
  cyan:    { iconBg: "bg-cyan-50",    iconColor: "text-cyan-600",    ringColor: "ring-cyan-200/60",    textColor: "text-cyan-700"    },
  red:     { iconBg: "bg-red-50",     iconColor: "text-red-600",     ringColor: "ring-red-200/60",     textColor: "text-red-700"     },
  green:   { iconBg: "bg-green-50",   iconColor: "text-green-700",   ringColor: "ring-green-300/60",   textColor: "text-green-800"   },
  slate:   { iconBg: "bg-slate-50",   iconColor: "text-slate-600",   ringColor: "ring-slate-200/60",   textColor: "text-slate-700"   },
};

export function getStatusSoft(status: PoStatus): SoftBundle {
  const hue = STATUS_HUE[status];
  return { ...HUE_SOFT[hue], icon: STATUS_ICON[status] };
}
