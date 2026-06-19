// Server-side auth-state-change hook (PHASE_4_BUILD_PLAN L1130).
//
// Single client for the internal auth-event endpoint. Two callers:
//   1. The DB trigger path — the auth.users UPDATE trigger (migration
//      20260601000023) POSTs directly to /api/v1/internal/auth-event via pg_net;
//      this module is the TypeScript-side analog any server code uses to drive the
//      same flow (e.g. the account/delete route firing a 'sign-out' on deletion).
//   2. Future web sign-out / session-expiry handlers (chat 081+).
//
// It authenticates with the shared secret (AUTH_EVENT_SECRET) in the
// `x-auth-event-secret` header — the same secret the migration's trigger reads
// from Vault. The internal endpoint deletes the user's push_tokens so a
// signed-out / password-changed / deleted device stops receiving pushes.
//
// Best-effort by contract: callers invoke this as a side effect of an already-
// committed state change, so a failure here MUST NOT fail the caller. It returns a
// boolean and never throws.

export type AuthEventType =
  | 'sign-out'
  | 'password change'
  | 'session expired'
  | 'hard-delete cascade';

export interface AuthEventPayload {
  userId: string;
  eventType: AuthEventType;
}

/**
 * Notify the internal auth-event endpoint that a user's auth state changed.
 * Returns true on a 2xx response, false on any failure (never throws).
 */
export async function onAuthStateChange(payload: AuthEventPayload): Promise<boolean> {
  const secret = process.env.AUTH_EVENT_SECRET;
  if (!secret) {
    // Not configured (e.g. local dev without the secret) — no-op.
    return false;
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/v1/internal/auth-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-event-secret': secret,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
