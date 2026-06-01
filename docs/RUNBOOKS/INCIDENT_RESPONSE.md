# Incident Response

**Owner:** Founder (sole escalation contact for V1).
**Severity definitions:** P1 = revenue or data impact, production down. P2 = degraded UX, no data loss. P3 = monitoring noise, no user impact.

---

## 1. API 500-Storm

### Detection

- **Sentry:** Error rate alert — `>50 unhandled exceptions / 5 min` on any `/api/v1/` route.
- **Vercel dashboard:** Function error rate tab showing sustained `5xx` responses.
- **PostHog:** `api_error` event volume spike on the `errors` dashboard.

### Immediate Actions

1. Open Vercel dashboard → Functions tab → identify the failing route(s) from error counts.
2. Open Sentry → filter to the last 15 minutes → read the stack trace and the offending request payload.
3. If the error is in a Drizzle query: check whether a recent migration ran correctly (`supabase db diff` against production).
4. If the error is in the Anthropic call: check [status.anthropic.com](https://status.anthropic.com) for an upstream incident. If upstream: add a graceful degradation response (`503` with `Retry-After: 300`) and notify users via Realtime.
5. If the error is in a Stripe call: see **Section 4 — Payment Provider Outage**.
6. Roll back the most recent Vercel deployment if no fix is immediately apparent: Vercel dashboard → Deployments → select previous good deployment → Promote to Production.

### Escalation

Founder only for V1. No external on-call rotation.

### Post-Incident Review Template

```
Date:
Duration (detection to resolution):
Affected routes:
Root cause:
User impact (# affected, data loss Y/N):
Fix applied:
Prevention action item:
```

---

## 2. Database Connection Saturation

### Detection

- **Sentry:** Repeated `too many connections` or `connection pool exhausted` errors from any API route.
- **Supabase dashboard:** Connection count graph in the Database section approaching the free-tier limit (60 direct connections; Supavisor transaction-mode pool handles up to ~200 concurrent).
- **Vercel Functions:** Spike in 500 errors from routes that touch the database.

### Immediate Actions

1. Verify all API routes use `SUPABASE_DB_URL` (Supavisor transaction-mode), not `SUPABASE_DIRECT_URL`. Check `.env` values in Vercel dashboard.
2. Open Supabase dashboard → Database → Connections → identify which role or IP is holding long-lived connections.
3. Run `SELECT pid, usename, application_name, state, query_start FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;` via Supabase SQL editor to find long-running queries or idle connections.
4. If a single query is blocking: `SELECT pg_terminate_backend(pid)` for the offending `pid`.
5. If connection count is spiked by a runaway Cloudflare Worker: disable the worker in the Cloudflare dashboard → Workers & Pages → the relevant worker → Settings → Disable.
6. If the Supabase free-tier connection limit is structurally exhausted (not a single bad query): plan immediate upgrade to Supabase Pro (which enables connection pooler tuning and branch databases). See `docs/SCALING_THRESHOLDS.md`.

### Escalation

Founder only for V1.

### Post-Incident Review Template

```
Date:
Duration:
Peak connection count:
Root cause (runaway query / worker / connection leak):
Fix:
Did this indicate need for Supabase Pro upgrade? Y/N:
Action item:
```

---

## 3. Anthropic Spend Spike

### Detection

- **Sentry:** Custom alert — `anthropic_spend_daily` metric exceeds 80% of the daily ceiling formula: `max($5/day floor, $1.20/user/month × active_users / 30)`. See `docs/SCALING_THRESHOLDS.md` for the formula.
- **Anthropic console:** Usage dashboard shows a spike in token consumption by model.
- **PostHog:** `plan_generated` events spike without a corresponding increase in active users (indicates a loop or retry storm).

### Immediate Actions

1. Open Anthropic console → Usage → filter to the last 1 hour. Identify which model (`haiku-4-5` vs `sonnet-4-6`) is consuming tokens.
2. If `sonnet-4-6` spend is spiking: check for retry storms in the plan generation route. Look at Sentry for repeated `plan_generated` errors — a failed plan that retries in a loop without backoff is the most common cause.
3. If `haiku-4-5` spend is spiking: check the butler voice gate (`packages/ai/src/gate.ts`) — it runs on every user-visible AI string. A new surface that calls the gate in a loop is the most common cause.
4. If the spend has reached 100% of the daily ceiling: **immediately disable the `/api/v1/plans/generate` endpoint** by returning `503` with a `Retry-After` header until the root cause is identified. User data is safe; no plan generation is better than runaway spend.
5. If the spend has reached 200% of the ceiling (panic threshold): contact Anthropic support to request a temporary spend limit increase while investigation continues.

### Escalation

Founder only for V1.

### Post-Incident Review Template

```
Date:
Duration of overspend:
Peak daily spend (actual vs ceiling):
Model affected (haiku / sonnet):
Root cause (retry storm / loop / new surface):
Fix:
Ceiling formula needs adjustment? Y/N:
Action item:
```

---

## 4. Payment Provider Outage

### Detection

- **Stripe status page:** [status.stripe.com](https://status.stripe.com) shows degraded or outage status on the Payments or API product.
- **Sentry:** `stripe_webhook_failed` or `stripe_checkout_error` events appearing in the last 15 minutes.
- **Cloudflare Workers dashboard:** The `stripe-webhook` worker showing `5xx` response rates.

### Immediate Actions

1. Check [status.stripe.com](https://status.stripe.com). If an active Stripe incident is listed, this is an upstream dependency failure — do not attempt to debug locally.
2. During a Stripe outage, **do not change any subscription state in the database**. Stripe will replay webhooks once the incident resolves; processing state changes manually risks double-application.
3. Notify any user who contacts support that "payment processing is temporarily delayed due to a provider issue" — do not offer manual refunds or plan changes during the outage window.
4. If the outage lasts more than 4 hours and trial conversions are impacted: extend affected trial periods by 24 hours after Stripe recovers. Use the `UPDATE subscriptions SET trial_ends_at = trial_ends_at + INTERVAL '1 day' WHERE status = 'trialing' AND updated_at > [outage_start]` query, reviewed carefully before execution.
5. After the outage resolves: verify all queued Stripe webhooks have been received and processed. Check the Cloudflare Worker logs for the `stripe-webhook` route for any failed webhook deliveries.

### Escalation

Founder only for V1. Stripe has 24/7 support for verified accounts at [support.stripe.com](https://support.stripe.com).

### Post-Incident Review Template

```
Date:
Stripe incident ID (from status.stripe.com):
Duration:
Webhooks missed / replayed:
Trial users affected:
Manual corrections needed: Y/N
Action item:
```

---

## 5. Realtime Websocket Flood

### Detection

- **Supabase dashboard:** Realtime section → active channel count approaching or exceeding 200 (free-tier ceiling). See `docs/SCALING_THRESHOLDS.md`.
- **Sentry:** Client-side errors from `@supabase/supabase-js` indicating channel subscription failures.
- **PostHog:** Drop in `plan_block_updated` real-time events alongside a spike in `plan_poll_fallback` events (if fallback polling is instrumented).

### Immediate Actions

1. Open Supabase dashboard → Realtime → verify current channel count and identify which tables are being broadcast.
2. If channel count exceeds 150 (75% of ceiling): immediately reduce `UPDATE_REALTIME_BROADCAST = true` feature flag scope in PostHog to limit which users receive live updates. Fall back to periodic polling at 30-second intervals for the remainder.
3. If a single session is subscribing to an excessive number of channels: check the Expo app's Realtime subscription lifecycle (it should suspend on `applicationDidEnterBackground` per Architecture Decision 18). A background subscription leak is the most likely cause.
4. Short-term fix: add a `channel_count_check` before any `supabase.channel()` call in the client; refuse to subscribe if count exceeds 180.
5. If this indicates the 75-user dual-device threshold has been reached: initiate Supabase Pro upgrade per `docs/SCALING_THRESHOLDS.md`.

### Escalation

Founder only for V1.

### Post-Incident Review Template

```
Date:
Peak channel count:
Duration above 150-channel threshold:
Root cause (subscription leak / rapid user growth / missing background suspend):
Fix:
Supabase Pro upgrade triggered? Y/N:
Action item:
```
