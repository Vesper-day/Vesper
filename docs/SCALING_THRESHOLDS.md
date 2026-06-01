# Scaling Thresholds

Each threshold below defines the trigger condition, the migration steps to take when it is hit, and the PostHog or Sentry signal that fires the alert.

---

## Supabase Free → Pro

**Trigger:** Any one of the following is reached:
- ~500 monthly active users (approaching 50,000 MAU free-tier ceiling at expected dual-device ratio)
- 400 MB database storage (80% of 500 MB free-tier ceiling)
- 800 MB file storage (80% of 1 GB free-tier ceiling)
- 4 GB uncached egress per month (80% of 5 GB ceiling)
- Any production window where seven days of low traffic could trigger the free-tier inactivity pause

**Migration steps:**
1. Open Supabase dashboard → Settings → Billing → Upgrade to Pro ($25/month).
2. Enable PITR (Point-in-Time Recovery) — becomes available on Pro.
3. Enable branch databases — each PR preview gets an isolated database branch.
4. Raise connection pool limits in Supavisor settings.
5. Remove the `supabase start` auto-pause workaround from any cron keep-alive jobs.
6. Schedule the first `BACKUP_RESTORE_DRILL.md` drill for the following quarter.

**Alert signal:** PostHog dashboard event `infra_threshold_warning` with property `service: "supabase"`. Sentry alert rule: `supabase_storage_pct > 80` or `supabase_mau_pct > 80`.

---

## Supabase Realtime Upgrade

**Trigger:** 75 dual-device users (≈150 concurrent Realtime channels, representing 75% of the 200-channel free-tier ceiling).

**Why 75 users:** Each dual-device user maintains 2 Realtime channels (one per device for plan sync). 75 × 2 = 150 channels. The free tier allows 200 concurrent channels. At 75% utilization, there is insufficient headroom to absorb connection spikes without dropping channels.

**Migration steps:**
1. Upgrade to Supabase Pro (if not already done — see above).
2. Realtime channel limits scale with Pro tier; verify the new ceiling in the Supabase dashboard.
3. If channels are still constrained after Pro upgrade: implement a channel-count check before any `supabase.channel()` call (reject subscription if count > 90% of ceiling) and log the rejection as a `realtime_channel_rejected` PostHog event.

**Alert signal:** PostHog event `realtime_channel_count` property `count > 150`. Sentry alert rule: `realtime_active_channels > 150`.

---

## Vercel Pro

**Status:** Active from Phase 4 build start. No upgrade step required.

**Ceilings to monitor:**
- 1 TB/month bandwidth — alert at 800 GB/month.
- 1 million serverless function invocations per day — alert at 800K/day.

**Alert signal:** Vercel analytics dashboard. PostHog event `vercel_usage_warning` with property `metric` set to `bandwidth` or `invocations`.

---

## Cloudflare Workers Paid ($5/month)

**Status:** Required from day one of cron deployment. The free tier is unusable for production cron work.

**Why required immediately:**
- Free-tier CPU limit per cron trigger: 10ms. This is insufficient for any meaningful cron job.
- Free-tier cron trigger cap: 5 per account. The Vesper deployment requires 8+ cron schedules (daily-cron multiplexed, live-activity-pusher, apple-pki-monitor, plus any future workers). 5 cron triggers is structurally insufficient.
- Paid tier: 250 cron triggers per account, 30 seconds CPU per invocation.

**Migration steps (already complete at Phase 4 start):**
1. Cloudflare dashboard → Workers & Pages → Plans → Paid ($5/month).
2. Verify `wrangler.toml` cron schedules are active.

**Alert signal:** Cloudflare Workers dashboard. Alert if any worker consistently approaches the 30-second CPU limit per invocation (indicates an algorithmic problem, not a scaling problem).

---

## Resend

**Trigger:** Either of:
- 2,500 emails/month sustained (83% of 3,000/month free-tier ceiling)
- Any single day exceeding 80 sends (80% of 100/day daily cap)

**Why 80% of daily cap:** The free-tier daily hard cap is 100 emails. A burst day that hits 100 sends causes all emails for the rest of that day to be dropped silently. Alerting at 80 gives a 30-minute remediation window in most scenarios.

**Migration steps:**
1. Resend dashboard → Billing → Upgrade to Starter ($20/month, 50,000 emails/month, no daily cap).
2. Update `RESEND_PLAN` environment variable in Vercel for observability.
3. Remove any send-rate throttling code added as a free-tier workaround.

**Alert signal:** PostHog event `resend_daily_send_count` with property `count > 80`. Sentry alert rule: `email_send_rejected` error count > 0 (indicates the daily cap was hit).

---

## Stripe API Rate Limits

**Ceilings:** 100 read requests/second per account, 100 write requests/second per account.

**Alert trigger:** Any Cloudflare Worker or API route sustaining above 50 requests/second (50% of ceiling) on either read or write operations.

**Migration steps:** At 50 rps, investigate whether requests can be batched or cached. Stripe's idempotency keys allow safe retries; the primary cause of high write rates is usually duplicate webhook processing. Check the `stripe-webhook` worker for missing idempotency handling.

**Alert signal:** Sentry alert rule: `stripe_api_429_count > 0`. PostHog event `stripe_rate_approaching` with `rps > 50`.

---

## Anthropic Spend Ceiling

**Formula:** `max($5/day floor, $1.20/user/month × (active_users + trial_users) / 30)`

**Derivation:** $1.20/user/month is the target AI cost per user at planned subscription pricing. The formula scales the daily ceiling with the user base. The $5/day floor prevents the ceiling from being trivially small at very low user counts.

**Example at 100 users:** `max($5, $1.20 × 100 / 30)` = `max($5, $4)` = $5/day.
**Example at 500 users:** `max($5, $1.20 × 500 / 30)` = `max($5, $20)` = $20/day.

**Thresholds:**
- **80% of ceiling:** Alert. Investigate token usage per request for plan generation.
- **100% of ceiling (action):** Disable the `/api/v1/plans/generate` endpoint with a `503` response and `Retry-After: 3600`. Notify users via Realtime.
- **200% of ceiling (panic):** Contact Anthropic support for a temporary limit increase. Audit all AI call sites for retry storms or prompt loops.

**Migration steps at 80%:**
1. Open Anthropic console → Usage → identify which route and model are consuming the most tokens.
2. Check for retry storms: Sentry `plan_generated` errors with identical user IDs in short windows.
3. Review prompt length — long system prompts in `packages/ai/src/prompts/` may have grown beyond their target token budget.

**Alert signal:** PostHog event `anthropic_spend_daily` with property `pct_of_ceiling > 80`. Sentry alert rule: `anthropic_spend_pct > 80`.
