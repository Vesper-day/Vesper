// Per-(user, plan_date) idempotency lock for plan generation (chat 025).
//
// A single user must not have two concurrent generations racing on the same plan
// date (the second would duplicate work and the two commits would fight over the
// same daily_plans row). We serialize with an Upstash Redis lock keyed on
// (user_id, plan_date), acquired with SET NX before generation and deleted when
// the stream ends.
//
// TTL design (§ idempotency):
//   - Initial TTL 300s: a hard ceiling so a crashed worker that never deletes the
//     lock cannot wedge the date forever — it self-clears within 5 minutes.
//   - Heartbeat: while the stream is alive we refresh the key to a rolling 60s
//     window every 30s. The 30s interval sits well inside the 60s window, so an
//     in-flight generation never lets the lock lapse, while a crash (heartbeat
//     stops firing) expires the key within 60s << 5 minutes.
//   - Explicit release on stream end (success OR error) deletes the key
//     immediately so the next generation is not made to wait out the TTL.
//
// Edge-safety: imports ONLY @upstash/redis (no @vesper/db chain), mirroring
// rateLimit.ts. Only ever called from the Node plans/generate route at V1.
import { Redis } from '@upstash/redis';

/** Hard ceiling at acquire time (seconds). Crash self-clears within this. */
export const LOCK_TTL_SECONDS = 300;
/** Rolling window each heartbeat refreshes the key to (seconds). */
export const HEARTBEAT_TTL_SECONDS = 60;
/** Heartbeat cadence (ms). Must stay well under HEARTBEAT_TTL_SECONDS. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Minimal Redis surface this module needs. Lets tests inject a fake without the
 * full @upstash/redis client (the real client satisfies it structurally).
 */
export interface LockRedis {
  set(
    key: string,
    value: string,
    opts: { nx: true; ex: number },
  ): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

// Lazy singleton: importing this module never calls Redis.fromEnv() at eval time,
// so build/import works without Upstash env present (mirrors rateLimit.ts).
let redisClient: Redis | undefined;
function getRedis(): LockRedis {
  if (!redisClient) redisClient = Redis.fromEnv();
  return redisClient as unknown as LockRedis;
}

/** Lock key for (user, plan date). plan_date is the 'YYYY-MM-DD' string. */
export function lockKey(userId: string, planDate: string): string {
  return `plan-lock:${userId}:${planDate}`;
}

/**
 * Acquire the lock. Returns true if THIS caller now holds it, false if another
 * generation already holds it (caller must return 409). SET NX EX is atomic, so
 * exactly one of two concurrent callers wins.
 */
export async function acquireLock(
  userId: string,
  planDate: string,
  redis: LockRedis = getRedis(),
): Promise<boolean> {
  const result = await redis.set(lockKey(userId, planDate), '1', {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  // @upstash/redis returns 'OK' on a successful NX set, null when the key exists.
  return result === 'OK';
}

/** Delete the lock. Safe to call more than once. */
export async function releaseLock(
  userId: string,
  planDate: string,
  redis: LockRedis = getRedis(),
): Promise<void> {
  await redis.del(lockKey(userId, planDate));
}

/**
 * Start the heartbeat: refresh the lock to a rolling HEARTBEAT_TTL_SECONDS window
 * every HEARTBEAT_INTERVAL_MS. Returns the interval handle; pass it to
 * {@link stopHeartbeat} when the stream ends. Refresh errors are swallowed — a
 * transient Redis hiccup must not tear down an in-flight generation; the worst
 * case is an early TTL lapse, which the lock is designed to tolerate.
 */
export function startHeartbeat(
  userId: string,
  planDate: string,
  redis: LockRedis = getRedis(),
): ReturnType<typeof setInterval> {
  const handle = setInterval(() => {
    void redis.expire(lockKey(userId, planDate), HEARTBEAT_TTL_SECONDS).catch(
      () => undefined,
    );
  }, HEARTBEAT_INTERVAL_MS);
  // Don't keep the process alive solely for the heartbeat.
  if (typeof handle.unref === 'function') handle.unref();
  return handle;
}

/** Stop a heartbeat started by {@link startHeartbeat}. No-op on undefined. */
export function stopHeartbeat(
  handle: ReturnType<typeof setInterval> | undefined,
): void {
  if (handle) clearInterval(handle);
}
