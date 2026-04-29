"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, PackageOpen, Send, Box,
  Wallet, BarChart3, Users, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** ต้องเป็น admin หรือ supervisor ถึงจะเห็น */
  privileged?: boolean;
  /** ต้องเป็น admin เท่านั้น (supervisor ไม่เห็น) */
  adminOnly?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/po", label: "ใบ PO", icon: FileText },
  { href: "/po/pending-receipt", label: "รอรับของ", icon: PackageOpen },
  { href: "/withdraw", label: "เบิกของ", icon: Send },
  { href: "/equipment", label: "Catalog", icon: Box, privileged: true },
  { href: "/budget", label: "งบ", icon: Wallet, privileged: true },
  { href: "/reports", label: "รายงาน", icon: BarChart3, privileged: true },
  { href: "/users", label: "ผู้ใช้", icon: Users, privileged: true },
  // /settings มีไว้ใน dropdown menu ของ user — ไม่ใส่ใน nav bar หลัก
];

export function NavLinks({
  isAdmin, isPrivileged, mobile,
}: {
  isAdmin: boolean;
  /** Admin OR Supervisor — เห็นเมนู privileged */
  isPrivileged?: boolean;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  // Backward compat: ถ้าไม่ pass isPrivileged → fallback ใช้ isAdmin
  const canSeePrivileged = isPrivileged ?? isAdmin;
  const items = ITEMS.filter((it) => {
    if (it.adminOnly) return isAdmin;
    if (it.privileged) return canSeePrivileged;
    return true;
  });

  // ⚡ Longest-match wins — ป้องกัน /po และ /po/pending-receipt มาร์ค active พร้อมกัน
  // 1) เก็บ href ที่ match แล้ว sort หา href ที่ยาวที่สุด
  const matched = items
    .filter((it) =>
      pathname === it.href ||
      (it.href !== "/dashboard" &&
        (pathname === it.href || pathname.startsWith(it.href + "/"))),
    )
    .sort((a, b) => b.href.length - a.href.length);
  const activeHref = matched[0]?.href;

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "relative inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-all",
              active
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              mobile && "h-10 px-3.5 text-[13px]",
            )}
          >
            <Icon className="size-4 flex-shrink-0" />
            <span>{item.label}</span>
            {active && (
              <span className="absolute -bottom-0.5 left-3 right-3 h-0.5 bg-primary rounded-full" />
            )}
          </Link>
        );
      })}
    </>
  );
}
