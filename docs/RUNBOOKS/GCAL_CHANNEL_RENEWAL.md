# GCAL_CHANNEL_RENEWAL

**Trigger:** A Google Calendar push channel expired without being renewed, so Google stopped delivering `X-Goog-Resource-State: exists` notifications and one or more users' calendar sync silently went stale. This runbook is the manual fallback for when the automated `gcal-channel-renewal` daily-cron module did not run (or failed for a subset of users). It is NOT part of normal operation — the worker renews channels within 24h of expiry (Decision 19); this covers the case where that safety net itself failed.
**Frequency:** On-demand (incident). Expected to be rare; every firing is a signal the automated renewal path or its heartbeat needs attention.
**Owner:** Founder (V1).

> **Background (authoritative — ARCHITECTURE_DECISIONS Decision 19/20, Chats 065/066).**
> - Google push channels have a **7-day maximum TTL**. Renewal = calling `events.watch` again to create a **fresh** channel (Google has no "extend"); the new `{ id, resourceId, expiration }` replaces the old on the integration row.
> - Channel state lives on `integrations`: **`channel_id`**, **`resource_id`**, **`channel_expiration`** (migration 24; `channel_id` is indexed by `idx_integrations_channel_id`). There is **no `sync_token`** — sync is a full re-fetch via `getTodayEvents`, not a delta.
> - The renewal worker is the `gcal-channel-renewal` module inside `workers/daily-cron`, dispatched at the **05:00 UTC** tick. It re-registers via `@vesper/ai` `registerWatch` and writes back via `persistChannelState`. A single user's failure is isolated (Sentry-logged) and never aborts the batch.
> - Real channel registration is **Cutover-blocked (C-17)** — it needs a verified public HTTPS domain. Before Cutover no channels exist and this runbook is inert.

## Detection

A channel that has silently lapsed shows up as an integration whose `channel_expiration` is in the past while the integration is still `connected`. Run this against the production DB (Supabase SQL editor, or the in-repo Postgres client — `psql` is not installed locally):

```sql
-- Channels already past expiry (silent multi-day failure) or expiring within 24h that
-- the worker should already have renewed.
SELECT id, user_id, channel_id, resource_id, channel_expiration,
       (channel_expiration < now())                       AS already_expired,
       (channel_expiration < now() + interval '24 hours') AS due_for_renewal
FROM integrations
WHERE provider = 'google_calendar'
  AND status = 'connected'
  AND channel_id IS NOT NULL
  AND channel_expiration < now() + interval '24 hours'
ORDER BY channel_expiration ASC;
```

Corroborating signals:
- **No run-summary heartbeat.** The worker emits exactly one `gcal-channel-renewal run` Sentry message per dispatch. Its absence around the 05:00 UTC tick is the 097a "worker-didn't-run" alert (see `ALERTING.md`).
- **Per-user failure events.** Individual `renewal-failed` Sentry exceptions (tagged `worker: gcal-channel-renewal`) carry the `userId` + `integrationId` of each channel that failed to re-register.
- **User-visible symptom:** the user's calendar events stop updating in generated plans, but the 099 reconnect banner does **not** fire (a lapsed channel is not a token error — `status` stays `connected`).

## Procedure

Do the steps in order.

### 1. Scope the blast radius

Run the Detection query. Record the set of affected `user_id`s and whether each is `already_expired` (sync has been stale — user-facing) or merely `due_for_renewal` (caught before lapse — no user impact yet).

### 2. Confirm whether the worker fired

In Sentry, filter `worker:gcal-channel-renewal` for the last 24–48h:
- **No `run` message at all** → the dispatch did not fire. Check the Cloudflare dashboard → `vesper-daily-cron` → **Cron Triggers / Logs** for the 05:00 UTC invocation. If the whole worker is down, this is a worker-outage incident (see `INCIDENT_RESPONSE.md`) — the renewal is one symptom.
- **`run` message present with `failed > 0`** → the worker ran but some users failed. Read the per-user `renewal-failed` events for the Google API error (e.g. `403` = revoked/insufficient scope, `401` = bad token).

