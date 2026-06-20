# PGSODIUM_KEY_ROTATION

**Trigger:** Scheduled rotation of the OAuth-token encryption key on a regular cadence, or an out-of-band rotation if `PGSODIUM_KEY` is suspected compromised (leaked from logs, a former operator's access, a Vercel env exposure).
**Frequency:** Routine rotation every 90 days; immediate on suspected compromise.
**Owner:** Founder (V1).

> **Key model (authoritative — TECHNICAL_SPEC §13 "Encryption at Rest").** OAuth access and refresh tokens in `integrations.access_token_encrypted` / `refresh_token_encrypted` (`bytea`) are encrypted **app-side** with XChaCha20-Poly1305 (libsodium), keyed from `PGSODIUM_KEY` — a base64-encoded 32-byte key held in the **Vercel environment, never in the database**. Encryption/decryption happen only inside the API routes (`packages/db/src/encryption.ts`). The stored `bytea` is `nonce(24) ‖ ciphertext+tag`.
>
> The §14 Open Question 1 phrase "the pgsodium key-management API," the LAYER_3 "the pgsodium extension stores tokens as encrypted columns," and the build-plan "stored as a Supabase secret" are **loose wordings superseded by §13**: this procedure does **not** use the in-database `pgsodium.*` key store. Rotation is an application-layer re-encryption, not an in-DB key swap.

### Why app-side, not in-DB pgsodium

The pgsodium **extension** stays enabled only as the source of the AEAD primitive history; the encryption itself is done in application code with a key held in the Vercel environment. The in-DB path (pgsodium Server Key Management / Transparent Column Encryption, where the key lives in the database key store) is **deliberately not used** because Supabase has **pgsodium pending deprecation** and explicitly **does not recommend** its Server Key Management / TCE features on the platform. Tying token encryption to an in-DB key store that the platform is steering away from would couple the most security-sensitive column in the schema to a deprecated path. Holding the key in the app environment (§13) keeps the key out of the database and its backups entirely, and makes rotation a plain application-layer re-encryption that does not depend on any pgsodium key-management API.

## Detection

This runbook is run proactively (calendar reminder for the 90-day cadence) or reactively on a compromise signal. There is no automatic detector at V1. A compromise is indicated by any of: `PGSODIUM_KEY` appearing in a log/Sentry event, a Vercel access review surfacing an unexpected reader, or off-boarding of anyone who held production env access.

## Procedure

Run during a low-traffic window. The re-encryption runs against **all** `integrations` rows in a single transaction so the table is never left half-old/half-new.

1. **Generate the new key.** Create a fresh 32-byte key:
   ```bash
   openssl rand -base64 32
   ```
   Keep it out of shell history (paste into the Vercel dashboard / a secret manager, not a committed file).

2. **Stage both keys for the re-encryption job.** The re-encryption needs the OLD key (to decrypt) and the NEW key (to encrypt) simultaneously. Provide them to the one-off rotation script as `PGSODIUM_KEY_OLD` (the current live key) and `PGSODIUM_KEY_NEW` (from step 1). **Do not change the live `PGSODIUM_KEY` yet** — the running app must keep decrypting with the old key until step 4.

3. **Re-encrypt every row in one transaction.** Run the rotation script (operator-run, against `SUPABASE_DIRECT_URL`). For each `integrations` row it: reads `access_token_encrypted` / `refresh_token_encrypted`, `decryptToken(payload, OLD)`, `encryptToken(plaintext, NEW)`, and writes the new ciphertext back — all inside `BEGIN … COMMIT`. Because each value carries its own random nonce, re-encryption produces fresh nonces automatically. The transaction either commits every row with the new key or rolls back entirely (see Rollback).

4. **Atomic swap of the live key.** Only after step 3 commits, set the live `PGSODIUM_KEY` in the Vercel environment to the NEW key and redeploy (or trigger an env-only redeploy). From this point the API routes decrypt/encrypt with the new key. Ordering is load-bearing: **re-encrypt first, swap second** — never swap the live key before the rows are re-encrypted, or the app will try to decrypt old ciphertext with the new key.

5. **Retire the old key after a verification window.** Keep the OLD key archived (offline, access-controlled) through the verification window (24 hours) in case a rollback is needed. After the window passes with the verification checks green, destroy the OLD key material and remove `PGSODIUM_KEY_OLD` / `PGSODIUM_KEY_NEW` from any staging location.

## Verification

- Within the verification window, exercise a real decrypt path: connect or refresh one Google Calendar integration end-to-end (or run a read-only script that `decryptToken`s a sample of rows with the NEW key) and confirm the plaintext token is well-formed.
- Confirm no spike in `INTEGRATION_ERROR` (502) responses or Sentry `integrations.connect` / `integrations.disconnect` `auth-error` events after the swap.
- Confirm the row count re-encrypted equals the `integrations` row count at the time the transaction ran.

## Rollback

The re-encryption (step 3) is a single transaction: if it fails partway, it rolls back and **no rows are changed** — the live key is still the OLD key, so the app keeps working. Investigate the failure (a row whose old ciphertext won't decrypt indicates prior corruption, not a rotation bug) and re-run.

If the failure is discovered **after** the live-key swap (step 4) — e.g. decrypt errors surface in the verification window — revert `PGSODIUM_KEY` in Vercel back to the archived OLD key and redeploy. This is why the OLD key is retained through the window. Once reverted, the app decrypts the (now new-key) ciphertext incorrectly **only if** step 3 actually committed; if both the re-encryption committed and the swap happened, the correct live key is the NEW key — do not revert in that case, fix the verification tooling instead. Reserve the OLD-key revert for the case where the swap was applied but re-encryption did **not** commit.

## Recovery

If `PGSODIUM_KEY` is **lost** (no archived copy, no live copy), the encrypted tokens are **permanently unrecoverable** — XChaCha20-Poly1305 ciphertext cannot be decrypted without the key, and the key is never in the database or backups. There is no cryptographic recovery.

Operational recovery is re-authentication, not decryption:
1. Mark affected integrations broken: set `integrations.status = 'error'` for all rows (or delete them). The chat 064/099 broken-integration banner then prompts each user to reconnect.
2. Set a fresh `PGSODIUM_KEY` so new connections encrypt correctly.
3. Users re-run the Google Calendar connect flow, which writes new ciphertext under the new key. No user data beyond the calendar grant is affected — the tokens are re-issuable by re-consenting.

## Post-Incident Review

- **What happened** — routine rotation vs. compromise-driven; scope of any exposure.
- **Timeline** — key generated, re-encryption committed, live swap, verification, old-key destroyed.
- **Root cause** — for compromise: how the old key was exposed.
- **Action items** — e.g. tighten Vercel env access, add log scrubbing for the key pattern, shorten the cadence, or automate the re-encryption script.
