// StoreKit 2 signed-transaction JWS verification (§8).
//
// x5c-CHAIN VERIFICATION, *NOT* JWKS. The iOS client posts a StoreKit 2
// `Transaction` as a signed JWS (`{ jwsTransaction }`, sourced from the OpenIAP
// `purchase.purchaseToken`). Apple signs it with a leaf cert whose full chain
// (leaf → intermediate → root) travels in the JWS `x5c` protected header. We verify
// by:
//   1. reading the x5c chain from the header,
//   2. requiring it to terminate in a PINNED Apple root (we do NOT trust the root
//      that travels in the JWS — it must match ./keyCache getPinnedAppleRoots()),
//   3. extracting the public key from the verified LEAF cert and checking the JWS
//      signature with it via `jose`,
//   4. parsing the transaction payload.
//
// This is deliberately NOT a JWKS lookup. Do NOT fetch
// appleid.apple.com/auth/keys here — that endpoint serves the key set for Sign In
// with Apple *identity tokens* (a different flow, chats 010/011). Using it for
// StoreKit transactions produces failures that look like key problems but are
// actually wrong-endpoint problems. The chain is self-contained, so this makes NO
// per-transaction network call to Apple.
import { X509Certificate } from 'node:crypto';
import { compactVerify, importX509 } from 'jose';
import { getPinnedAppleRoots } from './keyCache';

/**
 * The subset of the StoreKit 2 JWSTransactionDecodedPayload this route relies on.
 * Extra Apple fields pass through untyped (the whole object is stored as the event
 * payload). Dates are Apple's epoch-milliseconds numbers.
 */
export interface AppleTransactionPayload {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  /** Epoch ms — becomes subscriptions.current_period_start. */
  purchaseDate?: number;
  /** Epoch ms (auto-renewable) — becomes subscriptions.current_period_end. */
  expiresDate?: number;
  [key: string]: unknown;
}

/** A tampered JWS, a pin mismatch, or a malformed chain — a typed reject, never a silent pass. */
export class AppleJwsVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleJwsVerificationError';
  }
}

interface JwsProtectedHeader {
  alg: string;
  x5c?: string[];
}

function decodeProtectedHeader(jws: string): JwsProtectedHeader {
  const dot = jws.indexOf('.');
  if (dot <= 0) {
    throw new AppleJwsVerificationError('Malformed JWS: no protected header.');
  }
  try {
    const json = Buffer.from(jws.slice(0, dot), 'base64url').toString('utf8');
    return JSON.parse(json) as JwsProtectedHeader;
  } catch {
    throw new AppleJwsVerificationError('Malformed JWS: unreadable protected header.');
  }
}

function certsEqual(a: X509Certificate, b: X509Certificate): boolean {
  return a.raw.equals(b.raw);
}

function assertWithinValidity(cert: X509Certificate, label: string, now: Date): void {
  if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
    throw new AppleJwsVerificationError(`${label} certificate is outside its validity window.`);
  }
}

/**
 * Verify a StoreKit 2 signed transaction JWS and return its decoded payload.
 *
 * @param jws           the compact JWS (`header.payload.signature`).
 * @param opts.trustedRoots  override the pinned root set (tests inject a dev root).
 * @param opts.now      clock override (tests); defaults to `new Date()`.
 * @throws AppleJwsVerificationError on any malformed/untrusted/tampered input.
 */
export async function verifyAppleTransactionJws(
  jws: string,
  opts: { trustedRoots?: X509Certificate[]; now?: Date } = {},
): Promise<AppleTransactionPayload> {
  const header = decodeProtectedHeader(jws);
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 3) {
    throw new AppleJwsVerificationError('JWS x5c header is missing or not a full chain.');
  }

  // x5c entries are STANDARD-base64 (not base64url) DER certificates (RFC 7515).
  const [leafB64, intB64, rootB64] = x5c;
  if (!leafB64 || !intB64 || !rootB64) {
    throw new AppleJwsVerificationError('JWS x5c header is missing or not a full chain.');
  }
  let leaf: X509Certificate;
  let intermediate: X509Certificate;
  let chainRoot: X509Certificate;
  try {
    leaf = new X509Certificate(Buffer.from(leafB64, 'base64'));
    intermediate = new X509Certificate(Buffer.from(intB64, 'base64'));
    chainRoot = new X509Certificate(Buffer.from(rootB64, 'base64'));
  } catch {
    throw new AppleJwsVerificationError('JWS x5c contains an unparseable certificate.');
  }

  // Require the chain's root to MATCH a pinned root — do not trust the traveling root.
  const trustedRoots = opts.trustedRoots ?? getPinnedAppleRoots();
  const pinnedRoot = trustedRoots.find((r) => certsEqual(r, chainRoot));
  if (!pinnedRoot) {
    throw new AppleJwsVerificationError('JWS chain does not terminate in a pinned Apple root.');
  }

  // Chain signatures: leaf signed by intermediate, intermediate signed by the PINNED root.
  if (!leaf.verify(intermediate.publicKey)) {
    throw new AppleJwsVerificationError('Leaf certificate is not signed by the intermediate.');
  }
  if (!intermediate.verify(pinnedRoot.publicKey)) {
    throw new AppleJwsVerificationError('Intermediate certificate is not signed by the pinned root.');
  }

  // Validity windows (the pinned root's own window is implied by pinning it).
  const now = opts.now ?? new Date();
  assertWithinValidity(leaf, 'Leaf', now);
  assertWithinValidity(intermediate, 'Intermediate', now);

  // Verify the JWS signature with the LEAF public key, via jose.
  const leafKey = await importX509(leaf.toString(), header.alg);
  let payloadBytes: Uint8Array;
  try {
    ({ payload: payloadBytes } = await compactVerify(jws, leafKey));
  } catch {
    throw new AppleJwsVerificationError('JWS signature verification failed.');
  }

  // Parse the transaction payload.
  let decoded: AppleTransactionPayload;
  try {
    decoded = JSON.parse(new TextDecoder().decode(payloadBytes)) as AppleTransactionPayload;
  } catch {
    throw new AppleJwsVerificationError('JWS payload is not valid JSON.');
  }
  if (!decoded.transactionId || !decoded.originalTransactionId || !decoded.productId) {
    throw new AppleJwsVerificationError('Transaction payload is missing required fields.');
  }
  return decoded;
}
