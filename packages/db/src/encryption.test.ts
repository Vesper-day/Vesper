import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptToken, decryptToken } from './encryption';

// A valid key is a base64-encoded 32-byte value (XChaCha20-Poly1305 KEYBYTES).
const KEY_A = randomBytes(32).toString('base64');
const KEY_B = randomBytes(32).toString('base64');
const NONCE_BYTES = 24; // crypto_aead_xchacha20poly1305_ietf_NPUBBYTES

const original = process.env.PGSODIUM_KEY;

beforeEach(() => {
  process.env.PGSODIUM_KEY = KEY_A;
});

afterEach(() => {
  if (original === undefined) delete process.env.PGSODIUM_KEY;
  else process.env.PGSODIUM_KEY = original;
});

describe('encryptToken / decryptToken', () => {
  it('round-trips a token', async () => {
    const token = 'ya29.a0AfH6SMBy-example-access-token';
    const ciphertext = await encryptToken(token);
    expect(Buffer.isBuffer(ciphertext)).toBe(true);
    await expect(decryptToken(ciphertext)).resolves.toBe(token);
  });

  it('produces ciphertext that is not the plaintext and is nonce-prefixed', async () => {
    const token = 'refresh-token-value';
    const ciphertext = await encryptToken(token);
    // nonce(24) + ciphertext + 16-byte Poly1305 tag.
    expect(ciphertext.length).toBeGreaterThan(NONCE_BYTES + 16);
    expect(ciphertext.toString('utf8')).not.toContain(token);
  });

  it('uses a fresh random nonce per call (same plaintext -> different bytes)', async () => {
    const token = 'same-input';
    const a = await encryptToken(token);
    const b = await encryptToken(token);
    expect(a.equals(b)).toBe(false);
    // ...but both decrypt back to the same plaintext.
    await expect(decryptToken(a)).resolves.toBe(token);
    await expect(decryptToken(b)).resolves.toBe(token);
  });

  it('fails to decrypt with a different key', async () => {
    const ciphertext = await encryptToken('secret');
    process.env.PGSODIUM_KEY = KEY_B;
    await expect(decryptToken(ciphertext)).rejects.toBeInstanceOf(Error);
  });

  it('fails to decrypt tampered ciphertext', async () => {
    const ciphertext = await encryptToken('secret');
    // Flip a byte inside the ciphertext body (past the nonce).
    const tampered = Buffer.from(ciphertext);
    const i = NONCE_BYTES + 1;
    tampered.writeUInt8(tampered.readUInt8(i) ^ 0xff, i);
    await expect(decryptToken(tampered)).rejects.toBeInstanceOf(Error);
  });

  it('binds AAD: decrypt fails when AAD does not match', async () => {
    const ciphertext = await encryptToken('secret', 'user-1:google_calendar');
    await expect(decryptToken(ciphertext, 'user-2:google_calendar')).rejects.toBeInstanceOf(Error);
    await expect(decryptToken(ciphertext, 'user-1:google_calendar')).resolves.toBe('secret');
  });

  it('rejects a payload too short to hold a nonce', async () => {
    await expect(decryptToken(Buffer.alloc(NONCE_BYTES))).rejects.toThrow(/too short/);
  });

  it('throws when PGSODIUM_KEY is missing', async () => {
    delete process.env.PGSODIUM_KEY;
    await expect(encryptToken('x')).rejects.toThrow(/PGSODIUM_KEY is not set/);
  });

  it('throws when PGSODIUM_KEY is the wrong length', async () => {
    process.env.PGSODIUM_KEY = randomBytes(16).toString('base64'); // 16 != 32
    await expect(encryptToken('x')).rejects.toThrow(/must decode to 32 bytes/);
  });
});
