import { describe, it, expect, vi, beforeEach } from 'vitest';

// useBiometricLock pulls react-native (AppState), the chat-013 useAppLifecycle
// hook, the auth store, and the real lib/biometric (whose native deps —
// expo-local-authentication, the secure-store wrapper — are mocked here). The
// lock DECISION logic is factored into pure/injected helpers so it is tested
// without a React renderer (the codebase mocks react-native rather than rendering
// it). The store's authenticate action is driven directly through the real
// runBiometricUnlock so the three-fail → signOut + magic-link path is asserted.
const { signOutMock, signInMock, authState } = vi.hoisted(() => ({
  signOutMock: vi.fn(async () => {}),
  signInMock: vi.fn(async () => ({ ok: true })),
  authState: { user: { email: 'x@y.z' } as { email: string } | null },
}));

vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock('./useAppLifecycle', () => ({ useAppLifecycle: vi.fn() }));
vi.mock('../lib/auth/secureStorage', () => ({
  secureStorageAdapter: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));
vi.mock('../store/auth', () => ({
  useAuthStore: Object.assign(vi.fn(), {
    getState: () => ({
      user: authState.user,
      signOut: signOutMock,
      signIn: signInMock,
    }),
  }),
}));
vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(async () => true),
  isEnrolledAsync: vi.fn(async () => true),
  authenticateAsync: vi.fn(),
}));

import * as LocalAuthentication from 'expo-local-authentication';
import {
  GRACE_WINDOW_MS,
  shouldRelockAfterBackground,
  enforceColdStartLock,
  createLockController,
  useBiometricLockStore,
} from './useBiometricLock';

const authenticateAsync = vi.mocked(LocalAuthentication.authenticateAsync);
const success = { success: true } as Awaited<
  ReturnType<typeof LocalAuthentication.authenticateAsync>
>;
const failure = { success: false } as Awaited<
  ReturnType<typeof LocalAuthentication.authenticateAsync>
>;

/** Flush pending micro/macrotasks so injected .then() callbacks run. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { email: 'x@y.z' };
  useBiometricLockStore.setState({ locked: false, authenticating: false });
});

describe('enforceColdStartLock', () => {
  it('OFF (default): does not authenticate', async () => {
    const authenticate = vi.fn();
    await enforceColdStartLock({ isEnabled: async () => false, authenticate });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('ON: authenticates on cold start', async () => {
    const authenticate = vi.fn();
    await enforceColdStartLock({ isEnabled: async () => true, authenticate });
    expect(authenticate).toHaveBeenCalledTimes(1);
  });
});

describe('shouldRelockAfterBackground', () => {
  it('re-locks only past the 60s grace window', () => {
    expect(GRACE_WINDOW_MS).toBe(60_000);
    expect(shouldRelockAfterBackground(GRACE_WINDOW_MS + 1)).toBe(true);
    expect(shouldRelockAfterBackground(GRACE_WINDOW_MS)).toBe(false);
    expect(shouldRelockAfterBackground(0)).toBe(false);
  });
});

describe('createLockController (resume policy)', () => {
  it('ON: re-locks on foreground after > 60s backgrounded', async () => {
    let t = 0;
    const authenticate = vi.fn();
    const ctrl = createLockController({
      now: () => t,
      isEnabled: async () => true,
      authenticate,
    });

    t = 0;
    ctrl.onAppStateChange('background');
    t = GRACE_WINDOW_MS + 1_000; // 61s away
    ctrl.onAppStateChange('active');
    await flush();

    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-lock on foreground when backgrounded <= 60s (quick switch)', async () => {
    let t = 0;
    const authenticate = vi.fn();
    const ctrl = createLockController({
      now: () => t,
      isEnabled: async () => true,
      authenticate,
    });

    t = 0;
    ctrl.onAppStateChange('background');
    t = GRACE_WINDOW_MS; // exactly 60s — within grace
    ctrl.onAppStateChange('active');
    await flush();

    expect(authenticate).not.toHaveBeenCalled();
  });

  it('OFF: does not re-lock even after a long background', async () => {
    let t = 0;
    const authenticate = vi.fn();
    const ctrl = createLockController({
      now: () => t,
      isEnabled: async () => false,
      authenticate,
    });

    ctrl.onAppStateChange('background');
    t = GRACE_WINDOW_MS + 10_000;
    ctrl.onAppStateChange('active');
    await flush();

    expect(authenticate).not.toHaveBeenCalled();
  });
});

describe('useBiometricLockStore.authenticate', () => {
  it('unlocks on a successful prompt (gate drops, no sign-out)', async () => {
    authenticateAsync.mockResolvedValue(success);

    await useBiometricLockStore.getState().authenticate();

    expect(authenticateAsync).toHaveBeenCalledTimes(1);
    expect(useBiometricLockStore.getState().locked).toBe(false);
    expect(useBiometricLockStore.getState().authenticating).toBe(false);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('three fails route through store/auth signOut + magic-link, then drops the gate', async () => {
    authenticateAsync.mockResolvedValue(failure);

    await useBiometricLockStore.getState().authenticate();

    expect(authenticateAsync).toHaveBeenCalledTimes(3);
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith({ provider: 'magic_link', email: 'x@y.z' });
    expect(useBiometricLockStore.getState().locked).toBe(false);
  });
});
