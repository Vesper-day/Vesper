// @vitest-environment node
//
// Pure Apple JWS-verification tests. A dev-signed sample transaction is the fixture —
// NO Apple Developer account / key / production transaction is needed.
//
// The fixture chain (root -> intermediate -> leaf, all EC P-256) is GENERATED AT TEST
// TIME in the beforeAll below: three fresh keypairs from node:crypto, and three X.509
// certificates DER-encoded here from those keys. Nothing key-shaped is committed. It is
// a self-signed TEST CA, entirely unrelated to Apple's real roots.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  X509Certificate,
  createHash,
  createSign,
  generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';
import { CompactSign, importPKCS8 } from 'jose';
import {
  verifyAppleJws,
  verifyAppleTransactionJws,
  AppleJwsVerificationError,
} from './jws';
import {
  getPinnedAppleRoots,
  __resetPinnedAppleRootsCache,
} from './keyCache';

// --- minimal DER writer ------------------------------------------------------
// Enough of X.690 to emit an X.509 v3 certificate. Node can parse X.509 but cannot
// issue one, and pulling in a certificate library for a test fixture is not worth a
// new dependency — so the handful of encodings the fixture needs live here.

function derLength(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  let v = n;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

const derSeq = (...parts: Buffer[]): Buffer => tlv(0x30, Buffer.concat(parts));
const derSet = (...parts: Buffer[]): Buffer => tlv(0x31, Buffer.concat(parts));
const derOctet = (content: Buffer): Buffer => tlv(0x04, content);
const derUtf8 = (s: string): Buffer => tlv(0x0c, Buffer.from(s, 'utf8'));
const derBool = (v: boolean): Buffer => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
const derBitString = (content: Buffer): Buffer =>
  tlv(0x03, Buffer.concat([Buffer.from([0x00]), content]));
const derExplicit = (tagNumber: number, content: Buffer): Buffer =>
  tlv(0xa0 | tagNumber, content);
const derContext = (tagNumber: number, content: Buffer): Buffer =>
  tlv(0x80 | tagNumber, content);

function derInteger(value: Buffer): Buffer {
  let v = value;
  while (v.length > 1 && v[0] === 0x00 && (v[1]! & 0x80) === 0) v = v.subarray(1);
  if ((v[0]! & 0x80) !== 0) v = Buffer.concat([Buffer.from([0x00]), v]);
  return tlv(0x02, v);
}

function derOid(dotted: string): Buffer {
  const parts = dotted.split('.').map(Number);
  const bytes: number[] = [parts[0]! * 40 + parts[1]!];
  for (const part of parts.slice(2)) {
    const chunk: number[] = [part & 0x7f];
    let v = Math.floor(part / 128);
    while (v > 0) {
      chunk.unshift((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    bytes.push(...chunk);
  }
  return tlv(0x06, Buffer.from(bytes));
}

/** UTCTime (YYMMDDHHMMSSZ). Valid for years 1950-2049, which covers every fixture date. */
function derUtcTime(date: Date): Buffer {
  const p = (n: number): string => String(n).padStart(2, '0');
  const s =
    p(date.getUTCFullYear() % 100) +
    p(date.getUTCMonth() + 1) +
    p(date.getUTCDate()) +
    p(date.getUTCHours()) +
    p(date.getUTCMinutes()) +
    p(date.getUTCSeconds()) +
    'Z';
  return tlv(0x17, Buffer.from(s, 'ascii'));
}

const OID_ECDSA_SHA256 = '1.2.840.10045.4.3.2';
const OID_COMMON_NAME = '2.5.4.3';
const OID_SUBJECT_KEY_ID = '2.5.29.14';
const OID_AUTHORITY_KEY_ID = '2.5.29.35';
const OID_BASIC_CONSTRAINTS = '2.5.29.19';

/** AlgorithmIdentifier for ecdsa-with-SHA256 (absent parameters, per RFC 5758). */
const sigAlgId = (): Buffer => derSeq(derOid(OID_ECDSA_SHA256));

/** Name ::= RDNSequence, carrying a single CN attribute. */
const commonName = (cn: string): Buffer =>
  derSeq(derSet(derSeq(derOid(OID_COMMON_NAME), derUtf8(cn))));

const keyIdOf = (spki: Buffer): Buffer =>
  createHash('sha1').update(spki).digest().subarray(0, 20);

function extension(oid: string, critical: boolean, value: Buffer): Buffer {
  return critical
    ? derSeq(derOid(oid), derBool(true), derOctet(value))
    : derSeq(derOid(oid), derOctet(value));
}

interface CertSpec {
  subject: string;
  issuer: string;
  subjectSpki: Buffer;
  issuerSpki: Buffer;
  notBefore: Date;
  notAfter: Date;
  isCa: boolean;
  signingKey: KeyObject;
}

/** Build and sign one X.509 v3 certificate; returns its DER bytes. */
function issueCertificate(spec: CertSpec): Buffer {
  const serial = createHash('sha256')
    .update(spec.subject)
    .digest()
    .subarray(0, 8);
  const extensions: Buffer[] = [
    extension(OID_SUBJECT_KEY_ID, false, derOctet(keyIdOf(spec.subjectSpki))),
    extension(
      OID_AUTHORITY_KEY_ID,
      false,
      derSeq(derContext(0, keyIdOf(spec.issuerSpki))),
    ),
  ];
  if (spec.isCa) {
    extensions.push(extension(OID_BASIC_CONSTRAINTS, true, derSeq(derBool(true))));
  }

  const tbs = derSeq(
    derExplicit(0, derInteger(Buffer.from([0x02]))), // v3
    derInteger(serial),
    sigAlgId(),
    commonName(spec.issuer),
    derSeq(derUtcTime(spec.notBefore), derUtcTime(spec.notAfter)),
    commonName(spec.subject),
    spec.subjectSpki,
    derExplicit(3, derSeq(...extensions)),
  );

  const signature = createSign('sha256').update(tbs).sign(spec.signingKey);
  return derSeq(tbs, sigAlgId(), derBitString(signature));
}

// --- fixture chain (dev, self-signed — NOT Apple) ----------------------------
// Generated in beforeAll. The validity windows bracket NOW so the clock override below
// stays deterministic.

const NOT_BEFORE = new Date('2026-07-13T11:49:02Z');
const NOT_AFTER_LEAF = new Date('2036-07-10T11:49:02Z');
const NOT_AFTER_ROOT = new Date('2046-07-08T11:49:02Z');

let LEAF_DER_B64: string;
let INT_DER_B64: string;
let ROOT_DER_B64: string;
let LEAF_PK8_PEM: string;
let TEST_ROOT: X509Certificate;

beforeAll(() => {
  const newKey = (): { publicKey: KeyObject; privateKey: KeyObject } =>
    generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const root = newKey();
  const intermediate = newKey();
  const leaf = newKey();

  const spki = (k: KeyObject): Buffer =>
    k.export({ format: 'der', type: 'spki' }) as Buffer;

  const rootDer = issueCertificate({
    subject: 'Vesper Test Root CA',
    issuer: 'Vesper Test Root CA',
    subjectSpki: spki(root.publicKey),
    issuerSpki: spki(root.publicKey),
    notBefore: NOT_BEFORE,
    notAfter: NOT_AFTER_ROOT,
    isCa: true,
    signingKey: root.privateKey,
  });
  const intDer = issueCertificate({
    subject: 'Vesper Test Intermediate',
    issuer: 'Vesper Test Root CA',
    subjectSpki: spki(intermediate.publicKey),
    issuerSpki: spki(root.publicKey),
    notBefore: NOT_BEFORE,
    notAfter: NOT_AFTER_LEAF,
    isCa: true,
    signingKey: root.privateKey,
  });
  const leafDer = issueCertificate({
    subject: 'Vesper Test Leaf',
    issuer: 'Vesper Test Intermediate',
    subjectSpki: spki(leaf.publicKey),
    issuerSpki: spki(intermediate.publicKey),
    notBefore: NOT_BEFORE,
    notAfter: NOT_AFTER_LEAF,
    isCa: false,
    signingKey: intermediate.privateKey,
  });

  ROOT_DER_B64 = rootDer.toString('base64');
  INT_DER_B64 = intDer.toString('base64');
  LEAF_DER_B64 = leafDer.toString('base64');
  LEAF_PK8_PEM = leaf.privateKey
    .export({ format: 'pem', type: 'pkcs8' })
    .toString();
  TEST_ROOT = new X509Certificate(rootDer);
});

const SAMPLE_TXN = {
  transactionId: '2000000000000001',
  originalTransactionId: '1000000000000001',
  productId: 'com.vesper.standard.monthly',
  purchaseDate: 1_752_000_000_000,
  expiresDate: 1_754_678_400_000,
};

// A clock inside every fixture cert's validity window (deterministic — no wall-clock flake).
const NOW = new Date('2027-01-01T00:00:00Z');

async function signSampleJws(
  payload: unknown = SAMPLE_TXN,
  x5c?: string[],
): Promise<string> {
  const chain = x5c ?? [LEAF_DER_B64, INT_DER_B64, ROOT_DER_B64];
  const key = await importPKCS8(LEAF_PK8_PEM, 'ES256');
  return new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: 'ES256', x5c: chain })
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

  it('rejects a verified-but-non-transaction payload (missing required fields)', async () => {
    // A valid chain + signature, but the payload is an ASSN-envelope shape (no
    // transactionId/originalTransactionId/productId) — the transaction assertion fires.
    const jws = await signSampleJws({ notificationType: 'DID_RENEW', signedDate: 1 });
    await expect(
      verifyAppleTransactionJws(jws, { trustedRoots: [TEST_ROOT], now: NOW }),
    ).rejects.toThrow(/missing required fields/);
  });
});

describe('verifyAppleJws (generic, no shape assertion)', () => {
  it('returns the decoded payload for a non-transaction (ASSN-envelope) shape', async () => {
    const envelope = {
      notificationType: 'DID_RENEW',
      signedDate: 1_752_000_000_000,
      data: { signedTransactionInfo: 'inner.jws.here' },
    };
    const jws = await signSampleJws(envelope);
    const out = await verifyAppleJws(jws, { trustedRoots: [TEST_ROOT], now: NOW });
    expect(out.notificationType).toBe('DID_RENEW');
    expect((out.data as { signedTransactionInfo: string }).signedTransactionInfo).toBe(
      'inner.jws.here',
    );
  });

  it('rejects a tampered JWS with a typed error (same chain guarantees as the txn form)', async () => {
    const jws = await signSampleJws({ notificationType: 'EXPIRED' });
    const parts = jws.split('.');
    const sig = parts[2]!;
    parts[2] = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');
    await expect(
      verifyAppleJws(parts.join('.'), { trustedRoots: [TEST_ROOT], now: NOW }),
    ).rejects.toBeInstanceOf(AppleJwsVerificationError);
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
