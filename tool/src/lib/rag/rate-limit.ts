/**
 * In-memory token bucket for the chat API.
 *
 * 60 requests per user per hour. Good enough for v1 — if we horizontally
 * scale Next.js the limit will be per-instance, which is an acceptable
 * trade-off until we wire Redis.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 60;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** epoch millis when the current window resets */
  resetAt: number;
}

export function checkChatRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(userId, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.windowStart + WINDOW_MS,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - bucket.count,
    resetAt: bucket.windowStart + WINDOW_MS,
  };
}

/** Testing hook — never called by the API route. */
export function _resetChatRateLimit(): void {
  buckets.clear();
}
