// Biometric lock wrapper (mobile, chat-090b) — TECHNICAL_SPEC §4 / Layer-4.
//
// An OPTIONAL, OFF-by-default, client-side privacy gate over Face ID / Touch ID.
// This is NOT a security boundary: there is no local-data encryption and no
// server-side enforcement (the server only stores the boolean preference via
// PUT /api/v1/profile). Web relies on the OS lock screen as the equivalent layer.
//
// Responsibilities (all native access goes through expo-local-authentication, a
// standard Expo module that runs in Expo Go on SDK 52 — no EAS build needed to
// test on-device Face ID):
//   - enrollment check (hardware present AND a biometric enrolled);
//   - a prompt function;
//   - the failure policy: after MAX_BIOMETRIC_ATTEMPTS failed attempts, fall back
//     to sign-out + re-sign-in via email magic link, routed through the EXISTING
//     shared store/auth signOut (which already unregisters the push token first)
//     — never a second sign-out path.
//
// The enabled flag is also cached locally in expo-secure-store (via the existing
// secureStorageAdapter — NOT a second wrapper) so the cold-start gate can decide
// to lock BEFORE any network round-trip. The server copy (biometric_lock_enabled)
// remains the cross-device source of truth.
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorageAdapter } from './auth/secureStorage';
import { useAuthStore } from '../store/auth';

/** Number of failed biometric prompts before the sign-out fallback fires. */
export const MAX_BIOMETRIC_ATTEMPTS = 3;

/**
 * secureStorageAdapter key for the locally-cached enabled flag. The adapter
 * namespaces this under `vesper.` in the Keychain. Stored as the string
 * 'true' / 'false'.
 */
export const BIOMETRIC_LOCK_STORAGE_KEY = 'biometric.lockEnabled';

/** Hardware + enrollment status used to gate enabling and prompting. */
export interface BiometricAvailability {
  hasHardware: boolean;
  isEnrolled: boolean;
  /** true only when both hardware is present AND a biometric is enrolled. */
  available: boolean;
}

/** Read whether the device can actually perform a biometric prompt. */
export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return { hasHardware, isEnrolled, available: hasHardware && isEnrolled };
}

export type BiometricPromptResult =
  | { ok: true }
  | { ok: false; reason: 'not-available' | 'failed' };

/**
 * Present the native biometric prompt once. Returns { ok: true } on success,
 * { ok: false, reason: 'failed' } on a failed/cancelled attempt, and
 * 'not-available' when the device cannot prompt (no hardware / not enrolled).
 */
export async function promptBiometric(): Promise<BiometricPromptResult> {
  const { available } = await getBiometricAvailability();
  if (!available) return { ok: false, reason: 'not-available' };

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Vesper',
    cancelLabel: 'Cancel',
    // Allow the device passcode as the OS-level fallback within a single attempt.
    disableDeviceFallback: false,
  });

  return result.success ? { ok: true } : { ok: false, reason: 'failed' };
}

/**
 * Failure fallback: sign the user out and request a fresh email magic link so
 * they can re-authenticate. Routed entirely through the shared store/auth slice
 * — signOut() already unregisters this device's push token before
 * supabase.auth.signOut() (chat 076). The email is captured BEFORE signOut
 * clears the user; if it is somehow absent we still sign out (the auth gate then
 * routes to the sign-in screen, where the user can request a link manually).
 */
export async function fallbackToSignOut(): Promise<void> {
  const email = useAuthStore.getState().user?.email ?? null;
  await useAuthStore.getState().signOut();
  if (email) {
    await useAuthStore.getState().signIn({ provider: 'magic_link', email });
  }
}

export interface BiometricUnlockOutcome {
  unlocked: boolean;
  /** true when the attempts were exhausted and the sign-out fallback fired. */
  signedOut: boolean;
}

/**
 * Run the full unlock flow used by the lock screen and the cold-start / resume
 * paths:
 *   - device cannot prompt (no hardware / not enrolled): degrade OPEN. This is a
 *     privacy gate, not a security boundary; trapping a user who has no usable
 *     biometric (and no local encryption to protect) would be hostile, so we
 *     unlock rather than sign out.
 *   - up to MAX_BIOMETRIC_ATTEMPTS prompts; first success unlocks.
 *   - all attempts failed: fall back to sign-out + magic link.
 *
 * `onAttemptFailed` (optional) reports remaining attempts so the lock screen can
 * surface a retry affordance / count.
 */
export async function runBiometricUnlock(opts?: {
  onAttemptFailed?: (attemptsRemaining: number) => void;
}): Promise<BiometricUnlockOutcome> {
  const { available } = await getBiometricAvailability();
  if (!available) return { unlocked: true, signedOut: false };

  for (let attempt = 1; attempt <= MAX_BIOMETRIC_ATTEMPTS; attempt++) {
    const result = await promptBiometric();
    if (result.ok) return { unlocked: true, signedOut: false };
    opts?.onAttemptFailed?.(MAX_BIOMETRIC_ATTEMPTS - attempt);
  }

  await fallbackToSignOut();
  return { unlocked: false, signedOut: true };
}

/** Locally-cached enabled flag (drives the cold-start gate before any network). */
export async function isBiometricLockEnabled(): Promise<boolean> {
  return (await secureStorageAdapter.getItem(BIOMETRIC_LOCK_STORAGE_KEY)) === 'true';
}

/** Persist the locally-cached enabled flag (mirrors the server scalar). */
export async function setBiometricLockEnabledLocal(enabled: boolean): Promise<void> {
  await secureStorageAdapter.setItem(
    BIOMETRIC_LOCK_STORAGE_KEY,
    enabled ? 'true' : 'false',
  );
}
