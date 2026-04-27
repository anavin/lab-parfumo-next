/**
 * Auth middleware — protect all routes except /login + assets
 *
 * Note: middleware runs in Edge runtime — ตรวจแค่ "มี cookie หรือไม่"
 * การ verify session จริง (DB query) ทำใน Server Component layout แทน
 * เพื่อหลีกเลี่ยง Edge runtime limitations
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — ผ่าน
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Static assets / Next internals — ผ่าน (ครอบคลุมโดย matcher แล้ว แต่กันไว้)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ตรวจ session cookie
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match ทุก path ยกเว้น static + assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
