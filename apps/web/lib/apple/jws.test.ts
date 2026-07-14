// @vitest-environment node
//
// Pure StoreKit 2 JWS-verification tests. A dev-signed sample transaction is the
// fixture — NO Apple Developer account / key / production transaction is needed.
//
// The fixture chain (root → intermediate → leaf, all EC P-256) was generated once
// with openssl; `LEAF_PK8_PEM` is the leaf private key used to SIGN the sample JWS.
// It is a self-signed TEST CA, entirely unrelated to Apple's real roots.
import { describe, it, expect, beforeEach } from 'vitest';
import { X509Certificate, createHash } from 'node:crypto';
import { CompactSign, importPKCS8 } from 'jose';
import {
  verifyAppleTransactionJws,
  AppleJwsVerificationError,
} from './jws';
import {
  getPinnedAppleRoots,
  __resetPinnedAppleRootsCache,
} from './keyCache';

// --- fixture chain (dev, self-signed — NOT Apple) ----------------------------

const LEAF_DER_B64 =
  'MIIBgjCCASigAwIBAgIUWEbfzZziOY4ibf+Rwedd/l3e2BEwCgYIKoZIzj0EAwIwIzEhMB8GA1UEAwwYVmVzcGVyIFRlc3QgSW50ZXJtZWRpYXRlMB4XDTI2MDcxMzExNDkwMloXDTM2MDcxMDExNDkwMlowGzEZMBcGA1UEAwwQVmVzcGVyIFRlc3QgTGVhZjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABJT7VySKkMN3xt0Yj2vsOWTg/B2r4f33cIY0oyplqSzJjokqzGHOf0wJe2aVqZ/XqnWLtbn5wwso1+O0ov1hVMijQjBAMB0GA1UdDgQWBBSGPIdOjz7yeh5ULAXHev7UhAfaojAfBgNVHSMEGDAWgBTmvjASo930uyiXWucwWqcASPvLQDAKBggqhkjOPQQDAgNIADBFAiEA610rcaPOYBT5VvqNXLrT1T+ZeCbEbIfNo/XZT4cA1Z8CIBe8B9SpScrA0dPnvhgKm/uoHDNYfUEaqB/DOQlvCzQK';
const INT_DER_B64 =
  'MIIBhTCCASugAwIBAgIUbs6BukLPeIMSSTKtkGVLjgi9uQkwCgYIKoZIzj0EAwIwHjEcMBoGA1UEAwwTVmVzcGVyIFRlc3QgUm9vdCBDQTAeFw0yNjA3MTMxMTQ5MDJaFw0zNjA3MTAxMTQ5MDJaMCMxITAfBgNVBAMMGFZlc3BlciBUZXN0IEludGVybWVkaWF0ZTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCIz4DNsIGzbQYRYgV46AFF6h4XZmg4L5bvsg1QJwb3deqVxgp+TMFO7TDWW/8Do5AfCdEyOIU6x9nq7LQqyV8CjQjBAMB0GA1UdDgQWBBTmvjASo930uyiXWucwWqcASPvLQDAfBgNVHSMEGDAWgBSE6wWrTRXx+Dc3LSQoYoSknn80gDAKBggqhkjOPQQDAgNIADBFAiEAnzaAwT8CKdIekBKbQyk/1G8TXQtZfs9ixxKO95VIgisCICIEiHW3Wmaew2DB0k3TN9jif4Es3EJM+lMMZRngTCl2';
const ROOT_DER_B64 =
  'MIIBkTCCATegAwIBAgIUKGtECfyDJW1ObvzJHXtKX6LT8CswCgYIKoZIzj0EAwIwHjEcMBoGA1UEAwwTVmVzcGVyIFRlc3QgUm9vdCBDQTAeFw0yNjA3MTMxMTQ5MDJaFw00NjA3MDgxMTQ5MDJaMB4xHDAaBgNVBAMME1Zlc3BlciBUZXN0IFJvb3QgQ0EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASmrQBHguuzXLHasGElX5AYbgyb0jW+A+Wt3Ph9JeISmwSoUphOhotFpWAPlSZHtqi5VYBAlrEYBTNJvaUcr1bjo1MwUTAdBgNVHQ4EFgQUhOsFq00V8fg3Ny0kKGKEpJ5/NIAwHwYDVR0jBBgwFoAUhOsFq00V8fg3Ny0kKGKEpJ5/NIAwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiAo6DbS7B/pPpuHpoWJAM29AB9mVpcRCoVG5Y0LWkDF+wIhAKpiWOn+55AiflzoQCWNWgny4h0+uIsrwSCendx2hgMA';
