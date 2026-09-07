import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getRateLimitHeaders,
} from "@/lib/middleware/rate-limit";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "127.0.0.1";
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Only rate-limit POST, PUT, DELETE requests
  const method = req.method;
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);
  const key = `${ip}:${pathname}`;

  try {
    checkRateLimit(ip, pathname);

    // Add rate limit headers to response
    const headers = getRateLimitHeaders(pathname, key);
    const response = NextResponse.next();
    for (const [headerKey, headerValue] of Object.entries(headers)) {
      response.headers.set(headerKey, headerValue);
    }
    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "RateLimitExceededError"
    ) {
      const retryAfterMs = (error as { retryAfterMs: number }).retryAfterMs;
      return rateLimitResponse(retryAfterMs);
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
