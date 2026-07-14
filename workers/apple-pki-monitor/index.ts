// workers/apple-pki-monitor — standalone weekly Apple PKI expiry monitor (Chat 086a).
//
// STANDALONE per-worker Cloudflare Worker (NOT part of the consolidated workers/daily-cron
// shell — that worker routes UTC-hour modules of the *product's* daily ticks; this is an
// independent ops watchdog on its own weekly cron). SCHEDULED-only: the default export is a
// `scheduled` handler, NOT an HTTP `fetch` handler.
//
// WHY IT EXISTS: StoreKit 2 JWS verification (apps/web/lib/apple/*) pins its trust anchor
// to the Apple Root CA - G3 as an inline build-time constant. A pinned root that silently
// expires breaks ALL receipt verification with no runtime warning — there is no JWKS/TTL to
// refresh (keyCache.ts). This worker fetches Apple's LIVE published root cert each Monday,
// reads its notAfter, and fires a HIGH-severity Sentry alert once per pinned root that is
// within 180 days of expiry, so the rotation (docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md)
// happens on a calm schedule, never as an emergency.
//
// NO DB. This worker only fetches certs over HTTP and compares dates — no Postgres client,
// no createDrizzleClient, no SQL, no [vars] RUNTIME pooler selection.
//
// PIN SOURCE OF TRUTH: the roots monitored here MUST be the same trust anchors 086 pins in
// apps/web/lib/apple/appleRootCerts.ts. apps/web is a Next.js app with no package boundary a
// worker can import, so the DER is RE-PINNED below and guarded by a byte/fingerprint PARITY
// test (index.test.ts) that asserts WORKER_PINNED_ROOTS' DER === 086's committed constant —
// the two can never silently diverge. Adding an upcoming root to 086's pin set means adding
// it here too; the parity test fails loudly until they match.
//
// DEPLOY/TRANSPORT ARE CUTOVER CONCERNS: a real SENTRY_DSN + wrangler deploy are set at
// Cutover; this worker is inert until then. The local SENTRY_DSN holds an sntryu_ auth token
// (not a DSN), so local Sentry no-ops — tests MOCK Sentry rather than relying on a live DSN.
import { X509Certificate } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import {
  selectExpiringRoots,
  EXPIRY_THRESHOLD_DAYS,
  type MonitoredRoot,
} from './selectExpiringRoots.logic';

/** Minimal structural types for the Workers scheduled API (avoids a workers-types dep). */
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
type Env = Record<string, string | undefined>;

/**
 * A pinned Apple root this worker monitors. `der` + `sha256` are a RE-PINNED copy of 086's
 * apps/web/lib/apple/appleRootCerts.ts constant (parity-guarded in index.test.ts); `url` is
 * the individual published-root download Apple serves under its certificate authority page.
 */
export interface WorkerPinnedRoot {
  name: string;
  /** SHA-256 fingerprint (lowercase hex) of the DER — matches 086's `sha256`. */
  sha256: string;
  /** Apple's published .cer download for this exact root. */
  url: string;
  /** Standard-base64 DER — a re-pinned copy of 086's constant (parity-guarded). */
  der: string;
}

// Apple Root CA - G3 (CURRENT). DER + sha256 re-pinned verbatim from 086's
// APPLE_ROOT_CA_G3 (apps/web/lib/apple/appleRootCerts.ts); URL is Apple's published root
// download (apps/web comment + APPLE_ROOT_CA_ROTATION.md both cite this exact resource).
const APPLE_ROOT_CA_G3: WorkerPinnedRoot = {
  name: 'Apple Root CA - G3',
  sha256: '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179',
  url: 'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer',
  der:
    'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9v' +
    'dCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UE' +
    'CgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2' +
    'WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmlj' +
    'YXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqG' +
    'SM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxE' +
    'tX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNC' +
    'MEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0P' +
    'AQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3m' +
    'eoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkL' +
    'F1vLUagM6BgD56KyKA==',
};

/** The pinned Apple roots this worker monitors — the same trust anchors 086 pins. */
export const WORKER_PINNED_ROOTS: readonly WorkerPinnedRoot[] = [APPLE_ROOT_CA_G3];

const MONITOR_TAGS = { worker: 'apple-pki-monitor' } as const;