const LEAF_PK8_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg73VUcD2alH5Cjtzz
GN3N7IyrtRRDOroAgOigRlCb1qahRANCAASU+1ckipDDd8bdGI9r7Dlk4Pwdq+H9
93CGNKMqZaksyY6JKsxhzn9MCXtmlamf16p1i7W5+cMLKNfjtKL9YVTI
-----END PRIVATE KEY-----`;

const SAMPLE_TXN = {
  transactionId: '2000000000000001',
  originalTransactionId: '1000000000000001',
  productId: 'com.vesper.standard.monthly',
  purchaseDate: 1_752_000_000_000,
  expiresDate: 1_754_678_400_000,
};

// A clock inside every fixture cert's validity window (deterministic — no wall-clock flake).
const NOW = new Date('2027-01-01T00:00:00Z');
const TEST_ROOT = new X509Certificate(Buffer.from(ROOT_DER_B64, 'base64'));

async function signSampleJws(
  payload: unknown = SAMPLE_TXN,
  x5c: string[] = [LEAF_DER_B64, INT_DER_B64, ROOT_DER_B64],
): Promise<string> {
  const key = await importPKCS8(LEAF_PK8_PEM, 'ES256');
  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: 'ES256', x5c })
    .sign(key);
}

describe('verifyAppleTransactionJws', () => {
  it('verifies a well-formed dev-signed transaction against the pinned (test) root', async () => {
    const jws = await signSampleJws();
    const out = await verifyAppleTransactionJws(jws, {
      trustedRoots: [TEST_ROOT],
      now: NOW,
    });
    expect(out.transactionId).toBe(SAMPLE_TXN.transactionId);
    expect(out.originalTransactionId).toBe(SAMPLE_TXN.originalTransactionId);
    expect(out.productId).toBe(SAMPLE_TXN.productId);
    expect(out.expiresDate).toBe(SAMPLE_TXN.expiresDate);
  });

  it('rejects a tampered JWS (mutated signature) with a typed error', async () => {
    const jws = await signSampleJws();
    const parts = jws.split('.');
    const sig = parts[2]!;
    parts[2] = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');
    const tampered = parts.join('.');
    await expect(
      verifyAppleTransactionJws(tampered, { trustedRoots: [TEST_ROOT], now: NOW }),
    ).rejects.toBeInstanceOf(AppleJwsVerificationError);
  });

  it('rejects on a pin mismatch (chain root is not a pinned Apple root)', async () => {
    const jws = await signSampleJws();
    // Verify the TEST-signed JWS against the REAL Apple G3 pin set → mismatch.
    await expect(
      verifyAppleTransactionJws(jws, { trustedRoots: getPinnedAppleRoots(), now: NOW }),
    ).rejects.toThrow(/pinned Apple root/);
  });

  it('rejects a malformed JWS (no/short x5c chain)', async () => {
    const jws = await signSampleJws(SAMPLE_TXN, [LEAF_DER_B64]); // only a leaf
    await expect(
      verifyAppleTransactionJws(jws, { trustedRoots: [TEST_ROOT], now: NOW }),
    ).rejects.toThrow(/x5c/);
  });
});

describe('getPinnedAppleRoots (keyCache)', () => {
  beforeEach(() => __resetPinnedAppleRootsCache());

  it('parses and memoizes the pinned root set (same ref across calls)', () => {
    const a = getPinnedAppleRoots();
    const b = getPinnedAppleRoots();
    expect(a).toBe(b); // memoized — no re-parse, no network
    expect(a).toHaveLength(1); // only G3 populated; upcoming slot is empty
  });

  it('pins the genuine Apple Root CA - G3 (SHA-256 matches Apple)', () => {
    const [g3] = getPinnedAppleRoots();
    const fingerprint = createHash('sha256').update(g3!.raw).digest('hex');
    expect(fingerprint).toBe(
      '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179',
    );
  });
});
