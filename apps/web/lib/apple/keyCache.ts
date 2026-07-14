// Pinned Apple Root CA accessor for StoreKit 2 JWS verification (§8).
//
// WHAT THIS CACHES: the PARSED pinned Apple root certificate(s) — the base64 DER
// constants in ./appleRootCerts.ts turned into node X509Certificate objects, memoized
// once per process. That is ALL it caches.
//
// WHAT IT DOES NOT DO — and why the build-plan's "1-hour cache for Apple's
// intermediate certificates" wording does NOT apply here (§8 is authoritative):
//   * NO JWKS fetch. The apple-verify flow is x5c-certificate-chain verification,
//     not a key-set lookup. We never hit appleid.apple.com/auth/keys (that endpoint
//     is for Sign In with Apple identity tokens — a different flow entirely).
//   * NO per-transaction network call to Apple. The StoreKit JWS x5c header carries
//     the whole leaf→intermediate→root chain, so verification is fully self-contained;
//     the only trust anchor we need is the pinned root, which is a build-time constant.
//   * NO TTL / expiry. A pinned build-time asset is cached indefinitely; there is
//     nothing to refresh at runtime. The memo is a parse cache, not a network cache.
import { X509Certificate } from 'node:crypto';
import { APPLE_ROOT_CA_PINS } from './appleRootCerts';

let cache: X509Certificate[] | null = null;

/**
 * The pinned Apple root certificate(s), parsed once and memoized. Entries with an
 * empty `der` (e.g. the unpopulated upcoming-root slot) are skipped. Throws if no
 * pin is populated, so a misconfiguration fails closed rather than trusting nothing.
 */
export function getPinnedAppleRoots(): X509Certificate[] {
  if (cache) return cache;
  const parsed = APPLE_ROOT_CA_PINS.filter((p) => p.der.trim().length > 0).map(
    (p) => new X509Certificate(Buffer.from(p.der, 'base64')),
  );
  if (parsed.length === 0) {
    throw new Error('No Apple Root CA pins are configured.');
  }
  cache = parsed;
  return cache;
}

/** Test-only: clear the parse memo so a test can re-derive the pin set. */
export function __resetPinnedAppleRootsCache(): void {
  cache = null;
}
