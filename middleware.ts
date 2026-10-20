import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Lightweight (no DB) Auth.js instance — decodes the JWT only.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const session = req.auth;

  // ── Data APIs: return JSON status codes instead of redirects ──
  if (pathname.startsWith("/api/")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.enabled === false) {
      return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
    }
    if (pathname.startsWith("/api/admin") && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const isAuthRoute = pathname === "/auth/signin" || pathname === "/auth/pending";
  const isAdminRoute = pathname.startsWith("/admin");

  // Not signed in → everything except the auth pages requires a session.
  if (!session?.user) {
    if (isAuthRoute) return NextResponse.next();
    const signInUrl = new URL("/auth/signin", nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  // Signed in but awaiting approval → only the pending page is reachable.
  if (session.user.enabled === false) {
    if (pathname === "/auth/pending") return NextResponse.next();
    return NextResponse.redirect(new URL("/auth/pending", nextUrl.origin));
  }

  // Enabled users have no business on the auth pages.
  if (isAuthRoute) {
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

  // Admin area is admins only.
  if (isAdminRoute && session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/?error=forbidden", nextUrl.origin));
  }

  // Viewer role cannot create or edit nodes.
  const isWriteRoute =
    pathname === "/create" ||
    (pathname.startsWith("/nodes/") && pathname.endsWith("/edit"));
  if (isWriteRoute && session.user.role === "viewer") {
    return NextResponse.redirect(new URL("/explore?error=forbidden", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Exclude Next internals, static assets and the Auth.js endpoints themselves
  // (sign-in/callback/session routes must stay public). Everything else —
  // including the data APIs and /api/admin — goes through the checks above.
  matcher: ["/((?!api/auth|api/health|_next|favicon.ico|public).*)"],
};
