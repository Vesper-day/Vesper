// @vitest-environment node
//
// PURE unit tests for the plan-generation helpers — no DB, no Redis, no Anthropic.
// Always run (NOT gated on VESPER_DB_TESTS). The DB/Redis-backed assertions live
// in generate.integration.test.ts.
import { describe, it, expect } from 'vitest';
import { APOLOGY_LINE } from '@vesper/ai';
import {
  GenerateRequestSchema,
  endDateForBlock,
  isFallbackNote,
} from './generatePlan';
import {
  acquireLock,
  releaseLock,
  lockKey,
  type LockRedis,
} from '../../../../../lib/idempotency';

describe('GenerateRequestSchema', () => {
  it('accepts a real date + in-range energyScore', () => {
    const r = GenerateRequestSchema.safeParse({ date: '2026-06-18', energyScore: 7 });
    expect(r.success).toBe(true);
  });

  it('rejects an impossible calendar date', () => {
    expect(GenerateRequestSchema.safeParse({ date: '2026-13-40', energyScore: 7 }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ date: '2026-02-30', energyScore: 7 }).success).toBe(false);
  });

  it('rejects malformed date strings', () => {
    expect(GenerateRequestSchema.safeParse({ date: '6/18/2026', energyScore: 7 }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ date: '2026-6-8', energyScore: 7 }).success).toBe(false);
  });

  it('rejects out-of-range / non-integer energyScore', () => {
    expect(GenerateRequestSchema.safeParse({ date: '2026-06-18', energyScore: 0 }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ date: '2026-06-18', energyScore: 11 }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ date: '2026-06-18', energyScore: 5.5 }).success).toBe(false);
  });

  it('rejects unknown keys (strict) and missing fields', () => {
    expect(GenerateRequestSchema.safeParse({ date: '2026-06-18', energyScore: 7, extra: 1 }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ date: '2026-06-18' }).success).toBe(false);
  });
});

describe('endDateForBlock', () => {
  it('keeps a normal same-day block on the plan date', () => {
    expect(endDateForBlock('2026-06-18', '09:00', '10:00')).toBe('2026-06-18');
  });

  it('rolls a wrap-past-midnight (sleep) block to the next day', () => {
    expect(endDateForBlock('2026-06-18', '22:30', '06:45')).toBe('2026-06-19');
  });

  it('treats a "00:00" end as end-of-day on the next calendar day', () => {
    expect(endDateForBlock('2026-06-18', '23:00', '00:00')).toBe('2026-06-19');
  });

  it('handles month boundaries', () => {
    expect(endDateForBlock('2026-06-30', '23:00', '00:00')).toBe('2026-07-01');
    expect(endDateForBlock('2026-12-31', '22:00', '06:00')).toBe('2027-01-01');
  });
});

describe('isFallbackNote', () => {
  it('detects the served-fallback apology prefix', () => {
    expect(isFallbackNote(APOLOGY_LINE)).toBe(true);
    expect(isFallbackNote(`${APOLOGY_LINE} Rest well.`)).toBe(true);
  });

  it('treats a generated note or no note as not-fallback', () => {
    expect(isFallbackNote('Your day is fully booked with fixed events.')).toBe(false);
    expect(isFallbackNote(undefined)).toBe(false);
  });
});

describe('acquireLock NX semantics (fake redis)', () => {
  // In-memory LockRedis implementing SET NX, exercising the 409-trigger condition
  // (a second concurrent acquire on the same (user, date) fails) without Upstash.
  function fakeRedis(): LockRedis & { store: Map<string, string> } {
    const store = new Map<string, string>();
    return {
      store,
      async set(key, value, opts) {
        if (opts.nx && store.has(key)) return null;
        store.set(key, value);
        return 'OK';
      },
      async expire() {
        return 1;
      },
      async del(key) {
        store.delete(key);
        return 1;
      },
    };
  }

  it('grants the first holder and refuses the second (409 condition)', async () => {
    const redis = fakeRedis();
    expect(await acquireLock('u1', '2026-06-18', redis)).toBe(true);
    expect(await acquireLock('u1', '2026-06-18', redis)).toBe(false);
  });

  it('lets a new holder acquire after release', async () => {
    const redis = fakeRedis();
    await acquireLock('u1', '2026-06-18', redis);
    await releaseLock('u1', '2026-06-18', redis);
    expect(redis.store.has(lockKey('u1', '2026-06-18'))).toBe(false);
    expect(await acquireLock('u1', '2026-06-18', redis)).toBe(true);
  });

  it('scopes the lock per (user, date)', async () => {
    const redis = fakeRedis();
    expect(await acquireLock('u1', '2026-06-18', redis)).toBe(true);
    // Different date, same user — independent lock.
    expect(await acquireLock('u1', '2026-06-19', redis)).toBe(true);
    // Different user, same date — independent lock.
    expect(await acquireLock('u2', '2026-06-18', redis)).toBe(true);
  });
});
