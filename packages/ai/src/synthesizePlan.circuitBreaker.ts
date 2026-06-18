// Per-user circuit breaker for daily-plan synthesis (Chat 022, LOCKED Decision 2).
//
// Supersedes TECHNICAL_SPEC §5's "process-level" breaker: this one is keyed by
// user_id so one user's Anthropic trouble never trips synthesis for everyone. It
// is a 5-minute SLIDING WINDOW of failure timestamps in an Upstash sorted set:
//   key    cb:{userId}
//   member `${epochMs}:${uuid}`  (uuid keeps same-ms failures distinct)
//   score  epochMs
//
// OPEN when >= THRESHOLD failures fall inside the trailing WINDOW_MS. It
// auto-closes once the newest failure ages past the window (no new failure
// needed). The route GET /api/v1/health/circuit-breaker reads this per-user.
//
// LOCAL Redis.fromEnv() singleton: deviates from the spec's process-level
// breaker but follows the apps/web/middleware.ts precedent (lazy fromEnv() so
// module eval never touches Redis). The client is injectable for offline tests.

import { Redis } from '@upstash/redis';

/** Sliding-window length: 5 minutes (LOCKED Decision 2). */
export const WINDOW_MS = 300_000;
/** Failures inside the window required to OPEN the breaker (LOCKED Decision 2). */
export const THRESHOLD = 3;

export interface BreakerState {
  open: boolean;
  /** ISO time the breaker opened (the THRESHOLD-th failure inside the window). */
  opensAt?: string;
  /** ISO time the breaker auto-closes (newest failure + WINDOW_MS). */
  closesAt?: string;
}

// Lazy singleton — constructed on first use so importing this module never calls
// Redis.fromEnv() (which throws without Upstash env present). Injectable for tests.
let redisClient: Redis | undefined;

/** Test seam: inject a fake Redis client. Pass undefined to reset to fromEnv(). */
export function __setBreakerRedisForTests(client: Redis | undefined): void {
  redisClient = client;
}

function getRedis(): Redis {
  redisClient = redisClient ?? Redis.fromEnv();
  return redisClient;
}

function keyFor(userId: string): string {
  return `cb:${userId}`;
}

/**
 * Record one synthesis failure for a user: append now to the sorted set, prune
 * everything older than the window, and (re)set a TTL so an idle key expires.
 * Best-effort by caller convention — never let breaker bookkeeping break the
 * plan path.
 */
export async function recordFailure(userId: string): Promise<void> {
  const now = Date.now();
  const member = `${now}:${crypto.randomUUID()}`;
  const redis = getRedis();
  await redis.zadd(keyFor(userId), { score: now, member });
  await redis.zremrangebyscore(keyFor(userId), 0, now - WINDOW_MS);
  await redis.pexpire(keyFor(userId), WINDOW_MS);
}

/**
 * READ-ONLY breaker state for a user. Reads the failure timestamps still inside
 * the trailing window (no prune, no write) and decides OPEN/closed from their
 * count. Open => skip Anthropic Steps 1-2 and serve the fallback straight away.
 */
export async function readBreakerState(userId: string): Promise<BreakerState> {
  const now = Date.now();
  const min = now - WINDOW_MS;
  const redis = getRedis();

  // withScores returns a flat [member, score, member, score, ...] array.
  const raw = (await redis.zrange(keyFor(userId), min, now, {
    byScore: true,
    withScores: true,
  })) as Array<string | number>;

  const scores: number[] = [];
  for (let i = 1; i < raw.length; i += 2) {
    scores.push(Number(raw[i]));
  }
  scores.sort((a, b) => a - b);

  if (scores.length < THRESHOLD) {
    return { open: false };
  }

  const newest = scores[scores.length - 1]!;
  const opener = scores[THRESHOLD - 1]!; // the THRESHOLD-th oldest tripped it open
  return {
    open: true,
    opensAt: new Date(opener).toISOString(),
    closesAt: new Date(newest + WINDOW_MS).toISOString(),
  };
}
