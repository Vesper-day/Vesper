# APPLE_ROOT_CA_ROTATION

**Trigger:** Apple publishes a new Root CA (PKI rotation), or the pinned **Apple Root CA - G3** approaches expiry. The chat 086a Apple PKI Monitor worker alerts at the six-month-before-expiry threshold.
**Frequency:** On-demand (rare — a root rotation is a multi-year event).
**Owner:** Founder (V1).

## Context

StoreKit 2 transaction verification (`apps/web/lib/apple/jws.ts`) and the Apple App Store Server Notification worker validate a JWS by walking its `x5c` certificate chain (leaf → intermediate → root) and requiring the chain to terminate in a **pinned** Apple root — the root that travels in the JWS is NOT trusted. The pin set lives in `apps/web/lib/apple/appleRootCerts.ts` as inline base64 DER constants and is served by `apps/web/lib/apple/keyCache.ts` (a parse-memo of the pinned roots — no network fetch, no JWKS, no TTL).

The pin set intentionally holds **two** slots — the current root and an upcoming root — so a rotation is a normal deploy, never an emergency: you add the next root alongside the current one well before Apple cuts over, ship, and only retire the old root once Apple deprecates it.

## Detection

- Apple PKI Monitor worker (chat 086a) alert: "Apple root approaching expiry" or "new Apple root published." See `APPLE_PKI_MONITOR.md`.
- Apple developer communications / the certificate authority page listing a new root: <https://www.apple.com/certificateauthority/>.
- A spike in `AppleJwsVerificationError` ("chain does not terminate in a pinned Apple root") in Sentry — a sign Apple has begun signing with a root you have not pinned.

## Procedure

1. **Obtain the new root DER.** Download it from Apple's certificate authority page, e.g.:
   ```bash
   curl -s -o AppleRootCA-Gn.cer https://www.apple.com/certificateauthority/AppleRootCA-Gn.cer
   ```
2. **Verify authenticity BEFORE trusting it.** Compute the SHA-256 and confirm it against Apple's published fingerprint for that root — do not paste a fingerprint you have not cross-checked with Apple:
   ```bash
   sha256sum AppleRootCA-Gn.cer          # or: openssl x509 -in AppleRootCA-Gn.cer -inform DER -noout -fingerprint -sha256
   openssl x509 -in AppleRootCA-Gn.cer -inform DER -noout -subject -dates
   ```
3. **Base64-encode the DER** for the inline constant:
   ```bash
   base64 -w0 AppleRootCA-Gn.cer
   ```
4. **Populate the upcoming-root slot** in `apps/web/lib/apple/appleRootCerts.ts`: set the `APPLE_ROOT_CA_UPCOMING` entry's `name`, `sha256` (the verified fingerprint from step 2), and `der` (the base64 from step 3). Keep the current G3 entry in place — DO NOT remove it yet.
5. **Ship it.** Open a PR, run the gate, deploy. Both roots are now trusted; verification works whether Apple signs with the old or new root.
6. **(Later, only after Apple deprecates the old root)** Retire the old root: move the new root into the current slot, blank the upcoming slot (`der: ''`), ship again.

## Verification

- `pnpm --filter @vesper/web test apps/web/lib/apple/jws.test.ts` — the keyCache test asserts each populated pin parses and that the current pin's SHA-256 matches its expected fingerprint. Update the test's expected fingerprint(s) alongside a rotation.
- Confirm `getPinnedAppleRoots()` returns the expected number of certs (2 while both roots are pinned, 1 after retirement).
- Shadow-verify a sample of recent production transactions against the new pin set (a scripted replay through `verifyAppleTransactionJws`) and confirm they still verify before deprecating the old root.
- Watch Sentry for `AppleJwsVerificationError` volume after deploy — it should not rise.

## Rollback

The change is data-only (cert constants). If a bad/incorrect cert was added, revert the `appleRootCerts.ts` change and redeploy — the previously-pinned root(s) resume immediately. Because the old root is never removed until step 6, a botched *addition* cannot break verification of transactions signed under the still-pinned current root.

## Post-Incident Review

- What happened
- Timeline
- Root cause
- Action items
