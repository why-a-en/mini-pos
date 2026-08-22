import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

// Cheap cookie-presence check only — not a real session validation (that
// needs a DB hit, which happens in the (dashboard) layout server component
// instead). See docs/TECH_STACK.md's architecture notes: keeps this simple
// and keeps the DB hit in one place rather than duplicated here too. (Next
// 16 runs Proxy on the Node.js runtime by default, so a DB call would work
// here now — this split is for separation of concerns, not a runtime
// limitation.)
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!hasSessionCookie && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
