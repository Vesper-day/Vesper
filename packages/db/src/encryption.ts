// Application-level encryption helpers for the OAuth token columns in the
// `integrations` table (`access_token_encrypted` / `refresh_token_encrypted`,
// both `bytea`). This is the SECOND encryption layer that sits on top of
// Supabase's transparent AES-256 at-rest encryption.
//
// KEY MODEL (chat 063, resolved): app-side encryption with a server-held key in
// `process.env.PGSODIUM_KEY` (the Vercel environment), NEVER in the database.
// Encryption and decryption happen INSIDE the API routes that need to call the
// third-party provider; client code never sees the encrypted bytes. This is the
// model stated in TECHNICAL_SPEC §13 "Encryption at Rest" (the most-specific
// source). The §14 #1 / LAYER_3 "pgsodium extension stores columns" and the
// build-plan "Supabase secret" wording are loose and are superseded by §13: we
// do NOT call the in-DB `pgsodium.*` extension key store.
//
// CIPHER: libsodium XChaCha20-Poly1305 (IETF) AEAD in combined mode.
//   - key   = crypto_aead_xchacha20poly1305_ietf_KEYBYTES  = 32 bytes
//   - nonce = crypto_aead_xchacha20poly1305_ietf_NPUBBYTES = 24 bytes (random/encrypt)
//   - tag   = 16 bytes Poly1305, appended to the ciphertext by combined mode
// The 24-byte (extended) nonce is why this uses libsodium rather than Node's
// built-in `crypto` (which only exposes the 12-byte IETF ChaCha20-Poly1305): a
// 24-byte random nonce removes the birthday-bound concern of random 12-byte
// nonces, so a fresh random nonce per call is safe without a counter.
//
// STORED LAYOUT (the bytea value): nonce(24) ‖ ciphertext+tag. decryptToken
// splits the first 24 bytes back off as the nonce. The nonce is not secret.

import _sodium from 'libsodium-wrappers';

/** Resolved once libsodium's WASM runtime has finished initializing. */
let ready: Promise<typeof _sodium> | undefined;

async function getSodium(): Promise<typeof _sodium> {
  if (!ready) {
    ready = _sodium.ready.then(() => _sodium);
  }
  return ready;
}

/**
 * Load and validate the 32-byte AEAD key from `PGSODIUM_KEY` (base64). Fails
 * closed: a missing or wrong-length key throws rather than encrypting with a
 * degraded/zero key. The key is decoded on every call (cheap); we deliberately
 * do not cache the decoded bytes in a module global to keep the plaintext key
 * material short-lived.
 */
function loadKey(keyBytes: number): Uint8Array {
  const raw = process.env.PGSODIUM_KEY;
  if (!raw) {
    throw new Error(
      'encryption: PGSODIUM_KEY is not set. OAuth token encryption requires a ' +
        'base64-encoded 32-byte key in the server environment (never in the DB).',
    );
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('encryption: PGSODIUM_KEY is not valid base64.');
  }

  if (decoded.length !== keyBytes) {
    throw new Error(
      `encryption: PGSODIUM_KEY must decode to ${keyBytes} bytes ` +
        `(got ${decoded.length}). Generate one with ` +
        `\`openssl rand -base64 32\`.`,
    );
  }
  return new Uint8Array(decoded);
}

/**
 * Encrypt an OAuth token for storage in a `bytea` column.
 *
 * @param plaintext the raw token string (access or refresh token).
 * @param aad optional additional authenticated data. When supplied (e.g.
 *   `\`${userId}:${provider}\``) it binds the ciphertext to that context — the
 *   SAME value must be passed to {@link decryptToken}. The refresh site
 *   (chat 064) must use the same convention as the connect site if AAD is used.
 * @returns the `bytea` payload: nonce(24) ‖ ciphertext+tag.
 */
export async function encryptToken(plaintext: string, aad?: string): Promise<Buffer> {
  const sodium = await getSodium();
  const key = loadKey(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    aad ?? null,
    null, // nsec is unused by this construction
    nonce,
    key,
  );

  return Buffer.concat([Buffer.from(nonce), Buffer.from(ciphertext)]);
}

/**
 * Decrypt a `bytea` token payload produced by {@link encryptToken}. Throws if
 * the ciphertext is truncated or fails the Poly1305 authentication check (wrong
 * key, tampering, or wrong/missing AAD).
 *
 * @param payload the stored `bytea` value (read back from postgres as a Buffer).
 * @param aad must match the value passed at encryption time, or decryption fails.
 */
export async function decryptToken(payload: Buffer, aad?: string): Promise<string> {
  const sodium = await getSodium();
  const key = loadKey(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  const nonceBytes = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;

  if (payload.length <= nonceBytes) {
    throw new Error('encryption: ciphertext payload is too short to contain a nonce.');
  }

  const nonce = new Uint8Array(payload.subarray(0, nonceBytes));
  const ciphertext = new Uint8Array(payload.subarray(nonceBytes));

  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, // nsec is unused by this construction
    ciphertext,
    aad ?? null,
    nonce,
    key,
  );

  return Buffer.from(plaintext).toString('utf8');
}
