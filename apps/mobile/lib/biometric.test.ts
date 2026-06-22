import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock every native + cross-module seam so biometric.ts loads under the node test
// env. expo-local-authentication touches native at import; ./auth/secureStorage
// pulls expo-secure-store (native); ../store/auth pulls the whole supabase auth
// graph. Hoisted shared state backs the secure-store + auth mocks.
const { store, authState, signOutMock, signInMock } = vi.hoisted(() => ({
  store: new Map<string, string>(),
  authState: { user: { email: 'x@y.z' } as { email: string } | null },
  signOutMock: vi.fn(async () => {}),
  signInMock: vi.fn(async () => ({ ok: true })),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

vi.mock('./auth/secureStorage', () => ({
  secureStorageAdapter: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  },
}));

vi.mock('../store/auth', () => ({
  useAuthStore: {
    getState: () => ({
      user: authState.user,
      signOut: signOutMock,
      signIn: signInMock,
    }),
  },
}));

import * as LocalAuthentication from 'expo-local-authentication';
import {
  MAX_BIOMETRIC_ATTEMPTS,
  BIOMETRIC_LOCK_STORAGE_KEY,
  getBiometricAvailability,
  promptBiometric,
  fallbackToSignOut,
  runBiometricUnlock,
  isBiometricLockEnabled,
  setBiometricLockEnabledLocal,
} from './biometric';

const hasHardware = vi.mocked(LocalAuthentication.hasHardwareAsync);
const isEnrolled = vi.mocked(LocalAuthentication.isEnrolledAsync);
const authenticate = vi.mocked(LocalAuthentication.authenticateAsync);

const success = { success: true } as Awaited<ReturnType<typeof LocalAuthentication.authenticateAsync>>;
const failure = { success: false } as Awaited<ReturnType<typeof LocalAuthentication.authenticateAsync>>;

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  authState.user = { email: 'x@y.z' };
  hasHardware.mockResolvedValue(true);
  isEnrolled.mockResolvedValue(true);
});

describe('getBiometricAvailability', () => {
  it('available only when hardware present AND enrolled', async () => {
    expect(await getBiometricAvailability()).toEqual({
      hasHardware: true,
      isEnrolled: true,
      available: true,
    });

    isEnrolled.mockResolvedValueOnce(false);
    expect((await getBiometricAvailability()).available).toBe(false);

    hasHardware.mockResolvedValueOnce(false);
    expect((await getBiometricAvailability()).available).toBe(false);
  });
});

describe('promptBiometric', () => {
  it('resolves ok on a successful prompt', async () => {
    authenticate.mockResolvedValue(success);
    expect(await promptBiometric()).toEqual({ ok: true });
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('resolves failed on a failed/cancelled prompt', async () => {
    authenticate.mockResolvedValue(failure);
    expect(await promptBiometric()).toEqual({ ok: false, reason: 'failed' });
  });

  it('resolves not-available without prompting when not enrolled', async () => {
    isEnrolled.mockResolvedValue(false);
    expect(await promptBiometric()).toEqual({ ok: false, reason: 'not-available' });
    expect(authenticate).not.toHaveBeenCalled();
  });
});

describe('runBiometricUnlock', () => {
  it('unlocks on the first successful attempt (no sign-out)', async () => {
    authenticate.mockResolvedValue(success);

    const outcome = await runBiometricUnlock();

    expect(outcome).toEqual({ unlocked: true, signedOut: false });
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('after three failed attempts, signs out and re-requests a magic link', async () => {
    authenticate.mockResolvedValue(failure);
    const onAttemptFailed = vi.fn();

    const outcome = await runBiometricUnlock({ onAttemptFailed });

    expect(authenticate).toHaveBeenCalledTimes(MAX_BIOMETRIC_ATTEMPTS);
    expect(onAttemptFailed).toHaveBeenCalledTimes(MAX_BIOMETRIC_ATTEMPTS);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith({ provider: 'magic_link', email: 'x@y.z' });
    expect(outcome).toEqual({ unlocked: false, signedOut: true });
  });

  it('degrades open (unlocked, no prompt, no sign-out) when biometrics are unavailable', async () => {
    isEnrolled.mockResolvedValue(false);

    const outcome = await runBiometricUnlock();

    expect(outcome).toEqual({ unlocked: true, signedOut: false });
    expect(authenticate).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe('fallbackToSignOut', () => {
  it('captures the email before signOut, then signs out and sends a magic link', async () => {
    await fallbackToSignOut();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith({ provider: 'magic_link', email: 'x@y.z' });
  });

  it('still signs out when no email is available (no magic link sent)', async () => {
    authState.user = null;
    await fallbackToSignOut();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signInMock).not.toHaveBeenCalled();
  });
});

describe('local enabled-flag cache', () => {
  it('round-trips the cached flag through secure storage', async () => {
    expect(await isBiometricLockEnabled()).toBe(false); // default OFF
    await setBiometricLockEnabledLocal(true);
    expect(store.get(BIOMETRIC_LOCK_STORAGE_KEY)).toBe('true');
    expect(await isBiometricLockEnabled()).toBe(true);
    await setBiometricLockEnabledLocal(false);
    expect(await isBiometricLockEnabled()).toBe(false);
  });
});
