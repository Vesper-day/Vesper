// Per-request CSP nonce generator.
//
// STATUS: Created per the Chat 014 deliverable list; NO consumer yet. The
// document-response CSP currently lives statically in apps/web/next.config.ts
// and carries no nonce, because nothing renders an inline <script> that needs
// one. The first consumer will be the first inline script (e.g. a Sentry
// bootstrap, if one is ever introduced).
//
// WIRING (deferred): a static next.config.ts headers() block cannot inject a
// per-request value. To actually use this nonce, the document-response CSP must
// move into apps/web/middleware.ts (per-request): generate the nonce there,
// add `'nonce-${value}'` to script-src, pass the value to the render tree via
// an `x-nonce` request header, and leave next.config.ts carrying only the
// non-CSP static headers. See docs/CSP_NOTES.md ("Deferred: per-request nonce")
// for the full migration path.
//
// Edge-safe: uses Web Crypto (globalThis.crypto), never node:crypto, so it runs
// in both the Edge middleware runtime and the Node.js runtime unchanged.

/**
 * Generate a cryptographically-random, base64-encoded nonce suitable for a
 * CSP `'nonce-...'` source and the matching inline `<script nonce="...">`.
 *
 * @param byteLength number of random bytes (default 16 = 128 bits of entropy).
 * @returns base64 string.
 */
export function generateNonce(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  // btoa exists in both the Edge runtime and modern Node (>=16); avoids a
  // node:buffer import that would break the Edge bundle.
  return btoa(binary);
}
