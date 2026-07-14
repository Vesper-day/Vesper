import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

// @sentry/nextjs is imported by index.ts. Mock it so captureMessage/captureException are
// inert spies in the test graph (no live DSN — transport is a Cutover concern).
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
import * as Sentry from '@sentry/nextjs';

import { runApplePkiMonitor, WORKER_PINNED_ROOTS } from './index';
// 086's committed pin set — the source of truth the worker re-pins. Imported here (test
// only) to assert byte/fingerprint parity so the two constants can never silently diverge.
import { APPLE_ROOT_CA_PINS } from '../../apps/web/lib/apple/appleRootCerts';

const captureMessage = vi.mocked(Sentry.captureMessage);
const captureException = vi.mocked(Sentry.captureException);

/** The object-form CaptureContext shape our alerts pass (narrowed off Sentry's union arg). */
interface AlertOpts {
  level?: string;
  tags?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}
/** captureMessage calls whose options carry the given outcome tag. */
function alertsWithOutcome(outcome: string): Array<[string, AlertOpts]> {
  return captureMessage.mock.calls
    .map((c) => [c[0], (c[1] ?? {}) as AlertOpts] as [string, AlertOpts])
    .filter(([, opts]) => opts.tags?.outcome === outcome);
}

/** A fetch double that serves the given DER bytes for any URL. */
function fetchServing(der: Buffer): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => Uint8Array.from(der).buffer,
  })) as unknown as typeof fetch;
}

const G3_DER = Buffer.from(WORKER_PINNED_ROOTS[0]!.der, 'base64');
// G3's real notAfter is 2039-04-30. Drive near-expiry vs healthy purely by the clock.
const HEALTHY_NOW = new Date('2026-07-13T00:00:00.000Z'); // ~13y out → no alert.
const NEAR_EXPIRY_NOW = new Date('2039-02-01T00:00:00.000Z'); // <180d before 2039-04-30.

describe('runApplePkiMonitor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fires no alert when the pinned root is healthy (fetch + parse still happen)', async () => {
    const fetchImpl = fetchServing(G3_DER);
    const summary = await runApplePkiMonitor({ fetchImpl, now: HEALTHY_NOW });

    expect(fetchImpl).toHaveBeenCalledWith(WORKER_PINNED_ROOTS[0]!.url);
    expect(summary).toEqual({ checked: 1, alerted: 0, errored: 0 });
    // No near-expiry alert fired.
    const expiryAlerts = alertsWithOutcome('root-expiring');
    expect(expiryAlerts).toHaveLength(0);
  });

  it('fires exactly one high-severity alert on a near-expiry pinned root', async () => {
    const fetchImpl = fetchServing(G3_DER);
    const summary = await runApplePkiMonitor({ fetchImpl, now: NEAR_EXPIRY_NOW });

    expect(summary).toEqual({ checked: 1, alerted: 1, errored: 0 });
    const expiryAlerts = alertsWithOutcome('root-expiring');
    expect(expiryAlerts).toHaveLength(1);

    const [message, opts] = expiryAlerts[0]!;
    expect(message).toBe('apple-pki-monitor: pinned Apple root nearing expiry');
    expect(opts?.level).toBe('error'); // HIGH severity.
    // Payload carries the root id + days remaining.
    expect(opts?.extra?.root).toBe('Apple Root CA - G3');
    expect(opts?.extra?.sha256).toBe(WORKER_PINNED_ROOTS[0]!.sha256);
    expect(typeof opts?.extra?.daysRemaining).toBe('number');
    expect(opts?.extra?.daysRemaining as number).toBeLessThanOrEqual(180);
  });

  it('isolates a fetch failure — Sentry-logged, no throw, counted as errored', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;

    const summary = await runApplePkiMonitor({ fetchImpl, now: HEALTHY_NOW });
    expect(summary).toEqual({ checked: 0, alerted: 0, errored: 1 });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('alerts on a fingerprint mismatch (live cert is not the pinned root)', async () => {
    // A pin whose sha256 does NOT match the served cert → identity guard trips.
    const wrongPin = { ...WORKER_PINNED_ROOTS[0]!, sha256: '00'.repeat(32) };
    const fetchImpl = fetchServing(G3_DER);

    const summary = await runApplePkiMonitor({ fetchImpl, now: HEALTHY_NOW, roots: [wrongPin] });
    expect(summary).toEqual({ checked: 0, alerted: 0, errored: 1 });
    const mismatch = alertsWithOutcome('fingerprint-mismatch');
    expect(mismatch).toHaveLength(1);
  });
});

// --- Drift guard: worker re-pin === 086's committed constant -------------------
describe('pin parity with apps/web/lib/apple/appleRootCerts.ts', () => {
  const strip = (s: string) => s.replace(/\s/g, '');

  it('worker G3 DER + fingerprint match 086 byte-for-byte', () => {
    const source = APPLE_ROOT_CA_PINS.find((p) => p.name === 'Apple Root CA - G3');
    const worker = WORKER_PINNED_ROOTS.find((p) => p.name === 'Apple Root CA - G3');
    expect(source).toBeDefined();
    expect(worker).toBeDefined();

    // Byte parity: the re-pinned DER equals 086's committed DER.
    expect(strip(worker!.der)).toBe(strip(source!.der));
    // Fingerprint parity: same recorded sha256.
    expect(worker!.sha256).toBe(source!.sha256);
    // …and that sha256 is the actual SHA-256 of the DER (guards a copy-paste of the wrong hash).
    const computed = createHash('sha256').update(Buffer.from(worker!.der, 'base64')).digest('hex');
    expect(computed).toBe(worker!.sha256);
  });
});
