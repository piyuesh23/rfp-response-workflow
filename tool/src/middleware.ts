import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Protect /engagements/*, /settings/*, and /api/* routes.
 *
 * - Unauthenticated browser requests   → redirect to /login
 * - Unauthenticated API requests       → 401 JSON response
 *
 * Role checks are intentionally NOT performed here — they happen inside
 * individual API route handlers and Server Components using auth-guard.ts.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;

    // API routes: return 401 JSON instead of redirect
    if (pathname.startsWith("/api/")) {
      if (!req.nextauth.token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Return false for API routes so the middleware function above handles it
      // Return true only when a token exists for page routes
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith("/api/")) {
          // Always let middleware function handle API routes
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/", "/engagements/:path*", "/settings/:path*", "/api/:path*"],
};
