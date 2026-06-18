# Chat 026 — Plan Retrieval APIs — Resolution Record

Date: 2026-06-18
Branch: `chat-026-plan-retrieval-apis`

Read-only retrieval chat: two GET route handlers + one timezone date utility. No
migration, no iOS, no React UI, no AI/synthesis. This record captures the
decisions that were ambiguous in the build plan and resolved at build time.

## Files authored

- `apps/web/lib/dates/localDate.ts` — `localDateInTimeZone(tz, serverNow)`.
- `apps/web/app/api/v1/plans/operations.ts` — pure DB-layer `getPlanForDate`,
  inline `computeEffectiveStatus`, `isValidPlanDate`, and the §9 `PlanResponse`
  type. (Route files may export only HTTP handlers + segment config, so the pure
  logic lives in a sibling module — same split as chat-024 profile/operations.)
- `apps/web/app/api/v1/plans/today/route.ts` — GET handler.
- `apps/web/app/api/v1/plans/date/[date]/route.ts` — GET handler.
- `apps/web/app/api/v1/plans/plans.integration.test.ts` — endpoint integration
  tests + pure `isValidPlanDate` tests.
- `apps/web/lib/dates/localDate.test.ts` — DST/timezone unit tests.

## 1. Response shape: §9, not @vesper/shared DailyPlanSchema

`@vesper/shared`'s `DailyPlanSchema` (dailyPlan.ts) is the synthesis-OUTPUT shape
(HH:MM times, no id/status). It is **not** the GET response contract. No
GET-response Zod existed, so the serializer emits the camelCase §9 shape directly
via a local `PlanResponse` type. Every field maps to a real `daily_plans`/`blocks`
column; `start_time`/`end_time` (timestamptz) are emitted as ISO strings.

## 2. effective_status: computed inline, emitted in `status`

Per the spec inconsistency note (enum lists `in_progress` at §3; line 2551 /
chat 027 treat `in_progress` as derived-only): **we defer to §9** and emit the
COMPUTED `effective_status` in the `status` field. Formula computed INLINE in
`computeEffectiveStatus`:

```
effective_status = (status === 'scheduled'
  && start && end && end > start
  && now >= start && now < end) ? 'in_progress' : status
```

`apps/web/lib/blocks/effectiveStatus.ts` is chat 027's output and does NOT exist
yet — importing it would break the build, so the formula is inlined here. Chat 027
will extract the shared util and refactor this serializer to import it. `now` is an
injectable parameter (`getPlanForDate(..., now = new Date())`) for deterministic
tests.

## 3. localDate.ts mirrors start_of_local_day(tz)

Migration 0004a defines
`start_of_local_day(tz) = date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz`
— i.e. "the local calendar date at this instant in tz". `localDateInTimeZone` uses
`Intl.DateTimeFormat` with `timeZone`, which resolves the correct UTC offset for the
given instant (DST-correct). Both layers therefore agree on the day boundary.

Worked contract verified: `America/Los_Angeles` + `2026-01-02T06:00:00Z`
→ `2026-01-01` (local 22:00 Jan 1, UTC-8). Server/UTC would have returned
`2026-01-02`. DST spring-forward boundary (2026-03-08) also verified on both sides.

## 4. /plans/today vs /plans/date/[date]

`/today` computes the user's local date from `user.timezone` (already on
`AuthenticatedUser`) and serves it. `/date/[date]` validates the `[date]` param as
strict, real `YYYY-MM-DD` (format regex + UTC round-trip to reject `2026-13-40`,
`2026-02-30`, time suffixes) per the chat-024 validation convention; invalid →
`400 INVALID_REQUEST`. Both share `getPlanForDate` and the §9 shape.

## 5. No-plan → 404

`getPlanForDate` throws `ApiError(ErrorCode.PLAN_NOT_FOUND)` (→ 404) when no
`daily_plans` row exists for `(user_id, plan_date)`. `PLAN_NOT_FOUND` is the
purpose-built code over the generic `NOT_FOUND`.

## 6. §9 vs PHASE_4_BUILD_PLAN

No disagreement encountered between §9 and the build plan's chat-026 entry beyond
the build-plan-wide `effective_status` stored/derived ambiguity, resolved in §2
above (defer to §9).

## Test approach (hand-off)

The chat-024 tests drive the **pure DB-layer functions directly against the real
chat-002 local-Supabase test DB** (`createDrizzleClient(TEST_DB_URL)`, port 54322),
gated on `VESPER_DB_TESTS`, seeding via `auth.users` so the `on_auth_user_created`
trigger creates the `public.users` row. They do NOT mock Drizzle. The plans
integration tests follow the SAME approach: seed `auth.users` → insert
`daily_plans` + `blocks` → call `getPlanForDate`. The DST and `isValidPlanDate`
tests are pure (no DB) and run in the default ungated `pnpm test`.
