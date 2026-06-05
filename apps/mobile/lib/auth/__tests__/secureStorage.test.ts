import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory mock of expo-secure-store.
const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  getItemAsync: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
  setItemAsync: vi.fn(async (k: string, v: string) => {
    store.set(k, v);
  }),
  deleteItemAsync: vi.fn(async (k: string) => {
    store.delete(k);
  }),
}));

import {
  secureStorageAdapter,
  STORAGE_KEYS,
  clearStoredSession,
} from '../secureStorage';
import * as SecureStore from 'expo-secure-store';

describe('secureStorageAdapter', () => {
  beforeEach(() => store.clear());

  it('round-trips get/set/remove', async () => {
    expect(await secureStorageAdapter.getItem('k')).toBeNull();

    await secureStorageAdapter.setItem('k', 'value-1');
    expect(await secureStorageAdapter.getItem('k')).toBe('value-1');

    await secureStorageAdapter.removeItem('k');
    expect(await secureStorageAdapter.getItem('k')).toBeNull();
  });

  it('namespaces keys under the vesper. prefix in SecureStore', async () => {
    await secureStorageAdapter.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'tok');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'vesper.supabase.auth.token',
      'tok',
      expect.objectContaining({ keychainAccessible: 'WHEN_UNLOCKED' }),
    );
  });

  it('sanitizes characters SecureStore disallows', async () => {
    await secureStorageAdapter.setItem('sb-ref:auth/token', 'x');
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
      'vesper.sb-ref_auth_token',
      'x',
      expect.anything(),
    );
  });

  it('clearStoredSession removes both documented session keys', async () => {
    await secureStorageAdapter.setItem(STORAGE_KEYS.ACCESS_TOKEN, 'a');
    await secureStorageAdapter.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'r');

    await clearStoredSession();

    expect(await secureStorageAdapter.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(await secureStorageAdapter.getItem(STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
  });
});
