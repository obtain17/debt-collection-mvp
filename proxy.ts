import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getClientIp, isRateLimited } from "@/lib/security/rateLimit";

const PUBLIC_STAFF_PATHS = ["/login"];

// The portal's own per-token attempt cap (see lib/portal/verifyIdentity.ts)
// only throttles guesses against one already-known token; this IP-based
// limit additionally slows down scanning/guessing across many tokens.
const PORTAL_RATE_LIMIT = { limit: 60, windowMs: 5 * 60 * 1000 };
// The shared demo password is intentionally simple, so this limit exists to
// slow down automated guessing against staff accounts, not to hide it.
const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // The debtor negotiation portal has its own token-based auth, entirely
  // separate from staff sessions handled here.
  if (pathname.startsWith("/portal") || pathname.startsWith("/api/portal")) {
    if (isRateLimited(`portal:${ip}`, PORTAL_RATE_LIMIT.limit, PORTAL_RATE_LIMIT.windowMs)) {
      return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再度お試しください" }, { status: 429 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/login")) {
    if (isRateLimited(`login:${ip}`, LOGIN_RATE_LIMIT.limit, LOGIN_RATE_LIMIT.windowMs)) {
      return NextResponse.json({ error: "ログイン試行が多すぎます。しばらくしてから再度お試しください" }, { status: 429 });
    }
    return NextResponse.next();
  }

  if (PUBLIC_STAFF_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
