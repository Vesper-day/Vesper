// Pure classification of a Google Calendar push notification (Chat 065).
//
// Google delivers watch-channel notifications as an EMPTY-body POST whose entire
// payload is a set of `X-Goog-*` headers (see the receiver route for the header
// contract). This module is the ONE place that (a) validates the channel token
// and (b) maps the resource-state to an action. It is deliberately PURE: it imports
// nothing from @vesper/db, @vesper/ai, or any native module, so it unit-tests fully
// offline with mock header sets and never drags libsodium/WASM onto a test graph.
//
// The route reads `request.headers` (a Web `Headers`, which satisfies HeaderLookup)
// and the configured token from the environment, then hands both here; this fn does
// no I/O and reads no globals.

/** Minimal read surface satisfied by the Web `Headers` object and test doubles. */
export interface HeaderLookup {
  get(name: string): string | null;
}

/**
 * What the receiver should do with this notification:
 *   - 'ack'    → the one-shot 'sync' handshake fired at watch-creation time. 200, NO sync.
 *   - 'sync'   → a 'exists' change notification. Trigger an incremental sync, then 200.
 *   - 'ignore' → 'not_exists', an unknown state, or a malformed request. 200, NO sync.
 */
export type NotificationAction = 'ignore' | 'ack' | 'sync';

export interface NotificationClassification {
  action: NotificationAction;
  /** X-Goog-Channel-Token matched the configured deployment secret. */
  tokenValid: boolean;
  channelId: string | null;
  resourceId: string | null;
  messageNumber: string | null;
  resourceState: string | null;
  resourceUri: string | null;
}

/**
 * Constant-time string compare (length-independent) to avoid a timing oracle on
 * the channel token — mirrors the internal/auth-event shared-secret check.
 */
function timingSafeEqual(a: string, b: string): boolean {
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Fail closed: no configured secret, or no/blank provided token ⇒ invalid. */
function isTokenValid(provided: string | null, expected: string | null | undefined): boolean {
  if (!expected || !provided) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Classify a push notification from its headers + the configured channel token.
 * The token secret is passed in (not read from the environment) to keep this fn
 * pure and deterministic under test. The route maps `tokenValid === false` to a
 * 401 + Sentry alert and never triggers a sync in that case.
 */
export function classifyNotification(
  headers: HeaderLookup,
  expectedToken: string | null | undefined,
): NotificationClassification {
  const token = headers.get('x-goog-channel-token');
  const channelId = headers.get('x-goog-channel-id');
  const resourceId = headers.get('x-goog-resource-id');
  const messageNumber = headers.get('x-goog-message-number');
  const resourceState = headers.get('x-goog-resource-state');
  const resourceUri = headers.get('x-goog-resource-uri');

  const tokenValid = isTokenValid(token, expectedToken);

  let action: NotificationAction;
  if (!channelId || !resourceState) {
    // Malformed: a genuine Google notification always carries a channel id and a
    // resource state. Missing either ⇒ ignore (the route still 401s if the token
    // is also invalid, which a non-Google caller's request will be).
    action = 'ignore';
  } else if (resourceState === 'sync') {
    action = 'ack';
  } else if (resourceState === 'exists') {
    action = 'sync';
  } else {
    // 'not_exists' (channel torn down) or any unrecognized state: nothing to sync.
    action = 'ignore';
  }

  return {
    action,
    tokenValid,
    channelId,
    resourceId,
    messageNumber,
    resourceState,
    resourceUri,
  };
}
