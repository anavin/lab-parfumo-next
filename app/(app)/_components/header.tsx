import Link from "next/link";
import { LogOut, Bell, Package, Settings } from "lucide-react";
import { logoutAction } from "@/lib/auth/logout";
import type { User } from "@/lib/types/db";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLinks } from "./nav-links";
import { SearchTrigger } from "./search-trigger";

const ROLE_LABEL: Record<string, string> = {
  admin: "แอดมิน + จัดซื้อ",
  requester: "ผู้สั่ง",
};

export function AppHeader({ user }: { user: User }) {
  const initial = (user.full_name || "U")[0].toUpperCase();
  const isAdmin = user.role === "admin";

  return (
    <header className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b border-border/60 supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Brand */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-lg blur-sm group-hover:blur-md transition-all" />
              <div className="relative size-9 rounded-lg bg-gradient-to-br from-primary to-brand-900 flex items-center justify-center text-white shadow-brand">
                <Package className="size-4.5" strokeWidth={2.5} />
              </div>
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-bold text-foreground tracking-tight">
                Lab Parfumo
              </div>
              <div className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">
                PO PRO
              </div>
            </div>
          </Link>

          {/* Nav (desktop) */}
          <nav className="hidden md:flex flex-1 items-center justify-center">
            <NavLinks isAdmin={isAdmin} />
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
                <button className="ml-1 sm:ml-2 sm:pl-2 sm:border-l sm:border-border/40 flex items-center gap-2 group focus:outline-none rounded-lg transition-colors hover:bg-accent/50 px-2 py-1">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
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
                <DropdownMenuLabel>
                  <div className="font-bold text-sm text-foreground">
                    {user.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal mt-0.5">
                    @{user.username}
                  </div>
                  <Badge variant="soft" className="mt-1.5 text-[10px]">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="size-4 mr-2" />
                      ตั้งค่าระบบ
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
            <NavLinks isAdmin={isAdmin} mobile />
          </div>
        </nav>
      </div>
    </header>
  );
}
