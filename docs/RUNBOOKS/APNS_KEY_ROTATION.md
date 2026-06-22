# APNS_KEY_ROTATION

**Trigger:** Scheduled rotation of the token-based APNs signing key on a regular cadence, or an out-of-band rotation if the `.p8` key is suspected compromised (leaked from logs, a former operator's access, a Cloudflare env exposure, an accidental commit).
**Frequency:** Routine rotation every 12 months (Apple `.p8` keys do not expire, so the cadence is policy, not forced); immediate on suspected compromise.
**Owner:** Founder (V1).

> **Key model (authoritative — TECHNICAL_SPEC §7 "APNs Authentication").** APNs uses **token-based** authentication. The `.p8` private key issued by Apple is held as the Cloudflare Workers secret **`APNS_PRIVATE_KEY`** (the PEM contents), alongside **`APNS_KEY_ID`** (the 10-char key identifier) and **`APNS_TEAM_ID`** (the 10-char Apple Developer team identifier). Each APNs request is authorized by a short-lived JWT the worker signs with the `.p8` using `jose`; the JWT is valid up to one hour and is cached and regenerated before expiry. The key is **account-wide** (not per-app) and lives **only** in the Cloudflare Workers environment (encrypted at rest by Cloudflare), never in the database or its backups.
>
> **Rotation = swap the secret + redeploy.** Unlike the database-side re-encryption in [PGSODIUM_KEY_ROTATION](./PGSODIUM_KEY_ROTATION.md), there is no stored ciphertext to migrate. Rotation replaces `APNS_PRIVATE_KEY` / `APNS_KEY_ID` across the workers that sign APNs JWTs and lets the next JWT regeneration pick up the new key. **`APNS_TEAM_ID` does not change** — the team is the same; only the signing key is replaced.

## Workers in scope

Every worker that signs an APNs JWT must receive the new secrets. As of Phase 4:

- **`live-activity-pusher`** (chat 080) — signs APNs JWTs to POST Live Activity `start`/`end`/`update` payloads to `https://api.push.apple.com`. Cron `*/5 * * * *`.
- **`apns-token-cleanup`** (`workers/daily-cron/modules/apns-token-cleanup.ts`, dispatched from the `daily-cron` worker) — reads the 410 Gone responses logged by `live-activity-pusher` and nulls the matching `push_tokens.live_activity_token`. It runs in the **`daily-cron`** worker's environment, so roll the secrets in `daily-cron` too whenever that module talks to APNs.

> Before rotating, confirm the live set of APNs-signing workers (`wrangler deployments list` / the `wrangler.toml` per worker). Add any new signer to this list — a worker left on the old key starts failing the moment the old key is revoked.

## Detection

Run proactively (calendar reminder for the 12-month cadence) or reactively on a compromise signal. There is no automatic detector at V1. A compromise is indicated by any of: the `.p8` contents or `APNS_PRIVATE_KEY` appearing in a log/Sentry event, a Cloudflare access review surfacing an unexpected reader, the `.p8` file being found in a commit or shared insecurely, or off-boarding of anyone who held production secret access.

## Procedure (routine, zero-downtime)

Apple permits **up to two active token-based APNs keys per Developer account at once**. That overlap is what makes rotation zero-downtime: add the new key alongside the old, cut traffic over, verify, then retire the old key.

### (a) Apple-side — mint the replacement key

1. In the [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list) → **Certificates, Identifiers & Profiles → Keys**, create a new key with **Apple Push Notifications service (APNs)** enabled.
2. Download the `.p8` **once** (Apple never lets you re-download it). Store it in the secret manager / offline access-controlled location — never a committed file, never shell history.
3. Record the new **Key ID** (10 chars) shown on the key's page.
4. **Confirm the Team ID is unchanged** — it is shown in the portal header and must equal the current `APNS_TEAM_ID`. Rotation replaces the key, not the team; if the Team ID differs you are in the wrong account.

At this point both the old and new keys are active at Apple (two-key limit respected). The old key keeps working — nothing is broken yet.

### (b) Cloudflare-side — roll the secrets across every signing worker

For **each** worker in *Workers in scope*, set the two secrets to the new key's values (`APNS_TEAM_ID` is left as-is):

```bash
# Run per worker (live-activity-pusher, then daily-cron). Paste the new .p8 PEM
# contents when prompted; do not echo them into a file or shell history.
wrangler secret put APNS_PRIVATE_KEY --name live-activity-pusher
wrangler secret put APNS_KEY_ID      --name live-activity-pusher

wrangler secret put APNS_PRIVATE_KEY --name daily-cron
wrangler secret put APNS_KEY_ID      --name daily-cron
```

`APNS_PRIVATE_KEY` is the full PEM including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines (newlines preserved, matching the `.env.example` format). After updating secrets, **redeploy or restart each worker** so any cached JWT (valid up to an hour) is discarded and the next request signs with the new `APNS_KEY_ID` + key:

```bash
wrangler deploy --name live-activity-pusher
wrangler deploy --name daily-cron
```

### (c) Zero-downtime sequencing

The load-bearing order:

1. **Add** the new key at Apple (step a) — both keys now valid.
2. **Roll** the Cloudflare secrets + redeploy (step b) — workers begin signing with the new key while the old key is still valid at Apple, so any in-flight JWT signed with the old key is still accepted.
3. **Verify** delivery on a test device with the new key (step d).
4. **Only then retire** the old key — revoke it in the Apple Developer Portal (**Keys → old key → Revoke**). Until revoked, keep the old `.p8` archived offline so step b can be reverted if verification fails.

Never revoke the old key before step 3 passes — revocation is immediate and invalidates every JWT signed with that key across all workers.

### (d) Post-rotation verification

- Trigger a real Live Activity push to a **test device** (start a block whose boundary falls in the next `live-activity-pusher` tick, or invoke the worker's push path directly) and confirm the activity starts/updates on-device with the new key in effect.
- Tail the worker logs and confirm pushes to a **sample of production devices** land: `wrangler tail live-activity-pusher` — look for 200 responses from `api.push.apple.com` and **no** new `403 InvalidProviderToken` / `403 ExpiredProviderToken` errors (those are the signature-key failure modes).
- Confirm there is **no** spike in 410 Gone handling beyond baseline (a key problem manifests as auth 403s, not 410s; a 410 spike would indicate a different issue).
- Confirm the Sentry alert for "any error in the `live-activity-pusher` worker" (§13 alerting) stays quiet through at least one full cron cycle.

## Procedure (emergency — compromised key)

When the `.p8` is known or suspected compromised, the goal flips from zero-downtime to **minimize the window an attacker can send pushes as us**. The steps are the same but the grace window collapses:

1. **Mint + deploy the new key immediately** (steps a + b) — get all signing workers onto the new key first, so revoking the old key does not take down legitimate pushes.
2. **Abbreviated verification** — one test-device push + a quick `wrangler tail` confirming 200s on the new key. Do not wait the normal overlap window.
3. **Revoke the compromised key at Apple at once** (Keys → Revoke), the moment the new key is verified live. Revocation is immediate and invalidates every JWT signed with the old key; an attacker holding the leaked `.p8` can no longer authenticate to APNs.
4. **Purge the leaked material** — remove the compromised `.p8` from wherever it leaked (rotate the Cloudflare access that exposed it, scrub logs, force-expire the exposure path) and destroy any archived copy of the old key (no rollback is wanted for a compromised key).

Because the APNs key is account-wide, a compromised key could be used to push to any of our devices until revoked — treat the revoke step as time-critical, not end-of-procedure.

## Rollback

If verification fails after the secret swap (step b) but **before** the old key is revoked: re-`wrangler secret put` the **archived old** `APNS_PRIVATE_KEY` / `APNS_KEY_ID` back into each worker and redeploy. The old key is still valid at Apple (not yet revoked), so this restores service immediately. Then investigate the new key (wrong Key ID, malformed PEM, wrong account) before retrying. **Do not** use this rollback in the emergency path — for a compromised key, fix forward rather than reverting to a key you intend to revoke.

## Recovery

If the **new** `.p8` is lost before it is deployed, simply mint another (Apple's two-key limit still allows it while the old key remains). If the **only** working key is lost and already revoked, mint a fresh key (step a), deploy it (step b), and re-verify — no device-side data is affected; `push_tokens` rows are untouched and the next worker tick re-establishes delivery. APNs keys carry no irrecoverable state: unlike the pgsodium key, losing a `.p8` costs a re-mint, not data.

## Post-Incident Review

- **What happened** — routine rotation vs. compromise-driven; scope of any exposure; which workers were rolled.
- **Timeline** — new key minted, secrets rolled + workers redeployed, verification, old key revoked.
- **Root cause** — for compromise: how the `.p8` was exposed.
- **Action items** — e.g. tighten Cloudflare secret access, add log scrubbing for the `-----BEGIN PRIVATE KEY-----` pattern, shorten the cadence, or script the per-worker `wrangler secret put` fan-out so no signing worker is missed.
```
