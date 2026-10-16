interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Sliding-window / fixed-window server-side rate limiter for sensitive endpoints.
 */
export function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
  nowMs: number = Date.now()
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || nowMs >= existing.resetAt) {
    const resetAt = nowMs + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
  };
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}
