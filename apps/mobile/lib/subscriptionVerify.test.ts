// @vitest-environment node
//
// Unit tests for the pure verify helpers (subscriptionVerify.ts) — Chat 085.
// This module imports nothing native (no expo-iap, no react-native), so the test
// loads it directly with NO mocks: it exercises the purchase -> { jwsTransaction }
// mapping and the HTTP-status -> outcome classification, including the 501 branch.
import { describe, it, expect } from 'vitest';
import {
  toVerifyPayload,
  classifyVerifyStatus,
  MissingJwsError,
} from './subscriptionVerify';

describe('toVerifyPayload', () => {
  it('maps a purchase token to the { jwsTransaction } body', () => {
    expect(toVerifyPayload({ purchaseToken: 'eyJ.header.sig' })).toEqual({
      jwsTransaction: 'eyJ.header.sig',
    });
  });

  it('throws MissingJwsError when the token is absent or empty', () => {
    expect(() => toVerifyPayload({ purchaseToken: null })).toThrow(MissingJwsError);
    expect(() => toVerifyPayload({ purchaseToken: '' })).toThrow(MissingJwsError);
    expect(() => toVerifyPayload({})).toThrow(MissingJwsError);
  });
});

describe('classifyVerifyStatus', () => {
  it('classifies 200 as verified', () => {
    expect(classifyVerifyStatus(200)).toEqual({ status: 'verified' });
  });

  it('classifies the 501 stub as pending (no throw)', () => {
    expect(classifyVerifyStatus(501)).toEqual({ status: 'pending', httpStatus: 501 });
  });

  it('classifies any other non-200 as pending', () => {
    expect(classifyVerifyStatus(500)).toEqual({ status: 'pending', httpStatus: 500 });
    expect(classifyVerifyStatus(400)).toEqual({ status: 'pending', httpStatus: 400 });
  });
});
