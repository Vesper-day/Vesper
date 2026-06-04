import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Offline fakes (no live Upstash, no network) ----------------------------

// Redis.fromEnv() throws without env; stub it to a no-op object.
vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({}) },
}));

// Map-backed sliding-window fake so the limiter behavior is exercised offline.
// slidingWindow(tokens, window) -> { tokens }; the fake counts hits per key.
vi.mock('@upstash/ratelimit', () => {
  class FakeRatelimit {
    private readonly tokens: number;
    private readonly windowMs = 3_600_000; // 1 h — matches the configured window
    private readonly hits = new Map<string, number[]>();

    constructor(opts: { limiter: { tokens: number } }) {
      this.tokens = opts.limiter.tokens;
    }

    static slidingWindow(tokens: number, _window: string) {
      return { tokens };
    }

    async limit(key: string) {
      const now = Date.now();
      const recent = (this.hits.get(key) ?? []).filter(
        (t) => t > now - this.windowMs,
      );
      const success = recent.length < this.tokens;
      if (success) recent.push(now);
      this.hits.set(key, recent);
      return {
        success,
        limit: this.tokens,
        remaining: Math.max(0, this.tokens - recent.length),
        reset: now + this.windowMs,
      };
    }
  }
  return { Ratelimit: FakeRatelimit };
});

import {
  withRateLimit,
  captureRateLimitTripped,
  RateLimitError,
} from '../rateLimit';
import { ErrorCode } from '../../errors';

describe('withRateLimit', () => {
  it('allows the first N requests then throws RateLimitError on N+1', async () => {
    const key = 'user-plan-generate-1';
    // plan-generate is configured at 5 requests / 1 hour.
    for (let i = 0; i < 5; i++) {
      await expect(withRateLimit('plan-generate', key)).resolves.toBeUndefined();
    }

    await expect(withRateLimit('plan-generate', key)).rejects.toMatchObject({
      code: ErrorCode.RATE_LIMITED,
      httpStatus: 429,
    });
  });

  it('thrown error is a RateLimitError carrying a positive retryAfterSeconds', async () => {
    const key = 'user-plan-generate-2';
    for (let i = 0; i < 5; i++) await withRateLimit('plan-generate', key);

    let caught: unknown;
    try {
      await withRateLimit('plan-generate', key);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).code).toBe(ErrorCode.RATE_LIMITED);
    expect((caught as RateLimitError).httpStatus).toBe(429);
    expect((caught as RateLimitError).retryAfterSeconds).toBeGreaterThan(0);
  });

  it('ai-command allows 60 before throwing (per-limiter config is independent)', async () => {
    const key = 'user-ai-command-1';
    for (let i = 0; i < 60; i++) {
      await expect(withRateLimit('ai-command', key)).resolves.toBeUndefined();
    }
    await expect(withRateLimit('ai-command', key)).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });
});

describe('captureRateLimitTripped', () => {
  const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  afterEach(() => {
    if (POSTHOG_KEY === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = POSTHOG_KEY;
    if (POSTHOG_HOST === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = POSTHOG_HOST;
    vi.restoreAllMocks();
  });

  it('no-ops (no throw, no fetch) when NEXT_PUBLIC_POSTHOG_KEY is unset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(
      captureRateLimitTripped({
        distinctId: 'user-1',
        endpoint: '/api/v1/plans/generate',
        limiterName: 'plan-generate',
        windowSeconds: 3600,
        retryAfterSeconds: 42,
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
