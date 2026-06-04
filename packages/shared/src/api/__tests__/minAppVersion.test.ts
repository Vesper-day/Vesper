import { describe, it, expect, afterEach } from 'vitest';
import {
  checkAppVersion,
  getMinAppVersion,
  DEFAULT_MIN_APP_VERSION,
} from '../minAppVersion';
import { ApiError } from '../../errors';

function req(version?: string): Request {
  const headers = new Headers();
  if (version !== undefined) headers.set('X-App-Version', version);
  return new Request('https://example.com/api/v1/test', { headers });
}

afterEach(() => {
  delete process.env.MIN_APP_VERSION;
});

describe('getMinAppVersion', () => {
  it('falls back to DEFAULT_MIN_APP_VERSION when env unset', () => {
    expect(getMinAppVersion()).toBe(DEFAULT_MIN_APP_VERSION);
    expect(DEFAULT_MIN_APP_VERSION).toBe('1.0.0');
  });

  it('honors MIN_APP_VERSION override', () => {
    process.env.MIN_APP_VERSION = '2.3.4';
    expect(getMinAppVersion()).toBe('2.3.4');
  });
});

describe('checkAppVersion', () => {
  it('absent header → no throw (web clients exempt)', () => {
    expect(() => checkAppVersion(req())).not.toThrow();
  });

  it('below min "0.9.0" vs "1.0.0" → throws UPGRADE_REQUIRED 426', () => {
    try {
      checkAppVersion(req('0.9.0'));
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('UPGRADE_REQUIRED');
      expect((err as ApiError).httpStatus).toBe(426);
    }
  });

  it('equal version → no throw', () => {
    expect(() => checkAppVersion(req('1.0.0'))).not.toThrow();
  });

  it('above version → no throw', () => {
    expect(() => checkAppVersion(req('1.2.0'))).not.toThrow();
  });
});
