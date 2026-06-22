// Push-token registration flow (mobile) — TECHNICAL_SPEC §9 "Push Tokens", §7
// "Live Activities" / Token Storage.
//
// On launch (once the session is authenticated and notification permission is
// granted) the app reports this device's push tokens to the web API so the
// server can target it: the regular APNs device token (for notifications) and,
// when available, the Live Activity push-to-start token (for ActivityKit). Both
// land in the single push_tokens row keyed on (user_id, device_id) via the
// chat-030 POST /api/v1/push-tokens upsert. On sign-out the row is removed via
// DELETE /api/v1/push-tokens/:deviceId.
//
// SOURCES OF EACH TOKEN (DETERMINE #5 — resolved against the installed deps):
//   - Regular APNs token: expo-notifications `getDevicePushTokenAsync()` (the
//     only push library installed, expo-notifications@0.29.14).
//   - Live Activity push-to-start token: there is NO JS API for it in the
//     installed dependency set — expo-live-activities is NOT a dependency, and
//     expo-notifications@0.29 exposes no Live Activity token API. The token is
//     produced on-device by ActivityKit (`Activity.pushToStartToken`) and handed
//     to JS through the native VesperLiveActivity bridge, which is created in a
//     Mac/Xcode session (see docs/RUNBOOKS/IOS_WIDGET_REBUILD.md). Until that
//     bridge exists this resolves to null — exactly the deferred-native-bridge
//     posture lib/alarm.ts uses for VesperAlarmBridge. The §9 "Token Storage"
//     wording "expo-live-activities registers for Live Activity push tokens" is a
//     loose spec wording superseded by the installed deps (it is not a dep).
//
// device_id: a stable, opaque id generated once on first launch and persisted in
// expo-secure-store via the existing secureStorageAdapter (lib/auth/secureStorage)
// — NOT a second secure-store wrapper. It survives sign-out so the same physical
// device keeps one push_tokens row across sessions.
//
// HARD CONSTRAINT: zero @vesper/db imports — data reaches mobile only through the
// /api/v1 routes (the shared apiClient).
import { useEffect } from 'react';
import { NativeModules } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { apiClient } from './api/client';
import { track } from './analytics';
import { secureStorageAdapter } from './auth/secureStorage';
import { useAuthStore } from '../store/auth';

/** Platform constant for the §9 contract — V1 is iOS-only. */
const PLATFORM = 'ios' as const;

/** secureStorageAdapter key for the persisted stable device id. The adapter
 * namespaces this under `vesper.` in the Keychain. */
export const DEVICE_ID_STORAGE_KEY = 'pushTokens.deviceId';

/** Outcome of a registration attempt (drives the call-site/test, never thrown). */
export interface PushTokenRegistrationResult {
  registered: boolean;
  /** Set when registered=false: why registration did not happen. */
  reason?: 'permission-not-granted' | 'error';
}

// --- device id ---------------------------------------------------------------

/**
 * Generate a v4-shaped UUID without a crypto dependency. RN/Hermes under Expo
 * SDK 52 does NOT polyfill `crypto` — the winter runtime
 * (expo/src/winter/runtime.native.ts) installs only TextDecoder/URL/
 * URLSearchParams/FormData, and expo-crypto is not a dependency. Math.random is
 * acceptable here: the device id is a non-secret, opaque, generate-once
 * identifier (not a token, not PII), persisted immediately after creation.
 */
function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Load the persisted stable device id, generating + persisting one on first
 * launch. Subsequent launches reuse the stored value, so the (user_id,
 * device_id) upsert always targets the same row for this device.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await secureStorageAdapter.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = generateDeviceId();
  await secureStorageAdapter.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

/**
 * One-way, non-reversible digest of the device id for analytics. FNV-1a (two
 * passes with distinct offset bases → 16 hex chars) rather than SHA-256 because
 * the RN bundle has no Web Crypto (`crypto.subtle`) and no expo-crypto dep. The
 * input is already an opaque random id; hashing simply guarantees the raw stable
 * id never leaves the device in an analytics payload [Decision 08 — no PII].
 */
export function hashDeviceId(deviceId: string): string {
  const fnv1a = (input: string, basis: number): string => {
    let hash = basis >>> 0;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      // 32-bit FNV prime multiply via shift-adds (stays in 32-bit range).
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  };
  // Two passes with different offset bases widen the digest to 64 bits of output.
  return fnv1a(deviceId, 0x811c9dc5) + fnv1a(deviceId, 0x01000193);
}

