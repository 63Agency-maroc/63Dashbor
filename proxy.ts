import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Doit rester aligné avec lib/auth/storage.ts (COOKIE_TOKEN) — flag présence only */
const COOKIE_TOKEN = "nexlink_token";

/**
 * Guard léger via cookie de présence (localStorage = source de vérité JWT).
 * - Routes protégées sans cookie → /login
 * - /login : jamais de redirect ici (évite bounce cookie↔RequireAuth) ;
 *   RedirectIfAuthenticated gère le cas « déjà connecté » côté client.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(COOKIE_TOKEN)?.value);
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  if (isLogin) {
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|assets/|favicon.ico|.*\\..*).*)"],
};
