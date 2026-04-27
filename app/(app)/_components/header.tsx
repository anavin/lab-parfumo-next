import Link from "next/link";
import { LogOut, Bell, Package } from "lucide-react";
import { logoutAction } from "@/lib/auth/logout";
import type { User } from "@/lib/types/db";
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
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white shadow-brand">
              <Package className="h-5 w-5" />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-bold text-slate-900">Lab Parfumo</div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-500">
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
            <Link
              href="/notifications"
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 relative"
              aria-label="แจ้งเตือน"
            >
              <Bell className="h-5 w-5" />
            </Link>

            {/* User pill */}
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold flex items-center justify-center">
                {initial}
              </div>
              <div className="leading-tight hidden lg:block">
                <div className="text-xs font-semibold text-slate-700">{user.full_name}</div>
                <div className="text-[10px] text-slate-500">
                  {ROLE_LABEL[user.role] ?? user.role}
                </div>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                aria-label="ออกจากระบบ"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>

        {/* Nav (mobile) — แถวที่สอง */}
        <nav className="md:hidden -mx-4 px-4 pb-2 overflow-x-auto">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <NavLinks isAdmin={isAdmin} mobile />
          </div>
        </nav>
      </div>
    </header>
  );
}
