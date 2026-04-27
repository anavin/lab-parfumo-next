"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, PackageOpen, Send, Box,
  Wallet, BarChart3, Users, Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/po", label: "ใบ PO", icon: FileText },
  { href: "/po/pending-receipt", label: "รอรับของ", icon: PackageOpen },
  { href: "/withdraw", label: "เบิกของ", icon: Send },
  { href: "/equipment", label: "Catalog", icon: Box, adminOnly: true },
  { href: "/budget", label: "งบ", icon: Wallet, adminOnly: true },
  { href: "/reports", label: "รายงาน", icon: BarChart3, adminOnly: true },
  { href: "/users", label: "ผู้ใช้", icon: Users, adminOnly: true },
  { href: "/settings", label: "ตั้งค่า", icon: Settings, adminOnly: true },
];

export function NavLinks({ isAdmin, mobile }: { isAdmin: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((it) => isAdmin || !it.adminOnly);

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-colors",
              active
                ? "bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              mobile && "h-10 px-3.5",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}