// --- token sources -----------------------------------------------------------

/** Native bridge exposing the ActivityKit Live Activity push-to-start token. */
interface LiveActivityBridgeModule {
  /** Resolve the current push-to-start token, or null if unavailable. */
  getPushToStartTokenAsync(): Promise<string | null>;
}

/**
 * Resolve the native VesperLiveActivity bridge if it has been wired (Mac/Xcode
 * session — IOS_WIDGET_REBUILD.md). Returns null until then so the registration
 * degrades to "regular APNs token only", mirroring lib/alarm.ts getAlarmBridge().
 */
function getLiveActivityBridge(): LiveActivityBridgeModule | null {
  const mod = (NativeModules as Record<string, unknown>).VesperLiveActivityBridge;
  if (mod && typeof (mod as LiveActivityBridgeModule).getPushToStartTokenAsync === 'function') {
    return mod as LiveActivityBridgeModule;
  }
  return null;
}

/** Best-effort Live Activity push-to-start token; null when the bridge or token
 * is absent. A bridge error must not fail the whole registration. */
async function getLiveActivityToken(): Promise<string | null> {
  const bridge = getLiveActivityBridge();
  if (!bridge) return null;
  try {
    return await bridge.getPushToStartTokenAsync();
  } catch {
    return null;
  }
}

/** Capture a registration failure to Sentry with the expo error code + platform. */
function captureRegistrationFailure(err: unknown): void {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : undefined;
  Sentry.captureException(err, {
    tags: {
      feature: 'push-token-registration',
      platform: PLATFORM,
      ...(code ? { expoErrorCode: code } : {}),
    },
  });
}

// --- registration / unregistration -------------------------------------------

/**
 * Register (upsert) this device's push tokens. Gated on notification permission
 * being granted — a no-op (no network, no event) otherwise. Obtains the regular
 * APNs token (expo-notifications) and the Live Activity push-to-start token
 * (native bridge; may be null), POSTs both to /api/v1/push-tokens with the
 * camelCase §9 body, and emits `push_token_registered` with a HASHED device id.
 * Any failure is captured to Sentry and surfaced as { registered: false }.
 */
export async function registerPushTokenForDevice(): Promise<PushTokenRegistrationResult> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return { registered: false, reason: 'permission-not-granted' };

    const deviceId = await getOrCreateDeviceId();

    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    const token =
      typeof devicePushToken.data === 'string'
        ? devicePushToken.data
        : String(devicePushToken.data);

    const liveActivityToken = await getLiveActivityToken();

    await apiClient.post('/push-tokens', {
      deviceId,
      platform: PLATFORM,
      token,
      liveActivityToken,
    });

    track('push_token_registered', {
      platform: PLATFORM,
      has_live_activity_token: liveActivityToken !== null,
      device_id_hash: hashDeviceId(deviceId),
    });

    return { registered: true };
  } catch (err) {
    captureRegistrationFailure(err);
    return { registered: false, reason: 'error' };
  }
}

/**
 * Remove this device's push token (sign-out path). DELETE is scoped to the authed
 * user + this device id; it must run while the session bearer is still valid, so
 * call it BEFORE supabase.auth.signOut(). The persisted device id is intentionally
 * NOT cleared — the same device reuses it on the next sign-in. A missing local id
 * means nothing was ever registered, so this no-ops. Failures are captured, never
 * thrown — a transient DELETE failure must never block sign-out.
 */
export async function unregisterPushTokenForDevice(): Promise<void> {
  try {
    const deviceId = await secureStorageAdapter.getItem(DEVICE_ID_STORAGE_KEY);
    if (!deviceId) return;
    await apiClient.delete(`/push-tokens/${encodeURIComponent(deviceId)}`);
  } catch (err) {
    captureRegistrationFailure(err);
  }
}

/**
 * Root-layout hook (mount once in RootNavigator alongside useAppLifecycle). Fires
 * registration on every transition into the authenticated state — i.e. on launch
 * once the session hydrates, and again after a fresh sign-in. The upsert keyed on
 * (user_id, device_id) makes repeated calls idempotent.
 */
export function usePushTokenRegistration(): void {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== 'authenticated') return;
    void registerPushTokenForDevice();
  }, [status]);
}
