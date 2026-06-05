import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  signOutMock,
  getSessionMock,
  onAuthStateChangeMock,
  clearStoredSessionMock,
} = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => ({ error: null })),
  getSessionMock: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChangeMock: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  clearStoredSessionMock: vi.fn(async () => {}),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: signOutMock,
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));
vi.mock('../../lib/auth/secureStorage', () => ({
  clearStoredSession: clearStoredSessionMock,
}));
vi.mock('../../lib/auth/google-oauth', () => ({
  signInWithGoogle: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../lib/auth/apple-sign-in', () => ({
  signInWithApple: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../lib/auth/magic-link', () => ({
  sendMagicLink: vi.fn(async () => ({ ok: true })),
}));

import { useAuthStore, currentUser, type AuthState } from '../auth';
import type { Session } from '@supabase/supabase-js';

const fakeSession = {
  access_token: 'a',
  refresh_token: 'r',
  user: { id: 'user-1', email: 'x@y.z' },
} as unknown as Session;

describe('auth store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      status: 'loading',
      session: null,
      user: null,
      needsSignIn: false,
    });
  });

  it('setSession(session) marks authenticated and clears needsSignIn', () => {
    useAuthStore.getState().setSession(fakeSession);
    const s = useAuthStore.getState();
    expect(s.status).toBe('authenticated');
    expect(s.needsSignIn).toBe(false);
    expect(currentUser(s)?.id).toBe('user-1');
  });

  it('setSession(null) routes to sign-in (refresh expired/revoked)', () => {
    useAuthStore.getState().setSession(null);
    const s = useAuthStore.getState();
    expect(s.status).toBe('unauthenticated');
    expect(s.needsSignIn).toBe(true);
    expect(currentUser(s)).toBeNull();
  });

  it('hydrate with a null getSession sets needsSignIn', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().needsSignIn).toBe(true);
  });

  it('signOut clears storage, signs out, and routes to sign-in', async () => {
    useAuthStore.setState({
      session: fakeSession,
      user: fakeSession.user,
      status: 'authenticated',
      needsSignIn: false,
    } as Partial<AuthState> as AuthState);

    await useAuthStore.getState().signOut();

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(clearStoredSessionMock).toHaveBeenCalledOnce();
    const s = useAuthStore.getState();
    expect(s.session).toBeNull();
    expect(s.user).toBeNull();
    expect(s.needsSignIn).toBe(true);
  });

  it('signIn delegates to the magic-link flow', async () => {
    const result = await useAuthStore
      .getState()
      .signIn({ provider: 'magic_link', email: 'x@y.z' });
    expect(result.ok).toBe(true);
  });
});
