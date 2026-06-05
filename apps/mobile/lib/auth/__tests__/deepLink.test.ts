import { describe, it, expect, vi } from 'vitest';

// Mock every native/Supabase dependency the flow modules import at load time so
// importing them here is side-effect-free and fully offline.
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'vesper://auth/callback'),
}));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: vi.fn() }));
vi.mock('expo-linking', () => ({
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  getInitialURL: vi.fn(async () => null),
  canOpenURL: vi.fn(async () => false),
  openURL: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}));
vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

import { matchesDeepLinkPath, extractAuthParams } from '../deepLink';
import { GOOGLE_REDIRECT_PATH } from '../google-oauth';
import { MAGIC_LINK_CONFIRM_PATH } from '../magic-link';

describe('matchesDeepLinkPath', () => {
  it('accepts the exact Google callback path (with query)', () => {
    expect(
      matchesDeepLinkPath('vesper://auth/callback?code=abc', GOOGLE_REDIRECT_PATH),
    ).toBe(true);
  });

  it('accepts the exact magic-link confirm path (with fragment)', () => {
    expect(
      matchesDeepLinkPath(
        'vesper://auth/confirm#access_token=t',
        MAGIC_LINK_CONFIRM_PATH,
      ),
    ).toBe(true);
  });

  it('tolerates a single trailing slash', () => {
    expect(
      matchesDeepLinkPath('vesper://auth/callback/', GOOGLE_REDIRECT_PATH),
    ).toBe(true);
  });

  it.each([
    'vesper://auth/callbackXY',
    'vesper://auth/evil',
    'vesper://auth/confirm', // wrong path for the Google flow
    'https://vesper.day/auth/callback', // wrong scheme/host
    'vesper://other/callback',
    '',
  ])('rejects mismatched path: %s', (url) => {
    expect(matchesDeepLinkPath(url, GOOGLE_REDIRECT_PATH)).toBe(false);
  });

  it('rejects the Google path for the confirm flow and vice-versa', () => {
    expect(
      matchesDeepLinkPath('vesper://auth/callback', MAGIC_LINK_CONFIRM_PATH),
    ).toBe(false);
  });
});

describe('extractAuthParams', () => {
  it('reads a PKCE code from the query string', () => {
    expect(extractAuthParams('vesper://auth/callback?code=xyz')).toEqual({
      code: 'xyz',
    });
  });

  it('reads tokens from the fragment', () => {
    expect(
      extractAuthParams(
        'vesper://auth/callback#access_token=a&refresh_token=r',
      ),
    ).toEqual({ access_token: 'a', refresh_token: 'r' });
  });

  it('reads token_hash + type for verifyOtp', () => {
    expect(
      extractAuthParams('vesper://auth/confirm?token_hash=h&type=magiclink'),
    ).toEqual({ token_hash: 'h', type: 'magiclink' });
  });

  it('url-decodes values', () => {
    expect(extractAuthParams('vesper://auth/callback?error=access%20denied')).toEqual(
      { error: 'access denied' },
    );
  });
});
