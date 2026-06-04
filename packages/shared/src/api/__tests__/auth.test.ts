import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

// --- Mocks: no real network / Supabase / DB ---
const getUser = vi.fn();
const findFirst = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: { getUser } })),
}));

vi.mock('@vesper/db', () => ({
  createDrizzleClient: vi.fn(() => ({ query: { users: { findFirst } } })),
}));

import { validateSession, type AuthenticatedUser } from '../auth';
import { ApiError } from '../../errors';

function req(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set('Authorization', authorization);
  return new Request('https://example.com/api/v1/test', { headers });
}

const USER_ROW = {
  id: 'user-1',
  email: 'a@b.com',
  subscriptionStatus: 'active' as const,
  timezone: 'America/New_York',
  tier: 'optimizer' as const,
};

beforeEach(() => {
  (getUser as Mock).mockReset();
  (findFirst as Mock).mockReset();
});

describe('validateSession', () => {
  it('throws 401 ApiError when Authorization header is missing', async () => {
    await expect(validateSession(req())).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      httpStatus: 401,
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('throws 401 ApiError when header is malformed (no Bearer)', async () => {
    await expect(validateSession(req('token-only'))).rejects.toBeInstanceOf(ApiError);
  });

  it('throws 401 ApiError when getUser fails', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    await expect(validateSession(req('Bearer abc'))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  });

  it('throws 401 ApiError when users row is missing', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    findFirst.mockResolvedValue(undefined);
    await expect(validateSession(req('Bearer abc'))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'User record not found',
    });
  });

  it('returns mapped AuthenticatedUser on the happy path', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    findFirst.mockResolvedValue(USER_ROW);

    const result = await validateSession(req('Bearer valid-token'));
    const expected: AuthenticatedUser = {
      id: 'user-1',
      email: 'a@b.com',
      subscriptionStatus: 'active',
      timezone: 'America/New_York',
      tier: 'optimizer',
    };
    expect(result).toEqual(expected);
    expect(getUser).toHaveBeenCalledWith('valid-token');
  });
});
