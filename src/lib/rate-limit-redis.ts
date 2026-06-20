/**
 * rate-limit-redis.ts
 *
 * Redis-backed rate limiter using Upstash Redis + @upstash/ratelimit.
 *
 * This is the preferred implementation for production. It is automatically
 * activated when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 * If those vars are missing the module gracefully returns null from getRedisLimiter()
 * and callers fall back to the Postgres-based rate limiter in rate-limit.ts.
 *
 * Environment variables (set in Vercel dashboard):
 *   UPSTASH_REDIS_REST_URL   - https://your-db.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN - your Upstash REST token
 *
 * Usage (in an API route):
 *   const limiter = getRedisLimiter('login', 5, '15m');
 *   if (limiter) {
 *     const { success, reset } = await limiter.limit(clientIp);
 *     if (!success) return rateLimitResponse(Math.ceil((reset - Date.now()) / 1000));
 *   } else {
 *     // fallback to checkRateLimit() from rate-limit.ts
 *   }
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Singleton Redis client (created once, reused across invocations in the same
// serverless instance via module-level caching)
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Create a sliding-window rate limiter backed by Upstash Redis.
 *
 * @param prefix  - Unique prefix for this route (e.g. 'login', 'signup')
 * @param limit   - Max requests allowed per window
 * @param window  - Window duration as a duration string (e.g. '15 m', '1 h')
 * @returns A Ratelimit instance, or null if Redis is not configured.
 */
export function getRedisLimiter(
  prefix: string,
  limit: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `rl:${prefix}`,
    analytics: false, // set to true if you have Upstash analytics
  });
}

/**
 * Unified rate limit check that tries Redis first and falls back to Postgres.
 *
 * @param redisPrefix - Unique prefix for Redis key (e.g. 'login')
 * @param redisLimit  - Max requests per Redis window
 * @param redisWindow - Redis window string
 * @param identifier  - Per-user identifier (IP, email, userId)
 * @param pgKey       - Full Postgres key for fallback (e.g. 'login:127.0.0.1')
 * @param pgLimit     - Postgres limit
 * @param pgWindowMs  - Postgres window in milliseconds
 */
export async function checkRateLimitWithFallback(params: {
  redisPrefix: string;
  redisLimit: number;
  redisWindow: Parameters<typeof Ratelimit.slidingWindow>[1];
  identifier: string;
  // Postgres fallback params
  pgKey: string;
  pgLimit: number;
  pgWindowMs: number;
}): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const limiter = getRedisLimiter(params.redisPrefix, params.redisLimit, params.redisWindow);

  if (limiter) {
    const { success, remaining, reset } = await limiter.limit(params.identifier);
    const retryAfter = success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return { allowed: success, remaining, retryAfter };
  }

  // Postgres fallback
  const { checkRateLimit } = await import('./rate-limit');
  return checkRateLimit({
    key: params.pgKey,
    limit: params.pgLimit,
    windowMs: params.pgWindowMs,
  });
}
