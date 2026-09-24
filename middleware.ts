import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Doit rester aligné avec lib/auth/storage.ts (COOKIE_TOKEN) */
const COOKIE_TOKEN = "nexlink_token";

/**
 * Protection via cookie miroir du JWT (localStorage).
 * Validation JWT réelle : GET /auth/me dans AuthProvider.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_TOKEN)?.value;
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  if (isLogin) {
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|assets/|favicon.ico|.*\\..*).*)"],
};
