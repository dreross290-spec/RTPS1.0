import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "rtps_token";

/** Routes that are always public (no auth required). */
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/api/auth/login",
  "/api/auth/register",
];

/** Routes that require the admin role. */
const ADMIN_ONLY_PATHS = ["/admin"];

function getJwtKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through without auth
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Only protect routes under /admin, /api (except /api/auth), /transmittal
  const isProtected =
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) ||
    pathname.startsWith("/transmittal");

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getJwtKey(), {
      issuer: "rtps",
      audience: "rtps",
    });

    // Enforce admin-only paths
    if (ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
      if (payload["role"] !== "admin") {
        if (pathname.startsWith("/api")) {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const url = req.nextUrl.clone();
        url.pathname = "/auth/login";
        return NextResponse.redirect(url);
      }
    }

    // Forward user identity to handlers via request headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", String(payload["sub"] ?? ""));
    requestHeaders.set("x-user-email", String(payload["email"] ?? ""));
    requestHeaders.set("x-user-role", String(payload["role"] ?? ""));

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/transmittal/:path*",
    "/api/((?!auth/).*)",
  ],
};
