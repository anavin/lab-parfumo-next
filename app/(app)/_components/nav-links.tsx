"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, PackageOpen, Send, Box,
  Wallet, BarChart3, Users, Building2, ScrollText, Boxes,
  ChevronDown, ClipboardList, Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type IconType = typeof LayoutDashboard;

interface NavChild {
  href: string;
  label: string;
  icon: IconType;
  /** ต้องเป็น admin หรือ supervisor ถึงจะเห็น */
  privileged?: boolean;
  /** ต้องเป็น admin เท่านั้น (supervisor ไม่เห็น) */
  adminOnly?: boolean;
}

interface NavLink {
  type: "link";
  href: string;
  label: string;
  icon: IconType;
  privileged?: boolean;
  adminOnly?: boolean;
}

interface NavGroup {
  type: "group";
  /** stable id ใช้เป็น key */
  id: string;
  label: string;
  icon: IconType;
  children: NavChild[];
  /** ถ้า true → ทุกคนเห็น (กรอง children ตาม role)
   *  ถ้า false → ต้องเข้าเงื่อนไข privileged/adminOnly เอง */
  privileged?: boolean;
  adminOnly?: boolean;
}

type NavItem = NavLink | NavGroup;

/**
 * จัดเป็น 5 กลุ่มหลัก เพื่อกัน label wrap บน desktop
 *
 * Staff (requester) เห็นแค่: Dashboard + PO ▾  (2 เมนู)
 * Privileged เห็น: Dashboard + PO ▾ + คลัง ▾ + รายงาน ▾ + ผู้ใช้  (5 เมนู)
 */
const NAV: NavItem[] = [
  {
    type: "link",
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    type: "group",
    id: "po",
    label: "PO",
    icon: ClipboardList,
    children: [
      { href: "/po", label: "ใบ PO ทั้งหมด", icon: FileText },
      { href: "/po/pending-receipt", label: "รอรับของ", icon: PackageOpen },
      { href: "/withdraw", label: "เบิกของ", icon: Send },
    ],
  },
  {
    type: "group",
    id: "stock",
    label: "คลัง",
    icon: Warehouse,
    privileged: true,
    children: [
      { href: "/equipment", label: "Catalog", icon: Box, privileged: true },
      { href: "/lots", label: "Lot/Batch", icon: Boxes, privileged: true },
      { href: "/suppliers", label: "Supplier", icon: Building2, privileged: true },
    ],
  },
  {
    type: "group",
    id: "reports",
    label: "รายงาน",
    icon: BarChart3,
    privileged: true,
    children: [
      { href: "/budget", label: "งบประมาณ", icon: Wallet, privileged: true },
      { href: "/reports", label: "รายงาน", icon: BarChart3, privileged: true },
      { href: "/audit", label: "Audit Log", icon: ScrollText, adminOnly: true },
    ],
  },
  {
    type: "link",
    href: "/users",
    label: "ผู้ใช้",
    icon: Users,
    privileged: true,
  },
];

