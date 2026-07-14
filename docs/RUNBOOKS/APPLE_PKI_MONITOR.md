# APPLE_PKI_MONITOR

**Trigger:** The `vesper-apple-pki-monitor` worker fires a HIGH-severity Sentry alert — a pinned Apple root CA is within 180 days of expiry (or the live cert no longer matches the pinned root). This runbook is the alert handler; it also covers manual inspection of the worker.
**Frequency:** On-demand (alert-driven). The worker itself runs weekly, every Monday 12:00 UTC.
**Owner:** Founder (V1).

## Context

StoreKit 2 transaction verification (`apps/web/lib/apple/jws.ts` + `keyCache.ts`) trusts a JWS only if its `x5c` chain terminates in a **pinned** Apple root — the inline base64 DER constant in `apps/web/lib/apple/appleRootCerts.ts` (`APPLE_ROOT_CA_G3`). There is no JWKS/TTL: the pin is a build-time constant, so nothing refreshes it at runtime. If that pinned root silently expires, **all** Apple receipt verification breaks with no runtime warning.

The `workers/apple-pki-monitor` worker exists to make that failure loud and early. Each Monday it fetches Apple's live published root cert (`https://www.apple.com/certificateauthority/AppleRootCA-G3.cer`), parses its `notAfter`, confirms the fetched cert still matches the pinned fingerprint, and fires one Sentry alert per pinned root that is within 180 days of expiry. The 180-day lead is deliberate — a root rotation is a calm scheduled deploy, never an emergency.

The worker monitors the **same** roots the app pins: it re-pins the G3 DER + fingerprint and a parity test (`workers/apple-pki-monitor/index.test.ts`) asserts the worker's copy equals 086's `appleRootCerts.ts` constant byte-for-byte, so the two cannot silently diverge.

## Detection

The Sentry alert is one of:

- `apple-pki-monitor: pinned Apple root nearing expiry` (tag `outcome=root-expiring`) — a pinned root's live `notAfter` is ≤ 180 days out. `extra` carries `root`, `sha256`, `notAfter`, `daysRemaining`.
- `apple-pki-monitor: fetched cert does not match pinned root` (tag `outcome=fingerprint-mismatch`) — the cert Apple now serves at the pinned root's URL no longer matches the pinned fingerprint. Apple may have re-issued/rotated the root, or the download is wrong/tampered.
- `captureException` with tag `outcome=fetch-failed` — the fetch or DER parse failed (transient network, or Apple moved the resource).

## Procedure

1. **Confirm the alert.** Read the Sentry event `extra`: which `root`, its `notAfter`, and `daysRemaining`. A `root-expiring` alert with a positive `daysRemaining` is the expected, non-urgent case — you have that many days of runway.
2. **Rotate / add the root.** Follow **[APPLE_ROOT_CA_ROTATION.md](APPLE_ROOT_CA_ROTATION.md)** — that runbook is the action procedure. In short: download the announced-next root from Apple, verify its SHA-256 against Apple's published fingerprint, and populate the `APPLE_ROOT_CA_UPCOMING` slot in `apps/web/lib/apple/appleRootCerts.ts` (keep the current G3 in place), then ship.
3. **Keep the worker's pin in sync.** When you add a root to `appleRootCerts.ts`, add the same root (name, `sha256`, Apple `url`, `der`) to `WORKER_PINNED_ROOTS` in `workers/apple-pki-monitor/index.ts`. The parity test fails until they match — that failure is the reminder, not a bug.
4. **For a `fingerprint-mismatch` alert:** do NOT blindly re-pin the served cert. Cross-check the new cert's fingerprint against Apple's certificate-authority page (<https://www.apple.com/certificateauthority/>) before trusting it, then proceed as a rotation.
5. **For a `fetch-failed` alert:** check whether Apple moved the resource (the URL in `WORKER_PINNED_ROOTS`). If the path changed, update the `url` and ship. A single transient failure that clears on the next weekly tick needs no action.

## Verification

- After a rotation deploy, confirm `getPinnedAppleRoots()` returns the expected number of certs and the app's `apps/web/lib/apple/jws.test.ts` passes (see APPLE_ROOT_CA_ROTATION.md).
- Manually exercise the worker's decision offline:
  ```bash
  pnpm --filter @vesper/apple-pki-monitor test
  ```
  The `selectExpiringRoots` logic test asserts the 180-day boundary; the worker test asserts one alert fires on a near-expiry root and none on a healthy set; the parity test asserts the worker re-pin equals 086's constant.
- The next Monday tick should fire **no** `root-expiring` alert once the near-expiry root has been rotated out (or its window widened by the new root).

## Rollback

The app-side change is data-only (cert constants) — see APPLE_ROOT_CA_ROTATION.md's Rollback. The worker itself is a read-only watchdog: it makes no writes and can be paused (disable the cron in Cloudflare) with zero product impact if it misbehaves. Re-enabling it later loses nothing but a few weekly checks.

## Post-Incident Review

- What happened
- Timeline
- Root cause
- Action items