/** Normalize a node fingerprint256 ("AB:CD:...") to 086's lowercase-hex, no-colon form. */
function normalizeFingerprint(fp: string): string {
  return fp.replace(/:/g, '').toLowerCase();
}

export interface MonitorDeps {
  /** Injected fetch (tests). Defaults to the runtime global. */
  fetchImpl?: typeof fetch;
  /** Injected clock (tests). Defaults to the real wall clock. */
  now?: Date;
  /** Injected root set (tests). Defaults to WORKER_PINNED_ROOTS. */
  roots?: readonly WorkerPinnedRoot[];
  /** Injected threshold (tests). Defaults to 180 days. */
  thresholdDays?: number;
}

export interface MonitorRunSummary {
  /** Roots whose live cert was fetched, parsed, and validated for identity. */
  checked: number;
  /** Near-expiry alerts fired (one per pinned root within the threshold). */
  alerted: number;
  /** Roots skipped due to a fetch/parse/identity failure (each Sentry-logged). */
  errored: number;
}

/**
 * Run one PKI-monitor pass. For each pinned root: fetch Apple's live published cert, parse
 * its validity window, confirm its fingerprint still matches the pinned root (identity), then
 * feed the notAfter dates to selectExpiringRoots. Fires ONE high-severity Sentry alert per
 * near-expiry root. A healthy set fires nothing. Per-root fetch/parse/identity failures are
 * ISOLATED (Sentry-logged, do not abort the pass). Never throws for a single root's failure.
 */
export async function runApplePkiMonitor(
  deps?: MonitorDeps,
): Promise<MonitorRunSummary> {
  const doFetch = deps?.fetchImpl ?? fetch;
  const now = deps?.now ?? new Date();
  const roots = deps?.roots ?? WORKER_PINNED_ROOTS;
  const thresholdDays = deps?.thresholdDays ?? EXPIRY_THRESHOLD_DAYS;

  const monitored: MonitoredRoot[] = [];
  let errored = 0;

  for (const pin of roots) {
    try {
      const res = await doFetch(pin.url);
      if (!res.ok) {
        throw new Error(`fetch ${pin.url} returned HTTP ${res.status}`);
      }
      const der = Buffer.from(await res.arrayBuffer());
      const cert = new X509Certificate(der);

      // Identity guard: the live cert MUST still be the root we pin. A mismatch means Apple
      // changed what this URL serves (or the download was tampered) — that is itself an
      // alert-worthy condition, and we cannot reason about expiry of an unknown cert, so we
      // Sentry-log it and skip expiry evaluation for this root.
      const liveFp = normalizeFingerprint(cert.fingerprint256);
      if (liveFp !== pin.sha256.toLowerCase()) {
        errored += 1;
        Sentry.captureMessage('apple-pki-monitor: fetched cert does not match pinned root', {
          level: 'error',
          tags: { ...MONITOR_TAGS, outcome: 'fingerprint-mismatch' },
          extra: { root: pin.name, expectedSha256: pin.sha256, liveSha256: liveFp, url: pin.url },
        });
        continue;
      }

      monitored.push({ name: pin.name, sha256: pin.sha256, notAfter: new Date(cert.validTo) });
    } catch (err) {
      // Isolate: one root's fetch/parse failure must not abort the pass. Log and continue.
      errored += 1;
      Sentry.captureException(err, {
        tags: { ...MONITOR_TAGS, outcome: 'fetch-failed' },
        extra: { root: pin.name, url: pin.url },
      });
    }
  }

  const expiring = selectExpiringRoots(monitored, now, thresholdDays);

  for (const root of expiring) {
    // ONE high-severity alert per near-expiry pinned root. Carries the root id
    // (name + fingerprint) and days remaining, per the alert payload contract.
    Sentry.captureMessage('apple-pki-monitor: pinned Apple root nearing expiry', {
      level: 'error',
      tags: { ...MONITOR_TAGS, outcome: 'root-expiring', root: root.name },
      extra: {
        root: root.name,
        sha256: root.sha256,
        notAfter: root.notAfter.toISOString(),
        daysRemaining: root.daysRemaining,
        thresholdDays,
      },
    });
  }

  return { checked: monitored.length, alerted: expiring.length, errored };
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runApplePkiMonitor());
  },
};
