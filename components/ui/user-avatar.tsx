/**
 * UserAvatar — premium auto-generated SVG avatar (boring-avatars)
 *
 * Design:
 * - Each user gets a unique SVG avatar generated from username (deterministic)
 * - Variant "beam" — simple cute face style (premium yet friendly)
 * - Brand-aligned color palette
 * - Admin: gold Crown badge bottom-right
 * - Soft outer halo glow + inner ring for depth
 */
"use client";

import Avatar from "boring-avatars";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

// Brand-aligned color palette — uses Lab Parfumo blues + warm accents
// boring-avatars cycles through these colors per shape
const PALETTE = ["#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#F59E0B"];

const SIZE_MAP = {
  sm: { px: 32, badge: "size-3.5", icon: "size-2" },
  md: { px: 40, badge: "size-4", icon: "size-2.5" },
  lg: { px: 48, badge: "size-5", icon: "size-3" },
  xl: { px: 64, badge: "size-6", icon: "size-3.5" },
} as const;

export interface UserAvatarProps {
  name: string;
  /** Stable seed for the avatar generator (e.g. username/id). Falls back to name. */
  seed?: string;
  role?: "admin" | "requester" | string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  /** Show subtle online dot (e.g. for "current user") */
  online?: boolean;
  /** Avatar variant from boring-avatars. Default: "beam" (cute faces) */
  variant?: "beam" | "marble" | "bauhaus" | "ring" | "sunset" | "pixel";
}

export function UserAvatar({
  name, seed, role, size = "md", className, online, variant = "beam",
}: UserAvatarProps) {
  const dim = SIZE_MAP[size];
  const isAdmin = role === "admin";
  const avatarSeed = seed || name || "user";

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: dim.px, height: dim.px }}
    >
      {/* Soft halo glow behind avatar */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-md opacity-60"
      />

      {/* Avatar SVG — wrapped to apply rounded-full + ring */}
      <div
        className="relative rounded-full overflow-hidden ring-1 ring-border/40 shadow-sm bg-background"
        style={{ width: dim.px, height: dim.px }}
      >
        <Avatar
          name={avatarSeed}
          variant={variant}
          colors={PALETTE}
          size={dim.px}
        />
      </div>

      {/* Admin: gold crown badge */}
      {isAdmin && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full",
            "bg-gradient-to-br from-amber-400 to-amber-600",
            "ring-2 ring-background shadow-md",
            "flex items-center justify-center",
            dim.badge,
          )}
          title="แอดมิน"
        >
          <Crown
            className={cn("text-white", dim.icon)}
            fill="currentColor"
            strokeWidth={2}
          />
        </span>
      )}

      {/* Online dot (only when online + not admin) */}
      {online && !isAdmin && (
        <span
          className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
          title="กำลังใช้งาน"
        />
      )}
    </div>
  );
}
