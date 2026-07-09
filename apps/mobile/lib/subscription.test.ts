// @vitest-environment node
//
// Unit tests for the Apple subscription thin client (subscription.ts) — Chat 085.
// The module imports ./api/client, which transitively pulls supabase + expo-router
// + react-native (native at import), so under the node test env we mock
// ./api/client wholesale (bills.test.ts / medications.test.ts precedent) and
// provide a stand-in ApiError so the client's `instanceof` branch is exercised.
// No real transport runs.
//
// Coverage: the call hits POST /subscription/apple-verify with { jwsTransaction };
// a 200 => verified; the 501 stub (and other non-200) => pending WITHOUT throwing;
// the global gates (401/426) are re-thrown.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The ApiError stand-in is defined INSIDE the (hoisted) factory and re-imported
// below, so the client's `instanceof ApiError` uses the very same class the test
// constructs — a top-level class would be referenced before init after hoisting.
vi.mock('./api/client', () => {
  class ApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    ApiError,
  };
});

import { apiClient, ApiError } from './api/client';
import { verifyApplePurchase } from './subscription';

const postMock = vi.mocked(apiClient.post);

const PURCHASE = { purchaseToken: 'eyJ.jws.transaction' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyApplePurchase', () => {
  it('POSTs /subscription/apple-verify with { jwsTransaction }', async () => {
    postMock.mockResolvedValue(undefined as never);
    await verifyApplePurchase(PURCHASE);
    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body] = postMock.mock.calls[0]!;
    expect(path).toBe('/subscription/apple-verify');
    expect(body).toEqual({ jwsTransaction: 'eyJ.jws.transaction' });
  });

  it('returns verified when the route responds 200', async () => {
    postMock.mockResolvedValue(undefined as never);
    await expect(verifyApplePurchase(PURCHASE)).resolves.toEqual({ status: 'verified' });
  });

  it('surfaces the 501 stub as pending without throwing', async () => {
    postMock.mockRejectedValue(new ApiError('501 Not Implemented', 501));
    await expect(verifyApplePurchase(PURCHASE)).resolves.toEqual({
      status: 'pending',
      httpStatus: 501,
    });
  });

  it('surfaces any other non-200 as pending without throwing', async () => {
    postMock.mockRejectedValue(new ApiError('500 Internal Server Error', 500));
    await expect(verifyApplePurchase(PURCHASE)).resolves.toEqual({
      status: 'pending',
      httpStatus: 500,
    });
  });

  it('re-throws the auth/update gates (401/426) so api/client handling still fires', async () => {
    postMock.mockRejectedValue(new ApiError('Unauthorized', 401));
    await expect(verifyApplePurchase(PURCHASE)).rejects.toBeInstanceOf(ApiError);
  });
});