### 3. Manually re-register the affected channels

Once the cause is understood and a verified HTTPS domain is live (Cutover C-17 done), re-register each affected user. Use the same single registration + persistence path the worker uses — do NOT hand-write a second `events.watch` call:

1. Ensure the operator environment has `GOOGLE_WEBHOOK_CHANNEL_TOKEN` and `NEXT_PUBLIC_APP_URL` set to the production values, and DB access (`SUPABASE_DB_URL`).
2. For each affected `user_id`, invoke `registerWatch(userId)` then `persistChannelState(userId, channel)` from `@vesper/ai` (a one-off `tsx` script or the daily-cron module run against the affected set). `registerWatch` throws on a revoked token or a Google non-2xx — those users need a reconnect (step 4), not a re-register.
3. To force the whole batch immediately instead of waiting for 05:00 UTC, run the module directly (see Verification for the local/`wrangler` invocation).

### 4. Email-affected-users decision tree

- **`due_for_renewal` only (not yet expired), re-registration succeeded** → no email. The user never lost sync.
- **`already_expired`, re-registration succeeded** → **send a soft-touch email**: sync was paused for up to N days and is now restored; no action needed. (Sync gaps do not lose data — events re-fetch in full on the next sync.)
- **Re-registration failed with `401`/`403` (revoked token / scope)** → the user must reconnect Google Calendar. **Send the reconnect email** and confirm the 099 reconnect banner is showing for them (set `status='error'` if it is not, so the banner fires). Do NOT keep retrying `registerWatch` for these — it will keep 4xx-ing.
- **Bulk failure across many users (config/domain issue, not per-user)** → do not email yet; fix the root cause (domain verification, channel token, worker deploy) first, then re-run step 3 for all.

## Verification

1. **DB is clean:** re-run the Detection query — it should return **zero rows** (no connected gcal integration past-expiry or due within 24h), or only rows for users legitimately pending a reconnect (step 4).
2. **Fresh expirations:** the re-registered rows now carry a `channel_expiration` roughly 7 days out and a new `channel_id`/`resource_id`.
3. **Push actually flows:** make a change in an affected user's Google Calendar and confirm a `webhooks.google-calendar.receipt` Sentry entry with `action: 'sync'` and `syncOutcome: 'success'` — this proves the new channel resolves back to the user (`resolveChannelUser` matched the new `channel_id`) and the sync seam ran.
4. **Confirm the worker itself fired** (for a worker-didn't-run cause): after the next 05:00 UTC tick, verify the single `gcal-channel-renewal run` Sentry message with `failed: 0`. To verify out-of-band, run the module locally:
   ```bash
   # from workers/daily-cron, with RUNTIME + SUPABASE_DB_URL + GOOGLE_WEBHOOK_CHANNEL_TOKEN set
   npx wrangler dev --test-scheduled
   # then trigger the 05:00-hour path:
   curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
   ```

## Rollback

Re-registration is additive and idempotent-by-replacement — a fresh `events.watch` supersedes the prior channel, and `persistChannelState` overwrites the three columns. There is nothing destructive to roll back. If a manual re-register wrote a bad value, simply re-run step 3 for that user (the next `events.watch` replaces it). If the worker is emitting spurious failures, disable the 05:00 dispatch by removing `gcal-channel-renewal` from the `HOURLY_DISPATCH` table in `workers/daily-cron/src/index.ts` and redeploy, then renew manually until fixed.

## Post-Incident Review

- What happened
- Timeline (when channels expired vs. when detected vs. when restored)
- Root cause (worker did not fire? per-user token failures? domain/config?)
- Action items (e.g. tighten the 097a heartbeat alert threshold; add a pre-expiry alert on the Detection query)
