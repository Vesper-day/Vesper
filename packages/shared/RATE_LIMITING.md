# Rate Limiting — Source of Truth

This file is the **authoritative reference** for every rate-limited surface in
Vesper. **Changing a number here requires changing the matching config** in:

- `packages/shared/src/api/rateLimit.ts` — authenticated, per-user limiters.
- `apps/web/middleware.ts` — public, per-IP-hash limiters (Vercel Edge).

All limiting uses **Upstash Redis** via `@upstash/ratelimit` (`slidingWindow`),
per ARCHITECTURE_DECISIONS Decision 14. The web app runs on Vercel with no
Cloudflare layer in front (TECHNICAL_SPEC §10), so the build plan's
"Cloudflare-edge" limiting is implemented as `@upstash/ratelimit` running inside
Vercel Edge middleware.

## Limiters

| Endpoint                  | limiter_name     | Limit | Window | Store   | Tier                     | Rationale                                                                 |
| ------------------------- | ---------------- | ----- | ------ | ------- | ------------------------ | ------------------------------------------------------------------------- |
| `/api/v1/plans/generate`  | `plan-generate`  | 5     | 1 hour | Upstash | authenticated per-user   | Burst guard on the most expensive (Sonnet) call for active subscribers.   |
| `/api/v1/ai/command`      | `ai-command`     | 60    | 1 hour | Upstash | authenticated per-user   | Generous ceiling for NL command parsing; catches runaway client loops.    |
| `/api/v1/waitlist`        | `waitlist`       | 100   | 1 hour | Upstash | public per-IP-hash       | Anti-abuse on an unauthenticated POST (TECHNICAL_SPEC §9 waitlist).       |
| `/api/v1/referral/track`  | `referral-track` | 200   | 1 hour | Upstash | public per-IP-hash       | Anti-abuse on an unauthenticated tracking POST; higher (legit fan-out).   |

## Keys

- **Authenticated per-user**: key = authenticated user id. The route handler
  passes `user.id` to `withRateLimit(limiterName, key)`.
- **Public per-IP-hash**: key = `anonymous_ip_hash` = lowercase hex SHA-256 of
  `${ip}:${utcDateYYYY-MM-DD}`. The UTC date is a daily-rotating salt — raw IPs
  are never persisted and no extra secret is required.

## Analytics

Every 429 emits the PostHog `rate_limit_tripped` event with properties EXACTLY
`{ endpoint, limiter_name, window_seconds, retry_after_seconds }` (TECHNICAL_SPEC
§15). `distinct_id` is the user id (authenticated) or `anonymous_ip_hash`
(public) — never a PII property. The capture helper no-ops until PostHog env is
set at Cutover (Chat 096 replaces it with the `@vesper/shared/analytics`
wrapper). A Sentry breadcrumb (`category: 'rate-limit'`) is added best-effort.

## Not covered here

The **trial-user** plan-generation path is NOT this limiter. Trial users are
gated by a per-local-day `completion_log` count (implemented in Chat 025). The
`plan-generate` Upstash limiter above applies to **active subscribers** as a
burst guard, not the trial daily quota.
