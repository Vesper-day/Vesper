# Chat 025 — Plan Generation API: Resolution Record

Scope: `POST /api/v1/plans/generate` (SSE streaming) + two `apps/web/lib`
utilities (idempotency lock, regeneration caps) + the CD-flag F1 migration.
Package: `apps/web` (🔵). EO 34, `PHASE_4_BUILD_PLAN.md` master table: CD-flag `F1 C`.

---

## 1. `generate/route.ts` — stub-vs-replace decision: **REPLACED**

The pre-existing `apps/web/app/api/v1/plans/generate/route.ts` was a 5-line
scaffold returning `501 Not Implemented` (a single `POST()` with no logic). It was
**replaced**, not extended.

The route mirrors the **manual wrapper** (not `createRoute`): like
`energy/route.ts`, it cannot use `createRoute` because that helper always returns a
JSON `successResponse`, whereas this endpoint returns a `text/event-stream` body.
The route therefore reproduces the wrapper steps inline (requestId → version gate →
session → handler) and returns a streaming `Response`. `runtime = 'nodejs'` is set
explicitly: Vercel Edge does not support the long-lived Web Streams plumbing, and
`@vesper/db` (postgres-js) is Node-only.

Route exports are limited to `POST` + `runtime` (Next.js rejects any other Route
export). All non-handler logic lives in the sibling `./generatePlan` module so the
integration test can drive it without Supabase Auth (the `logEnergy` / `operations`
pattern).

## 2. §9 streaming + fallback-200 contract

- The response is SSE. Each `synthesizePlan` chunk is streamed immediately as an
  `event: plan` (carrying a partial or complete `DailyPlan`). On completion a final
  `event: done` carries `{ source, planId, regenerationCount, blockCount,
  fallbackNotice? }`.
- **Failure-after-fallbacks is a 200, not a 5xx** (§9). `synthesizePlan` never
  throws on AI failure — its chat-022 fallback chain *serves* a hardcoded archetype
  plan as the final chunk. The route detects "this was a served fallback" and sets
  `source: 'fallback'` + `fallbackNotice`. Because an SSE response has already
  committed `200` headers by the time synthesis runs, any later failure is an
  in-stream `event: error`, never a status change.
- **Fallback detection** is by note prefix: `serveFallback` prepends the fixed
  `APOLOGY_LINE` (LOCKED Decision 6) to the plan note, and the route checks
  `note.startsWith(APOLOGY_LINE)`. This is the only fallback signal on
  `synthesizePlan`'s public surface — the generator delegates with `yield*` and
  discards `runFallbackChain`'s structured return value, so the last yielded chunk
  (the complete plan) is all the route receives. To make this contract a single
  source of truth (rather than a duplicated magic string that would silently
  drift), **`APOLOGY_LINE` was re-exported from the `@vesper/ai` barrel**
  (`packages/ai/src/index.ts`) — a one-line additive re-export of an
  already-exported constant. No synthesis logic was touched (chat 022 owns it).
  - *Objection:* a model could in principle emit a note that coincidentally begins
    with that exact apology sentence and be misclassified as a fallback. The string
    is voice-clean, specific, and full-sentence; the collision probability is
    negligible and the misclassification is cosmetic (it only flips `source` /
    `fallbackNotice`; the plan still persists identically).

## 3. Buffer-then-commit + heartbeat + abort design

- **Buffer-then-commit** (`createPlanStream` in `generatePlan.ts`): chunks stream
  to the client *immediately*; the complete plan is accumulated in worker memory;
  **no DB transaction is opened until the stream finishes.** The transaction in
  `commitPlan` is held only for the plan + blocks + completion_log writes
  (~50–200ms) — a Supavisor transaction-mode slot is **not** held across the
  generation.
- **Heartbeat** starts when streaming begins and stops on stream end.
- **Abort**: the request's abort signal (`request.signal`) is forwarded into an
  `AbortController` whose `signal` is passed to `synthesizePlan({ signal })`, which
  forwards it into the Anthropic SDK (verified real signature:
  `SynthesizePlanOptions.signal?: AbortSignal`). On client disconnect the upstream
  stream closes and output-token billing stops. External abort writes **nothing**
  to the DB (there is no plan to record) — confirmed by the chat-022 chain, which
  re-throws on `signal.aborted`.
- **Lock release**: explicit `releaseLock` + `stopHeartbeat` run in the stream's
  `finally` (success OR error) and in `cancel()` (client disconnect). `del` is
  idempotent, so the double path is safe.

## 4. Trial-vs-paid single-path cap resolution

`subscription_status` is read **once** from `AuthenticatedUser`; the route routes to
**exactly one** cap (`apps/web/lib/regenerationLimits.ts`), never both:

- `subscription_status === 'trial'` → `checkTrialCap`: **2 generations per LOCAL
  day**, block the 3rd. Counts `completion_log` rows with `event_type IN
  ('plan_generated','plan_regenerated')` whose `logged_at >=
  start_of_local_day(timezone)`. The local-day boundary is computed **in Postgres**
  via `start_of_local_day(text)` (chat 004; STABLE, DST-correct).
- else → `checkActiveCap`: **5 per ROLLING hour**, block the 6th, via the chat-009
  Upstash sliding-window bucket `withRateLimit('plan-generate', userId)` (5 tokens /
  1h, `RATE_LIMITING.md`).

The two never compose. A capped request returns its 429 **before** the idempotency
lock is acquired (no lock is taken for a capped request).

## 5. completion_log real-column resolution + analytics.ts skew

