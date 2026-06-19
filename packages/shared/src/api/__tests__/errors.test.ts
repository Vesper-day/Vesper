import { describe, it, expect } from 'vitest';
import { ErrorCode, DEFAULT_HTTP_STATUS, ApiError } from '../../errors';

const SEEDED = [
  'UNAUTHORIZED',
  'INVALID_REQUEST',
  'FORBIDDEN',
  'NOT_FOUND',
  'PLAN_NOT_FOUND',
  'CONFLICT',
  'UPGRADE_REQUIRED',
  'RATE_LIMITED',
  'READ_ONLY_MODE',
  'OPTIMISTIC_LOCK_FAILURE',
  'INTEGRATION_ERROR',
  'NOT_IMPLEMENTED',
  'INTERNAL_ERROR',
];

describe('ErrorCode', () => {
  it('is a const object with exactly the 13 seeded keys, values === keys', () => {
    expect(Object.keys(ErrorCode).sort()).toEqual([...SEEDED].sort());
    for (const key of SEEDED) {
      expect(ErrorCode[key as keyof typeof ErrorCode]).toBe(key);
    }
  });
});

describe('ApiError', () => {
  it('defaults httpStatus from DEFAULT_HTTP_STATUS when omitted', () => {
    const err = new ApiError(ErrorCode.UPGRADE_REQUIRED, 'stale');
    expect(err.code).toBe('UPGRADE_REQUIRED');
    expect(err.httpStatus).toBe(426);
    expect(err.httpStatus).toBe(DEFAULT_HTTP_STATUS.UPGRADE_REQUIRED);
    expect(err.message).toBe('stale');
    expect(err).toBeInstanceOf(Error);
  });

  it('honors an explicit httpStatus override', () => {
    const err = new ApiError(ErrorCode.INTERNAL_ERROR, 'boom', 503);
    expect(err.httpStatus).toBe(503);
  });
});
