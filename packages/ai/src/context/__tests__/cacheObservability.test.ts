import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyCacheOutcome,
  recordCacheObservation,
  type CacheObservation,
} from '../cacheObservability';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('classifyCacheOutcome', () => {
  it('treats >0 cache-read tokens as a hit, 0 as a miss', () => {
    expect(classifyCacheOutcome(512)).toBe('hit');
    expect(classifyCacheOutcome(0)).toBe('miss');
  });
});

describe('recordCacheObservation', () => {
  it('emits a structured plan_cache log line and returns the observation', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const obs: CacheObservation = {
      userId: 'user-1',
      callType: 'daily-plan',
      outcome: 'hit',
      cacheReadInputTokens: 7500,
      planDate: '2026-06-14',
    };

    const result = recordCacheObservation(obs);

    expect(result).toEqual(obs);
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({ event: 'plan_cache', outcome: 'hit' });
  });
});
