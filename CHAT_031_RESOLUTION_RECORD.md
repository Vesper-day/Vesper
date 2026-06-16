# Chat 031 — Waitlist + Referral APIs — Resolution Record

EO 9, build-track (🔵). Three new route files + colocated schemas/operations +
colocated integration tests. No edits to the landed chat-024 profile/energy
routes. No hand-edits to any Drizzle stub (CHAT_111 §5 locked decision).

## F3 count-scoping determination (headline, consumed by 095-W)

**`referral_credits.beneficiary_role` EXISTS in the real
`20260601000020_chat111_schema_checkpoint.sql`.** Confirmed by reading the
migration: it creates `referral_beneficiary_role_enum AS ENUM ('referrer',
'referee')` and `ALTER TABLE public.referral_credits ADD COLUMN beneficiary_role
referral_beneficiary_role_enum NOT NULL DEFAULT 'referrer'`.

Therefore the §9 counts in `GET /api/v1/referral/code` are scoped to
`recipient_user_id = me AND beneficiary_role = 'referrer'` (NOT the §9 literal
`recipient_user_id` only). Rationale: a two-sided conversion writes both a
referrer-role row AND a referee-role row; counting only `recipient_user_id` would
let a referee-role row the user holds inflate their "referrals driven" count.

- `referralCount` = `count(*) FILTER (WHERE status <> 'voided')` for
  `recipient_user_id = me AND beneficiary_role = 'referrer'`.
- `creditsApplied` = same scope, `status = 'applied'`.
- `creditsPending` = same scope, `status = 'pending'`.
- `voided` excluded from all three (§9 / TECHNICAL_SPEC §9 line 2121).

Integration test proves the scoping: a seeded active user with 2 applied + 1
pending + 1 voided **referrer** rows and 1 applied **referee** row yields
`referralCount=3, creditsApplied=2, creditsPending=1` (voided and referee both
excluded). **095-W inherits this `beneficiary_role='referrer'` scoping flag.**

## referral-track code-source decision

§9 says "Request body: none (URL-driven only)" and the endpoint backs
`vesper.[tld]/r/{code}`. **Code is read from the `?code=` query param**
(`new URL(request.url).searchParams.get('code')`) — the natural read for the
095-V `/r/[code]` landing page, which forwards its path segment as the query
param. Recorded in `apps/web/app/api/v1/referral/schemas.ts`. Shape-validated by
`ReferralCodeSchema` (1..64 base62 chars); a null / shape-invalid / unknown code
all collapse to the same 404 + no-cookie outcome on this public endpoint.

## Raw-SQL workarounds (Drizzle stub drift)

The `waitlist` and `referral_credits` Drizzle models
(`packages/db/src/schema/waitlist.ts`) are STALE vs the applied migrations
(CHAT_111 §5): the stub declares `waitlist(referral_code, referred_by, joined_at,
converted_at)` and `referral_credits(referrer_id, referee_id, credit_type,
credited_at)`, neither of which matches the real …0009/…0020 columns. Per the
chat-024 energy (completion_log) precedent, both writes/reads against those two
tables use **raw parameterized SQL** against the migration-defined columns; the
stubs are NOT hand-edited (durable fix = chat-006 drizzle-kit pull). Each
raw-SQL site carries a comment pointing to the pull.

- `addToWaitlist.ts` — raw `INSERT INTO waitlist (email, platform_preference)`;
  duplicate email (UNIQUE, §16) raises SQLSTATE 23505 → mapped to 409 CONFLICT.
- `getReferralCode.ts` — raw `SELECT count(*) FILTER (...)` over
  `referral_credits`.

The `users` model is current (NOT stale — `referral_code` / `subscription_status`
are real columns, §3.1), so `resolveReferralCode` and the eligibility read use
Drizzle (`eq(users.referralCode, ...)`, `withUser`-scoped `users.id` read).

## Middleware limiter-registration state — PRESENT (not added)

Both PUBLIC per-IP-hash limiters are **already registered** in
`apps/web/middleware.ts` (chat 009), matching `RATE_LIMITING.md` exactly. No
change was needed:

