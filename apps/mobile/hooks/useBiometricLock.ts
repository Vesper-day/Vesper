// Biometric lock enforcement hook (mobile, chat-090b).
//
// Decides WHEN the optional biometric gate must engage and drives the unlock
// flow; the BiometricGate component renders the lock screen WHILE locked. Mounted
// once in the root navigator alongside usePushTokenRegistration (chat-076 mount
// pattern). It is also the single owner of the chat-013 useAppLifecycle mount
// (called here so the existing foreground query-invalidation still runs) — the
// standalone useAppLifecycle() call is removed from _layout to avoid a double
// mount.
//
// Lock policy:
//   - cold start (and any transition into the authenticated state): lock if the
//     cached flag is ON;
//   - resume from background: re-lock only when backgrounded > 60s (the grace
//     window absorbs quick app switches); <= 60s does NOT re-lock.
//
// The lock decision logic is factored into pure/injected helpers below so it is
// unit-testable without a React renderer (the codebase mocks react-native rather
// than rendering it).
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';
import { useAppLifecycle } from './useAppLifecycle';
import { useAuthStore } from '../store/auth';
import { runBiometricUnlock, isBiometricLockEnabled } from '../lib/biometric';

/** Grace window for quick app switches: 60s expressed in ms (60 * 1000). */
export const GRACE_WINDOW_MS = 60_000;

/** Pure: a resume re-locks only when the away time exceeds the grace window. */
export function shouldRelockAfterBackground(elapsedMs: number): boolean {
  return elapsedMs > GRACE_WINDOW_MS;
}

// --- shared lock state -------------------------------------------------------

interface BiometricLockState {
  /** True while the gate must obscure app content. */
  locked: boolean;
  /** True while a prompt is in flight (dedupes concurrent attempts). */
  authenticating: boolean;
  /** Force the gate open (used by the unlock flow / tests). */
  unlock: () => void;
  /**
   * Engage the gate and run the unlock flow. On success (or sign-out fallback,
   * which leaves the auth gate to route to sign-in) the gate drops.
   */
  authenticate: () => Promise<void>;
}

export const useBiometricLockStore = create<BiometricLockState>((set, get) => ({
  locked: false,
  authenticating: false,
  unlock: () => set({ locked: false }),
  authenticate: async () => {
    if (get().authenticating) return;
    set({ locked: true, authenticating: true });
    try {
      const outcome = await runBiometricUnlock();
      // unlocked → drop the gate. signedOut → session is gone; the auth gate
      // routes to sign-in, so drop the gate too. (Both cases ⇒ locked: false.)
      set({ locked: !outcome.unlocked && !outcome.signedOut });
    } finally {
      set({ authenticating: false });
    }
  },
}));

// --- decision helpers (injected deps → renderer-free unit tests) -------------

/** Cold start / fresh sign-in: authenticate when the cached flag is ON. */
export async function enforceColdStartLock(deps: {
  isEnabled: () => Promise<boolean>;
  authenticate: () => void | Promise<void>;
}): Promise<void> {
  if (await deps.isEnabled()) await deps.authenticate();
}

export interface LockController {
  onAppStateChange: (next: AppStateStatus) => void;
}

/**
 * Build the AppState change handler. Records the earliest departure from
 * 'active' and, on the next 'active', re-authenticates only when the away time
 * exceeded the grace window and the flag is ON. `now` is injected for tests.
 */
export function createLockController(deps: {
  now: () => number;
  isEnabled: () => Promise<boolean>;
  authenticate: () => void | Promise<void>;
}): LockController {
  let backgroundedAt: number | null = null;
  return {
    onAppStateChange(next) {
      if (next === 'background' || next === 'inactive') {
        // Earliest departure from active; don't overwrite on inactive→background.
        if (backgroundedAt === null) backgroundedAt = deps.now();
        return;
      }
      if (next === 'active') {
        const since = backgroundedAt;
        backgroundedAt = null;
        if (since === null) return;
        if (!shouldRelockAfterBackground(deps.now() - since)) return;
        void deps.isEnabled().then((enabled) => {
          if (enabled) void deps.authenticate();
        });
      }
    },
  };
}

// --- the hook (thin glue; not unit-tested directly) --------------------------

export function useBiometricLock(): void {
  // Single owner of the chat-013 lifecycle mount (query invalidation on resume).
  useAppLifecycle();

  const status = useAuthStore((s) => s.status);
  const authenticate = useBiometricLockStore((s) => s.authenticate);
  const controllerRef = useRef<LockController | null>(null);

  // Cold start / transition into authenticated: lock if enabled.
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    void enforceColdStartLock({
      isEnabled: isBiometricLockEnabled,
      authenticate: () => {
        if (!cancelled) void authenticate();
      },
    });
    return () => {
      cancelled = true;
    };
  }, [status, authenticate]);

  // Resume-after-background re-lock (grace-windowed).
  useEffect(() => {
    if (status !== 'authenticated') return;
    controllerRef.current = createLockController({
      now: Date.now,
      isEnabled: isBiometricLockEnabled,
      authenticate,
    });
    const sub = AppState.addEventListener('change', (next: AppStateStatus) =>
      controllerRef.current?.onAppStateChange(next),
    );
    return () => sub.remove();
  }, [status, authenticate]);
}
