import { NextRequest, NextResponse } from "next/server";

/**
 * EOB Authentication Gate Middleware
 *
 * Flow:
 * A. Query string ?token=<at>&refresh=<rt> present (first entry from portal):
 *    - Verify token via EOB /api/auth/me
 *    - On success: set javis_eob_refresh cookie (7 days), redirect to clean URL
 *    - On failure: redirect to EOB login
 * B. Cookie "javis_eob_refresh" exists: pass through (no EOB call)
 * C. No cookie, no token query: redirect to EOB login
 */

const COOKIE_NAME = "javis_eob_refresh";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function getEobApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_EOB_API_URL || "http://localhost:3000"
  );
}

function getEobLoginUrl(): string {
  return (
    process.env.NEXT_PUBLIC_EOB_LOGIN_URL || "http://localhost:3000/login"
  );
}

export async function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  const refresh = searchParams.get("refresh");

  // --- Case A: First entry from portal with ?token=&refresh= ---
  if (token && refresh) {
    try {
      const res = await fetch(`${getEobApiUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Build clean URL (strip token & refresh params)
        // Use external URL so redirect goes to public domain, not internal 0.0.0.0
        const proto =
          request.headers.get("x-forwarded-proto") ||
          (request.nextUrl.protocol === "https:" ? "https" : "http");
        const host =
          request.headers.get("x-forwarded-host") ||
          request.headers.get("host") ||
          request.nextUrl.host;
        const cleanUrl = new URL(
          `${proto}://${host}${request.nextUrl.pathname}`,
        );
        // Copy all search params except token & refresh
        request.nextUrl.searchParams.forEach((v, k) => {
          if (k !== "token" && k !== "refresh") cleanUrl.searchParams.set(k, v);
        });

        const response = NextResponse.redirect(cleanUrl);
        response.cookies.set(COOKIE_NAME, refresh, {
          maxAge: COOKIE_MAX_AGE,
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
        });
        return response;
      }
    } catch {
      // fetch failed — fall through to login redirect
    }

    // Token verification failed — redirect to EOB login
    const loginUrl = buildLoginRedirect(request);
    return NextResponse.redirect(loginUrl);
  }

  // --- Case B: Cookie exists — pass through ---
  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.next();
  }

  // --- Case C: No cookie, no token — redirect to EOB login ---
  const loginUrl = buildLoginRedirect(request);
  return NextResponse.redirect(loginUrl);
}

/**
 * Get the external (public-facing) URL from the request,
 * respecting X-Forwarded-* headers set by the nginx reverse proxy.
 */
function getExternalUrl(request: NextRequest): string {
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (request.nextUrl.protocol === "https:" ? "https" : "http");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  return `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
}

/**
 * Build EOB login URL with return parameter pointing back to the current page.
 */
function buildLoginRedirect(request: NextRequest): URL {
  const eobLoginUrl = getEobLoginUrl();
  const loginUrl = new URL(eobLoginUrl);
  loginUrl.searchParams.set("return", getExternalUrl(request));
  return loginUrl;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /_next/static (static files)
     * - /_next/image (image optimization)
     * - /favicon.ico (favicon)
     * - /api/* (API routes)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/).*)",
  ],
};
