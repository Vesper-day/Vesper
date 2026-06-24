// Offline-queue conflict toast (build chat 038; TECHNICAL_SPEC §3 + LAYER_3 Realtime).
//
// When the offline mutation queue flushes on reconnect, any queued edit that the
// server rejects with a 409 OPTIMISTIC_LOCK_FAILURE means another device changed
// the same plan first. The queue invalidates the affected plan query (refetch)
// and asks THIS coalescer to surface a single, calm "we refreshed for you" toast.
//
// COALESCING (contract): multiple 409 events fired within a 5-SECOND window
// collapse into ONE toast. The window opens on the first 409 and the toast is
// emitted when it closes, so the single-vs-multi copy is chosen from the final
// count. Because the window/counter live on the instance, there must be exactly
// ONE instance per app (R5) — wire it once at provider setup and inject it.
//
// SEAM (R6): this module imports NOTHING platform-specific (no console, no store).
// The caller injects `emit(message)`, which each app wires to
// useUiStore.getState().enqueueToast({ message, variant: 'info' }).

/** Coalescing window: 409s within this many ms collapse into one toast. */
export const CONFLICT_TOAST_COALESCE_WINDOW_MS = 5_000;

// OPERATOR-PRE-CLEARED / VOICE-GATE-EXEMPT (OD-4). These two strings were cleared
// with the operator and are fixed copy; they are NOT run through the chat-017
// voice gate at runtime (packages/shared cannot import @vesper/ai's async,
// SDK-backed gate, and the gate's regex layer would rewrite the em-dash). The
// chat-098 voice-gate sweep MUST SKIP these constants — do not "fix" the em-dash.
/** Single-event copy: exactly one 409 in the window. */
export const CONFLICT_TOAST_SINGLE = 'Your other device edited this — refreshed';
/** Coalesced copy: two or more 409s in the window. */
export const CONFLICT_TOAST_MULTI = 'Refreshed — your other device made changes';

export interface ConflictToast {
  /** Record one 409. Emits a single (possibly coalesced) toast when the window closes. */
  notify(): void;
}

export interface ConflictToastOptions {
  /** Sink for the chosen copy. App wires useUiStore.getState().enqueueToast. */
  emit: (message: string) => void;
  /** Override the coalescing window (tests). */
  windowMs?: number;
  /** Injectable timer for deterministic tests. */
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

/**
 * Build the SINGLETON conflict-toast coalescer for one app (R5). Hold the returned
 * instance at provider scope and inject `instance.notify` as the mutation cache's
 * `emitConflict`. Constructing a fresh coalescer per 409 would defeat coalescing.
 */
export function createConflictToast(options: ConflictToastOptions): ConflictToast {
  const {
    emit,
    windowMs = CONFLICT_TOAST_COALESCE_WINDOW_MS,
    setTimeoutFn = setTimeout,
  } = options;

  let pending = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    notify(): void {
      pending += 1;
      // First event of a window opens it; later events only bump the counter so
      // they all land in the same toast.
      if (timer === null) {
        timer = setTimeoutFn(() => {
          const message = pending > 1 ? CONFLICT_TOAST_MULTI : CONFLICT_TOAST_SINGLE;
          pending = 0;
          timer = null;
          emit(message);
        }, windowMs);
      }
    },
  };
}
