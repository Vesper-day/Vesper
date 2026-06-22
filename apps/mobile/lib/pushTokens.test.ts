import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock every native + transport seam so the module loads under the node test env
// (vitest.config.ts environment: 'node'). expo-notifications / react-native touch
// native modules at import; ./api/client pulls supabase + expo-router; ../store/auth
// pulls the whole auth graph; @sentry/react-native is native. Hoisted shared state
// backs the secure-store + NativeModules mocks so tests can drive them.
const { store, nativeModules } = vi.hoisted(() => ({
  store: new Map<string, string>(),
  nativeModules: {} as Record<string, unknown>,
}));

vi.mock('react-native', () => ({ NativeModules: nativeModules }));

vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(),
  getDevicePushTokenAsync: vi.fn(),
}));

vi.mock('./api/client', () => ({ apiClient: { post: vi.fn(), delete: vi.fn() } }));
vi.mock('./analytics', () => ({ track: vi.fn() }));
vi.mock('@sentry/react-native', () => ({ captureException: vi.fn() }));
// Mocked so importing pushTokens.ts (which imports useAuthStore for the hook)
// never loads the real supabase-backed auth store under the node env.
vi.mock('../store/auth', () => ({ useAuthStore: vi.fn() }));

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

import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { apiClient } from './api/client';
import { track } from './analytics';
import { secureStorageAdapter } from './auth/secureStorage';
import {
  getOrCreateDeviceId,
  hashDeviceId,
  registerPushTokenForDevice,
  unregisterPushTokenForDevice,
  DEVICE_ID_STORAGE_KEY,
} from './pushTokens';

const getPermissions = vi.mocked(Notifications.getPermissionsAsync);
const getDeviceToken = vi.mocked(Notifications.getDevicePushTokenAsync);
const postMock = vi.mocked(apiClient.post);
const deleteMock = vi.mocked(apiClient.delete);
const trackMock = vi.mocked(track);
const captureMock = vi.mocked(Sentry.captureException);
const setItemMock = vi.mocked(secureStorageAdapter.setItem);

// Minimal permission-status shape (only `granted` is read by the module).
const granted = { granted: true } as unknown as Notifications.NotificationPermissionsStatus;
const denied = { granted: false } as unknown as Notifications.NotificationPermissionsStatus;

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  delete nativeModules.VesperLiveActivityBridge;
  getPermissions.mockResolvedValue(granted);
  getDeviceToken.mockResolvedValue({ type: 'ios', data: 'apns-tok' } as Awaited<
    ReturnType<typeof Notifications.getDevicePushTokenAsync>
  >);
  postMock.mockResolvedValue(undefined as never);
  deleteMock.mockResolvedValue(undefined as never);
});

describe('getOrCreateDeviceId', () => {
  it('generates and persists once, then reuses the stored id', async () => {
    const first = await getOrCreateDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(setItemMock).toHaveBeenCalledTimes(1);
    expect(setItemMock).toHaveBeenCalledWith(DEVICE_ID_STORAGE_KEY, first);

    setItemMock.mockClear();
    const second = await getOrCreateDeviceId();
    expect(second).toBe(first); // same id
    expect(setItemMock).not.toHaveBeenCalled(); // not regenerated/re-persisted
  });
});

describe('hashDeviceId', () => {
  it('is deterministic, non-empty hex, and never the raw id', () => {
    const id = 'device-abc-123';
    const h = hashDeviceId(id);
    expect(h).toBe(hashDeviceId(id)); // deterministic
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(h).not.toBe(id);
    expect(hashDeviceId('other')).not.toBe(h); // distinguishes inputs
  });
});

describe('registerPushTokenForDevice', () => {
  it('POSTs the §9 body (both tokens, platform ios) and emits a hashed event; LA null without bridge', async () => {
    const res = await registerPushTokenForDevice();

    expect(res).toEqual({ registered: true });
    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body] = postMock.mock.calls[0]!;
    expect(path).toBe('/push-tokens');
    const deviceId = (body as { deviceId: string }).deviceId;
    expect(body).toEqual({
      deviceId,
      platform: 'ios',
      token: 'apns-tok',
      liveActivityToken: null,
    });

    expect(trackMock).toHaveBeenCalledWith('push_token_registered', {
      platform: 'ios',
      has_live_activity_token: false,
      device_id_hash: hashDeviceId(deviceId),
    });
    // The raw stable id is never put in the analytics payload.
    const payload = trackMock.mock.calls[0]![1] as { device_id_hash: string };
    expect(payload.device_id_hash).not.toBe(deviceId);
  });

  it('includes the Live Activity push-to-start token from the native bridge when present', async () => {
    nativeModules.VesperLiveActivityBridge = {
      getPushToStartTokenAsync: vi.fn(async () => 'la-tok'),
    };

    await registerPushTokenForDevice();

    const body = postMock.mock.calls[0]![1] as { liveActivityToken: string | null };
    expect(body.liveActivityToken).toBe('la-tok');
    expect(trackMock).toHaveBeenCalledWith(
      'push_token_registered',
      expect.objectContaining({ has_live_activity_token: true }),
    );
  });

  it('no-ops (no POST, no event) when notification permission is not granted', async () => {
    getPermissions.mockResolvedValue(denied);

    const res = await registerPushTokenForDevice();

    expect(res).toEqual({ registered: false, reason: 'permission-not-granted' });
    expect(postMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('captures to Sentry (with expo error code + platform) and returns error on failure', async () => {
    const err = Object.assign(new Error('network down'), { code: 'ERR_NETWORK' });
    postMock.mockRejectedValue(err);

    const res = await registerPushTokenForDevice();

    expect(res).toEqual({ registered: false, reason: 'error' });
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        tags: expect.objectContaining({ platform: 'ios', expoErrorCode: 'ERR_NETWORK' }),
      }),
    );
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe('unregisterPushTokenForDevice', () => {
  it('DELETEs the scoped device row using the persisted id', async () => {
    store.set(DEVICE_ID_STORAGE_KEY, 'dev-xyz');

    await unregisterPushTokenForDevice();

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('/push-tokens/dev-xyz');
  });

  it('no-ops when no device id was ever persisted', async () => {
    await unregisterPushTokenForDevice();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('captures a DELETE failure to Sentry without throwing', async () => {
    store.set(DEVICE_ID_STORAGE_KEY, 'dev-xyz');
    deleteMock.mockRejectedValue(new Error('boom'));

    await expect(unregisterPushTokenForDevice()).resolves.toBeUndefined();
    expect(captureMock).toHaveBeenCalledTimes(1);
  });
});
