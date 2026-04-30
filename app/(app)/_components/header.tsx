import Link from "next/link";
import { LogOut, Bell, Package, Settings } from "lucide-react";
import { logoutAction } from "@/lib/auth/logout";
import type { User } from "@/lib/types/db";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLinks } from "./nav-links";
import { SearchTrigger } from "./search-trigger";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  requester: "Staff",
};

export function AppHeader({ user }: { user: User }) {
  const isAdmin = user.role === "admin";
  const isPrivileged = user.role === "admin" || user.role === "supervisor";

  return (
    <header className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b border-border/60 supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand */}
          <Link
            href="/dashboard"
            className="flex items-center gap-3 flex-shrink-0 group"
          >
            {/* Logo mark — multi-layer with effects */}
            <div className="relative">
              {/* Outer glow halo (intensifies on hover) */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-brand-700 to-brand-900 rounded-2xl blur-md opacity-50 group-hover:opacity-90 group-hover:blur-lg transition-all duration-500" />

              {/* Logo box with overflow-hidden for shimmer */}
              <div className="relative size-11 rounded-2xl bg-gradient-to-br from-brand-900 via-primary to-brand-700 shadow-lg ring-1 ring-white/15 overflow-hidden group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
                {/* Top-left highlight */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/5 to-transparent" />

                {/* Radial spotlight */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.25),transparent_55%)]" />

                {/* Subtle grid texture */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:8px_8px] opacity-60" />

                {/* Main icon — package (กล่อง) */}
                <div className="relative h-full w-full flex items-center justify-center">
                  <Package
                    className="size-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                    strokeWidth={2.5}
                  />
                </div>

                {/* Animated shimmer sweep on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              </div>
            </div>

            {/* Wordmark */}
            <div className="hidden sm:block leading-tight">
              <div className="text-base font-bold tracking-tight">
                <span className="text-foreground">Lab</span>{" "}
                <span className="bg-gradient-to-r from-primary via-brand-700 to-brand-900 bg-clip-text text-transparent">
                  Parfumo
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-px w-3 bg-gradient-to-r from-primary to-transparent" />
                <span className="text-[9px] font-extrabold tracking-[0.25em] text-primary">
                  PO·PRO
                </span>
                <span className="h-px flex-1 max-w-[12px] bg-gradient-to-l from-primary/40 to-transparent" />
              </div>
            </div>
          </Link>

          {/* Nav (desktop) */}
          <nav className="hidden md:flex flex-1 items-center justify-center">
            <NavLinks isAdmin={isAdmin} isPrivileged={isPrivileged} />
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <SearchTrigger />

            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="size-5" />
                <span className="sr-only">การแจ้งเตือน</span>
              </Button>
            </Link>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 sm:ml-2 sm:pl-2 sm:border-l sm:border-border/40 flex items-center gap-2.5 group focus:outline-none rounded-lg transition-colors hover:bg-accent/50 px-2 py-1">
                  <UserAvatar
                    name={user.full_name}
                    seed={user.username}
                    role={user.role}
                    size="sm"
                  />
                  <div className="leading-tight hidden lg:block text-left">
                    <div className="text-xs font-semibold text-foreground">
                      {user.full_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {ROLE_LABEL[user.role] ?? user.role}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-3 py-2.5">
                  <UserAvatar
                    name={user.full_name}
                    seed={user.username}
                    role={user.role}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-foreground truncate">
                      {user.full_name}
                    </div>
                    <div className="text-xs text-muted-foreground font-normal mt-0.5 truncate">
                      @{user.username}
                    </div>
                    <Badge variant="soft" className="mt-1.5 text-[10px]">
                      {ROLE_LABEL[user.role] ?? user.role}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isPrivileged && (
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="size-4 mr-2" />
                      {isAdmin ? "ตั้งค่าระบบ" : "Lookups"}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/notifications">
                    <Bell className="size-4 mr-2" />
                    แจ้งเตือน
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center px-2 py-1.5 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="size-4 mr-2" />
                    ออกจากระบบ
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Nav (mobile) — แถวที่สอง */}
        <nav className="md:hidden -mx-4 px-4 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <NavLinks isAdmin={isAdmin} isPrivileged={isPrivileged} mobile />
          </div>
        </nav>
      </div>
    </header>
  );
}