- `/api/v1/waitlist` → `waitlist`, 100 / 1 h.
- `/api/v1/referral/track` → `referral-track`, 200 / 1 h.
- key = `anonymous_ip_hash` = lowercase hex SHA-256 of `${ip}:${utcDateYYYY-MM-DD}`
  (Web Crypto `crypto.subtle`, daily-rotating salt).

Both paths are in the middleware `matcher`. Rate limiting is in middleware, NOT
in the handlers — the handlers themselves contain no limiter call.

## Upstash-absent fallback finding (EO 9)

Upstash is NOT available at EO 9 (`UPSTASH_REDIS_REST_URL`/`_TOKEN` arrive only
at Cutover / C-26). Behavior determined by reading `rateLimit.ts` + `middleware.ts`:

- **Routes function offline.** The handlers never touch Upstash. The middleware
  constructs `Redis.fromEnv()` **lazily** (first matched request), so module eval
  and the build never call it. In local dev / tests the routes are driven without
  the Edge middleware in front, so they work fully offline.
- **`Redis.fromEnv()` THROWS without creds — it does NOT degrade to in-memory or
  no-op.** This is unlike the PostHog `captureRateLimitTripped`, which genuinely
  no-ops without env. So a *live request that actually transits the Edge
  middleware* for `/api/v1/waitlist` or `/api/v1/referral/track` would throw at
  the limiter on the first hit while Upstash env is absent. That is a Cutover
  concern, not an EO-9 route-correctness concern.
- **FLAG:** verifying "rate limiting fires after N requests" genuinely requires
  live Upstash (or a Redis mock). It is NOT covered by the offline integration
  tests and was deliberately not required. The integration tests drive the route
  operations directly (mirroring chat-024) and **all pass offline** (9/9) against
  local Supabase :54322 — they do not exercise the Edge middleware.

## NEXT_PUBLIC_APP_URL referral-url decision

The `GET /api/v1/referral/code` `url` field is built as
`${NEXT_PUBLIC_APP_URL}/r/${code}` from the env var — **no hardcoded domain**
(§9's `vesper.studio` example and §3.1's `vesper.[tld]` disagree; the env var is
authoritative). `.env.example` ships `NEXT_PUBLIC_APP_URL=http://localhost:3000`;
the operation falls back to that literal if the var is unset. The same env var
backs the `referral/track` 302 redirect target (the marketing landing page). The
200-path integration test asserts `url === \`${NEXT_PUBLIC_APP_URL ??
'http://localhost:3000'}/r/k4nx8q\``, proving the url is env-derived.

## source_user_id nullability observation (no writes here)

§17 prose says `source_user_id` is `NOT NULL`, but the real
`20260601000009_waitlist_and_referrals.sql` declares it
`uuid REFERENCES public.users(id) ON DELETE SET NULL` — i.e. **nullable**
(ON DELETE SET NULL is incompatible with NOT NULL). **Defer to the migration:
`source_user_id` is nullable.** This chat performs no writes to `source_user_id`;
the 200-path test seeds `referral_credits` rows omitting `source_user_id`
(→ NULL), which succeeds, confirming the observed nullability.

## Files

New (all under `apps/web/app/api/v1/`):

- `waitlist/route.ts`, `waitlist/addToWaitlist.ts`, `waitlist/schemas.ts`,
  `waitlist/waitlist.integration.test.ts`
- `referral/schemas.ts`
- `referral/track/route.ts`, `referral/track/trackReferral.ts`,
  `referral/track/track.integration.test.ts`
- `referral/code/route.ts`, `referral/code/getReferralCode.ts`,
  `referral/code/code.integration.test.ts`

All three route handlers are manual wrappers (not `createRoute`): the unauth
201/409, the 302/404-no-cookie, and the custom `{ reason: 'not_eligible' }` 404
body cannot be expressed by `createRoute` (which requires a session and returns a
fixed 200 with the §9 error envelope).

## Verification

- `pnpm --filter @vesper/web type-check` — clean.
- `pnpm --filter @vesper/web lint` — clean.
- `VESPER_DB_TESTS=1 vitest run` (local Supabase :54322) — **9/9 pass**
  (waitlist 2, referral/track 5, referral/code 2).
- `noUncheckedIndexedAccess` (ON in @vesper/shared) — all `rows[0]` / `[0]`
  indexing is guarded (`?.`, `?? fallback`, or explicit `if (!row)`).
