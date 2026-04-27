/**
 * UserAvatar — premium avatar with deterministic colors per user + role badge
 *
 * Design:
 * - Each user gets a unique gradient color hashed from username (8-color palette)
 * - Admin: tiny gold Crown badge bottom-right
 * - Requester: clean (no badge)
 * - Initials: up to 2 chars from full_name (e.g. "ผู้ดูแลระบบ" → "ผด")
 * - Soft inner ring for depth
 */
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

// 8 gradient palettes — Tailwind gradient stops (from → to)
// Picked for good contrast with white text + harmony with brand
const PALETTE = [
  { bg: "from-indigo-500 to-violet-600", ring: "ring-indigo-200/60" },
  { bg: "from-sky-500 to-blue-600", ring: "ring-sky-200/60" },
  { bg: "from-emerald-500 to-teal-600", ring: "ring-emerald-200/60" },
  { bg: "from-amber-500 to-orange-600", ring: "ring-amber-200/60" },
  { bg: "from-rose-500 to-pink-600", ring: "ring-rose-200/60" },
  { bg: "from-fuchsia-500 to-purple-600", ring: "ring-fuchsia-200/60" },
  { bg: "from-cyan-500 to-blue-500", ring: "ring-cyan-200/60" },
  { bg: "from-slate-600 to-slate-800", ring: "ring-slate-200/60" },
] as const;

/** Stable hash → palette index */
function paletteFor(seed: string): typeof PALETTE[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/** Extract up to 2 initial chars (works with Thai too) */
function initialsOf(name: string): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // Single token (Thai name without space) → take first 2 chars
  return trimmed.slice(0, 2).toUpperCase();
}

const SIZE_MAP = {
  sm: { box: "size-8", text: "text-[11px]", badge: "size-3.5", icon: "size-2" },
  md: { box: "size-10", text: "text-xs", badge: "size-4", icon: "size-2.5" },
  lg: { box: "size-12", text: "text-sm", badge: "size-5", icon: "size-3" },
  xl: { box: "size-16", text: "text-lg", badge: "size-6", icon: "size-3.5" },
} as const;

export interface UserAvatarProps {
  name: string;
  /** Stable seed for color (e.g. username/id). Falls back to name. */
  seed?: string;
  role?: "admin" | "requester" | string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  /** Show subtle online dot (e.g. for "current user") */
  online?: boolean;
}

export function UserAvatar({
  name, seed, role, size = "md", className, online,
}: UserAvatarProps) {
  const palette = paletteFor(seed || name || "x");
  const initials = initialsOf(name);
  const dim = SIZE_MAP[size];
  const isAdmin = role === "admin";

  return (
    <div className={cn("relative inline-flex shrink-0", dim.box, className)}>
      {/* Soft outer halo */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full blur-[6px] opacity-30",
          `bg-gradient-to-br ${palette.bg}`,
        )}
      />
      {/* Avatar core */}
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center rounded-full",
          "bg-gradient-to-br text-white font-bold tracking-tight select-none",
          "ring-1 ring-inset ring-white/20 shadow-sm",
          palette.bg,
          dim.text,
        )}
      >
        <span className="leading-none drop-shadow-sm">{initials}</span>
      </div>

      {/* Admin: gold crown badge */}
      {isAdmin && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full",
            "bg-gradient-to-br from-amber-400 to-amber-600",
            "ring-2 ring-background shadow-sm",
            "flex items-center justify-center",
            dim.badge,
          )}
          title="แอดมิน"
        >
          <Crown className={cn("text-white", dim.icon)} fill="currentColor" strokeWidth={2} />
        </span>
      )}

      {/* Online dot (only when online + not admin, since corner is taken) */}
      {online && !isAdmin && (
        <span
          className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
          title="กำลังใช้งาน"
        />
      )}
    </div>
  );
}
