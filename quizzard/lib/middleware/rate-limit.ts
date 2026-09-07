import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const ipCache = new Map<string, string | null>();

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

function isRateLimited(
  key: string,
  config: RateLimitConfig
): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { limited: false, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.max) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { limited: false, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

const RATE_LIMITS: Array<{
  pattern: RegExp;
  config: RateLimitConfig;
}> = [
  // Auth routes: 10/min per IP
  {
    pattern: /^\/api\/auth\/(login|signup|logout)$/,
    config: { windowMs: 60 * 1000, max: 10 },
  },
  // Class join: 5/min per IP
  {
    pattern: /^\/api\/classes\/join$/,
    config: { windowMs: 60 * 1000, max: 5 },
  },
  // General API: 100/min per IP
  {
    pattern: /^\/api\//,
    config: { windowMs: 60 * 1000, max: 100 },
  },
];

function getRateLimitConfig(path: string): RateLimitConfig | null {
  for (const { pattern, config } of RATE_LIMITS) {
    if (pattern.test(path)) {
      return config;
    }
  }
  return null;
}

// Cleanup old entries every minute
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

export function isRateLimitError(err: unknown): boolean {
  return err instanceof RateLimitExceededError;
}

export class RateLimitExceededError extends Error {
  constructor(
    public readonly retryAfterMs: number
  ) {
    super("Too many requests");
    this.name = "RateLimitExceededError";
  }
}

export function checkRateLimit(ip: string, path: string): void {
  cleanup();

  const config = getRateLimitConfig(path);
  if (!config) return;

  const key = `${ip}:${path}`;
  const result = isRateLimited(key, config);

  if (result.limited) {
    throw new RateLimitExceededError(result.resetAt - Date.now());
  }
}

export function getRateLimitHeaders(
  path: string,
  key: string
): Record<string, string> {
  const config = getRateLimitConfig(path);
  if (!config) return {};

  const result = isRateLimited(key, config);
  return {
    "X-RateLimit-Limit": String(config.max),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function rateLimitResponse(retryAfterMs: number) {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

// Per-user / per-resource rate limit stores
const userResourceStore = new Map<string, RateLimitEntry>();

/**
 * Check per-user rate limit for quiz attempt start.
 * Limits: 3 attempts per user per quiz per minute.
 */
export function checkAttemptStartRateLimit(userId: string, quizId: string): void {
  cleanup();
  const key = `attempt:${userId}:${quizId}`;
  const config = { windowMs: 60 * 1000, max: 3 };
  const result = isRateLimited(key, config);
  if (result.limited) {
    throw new RateLimitExceededError(result.resetAt - Date.now());
  }
}

/**
 * Check per-teacher rate limit for AI generation.
 * Limits: 5 generations per teacher per hour.
 */
export function checkGenerationRateLimit(teacherId: string): void {
  cleanup();
  const key = `gen:${teacherId}`;
  const config = { windowMs: 60 * 60 * 1000, max: 5 };
  const result = isRateLimited(key, config);
  if (result.limited) {
    throw new RateLimitExceededError(result.resetAt - Date.now());
  }
}