/** เมนู flat สำหรับ mobile (scroll horizontal) */
const FLAT_FALLBACK: NavLink[] = [
  { type: "link", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { type: "link", href: "/po", label: "ใบ PO", icon: FileText },
  { type: "link", href: "/po/pending-receipt", label: "รอรับของ", icon: PackageOpen },
  { type: "link", href: "/withdraw", label: "เบิกของ", icon: Send },
  { type: "link", href: "/equipment", label: "Catalog", icon: Box, privileged: true },
  { type: "link", href: "/lots", label: "Lot", icon: Boxes, privileged: true },
  { type: "link", href: "/suppliers", label: "Supplier", icon: Building2, privileged: true },
  { type: "link", href: "/budget", label: "งบ", icon: Wallet, privileged: true },
  { type: "link", href: "/reports", label: "รายงาน", icon: BarChart3, privileged: true },
  { type: "link", href: "/users", label: "ผู้ใช้", icon: Users, privileged: true },
  { type: "link", href: "/audit", label: "Audit", icon: ScrollText, adminOnly: true },
];

function isVisible(
  item: { privileged?: boolean; adminOnly?: boolean },
  isAdmin: boolean,
  isPrivileged: boolean,
): boolean {
  if (item.adminOnly) return isAdmin;
  if (item.privileged) return isPrivileged;
  return true;
}

/**
 * pathname ตรงกับ href ไหน — longest-match wins
 * (กัน /po active พร้อม /po/pending-receipt)
 */
function bestMatchHref(pathname: string, hrefs: string[]): string | null {
  const matched = hrefs
    .filter((href) =>
      pathname === href ||
      (href !== "/dashboard" && pathname.startsWith(href + "/")),
    )
    .sort((a, b) => b.length - a.length);
  return matched[0] ?? null;
}

export function NavLinks({
  isAdmin, isPrivileged, mobile,
}: {
  isAdmin: boolean;
  isPrivileged?: boolean;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const canSeePrivileged = isPrivileged ?? isAdmin;

  // Mobile: flat list (horizontal scroll) — ใช้ FLAT_FALLBACK
  if (mobile) {
    const visible = FLAT_FALLBACK.filter((it) => isVisible(it, isAdmin, canSeePrivileged));
    const activeHref = bestMatchHref(pathname, visible.map((it) => it.href));
    return (
      <>
        {visible.map((item) => (
          <FlatLink
            key={item.href}
            item={item}
            active={item.href === activeHref}
            mobile
          />
        ))}
      </>
    );
  }

  // Desktop: grouped — กรอง groups + children ตาม role
  const visibleNav = NAV
    .map((item): NavItem | null => {
      if (item.type === "link") {
        return isVisible(item, isAdmin, canSeePrivileged) ? item : null;
      }
      // group: filter children
      const visibleChildren = item.children.filter((c) =>
        isVisible(c, isAdmin, canSeePrivileged),
      );
      // ถ้า group ตั้ง privileged แล้วผู้ใช้ไม่ผ่าน → ซ่อน
      if (!isVisible(item, isAdmin, canSeePrivileged)) return null;
      // ถ้าไม่มี child เหลือ → ซ่อน
      if (!visibleChildren.length) return null;
      return { ...item, children: visibleChildren };
    })
    .filter((x): x is NavItem => x !== null);

  // หา href ทั้งหมดเพื่อหา active longest-match
  const allHrefs = visibleNav.flatMap((it) =>
    it.type === "link" ? [it.href] : it.children.map((c) => c.href),
  );
  const activeHref = bestMatchHref(pathname, allHrefs);

  return (
    <>
      {visibleNav.map((item) => {
        if (item.type === "link") {
          return (
            <FlatLink
              key={item.href}
              item={item}
              active={item.href === activeHref}
            />
          );
        }
        const groupActive = item.children.some((c) => c.href === activeHref);
        return (
          <NavDropdown
            key={item.id}
            label={item.label}
            icon={item.icon}
            children={item.children}
            activeHref={activeHref}
            groupActive={groupActive}
          />
        );
      })}
    </>
  );
}

function FlatLink({
  item, active, mobile,
}: {
  item: { href: string; label: string; icon: IconType };
  active: boolean;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
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
}

function NavDropdown({
  label, icon: Icon, children, activeHref, groupActive,
}: {
  label: string;
  icon: IconType;
  children: NavChild[];
  activeHref: string | null;
  groupActive: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-all whitespace-nowrap focus:outline-none",
            groupActive
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
        >
          <Icon className="size-4 flex-shrink-0" />
          <span>{label}</span>
          <ChevronDown className="size-3 opacity-60" />
          {groupActive && (
            <span className="absolute -bottom-0.5 left-3 right-3 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children.map((child) => {
          const ChildIcon = child.icon;
          const isActive = child.href === activeHref;
          return (
            <DropdownMenuItem key={child.href} asChild>
              <Link
                href={child.href}
                prefetch
                className={cn(
                  "flex items-center gap-2 cursor-pointer",
                  isActive && "bg-primary/10 text-primary font-semibold",
                )}
              >
                <ChildIcon className="size-4" />
                <span>{child.label}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
