// Secure session storage for the mobile Supabase client.
//
// Per TECHNICAL_SPEC §4 (Session Handling — mobile), the Supabase session is
// persisted in expo-secure-store, which maps to the iOS Keychain. The documented
// session keys are `supabase.auth.token` (access token) and
// `supabase.auth.refreshToken`. Supabase-js itself reads/writes a single
// `storageKey` blob through this adapter; we namespace every key under
// VESPER_KEY_PREFIX so Vesper's keys never collide with anything else in the
// Keychain and remain easy to audit/clear.
//
// Accessibility is left at SecureStore's default (WHEN_UNLOCKED) — appropriate
// for auth tokens that must be readable for background token refresh while the
// device is unlocked, but never while locked.
import * as SecureStore from 'expo-secure-store';

/** Documented Supabase session keys (spec §4). Exposed for clarity/tests. */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'supabase.auth.token',
  REFRESH_TOKEN: 'supabase.auth.refreshToken',
} as const;

/** Namespace under which all Vesper auth keys live in the Keychain. */
const VESPER_KEY_PREFIX = 'vesper.';

// SecureStore keys may only contain alphanumerics, ".", "-" and "_". Map any
// other character to "_" so arbitrary Supabase storageKey values stay valid.
function toSecureStoreKey(key: string): string {
  return `${VESPER_KEY_PREFIX}${key}`.replace(/[^A-Za-z0-9._-]/g, '_');
}

const ACCESSIBILITY: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

/**
 * Storage adapter shaped for Supabase's `auth.storage` option
 * (getItem/setItem/removeItem, all async, getItem resolving to string | null).
 */
export const secureStorageAdapter = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(toSecureStoreKey(key), ACCESSIBILITY);
  },
  setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(toSecureStoreKey(key), value, ACCESSIBILITY);
  },
  removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(toSecureStoreKey(key), ACCESSIBILITY);
  },
};

/** Clear the known Vesper session keys. Used by signOut and account deletion. */
export async function clearStoredSession(): Promise<void> {
  await Promise.all([
    secureStorageAdapter.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
    secureStorageAdapter.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
  ]);
}