The applied migration `20260601000010_completion_log.sql` defines columns
`(user_id, block_id, event_type completion_event_enum, value jsonb, logged_at)`.
The ORM model `packages/db/src/schema/analytics.ts` is **STALE/skewed** — it
declares `event_name` / `occurred_at` and omits `block_id` / `event_type`. Per the
chat-024 decision and the CHAT_111 §5 locked decision, `analytics.ts` is **NOT**
edited here; the durable fix is chat-006 `drizzle-kit pull`.

All completion_log access uses the **real columns** via raw parameterized SQL
(the write-side analog of `withUser`, scoped by explicit `user_id`):
- write: `INSERT INTO completion_log (user_id, event_type, value)` with
  `event_type = 'plan_generated'` (first time) or `'plan_regenerated'` (regeneration),
  and a `value` jsonb analytics payload `{ planDate, energyScore, source, blockCount,
  regenerationCount }`.
- trial-cap read: filters on `event_type` and `logged_at`.

**Brief-vs-reality column note:** the chat-025 brief's FILE 3 spec said
`created_at >= start_of_local_day(...)`. The real applied column is **`logged_at`**
(there is no `created_at` on completion_log). The implementation uses `logged_at`.

## 6. CD-flag F1 determination — **branch taken: forward-fix migration authored**

`packages/db/migrations/20260601000004_daily_planning.sql` creates `daily_plans`
with **no `approved_at` column**. The product is evening-anchored: the user reviews
and **approves** a drafted plan for tomorrow in the Vesper hour
(`LAYER_1_FOUNDATION` §, `LAYER_2_PRODUCT_SCOPE` evening, `LAYER_4` Vesper hour), so
the draft→approve loop needs an approved-state column. `approved_at` is **ABSENT**
⇒ per the F1 rule, a small forward-fix migration was authored.

- **Number:** suffix `22` — next free integer in the incremental range 14–30
  (`MIGRATION_NUMBER_ALLOCATION.md`); highest existing schema migration was `21`
  (`notebook_inferences`). Date prefix = authoring date `20260618`.
- **Change:** `ALTER TABLE public.daily_plans ADD COLUMN approved_at timestamptz`
  (nullable, no default — additive, backward-compatible). `NULL` = draft; chat
  **046-W** sets it on approval. The chat-025 generation path leaves it NULL (writes
  a draft).
- **Dual-write** (chats 048/108/111 convention; `config.toml` has no
  `migration_path` override → `supabase db push/reset` reads `supabase/migrations`):
  - canonical: `packages/db/migrations/20260618000022_daily_plans_approved_at.sql`
    + `.down.sql`
  - up-only mirror: `supabase/migrations/20260618000022_daily_plans_approved_at.sql`
- **Drizzle model NOT hand-edited:** `daily-planning.ts` is pull-generated; chat-006
  `drizzle-kit pull` will surface `approvedAt`. The chat-025 route does not read or
  write `approved_at`, so no model change is needed now.

**046-W inherits this:** the approve loop + completion wiring chat will set
`approved_at` and may add the Drizzle column once pull regenerates it.

> **Correction (2026-06-18) — migration 22 superseded and REMOVED.** The forward-fix
> migration authored above was **redundant**. It read only
> `20260601000004_daily_planning.sql` and missed that migration **0020**
> (`20260601000020_chat111_schema_checkpoint`, the chat-111 F1 checkpoint) had
> **already** added `daily_plans.approved_at` (and `daily_plans.status DEFAULT
> 'draft'`). Because 0020 sorts before 0022 in filename order,
> `pnpm --filter @vesper/db setup-test-db` failed on 0022 with
> `ERROR: column "approved_at" of relation "daily_plans" already exists (SQLSTATE 42701)`.
> The fix: migration **0020 is the legitimate owner** of `approved_at`; the 0022 files
> were deleted (canonical `.sql` + `.down.sql` and the supabase up-only mirror).
> Suffix 22 is retired (`docs/MIGRATION_NUMBER_ALLOCATION.md`). Full record:
> `docs/CHAT_025_HOTFIX_approved_at_dedup.md`.

## 7. Files

| File | Status |
|---|---|
| `apps/web/app/api/v1/plans/generate/route.ts` | replaced (was 501 stub) |
| `apps/web/app/api/v1/plans/generate/generatePlan.ts` | new (core: schema, commit, SSE stream) |
| `apps/web/lib/idempotency.ts` | new |
| `apps/web/lib/regenerationLimits.ts` | new |
| `apps/web/app/api/v1/plans/generate/generate.unit.test.ts` | new (pure, ungated) |
| `apps/web/app/api/v1/plans/generate/generate.integration.test.ts` | new (VESPER_DB_TESTS) |
| `packages/db/migrations/20260618000022_daily_plans_approved_at.sql` (+ `.down.sql`) | ~~new (F1)~~ **REMOVED 2026-06-18** — redundant; 0020 already added `approved_at` (see §6 correction) |
| `supabase/migrations/20260618000022_daily_plans_approved_at.sql` | ~~new (F1 mirror)~~ **REMOVED 2026-06-18** — redundant mirror (see §6 correction) |
| `packages/ai/src/index.ts` | one-line: re-export `APOLOGY_LINE` |
| `docs/CHAT_025_RESOLUTION_RECORD.md` | this file |

## 8. Integration test coverage (gated on `VESPER_DB_TESTS`)

409 on second concurrent acquire; `plan_generated` written to completion_log;
`source:'fallback'` recorded in value; trial 3rd-gen-in-local-day blocked (and
under-cap allowed); active 6th-in-hour blocked; regeneration increments
`regeneration_count` and replaces blocks. Pure cap/lock/schema/date-wrap assertions
are in `generate.unit.test.ts` (always run).
