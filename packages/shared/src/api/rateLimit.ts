import { Ratelimit } from '@upstash/ratelimit';
import type { Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import * as Sentry from '@sentry/nextjs';
import { ApiError, ErrorCode } from '../errors';

/**
 * AUTHENTICATED per-user rate limiting (Upstash Redis, ARCHITECTURE_DECISIONS
 * Decision 14). Invoked from Node route handlers (createRoute) with the
 * authenticated user id as the key.
 *
 * Edge-safety: this module imports ONLY the leaf `../errors` (never the
 * @vesper/shared barrel, which transitively pulls @vesper/db). It is fetch/edge
 * safe in principle, though only called from Node handlers at V1. The Edge
 * middleware (apps/web/middleware.ts) does NOT import this file — it carries its
 * own copy to stay isolated from the db chain.
 *
 * RATE_LIMITING.md (package root) is the source of truth for the numbers below;
 * changing a limit there requires changing the config here.
 */

export type LimiterName = 'plan-generate' | 'ai-command';

interface LimiterConfig {
  /** Endpoint this limiter guards — emitted as the `endpoint` analytics property. */
  endpoint: string;
  tokens: number;
  window: Duration;
  /** Window expressed in seconds for analytics/breadcrumb properties. */
  windowSeconds: number;
}

// Exhaustive Record<LimiterName, ...>: adding a name to LimiterName without a
// config entry is a compile error.
const LIMITER_CONFIG: Record<LimiterName, LimiterConfig> = {
  'plan-generate': {
    endpoint: '/api/v1/plans/generate',
    tokens: 5,
    window: '1 h',
    windowSeconds: 3600,
  },
  'ai-command': {
    endpoint: '/api/v1/ai/command',
    tokens: 60,
    window: '1 h',
    windowSeconds: 3600,
  },
};

/**
 * ApiError subclass carrying `retryAfterSeconds` so the route layer can set a
 * `Retry-After` header. Keeps errors.ts untouched (smallest additive change).
 * `instanceof ApiError` still holds, so createRoute maps it to the §9 shape.
 */
export class RateLimitError extends ApiError {
  public readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(ErrorCode.RATE_LIMITED, message, 429);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Lazy singletons: constructed on first use so importing this module (or the
// barrel) never calls Redis.fromEnv() at eval time — keeps build/import working
// without Upstash env present.
let redisClient: Redis | undefined;
function getRedis(): Redis {
  if (!redisClient) redisClient = Redis.fromEnv();
  return redisClient;
}

const limiters = new Map<LimiterName, Ratelimit>();
function getLimiter(name: LimiterName): Ratelimit {
  let limiter = limiters.get(name);
  if (!limiter) {
    const cfg = LIMITER_CONFIG[name];
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(cfg.tokens, cfg.window),
      prefix: `ratelimit:${name}`,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

/**
 * Throw {@link RateLimitError} (429) if `key` has exceeded `limiterName`'s
 * window; otherwise return void. `key` is the authenticated user id.
 */
export async function withRateLimit(
  limiterName: LimiterName,
  key: string,
): Promise<void> {
  const cfg = LIMITER_CONFIG[limiterName];
  const { success, reset } = await getLimiter(limiterName).limit(key);
  if (success) return;

  const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));

  Sentry.addBreadcrumb({
    category: 'rate-limit',
    data: {
      endpoint: cfg.endpoint,
      limiter_name: limiterName,
      window_seconds: cfg.windowSeconds,
      retry_after_seconds: retryAfterSeconds,
    },
  });

  await captureRateLimitTripped({
    distinctId: key,
    endpoint: cfg.endpoint,
    limiterName,
    windowSeconds: cfg.windowSeconds,
    retryAfterSeconds,
  });

  throw new RateLimitError(
    'Rate limit exceeded. Please slow down and try again shortly.',
    retryAfterSeconds,
  );
}

interface CaptureRateLimitTrippedArgs {
  distinctId: string;
  endpoint: string;
  limiterName: string;
  windowSeconds: number;
  retryAfterSeconds: number;
}

/**
 * Emit the `rate_limit_tripped` PostHog event. Properties are EXACTLY
 * { endpoint, limiter_name, window_seconds, retry_after_seconds } per
 * TECHNICAL_SPEC §15; distinct_id carries the user id (no PII as properties).
 *
 * No-ops when NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST are unset
 * (pre-Cutover state). Errors are swallowed — analytics is never load-bearing.
 *
 * Chat 096 replaces this with the @vesper/shared/analytics wrapper.
 */
export async function captureRateLimitTripped(
  args: CaptureRateLimitTrippedArgs,
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return;

  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event: 'rate_limit_tripped',
        distinct_id: args.distinctId,
        properties: {
          endpoint: args.endpoint,
          limiter_name: args.limiterName,
          window_seconds: args.windowSeconds,
          retry_after_seconds: args.retryAfterSeconds,
        },
      }),
    });
  } catch {
    // Swallow — analytics is never load-bearing.
  }
}
